"""Finding speakers and keeping an accurate household picture.

Strategy, in order of trust:

1. SSDP multicast to locate *any* ZonePlayer. Treated as lossy and best-effort.
2. ``GetZoneGroupState`` from a responder, which yields the complete household
   including units SSDP missed.
3. Per-player HTTP fetch of the device description, for model and serial detail
   that topology omits.
4. DNS-SD asked of the system's DNS server, when SSDP finds nothing because
   no multicast reaches Sonora at all (see ``dnssd``), and then every address
   on the named speakers' networks asked for a device description, for the
   households DNS-SD left out.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import socket
from dataclasses import dataclass

import aiohttp
from defusedxml import ElementTree as DET

from . import dnssd
from .const import (DEVICE_PROPERTIES, NS, SONOS_PORT, SSDP_ADDR, SSDP_PORT,
                    SSDP_TARGET, ZONE_GROUP_TOPOLOGY)
from .models import Household, Player
from .soap import SoapClient
from .topology import parse_zone_group_state, rebuild_zones, remap_groups

log = logging.getLogger(__name__)

SSDP_QUERY = "\r\n".join([
    "M-SEARCH * HTTP/1.1",
    f"HOST: {SSDP_ADDR}:{SSDP_PORT}",
    'MAN: "ssdp:discover"',
    "MX: 1",
    f"ST: {SSDP_TARGET}",
    "", "",
])


@dataclass(slots=True)
class SsdpReply:
    host: str
    server: str
    usn: str
    location: str


class _SsdpProtocol(asyncio.DatagramProtocol):
    def __init__(self) -> None:
        self.replies: dict[str, SsdpReply] = {}

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        headers: dict[str, str] = {}
        for line in data.decode(errors="replace").splitlines():
            if ":" in line:
                key, _, value = line.partition(":")
                headers[key.strip().upper()] = value.strip()
        if "SONOS" not in headers.get("SERVER", "").upper():
            return
        self.replies.setdefault(addr[0], SsdpReply(
            host=addr[0],
            server=headers.get("SERVER", ""),
            usn=headers.get("USN", ""),
            location=headers.get("LOCATION", ""),
        ))


async def ssdp_search(timeout: float = 3.0, bursts: int = 3) -> dict[str, SsdpReply]:
    """Multicast for ZonePlayers. Sends several bursts because replies get lost."""
    loop = asyncio.get_running_loop()
    transport, protocol = await loop.create_datagram_endpoint(
        _SsdpProtocol,
        local_addr=("0.0.0.0", 0),
        family=socket.AF_INET,
        allow_broadcast=True,
    )
    try:
        payload = SSDP_QUERY.encode()
        for _ in range(bursts):
            transport.sendto(payload, (SSDP_ADDR, SSDP_PORT))
            await asyncio.sleep(min(0.4, timeout / bursts))
        await asyncio.sleep(timeout)
    finally:
        transport.close()
    log.info("SSDP found %d ZonePlayer(s)", len(protocol.replies))
    return protocol.replies


#: What a speaker that missed the first ask is given on the second. Six
#: seconds is generous for a LAN and mean for a speaker on a busy channel;
#: this is the second chance, not the rule.
SLOW_DESCRIPTION_TIMEOUT = 20.0


async def fetch_device_description(
    session: aiohttp.ClientSession, host: str, *, timeout: float = 6.0
) -> dict[str, str]:
    """Read model, serial and room detail straight off a speaker."""
    url = f"http://{host}:{SONOS_PORT}/xml/device_description.xml"
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
        resp.raise_for_status()
        text = await resp.text()
    root = DET.fromstring(text)
    device = root.find("device:device", NS)
    if device is None:
        return {}

    def field(tag: str) -> str:
        return (device.findtext(f"device:{tag}", "", NS) or "").strip()

    # What this player actually offers. A socket is the case that matters: a
    # Play:1 whose model number happens to sit in the line-in list answered
    # every AudioIn subscription with 503, 135 times in one day, because the
    # list said it had one and the speaker knew better. The
    # device's own service list is the answer.
    services = {
        (node.text or "").rsplit(":", 2)[-2]
        for node in root.iter()
        if node.tag.endswith("serviceType") and (node.text or "").count(":") >= 3
    }

    return {
        "services": ",".join(sorted(s for s in services if s)),
        "udn": field("UDN").removeprefix("uuid:"),
        "model": field("modelName"),
        "model_number": field("modelNumber"),
        "display_name": field("displayName"),
        "name": field("roomName"),
        "software_version": field("softwareVersion"),
        "hardware_version": field("hardwareVersion"),
        "display_version": field("displayVersion"),
        "series_id": field("seriesid"),
        "extra_version": field("extraVersion"),
        "serial": field("serialNum"),
        "mac": field("MACAddress"),
        "household": field("householdID") or root.findtext(
            ".//device:householdID", "", NS) or "",
    }


#: How long each address in a sweep is given, and how many are asked at once.
#: Most speakers answer their description in milliseconds, but one took over
#: three seconds on its first ask; one per household is enough, and the
#: addresses that never answer are what the timeout costs.
SWEEP_TIMEOUT_S = 2.0
SWEEP_AT_ONCE = 128


#: How long a speaker asked at its own address is given. A speaker asleep on
#: Wi-Fi gets a unicast packet at its next wake, well within this.
PROBE_TIMEOUT_S = 4.0


async def probe_players(session: aiohttp.ClientSession, hosts: list[str]) -> list[str]:
    """Those of ``hosts`` that answer as a Sonos player, asked one by one at
    their own address. Multicast is what SSDP relies on, and a speaker idle
    on Wi-Fi may not get it: an access point holds or drops multicast for
    a client in power save, while a unicast request reaches it at its next
    wake. So the addresses Sonora knows are asked directly before the
    network is given up on."""
    limit = asyncio.Semaphore(SWEEP_AT_ONCE)

    async def ask(ip: str) -> str | None:
        async with limit:
            try:
                async with session.get(
                    f"http://{ip}:{SONOS_PORT}/xml/device_description.xml",
                    timeout=aiohttp.ClientTimeout(total=PROBE_TIMEOUT_S),
                ) as resp:
                    if resp.status == 200 and "<manufacturer>Sonos" in await resp.text():
                        return ip
            except Exception:
                pass
            return None

    found = await asyncio.gather(*(ask(ip) for ip in dict.fromkeys(hosts)))
    return [ip for ip in found if ip]


async def sweep_for_players(session: aiohttp.ClientSession, seeds: list[str]) -> list[str]:
    """Every address on the seeds' /24s that answers as a Sonos player.

    A DNS server that answers ``.local`` from the host's mDNS cache, as Docker
    Desktop's does on a Mac, names what the cache holds or else only the first
    speaker to answer: one household at best. Each household's topology names
    all of its own players and none of another's, so the rest are found by
    asking their network directly.
    """
    networks = {ipaddress.ip_network(f"{seed}/24", strict=False) for seed in seeds}
    limit = asyncio.Semaphore(SWEEP_AT_ONCE)

    async def ask(ip: str) -> str | None:
        async with limit:
            try:
                async with session.get(
                    f"http://{ip}:{SONOS_PORT}/xml/device_description.xml",
                    timeout=aiohttp.ClientTimeout(total=SWEEP_TIMEOUT_S),
                ) as resp:
                    if resp.status == 200 and "<manufacturer>Sonos" in await resp.text():
                        return ip
            except Exception:
                pass
            return None

    found = await asyncio.gather(*(ask(str(ip)) for network in sorted(networks)
                                   for ip in network.hosts()))
    hosts = [ip for ip in found if ip]
    log.info("sweep of %d network(s) found %d player(s)", len(networks), len(hosts))
    return hosts


class NoHousehold(Exception):
    """A speaker that answers but belongs to no household: one being set
    up, or just factory-reset. Not a system, so not shown as one."""

    def __init__(self, host: str) -> None:
        super().__init__(f"{host} is in no household")
        self.host = host


class HouseholdRegistry:
    """Discovers and holds every household visible on the network."""

    def __init__(self, soap: SoapClient, session: aiohttp.ClientSession) -> None:
        self._soap = soap
        self._session = session
        self.households: dict[str, Household] = {}
        #: Hosts that failed both description asks last time; see _enrich.
        self._down: set[str] = set()
        #: Addresses players were last seen at, from earlier runs: what an
        #: empty SSDP round asks directly, before any household is held.
        self.known_hosts: list[str] = []

    async def discover(self, *, timeout: float = 3.0) -> dict[str, Household]:
        replies = await ssdp_search(timeout=timeout)
        if not replies:
            # Nothing answered multicast. Speakers asleep on Wi-Fi behind an
            # access point that drops multicast for them do that, and so
            # does a network that never carries it; a unicast ask reaches
            # them all the same. The players held, then the addresses
            # remembered from before, are asked at their own address.
            known = [p.host for household in self.households.values() for p in household.players.values()]
            known += [host for host in self.known_hosts if host not in known]
            direct = await probe_players(self._session, known) if known else []
            if direct:
                log.info("SSDP unanswered; %d of %d known speaker(s) answered directly", len(direct), len(known))
            replies = {host: SsdpReply(host=host, server="", usn="", location="") for host in direct}
        if not replies:
            seeds = await dnssd.sonos_hosts()
            swept = await sweep_for_players(self._session, seeds) if seeds else []
            replies = {host: SsdpReply(host=host, server="", usn="", location="")
                       for host in [*seeds, *swept]}
        if not replies:
            if self.households:
                # One round in which nothing answers must not empty the
                # rooms: the picture held stands until a round does better.
                log.warning("no ZonePlayers answered SSDP or a direct ask; keeping the last "
                            "picture of %d household(s)", len(self.households))
                return self.households
            log.warning("no ZonePlayers answered SSDP")
            return {}

        # Ask every responder for topology. Different households answer with
        # their own view, and one household answering twice is harmless.
        seen_households: dict[str, Household] = {}
        asked: set[str] = set()

        for host in replies:
            if host in asked:
                continue
            try:
                household = await self.load_from(host)
            except NoHousehold:
                log.info("%s is in no household yet (being set up?); not shown", host)
                asked.add(host)
                continue
            except Exception as exc:
                log.warning("topology fetch from %s failed: %s", host, exc)
                continue
            asked.update(p.host for p in household.players.values())
            if household.id in seen_households:
                continue
            seen_households[household.id] = await self._second_opinion(household, host)

        # A household must not vanish because one round went badly. SSDP
        # answers come from a varying subset of players, and the one that
        # answered may be the one that has just gone quiet: once the
        # S1 household's only responder was a speaker that had stopped
        # answering HTTP, so the whole S1 system dropped out of Sonora while
        # ten other players were fine. Ask the missing household's other
        # players, and failing all of them keep the last picture.
        claimed = {uuid for household in seen_households.values() for uuid in household.players}
        for household_id, previous in self.households.items():
            if household_id in seen_households:
                continue
            # Every one of its players answered this round as part of another household: it was
            # a stand-in for that one, or the system has been merged into it. Not a missing one.
            if previous.players and set(previous.players) <= claimed:
                log.info("household %s: its players all belong to another household now; "
                         "dropping it", household_id)
                continue
            # A stand-in has no identity to keep: a speaker filed under one
            # because it could not say which household it was in, now not
            # answering at all, is most likely restarting into a real one.
            if household_id.startswith("unknown-"):
                log.info("stand-in household %s answered nothing this round; dropping it", household_id)
                continue
            for host in sorted({p.host for p in previous.players.values()} - asked):
                try:
                    household = await self.load_from(host)
                except NoHousehold:
                    log.info("%s is in no household now (being set up?)", host)
                    asked.add(host)
                    continue
                except Exception as exc:
                    log.warning("topology fetch from %s failed: %s", host, exc)
                    asked.add(host)
                    continue
                asked.update(p.host for p in household.players.values())
                seen_households.setdefault(household.id, household)
                break
            if household_id not in seen_households:
                log.warning("household %s answered nothing this round; keeping "
                            "its last known picture", household_id)
                seen_households[household_id] = previous

        self.households = seen_households
        return seen_households

    async def _shape(self, host: str) -> tuple[frozenset, int]:
        """Which rooms ``host`` believes are grouped together, and how many
        players it can see, without the device descriptions a full load
        fetches."""
        result = await self._soap.call(host, ZONE_GROUP_TOPOLOGY, "GetZoneGroupState")
        players, groups, _ = parse_zone_group_state(result.get("ZoneGroupState", ""))
        shape = frozenset((g.coordinator_uuid, frozenset(g.zone_uuids)) for g in groups.values())
        return shape, len(players)

    async def _second_opinion(self, first: Household, host: str) -> Household:
        """Check one speaker's picture of its household against another's.

        A speaker that has dropped off the network keeps the topology it last
        knew. One came back after half a minute of not answering, still
        describing a room alone and the room grouped with it not at all, and
        was first to answer SSDP, so Sonora showed that second room in no
        group while every other speaker had the two grouped. So
        one more player is asked; when the two differ a third settles it, and
        failing a majority the view that sees the most players wins, since
        a partitioned speaker sees fewer.
        """
        others = [p.host for p in first.players.values()
                  if p.online and not p.invisible and p.host != host
                  and not self._soap.is_silent(p.host)]
        views: list[tuple[str, frozenset, int]] = []
        try:
            views.append((host, *await self._shape(host)))
        except Exception:
            return first
        for other in others:
            try:
                views.append((other, *await self._shape(other)))
            except Exception:
                continue
            if len(views) == 2 and views[0][1] == views[1][1]:
                return first
            if len(views) == 3:
                break
        if len(views) < 2:
            return first
        shapes = [v[1] for v in views]
        agreed = [v for v in views if shapes.count(v[1]) >= 2]
        winner = agreed[0] if agreed else max(views, key=lambda v: v[2])
        if winner[0] == host:
            return first
        log.info("topology from %s disagreed with %s; using %s's",
                 host, ", ".join(v[0] for v in views[1:]), winner[0])
        try:
            return await self.load_from(winner[0])
        except Exception:
            return first

    async def load_from(self, host: str) -> Household:
        """Build a household picture by asking ``host`` for topology."""
        result = await self._soap.call(
            host, ZONE_GROUP_TOPOLOGY, "GetZoneGroupState")
        players, groups, vanished = parse_zone_group_state(
            result.get("ZoneGroupState", ""))

        await self._enrich(players)

        household_id = await self._household_id(host)
        if not household_id:
            raise NoHousehold(host)
        if household_id.startswith("unknown-"):
            household_id = self._known_household(players) or household_id
        control_id = await self._household_control_id(host)
        for player in players.values():
            player.household = household_id

        zones = rebuild_zones(players)
        household = Household(
            id=household_id,
            control_id=control_id,
            players=players,
            zones=zones,
            groups=remap_groups(groups, zones, players),
            vanished=vanished,
        )
        log.info("household %s: %d players, %d zones, %d groups, gen %s",
                 household_id, len(players), len(zones),
                 len(household.groups), household.generation)
        return household

    def _known_household(self, players: dict) -> str:
        """The household already holding any of ``players``, if one does.

        A speaker that misses its household-id question for one round still
        reports the same players; filing them under a stand-in id would show
        that system twice, so they go back under the id they had.
        """
        for household_id, household in self.households.items():
            if not household_id.startswith("unknown-") and set(household.players) & set(players):
                return household_id
        return ""

    async def _household_id(self, host: str) -> str:
        """Ask a speaker which household it belongs to.

        The device description omits this, so it takes a SOAP call. Falls back
        to the host address so two systems on one LAN never collide.
        """
        try:
            result = await self._soap.call(
                host, DEVICE_PROPERTIES, "GetHouseholdID")
        except Exception as exc:
            log.warning("GetHouseholdID from %s failed: %s", host, exc)
            return f"unknown-{host}"
        # An empty answer is an answer: the speaker is in no household. A
        # Play:1 factory-reset to move it from S1 to S2 said so while the
        # Sonos app was setting it up, and under a stand-in id it was shown
        # as a second S2 system for the quarter hour the move took.
        return result.get("CurrentHouseholdID") or ""

    async def _household_control_id(self, host: str) -> str:
        """Read the full household identifier from the support page.

        ``GetHouseholdID`` returns a truncated prefix of this. Sonos' own API
        wants the whole string and answers a truncated one with an empty
        result rather than an error.
        """
        try:
            url = f"http://{host}:{SONOS_PORT}/status/zp"
            async with self._session.get(
                url, timeout=aiohttp.ClientTimeout(total=6)
            ) as resp:
                resp.raise_for_status()
                text = await resp.text()
        except Exception as exc:
            log.info("household control id unavailable from %s: %s", host, exc)
            return ""
        match = re.search(r"<HouseholdControlID>([^<]+)<", text)
        return match.group(1).strip() if match else ""

    async def _enrich(self, players: dict[str, Player]) -> None:
        """Fill in model and serial detail off each speaker.

        A speaker the topology lists stays online even when its description
        does not come: the household's own picture decides presence, as in
        the Sonos apps. A wireless speaker on a weak link answered pings
        half the time and its description in five or six seconds, kept
        playing and stayed in every other speaker's topology, yet failed
        this check often enough that Sonora alone called it offline. Such a
        speaker keeps the detail last read from it, and household-wide reads
        steer around it for a while.
        """
        # Hosts that failed both asks last time get one ordinary ask, not the
        # patient retry: a speaker that is off the network cost every refresh
        # 26 seconds, and every grouping change waits on a refresh (one
        # such speaker held each one to 36).
        down: set[str] = getattr(self, "_down", set())
        self._down = down
        previous = {uuid: player
                    for household in getattr(self, "households", {}).values()
                    for uuid, player in household.players.items()}

        def unanswered(player: Player) -> None:
            down.add(player.host)
            soap = getattr(self, "_soap", None)
            if soap is not None:
                soap.mark_silent(player.host)
            last = previous.get(player.uuid)
            if last is None:
                return
            for field in ("model", "model_number", "display_name", "serial", "mac",
                          "hardware_version", "display_version", "series_id",
                          "extra_version", "services"):
                setattr(player, field, getattr(last, field))
            player.software_version = player.software_version or last.software_version

        async def one(player: Player) -> None:
            try:
                info = await fetch_device_description(self._session, player.host)
            except Exception as exc:
                if player.host in down:
                    log.info("%s (%s) still not answering", player.name, player.host)
                    unanswered(player)
                    return
                # A slow answer is not an absent speaker. A Play:5
                # answered its description in 5.5 seconds, half
                # a second inside the timeout, and every refresh that caught
                # it on the wrong side of that marked a playing speaker
                # offline -- which cost it its model, its software version,
                # its place in the diagnostics page and its rooms in the
                # group pickers. One patient retry before giving up on it.
                try:
                    info = await fetch_device_description(
                        self._session, player.host, timeout=SLOW_DESCRIPTION_TIMEOUT)
                except Exception:
                    log.info("%s (%s) not answering: %s", player.name, player.host, exc)
                    unanswered(player)
                    return
                log.info("%s (%s) answered slowly, not offline (%s on the first ask)",
                         player.name, player.host, type(exc).__name__)
            player.online = True
            down.discard(player.host)
            player.model = info.get("model", "")
            player.model_number = info.get("model_number", "")
            player.display_name = info.get("display_name", "")
            player.serial = info.get("serial", "")
            player.mac = info.get("mac", "")
            player.hardware_version = info.get("hardware_version", "")
            player.display_version = info.get("display_version", "")
            player.series_id = info.get("series_id", "")
            player.extra_version = info.get("extra_version", "")
            player.services = info.get("services", "")
            player.household = info.get("household", "")
            if info.get("software_version"):
                player.software_version = info["software_version"]
            if info.get("name"):
                player.name = info["name"]

        await asyncio.gather(*(one(p) for p in players.values()))
