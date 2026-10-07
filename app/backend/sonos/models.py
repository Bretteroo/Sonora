"""Domain model for a Sonos household.

Terminology follows what the devices themselves use, because the wire protocol
and the official apps disagree with each other and the devices win:

zone / room
    One visible entry in a controller's room list. Usually one speaker, but a
    stereo pair or a surround set is a single zone made of several players.
player
    One physical unit, identified by a ``RINCON_...`` UUID.
group
    One or more zones playing in sync, steered by a coordinator. A solo zone is
    still a group of one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

from .const import URI_SCHEMES

#: Firmware major version at which a household becomes S2. S1 tops out at 57.
S2_FIRMWARE_FLOOR = 58


@dataclass(slots=True)
class Player:
    """One physical speaker."""

    uuid: str
    name: str
    host: str
    model: str = ""
    model_number: str = ""
    display_name: str = ""
    software_version: str = ""
    hardware_version: str = ""
    serial: str = ""
    mac: str = ""
    household: str = ""
    #: The About box's remaining lines: the marketing version (11.16.1), the
    #: series id (A101), the ``extraVersion`` text ("OTP: ...") and the
    #: topology's WirelessMode (0 = Ethernet backhaul).
    display_version: str = ""
    series_id: str = ""
    extra_version: str = ""
    #: The UPnP services this player advertises in its device description,
    #: comma-separated ("AudioIn,AVTransport,..."). Empty until the
    #: description has been read.
    services: str = ""
    wireless_mode: int | None = None
    icon: str = ""
    #: True for the non-primary half of a stereo pair or a surround satellite:
    #: present in topology, but never shown as its own room.
    invisible: bool = False
    #: Raw ``ChannelMapSet`` / ``HTSatChanMapSet`` describing bonded roles.
    channel_map: str = ""
    #: Which of the two supplied it: ``"pair"`` for ``ChannelMapSet``, ``"ht"``
    #: for ``HTSatChanMapSet``. Both spell a bonded speaker's channel ``LF`` or
    #: ``RF``, so this is the only thing that tells a stereo pair from a home
    #: theater, and the two are labeled differently.
    channel_map_kind: str = ""
    boot_seq: int = 0
    #: Reachable over HTTP right now.
    online: bool = True

    @property
    def generation(self) -> str:
        """``"S1"`` or ``"S2"``, derived from firmware rather than model.

        Model is a poor signal: a Play:1 runs happily on either train depending
        on which household it joined.
        """
        try:
            major = int(self.software_version.split(".", 1)[0])
        except (ValueError, IndexError):
            return "unknown"
        return "S2" if major >= S2_FIRMWARE_FLOOR else "S1"

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:1400"

    @property
    def bonded_role(self) -> str | None:
        """Channel role for a bonded player, e.g. ``LF``, ``RF``, ``SW``."""
        if not self.channel_map:
            return None
        for entry in self.channel_map.split(";"):
            if entry.startswith(self.uuid + ":"):
                roles = entry.split(":", 1)[1]
                return roles.split(",")[0] or None
        return None

    #: A stereo pair's halves are the left and right of one speaker, so they
    #: are labeled L and R. A home theater's front channels keep LF and RF,
    #: which is what the app calls them, alongside SW, LR, and RR.
    _PAIR_LABELS = {"LF": "L", "RF": "R"}

    @property
    def role_label(self) -> str:
        """The bonded role as a person should read it, or ``""``."""
        role = self.bonded_role or ""
        if self.channel_map_kind == "pair":
            return self._PAIR_LABELS.get(role, role)
        return role

    @property
    def supports_line_in(self) -> bool:
        """Whether this player has a socket to plug something into.

        The player says so itself: only one with a socket offers the AudioIn
        service in its device description (checked across the household
        2026-09-15 -- a Connect and a Connect:Amp list it, two Play:1s do
        not). The model numbers below are the fallback for a player whose
        description has not been read yet; one of them, S12, was wrong, and
        Sonora kept subscribing to a service that speaker does not have.
        """
        if self.services:
            return "AudioIn" in self.services.split(",")
        return self.model_number in {
            "S5", "ZP80", "ZP90", "ZP100", "ZP120", "S6", "S27",
        } or "Connect" in self.model or "Play:5" in self.model


@dataclass(slots=True)
class Zone:
    """A room as a controller should present it."""

    uuid: str  # UUID of the visible (primary) player
    name: str
    players: list[Player] = field(default_factory=list)

    @property
    def primary(self) -> Player:
        for p in self.players:
            if not p.invisible:
                return p
        return self.players[0]

    @property
    def host(self) -> str:
        return self.primary.host

    @property
    def is_paired(self) -> bool:
        return len(self.players) > 1

    @property
    def topology_label(self) -> str:
        """How the desktop app labels a bonded room, e.g. ``Den (L + R)``."""
        if not self.is_paired:
            return self.name
        roles = [p.bonded_role for p in self.players if p.bonded_role]
        if {"LF", "RF"} <= set(roles):
            extra = len(self.players) - 2
            suffix = " + Sub/Surrounds" if extra else ""
            return f"{self.name} (L + R{suffix})"
        return f"{self.name} ({len(self.players)} players)"


@dataclass(slots=True)
class TransportState:
    """What a group is doing, as reported by its coordinator."""

    state: str = "STOPPED"
    status: str = "OK"
    play_mode: str = "NORMAL"
    crossfade: bool = False
    #: The play modes the speaker says it will take for what it plays now
    #: (AVTransport's ``CurrentValidPlayModes``: "SHUFFLE,REPEAT,REPEATONE,
    #: CROSSFADE" for a queue, "CROSSFADE" for a service's radio, "" for a
    #: broadcast); None until the first event says.
    valid_play_modes: str | None = None
    #: The media URI loaded when the speaker refused a crossfade change it
    #: said it would take (Sonos Radio's stations, 2026-10-02); it stands
    #: until something else is loaded.
    crossfade_refused_uri: str = ""
    track_number: int = 0
    track_duration: str = "0:00:00"
    track_uri: str = ""
    rel_time: str = "0:00:00"
    #: When ``rel_time`` was read, as a monotonic clock reading. The position
    #: is not evented, so a client that renders long after the last read would
    #: otherwise start its own clock from a stale figure and stay behind by
    #: however old that figure was -- measured at a constant 29 seconds behind
    #: the speaker on 2026-09-14. Serialized as an age in seconds, which needs
    #: no agreement between the server's clock and the browser's.
    position_read_at: float = 0.0
    title: str = ""
    artist: str = ""
    album: str = ""
    album_art_uri: str = ""
    #: The provider's own art URL for a service track, read from its SMAPI
    #: metadata after each track change. ``album_art_uri`` names the speaker's
    #: /getaa proxy, and for some services that proxy answers 404 for every
    #: track (AccuRadio, 2026-09-07) while the apps show the provider's cover.
    provider_art_uri: str = ""
    #: Whether the service marks the playing track explicit, where it says so
    #: at all -- three-valued, as ``SmapiItem.explicit`` is. Read from the
    #: same getMediaMetadata call the provider's art comes from. The S1
    #: Windows app draws an 11px badge beside the title when this is true
    #: (nowplaying/metadatacontrol.xaml), and the web client draws its own.
    explicit: bool | None = None
    #: The kind of item playing, from the DIDL class the speaker reports:
    #: "track", "podcast", "audiobook", "station"... Now Playing switches its
    #: labels on it (Chapter / Author / Narrator for an audiobook).
    track_kind: str = ""
    narrator: str = ""
    book: str = ""
    stream_content: str = ""
    stream_show: str = ""
    #: The provider's id for the show on air, which is what the apps'
    #: "Add to My Radio Shows" saves.
    stream_show_id: str = ""
    #: Whether the source will take Pause. A broadcast stream will not, and
    #: the apps' room menu then reads "Stop Group" instead of "Pause Group".
    can_pause: bool = True
    #: Whether the source will take Seek. Some services' tracks refuse it by
    #: design and the apps then draw the progress bar inert; a click here used
    #: to earn a UPnP 701 instead.
    can_seek: bool = True
    #: Whether the source offers a next or previous track. The apps enable a
    #: skip button when either the track can be skipped or the position can be
    #: moved, so a queue on its last track keeps both (seek stands in for
    #: fast-forward) while a broadcast, which allows neither, grays both.
    can_next: bool = True
    can_previous: bool = True
    queue_length: int = 0
    #: The music service behind ``track_uri`` (its ``sid``), named from the
    #: last catalog read, and the title of the container being played (a
    #: station, playlist or album): what the desktop apps print under the art.
    service_id: int | None = None
    service_name: str = ""
    container_title: str = ""
    #: The album or playlist the queue holds alone, when Sonora saw it handed
    #: over and nothing has been added since; empty otherwise. Save Queue
    #: offers it as the playlist's name.
    queue_source: str = ""
    #: The library object the queue was last filled from (``A:TRACKS``, an
    #: album's ``A:ALBUM/...``), read off EnqueuedTransportURI. The web
    #: client opens it from the bar's words for a library song, where a
    #: service song opens its album (play.sonos.com, 2026-09-30).
    queue_container: str = ""
    #: The service ``queue_container`` belongs to; None for the library.
    queue_container_sid: int | None = None
    #: The track the speaker says comes next (``NextTrackMetaData``): what
    #: the Mac app prints after "Next" when the queue it plays is not the
    #: speaker's own, a Spotify Connect session's cloud queue on
    #: ``x-rincon-queue:...#vli``, whose tracks Sonora cannot list.
    next_title: str = ""
    next_artist: str = ""
    #: The speakers' own rating state for the playing item (0 none, 1 thumbs
    #: up, 2 thumbs down) and the provider id the item is rated by, so a
    #: rating made in any controller shows here.
    rating: int = 0
    item_id: str = ""
    #: The AVTransport URI itself (what is loaded): the queue, a station, a
    #: line-in. The track URI alone cannot tell a service track played from
    #: the queue apart from the same track streamed as part of a station.
    media_uri: str = ""

    @property
    def source(self) -> str:
        """Human-meaningful source kind derived from the transport URIs."""
        if self.media_uri.startswith("x-rincon-queue:"):
            return "queue"
        if self.media_uri.startswith("x-rincon:"):
            return "grouped"
        scheme = self.track_uri.split(":", 1)[0] if ":" in self.track_uri else ""
        if scheme:
            return URI_SCHEMES.get(scheme, "unknown")
        # Stopped with nothing playing, but a station may still be loaded:
        # the media URI names it, and the apps keep treating the room as
        # holding that station rather than as idle (seen 2026-09-06).
        media = self.media_uri.split(":", 1)[0] if ":" in self.media_uri else ""
        if media:
            return URI_SCHEMES.get(media, "unknown")
        return "idle"

    @property
    def is_home_theater(self) -> bool:
        """Whether a soundbar is playing its television input."""
        return self.track_uri.startswith("x-sonos-htastream:")

    #: The specific input name (HDMI vs SPDIF) is deliberately not derived from
    #: the transport URI. That URI always ends ``:spdif`` regardless of the
    #: real input: an Arc Ultra and a Beam both report ``:spdif`` while the
    #: official client, reading the cloud's ``htInputFormat`` over its Muse
    #: websocket, shows one as SPDIF and the other as HDMI. Every local field
    #: is identical between the two, so the LAN cannot tell them apart and a
    #: guessed label would be wrong half the time. Left to the cloud layer to
    #: fill if a Muse feed is ever added.

    @property
    def is_external_session(self) -> bool:
        """True for Spotify Connect or AirPlay pushed in from another app.

        Such a session can be steered and stopped but not started by us: the
        source app owns it.
        """
        return self.track_uri.startswith("x-sonos-vli:")

    def _takes(self, mode: str) -> bool:
        """Whether the speaker announced ``mode`` for what it plays; before it
        has said, a queue is taken to take it and nothing else is."""
        if self.valid_play_modes is not None:
            return mode in self.valid_play_modes.upper().split(",")
        return self.source == "queue"

    @property
    def can_shuffle(self) -> bool:
        """Measured 2026-10-02 on every room: only a queue (Plex, Mixcloud)
        took shuffle or either repeat, and only a queue announced them."""
        return self._takes("SHUFFLE")

    @property
    def can_repeat(self) -> bool:
        return self._takes("REPEAT")

    @property
    def can_repeat_one(self) -> bool:
        return self._takes("REPEATONE")

    @property
    def can_crossfade(self) -> bool:
        """Whether the speaker will take a crossfade change for what it plays.

        The speaker says so itself: CROSSFADE in ``CurrentValidPlayModes``.
        Measured 2026-10-02 by changing it on every room and putting it back:
        a queue (Mixcloud) and AccuRadio's radio took it; TuneIn, SomaFM,
        80s80s and a Libby audiobook refused it with UPnP 712, and said so
        beforehand. Sonos Radio's station said CROSSFADE and refused anyway,
        which ``crossfade_refused_uri`` remembers. Before the first event, a
        Spotify Connect queue (``#vli``) or a pushed session is known to
        refuse and anything else is offered.
        """
        if self.crossfade_refused_uri and self.crossfade_refused_uri == self.media_uri:
            return False
        if self.valid_play_modes is not None:
            return "CROSSFADE" in self.valid_play_modes.upper().split(",")
        return not (self.media_uri.endswith("#vli") or self.is_external_session)

    @property
    def is_playing(self) -> bool:
        return self.state == "PLAYING"


@dataclass(slots=True)
class Group:
    """A synchronized set of zones."""

    id: str
    coordinator_uuid: str
    zone_uuids: list[str] = field(default_factory=list)
    transport: TransportState = field(default_factory=TransportState)
    volume: int = 0
    muted: bool = False

    @property
    def is_solo(self) -> bool:
        return len(self.zone_uuids) <= 1


@dataclass(slots=True)
class VanishedZone:
    """A zone the household remembers but cannot currently reach."""

    uuid: str
    name: str
    reason: str = ""
    #: What the speakers remember of it: its model number, its MAC, where it
    #: was, and when they last saw it (ISO 8601, UTC).
    model_number: str = ""
    mac: str = ""
    last_ip: str = ""
    last_seen: str = ""


@dataclass(slots=True)
class Household:
    """Everything discovered for one Sonos system."""

    id: str
    #: The full household identifier, as ``/status/zp`` reports it. Sonos has
    #: two forms: ``DeviceProperties#GetHouseholdID`` returns a truncated
    #: prefix, while the cloud API needs the whole thing. Using the short form
    #: against the cloud returns an empty list rather than an error, which is a
    #: quiet way to lose data.
    control_id: str = ""
    players: dict[str, Player] = field(default_factory=dict)
    zones: dict[str, Zone] = field(default_factory=dict)
    groups: dict[str, Group] = field(default_factory=dict)
    vanished: list[VanishedZone] = field(default_factory=list)

    @property
    def cloud_id(self) -> str:
        """The identifier Sonos' own API expects."""
        return self.control_id or self.id

    @property
    def generation(self) -> str:
        gens = {p.generation for p in self.players.values()}
        gens.discard("unknown")
        if len(gens) == 1:
            return gens.pop()
        return "mixed" if gens else "unknown"

    @property
    def visible_zones(self) -> list[Zone]:
        return sorted(self.zones.values(), key=lambda z: _natural_key(z.name))

    def zone_for_player(self, uuid: str) -> Zone | None:
        for zone in self.zones.values():
            if any(p.uuid == uuid for p in zone.players):
                return zone
        return None

    def group_for_zone(self, uuid: str) -> Group | None:
        for group in self.groups.values():
            if uuid in group.zone_uuids:
                return group
        return None

    def any_host(self, quiet: "set[str] | None" = None) -> str | None:
        """A reachable player to aim household-wide queries at.

        ``quiet`` names players that have stopped answering; they are the last
        resort rather than the first pick, because a household-wide question
        put to a sleeping speaker fails for the whole household.
        """
        quiet = quiet or set()
        ranked = [p for p in self.players.values() if p.online and not p.invisible]
        ranked += [p for p in self.players.values() if p.online and p.invisible]
        for p in ranked:
            if p.host not in quiet:
                return p.host
        return ranked[0].host if ranked else None


def _natural_key(value: str) -> tuple:
    """Sort room names the way a person would: Room 2 before Room 10."""
    parts = re.split(r"(\d+)", value.casefold())
    return tuple(int(p) if p.isdigit() else p for p in parts)


def zones_from_players(players: Iterable[Player]) -> dict[str, Zone]:
    """Collapse players into zones, folding bonded satellites into their room.

    Bonded players share a room name and all but one are flagged invisible, so
    grouping by name and electing the visible member reconstructs what a
    controller should show. Two genuinely separate speakers that happen to share
    a name would collapse too, but Sonos itself treats identically named rooms
    as one room, so that matches the official behavior.
    """
    players = list(players)
    # A channel map on one player claims the others it is bonded with. In the
    # seconds after a pair is made the claimed player still carries its old
    # room name and no Invisible flag (a pair showed as "Den (L + R)" over
    # a second "Den 2" room until the next topology event), so the claim,
    # not the name, decides where such a player belongs, and it is hidden.
    claimed_by: dict[str, Player] = {}
    for player in players:
        for entry in (player.channel_map or "").split(";"):
            other = entry.split(":", 1)[0].strip()
            if other and other != player.uuid:
                claimed_by[other] = player
    zones: dict[str, Zone] = {}
    for player in players:
        owner = claimed_by.get(player.uuid)
        if owner is not None:
            player.invisible = True
        key = owner.name if owner is not None else player.name
        zone = zones.get(key)
        if zone is None:
            zone = Zone(uuid=player.uuid, name=key)
            zones[key] = zone
        zone.players.append(player)
    out: dict[str, Zone] = {}
    for zone in zones.values():
        zone.players.sort(key=lambda p: (p.invisible, p.bonded_role or "", p.uuid))
        zone.uuid = zone.primary.uuid
        out[zone.uuid] = zone
    return out
