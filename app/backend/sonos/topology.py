"""Parsing of ``ZoneGroupTopology`` state into the domain model.

``GetZoneGroupState`` is the authoritative view of a household. It is returned
by any member, describes every zone including ones that are currently
unreachable, and it changes as an evented variable, so a controller can hold an
accurate picture without polling. SSDP is only used to find a first speaker to
ask: on a SonosNet mesh, multicast replies get dropped often enough that a
sweep routinely misses units that are perfectly healthy.
"""

from __future__ import annotations

import logging
import re
from html import unescape

from defusedxml import ElementTree as DET

from .models import Group, Player, VanishedZone, Zone, zones_from_players

log = logging.getLogger(__name__)


def parse_zone_group_state(xml: str) -> tuple[dict[str, Player], dict[str, Group],
                                              list[VanishedZone]]:
    """Turn a ``ZoneGroupState`` document into players, groups and vanished zones."""
    # The payload arrives double-encoded inside the SOAP response.
    if "&lt;" in xml and "<ZoneGroupState>" not in xml:
        xml = unescape(xml)
    root = DET.fromstring(xml)

    players: dict[str, Player] = {}
    groups: dict[str, Group] = {}

    for group_el in root.iter("ZoneGroup"):
        coordinator = group_el.get("Coordinator", "")
        group_id = group_el.get("ID", "")
        member_uuids: list[str] = []

        for member in group_el.findall("ZoneGroupMember"):
            player = _player_from_member(member)
            if player is None:
                continue
            players[player.uuid] = player
            member_uuids.append(player.uuid)
            # Surround satellites and subs are nested one level deeper.
            for sat in member.findall("Satellite"):
                satellite = _player_from_member(sat)
                if satellite is not None:
                    satellite.invisible = True
                    players[satellite.uuid] = satellite

        if group_id:
            groups[group_id] = Group(
                id=group_id,
                coordinator_uuid=coordinator,
                zone_uuids=member_uuids,
            )

    vanished: list[VanishedZone] = []
    for el in root.iter("VanishedDevices"):
        for dev in el.findall("Device"):
            vanished.append(VanishedZone(
                uuid=dev.get("UUID", ""),
                name=dev.get("ZoneName", ""),
                reason=dev.get("Reason", ""),
                model_number=dev.get("ModelInfo", ""),
                mac=dev.get("Mac", ""),
                last_ip=dev.get("LastKnownIP", ""),
                last_seen=dev.get("LastSeenUTC", ""),
            ))

    return players, groups, vanished


def _player_from_member(member) -> Player | None:
    uuid = member.get("UUID")
    location = member.get("Location") or ""
    if not uuid:
        return None
    host_match = re.search(r"https?://([^:/]+)", location)
    if not host_match:
        return None
    return Player(
        wireless_mode=_opt_int(member.get("WirelessMode")),
        uuid=uuid,
        name=member.get("ZoneName", "") or "",
        host=host_match.group(1),
        software_version=member.get("SoftwareVersion", "") or "",
        hardware_version=member.get("HTAudioIn", "") or "",
        icon=member.get("Icon", "") or "",
        invisible=member.get("Invisible") == "1",
        channel_map=(member.get("ChannelMapSet")
                     or member.get("HTSatChanMapSet") or ""),
        channel_map_kind=("pair" if member.get("ChannelMapSet")
                          else "ht" if member.get("HTSatChanMapSet") else ""),
        boot_seq=int(member.get("BootSeq") or 0),
        # A member the household cannot reach is reported with IsZoneBridge
        # absent and a zero boot sequence; treat presence in topology as online
        # until an HTTP probe says otherwise.
        online=True,
    )


def rebuild_zones(players: dict[str, Player]) -> dict[str, Zone]:
    """Collapse a player map into zones keyed by primary player UUID."""
    return zones_from_players(players.values())


def remap_groups(groups: dict[str, Group], zones: dict[str, Zone],
                 players: dict[str, Player]) -> dict[str, Group]:
    """Rewrite group membership from player UUIDs to zone UUIDs.

    Topology lists every bonded player as a group member, which would show a
    stereo pair as two rooms. Controllers show one.
    """
    zone_of_player: dict[str, str] = {}
    for zone in zones.values():
        for player in zone.players:
            zone_of_player[player.uuid] = zone.uuid

    out: dict[str, Group] = {}
    for gid, group in groups.items():
        seen: list[str] = []
        for uuid in group.zone_uuids:
            zone_uuid = zone_of_player.get(uuid)
            if zone_uuid and zone_uuid not in seen:
                seen.append(zone_uuid)
        coordinator_zone = zone_of_player.get(
            group.coordinator_uuid, group.coordinator_uuid)
        # Sort so the coordinator leads, then rooms alphabetically, which is
        # how both the desktop and web controllers render a group.
        rest = sorted(u for u in seen if u != coordinator_zone)
        out[gid] = Group(
            id=gid,
            coordinator_uuid=coordinator_zone,
            zone_uuids=([coordinator_zone] if coordinator_zone in seen else []) + rest,
        )
    return out


def _opt_int(raw: str | None) -> int | None:
    """An integer attribute, or ``None`` when absent or not numeric."""
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except ValueError:
        return None
