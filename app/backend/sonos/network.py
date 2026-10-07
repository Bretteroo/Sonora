"""Household-wide network and radio picture, assembled per speaker.

Three sources are combined, because no single one of them is sufficient.

Each speaker reports its own radio conditions: operating channel, per-chain
noise floor, and accumulated PHY errors. It also reports a table of other
Sonos units it can hear, with signal margins in both directions.

That neighbor table needs care in interpretation. It is not necessarily an
audio path. When speakers are joined to an ordinary access point rather than
forming a SonosNet mesh, audio travels speaker to access point, and the
neighbor table merely records that units on the same channel can hear one
another. It remains useful as a measure of each room's radio conditions, since
a room every other speaker hears faintly is a room with poor RF, but it must
not be read as the route audio takes. ``brctl showstp br0`` reporting STP
disabled is the tell that no bridged mesh exists.

What the speakers never report is the quality of their link to the access
point, which on such a system is the link that actually carries audio. That gap
is filled by probing from the controller; see ``probe.py``.

Comparisons are made within a household wherever possible rather than against
fixed thresholds. Absolute numbers mislead: PHY error counts are cumulative
since boot, so a speaker up for a year always looks worse than one rebooted
yesterday, and noise floors vary by hardware generation, an S1 Play:1 reading
around -109 dBm where an Arc Ultra reads -98 dBm.
"""

from __future__ import annotations

import asyncio
from time import monotonic
import logging
from dataclasses import dataclass, field

import aiohttp

from .diagnostics import (MARGIN_FAIR, MARGIN_POOR, InterfaceCounters,
                          WirelessStatus, mac_from_uuid, parse_ifconfig,
                          parse_enetports, parse_showstp, parse_wireless_status, rate_margin)
from .models import Household, Player, Zone
from .probe import (JITTER_FAIR_MS, LATENCY_FAIR_MS, LATENCY_GOOD_MS, P95_FAIR_MS,
                    P95_GOOD_MS, STALL_MS, LatencyReport,
                    probe_all)

log = logging.getLogger(__name__)

WIRELESS_PATH = "/status/proc/ath_rincon/status"
IFCONFIG_PATH = "/status/ifconfig"
SHOWSTP_PATH = "/status/showstp"
ENETPORTS_PATH = "/status/enetports"

#: 2.4GHz channels that do not overlap one another.
CLEAN_CHANNELS = (1, 6, 11)


def channel_from_freq(freq: int) -> int:
    """Convert a center frequency in MHz to an IEEE channel number."""
    if freq == 2484:
        return 14
    if 2412 <= freq <= 2472:
        return (freq - 2407) // 5
    if 5000 < freq < 6000:
        return (freq - 5000) // 5
    return 0


@dataclass(slots=True)
class RadioFacts:
    """Radio configuration a speaker reports through ``DeviceProperties``.

    These arrive by event rather than by request, so they are optional. When
    absent, findings that depend on them are simply not produced.
    """

    channel_freq: int = 0
    #: S1 field. 0 when the unit carries traffic over Ethernet.
    wireless_mode: int | None = None
    #: S2 field. 1 when an Ethernet link is up.
    eth_link: int | None = None
    wifi_enabled: bool = True
    #: A leaf will not relay traffic for other speakers.
    leaf_only: bool = False
    behind_extender: bool = False
    has_configured_ssid: bool = True
    is_zone_bridge: bool = False

    @classmethod
    def from_event_properties(cls, props: dict[str, str]) -> "RadioFacts":
        def as_int(key: str) -> int | None:
            raw = props.get(key)
            if raw is None or raw == "":
                return None
            try:
                return int(raw)
            except ValueError:
                return None

        return cls(
            channel_freq=as_int("ChannelFreq") or 0,
            wireless_mode=as_int("WirelessMode"),
            eth_link=as_int("EthLink"),
            wifi_enabled=props.get("WifiEnabled", "1") == "1",
            leaf_only=props.get("WirelessLeafOnly", "0") == "1",
            behind_extender=props.get("BehindWifiExtender", "0") == "1",
            has_configured_ssid=props.get("HasConfiguredSSID", "1") == "1",
            is_zone_bridge=props.get("IsZoneBridge", "0") == "1",
        )

    @property
    def wired(self) -> bool | None:
        """Whether this unit's backhaul is Ethernet, or ``None`` if unknown."""
        if self.eth_link is not None:
            return self.eth_link == 1
        if self.wireless_mode is not None:
            return self.wireless_mode == 0
        return None


@dataclass(slots=True)
class Observation:
    """One speaker's measurement of a link to a peer."""

    observer_zone: str
    observer_name: str
    #: Margin in dB for traffic arriving from the peer.
    rx_margin: int
    #: Margin in dB for traffic sent to the peer.
    tx_margin: int
    rssi: int | None = None
    stp: str = ""


@dataclass(slots=True)
class PeerLink:
    """What two rooms can hear of each other, merging both points of view.

    Both speakers usually report the same pairing from their own side. Keeping
    both measurements matters, because the two ends often disagree, and a
    pairing one speaker calls healthy while the other calls marginal indicates
    conditions worse than either number alone suggests.

    This is a hearing relationship, not necessarily a traffic route.
    """

    zone_a: str
    zone_b: str
    name_a: str
    name_b: str
    observations: list[Observation] = field(default_factory=list)

    @property
    def reciprocal(self) -> bool:
        return len({o.observer_zone for o in self.observations}) > 1

    @property
    def worst_margin(self) -> int:
        return min(min(o.rx_margin, o.tx_margin) for o in self.observations)

    @property
    def best_margin(self) -> int:
        return max(max(o.rx_margin, o.tx_margin) for o in self.observations)

    @property
    def asymmetry(self) -> int:
        """Spread between the strongest and weakest direction measured."""
        return self.best_margin - self.worst_margin

    @property
    def quality(self) -> str:
        return rate_margin(self.worst_margin)

    @property
    def rssi(self) -> int | None:
        values = [o.rssi for o in self.observations if o.rssi is not None]
        return min(values) if values else None

    def label(self) -> str:
        return f"{self.name_a} to {self.name_b}"


@dataclass(slots=True)
class Finding:
    """Something worth telling the user about their network."""

    severity: str  # "critical" | "warning" | "info"
    code: str
    zone: str
    title: str
    detail: str
    remedy: str = ""


@dataclass(slots=True)
class ZoneRadio:
    """One speaker's radio state, with the room it belongs to attached.

    A room can have more than one: a stereo pair is two speakers and a home
    theater more, each with its own radio, its own place in the house and its
    own view of the mesh. ``zone_uuid`` names the room they share; ``role`` is
    the channel this one carries, empty for a speaker standing alone.
    """

    zone_uuid: str
    zone_name: str
    host: str
    model: str
    wireless: WirelessStatus
    interfaces: dict[str, InterfaceCounters] = field(default_factory=dict)
    facts: RadioFacts | None = None
    player_uuid: str = ""
    role: str = ""
    #: Whether any Ethernet port has a link, from the speaker's own
    #: /status/enetports; None when it did not answer.
    ethernet: bool | None = None
    #: How fast the radio's PHY errors and the speaker's dropped or failed
    #: packets grow, per minute, over the reads this check made (see
    #: ``NetworkCollector._rates``). None until two reads are in hand.
    phy_errors_per_min: float | None = None
    drops_per_min: float | None = None
    #: When the first read of this check was made (monotonic seconds).
    read_at: float = 0.0

    @property
    def label(self) -> str:
        """The speaker as a person should read it: ``Den (L)``."""
        return f"{self.zone_name} ({self.role})" if self.role else self.zone_name

    @property
    def channel(self) -> int:
        if self.facts and self.facts.channel_freq:
            return channel_from_freq(self.facts.channel_freq)
        return channel_from_freq(self.wireless.operating_channel)

    @property
    def wired(self) -> bool | None:
        # The speaker's own port table first: every speaker answers it, the
        # second half of a pair included, where the DeviceProperties facts
        # come only from the speaker a room is named after. A pair's
        # second half had no facts, read as "unknown", and so S1 never got
        # the "Every speaker reaches the network over WiFi" that S2 did.
        if self.ethernet is not None:
            return self.ethernet
        return self.facts.wired if self.facts else None


@dataclass(slots=True)
class NetworkSnapshot:
    """A household's complete wireless picture at one moment."""

    household_id: str
    #: Every speaker's radio, keyed by the speaker's own UUID -- a room with a
    #: stereo pair has two entries, one per half.
    radios: dict[str, ZoneRadio] = field(default_factory=dict)
    links: list[PeerLink] = field(default_factory=list)
    #: Controller-to-speaker timing, keyed the same way. This is the only
    #: measurement of the path audio actually takes on a household of plain
    #: WiFi stations, so it is kept beside the radio data rather than under it.
    latency: dict[str, LatencyReport] = field(default_factory=dict)
    findings: list[Finding] = field(default_factory=list)
    unreachable: list[str] = field(default_factory=list)

    @property
    def peers_audible(self) -> bool:
        """Whether any speaker can hear another directly."""
        return bool(self.links)

    @property
    def channels_in_use(self) -> dict[int, list[str]]:
        out: dict[int, list[str]] = {}
        for radio in self.radios.values():
            if radio.channel:
                out.setdefault(radio.channel, []).append(radio.label)
        return out

    @property
    def weakest_links(self) -> list[PeerLink]:
        return sorted(self.links, key=lambda link: link.worst_margin)

    def links_for(self, zone_uuid: str) -> list[PeerLink]:
        return [l for l in self.links
                if zone_uuid in (l.zone_a, l.zone_b)]


class NetworkCollector:
    """Fetches and assembles wireless diagnostics for a household."""

    def __init__(self, session: aiohttp.ClientSession) -> None:
        self._session = session

    async def _fetch(self, host: str, path: str) -> str | None:
        url = f"http://{host}:1400{path}"
        try:
            async with self._session.get(
                url, timeout=aiohttp.ClientTimeout(total=8)
            ) as resp:
                resp.raise_for_status()
                return await resp.text()
        except Exception as exc:
            log.info("diagnostics fetch %s failed: %s", url, exc)
            return None

    async def collect(
        self,
        household: Household,
        facts: dict[str, RadioFacts] | None = None,
        *,
        probe: bool = True,
        probe_samples: int = 15,
    ) -> NetworkSnapshot:
        """Gather diagnostics for every reachable zone.

        ``facts`` maps a zone UUID to radio configuration captured from
        ``DeviceProperties`` events, when the caller has an event cache.
        Set ``probe`` false to skip the active latency measurement, which is
        the slowest part of a collection.
        """
        snapshot = NetworkSnapshot(household_id=household.id)
        facts = facts or {}

        async def one(zone: Zone, player: Player) -> None:
            host = player.host
            label = (f"{zone.name} ({player.role_label})"
                     if player.role_label else zone.name)
            read_at = monotonic()
            wireless_body, ifconfig_body, stp_body, enet_body = await asyncio.gather(
                self._fetch(host, WIRELESS_PATH),
                self._fetch(host, IFCONFIG_PATH),
                self._fetch(host, SHOWSTP_PATH),
                self._fetch(host, ENETPORTS_PATH),
            )
            if wireless_body is None:
                snapshot.unreachable.append(label)
                return
            wireless = parse_wireless_status(host, wireless_body)
            wireless.bridge_stp = parse_showstp(stp_body)
            snapshot.radios[player.uuid] = ZoneRadio(
                zone_uuid=zone.uuid,
                zone_name=zone.name,
                host=host,
                model=player.model,
                wireless=wireless,
                interfaces=parse_ifconfig(ifconfig_body) if ifconfig_body else {},
                # Radio facts come from the room's own DeviceProperties events,
                # so only the speaker the room is named after has them.
                facts=facts.get(player.uuid) or (facts.get(zone.uuid)
                                                 if player.uuid == zone.uuid else None),
                player_uuid=player.uuid,
                role=player.role_label,
                ethernet=parse_enetports(enet_body),
                read_at=read_at,
            )

        # Every speaker, not one per room: the other half of a stereo pair has
        # its own radio in its own spot, and asking only the primary left it
        # out of the check entirely.
        await asyncio.gather(*(
            one(zone, player)
            for zone in household.visible_zones
            for player in zone.players
            if player.online
        ))

        snapshot.links = self._build_links(household, snapshot)

        if probe:
            targets = {r.host: r.label for r in snapshot.radios.values()}
            by_host = await probe_all(targets, samples=probe_samples)
            host_to_player = {r.host: uuid
                              for uuid, r in snapshot.radios.items()}
            snapshot.latency = {
                host_to_player[host]: report
                for host, report in by_host.items()
                if host in host_to_player
            }

        await self._rates(snapshot)
        snapshot.findings = self._derive_findings(snapshot)
        return snapshot

    @staticmethod
    def _drop_total(interfaces: dict[str, InterfaceCounters]) -> int | None:
        """Dropped or failed packets on the interfaces that carry the
        speaker's traffic: its radio, or its Ethernet port when it is wired.

        Not the bridge: br0 counts every frame it has no use for (other
        devices' broadcasts and the like) as dropped, about one a second on
        every speaker here, S1 and S2 alike, while the Wi-Fi link itself lost
        nothing (two speakers' apcli0, 2026-10-02). Summing it
        in showed a healthy room dropping 74 packets a minute. Interfaces with
        no traffic say nothing either way. None when the speaker lists no
        such interface: an S1 Play:1 shows only br0 and an idle eth0.
        """
        carrying = [i for name, i in interfaces.items()
                    if name != "lo" and not name.startswith("br")
                    and (i.rx_packets or i.tx_packets)]
        if not carrying:
            return None
        return sum(i.rx_errors + i.rx_dropped + i.tx_errors + i.tx_dropped for i in carrying)

    async def _rates(self, snapshot: NetworkSnapshot) -> None:
        """Error and drop rates per minute, for S1 and S2 alike.

        A speaker that hears no peers has no signal figure (an S2 system of
        three rooms, 2026-10-02), but every speaker counts PHY errors on its
        radio and dropped or failed packets on its interfaces. A total says
        little; how fast it grows says whether the link is struggling now. So
        each speaker is read again once the response-time probes are done, a
        few seconds after the first read, and the growth is per minute. The
        radio's PHY count restarts at every read, so the second reading is
        itself the growth since the first.
        """
        if not snapshot.radios:
            return
        # The probes take seconds; with probing off, the second read waits
        # long enough to count something.
        wait = 4.0 - (monotonic() - min(r.read_at for r in snapshot.radios.values()))
        if wait > 0:
            await asyncio.sleep(wait)

        async def again(uuid: str, radio: ZoneRadio) -> None:
            then, drops_then = radio.read_at, self._drop_total(radio.interfaces)
            wireless_body, ifconfig_body = await asyncio.gather(
                self._fetch(radio.host, WIRELESS_PATH),
                self._fetch(radio.host, IFCONFIG_PATH))
            now = monotonic()
            minutes = (now - then) / 60
            if minutes <= 0:
                return
            if wireless_body is not None:
                radio.phy_errors_per_min = round(
                    parse_wireless_status(radio.host, wireless_body).phy_errors / minutes, 1)
            if ifconfig_body and drops_then is not None:
                drops_now = self._drop_total(parse_ifconfig(ifconfig_body))
                if drops_now is not None:
                    radio.drops_per_min = round(max(0, drops_now - drops_then) / minutes, 1)

        await asyncio.gather(*(again(uuid, r) for uuid, r in snapshot.radios.items()))

    # -- assembly ------------------------------------------------------------

    @staticmethod
    def _build_links(household: Household, snapshot: NetworkSnapshot) -> list[PeerLink]:
        """Resolve neighbor entries to rooms, merging both ends of each link.

        Bonded satellites appear in neighbor tables under their own MAC, so
        every player MAC is mapped, not only the visible ones.
        """
        zone_by_mac: dict[str, tuple[str, str]] = {}
        for zone in household.zones.values():
            for player in zone.players:
                mac = (player.mac or mac_from_uuid(player.uuid)).upper()
                if mac:
                    zone_by_mac[mac] = (zone.uuid, zone.name)

        merged: dict[tuple[str, str], PeerLink] = {}
        for radio in snapshot.radios.values():
            # Only a mesh has links. A unit on the household's WiFi hears its
            # neighbors on the channel, but nothing passes between them, and
            # drawing those as connections between S1 rooms misled; its
            # own radio reading still comes from the table.
            if not radio.wireless.on_sonosnet:
                continue
            for neighbor in radio.wireless.neighbors:
                target = zone_by_mac.get(neighbor.device_mac)
                if target is None:
                    continue
                peer_uuid, peer_name = target
                if peer_uuid == radio.zone_uuid:
                    continue  # the other half of a stereo pair

                key = tuple(sorted((radio.zone_uuid, peer_uuid)))
                link = merged.get(key)
                if link is None:
                    # Orient the link so zone_a matches the sorted key, which
                    # keeps the pair stable no matter who reported it first.
                    if key[0] == radio.zone_uuid:
                        name_a, name_b = radio.zone_name, peer_name
                    else:
                        name_a, name_b = peer_name, radio.zone_name
                    link = PeerLink(zone_a=key[0], zone_b=key[1],
                                    name_a=name_a, name_b=name_b)
                    merged[key] = link
                link.observations.append(Observation(
                    observer_zone=radio.zone_uuid,
                    observer_name=radio.label,
                    rx_margin=neighbor.rx_margin,
                    tx_margin=neighbor.tx_margin,
                    rssi=radio.wireless.rssi_for(neighbor),
                    stp=neighbor.stp,
                ))
        return list(merged.values())

    @staticmethod
    def _derive_findings(snapshot: NetworkSnapshot) -> list[Finding]:
        findings: list[Finding] = []
        radios = snapshot.radios

        # -- per-zone connectivity -------------------------------------------
        for zone_uuid, radio in radios.items():
            links = snapshot.links_for(zone_uuid)
            if not links:
                continue
            best = max(links, key=lambda l: l.worst_margin)
            peer = best.name_b if best.zone_a == zone_uuid else best.name_a
            if best.worst_margin < MARGIN_POOR:
                findings.append(Finding(
                    severity="critical",
                    code="isolated_zone",
                    zone=radio.zone_name,
                    title=f"{radio.zone_name} has no strong path to the rest "
                          f"of the system",
                    detail=f"Its best link is {best.worst_margin} dB to "
                           f"{peer}. Below {MARGIN_POOR} dB audio tends to cut "
                           f"out rather than merely stutter.",
                    remedy="Move this speaker closer to another one, or wire "
                           "it to the network.",
                ))
            elif best.worst_margin < MARGIN_FAIR:
                findings.append(Finding(
                    severity="warning",
                    code="weak_zone",
                    zone=radio.zone_name,
                    title=f"{radio.zone_name} is only weakly connected",
                    detail=f"Its best link is {best.worst_margin} dB to "
                           f"{peer}, and every other room is weaker still.",
                    remedy="Expect occasional stutter when several rooms play "
                           "together. Moving it a few meters usually helps "
                           "more than any setting.",
                ))

        # -- links the two ends disagree about -------------------------------
        for link in snapshot.links:
            if link.asymmetry >= 10 and link.worst_margin < MARGIN_FAIR:
                views = ", ".join(
                    f"{o.observer_name} sees {o.rx_margin} dB in and "
                    f"{o.tx_margin} dB out"
                    for o in link.observations
                )
                findings.append(Finding(
                    severity="warning",
                    code="asymmetric_link",
                    zone=link.name_a,
                    title=f"The link between {link.name_a} and {link.name_b} "
                          f"is lopsided",
                    detail=f"{views}. A link that is fine one way and weak the "
                           f"other usually means an obstruction or a nearby "
                           f"transmitter rather than distance.",
                    remedy="Look for a large metal object, an aquarium, or a "
                           "cordless phone base between the two rooms.",
                ))

        # -- channel agreement, judged within the mesh -----------------------
        # Only SonosNet speakers relay for one another, so only they need to
        # share a channel. A speaker on the household's WiFi is on whatever
        # channel its access point uses, and two of them on different
        # channels have simply joined different access points, which is
        # normal wherever there is more than one.
        channels: dict[int, list[str]] = {}
        for radio in snapshot.radios.values():
            if radio.channel and radio.wireless.on_sonosnet:
                channels.setdefault(radio.channel, []).append(radio.label)
        if len(channels) > 1:
            majority = max(channels, key=lambda c: len(channels[c]))
            for channel, rooms in channels.items():
                if channel == majority:
                    continue
                findings.append(Finding(
                    severity="warning",
                    code="channel_outlier",
                    zone=rooms[0] if len(rooms) == 1 else "",
                    title=f"{', '.join(rooms)} "
                          f"{'is' if len(rooms) == 1 else 'are'} on a "
                          f"different channel from the rest of the system",
                    detail=f"Channel {channel} against channel {majority} for "
                           f"{len(channels[majority])} other room"
                           f"{'s' if len(channels[majority]) != 1 else ''}. "
                           f"Speakers on different channels cannot help each "
                           f"other relay audio.",
                    remedy="Often caused by a WiFi extender. Rebooting the "
                           "speaker usually returns it to the household "
                           "channel.",
                ))

        # Overlap is a 2.4GHz matter, whoever chose the channel: SonosNet's
        # own setting on a mesh, the router's on WiFi. The 5GHz channels do
        # not overlap one another.
        mesh = bool(channels)
        in_use = snapshot.channels_in_use
        overlapping = sorted(c for c in in_use if 0 < c <= 14 and c not in CLEAN_CHANNELS)
        if overlapping:
            findings.append(Finding(
                severity="info",
                code="overlapping_channel",
                zone="",
                title=f"Channel {', '.join(str(c) for c in overlapping)} "
                      f"overlaps its neighbors",
                detail="On 2.4GHz only channels 1, 6 and 11 avoid overlapping "
                       "each other, so anything else collides with two "
                       "channels' worth of traffic.",
                remedy=("Move SonosNet to 1, 6 or 11, whichever your router "
                        "is not using." if mesh else
                        "Set your router's 2.4GHz channel to 1, 6 or 11."),
            ))

        # The room-by-room readings that used to be findings here (no
        # answer, lost probes, stalls, an uneven connection, a noisy spot,
        # radio errors, every unit on Wi-Fi, an extender) are each room's
        # verdict now (``room_health``), shown on its card, so the same fact
        # is not said twice in two places with two thresholds.
        # The noise floor and PHY errors were never verdicts: a speaker that
        # is not on SonosNet hears its neighbors without exchanging anything
        # with them, so neither said how its connection was doing.

        for radio in radios.values():
            facts = radio.facts
            if facts is None:
                continue
            if facts.leaf_only and radio.wireless.on_sonosnet:
                findings.append(Finding(
                    severity="info",
                    code="leaf_only",
                    zone=radio.label,
                    title=f"{radio.label} will not relay for other "
                          f"speakers",
                    detail="It is configured as a leaf, so rooms further away "
                           "cannot route audio through it.",
                ))

        order = {"critical": 0, "warning": 1, "info": 2}
        findings.sort(key=lambda f: (order.get(f.severity, 3), f.zone, f.code))
        return findings


#: Dropped or failed packets per minute on the speaker's own link that are
#: worth a look. A healthy link here drops none (2026-10-02).
DROPS_WATCH_PER_MIN = 5.0


def room_health(radio: ZoneRadio, report: LatencyReport | None) -> dict:
    """One verdict for a speaker's connection, and why, from what every
    speaker can be measured by, S1 or S2, peers or none.

    ``level`` is ``good``, ``watch`` or ``problem``; ``reasons`` are codes
    with their figures, worst first, for the page to put into words. Built
    from the answers Sonora times (the typical one, the slowest one in
    twenty, the slowest of all, the ones that never came), the packets the
    speaker's own link dropped, and an extender in the way. Signal strength
    is not among them: no speaker reports how well it hears the router.
    """
    reasons: list[dict] = []
    level = "good"

    def note(code: str, at: str, **figures) -> None:
        nonlocal level
        reasons.append({"code": code, **figures})
        if at == "problem" or level == "good":
            level = at

    if report is None or not report.samples:
        attempts = report.attempts if report else 0
        return {"level": "problem", "reasons": [{"code": "no_answer", "attempts": attempts}]}
    median, p95, worst = report.median or 0.0, report.p95 or 0.0, report.worst or 0.0
    if report.failures:
        note("lost", "problem" if report.loss > 0.15 else "watch",
             failed=report.failures, attempts=report.attempts)
    if median > LATENCY_FAIR_MS:
        note("slow", "problem", median=round(median))
    elif p95 > P95_FAIR_MS:
        note("slow_often", "problem", p95=round(p95))
    elif median > LATENCY_GOOD_MS:
        note("slow", "watch", median=round(median))
    elif p95 > P95_GOOD_MS:
        note("uneven", "watch", p95=round(p95))
    if worst >= STALL_MS and p95 <= P95_FAIR_MS:
        note("stall", "watch", worst=round(worst))
    if radio.drops_per_min is not None and radio.drops_per_min >= DROPS_WATCH_PER_MIN:
        note("dropping", "watch", rate=radio.drops_per_min)
    if radio.facts is not None and radio.facts.behind_extender:
        note("extender", "watch")
    if not reasons:
        reasons.append({"code": "ok", "median": round(median)})
    order = {"no_answer": 0, "lost": 1, "slow": 2, "slow_often": 2, "stall": 3,
             "uneven": 4, "dropping": 5, "extender": 6, "ok": 9}
    reasons.sort(key=lambda r: order.get(r["code"], 8))
    return {"level": level, "reasons": reasons}
