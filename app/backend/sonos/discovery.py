"""Finding speakers and keeping an accurate household picture.

Strategy, in order of trust:

1. SSDP multicast to locate *any* ZonePlayer. Treated as lossy and best-effort.
2. ``GetZoneGroupState`` from a responder, which yields the complete household
   including units SSDP missed.
3. Per-player HTTP fetch of the device description, for model and serial detail
   that topology omits.
4. Optional unicast sweep of the local subnet, for the case where multicast is
   blocked outright by an access point.
"""

from __future__ import annotations

import asyncio
import logging
import re
import socket
from dataclasses import dataclass

import aiohttp
from defusedxml import ElementTree as DET

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


class HouseholdRegistry:
    """Discovers and holds every household visible on the network."""

    def __init__(self, soap: SoapClient, session: aiohttp.ClientSession) -> None:
        self._soap = soap
        self._session = session
        self.households: dict[str, Household] = {}
        #: Hosts that failed both description asks last time; see _enrich.
        self._down: set[str] = set()

    async def discover(self, *, timeout: float = 3.0) -> dict[str, Household]:
        replies = await ssdp_search(timeout=timeout)
        if not replies:
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
        for household_id, previous in self.households.items():
            if household_id in seen_households:
                continue
            for host in sorted({p.host for p in previous.players.values()} - asked):
                try:
                    household = await self.load_from(host)
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
        return result.get("CurrentHouseholdID") or f"unknown-{host}"

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
        """Fill in model and serial detail, and mark unreachable units offline."""
        # Hosts that failed both asks last time get one ordinary ask, not the
        # patient retry: a speaker that is off the network cost every refresh
        # 26 seconds, and every grouping change waits on a refresh (one
        # such speaker held each one to 36).
        down: set[str] = getattr(self, "_down", set())
        self._down = down

        async def one(player: Player) -> None:
            try:
                info = await fetch_device_description(self._session, player.host)
            except Exception as exc:
                if player.host in down:
                    log.info("%s (%s) still unreachable", player.name, player.host)
                    player.online = False
                    return
                # A slow answer is not an absent speaker. A Play:5
                # answered its description in 5.5 seconds, half
                # a second inside the timeout, and every refresh that caught
                # it on the wrong side of that marked a playing speaker
                # offline -- which cost it its model, its software version,
                # its place in the diagnostics page and its rooms in the
                # group pickers. One patient retry before condemning it.
                try:
                    info = await fetch_device_description(
                        self._session, player.host, timeout=SLOW_DESCRIPTION_TIMEOUT)
                except Exception:
                    log.info("%s (%s) unreachable: %s", player.name, player.host, exc)
                    player.online = False
                    down.add(player.host)
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
