"""Stateful controller: one live picture of every household on the network.

The controller owns discovery, event subscriptions and the cached state that a
user interface renders. State arrives by event rather than by polling, so the
cache is authoritative between changes and a client can be handed a complete
snapshot at any moment without touching the speakers.

Group semantics drive most of the design. Transport belongs to a group, not to
a speaker: only the coordinator answers meaningfully about what is playing, and
a grouped member reports a transport URI of ``x-rincon:<coordinator>`` instead.
Volume, by contrast, is per speaker, with a separate group volume that Sonos
computes as a relative scale over its members. Commands therefore have to be
routed: transport to the coordinator, volume to the zone the user touched.
"""

from __future__ import annotations

import asyncio
import base64
import re
import json
import logging
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime
from time import monotonic, time
from typing import Awaitable, Callable

import aiohttp
from defusedxml import ElementTree as DET

from . import accounts, const
from .battery import lowest, parse_battery
from .content import ContentBrowser
from .credentials import seal
from .didl import DidlItem, clean_title, escape, parse_didl, saved_queue_didl
from .discovery import HouseholdRegistry
from .events import Event, EventListener
from .topology import parse_zone_group_state, remap_groups
from . import hhsettings
from .hhsettings import (EXPLICIT_FILTERING, HouseholdSettings, SettingsError,
                         SettingsUnanswered, SettingsUnauthorized)
from .models import Household, TransportState, Zone, _natural_key, zones_from_players
from .network import NetworkCollector, RadioFacts
from .products import MODEL_NAMES, model_label
from .recent import RecentlyPlayed, kind_of
from ..config import settings
from .cloud import SonosCloud
from .muse import HomeTheaterStatus, MuseFeed
from .services import ServiceReader
from .contentsvc import ContentService
from .presentation import Presentation
from .smapi import SmapiClient, SmapiError, smapi_item_id
from .dropouts import DropoutLog, DropoutWatch
from .artcache import ArtCache
from .soundcloud_art import SoundCloudArt
from .soap import _PLAYER_TLS, SoapClient, SoapFault

log = logging.getLogger(__name__)

#: How long a service that faulted on a station's art is left alone.
ART_FAULT_QUIET_S = 6 * 3600.0

#: Model numbers with two output channels of their own, on which both S1 apps
#: offer Balance for a single speaker. Measured 2026-10-02 in the Mac app:
#: a Play:5 (S5), a Connect (S15) and a Connect:Amp (ZP120) show it and
#: a Play:1 does not. The rest are those families' other
#: generations (Connect ZP80/ZP90, Connect:Amp ZP100, Amp S16, Play:5 Gen 2
#: S6, Port S19), unmeasured.
STEREO_MODELS = frozenset({"S5", "S6", "S15", "S16", "S19", "ZP80", "ZP90", "ZP100", "ZP120"})

#: Players whose speech enhancement has a switch of its own, SpeechEnhanceEnabled,
#: beside DialogLevel as its strength. No speaker feature names it, and a Beam
#: (Gen 2) and a Ray answer the read too but refuse every write with a 500, so
#: the model decides, as it does in the Sonos app.
SPEECH_SWITCH_MODELS = frozenset({"S45", "S59"})


def _balance_of(left: int, right: int) -> int:
    """The balance, -100 (left) to 100 (right), that two channel levels express:
    the inverse of set_balance, which attenuates the side away from it."""
    return max(-100, min(100, int(right) - int(left)))


def has_balance(paired: bool, model_number: str) -> bool:
    """A stereo pair always has a balance; a single speaker only when it
    drives two channels itself."""
    return paired or (model_number or "").upper() in STEREO_MODELS

#: Services worth subscribing to on every visible zone.
#: The ContentDirectory containers a controller watches, and what a client
#: refetches when one of them changes. Every controller on the household edits
#: these through the same service, so this is how Sonora hears about a queue
#: reordered in the desktop app or a favorite saved on a phone.
CONTAINERS = (("Q:", "queue"), ("FV:", "favorites"), ("SQ:", "playlists"),
              ("R:", "radio"))

#: How long one household container stays quiet after it has been announced.
#: A change reaches every player at once -- the household's eight answered
#: within three seconds of each other -- and this is what keeps the eight
#: reports one piece of news.
CONTAINER_BURST = 5.0

ZONE_SERVICES = (
    const.AV_TRANSPORT,
    const.RENDERING_CONTROL,
    const.GROUP_RENDERING_CONTROL,
    const.DEVICE_PROPERTIES,
    const.QUEUE,
    # On every player, not one: only the player doing the work says
    # ShareIndexInProgress=1, and which player that is depends on who was
    # asked to add the share (measured 2026-09-10: the desktop app added a
    # folder through one S2 player, which indexed it while the other two S2
    # players answered 0 all the way through).
    const.CONTENT_DIRECTORY,
    # On every player too, as the apps have it. It was on one per household,
    # and that one could be the speaker that had dropped off the network and
    # held a stale view: a regroup reached
    # Sonora late or not at all. Now the first player to announce it is heard.
    const.ZONE_GROUP_TOPOLOGY,
)

#: Only a player with a socket has anything to say here, and what it says is
#: whether something is plugged into it (LineInConnected). The apps' Line-In
#: page lists the players that answer yes.
LINE_IN_SERVICES = (const.AUDIO_IN,)

#: Subscribed on one member per household only, since it answers for all.
HOUSEHOLD_SERVICES = (
    const.ALARM_CLOCK,
)

StateCallback = Callable[[dict], Awaitable[None] | None]

def parse_update_item(xml: str) -> dict:
    """The fields of an UpdateItem the speakers hand back, e.g.
    ``<UpdateItem Type="Software" Version="57.23-74170"
    UpdateURL="http://update-firmware.sonos.com/.../^57.23-74170" .../>``."""
    if "&lt;" in xml and "<UpdateItem" not in xml:
        xml = xml.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&amp;", "&")
    match = re.search(r"<UpdateItem\b([^>]*)/?>", xml)
    if not match:
        return {}
    attrs = dict(re.findall(r'(\w+)="([^"]*)"', match.group(1)))
    return {"type": attrs.get("Type", ""), "version": attrs.get("Version", ""),
            "url": attrs.get("UpdateURL", ""), "display": attrs.get("DisplayVersion", "")}



@dataclass(slots=True)
class ZoneState:
    """Everything a user interface needs about one room."""

    uuid: str
    name: str
    host: str
    model: str = ""
    model_number: str = ""
    generation: str = ""
    display_version: str = ""
    # The build of the same software ("97.1-80312" beside "18.8").
    software_version: str = ""
    online: bool = True
    paired: bool = False
    topology_label: str = ""
    #: Whether the apps offer a Balance slider for the room (has_balance()).
    has_balance: bool = False
    #: The last source the transport was handed, as its own DIDL: the
    #: container queued (an album, a playlist) and the media loaded (a
    #: station). Events carry them only now and then, so they are kept here
    #: for the recently played list to read when playback starts.
    enqueued_uri: str = ""
    enqueued_metadata: str = ""
    #: The queue's length when ``enqueued_uri`` was handed to it, -1 while
    #: unknown; whether the first report has been seen; whether the queue has
    #: been empty since the last container arrived.
    enqueued_length: int = -1
    enqueued_seen: bool = False
    queue_emptied: bool = False
    media_metadata: str = ""
    #: The player's sleep-timer generation, which the transport event carries
    #: whenever the timer is set or cleared, from any controller.
    sleep_generation: str = ""
    #: Per-speaker volume, independent of the group's volume.
    volume: int = 0
    muted: bool = False
    bass: int = 0
    treble: int = 0
    loudness: bool = False
    balance: int = 0
    #: The left and right channel levels (0-100) the balance is made of; set_balance
    #: attenuates one side, and the speaker reports both in its RenderingControl events.
    channel_left: int = 100
    channel_right: int = 100
    fixed_output: bool = False
    #: Whether speech enhancement offers a Max level beyond High. The speaker
    #: says so only in its RenderingControl events; no action reads it.
    speech_max: bool = False
    supports_line_in: bool = False
    #: Whether something is plugged into that socket, from AudioIn events.
    line_in_connected: bool = False
    #: Group identity, and whether this zone leads it.
    group_id: str = ""
    is_coordinator: bool = False
    group_members: list[str] = field(default_factory=list)
    group_volume: int = 0
    group_muted: bool = False
    transport: TransportState = field(default_factory=TransportState)
    radio: RadioFacts | None = None
    #: ``HTAudioIn`` from ``GetZoneInfo``. Observed as 0 on a soundbar the
    #: official client labeled "No Signal" while its transport said PLAYING,
    #: and non-zero on an idle one; it is the only live datum that separates a
    #: TV input carrying audio from one that is not. Not evented, so it is
    #: re-read whenever a home-theater transport reports a change.
    ht_audio_in: int | None = None
    #: The most recent ``LastChangedPlayState`` from ``DeviceProperties``,
    #: whose ``NO-CONTENT`` token also marks a silent input.
    last_play_state: str = ""
    #: From the cloud feed, when signed in: the television input's name
    #: ("SPDIF", "HDMI") and its stream description ("No Signal", a codec).
    #: Empty and None otherwise; the interface then shows the input without a
    #: name and falls back to the local signal reading.
    ht_input: str = ""
    ht_signal: str | None = None
    #: A portable speaker's battery (battery.py): level, charging, power
    #: source, health and temperature, the room's lowest when it has several.
    #: None for a room with no battery, or one not read yet.
    battery: dict | None = None
    #: What the player declares it can do in its own /info ``deviceFeatures``
    #: (S2 only: HEIGHT_CHANNEL_TUNING, STEREO_PAIR, MONO_SPEAKER, PORTABLE...).
    #: None until read, and an empty list on the S1 train, which has no such list.
    features: list[str] | None = None

    def as_dict(self, service_names: dict | None = None) -> dict:
        data = asdict(self)
        tv = self.transport.is_home_theater
        data["transport"] = {
            **asdict(self.transport),
            # How stale rel_time is, so a client can carry it forward instead
            # of starting its clock from whenever the last read happened.
            "position_age": (round(max(0.0, monotonic() - self.transport.position_read_at), 1)
                             if self.transport.position_read_at else 0.0),
            "source": self.transport.source,
            # Named here rather than when the track arrived, so a catalog
            # read after the event still names it.
            "service_name": (self.transport.service_name
                             or (service_names or {}).get(self.transport.service_id, "")),
            "is_playing": self.transport.is_playing,
            "is_external_session": self.transport.is_external_session,
            "can_crossfade": self.transport.can_crossfade,
            "can_shuffle": self.transport.can_shuffle,
            "can_repeat": self.transport.can_repeat,
            "can_repeat_one": self.transport.can_repeat_one,
            # The input's presence of signal is knowable locally; its name is
            # not (see TransportState) and comes from the cloud feed when one
            # is running. None means "no reading", so the interface stays
            # silent rather than inventing one.
            "tv_input": self.ht_input if tv else "",
            "tv_signal_text": (self.ht_signal or "") if tv else "",
            # HTAudioIn as the speaker reports it, which names the format on
            # the input (lib/tvFormat.js holds SoCo's table of them).
            "tv_format_code": self.ht_audio_in if tv else None,
            "tv_signal": (None if not tv
                          else self.ht_signal != "No Signal" if self.ht_signal is not None
                          else not (self.ht_audio_in == 0
                                    or "NO-CONTENT" in self.last_play_state)),
        }
        data["radio"] = asdict(self.radio) if self.radio else None
        return data



def _note_unwaited_failure(task: "asyncio.Task") -> None:
    """Log a background read that failed with nobody waiting on its answer."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.info("%s failed: %s", task.get_name(), exc)

class SonosController:
    """Owns the live view of every household and issues commands to it."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        *,
        event_port: int = 0,
        outward: aiohttp.ClientSession | None = None,
    ) -> None:
        self._session = session
        self.soap = SoapClient(session)
        self.registry = HouseholdRegistry(self.soap, session)
        self.content = ContentBrowser(self.soap)
        self.services = ServiceReader(self.soap)
        self.presentation = Presentation(session)
        self.hhsettings = HouseholdSettings(session)
        #: Each household's explicit-content setting, by household id, as
        #: last read off its speakers. Every SMAPI call carries it.
        self._filtering: dict[str, bool] = {}
        self.smapi = SmapiClient(session)
        self.smapi.content_filtering = self.filtering
        # Pictures fetched once from the speakers or the providers and served
        # to every window from here (see artcache.py).
        # ``outward`` is fetchguard's session, as provider art is a URL a
        # service chose and may redirect anywhere.
        self.art_cache = ArtCache(outward or session)
        self.soundcloud_art = SoundCloudArt(session)
        self._art_prefetch: dict[str, asyncio.Task] = {}
        # One provider-art lookup per zone at a time, and the service
        # directory each household answered with (see ``service_directory``).
        self._art_tasks: dict[str, asyncio.Task] = {}
        #: Stations (or single tracks) whose service faulted on the art
        #: lookup, until when not to ask again (see _resolve_provider_art).
        self._art_faults: dict[tuple[int, str], float] = {}
        self._directories: dict[str, tuple[float, object]] = {}
        #: The last catalog each household had before an account change dropped
        #: it: good enough to find a service's endpoint while the next is read.
        self._stale_directories: dict[str, object] = {}
        #: The directory read in flight per household, which every caller
        #: arriving meanwhile waits on rather than starting its own.
        self._directory_reads: dict[str, asyncio.Task] = {}
        #: Bumped per household when its directory is dropped, so a read that
        #: began before an account change does not put its answer back after.
        self._directory_gen: dict[str, int] = {}
        #: The accounts each household's directory was read with, so that a
        #: player's first account list only drops a directory that lacked it.
        self._directory_basis: dict[str, frozenset] = {}
        #: The player that last answered a household's directory, asked first
        #: next time: the same one keeps its anonymous probe cached, and a
        #: player known to answer is not queued behind one that may not.
        self._directory_host: dict[str, str] = {}
        #: Each player's /info device record, by uuid, with when it was read.
        self._player_info: dict[str, tuple[float, dict]] = {}
        #: What Sonora last saw of each player, kept on disk: a speaker the
        #: household loses (switched off, out of range) is then still
        #: described in full, as play.sonos.com describes it. The speakers'
        #: own VanishedDevices entry names only its model number and MAC.
        self._known_path = settings.data_dir / "known_players.json"
        self._known: dict[str, dict] = self._read_known()
        self.contentsvc = ContentService(session)
        self.smapi.on_token_refresh = self._refresh_service_token
        # Optional, and the only cloud-dependent part of the app.
        self.cloud = SonosCloud()
        self.muse = MuseFeed(self.cloud, self._on_muse_status)
        self.network = NetworkCollector(session)
        self.events = EventListener(session, port=event_port)
        #: Per household: what ContentDirectory last said about the index.
        self._index_state: dict[str, dict] = {}
        #: Which players are indexing, by host. The index is the household's,
        #: but only the player rebuilding it reports itself busy.
        self._indexing_hosts: dict[str, bool] = {}
        #: Per household: shares the players accepted but have not listed yet,
        #: keyed by the normalized path. A share added with credentials is not
        #: listed until the players have mounted it, and the desktop app holds
        #: its wizard on "Adding music folder" with a spinner for exactly this
        #: window, so the panes need something to show for it.
        self._pending_shares: dict[str, dict[str, dict]] = {}
        #: Cover URLs read for tracks the browser room is playing, which no
        #: speaker can vouch for. Bounded; /api/art serves only these.
        #: Pictures Sonora read from a service and may serve back (insertion
        #: ordered, so the oldest is the one dropped).
        #: Kept on disk: "This browser" brings back its last cover after a
        #: reload, and a restart had forgotten that Sonora vouched for it, so
        #: the bar showed a gray disc.
        self._vouched_path = settings.data_dir / "vouched_art.json"
        self._vouched_art: dict[str, None] = self._read_vouched()
        self.zones: dict[str, ZoneState] = {}
        #: Music-service credentials Sonora obtained itself by linking an
        #: account, keyed by (household id, service id). Held in memory only;
        #: they also live on the speakers, but the firmware will not read them
        #: back, so a service linked through Sonora is browsable only while
        #: this process keeps the token it received at link time.
        #: Keyed by (household id, service id, household account id). A
        #: service several people use (Spotify Family on Sonos is one account
        #: per member) is linked once per account, so each row browses and
        #: plays as its own person. An empty account id is a login from
        #: before accounts were tracked, or for a service the household does
        #: not have; see credentials_for.
        self.service_tokens: dict[tuple[str, int, str], dict[str, str]] = {}
        self._token_file = settings.data_dir / "service_tokens.json"
        #: Each household's AlarmListVersion count, by household id, to
        #: ignore the repeats every subscription renewal brings.
        self._alarm_version: dict[str, str] = {}
        self._load_service_tokens()
        #: Services linked through Sonora this session, per household id, so the
        #: list shows them at once even before the speakers or the cloud report
        #: them back. Keyed by service id. Persisted so a service linked through
        #: Sonora keeps its place in the list across a restart, matching its
        #: token, which is persisted too.
        self.linked_services: dict[str, dict[int, dict]] = {}
        self._linked_file = settings.data_dir / "linked_services.json"
        #: What each household has played, for the web theme's home.
        self.recent = RecentlyPlayed(settings.data_dir / "recent.json")
        self._load_linked_services()
        #: Services taken off a household through Sonora in the last few
        #: minutes, per household id, as sid -> when. The cloud's registration
        #: list lags the speakers after a RemoveAccount, so without this the
        #: next list would show the service again until the cloud caught up.
        #: Memory only: by the time Sonora restarts the cloud agrees.
        self.removed_services: dict[str, dict[tuple[int, str], float]] = {}
        #: Cached R_TrialZPSerial per household, the device id SMAPI wants.
        self._device_ids: dict[str, str] = {}
        self._radio_locations: dict[str, tuple[float, dict]] = {}
        #: household id -> (when, the software_update answer)
        self._software_updates: dict[str, tuple[float, dict]] = {}
        #: household id -> (the update the players announce, what each runs),
        #: from the last topology event; a change is passed straight on
        self._update_seen: dict[str, tuple[str, tuple]] = {}
        #: sid -> service name, from the last catalog read; names the service
        #: behind whatever a room is playing.
        self._service_names: dict[int, str] = {}
        #: Cached pairability audit per household id: (timestamp, set-of-sids
        #: that reject a Sonora sign-in the way SoundCloud does).
        self._unpairable: dict[str, tuple[float, set[int]]] = {}
        self._unpairable_reads: dict[str, asyncio.Task] = {}
        #: Last ContentDirectory revision per host and container, so a
        #: change is told apart from the opening snapshot.
        self._container_ids: dict[tuple[str, str], str] = {}
        #: When a household container was last announced, so the same edit
        #: arriving from every player is told once.
        self._container_said: dict[tuple[str, str], float] = {}
        #: Last playback failure per room and when it arrived, so one
        #: fault repeated by the speakers is reported once.
        self._last_play_error: dict[str, tuple[tuple[str, str], float]] = {}
        #: Playback dropouts (dropouts.py). The log's file is set at start-up
        #: by main.py, so a controller built in a test writes nothing.
        self.dropouts = DropoutWatch(DropoutLog(), self._position_seconds)
        #: Last ThirdPartyMediaServersX per host, to notice a service being
        #: added or removed (in another app) and refresh the list live.
        self._service_blob: dict[str, str] = {}
        #: The household's own account list, opened from that blob: household
        #: id -> account UDN -> Account. The speakers' answer to what an
        #: account is called, which the cloud list gives late.
        self.accounts: dict[str, dict[str, accounts.Account]] = {}
        self._host_to_zone: dict[str, str] = {}
        self._callbacks: list[StateCallback] = []
        #: Last payload sent per zone, so unchanged state is not rebroadcast.
        #: Speakers emit overlapping events from several services at once, so
        #: a naive fan-out sends identical state three times per volume nudge.
        self._last_sent: dict[str, dict] = {}
        self._topology_lock = asyncio.Lock()
        self._retopology: asyncio.Task | None = None
        #: Set when topology events arrive during a refresh; see
        #: _on_topology_event.
        self._retopology_again = False
        #: (household id, ZoneGroupState, when) of the last regroup applied
        #: straight from an event; see _apply_topology.
        self._last_evented_topology: tuple[str, str, float] | None = None
        #: Pending service-list refresh; see _note_service_change.
        self._services_refresh: asyncio.Task | None = None
        #: Looking again for speakers that start-up did not find.
        self._searching: asyncio.Task | None = None
        #: Re-reading the format on soundbars playing their TV input.
        self._tv_formats: asyncio.Task | None = None
        self._batteries: asyncio.Task | None = None
        #: Hosts that answered the battery page with no battery: a speaker
        #: does not grow one, so it is not asked again until it changes address.
        self._no_battery: set[str] = set()

    # -- lifecycle -----------------------------------------------------------

    async def start(self) -> None:
        await self.events.start()
        self.events.on("AVTransport", self._on_transport)
        self.events.on("RenderingControl", self._on_rendering)
        self.events.on("GroupRenderingControl", self._on_group_rendering)
        self.events.on("DeviceProperties", self._on_device_properties)
        self.events.on("AudioIn", self._on_audio_in)
        self.events.on("ZoneGroupTopology", self._on_topology_event)
        self.events.on("AlarmClock", self._on_alarm_clock)
        self.events.on("ContentDirectory", self._on_content_directory)
        try:
            await self.refresh()
        finally:
            # A machine that boots before its network is up finds nothing,
            # and nothing looked again until someone pressed "Search again"
            # (found in review). So it keeps looking, less often each time.
            if not self.households:
                self._searching = asyncio.create_task(self._search_until_found())
        self._read_directories()
        self._tv_formats = asyncio.create_task(self._watch_tv_formats(), name="tv-formats")
        self._batteries = asyncio.create_task(self._watch_batteries(), name="batteries")

    def _read_directories(self) -> None:
        # Each household's service directory is read now, behind start-up,
        # so the first page to ask for the service list finds it waiting
        # rather than paying a first read of its own (about five seconds).
        for household in self.households.values():
            self._directory_read(household)

    async def _watch_tv_formats(self, every: float = 5.0) -> None:
        """Keep the format a soundbar's TV input carries current.

        HTAudioIn is not evented: it was read only when the home-theater
        transport changed, and a TV going from a stereo menu to a 5.1 film
        changes the format without touching the transport. So a coordinator
        on its TV input is read again every few seconds, on the LAN only.
        """
        while True:
            await asyncio.sleep(every)
            for state in list(self.zones.values()):
                if not (state.online and state.is_coordinator
                        and state.transport.is_home_theater):
                    continue
                try:
                    info = await self.soap.call(
                        state.host, const.DEVICE_PROPERTIES, "GetZoneInfo")
                except Exception:
                    continue
                code = _as_int(info.get("HTAudioIn", ""), -1)
                code = None if code < 0 else code
                if code != state.ht_audio_in:
                    state.ht_audio_in = code
                    try:
                        await self._publish_zone(state)
                    except Exception:
                        log.exception("publishing %s's TV format failed", state.name)

    async def _watch_batteries(self, every: float = 60.0) -> None:
        """Keep each portable room's battery current.

        Nothing about the battery is evented that Sonora subscribes to, and a
        level moves slowly, so each player is asked once a minute, on the LAN.
        A player that answers with no battery is not asked again.
        """
        await asyncio.sleep(3)
        while True:
            for state in list(self.zones.values()):
                try:
                    await self._read_battery(state)
                except Exception:
                    log.exception("reading %s's battery failed", state.name)
                if state.features is None and state.online:
                    try:
                        await self._read_features(state)
                    except Exception:
                        log.exception("reading %s's features failed", state.name)
            await asyncio.sleep(every)

    async def _read_features(self, state: ZoneState) -> None:
        """Publish what the player declares it can do, so a setting it lacks
        is not offered: a Roam 2 answers the height EQ read like any S2
        player, but declares no HEIGHT_CHANNEL_TUNING (2026-10-05)."""
        features = sorted(await self.device_features(state.uuid))
        state.features = features
        if "MONO_SPEAKER" in features and not state.paired:
            state.has_balance = False
        await self._publish_zone(state)

    async def _read_battery(self, state: ZoneState) -> None:
        zone = None
        for household in self.households.values():
            zone = next((z for z in household.visible_zones if z.uuid == state.uuid), None)
            if zone is not None:
                break
        hosts = [p.host for p in (zone.players if zone else []) if p.host] or [state.host]
        readings = []
        for host in hosts:
            if host in self._no_battery:
                continue
            try:
                async with self._session.get(f"http://{host}:1400/status/batterystatus",
                                             timeout=aiohttp.ClientTimeout(total=4)) as resp:
                    if resp.status != 200:
                        continue
                    reading = parse_battery(await resp.text())
            except Exception:
                continue        # asleep or unreachable: keep what was read last
            if reading is None:
                self._no_battery.add(host)
            else:
                readings.append(reading)
        battery = lowest(readings)
        if battery is None and any(h not in self._no_battery for h in hosts):
            return              # a portable one did not answer this time
        if battery != state.battery:
            state.battery = battery
            await self._publish_zone(state)

    async def device_features(self, uuid: str) -> set[str]:
        """The features a player declares in its own /info (``deviceFeatures``):
        HEIGHT_CHANNEL_TUNING, PORTABLE, DOLBY_ATMOS and the like. Empty when
        it publishes none (the S1 train has no such list)."""
        household, player = self.player_record(uuid)
        if player is None:
            return set()
        cached = self._player_info.get(uuid)
        if cached is None or monotonic() - cached[0] > self.PLAYER_INFO_TTL:
            device: dict = {}
            try:
                async with self._session.get(f"http://{player.host}:1400/info",
                                             timeout=aiohttp.ClientTimeout(total=4)) as resp:
                    if resp.status == 200:
                        device = (await resp.json(content_type=None)).get("device") or {}
            except Exception as exc:
                log.info("no /info from %s: %s", player.host, exc)
            cached = (monotonic(), device)
            if device:
                self._player_info[uuid] = cached
        return {str(f.get("name", "")) for f in (cached[1].get("deviceFeatures") or [])
                if isinstance(f, dict)}

    async def device_capabilities(self, uuid: str) -> set[str]:
        """The capabilities a player lists in its /info: PLAYBACK, HT_PLAYBACK,
        IR_CONTROL, LINE_IN and the like. Unlike deviceFeatures, S1 players
        publish these too."""
        await self.device_features(uuid)        # fills the /info cache
        cached = self._player_info.get(uuid)
        return {str(c) for c in ((cached[1].get("capabilities") if cached else None) or [])}

    async def _search_until_found(self, first: float = 10.0, longest: float = 300.0) -> None:
        wait = first
        while not self.households:
            await asyncio.sleep(wait)
            wait = min(wait * 2, longest)
            if self.households:
                break          # "Search again" found them meanwhile
            log.info("no speakers found yet; looking again")
            try:
                await self.refresh()
            except Exception as exc:
                log.info("looking for speakers failed: %s", exc)
        self._read_directories()

    async def stop(self) -> None:
        if self._searching is not None:
            self._searching.cancel()
        if self._tv_formats is not None:
            self._tv_formats.cancel()
        if self._batteries is not None:
            self._batteries.cancel()
        if self._retopology is not None:
            self._retopology.cancel()
        if self._services_refresh is not None:
            self._services_refresh.cancel()
        await self.events.stop()
        await self.muse.stop()
        await self.cloud.close()

    async def refresh(self) -> None:
        """Rediscover the network and rebuild state from scratch."""
        async with self._topology_lock:
            started = monotonic()
            households = await self.registry.discover()
            # A regroup evented while this read was under way is newer than
            # what it read; put it back rather than flick the rooms back to
            # the old grouping until the next refresh.
            evented = self._last_evented_topology
            if evented and evented[2] > started and evented[0] in households:
                household = households[evented[0]]
                players, groups, _ = parse_zone_group_state(evented[1])
                if set(players) <= set(household.players):
                    household.groups = remap_groups(groups, household.zones, household.players)
            self._fill_from_known(households)
            self._rebuild_zones(households)
            await self._seed_state()
            await self._subscribe_all(households)
        await self._read_content_filtering()
        self._last_sent.clear()
        await self._broadcast({"type": "snapshot", "data": self.snapshot()})

    def filtering(self, household_id: str) -> bool:
        """Whether that household filters explicit content, as last read."""
        return self._filtering.get(household_id, False)

    def note_filtering(self, household_id: str, on: bool) -> None:
        """Remember what a speaker just said, so browsing carries the same."""
        if household_id:
            self._filtering[household_id] = on

    async def _read_content_filtering(self) -> None:
        """Note each household's explicit-content setting.

        Held here rather than fetched per call because every SMAPI request
        carries it (see ``SmapiClient``), and because a household that will
        not answer should cost one read per refresh rather than one per
        browse. Unknown reads as off, which is what a controller that cannot
        see the setting has to assume.
        """
        for household in self.households.values():
            hosts = sorted((p.host for p in household.players.values() if p.online and p.host),
                           key=self.soap.is_silent)
            if not hosts:
                continue
            try:
                text, _ = await self.read_household_setting(hosts, EXPLICIT_FILTERING)
            except SettingsError as exc:
                log.info("content filtering unknown for %s (%s)",
                         household.id[:22], exc)
                continue
            self._filtering[household.id] = HouseholdSettings.read_bool_text(text)

    async def read_household_setting(self, hosts: list[str], setting) -> tuple[str, str]:
        """A household setting and the player that gave it, asking ``hosts``
        in turn. Any player of the household answers the same, so one that
        does not answer is passed over and steered around afterwards; one
        that answers with a refusal has answered. Every player but the last
        gets one short try. The read used to go to one player, and the S1
        system's filtering showed "could not be read" whenever that player
        let 8 seconds pass."""
        last: Exception | None = None
        for index, host in enumerate(hosts):
            final = index == len(hosts) - 1
            try:
                text = await self.hhsettings.read(host, setting, timeout=None if final else 4.0)
            except SettingsUnanswered as exc:
                self.soap.mark_silent(host)
                last = exc
                continue
            return text, host
        raise last if last is not None else SettingsError("no player to ask")

    @property
    def households(self) -> dict[str, Household]:
        return self.registry.households

    def ordered_households(self) -> list[Household]:
        """Households in a stable order.

        Discovery returns them in whatever sequence the network answered,
        which reshuffles every view between refreshes. Order by generation,
        oldest first, since S1 is the system this project exists to serve.
        """
        return sorted(
            self.households.values(),
            key=lambda household: (household.generation, household.id),
        )

    # -- state assembly ------------------------------------------------------

    def _rebuild_zones(self, households: dict[str, Household]) -> None:
        zones: dict[str, ZoneState] = {}
        host_map: dict[str, str] = {}

        for household in households.values():
            for zone in household.visible_zones:
                group = household.group_for_zone(zone.uuid)
                existing = self.zones.get(zone.uuid)
                state = ZoneState(
                    uuid=zone.uuid,
                    name=zone.name,
                    host=zone.primary.host,
                    model=model_label(zone.primary.model, zone.primary.model_number),
                    model_number=zone.primary.model_number,
                    generation=zone.primary.generation,
                    software_version=zone.primary.software_version,
                    online=zone.primary.online,
                    paired=zone.is_paired,
                    has_balance=has_balance(zone.is_paired, zone.primary.model_number),
                    topology_label=zone.topology_label,
                    supports_line_in=zone.primary.supports_line_in,
                    group_id=group.id if group else "",
                    is_coordinator=bool(group and group.coordinator_uuid == zone.uuid),
                    group_members=list(group.zone_uuids) if group else [zone.uuid],
                )
                # Carry forward anything already known so a topology change
                # does not blank the interface while state refills.
                if existing is not None:
                    state.volume = existing.volume
                    state.muted = existing.muted
                    state.bass = existing.bass
                    state.treble = existing.treble
                    state.loudness = existing.loudness
                    state.balance = existing.balance
                    state.channel_left = existing.channel_left
                    state.channel_right = existing.channel_right
                    state.fixed_output = existing.fixed_output
                    state.transport = existing.transport
                    state.group_volume = existing.group_volume
                    state.group_muted = existing.group_muted
                    state.radio = existing.radio
                    state.display_version = existing.display_version
                    # The cloud names a television input only when it
                    # changes, so a rebuild that dropped it left a soundbar
                    # on HDMI showing a bare "TV" until the next switch.
                    state.ht_audio_in = existing.ht_audio_in
                    state.last_play_state = existing.last_play_state
                    state.ht_input = existing.ht_input
                    state.ht_signal = existing.ht_signal
                    state.battery = existing.battery
                    state.features = existing.features
                    if existing.features and "MONO_SPEAKER" in existing.features and not zone.is_paired:
                        state.has_balance = False
                zones[zone.uuid] = state
                host_map[zone.primary.host] = zone.uuid

        self.zones = zones
        self._host_to_zone = host_map

    async def _seed_state(self) -> None:
        """Fill in state that events will not deliver until something changes."""
        async def one(state: ZoneState) -> None:
            if not state.online:
                return
            try:
                info = await self.soap.call(
                    state.host, const.DEVICE_PROPERTIES, "GetZoneInfo")
                state.display_version = info.get("DisplaySoftwareVersion", "")
                state.software_version = info.get("SoftwareVersion", "") or state.software_version
                state.ht_audio_in = _as_int(info.get("HTAudioIn", ""), -1)
                if state.ht_audio_in < 0:
                    state.ht_audio_in = None
            except Exception:
                pass
            try:
                volume = await self.soap.call(
                    state.host, const.RENDERING_CONTROL, "GetVolume",
                    {"InstanceID": 0, "Channel": "Master"})
                state.volume = volume.int_("CurrentVolume")
                mute = await self.soap.call(
                    state.host, const.RENDERING_CONTROL, "GetMute",
                    {"InstanceID": 0, "Channel": "Master"})
                state.muted = mute.bool_("CurrentMute")
                if state.has_balance:
                    left = await self.soap.call(state.host, const.RENDERING_CONTROL, "GetVolume",
                                                {"InstanceID": 0, "Channel": "LF"})
                    right = await self.soap.call(state.host, const.RENDERING_CONTROL, "GetVolume",
                                                 {"InstanceID": 0, "Channel": "RF"})
                    state.channel_left = left.int_("CurrentVolume")
                    state.channel_right = right.int_("CurrentVolume")
                    state.balance = _balance_of(state.channel_left, state.channel_right)
            except Exception as exc:
                log.info("volume seed failed for %s: %s", state.name, exc)
            if state.is_coordinator:
                await self._refresh_transport(state)

        await asyncio.gather(*(one(s) for s in self.zones.values()))

    async def _refresh_transport(self, state: ZoneState) -> None:
        try:
            info = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetTransportInfo",
                {"InstanceID": 0})
            position = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetPositionInfo",
                {"InstanceID": 0})
            settings = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetTransportSettings",
                {"InstanceID": 0})
            media = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetMediaInfo",
                {"InstanceID": 0})
        except Exception as exc:
            log.info("transport seed failed for %s: %s", state.name, exc)
            return

        transport = state.transport
        transport.media_uri = media.get("CurrentURI", "")
        self._apply_media_metadata(transport, media.get("CurrentURIMetaData", ""))
        transport.state = info.get("CurrentTransportState", transport.state)
        transport.status = info.get("CurrentTransportStatus", transport.status)
        transport.play_mode = settings.get("PlayMode", transport.play_mode)
        transport.track_number = position.int_("Track")
        transport.track_duration = position.get("TrackDuration", "")
        prev_track = transport.track_uri
        transport.track_uri = position.get("TrackURI", "")
        self._name_service(transport)
        transport.rel_time = position.get("RelTime", "")
        transport.position_read_at = monotonic()
        (transport.can_pause, transport.can_seek,
         transport.can_next, transport.can_previous) = await self._transport_actions(state.host)
        if position.get("TrackMetaData") or transport.track_uri:
            self._apply_track_metadata(transport, position.get("TrackMetaData", ""))
        else:
            self._forget_track(transport)
        if transport.track_uri != prev_track or not transport.provider_art_uri:
            self._track_changed(state)

    def _track_changed(self, state: ZoneState) -> None:
        """A new track: drop the old provider art and go and ask for the new."""
        transport = state.transport
        transport.provider_art_uri = ""
        old = self._art_tasks.pop(state.uuid, None)
        if old is not None and not old.done():
            old.cancel()
        # Warm the picture cache with the speaker's copy now, so the first
        # window to ask -- or the Mini Controller opening later -- gets it at
        # once rather than after the speaker's own slow fetch.
        self.prefetch_art(self.speaker_art_url(state))
        if transport.service_id and smapi_item_id(transport.track_uri or ""):
            self._art_tasks[state.uuid] = asyncio.create_task(
                self._resolve_provider_art(state, transport.track_uri))

    async def _resolve_provider_art(self, state: ZoneState, track_uri: str) -> None:
        """Ask the service for the playing item's own art.

        The speaker offers art through its /getaa proxy, keyed by the track
        URI, and browsers are sent there first. For some services the proxy
        never has the picture: AccuRadio's answered 404 for whole tracks
        (measured 2026-09-07) while the desktop app showed the cover it had
        read from the service's getMediaMetadata. This reads the same, and
        the front end falls back to it when the speaker's copy fails.
        """
        transport = state.transport
        sid = transport.service_id
        item_id = smapi_item_id(track_uri)
        household = self.household_of(state.uuid)
        if not sid or not item_id or household is None:
            return
        # A station's tracks carry one-off ids some services cannot look up:
        # Sonos Radio faulted on every track of a station, one call to Sonos
        # per track change. Once a service faults on a
        # station it is not asked again for that station's tracks for a
        # while; a queue's tracks are each their own question.
        media = transport.media_uri or ""
        fault_key = (sid, track_uri if not media or media.startswith("x-rincon-queue:") else media)
        if self._art_faults.get(fault_key, 0) > monotonic():
            return
        try:
            service = await self._service_by_id(household, sid)
            if service is None:
                return
            creds = self.credentials_for(household.id, sid, "", single_account=True) or {}
            if service.auth != "Anonymous" and not creds.get("token"):
                return
            item = await self.smapi.get_media_metadata(
                endpoint=service.endpoint, service_name=service.name,
                item_id=item_id, household_id=household.id,
                token=creds.get("token", ""), key=creds.get("key", ""),
                device_id=await self.device_serial(household))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if isinstance(exc, SmapiError) and exc.refresh is None:
                if len(self._art_faults) > 512:
                    self._art_faults.clear()
                self._art_faults[fault_key] = monotonic() + ART_FAULT_QUIET_S
            log.info("no provider art for %s (sid %s): %s", state.name, sid, exc)
            return
        if item is None or transport.track_uri != track_uri:
            return
        # The same answer carries whether the service calls this track
        # explicit, which is what the apps' badge is bound to; it is read here
        # rather than in a second call because it arrives in the same envelope.
        transport.explicit = item.explicit
        if not item.art:
            await self._publish_zone(state)
            return
        transport.provider_art_uri = item.art
        await self._publish_zone(state)

    @staticmethod
    def speaker_art_url(state: ZoneState) -> str:
        """The absolute URL of the art the speaker offers for its track."""
        uri = state.transport.album_art_uri or ""
        if not uri:
            return ""
        if uri.startswith(("http://", "https://")):
            return uri
        # A stock picture comes without its leading slash
        # ("images/playlist_legacy.png").
        return f"http://{state.host}:1400{'' if uri.startswith('/') else '/'}{uri}"

    def prefetch_art(self, url: str) -> None:
        """Fetch a picture into the cache in the background, once per URL."""
        if not url or self.art_cache.peek(url) is not None:
            return
        running = self._art_prefetch.get(url)
        if running is not None and not running.done():
            return
        for key, task in list(self._art_prefetch.items()):
            if task.done():
                self._art_prefetch.pop(key, None)
        self._art_prefetch[url] = asyncio.create_task(self._prefetch(url))

    async def _prefetch(self, url: str) -> None:
        try:
            await self.art_cache.get(url)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.info("art prefetch of %s failed: %s", url[:80], exc)

    def art_url_allowed(self, url: str) -> bool:
        """Only the speakers' own art and the providers' URLs Sonora itself
        recorded may be fetched through /api/art: it must not be a general proxy."""
        if not url.startswith(("http://", "https://")):
            return False
        hosts = {f"http://{z.host}:1400/" for z in self.zones.values() if z.host}
        if any(url.startswith(prefix) for prefix in hosts):
            return True
        # A stream's art can be an absolute URL on some other host (a radio
        # logo, a music bridge on the LAN); what a speaker reports is allowed
        # as it stands, as is the provider URL Sonora read for the track.
        if url in self._vouched_art:
            return True
        return any(url in (self.speaker_art_url(z), z.transport.provider_art_uri)
                   for z in self.zones.values())

    def remember_picture(self, url: str) -> None:
        """Vouch for a picture Sonora itself read out of a service.

        No zone reports these, so nothing else in the allow-list covers them:
        the cover of a track the browser room is playing, and the icons a
        service names in its own rating map. Kept in the order they arrived
        and the oldest dropped, so a picture the page is showing now is not
        the one evicted.
        """
        if not url.startswith(("http://", "https://")):
            return
        fresh = url not in self._vouched_art
        self._vouched_art.pop(url, None)
        self._vouched_art[url] = None
        while len(self._vouched_art) > 256:
            del self._vouched_art[next(iter(self._vouched_art))]
        path = getattr(self, "_vouched_path", None)   # absent on a bare test controller
        if fresh and path is not None:
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(list(self._vouched_art)), encoding="utf-8")
            except OSError as exc:
                log.info("could not keep the vouched art list: %s", exc)

    def _read_vouched(self) -> dict[str, None]:
        try:
            urls = json.loads(self._vouched_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        return {u: None for u in urls[-256:]
                if isinstance(u, str) and u.startswith(("http://", "https://"))}

    #: How long a household's directory is served before it is read again
    #: behind the answer. The catalog itself hardly changes, and an account
    #: added or removed drops it at once (``forget_service_directories``).
    DIRECTORY_FRESH = 600.0

    async def service_directory(self, household: Household, *, stale_ok: bool = False):
        """The household's catalog, answered at once whenever one is held.

        Building one is not free: it asks a player for the whole list and then
        browses the favorites, the playlists and the saved stations to see
        which services the household actually uses. Every page of every
        service browse was rebuilding it -- 1465 times in a day's log against
        31 asks for the service list itself -- so everything that
        wants the catalog for a browse, a search or a rating comes through
        here, and the service list itself does too: it read
        the speakers afresh for every page that asked, each open window asking
        on its own, and one S1 Play:1 slow to answer made that 4 to 56 seconds.

        A copy older than ``DIRECTORY_FRESH`` is still answered with, and a
        fresh read starts behind it. With no copy (the first ask, or after an
        account change) the caller waits, and so does everyone else who asks
        meanwhile, on the one read.
        """
        hit = self._directories.get(household.id)
        if hit is not None:
            if monotonic() - hit[0] > self.DIRECTORY_FRESH:
                self._directory_read(household)
            return hit[1]
        if stale_ok and household.id in self._stale_directories:
            # The copy an account change dropped still names every service
            # and its endpoint, which is all a sign-in needs; the fresh read
            # goes on behind it.
            self._directory_read(household)
            return self._stale_directories[household.id]
        return await self._directory_read(household)

    def _directory_read(self, household: Household) -> asyncio.Task:
        """The household's directory read, started if none is in flight."""
        task = self._directory_reads.get(household.id)
        if task is None or task.done():
            task = asyncio.create_task(self._read_and_keep_directory(household),
                                       name=f"service directory read for {household.id[:22]}")
            # A read nobody waits on (one refreshing behind a held copy)
            # still has its failure seen, in the log rather than as an
            # unretrieved exception.
            task.add_done_callback(_note_unwaited_failure)
            self._directory_reads[household.id] = task
        return task

    async def _read_and_keep_directory(self, household: Household):
        gen = self._directory_gen.get(household.id, 0)
        self._directory_basis[household.id] = frozenset(self.configured_sids(household.id))
        directory = await self.read_service_directory(household)
        if gen == self._directory_gen.get(household.id, 0):
            self._directories[household.id] = (monotonic(), directory)
        return directory

    def forget_service_directories(self) -> None:
        """Drop the cached catalogs, after the household's accounts changed."""
        for household_id in set(self._directories) | set(self._directory_reads):
            self.forget_service_directory(household_id)

    def forget_service_directory(self, household_id: str) -> None:
        """Drop one household's catalog. A read already under way began
        before the change, so it is neither kept nor handed to the next
        caller, who starts a fresh one."""
        dropped = self._directories.pop(household_id, None)
        if dropped is not None:
            self._stale_directories[household_id] = dropped[1]
        self._directory_reads.pop(household_id, None)
        self._directory_gen[household_id] = self._directory_gen.get(household_id, 0) + 1

    async def _service_by_id(self, household: Household, sid: int):
        """The catalog entry for ``sid``, from a directory at most ten minutes old."""
        directory = await self.service_directory(household)
        return directory.by_id(sid)

    async def _read_media(self, state: ZoneState, *, track: bool = True) -> None:
        """Re-read what a coordinator is playing: source name and track text.

        ``track=False`` keeps the track text the caller already has: read while
        a stream opens, the player's current track is its playlist file
        ("playlist", "regc-80s80sreggae...") with no show, and applying it
        blanked a TuneIn station's On Now line for seconds."""
        transport = state.transport
        try:
            media = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetMediaInfo", {"InstanceID": 0})
            position = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetPositionInfo", {"InstanceID": 0})
        except Exception as exc:
            log.info("media re-read failed for %s: %s", state.name, exc)
            return
        if media.get("CurrentURI", "") == transport.media_uri:
            self._apply_media_metadata(transport, media.get("CurrentURIMetaData", ""))
            if track and position.get("TrackMetaData"):
                self._apply_track_metadata(transport, position["TrackMetaData"])
            transport.rel_time = position.get("RelTime", transport.rel_time)
            transport.position_read_at = monotonic()

    @staticmethod
    def _apply_media_metadata(transport: TransportState, metadata: str) -> None:
        """The source's own DIDL (a station, playlist or album): its title is
        what the apps print under the art and on the room card."""
        if not metadata or metadata == "NOT_IMPLEMENTED":
            return
        items = parse_didl(metadata)
        if items and items[0].title and not _uri_like(items[0].title):
            transport.container_title = items[0].title

    @staticmethod
    def _forget_track(transport: TransportState) -> None:
        """Everything the last track said about itself, gone."""
        transport.title = ""
        transport.artist = ""
        transport.album = ""
        transport.album_art_uri = ""
        transport.provider_art_uri = ""
        transport.stream_show = ""
        transport.stream_show_id = ""
        transport.rating = 0
        transport.item_id = ""
        transport.track_kind = ""
        transport.narrator = ""
        transport.book = ""
        transport.track_duration = ""
        transport.next_title = ""
        transport.next_artist = ""

    @staticmethod
    def _apply_track_metadata(transport: TransportState, metadata: str) -> None:
        items = parse_didl(metadata)
        if not items:
            return
        item = items[0]
        # A service stream's current-track DIDL titles itself with its own
        # URI ("x-sonosapi-stream:235812?sid=254&flags=8224&sn=0"), and the
        # room card was printing that where the app prints "Radio - 94.7 The
        # WAVE". A URI is no title.
        title = "" if _uri_like(item.title) else clean_title(item.title)
        # A broadcast that resolves to a bare stream URL is titled by the
        # player after the URL's last path segment, not by the station:
        # Community Radio Plus' Radio Goolarri plays
        # x-rincon-mp3radio://https://firstnationsmedia.stream/8012/stream and
        # its track DIDL comes back <dc:title>stream</dc:title>, which the room
        # card printed where the app prints "Radio - Radio Goolarri"
        # (intermittently, because it only shows once that DIDL has been
        # read). A station names what is on air in r:streamContent.
        if title and transport.source in _RADIO_SOURCES and _named_by_uri(title, transport.track_uri):
            title = ""
        # Sonos Radio's BBC stations title the track with the stream's id,
        # "bbc_radio_one", and the room's title flipped between that and
        # "BBC Radio 1" as reads and events took turns. An id is
        # no title either; the station's own name stands in, as it does when
        # an event brings it.
        if title and transport.source in _RADIO_SOURCES and re.fullmatch(r"[a-z0-9]+(?:_[a-z0-9]+)+", title):
            title = ""
        if not title and transport.source in _RADIO_SOURCES:
            title = transport.container_title
        transport.title = title
        transport.artist = item.display_artist
        transport.album = item.album
        transport.album_art_uri = item.art_uri
        if item.stream_content or item.description:
            transport.stream_content = item.stream_content or item.description
        transport.stream_show = item.stream_show
        transport.stream_show_id = item.stream_show_id
        transport.rating = {"THUMBSUP": 1, "THUMBSDOWN": 2}.get(item.rating.upper(), 0)
        transport.item_id = item.tiid
        transport.track_kind = item.kind
        transport.narrator = item.narrator
        transport.book = item.book

    async def _transport_actions(self, host: str) -> tuple[bool, bool, bool, bool]:
        """What the player will take for what it plays now: pause, seek, next,
        previous.

        ``AVTransport#GetCurrentTransportActions`` answers with the list the
        source allows -- "Set, Stop, Pause, Play, X_DLNA_SeekTime, Previous,
        X_DLNA_SeekTrackNr" for a queue, a bare "Set, Stop, Play" for a
        broadcast stream -- which is the same signal the apps label their room
        menu from, gray their progress bar by, and enable their skip buttons
        from (measured 2026-09-12: a TuneIn station answers without Pause,
        seek or either skip, and the app draws Stop with both skip glyphs
        dimmed).
        """
        try:
            result = await self.soap.call(
                host, const.AV_TRANSPORT, "GetCurrentTransportActions",
                {"InstanceID": 0})
        except Exception:
            return True, True, True, True
        # Whole names, not letters: Pandora answered "Set, Stop,
        # Pause, Play, Next, X_DLNA_SeekTrackNr", and the "seek" inside the
        # track-number jump offered a time seek the speaker refused with 701.
        # Moving within a track is X_DLNA_SeekTime (or a
        # plain Seek).
        actions = {a.strip().lower() for a in str(result.get("Actions", "") or "").split(",")}
        return ("pause" in actions, bool(actions & {"x_dlna_seektime", "seek"}),
                "next" in actions, "previous" in actions)

    async def _subscribe_all(self, households: dict[str, Household]) -> None:
        tasks = []
        for household in households.values():
            for zone in household.visible_zones:
                if not zone.primary.online:
                    continue
                tasks.append(self.events.subscribe_many(
                    zone.primary.host, ZONE_SERVICES))
                if zone.primary.supports_line_in:
                    tasks.append(self.events.subscribe_many(
                        zone.primary.host, LINE_IN_SERVICES))
            host = self.any_host(household)
            if host:
                tasks.append(self.events.subscribe_many(host, HOUSEHOLD_SERVICES))
        await asyncio.gather(*tasks, return_exceptions=True)

    # -- event handling ------------------------------------------------------

    def _zone_for_host(self, host: str) -> ZoneState | None:
        uuid = self._host_to_zone.get(host)
        return self.zones.get(uuid) if uuid else None

    async def _note_playback_error(self, event: Event, state: ZoneState) -> None:
        """A source the speaker could not play, reported by the speaker.

        A player answers Play with success and then fails quietly: it goes
        TRANSITIONING, cannot open the source, and drops back to STOPPED. Its
        transport info says ``OK`` throughout, so watching that says nothing --
        but the event names the fault exactly (measured on this household
        2026-09-14 with SomaFM's Groove Salad FLAC, which the desktop app also
        refuses)::

            TransportStatus          ERROR_UNSUPPORTED_FORMAT
            TransportErrorDescription 8,132103,Groove Salad FLAC,SomaFM Radio,
                                      hls-radio://.../program.m3u8,
            TransportErrorURI        x-sonosapi-stream:experimental%3a...

        That is the speaker's own account of any failed source, whatever
        service it came from and however playback was started, so it is the
        one place a playback failure is noticed.
        """
        status = event.properties.get("TransportStatus", "")
        if not status or status == "OK":
            return
        # The speakers repeat an event now and then, and a group reports one
        # fault from more than one player, so the same failure arriving twice
        # in a moment is told once. A fresh attempt at the same thing is a
        # fresh failure and is reported again: trying it a second time in
        # another theme showed nothing at all when this was remembered until
        # the room next played something.
        signature = (status, event.properties.get("TransportErrorURI", ""))
        before, when = self._last_play_error.get(state.uuid, (None, 0.0))
        now = monotonic()
        self._last_play_error[state.uuid] = (signature, now)
        if before == signature and now - when < 3.0:
            return
        # "<code>,<service type>,<title>,<service>,<resolved uri>,"
        parts = [p.strip() for p in
                 (event.properties.get("TransportErrorDescription", "") or "").split(",")]
        title = parts[2] if len(parts) > 2 else ""
        service = parts[3] if len(parts) > 3 else ""
        resolved = parts[4] if len(parts) > 4 else ""
        host = ""
        if "://" in resolved:
            rest = resolved.split("://", 1)[1]
            if rest.startswith(("http://", "https://")):
                rest = rest.split("://", 1)[1]
            host = rest.split("/", 1)[0]
        household = self.household_of(state.uuid)
        group = household.group_for_zone(state.uuid) if household is not None else None
        room = state.name
        lead = state
        if group is not None:
            lead = self.zones.get(group.coordinator_uuid) or state
        if group is not None and len(group.zone_uuids) > 1:
            room = lead.name
        message = {
            "type": "playbackError", "zone": state.uuid, "room": room,
            "status": status, "title": title, "service": service, "host": host,
        }
        task = asyncio.create_task(
            self._report_playback_error(lead, message, title or resolved),
            name=f"playback-error:{state.uuid}")
        task.add_done_callback(_note_unwaited_failure)

    #: How long a speaker gets to carry on by itself after a failure.
    PLAYBACK_RECOVERY = 4.0

    async def _report_playback_error(self, lead: ZoneState, message: dict, item: str) -> None:
        """Tell the pages about a failure, unless the speaker got past it.

        A station or a service's radio fails an item now and then and moves on
        to the next without stopping: Pandora's audio ads, where the network's
        DNS blocks the ad server, came back as ERROR_CANT_REACH_SERVER four
        times in half an hour while the music played on, and each raised a "cannot play" warning on every open
        page. So the group is looked at again a moment later. Still playing
        means it recovered, and the failure is only logged; stopped means the
        music did not start, which is what the warning is for. The rule is the
        transport's, so it holds for every service.
        """
        await asyncio.sleep(self.PLAYBACK_RECOVERY)
        where, reason = message["room"], message["status"]
        # TRANSITIONING does not count: a source that cannot open sits there
        # before it drops to STOPPED.
        carried_on = lead.transport.state == "PLAYING"
        await self.dropouts.failed(lead, carried_on=carried_on, item=item,
                                   service=message["service"], reason=reason)
        if carried_on:
            log.info("%s could not play %r (%s): %s, and carried on playing",
                     where, item, message["service"], reason)
            return
        log.warning("%s could not play %r (%s): %s", where, item, message["service"], reason)
        await self._broadcast(message)

    async def _note_recently_played(self, state: ZoneState) -> None:
        """Put what this room has started playing on its household's list.

        A queue is remembered by the container that filled it (album,
        playlist), a stream by the stream itself; a member following its
        coordinator, a television or line-in, and anything without a name
        are not history.
        """
        transport = state.transport
        media = transport.media_uri
        if not media or media.startswith(("x-rincon:", "x-rincon-stream:", "x-sonos-htastream:")):
            return
        household = self.household_of(state.uuid)
        if household is None:
            return
        if media.startswith("x-rincon-queue:"):
            uri, metadata = state.enqueued_uri, state.enqueued_metadata
            replace = True
        else:
            uri, metadata = media, state.media_metadata
            replace = False
        if not uri:
            return
        items = parse_didl(metadata) if metadata else []
        item = items[0] if items else None
        title = (item.title if item else "") or transport.container_title
        if not title and not replace:
            title = transport.title
        art = (item.art_uri if item else "") or ("" if replace else transport.album_art_uri)
        entry = {
            "uri": uri, "metadata": metadata, "title": title, "replace": replace,
            "kind": kind_of(item.upnp_class if item else "", uri),
            "art": art, "host": state.host, "service_id": transport.service_id,
        }
        if self.recent.note(household.id, entry) or self.recent.fill_art(household.id, uri, art):
            await self._broadcast({"type": "recent", "household": household.id})

    async def _on_transport(self, event: Event) -> None:
        state = self._zone_for_host(event.host)
        if state is None:
            return
        props = event.properties
        transport = state.transport
        prev_track = transport.track_uri

        await self._note_playback_error(event, state)

        began = False
        halted = False
        state_before = transport.state
        if "TransportState" in props:
            began = (props["TransportState"] == "PLAYING"
                     and transport.state != "PLAYING")
            # Paused or stopped: where it stopped is the position from now on,
            # and nothing else reads it. Without this a paused room showed the
            # reading taken when the track began, and every pause and resume
            # left the count a little further out (Pandora beside the Windows
            # app).
            halted = (props["TransportState"] in ("PAUSED_PLAYBACK", "STOPPED")
                      and transport.state in ("PLAYING", "TRANSITIONING"))
            transport.state = props["TransportState"]
        if "CurrentPlayMode" in props:
            transport.play_mode = props["CurrentPlayMode"]
        if "CurrentCrossfadeMode" in props:
            transport.crossfade = props["CurrentCrossfadeMode"] == "1"
        if "CurrentValidPlayModes" in props:
            transport.valid_play_modes = props["CurrentValidPlayModes"]
        if "CurrentTrack" in props:
            transport.track_number = _as_int(props["CurrentTrack"])
        if "CurrentTrackDuration" in props:
            transport.track_duration = props["CurrentTrackDuration"]
        track_changed = False
        if "CurrentTrackURI" in props:
            track_changed = props["CurrentTrackURI"] != transport.track_uri
            transport.track_uri = props["CurrentTrackURI"]
            self._name_service(transport)
        media_changed = False
        if "AVTransportURI" in props:
            media_changed = props["AVTransportURI"] != transport.media_uri
            transport.media_uri = props["AVTransportURI"]
            # Named again once the media is known: a station loaded while
            # stopped arrives with an empty track, and the name read above
            # came from the media URI before this event replaced it -- a
            # stopped AccuRadio station lost "AccuRadio".
            self._name_service(transport)
        if media_changed:
            transport.container_title = ""
            # Everything else the old source had said about itself goes with
            # it. A station's DIDL carries no artist, album or item id, and
            # its stream text only arrives once the stream is up, so without
            # this a room that had been playing a service track kept naming
            # that track's artist under the new station (Amazon Music
            # followed by a TuneIn stream).
            transport.stream_content = ""
            transport.stream_show = ""
            transport.stream_show_id = ""
            transport.item_id = ""
            transport.rating = 0
            transport.next_title = ""
            transport.next_artist = ""
        if "NumberOfTracks" in props:
            transport.queue_length = _as_int(props["NumberOfTracks"])
        if props.get("CurrentTrackMetaData"):
            self._apply_track_metadata(transport, props["CurrentTrackMetaData"])
        elif "CurrentTrackMetaData" in props and not transport.track_uri:
            # The speaker says there is no current track: an emptied queue
            # reports CurrentTrackURI and CurrentTrackMetaData both empty.
            # The last song's words and art had stayed, and a room
            # read "Land Of The Blind - Information Society" over a queue of
            # 0 songs where the Windows app reads "[No music selected]".
            self._forget_track(transport)
        if "NextTrackMetaData" in props:
            following = parse_didl(props["NextTrackMetaData"] or "")
            head = following[0] if following else None
            transport.next_title = clean_title(head.title) if head and not _uri_like(head.title) else ""
            transport.next_artist = (head.artist if head else "") or ""
        if transport.track_uri != prev_track:
            self._track_changed(state)
        if "TransportState" in props and state_before != transport.state:
            if state.is_coordinator:
                asyncio.create_task(self.dropouts.transport(state, state_before, transport.state),
                                    name=f"dropout:{state.uuid}")
            else:
                self.dropouts.forget(state.uuid)
        if transport.is_home_theater:
            # The signal indicator is not evented; refresh it when the
            # home-theater transport reports anything.
            try:
                info = await self.soap.call(
                    state.host, const.DEVICE_PROPERTIES, "GetZoneInfo")
                state.ht_audio_in = _as_int(info.get("HTAudioIn", ""), -1)
                if state.ht_audio_in < 0:
                    state.ht_audio_in = None
            except Exception:
                pass
        # Radio streams carry the now-playing text separately from the track.
        #
        # The container's name only arrives with EnqueuedTransportURIMetaData,
        # and a source change does not always bring that field along. Keeping
        # the old name then left a room tile naming the station it used to be
        # playing -- the user's "sometimes updates, sometimes doesn't".
        # A new media URI means a new container, so the old name
        # goes whether or not a replacement came with it.
        if props.get("EnqueuedTransportURIMetaData"):
            items = parse_didl(props["EnqueuedTransportURIMetaData"])
            if items and items[0].title:
                # The container being played: a station, playlist or album.
                transport.container_title = items[0].title
                if not transport.title:
                    transport.title = items[0].title
        if "EnqueuedTransportURI" in props:
            state.enqueued_metadata = props.get("EnqueuedTransportURIMetaData", "") or ""
        note_queue_source(state, transport, props)
        if props.get("AVTransportURIMetaData"):
            state.media_metadata = props["AVTransportURIMetaData"]
        if media_changed:
            # What the event itself says goes out first. The reads below can
            # take seconds while the speaker opens a stream (the actions query
            # answered in 2.1 and 5.8 s, 2026-09-29), and
            # while they waited, other events for the room published it half
            # changed: the new stream under the old station's title, which is
            # the TuneIn hop that lagged beside the app.
            await self._publish_zone(state)
            # The new source's own name and current-track text are read back
            # now rather than waited for: the events that carry them can
            # trail the switch by seconds, and Now Playing kept the previous
            # station's Station / On Now / Information lines up meanwhile
            # (seen on TuneIn station changes).
            await self._read_media(state, track=not props.get("CurrentTrackMetaData"))
            await self._publish_zone(state)
            # Whether the new source can be paused at all. The apps read this
            # to label the room menu: a queue or an on-demand station offers
            # "Pause Group", a broadcast stream "Stop Group" (2026-09-07).
            (transport.can_pause, transport.can_seek,
             transport.can_next, transport.can_previous) = await self._transport_actions(state.host)
        elif began or track_changed:
            # Read again whenever playback starts or the track changes, not only with the source:
            # a source's change arrives while it is still opening, when a Pandora station offers
            # no Next yet, and a station's Next comes and goes with its skip limit. Read once,
            # Next stayed off for the whole station in every theme.
            actions = await self._transport_actions(state.host)
            if actions != (transport.can_pause, transport.can_seek, transport.can_next, transport.can_previous):
                (transport.can_pause, transport.can_seek,
                 transport.can_next, transport.can_previous) = actions
                await self._publish_zone(state)
        if transport.state == "PLAYING" and (began or track_changed or media_changed):
            await self._note_recently_played(state)
        # A sleep timer set or cleared anywhere shows up here first; clients
        # read the timers again when told.
        if "SleepTimerGeneration" in props and props["SleepTimerGeneration"] != state.sleep_generation:
            state.sleep_generation = props["SleepTimerGeneration"]
            await self._broadcast({"type": "sleep", "zone": state.uuid})

        # Playback that has just started, and every track after it, settles the
        # position: no event carries RelTime, so without this the clients go on
        # counting from where the *previous* track had reached. A new track then
        # appeared part way along the bar and its countdown ran out before the
        # music did, which is what Amazon Music's stream looked like beside the
        # desktop app. One small call per track, which is
        # what the app does too.
        if began or halted or (track_changed and transport.state in ("PLAYING", "TRANSITIONING")):
            try:
                position = await self.soap.call(
                    state.host, const.AV_TRANSPORT, "GetPositionInfo",
                    {"InstanceID": 0})
                transport.rel_time = position.get("RelTime", "")
                transport.position_read_at = monotonic()
                transport.track_duration = position.get(
                    "TrackDuration", transport.track_duration)
            except Exception:
                pass

        await self._publish_zone(state)

    async def repost_position(self, zone_uuid: str) -> None:
        """Re-read a coordinator's position and tell the browsers.

        ``RelTime`` is not evented, so nothing tells a client that the track
        jumped: the browsers carry the position forward a second at a time
        from the last value they were given, and after a seek they were out
        by however far the seek moved (a three-hour Mixcloud show, Sonora
        reading 3:20 where the app read 20:29).
        """
        state = self.zones.get(zone_uuid)
        if state is None:
            return
        try:
            position = await self.soap.call(
                state.host, const.AV_TRANSPORT, "GetPositionInfo",
                {"InstanceID": 0})
        except Exception as exc:
            log.info("position re-read failed for %s: %s", state.name, exc)
            return
        state.transport.rel_time = position.get("RelTime", "")
        state.transport.position_read_at = monotonic()
        state.transport.track_number = position.int_("Track")
        state.transport.track_duration = position.get("TrackDuration", "")
        await self._publish_zone(state)

    def _name_service(self, transport) -> None:
        """Set the service id and name from the ``sid`` in the URIs.

        The track URI answers it while something plays. A room stopped on a
        station has no track URI but still holds the station as its media
        URI, and the app keeps naming the service in that state ("Pandora"
        over the station's name, seen 2026-09-06), so that is read next.
        """
        match = (re.search(r"[?&]sid=(\d+)", transport.track_uri or "")
                 or re.search(r"[?&]sid=(\d+)", transport.media_uri or ""))
        transport.service_id = int(match.group(1)) if match else None
        transport.service_name = (
            self._service_names.get(transport.service_id, "") if match else "")

    async def _on_rendering(self, event: Event) -> None:
        state = self._zone_for_host(event.host)
        if state is None:
            return
        master = event.channels.get("Master", {})
        props = event.properties
        if "Volume" in master:
            state.volume = _as_int(master["Volume"])
        if "Mute" in master:
            state.muted = master["Mute"] == "1"
        # Balance is the two channels' levels, which set_balance writes and the speaker
        # announces here. It was never read back, so every slider showed it centered.
        if "Volume" in event.channels.get("LF", {}) or "Volume" in event.channels.get("RF", {}):
            state.channel_left = _as_int(event.channels.get("LF", {}).get("Volume", state.channel_left))
            state.channel_right = _as_int(event.channels.get("RF", {}).get("Volume", state.channel_right))
            state.balance = _balance_of(state.channel_left, state.channel_right)
        if "Bass" in props:
            state.bass = _as_int(props["Bass"])
        if "Treble" in props:
            state.treble = _as_int(props["Treble"])
        if "Loudness" in event.channels.get("Master", {}):
            state.loudness = event.channels["Master"]["Loudness"] == "1"
        elif "Loudness" in props:
            state.loudness = props["Loudness"] == "1"
        if "SupportsMaxDialogLevel" in props:
            state.speech_max = props["SupportsMaxDialogLevel"] == "1"
        if "OutputFixed" in props:
            state.fixed_output = props["OutputFixed"] == "1"
        await self._publish_zone(state)

    async def _on_group_rendering(self, event: Event) -> None:
        state = self._zone_for_host(event.host)
        if state is None:
            return
        props = event.properties
        if "GroupVolume" in props:
            state.group_volume = _as_int(props["GroupVolume"])
        if "GroupMute" in props:
            state.group_muted = props["GroupMute"] == "1"
        await self._publish_zone(state)

    async def _on_audio_in(self, event: Event) -> None:
        """Whether anything is plugged into this player's line-in socket."""
        state = self._zone_for_host(event.host)
        if state is None:
            return
        raw = event.properties.get("LineInConnected")
        if raw is None:
            return
        state.line_in_connected = str(raw) in ("1", "true", "True")
        await self._publish_zone(state)

    async def _on_device_properties(self, event: Event) -> None:
        state = self._zone_for_host(event.host)
        if state is None:
            return
        state.radio = RadioFacts.from_event_properties(event.properties)
        if "LastChangedPlayState" in event.properties:
            state.last_play_state = event.properties["LastChangedPlayState"]
        if event.properties.get("ZoneName"):
            state.name = event.properties["ZoneName"]
        await self._publish_zone(state)

    async def _on_topology_event(self, event: Event) -> None:
        """Rebuild topology when the household says it changed.

        Grouping changes arrive as a burst of events from several speakers, so
        rebuilding is debounced rather than done once per event.
        """
        await self._note_service_change(event)
        await self._note_software_update(event)
        # The event carries the topology itself. Applied at once, a grouping
        # change shows as soon as the speakers announce it, as the Windows app
        # has it; the full rediscovery behind it takes ten seconds or more
        # and used to be the only path.
        state_xml = event.properties.get("ZoneGroupState", "")
        # Not from a speaker that has stopped answering: it may be describing
        # the household as it was before it dropped off.
        if state_xml and not self.soap.is_silent(event.host) \
                and event.host not in getattr(self.registry, "_down", set()):
            try:
                applied = await self._apply_topology(event.host, state_xml)
            except Exception:
                log.exception("applying evented topology failed")
                applied = False
            # A subscription's opening message is the state as it stands:
            # applied, it needs no rediscovery behind it.
            if applied and event.seq == 0:
                return
        if self._retopology is not None and not self._retopology.done():
            # A refresh is already reading the topology, and may have read it
            # before this change settled: one more follows it. Dropping these
            # left Sonora showing a group the speakers had split, after a
            # coordinator hand-off whose events landed during a refresh slowed
            # by two unreachable players. A subscription's first
            # message (SEQ 0) is not a change, only the state as it stands,
            # and every refresh subscribes afresh: counting those kept Sonora
            # refreshing back to back.
            if event.seq > 0:
                self._retopology_again = True
            return
        self._retopology = asyncio.create_task(self._debounced_retopology())

    async def _note_software_update(self, event: Event) -> None:
        """Pass on a change in a household's speaker update as the speakers
        announce it, which is how the S1 apps learn of one: they keep no
        timer of their own. Every topology event carries the update the
        players last found (AvailableSoftwareUpdate) and, in ZoneGroupState,
        the software each player runs. When either changes, the cached
        answer is dropped and the pages are told to ask again, so "Update
        Now" appears as an update is found and goes once the players run it.
        """
        props = event.properties
        if "AvailableSoftwareUpdate" not in props and "ZoneGroupState" not in props:
            return
        household = next((h for h in self.households.values()
                          if any(p.host == event.host for p in h.players.values())), None)
        if household is None:
            return
        previous = self._update_seen.get(household.id)
        if "AvailableSoftwareUpdate" in props:
            item = parse_update_item(str(props.get("AvailableSoftwareUpdate") or ""))
            offered = item.get("version", "") if item.get("type") == "Software" else ""
        else:
            offered = previous[0] if previous else ""
        running: dict[str, str] = {}
        if props.get("ZoneGroupState"):
            try:
                players, _, _ = parse_zone_group_state(props["ZoneGroupState"])
            except Exception:
                players = {}
            running = {uuid: p.software_version for uuid, p in players.items()
                       if p.software_version and uuid in household.players}
            # What a player says it runs is the truth: the update's own check
            # compares against these, and rediscovery after a restart lags.
            for uuid, version in running.items():
                household.players[uuid].software_version = version
                if uuid in self.zones:
                    self.zones[uuid].software_version = version
        if not running and previous:
            running = dict(previous[1])
        seen = (offered, tuple(sorted(running.items())))
        self._update_seen[household.id] = seen
        if previous is not None and seen != previous:
            log.info("speaker update news for %s: offered %s, running %s", household.id[:22],
                     offered or "nothing", ", ".join(sorted(set(running.values()))) or "unknown")
            self._software_updates.pop(household.id, None)
            await self._broadcast({"type": "softwareUpdate", "household": household.id})

    async def _note_service_change(self, event: Event) -> None:
        """When a speaker's configured-service list changes, refresh it live.

        The account list rides along in ``ThirdPartyMediaServersX``, sealed
        with the household cipher. Every new value is opened and kept, because
        it carries each account's nickname the moment the speakers have it --
        the cloud's registration list takes its time. A change also means a
        service was added or removed (here or in another app), so the cloud
        cache is dropped and clients are told to refetch; the first value from
        a host seeds the baseline without that broadcast.
        """
        blob = event.properties.get("ThirdPartyMediaServersX")
        if not blob:
            return
        previous = self._service_blob.get(event.host)
        if blob == previous:
            return
        self._service_blob[event.host] = blob
        self._note_accounts(event.host, blob)
        if previous is None:
            # The first account list from a player is a baseline, not news --
            # but a directory read before any had arrived knows none of the
            # household's accounts, and one is kept now, so that household's
            # is dropped to be read again with them (an S1 read
            # at start-up counted 11 services in use against 17). Only when
            # it was read with different accounts, though: every player of a
            # household sends the same list, a dozen of them at start-up, and
            # each was dropping the directory the one before had fixed.
            household = self.household_of(self._host_to_zone.get(event.host, ""))
            if household is not None and (household.id in self._directories
                                          or household.id in self._directory_reads):
                now = frozenset(self.configured_sids(household.id))
                if now != self._directory_basis.get(household.id):
                    self.forget_service_directory(household.id)
            return
        # Every player reports the change on its own, a dozen events in a few
        # seconds after an add in the Sonos app. One refresh a moment after the
        # last of them is enough; each event would otherwise cost a cloud
        # fetch and a client refresh of its own.
        log.info("configured-service list changed on %s; refresh scheduled", event.host)
        if self._services_refresh is not None and not self._services_refresh.done():
            self._services_refresh.cancel()
        self._services_refresh = asyncio.create_task(self._debounced_services_refresh())

    def _note_accounts(self, host: str, blob: str) -> None:
        """Open a household's account list and keep it, credentials dropped."""
        household = self.household_of(self._host_to_zone.get(host, ""))
        if household is None:
            return
        found = accounts.parse(blob, household.id)
        if found:
            self.accounts[household.id] = {a.udn: a for a in found}

    def _accounts_for(self, household_id: str) -> dict[str, accounts.Account]:
        """The household's accounts, opening a stored blob if none are held.

        The first event from a host can arrive before the topology knows which
        household that host is in, and that blob is then never opened. Rather
        than wait for the next one -- which only comes when a service is added
        or removed -- the stored value is opened on the first question asked.
        """
        held = self.accounts.get(household_id)
        if held is not None:
            return held
        household = self.households.get(household_id)
        if household is None:
            return {}
        for player in household.players.values():
            found = accounts.parse(self._service_blob.get(player.host or "", ""),
                                   household_id)
            if found:
                self.accounts[household_id] = {a.udn: a for a in found}
                return self.accounts[household_id]
        return {}

    def configured_sids(self, household_id: str) -> set[int]:
        """Browse sids the household has an account for, from the speakers.

        ``ThirdPartyMediaServersX`` names every configured account and the
        service type it belongs to, which is the browse sid shifted left by
        eight. This is the household's own record, so it stands whether or not
        anyone is signed in to Sonos -- and it names a service configured but
        never yet saved from, which inferring use from saved content cannot
        (closed).
        """
        # A service's account type is its sid times 256, plus 7 (Spotify is
        # 3079, Sonos Radio 77575). The list also holds Sonos' own records,
        # whose types are not: one on this S1 household is type 711 and
        # nicknamed "Deezer 34", and read as sid 2 it listed Deezer, which
        # nobody had added, and put it in every search.
        return {a.service_type >> 8 for a in self._accounts_for(household_id).values()
                if a.service_type and a.service_type & 0xFF == 7}

    def account_udn(self, household_id: str, sid: int, serial: str = "") -> str:
        """The descriptor the speakers know this service's account by.

        Content played from a service carries the account in its DIDL, as
        ``SA_RINCON<type>_<logon string>``. Sonora used to compose that from
        the service type alone -- ``X_#Svc<type>-0-Token``, which is what the
        common libraries send and what most accounts happen to be -- but an
        anonymous account has no logon string at all, so its real descriptor
        is ``SA_RINCON<type>_``. Sending the invented one had the player
        answer UPnP 402 Invalid Args and play nothing, which is what every
        Community Radio Plus station did.

        The household's own account list has the true one. Empty when it
        holds no account for the service, and the caller keeps its guess.
        """
        held = self._accounts_for(household_id)
        matches = [a for a in held.values() if a.service_id == sid]
        if serial:
            for account in matches:
                if account.serial == str(serial):
                    return account.udn
        return matches[0].udn if len(matches) == 1 else ""

    def household_accounts(self, household_id: str) -> list[accounts.Account]:
        """Every account the speakers hold for the household, from their list."""
        return list(self._accounts_for(household_id).values())

    def account_nickname(self, household_id: str, service_type: int,
                         username: str) -> str | None:
        """What the speakers call this account, or None if they say nothing.

        None and "" are different answers: an account the list does not hold
        leaves whatever the caller already had, while one held under no name
        is unnamed on the system.
        """
        account = self._accounts_for(household_id).get(
            accounts.account_udn(service_type, username))
        return None if account is None else account.nickname

    def note_account_renamed(self, household_id: str, udn: str,
                             nickname: str) -> None:
        """Record a rename Sonora just made, ahead of the event confirming it.

        The speakers publish the new list within a second or so, but the
        client refetches as soon as the rename returns, and that is sooner.
        """
        held = self._accounts_for(household_id)
        account = held.get(udn)
        if account is not None:
            held[udn] = replace(account, nickname=nickname)

    async def _debounced_services_refresh(self) -> None:
        await asyncio.sleep(2.0)
        # The anonymous-service probe is re-run on the next read: an account
        # change is exactly what would alter its answer, and so is the catalog
        # every browse now reads from.
        self.services.forget_anonymous()
        self.forget_service_directories()
        try:
            await self._refresh_services_after_change()
        except Exception:
            log.exception("service list refresh failed")

    async def _refresh_services_after_change(self) -> None:
        """Refetch each household's service list and drop links to services gone."""
        for household in self.households.values():
            if not household.cloud_id:
                continue
            # The last-known list is the "before" and a fresh fetch the
            # "after". Anything in the first but not the second was removed in
            # another app, and Sonora drops its own link for it as well: the
            # person took the service off their system, so it should go here
            # too, linked in Sonora or not. A service Sonora only ever held
            # itself was never in the household's list, so it is untouched.
            before = {r.service_id for r in
                      (self.cloud.last_registrations(household.cloud_id) or [])}
            self.cloud.forget_registrations(household.cloud_id)
            if not before:
                continue
            try:
                after = {r.service_id for r in
                         await self.cloud.registrations(household.cloud_id)}
            except Exception as exc:
                log.info("could not refetch services after a change: %s", exc)
                continue
            for sid in before - after:
                self.forget_linked_service(household.id, sid)
                self.forget_service_token(household.id, sid)
                log.info("service %s left household %s; Sonora's link dropped too",
                         sid, household.id[:22])
        await self._broadcast({"type": "services"})

    async def _apply_topology(self, host: str, state_xml: str) -> bool:
        """Regroup from an evented ZoneGroupState when it names only players
        already known, unchanged in name and bonding; anything else (a new
        player, a rename, a pair forming) is left to the full refresh."""
        players, groups, _ = parse_zone_group_state(state_xml)
        if not players:
            return False
        household = next((h for h in self.households.values()
                          if set(players) <= set(h.players)), None)
        if household is None:
            return False
        # The same rooms, built the same way: the players themselves have
        # been adjusted by that building (a pair's second unit is marked
        # invisible), so comparing them raw would refuse every event.
        def rooms(zones):
            return {uuid: (zone.name, tuple(sorted(p.uuid for p in zone.players)))
                    for uuid, zone in zones.items()}
        if rooms(zones_from_players(players.values())) != rooms(household.zones):
            return False
        regrouped = remap_groups(groups, household.zones, household.players)
        shape = lambda gs: sorted((g.coordinator_uuid, tuple(sorted(g.zone_uuids))) for g in gs.values())
        if shape(regrouped) == shape(household.groups):
            return True
        household.groups = regrouped
        log.info("regrouped from %s's topology event", host)
        self._last_evented_topology = (household.id, state_xml, monotonic())
        self._rebuild_zones(self.households)
        self._last_sent.clear()
        await self._broadcast({"type": "snapshot", "data": self.snapshot()})
        return True

    async def _debounced_retopology(self) -> None:
        while True:
            self._retopology_again = False
            await asyncio.sleep(0.6)
            try:
                await self.refresh()
            except Exception:
                log.exception("topology refresh failed")
            if not self._retopology_again:
                return

    async def _on_alarm_clock(self, event: Event) -> None:
        """The household's alarm list changed, wherever the change came from.

        AlarmClock publishes AlarmListVersion on every create, update, delete
        and on/off, so a change made in one of the desktop apps reaches the
        browsers here rather than waiting for the pane to be reopened.
        """
        version = event.properties.get("AlarmListVersion")
        if not version:
            return
        # The value is "<a speaker>:<count>", where the count runs household
        # wide but the speaker named in front of it is whichever one handled
        # the change: this household published RINCON_7828CA0000A101400:37,
        # then :38, then RINCON_542A1B0000B201400:39. So the household keys
        # it and only the count is compared -- keying by the whole string
        # meant every change made from a different speaker looked like a
        # first sighting and was swallowed, which is why an alarm added in
        # the Windows app sometimes never reached Sonora.
        state = self._zone_for_host(event.host)
        household = self.household_of(state.uuid) if state is not None else None
        key = household.id if household is not None else event.host
        count = version.rpartition(":")[2]
        if count == self._alarm_version.get(key):
            return
        first = key not in self._alarm_version
        self._alarm_version[key] = count
        log.info("alarm list version %s from %s%s", version, event.host,
                 " (first)" if first else "")
        if not first:
            await self._broadcast({"type": "alarms"})

    async def _note_container_changes(self, event: Event) -> None:
        """Containers changed by any controller, named by the speaker itself.

        ContentDirectory publishes ``ContainerUpdateIDs`` as pairs of container
        and revision -- ``Q:0,11`` for the queue, ``FV:2`` for favorites,
        ``SQ:`` for Sonos playlists, ``R:0`` for saved stations -- whenever one
        of them changes, whoever changed it. Sonora subscribed to this service
        already but read only the music-index properties out of it, so a queue
        edited in the desktop app or on a phone sat stale until something else
        happened to refetch it.

        The first revision seen from a host is the subscription's own opening
        snapshot, so it is recorded without telling anyone.

        A queue belongs to one player, but favorites, Sonos playlists and
        saved stations belong to the household: every player announces the
        same change, so one edit of a favorite in a six-room household fired
        six identical broadcasts and six refetches in every open page. Those
        three are now announced once per household per revision.
        """
        raw = event.properties.get("ContainerUpdateIDs", "")
        if not raw:
            return
        parts = [part for part in raw.split(",") if part]
        state = self._zone_for_host(event.host)
        uuid = state.uuid if state is not None else ""
        for container, revision in zip(parts[0::2], parts[1::2]):
            kind = next((name for prefix, name in CONTAINERS
                         if container.startswith(prefix)), "")
            if not kind:
                continue
            # The queue is the player's own; the rest are the household's,
            # and every player reports them.
            household = self.household_of(uuid) if kind != "queue" else None
            # Each player keeps its own counter for the same household
            # container -- one household's eight players answered a single
            # change of "R:" with revisions of their own -- so the revision is
            # remembered per player, and the announcement is what the
            # household shares. Keying the revision on the household instead
            # made every player's report look like a change: 56 edits of the
            # saved stations reached the interface 319 times in a day, each
            # one refetching the list in every open page (the
            # players are 6 to 8 deep in a burst under 3s).
            key = (event.host, container)
            before = self._container_ids.get(key)
            self._container_ids[key] = revision
            if before is None or before == revision:
                continue
            if household is not None:
                said = self._container_said.get((household.id, container), 0.0)
                now = monotonic()
                if now - said < CONTAINER_BURST:
                    continue
                self._container_said[(household.id, container)] = now
            log.info("%s changed on %s (%s)", kind, event.host, container)
            await self._broadcast({"type": kind, "zone": uuid})

    async def _on_content_directory(self, event: Event) -> None:
        """The music index's state, pushed as it changes.

        ContentDirectory publishes ShareIndexInProgress while an index runs and
        ShareIndexLastError when one fails -- the desktop app's "There is not
        enough room to update your music library" comes from that variable, and
        without it a controller can only watch the index stop and call it done
        (measured on this household 2026-09-10, where the app reported the
        failure and Sonora reported success).
        """
        await self._note_container_changes(event)
        props = event.properties
        if "ShareIndexInProgress" not in props and "ShareIndexLastError" not in props:
            return
        state = self._zone_for_host(event.host)
        household = self.household_of(state.uuid) if state is not None else None
        key = household.id if household is not None else event.host
        before = dict(self._index_state.get(key) or {})
        after = dict(before)
        if "ShareIndexInProgress" in props:
            self._indexing_hosts[event.host] = props["ShareIndexInProgress"] == "1"
            after["indexing"] = self.household_indexing(key)
        if "ShareIndexLastError" in props:
            after["error"] = (props["ShareIndexLastError"] or "").strip()
        # A share landing or leaving changes this, and it is how a pane
        # learns that an add finally took.
        if "ShareListUpdateID" in props:
            after["shares_at"] = props["ShareListUpdateID"]
        if after == before:
            return
        self._index_state[key] = after
        if after.get("error") and after.get("error") != before.get("error"):
            log.warning("music index on %s failed: %s", key, after["error"])
        await self._broadcast({"type": "library"})

    @property
    def session(self) -> aiohttp.ClientSession:
        """The shared HTTP session, for the few callers that stream through."""
        return self._session

    def household_indexing(self, household_id: str) -> bool:
        """Whether any player of the household is rebuilding the index."""
        household = self.households.get(household_id)
        hosts = ({p.host for p in household.players.values()} if household is not None
                 else set(self._indexing_hosts))
        return any(busy for host, busy in self._indexing_hosts.items() if host in hosts)

    def index_state(self, zone_uuid: str) -> dict:
        """What the household's players last said about the music index."""
        household = self.household_of(zone_uuid)
        key = household.id if household is not None else zone_uuid
        return dict(self._index_state.get(key) or {})

    def index_error(self, zone_uuid: str) -> str:
        return str(self.index_state(zone_uuid).get("error") or "")

    def clear_index_error(self, zone_uuid: str) -> None:
        """Forget the last index error, so the next one can be told apart."""
        household = self.household_of(zone_uuid)
        key = household.id if household is not None else zone_uuid
        state = self._index_state.get(key)
        if state:
            state["error"] = ""

    # -- shares the players have taken but not listed ------------------------

    #: How long an unlisted share is still called "adding". The app does not
    #: time-box the operation either; its one hard ceiling is the 30 minute
    #: abort on the share migration path, so that is the ceiling here.
    PENDING_SHARE_LIMIT = 30 * 60

    @staticmethod
    def _share_key(path: str) -> str:
        """A share path in one shape, so typed and listed forms compare."""
        return (path or "").strip().replace("\\", "/").rstrip("/").lower()

    def note_pending_share(self, zone_uuid: str, path: str, object_id: str = "",
                           took: str = "") -> None:
        """Remember a share the players have taken but not listed.

        ``took`` is the player that accepted it, when one has: the folder is
        then reported as added and indexing, which is what the desktop app
        shows the moment its own calls return.
        """
        household = self.household_of(zone_uuid)
        key = household.id if household is not None else zone_uuid
        self._pending_shares.setdefault(key, {})[self._share_key(path)] = {
            "path": path, "object_id": object_id, "since": time(), "hint": "",
            "took": took,
        }

    def note_pending_share_hint(self, zone_uuid: str, path: str, hint: str,
                                failed: bool = False) -> None:
        """Attach what the file server said about a share that did not land.

        ``failed`` when every player has refused it: there is nothing left to
        wait for, so the pane says so instead of spinning.
        """
        household = self.household_of(zone_uuid)
        key = household.id if household is not None else zone_uuid
        record = (self._pending_shares.get(key) or {}).get(self._share_key(path))
        if record is not None:
            record["hint"] = hint
            record["failed"] = failed

    def clear_pending_share(self, zone_uuid: str, path: str) -> None:
        household = self.household_of(zone_uuid)
        key = household.id if household is not None else zone_uuid
        (self._pending_shares.get(key) or {}).pop(self._share_key(path), None)

    def settle_pending_shares(self, zone_uuid: str, listed: list[str],
                              indexing: bool = False, error: str = "") -> list[dict]:
        """Drop the ones that have arrived; report what is still outstanding.

        ``indexing`` is no longer read: a busy household says nothing about any
        one share, and treating it as success lost the refusals that arrive a
        minute late. It stays in the signature for the callers.

        Called from the library settings read, so a pane that is polling is
        what notices the share land -- there is no event for it beyond
        ShareListUpdateID, which says only that something changed.
        """
        household = self.household_of(zone_uuid)
        key = household.id if household is not None else zone_uuid
        records = self._pending_shares.get(key) or {}
        for path in [self._share_key(p) for p in listed]:
            records.pop(path, None)
        # A share is not listed under S: until its index run has finished --
        # measured 2026-09-10, where the desktop app's own add indexed for
        # minutes with S: still empty, the app showing the folder from its
        # own optimistic copy. So indexing, with nothing published against
        # that path, is the add having worked.
        # A player publishes `<code>,<path>` about the share it could not
        # mount, and it takes its time: a folder offered at 18:49:13 was not
        # complained about until 18:50:20 (2026-09-11). So a record lives until
        # the share is listed for real (handled above) or an error names it.
        # Sonora used to clear every record the moment the household was
        # indexing anything, which threw them away before the complaint
        # arrived and made a refused share read as one that had landed.
        blamed = self._share_key(error.split(",", 1)[-1]) if error else ""
        if blamed and blamed in records:
            records[blamed]["failed"] = True
            records[blamed]["took"] = ""
        now = time()
        return [
            {
                "path": record["path"],
                "seconds": int(now - record["since"]),
                "hint": record["hint"],
                # Past the ceiling it is not "still going" in any useful
                # sense; the pane says so rather than spinning for ever.
                "state": ("indexing" if record.get("took")
                          else "failed" if record.get("failed")
                          or now - record["since"] >= self.PENDING_SHARE_LIMIT
                          else "adding"),
            }
            for record in sorted(records.values(), key=lambda r: r["since"])
        ]

    # -- client push ---------------------------------------------------------

    def on_state(self, callback: StateCallback) -> None:
        self._callbacks.append(callback)

    def remove_listener(self, callback: StateCallback) -> None:
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    async def _on_muse_status(self, coordinator_uuid: str,
                              status: HomeTheaterStatus) -> None:
        """The cloud feed's word on a coordinator's television input."""
        state = self.zones.get(coordinator_uuid)
        if state is None:
            return
        if (state.ht_input, state.ht_signal) == (status.input, status.signal):
            return
        state.ht_input, state.ht_signal = status.input, status.signal
        await self._publish_zone(state)

    async def _publish_zone(self, state: ZoneState) -> None:
        """Send a zone update only when it differs from what clients hold."""
        payload = self._zone_payload(state)
        if self._last_sent.get(state.uuid) == payload:
            return
        self._last_sent[state.uuid] = payload
        await self._broadcast({"type": "zone", "data": payload})
        if state.is_coordinator:
            # The rooms grouped under it carry its play-mode flags.
            for member in list(self.zones.values()):
                if member is not state and not member.is_coordinator \
                        and self.coordinator_of(member.uuid) is state:
                    await self._publish_zone(member)

    async def _broadcast(self, message: dict) -> None:
        for callback in list(self._callbacks):
            try:
                result = callback(message)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                log.exception("state callback failed")

    def snapshot(self) -> dict:
        """A complete, serializable picture of everything known."""
        for household in self.households.values():
            for p in household.players.values():
                if p.online:
                    self.remember_player(p.uuid, {"name": p.name, "model_number": p.model_number,
                                                  "serial": p.serial})
        return {
            "households": [
                {
                    "id": household.id,
                    "generation": household.generation,
                    "zone_uuids": [z.uuid for z in household.visible_zones],
                    # Every physical speaker, the hidden halves of stereo pairs
                    # and surround satellites included, for the About dialog;
                    # rooms are what the rest of the interface works in.
                    "players": [
                        {
                            "uuid": p.uuid, "zone": zone.uuid, "name": zone.name,
                            "model": model_label(p.model, p.model_number), "host": p.host,
                            "display_version": (
                                self.zones[zone.uuid].display_version
                                if zone.uuid in self.zones else p.software_version),
                            "role": p.role_label, "online": p.online,
                            # The rest of what the desktop apps' About box prints.
                            "model_number": p.model_number, "serial": p.serial,
                            "software_version": p.software_version,
                            "hardware_version": p.hardware_version,
                            "series_id": p.series_id, "extra_version": p.extra_version,
                            "wireless_mode": p.wireless_mode,
                        }
                        for zone in household.visible_zones
                        for p in zone.players
                    ],
                    "vanished": [
                        {"uuid": v.uuid, "name": v.name, "reason": v.reason,
                         "model_number": v.model_number, "last_seen": v.last_seen,
                         "model": model_label(getattr(self, "_known", {}).get(v.uuid, {}).get("model")
                                              or MODEL_NAMES.get(v.model_number.upper(), v.model_number),
                                              v.model_number)}
                        for v in household.vanished
                    ],
                }
                for household in self.ordered_households()
            ],
            "zones": [self._zone_payload(state) for state in self._sorted_zones()],
            # Each group's entry carries a copy of its coordinator's
            # transport as it was when the topology was last built. The
            # interface replaces it with the room's own live state (see
            # store.jsx), so nothing should read this copy for what is
            # playing now.
            "groups": self._group_view(),
        }

    def _sorted_zones(self) -> list[ZoneState]:
        return sorted(self.zones.values(), key=lambda s: s.name.casefold())

    def _group_view(self) -> list[dict]:
        """Groups in the order a controller should list them.

        Topology returns them in whatever order the household reported, which
        is arbitrary and changes between refreshes. Sonos' own controllers list
        rooms alphabetically and do not promote whichever room is playing, so
        the ordering is settled here rather than left to each consumer.
        """
        groups: list[dict] = []
        for household in self.ordered_households():
            ordered = sorted(
                household.groups.values(),
                key=lambda group: _natural_key(
                    self.zones[group.coordinator_uuid].name
                    if group.coordinator_uuid in self.zones else ""),
            )
            for group in ordered:
                coordinator = self.zones.get(group.coordinator_uuid)
                if coordinator is None:
                    continue
                groups.append({
                    "id": group.id,
                    "household": household.id,
                    "coordinator": group.coordinator_uuid,
                    "members": list(group.zone_uuids),
                    "name": self._group_label(group.zone_uuids),
                    "transport": coordinator.as_dict()["transport"],
                })
        return groups

    def _group_label(self, zone_uuids: list[str]) -> str:
        """How controllers name a group: the leader plus a count."""
        names = [self.zones[u].name for u in zone_uuids if u in self.zones]
        if not names:
            return ""
        if len(names) == 1:
            return names[0]
        return f"{names[0]} + {len(names) - 1}"

    # -- lookups -------------------------------------------------------------

    def zone(self, uuid: str) -> ZoneState:
        state = self.zones.get(uuid)
        if state is None:
            raise KeyError(f"unknown zone {uuid}")
        return state

    async def _position_seconds(self, state: ZoneState) -> float | None:
        """Where the group is in its track, in seconds, or None unread."""
        try:
            info = await self.soap.call(self.coordinator_of(state.uuid).host,
                                        const.AV_TRANSPORT, "GetPositionInfo", {"InstanceID": 0})
        except Exception:
            return None
        parts = str(info.get("RelTime", "") or "").split(":")
        try:
            return float(sum(int(p) * 60 ** i for i, p in enumerate(reversed(parts))))
        except ValueError:
            return None

    def crossfade_refused_for(self, state: ZoneState) -> None:
        """The speaker refused crossfade for what it has loaded: say so to
        every page, until something else is loaded."""
        state.transport.crossfade_refused_uri = state.transport.media_uri
        # The group's other rooms follow in _publish_zone.
        asyncio.get_running_loop().create_task(self._publish_zone(state))

    #: What a room may be asked to do follows the room that plays for it.
    _MODE_FLAGS = ("can_crossfade", "can_shuffle", "can_repeat", "can_repeat_one")

    def _zone_payload(self, state: ZoneState) -> dict:
        """A zone as the pages get it. A room grouped under another reports
        its own transport as following that one, and its own play-mode event
        said CROSSFADE although every change goes to the coordinator: the
        phone pressed Crossfade on a room grouped under one playing a Sonos
        Radio station, and the coordinator refused it. Its flags are the
        coordinator's."""
        payload = state.as_dict(self._service_names)
        if not state.is_coordinator:
            lead = self.coordinator_of(state.uuid)
            if lead is not state:
                for flag in self._MODE_FLAGS:
                    payload["transport"][flag] = getattr(lead.transport, flag)
        return payload

    def coordinator_of(self, uuid: str) -> ZoneState:
        """The zone that owns transport for whichever group ``uuid`` is in."""
        state = self.zone(uuid)
        if state.is_coordinator:
            return state
        for household in self.households.values():
            group = household.group_for_zone(uuid)
            if group and group.coordinator_uuid in self.zones:
                return self.zones[group.coordinator_uuid]
        return state

    def any_host(self, household: "Household") -> str | None:
        """A player to aim a household-wide question at, avoiding quiet ones.

        ``Household.any_host`` cannot know which players have stopped
        answering; the SOAP client does, and a question put to a sleeping
        speaker fails for the whole household -- an unreachable Play:1 turned
        the service list into a 504.
        """
        quiet = {p.host for p in household.players.values()
                 if self.soap.is_silent(p.host)}
        return household.any_host(quiet)

    async def read_service_directory(self, household: "Household"):
        """Read a household's service catalog, trying its players in turn.

        ``ListAvailableServices`` is a household-wide query, so any player can
        answer it, but a sleeping speaker never will. Aiming at one host and
        failing the whole list when that host is the asleep one is the wrong
        behavior; here each online player is tried until one answers.
        """
        players = list(household.players.values())
        hosts = [p.host for p in players if p.online and not p.invisible]
        hosts += [p.host for p in players if p.online and p.invisible]
        # A player that has just stopped answering goes to the back of the
        # line rather than costing every read its timeout first, and the one
        # that answered last time goes to the front.
        known = self._directory_host.get(household.id)
        hosts.sort(key=lambda h: (self.soap.is_silent(h), h != known))
        last: Exception | None = None
        configured = self.configured_sids(household.id)
        for index, host in enumerate(hosts):
            # Every player but the last is given one short try and no second
            # chance, and must answer every part of the read: with another to
            # ask, waiting out 3 x 8s on a Play:1 that has stalled is the
            # whole of the delay. The last
            # has the client's own patience and may leave a gap.
            final = index == len(hosts) - 1
            quick = {} if final else {"timeout": 4.0, "retries": 0, "strict": True}
            try:
                directory = await self.services.read(host, configured=configured, **quick)
                self._directory_host[household.id] = host
                self._service_names.update({svc.id: svc.name for svc in directory.services})
                return directory
            except Exception as exc:
                last = exc
                log.info("player %s did not answer the service catalog: %s",
                         host, exc)
        if last is not None:
            raise last
        raise ConnectionError("no reachable player for the service catalog")

    async def device_serial(self, household: "Household") -> str:
        """The household's R_TrialZPSerial, used as the SMAPI device id.

        Read from any speaker and cached; the empty string if unavailable, in
        which case callers fall back to the household id.
        """
        cached = self._device_ids.get(household.id)
        if cached is not None:
            return cached
        serial = ""
        host = self.any_host(household)
        if host is not None:
            try:
                result = await self.soap.call(
                    host, const.SYSTEM_PROPERTIES, "GetString",
                    {"VariableName": "R_TrialZPSerial"})
                serial = str(result.get("StringValue", "") or "")
            except Exception:
                serial = ""
        self._device_ids[household.id] = serial
        return serial

    #: How long a household's update answer is trusted. The speakers check
    #: Sonos for updates themselves; this only reads what they last found.
    SOFTWARE_UPDATE_TTL = 600.0

    #: How long a player's /info answer is kept: its color and model do not
    #: change while it runs.
    PLAYER_INFO_TTL = 3600.0

    def _read_known(self) -> dict[str, dict]:
        try:
            data = json.loads(self._known_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        return {k: v for k, v in data.items() if isinstance(v, dict)} if isinstance(data, dict) else {}

    def _fill_from_known(self, households: dict[str, Household]) -> None:
        """Give a listed player whose description did not come, on the first
        read since start-up, the model and serial last seen of it."""
        known = getattr(self, "_known", {})
        for household in households.values():
            for player in household.players.values():
                facts = known.get(player.uuid)
                if player.model or not facts:
                    continue
                player.model = facts.get("model", "")
                player.model_number = player.model_number or facts.get("model_number", "")
                player.serial = player.serial or facts.get("serial", "")

    def remember_player(self, uuid: str, facts: dict) -> None:
        """Keep what was seen of a player, writing only when it changed."""
        known = getattr(self, "_known", None)
        if known is None:       # a controller built without its state
            return
        keep = {k: v for k, v in facts.items() if v not in (None, "")}
        merged = {**known.get(uuid, {}), **keep}
        if merged == known.get(uuid):
            return
        known[uuid] = merged
        try:
            self._known_path.parent.mkdir(parents=True, exist_ok=True)
            self._known_path.write_text(json.dumps(self._known, indent=1, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            log.info("could not keep player facts: %s", exc)

    def _vanished_details(self, uuid: str) -> dict | None:
        """A lost speaker, from its VanishedDevices entry and what was last
        seen of it. Max Volume is unknown, as it is to play.sonos.com; the
        version is the household's, which every member runs."""
        for household in self.households.values():
            gone = next((v for v in getattr(household, "vanished", []) if v.uuid == uuid), None)
            if gone is None:
                continue
            known = getattr(self, "_known", {}).get(uuid, {})
            number = gone.model_number or known.get("model_number", "")
            model = known.get("model") or MODEL_NAMES.get(number.upper(), number)
            # The firmware every member runs, as the product's dialog prints it.
            current = next((p for p in household.players.values() if p.software_version), None)
            version = current.software_version if current else ""
            return {
                "uuid": uuid,
                "name": gone.name or known.get("name", ""),
                "model": model_label(model, number),
                "model_number": number,
                "color": known.get("color", ""),
                "serial": known.get("serial", ""),
                "software_version": version,
                "display_version": getattr(current, "display_version", "") or "",
                "generation": household.generation,
                "max_volume": None,
                "online": False,
                "last_seen": gone.last_seen,
            }
        return None

    def player_record(self, uuid: str):
        """The physical player with this uuid, in whichever household holds it."""
        for household in self.households.values():
            player = household.players.get(uuid)
            if player is not None:
                return household, player
        return None, None

    async def player_details(self, uuid: str) -> dict | None:
        """What play.sonos.com's View System Details prints about one product.

        Its row reads "Beam • Black" over the room, and its View dialog adds
        the serial number, the model, the color, the room's Max Volume and
        the version, "S2 97.1-80312" (2026-09-24). All of it is the player's
        own: the color and model name from its ``/info`` (an older board
        leaves the color out, see ``products.FALLBACK_COLORS``), the Max
        Volume as ``volumeScalingFactor`` in its
        player settings on 1443, which both generations answer with Sonora's
        own api key. Nothing goes to Sonos.
        """
        household, player = self.player_record(uuid)
        if player is None:
            return self._vanished_details(uuid)
        cached = self._player_info.get(uuid)
        if cached is None or monotonic() - cached[0] > self.PLAYER_INFO_TTL:
            device: dict = {}
            try:
                async with self._session.get(
                        f"http://{player.host}:1400/info",
                        timeout=aiohttp.ClientTimeout(total=4)) as resp:
                    if resp.status == 200:
                        device = (await resp.json(content_type=None)).get("device") or {}
            except Exception as exc:
                log.info("no /info from %s: %s", player.host, exc)
            cached = (monotonic(), device)
            if device:
                self._player_info[uuid] = cached
        device = cached[1]
        max_volume = None
        try:
            async with self._session.get(
                    f"https://{player.host}:{const.SONOS_TLS_PORT}"
                    "/api/v1/players/local/settings/player",
                    headers={"X-Sonos-Api-Key": const.SONORA_API_KEY},
                    ssl=_PLAYER_TLS, timeout=aiohttp.ClientTimeout(total=4)) as resp:
                if resp.status == 200:
                    factor = (await resp.json(content_type=None)).get("volumeScalingFactor")
                    if isinstance(factor, (int, float)):
                        max_volume = round(factor * 100)
        except Exception as exc:
            log.info("no player settings from %s: %s", player.host, exc)
        model = (device.get("modelDisplayName") or player.display_name
                 or player.model.removeprefix("Sonos ").strip())
        self.remember_player(uuid, {"name": player.name, "model": model,
                                    "model_number": player.model_number,
                                    "color": device.get("color") or "",
                                    "serial": device.get("serialNumber") or player.serial})
        return {
            "uuid": uuid,
            "name": player.name,
            "model": model_label(model, player.model_number),
            "model_number": player.model_number,
            "color": device.get("color") or "",
            "serial": device.get("serialNumber") or player.serial,
            "software_version": device.get("softwareVersion") or player.software_version,
            "display_version": getattr(player, "display_version", "") or "",
            "generation": household.generation if household is not None else "",
            "max_volume": max_volume,
            "online": player.online,
        }

    async def software_update(self, household: "Household", fresh: bool = False) -> dict:
        """Whether the household's speakers have an update to install.

        The speakers keep the update they last found as an UpdateItem
        (ZoneGroupTopology#CheckForUpdate with CachedOnly, the same item the
        topology event carries as AvailableSoftwareUpdate): its Version is
        what the players should run and its UpdateURL where each fetches its
        own model's image (the trailing ``^version`` is theirs to expand).
        An update is pending when a player that answers runs something
        else. The Sonos app's own update is a separate matter -- the S1 Mac
        app showed "Update Now" for itself on 2026-09-23 while every player
        was current -- and is never counted here.
        """
        cached = self._software_updates.get(household.id)
        if cached and not fresh and monotonic() - cached[0] < self.SOFTWARE_UPDATE_TTL:
            return cached[1]
        answer = {"pending": False, "version": "", "url": "", "players": []}
        host = self.any_host(household)
        if host is not None:
            try:
                result = await self.soap.call(
                    host, const.ZONE_GROUP_TOPOLOGY, "CheckForUpdate",
                    # "Software": the SCPD lists "All" too, but the players
                    # answer it with 402 (2026-09-23).
                    {"UpdateType": "Software", "CachedOnly": 1, "Version": ""})
                item = parse_update_item(str(result.get("UpdateItem", "") or ""))
            except Exception as exc:
                log.info("no update answer for %s: %s", household.id[:22], exc)
                item = {}
            version = item.get("version", "")
            if item.get("type") == "Software" and version and item.get("url"):
                behind = [p for p in household.players.values()
                          if p.online and p.software_version and p.software_version != version]
                answer = {"pending": bool(behind), "version": version, "url": item["url"],
                          "display": item.get("display", ""),
                          "players": [{"uuid": p.uuid, "name": p.name, "host": p.host,
                                       "from": p.software_version} for p in behind]}
        self._software_updates[household.id] = (monotonic(), answer)
        return answer

    async def begin_software_update(self, household: "Household") -> dict:
        """Start the speaker update the household has waiting: each player
        that is behind is told to fetch and install it
        (ZoneGroupTopology#BeginSoftwareUpdate with the item's UpdateURL)."""
        status = await self.software_update(household, fresh=True)
        if not status["pending"]:
            return {"started": [], "pending": False}
        started, failed = [], []
        for player in status["players"]:
            try:
                await self.soap.call(
                    player["host"], const.ZONE_GROUP_TOPOLOGY, "BeginSoftwareUpdate",
                    {"UpdateURL": status["url"], "Flags": 0, "ExtraOptions": ""})
                started.append(player["name"])
            except Exception as exc:
                log.warning("update did not start on %s: %s", player["name"], exc)
                failed.append(player["name"])
        log.info("speaker update to %s started on %s", status["version"], ", ".join(started) or "nothing")
        self._software_updates.pop(household.id, None)
        return {"started": started, "failed": failed, "pending": True, "version": status["version"]}

    #: Seconds a household's radio location is trusted before it is re-read.
    RADIO_LOCATION_TTL = 30.0

    async def radio_location(self, household: "Household") -> dict:
        """The household's configured local-radio node and its city.

        The speakers hold this as the SystemProperties string
        ``R_RadioLocation``, which reads like ``F00080000z92808,Anaheim``: an
        object-id prefix, TuneIn's node for the postcode, then the city. The
        S1 apps label TuneIn's local row from it -- SCLib's string table has
        RHHSTR_LOCALRADIO with one argument for the city and
        RHHSTR_LOCALRADIO_NOLOCDCR for a household that has no location set.
        Measured 2026-09-06; the node browses to 157 stations here.
        """
        # Another controller can move the location at any time (the S1 app's
        # Change Location writes the same string), so the cache only saves
        # the repeat reads of one page load.
        cached = self._radio_locations.get(household.id)
        if cached is not None and monotonic() - cached[0] < self.RADIO_LOCATION_TTL:
            return cached[1]
        found: dict = {"node": "", "city": ""}
        host = self.any_host(household)
        if host is not None:
            try:
                # An S2 household answers 800 "Command not supported by this
                # device" here, which is an answer this caller handles, not a
                # fault worth a warning.
                result = await self.soap.call(
                    host, const.SYSTEM_PROPERTIES, "GetString",
                    {"VariableName": "R_RadioLocation"}, quiet_codes=frozenset({"800"}))
                raw = str(result.get("StringValue", "") or "")
            except Exception as exc:
                log.info("no radio location for %s: %s", household.id[:22], exc)
                raw = ""
            if raw:
                head, _, city = raw.partition(",")
                # The node id is what follows the object-id prefix.
                node = re.sub(r"^F[0-9A-Fa-f]{8}", "", head)
                found = {"node": node, "city": city.strip()}
        self._radio_locations[household.id] = (monotonic(), found)
        return found

    async def set_radio_location(self, household: "Household", node: str,
                                 city: str) -> dict:
        """Write the household's local-radio node (Change Location).

        The stored string keeps an object-id prefix in front of the node
        ("F00080000z92808,Anaheim"), so whatever prefix the household already
        has is reused and only the node and the city change. TuneIn takes both
        a postcode node ("z92808") and one of its own location containers
        ("r100455"), and answers getExtendedMetadata on either with the place
        spelled out, which is where the city comes from (2026-09-07).
        """
        host = self.any_host(household)
        if host is None:
            raise RuntimeError("no speaker available")
        prefix = "F00080000"
        try:
            result = await self.soap.call(
                host, const.SYSTEM_PROPERTIES, "GetString",
                {"VariableName": "R_RadioLocation"})
            raw = str(result.get("StringValue", "") or "")
            found = re.match(r"^(F[0-9A-Fa-f]{8})", raw.partition(",")[0])
            if found:
                prefix = found.group(1)
        except Exception:
            pass
        value = f"{prefix}{node}" + (f",{city}" if city else "")
        await self.soap.call(host, const.SYSTEM_PROPERTIES, "SetString",
                             {"VariableName": "R_RadioLocation",
                              "StringValue": value})
        self._radio_locations[household.id] = (monotonic(), {"node": node, "city": city})
        return {"node": node, "city": city}

    #: How long a pairability audit is trusted before being re-run. The answer
    #: is a property of the provider, so it changes rarely.
    UNPAIRABLE_TTL = 6 * 3600.0

    async def unpairable_service_ids(self, household: "Household") -> set[int]:
        """Services that cannot be linked from Sonora, by browse sid.

        A service is unpairable only when its provider refuses to even begin a
        sign-in for a caller that is not Sonos itself, answering NOT_AUTHORIZED
        the way SoundCloud does. This is asked directly, because the catalog's
        flags do not settle it: a device-cert service such as Pocket Casts still
        signs in fine, while SoundCloud does not. Only device-cert services are
        probed (no other kind rejects this way), the probe starts a sign-in but
        stores nothing, and a service already linked here is trusted as
        pairable without asking again.
        """
        cached = self._unpairable.get(household.id)
        if cached is not None:
            # An old answer stands while the audit is run again behind it:
            # it asks each provider in turn, and the first service list after
            # a start or every six hours waited on all of them.
            if monotonic() - cached[0] >= self.UNPAIRABLE_TTL:
                self._pairability_audit(household)
            return cached[1]
        return await self._pairability_audit(household)

    def _pairability_audit(self, household: "Household") -> asyncio.Task:
        """The household's audit, started unless one is already under way."""
        task = self._unpairable_reads.get(household.id)
        if task is None or task.done():
            task = asyncio.create_task(self._audit_pairability(household),
                                       name=f"pairability audit for {household.id[:22]}")
            task.add_done_callback(_note_unwaited_failure)
            self._unpairable_reads[household.id] = task
        return task

    async def _audit_pairability(self, household: "Household") -> set[int]:
        if not self.cloud.signed_in:
            return set()
        host = self.any_host(household)
        if host is None:
            return set()
        try:
            catalog = await self.cloud.service_catalog(household.cloud_id)
        except Exception as exc:
            log.info("pairability audit skipped, no catalog: %s", exc)
            return set()
        linked = set(self.service_tokens_for(household.id))
        cert_sids = {sid for sid, info in catalog.items()
                     if info.get("needs_cert") and sid not in linked}
        if not cert_sids:
            self._unpairable[household.id] = (monotonic(), set())
            return set()
        # A household-wide read aimed at one player, so a player that has
        # gone quiet must not cost the caller its whole answer: an
        # unreachable Play:1 once turned /api/services into a
        # 504 and left the web theme's home page in its loading ghosts. The
        # audit is an extra, so it gives up quietly.
        try:
            directory = await self.service_directory(household)
            device_id = await self.device_serial(household)
        except Exception as exc:
            log.info("pairability audit skipped, no directory: %s", exc)
            return set()

        async def rejects(service) -> bool:
            try:
                if service.auth == "DeviceLink":
                    await self.smapi.get_device_link_code(
                        endpoint=service.endpoint, service_name=service.name,
                        household_id=household.id, device_id=device_id)
                elif service.auth == "AppLink":
                    await self.smapi.get_app_link(
                        endpoint=service.endpoint, service_name=service.name,
                        household_id=household.id, device_id=device_id)
                else:  # Anonymous: usable only if it browses without a token.
                    await self.smapi.get_metadata(
                        endpoint=service.endpoint, service_name=service.name,
                        item_id="root", index=0, count=1,
                        household_id=household.id, token="", key="",
                        device_id=device_id)
                return False
            except SmapiError as exc:
                blob = f"{exc.code} {exc.detail}".upper()
                return "NOT_AUTHORIZED" in blob or "403" in blob
            except Exception:
                return False  # inconclusive: never block on a transient error

        services = [svc for svc in (directory.by_id(s) for s in cert_sids)
                    if svc is not None]
        results = await asyncio.gather(*(rejects(s) for s in services)) \
            if services else []
        unpairable = {svc.id for svc, bad in zip(services, results) if bad}
        self._unpairable[household.id] = (monotonic(), unpairable)
        log.info("pairability audit: %d of %d probed services reject Sonora",
                 len(unpairable), len(services))
        return unpairable

    def tokens_for_service(self, household_id: str, sid: int) -> dict[str, dict]:
        """Logins held for one service on a household, by account id."""
        return {a: v for (h, s, a), v in self.service_tokens.items()
                if h == household_id and s == sid}

    def credentials_for(self, household_id: str, sid: int, account_id: str = "",
                        single_account: bool = False) -> dict | None:
        """The login to browse ``sid`` as household account ``account_id``.

        An exact match wins. A login recorded before accounts were tracked has
        an empty account id; it stands for the household's only account when
        there is only one (and is moved onto that account so the question does
        not come up again), and is used as asked when no account is named. With
        several accounts and no attribution, no account can claim it: the
        person links again from the right row and the old login is dropped.
        """
        exact = self.service_tokens.get((household_id, sid, account_id))
        if exact is not None:
            return exact
        legacy = self.service_tokens.get((household_id, sid, ""))
        if legacy is None:
            # Asked for no account in particular: the service's one login, if
            # it has exactly one. A page opened on an account-less login keeps
            # working after that login is attributed to a household account.
            if not account_id:
                held = self.tokens_for_service(household_id, sid)
                if len(held) == 1:
                    return next(iter(held.values()))
            return None
        if not account_id:
            return legacy
        if legacy.get("standalone"):
            # A login made for a service as it was being added belongs to the
            # one household account of that service that has appeared since.
            # The services listing makes that match too, but a page that
            # browses as the new account the moment the link finishes can
            # ask first, and was told the service needed linking until the
            # person browsed away and back (TuneIn (New)). The
            # same rule here, from the speakers' own account list: exactly
            # one new, unclaimed account, and it is the one asked for.
            seen = set(legacy.get("seen_accounts") or [])
            held = set(self.tokens_for_service(household_id, sid)) - {""}
            fresh = [a.serial for a in self.household_accounts(household_id)
                     if a.service_id == sid and a.serial and a.serial not in seen and a.serial not in held]
            if fresh == [account_id]:
                self.remember_service_token(household_id, sid, legacy["token"],
                                            legacy["key"], account_id)
                return legacy
            return None
        if single_account:
            self.remember_service_token(household_id, sid, legacy["token"],
                                        legacy["key"], account_id)
            return legacy
        return None

    def service_tokens_for(self, household_id: str) -> set[int]:
        """The sids Sonora already holds a token for, in this household."""
        return {sid for (hid, sid, _a) in self.service_tokens if hid == household_id}

    def _load_service_tokens(self) -> None:
        """Read persisted music-service tokens, if any, from the data dir."""
        try:
            raw = json.loads(self._token_file.read_text())
        except (OSError, ValueError):
            return
        for entry in raw:
            try:
                key = (entry["household"], int(entry["sid"]),
                       str(entry.get("account", "") or ""))
                self.service_tokens[key] = {
                    "token": entry["token"], "key": entry["key"],
                    "standalone": bool(entry.get("standalone", False)),
                    "seen_accounts": list(entry.get("seen_accounts") or []),
                    "system_udn": str(entry.get("system_udn", "") or "")}
            except (KeyError, TypeError, ValueError):
                continue

    def remember_service_token(self, household_id: str, sid: int,
                               token: str, key: str, account_id: str = "",
                               standalone: bool = False,
                               seen_accounts: list[str] | None = None,
                               system_udn: str | None = None) -> None:
        """Hold a service's login token and persist it across restarts.

        Kept in the data dir, never in the repository. This is what lets a
        service linked through Sonora stay browsable after a restart, since the
        speakers will not hand the token back.
        """
        # `standalone`: a login made knowing it belongs to no household account
        # (the service was already on the system under someone else, or not on
        # it at all). It is never attributed to an account later; a login from
        # before accounts were tracked has no flag and may be.
        # `seen_accounts`: the household accounts of the service that existed
        # when a standalone login was made. One that appears later, alone, is
        # taken to be this login's account (the person linked here, then added
        # the same account in the Sonos app), and the login is attributed to it.
        # `system_udn`: the household account this same login was put on
        # (Reauthorize, below), so a token the provider rotates for Sonora is
        # handed to the speakers too; None keeps whatever was recorded.
        previous = self.service_tokens.get((household_id, sid, account_id)) or {}
        self.service_tokens[(household_id, sid, account_id)] = {
            "token": token, "key": key, "standalone": standalone and not account_id,
            "seen_accounts": list(seen_accounts or []) if not account_id else [],
            "system_udn": previous.get("system_udn", "") if system_udn is None else system_udn}
        # Attributing a login to an account retires any unattributed one for
        # the same service: it was this login, or one this person has replaced.
        if account_id:
            self.service_tokens.pop((household_id, sid, ""), None)
        # A service just linked here is pairable by definition; drop the cached
        # audit so it is not still shown as unpairable.
        self._unpairable.pop(household_id, None)
        self._persist_tokens()

    def _refresh_service_token(self, household_id: str, old_token: str,
                               token: str, key: str) -> None:
        """Replace a login the provider has just rotated.

        SMAPI clients get no notice of the service id inside a call, so the
        entry is found by the token being replaced.
        """
        for (hid, sid, account), creds in list(self.service_tokens.items()):
            if hid == household_id and creds.get("token") == old_token:
                log.info("service %s on %s rotated its login token", sid, hid[:22])
                self.remember_service_token(hid, sid, token, key, account,
                                            standalone=bool(creds.get("standalone")))
                # A login the speakers share (put there by Reauthorize) is
                # handed to them too, or their copy would be the stale one.
                udn = creds.get("system_udn")
                if udn:
                    try:
                        asyncio.get_running_loop().create_task(
                            self._share_rotated_login(hid, udn, token, key))
                    except RuntimeError:
                        pass
                return

    async def _share_rotated_login(self, household_id: str, udn: str,
                                   token: str, key: str) -> None:
        household = self.households.get(household_id)
        zone = next((z for z in self.zones.values()
                     if z.online and household is not None
                     and z.uuid in household.zones), None)
        if zone is None:
            return
        try:
            await Commands(self).replace_oauth_account(
                zone.uuid, udn, token, key, await self.device_serial(household))
        except Exception as exc:  # noqa: BLE001 - the speakers keep their old pair
            log.info("could not hand a rotated login to the speakers: %s", exc)

    def forget_service_token(self, household_id: str, sid: int,
                             account_id: str | None = None) -> None:
        """Drop a service's login: one account's, or every account's."""
        if account_id is None:
            keys = [k for k in self.service_tokens if k[0] == household_id and k[1] == sid]
        else:
            keys = [(household_id, sid, account_id)]
        dropped = [k for k in keys if self.service_tokens.pop(k, None) is not None]
        if dropped:
            self._persist_tokens()

    def _persist_tokens(self) -> None:
        payload = [
            {"household": hid, "sid": s, "account": a,
             "token": v["token"], "key": v["key"],
             "standalone": bool(v.get("standalone", False)),
             "seen_accounts": list(v.get("seen_accounts") or []),
             "system_udn": v.get("system_udn", "")}
            for (hid, s, a), v in self.service_tokens.items()
        ]
        try:
            self._token_file.parent.mkdir(parents=True, exist_ok=True)
            self._token_file.write_text(json.dumps(payload))
            self._token_file.chmod(0o600)
        except OSError as exc:
            log.warning("could not persist service tokens: %s", exc)

    def _load_linked_services(self) -> None:
        """Read persisted Sonora-linked service entries, if any."""
        try:
            raw = json.loads(self._linked_file.read_text())
        except (OSError, ValueError):
            return
        for entry in raw:
            try:
                hid = entry["household"]
                sid = int(entry["sid"])
            except (KeyError, TypeError, ValueError):
                continue
            meta = {k: v for k, v in entry.items() if k != "household"}
            meta["id"] = sid
            self.linked_services.setdefault(hid, {})[sid] = meta

    def remember_linked_service(self, household_id: str, sid: int,
                                entry: dict) -> None:
        """Record a Sonora-linked service and persist it across restarts.

        Companion to ``remember_service_token``: the token keeps the service
        usable, this keeps it visible in the list.
        """
        # When the record was first made, kept across later updates. The
        # reconcile against the cloud list leaves a young record alone, since
        # the cloud takes a moment to list a service just added here.
        entry.setdefault("added_at", time())
        self.linked_services.setdefault(household_id, {})[sid] = entry
        self.removed_services.get(household_id, {}).pop(sid, None)
        self._persist_linked()

    #: How long a removal hides a service the cloud still lists. The cloud has
    #: been seen to trail the speakers by about a minute on adds; this leaves
    #: a comfortable margin, and a service still on the household after that
    #: was not really removed.
    REMOVED_GRACE = 180.0

    def remember_removed_service(self, household_id: str, sid: int,
                                 account_id: str = "") -> None:
        """Note that this household account for ``sid`` was just removed."""
        self.removed_services.setdefault(household_id, {})[(sid, account_id)] = time()

    def clear_removed_service(self, household_id: str, sid: int) -> None:
        """Forget that ``sid`` was removed, once it has been added back."""
        stamps = self.removed_services.get(household_id, {})
        for key in [k for k in stamps if k[0] == sid]:
            del stamps[key]

    def recently_removed(self, household_id: str) -> set[tuple[int, str]]:
        """(service id, account id) pairs removed within REMOVED_GRACE."""
        cutoff = time() - self.REMOVED_GRACE
        stamps = self.removed_services.get(household_id, {})
        for k in [k for k, at in stamps.items() if at < cutoff]:
            del stamps[k]
        return set(stamps)

    def forget_linked_service(self, household_id: str, sid: int) -> None:
        """Drop a Sonora-linked entry, after the household no longer has it."""
        if self.linked_services.get(household_id, {}).pop(sid, None) is not None:
            self._persist_linked()

    def _persist_linked(self) -> None:
        payload = [
            {"household": hid, "sid": s, **meta}
            for hid, svcs in self.linked_services.items()
            for s, meta in svcs.items()
        ]
        try:
            self._linked_file.parent.mkdir(parents=True, exist_ok=True)
            self._linked_file.write_text(json.dumps(payload))
            self._linked_file.chmod(0o600)
        except OSError as exc:
            log.warning("could not persist linked services: %s", exc)

    def household_of(self, uuid: str) -> Household | None:
        for household in self.households.values():
            if uuid in household.zones:
                return household
        return None

    def household_host(self, uuid: str) -> str:
        """A player to answer a household-wide query aimed at ``uuid``.

        Favorites, playlists, the library, alarms, the clock, and the service
        catalog are the household's, so any of its players answers the same.
        The zone's own player is used unless it has just stopped answering, in
        which case another online player of the household stands in rather than
        every list waiting out the timeout (a stalled Play:1 blanked the web
        theme's home for a minute at a time).
        """
        own = self.zone(uuid).host
        if not self.soap.is_silent(own):
            return own
        household = self.household_of(uuid)
        if household is not None:
            for player in household.players.values():
                if player.online and player.host and not self.soap.is_silent(player.host):
                    log.info("%s is not answering; asking %s for the household instead", own, player.host)
                    return player.host
        return own

    def household_hosts(self, uuid: str) -> list[str]:
        """Every player that could answer a household-wide query aimed at
        ``uuid``, in the order to ask them: the zone's own, the household's
        other online players, and last any that have just stopped answering."""
        own = self.zone(uuid).host
        household = self.household_of(uuid)
        others = [p.host for p in (household.players.values() if household else [])
                  if p.online and p.host and p.host != own]
        ordered = [own] + others
        return sorted(dict.fromkeys(ordered), key=self.soap.is_silent)


_URI_LIKE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]+:\S+$")


def _uri_like(text: str) -> bool:
    """Whether a title is really a URI (a scheme, a colon, and no spaces)."""
    return bool(text) and bool(_URI_LIKE.match(text.strip()))


#: The source kinds whose "track" is a broadcast rather than a song.
_RADIO_SOURCES = frozenset({"radio", "service_stream", "service_radio", "service_hls"})


def _named_by_uri(title: str, uri: str) -> bool:
    """Whether a title is nothing but a piece of the URI it came from.

    A player handed a bare stream names the track after the URL's last path
    segment, so a station whose stream ends /stream arrives titled "stream".
    Only whole segments count, so a station really called "Radio Goolarri"
    (with a space, and not in its own URL) is never mistaken for one.
    """
    if not title or not uri:
        return False
    parts = {part for part in re.split(r"[/:?&=#]+", uri.casefold()) if part}
    return title.strip().casefold() in parts


def _account_type(sid: int) -> int:
    """The account type Sonos wants for a service, from its browse sid.

    Registrations across this household show ``service_type = sid * 256 + 7``
    without exception, so that relationship is used to register an account.
    """
    return (sid << 8) | 7


def _as_int(value: str, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


#: Re-exported: the api-key header Sonora sends (see const.py).
SONORA_API_KEY = const.SONORA_API_KEY

#: The desktop app's own api key and user agent were tried here on
#: 2026-09-11, with the user's say-so, as the last difference left on the
#: wire. They made no difference: every player refused the share exactly as
#: before. So Sonora does not wear them -- the answer was elsewhere (the
#: credentials are AES-encrypted, see share_elements), and a controller that
#: claims to be the Sonos app would be lying for nothing.
SHARE_ADD_AS_APP = False

def _b64(value: str) -> str:
    """A credential as the players want it in the share DIDL: base64 UTF-8."""
    return base64.b64encode((value or "").encode("utf-8")).decode("ascii")


def share_path(share) -> str:
    """A music-library share as a person wrote it: ``//host/share/folder``.

    A share's id is that path behind an "S:" prefix, and its title is usually
    the same string, but the browse URI the players report is
    ``x-rincon-playlist:RINCON_...#S://host/share`` -- which is what folder
    lists were showing.
    """
    title = (getattr(share, "title", "") or "").strip()
    if title.startswith("//") or title.startswith("\\\\"):
        return title
    ident = (getattr(share, "id", "") or "").strip()
    if "#" in ident:
        ident = ident.rpartition("#")[2]
    if ident.startswith("S:"):
        return ident[2:]
    return title or ident


class Commands:
    """Actions a user interface can invoke, routed to the right speaker.

    Routing is the substance here. Transport commands must reach the group
    coordinator, because a grouped member will either refuse them or, worse,
    quietly break the group. Volume must reach the specific speaker the user
    touched. Grouping is expressed by pointing a member's transport at its
    intended coordinator, which is Sonos' own mechanism rather than a
    dedicated join call.
    """

    def __init__(self, controller: SonosController) -> None:
        self._c = controller
        self._tz_tables: dict[str, list[dict]] = {}
        #: Households whose speakers were told to clear their time server and
        #: kept it anyway; see time_server_fixed.
        self._fixed_time_server: set[str] = set()

    @property
    def soap(self) -> SoapClient:
        return self._c.soap

    # -- transport -----------------------------------------------------------

    async def play(self, zone_uuid: str) -> None:
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(target.host, const.AV_TRANSPORT, "Play",
                             {"InstanceID": 0, "Speed": "1"})

    async def pause(self, zone_uuid: str) -> None:
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(target.host, const.AV_TRANSPORT, "Pause",
                             {"InstanceID": 0})

    async def stop(self, zone_uuid: str) -> None:
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(target.host, const.AV_TRANSPORT, "Stop",
                             {"InstanceID": 0})

    async def next_track(self, zone_uuid: str) -> None:
        """The next track. A UPnP 800 here is what Sonos' own apps read as a
        skip limit reached (SC_NP_ERR_SKIP_LIMIT in the S1 Android app): a
        Sonos Radio station offers Next and then answers it so
        (2026-10-03). The page says so; it is no fault, so it is not logged as
        one, and the key stays live, since a limit lifts again."""
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(target.host, const.AV_TRANSPORT, "Next",
                             {"InstanceID": 0}, quiet_codes=frozenset({"800"}))

    async def previous_track(self, zone_uuid: str) -> None:
        """The track before, or the start of this one when there is none.

        On a queue's first track the speaker has nowhere to go back to and
        answers Previous with 711; play.sonos.com keeps its button live there
        and takes the track back to 0:00, which it did when pressed at 3:00
        of track 1 (2026-09-24).
        """
        target = self._c.coordinator_of(zone_uuid)
        tr = target.transport
        if tr.can_previous is False and tr.can_seek is False:
            # Nothing before and no start to go back to: a Sonos Radio station
            # offers neither, and answered a Previous from a page that still
            # showed the key with 701. Not asked.
            raise SoapFault("701", "Previous is not offered for this source", "AVTransport", "Previous")
        try:
            await self.soap.call(target.host, const.AV_TRANSPORT, "Previous",
                                 {"InstanceID": 0}, quiet_codes=frozenset({"711", "800"}))
        except SoapFault as exc:
            if exc.code != "711":
                raise
            await self.seek_time(zone_uuid, "0:00:00")

    async def seek_time(self, zone_uuid: str, position: str) -> None:
        """Seek within the current track. ``position`` is ``H:MM:SS``."""
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(target.host, const.AV_TRANSPORT, "Seek",
                             {"InstanceID": 0, "Unit": "REL_TIME",
                              "Target": position})
        await self._c.repost_position(target.uuid)

    async def seek_track(self, zone_uuid: str, index: int) -> None:
        """Jump to a queue position. One-based, as Sonos numbers them.

        A room playing a stream has its transport pointed at the stream, and
        a track-number seek there is refused with 701 -- which is what every
        queue row did after a TuneIn station had been playing. The apps point the
        transport back at the queue first, and so does this.
        """
        target = self._c.coordinator_of(zone_uuid)
        state = self._c.zones.get(target.uuid)
        media = state.transport.media_uri if state is not None else ""
        playing = state is not None and state.transport.state in ("PLAYING", "TRANSITIONING")
        switched = not media.startswith("x-rincon-queue:")
        if switched:
            await self.soap.call(target.host, const.AV_TRANSPORT, "SetAVTransportURI",
                                 {"InstanceID": 0,
                                  "CurrentURI": f"x-rincon-queue:{target.uuid}#0",
                                  "CurrentURIMetaData": ""})
        await self.soap.call(target.host, const.AV_TRANSPORT, "Seek",
                             {"InstanceID": 0, "Unit": "TRACK_NR",
                              "Target": index})
        # Handing the transport back to the queue stops it, and the page asks
        # for Play only when the room was not playing already. A room playing
        # a station went quiet on the chosen row where the app plays it,
        # so the switch resumes here.
        if switched and playing:
            await self.soap.call(target.host, const.AV_TRANSPORT, "Play",
                                 {"InstanceID": 0, "Speed": 1})
        await self._c.repost_position(target.uuid)

    async def set_play_mode(self, zone_uuid: str, mode: str) -> None:
        if mode not in const.PLAY_MODES:
            raise ValueError(f"unknown play mode {mode!r}")
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(target.host, const.AV_TRANSPORT, "SetPlayMode",
                             {"InstanceID": 0, "NewPlayMode": mode})

    async def set_crossfade(self, zone_uuid: str, enabled: bool) -> None:
        target = self._c.coordinator_of(zone_uuid)
        try:
            await self.soap.call(target.host, const.AV_TRANSPORT, "SetCrossfadeMode",
                                 {"InstanceID": 0, "CrossfadeMode": enabled})
        except SoapFault as exc:
            # 712: not for what is loaded, whatever the speaker announced.
            # Every page dims the key from here until the source changes.
            if exc.code == "712":
                self._c.crossfade_refused_for(target)
            raise

    async def set_sleep_timer(self, zone_uuid: str, duration: str | None) -> None:
        """Set or clear a sleep timer. ``duration`` is ``H:MM:SS`` or ``None``."""
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "ConfigureSleepTimer",
            {"InstanceID": 0, "NewSleepTimerDuration": duration or ""})

    async def sleep_timer_remaining(self, zone_uuid: str) -> str:
        """``H:MM:SS`` left on the group's sleep timer, or ``""`` with none set."""
        target = self._c.coordinator_of(zone_uuid)
        result = await self.soap.call(
            target.host, const.AV_TRANSPORT, "GetRemainingSleepTimerDuration",
            {"InstanceID": 0})
        return result.args.get("RemainingSleepTimerDuration", "") or ""

    async def save_queue(self, zone_uuid: str, title: str, object_id: str = "") -> dict:
        """Save the group's queue as a Sonos playlist named ``title``.

        With ``object_id`` (an existing ``SQ:n`` playlist) the speakers replace
        that playlist's contents, as the app's "select an existing Sonos
        Playlist to replace" does.
        """
        target = self._c.coordinator_of(zone_uuid)
        result = await self.soap.call(
            target.host, const.AV_TRANSPORT, "SaveQueue",
            {"InstanceID": 0, "Title": title, "ObjectID": object_id or ""})
        return dict(result.args)

    # -- volume --------------------------------------------------------------

    async def set_volume(self, zone_uuid: str, level: int) -> None:
        state = self._c.zone(zone_uuid)
        low, high = const.VOLUME_RANGE
        level = max(low, min(high, int(level)))
        await self.soap.call(state.host, const.RENDERING_CONTROL, "SetVolume",
                             {"InstanceID": 0, "Channel": "Master",
                              "DesiredVolume": level})

    async def adjust_volume(self, zone_uuid: str, delta: int) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(
            state.host, const.RENDERING_CONTROL, "SetRelativeVolume",
            {"InstanceID": 0, "Channel": "Master", "Adjustment": int(delta)})

    async def set_mute(self, zone_uuid: str, muted: bool) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(state.host, const.RENDERING_CONTROL, "SetMute",
                             {"InstanceID": 0, "Channel": "Master",
                              "DesiredMute": muted})

    #: GroupRenderingControl codes the coordinator answers when a member of
    #: the group did not take a change in time (seen 2026-09-05 with a
    #: freshly bonded pair in the group). The rest of the group has changed
    #: and the member catches up on its own, so this is not a refusal to
    #: report; the volume events set the interface straight.
    GROUP_PARTIAL = {"801", "803"}

    async def set_group_volume(self, zone_uuid: str, level: int) -> None:
        """Set a group's volume, which Sonos scales across its members.

        The coordinator scales members against a *snapshot* of their relative
        levels, and uses whatever snapshot it last took (from the grouping, or
        a power cycle) unless told to take a fresh one. Measured 2026-09-05:
        without a snapshot a one-point raise moved one room 13 -> 18 and the
        other 5 -> 2; with one, both moved with the group. The official
        controllers snapshot before adjusting, so this does too.
        """
        target = self._c.coordinator_of(zone_uuid)
        try:
            await self.soap.call(target.host, const.GROUP_RENDERING_CONTROL,
                                 "SnapshotGroupVolume", {"InstanceID": 0})
            await self.soap.call(
                target.host, const.GROUP_RENDERING_CONTROL, "SetGroupVolume",
                {"InstanceID": 0, "DesiredVolume": max(0, min(100, int(level)))},
                quiet_codes=self.GROUP_PARTIAL)
        except SoapFault as exc:
            if exc.code not in self.GROUP_PARTIAL:
                raise
            log.info("group volume on %s applied partially (UPnP %s); a member lagged",
                     target.name, exc.code)

    async def set_group_mute(self, zone_uuid: str, muted: bool) -> None:
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(
            target.host, const.GROUP_RENDERING_CONTROL, "SetGroupMute",
            {"InstanceID": 0, "DesiredMute": muted})

    # -- tone and output -----------------------------------------------------

    async def set_bass(self, zone_uuid: str, value: int) -> None:
        await self._set_eq_scalar(zone_uuid, "SetBass", "DesiredBass",
                                  value, const.BASS_RANGE)

    async def set_treble(self, zone_uuid: str, value: int) -> None:
        await self._set_eq_scalar(zone_uuid, "SetTreble", "DesiredTreble",
                                  value, const.TREBLE_RANGE)

    async def _set_eq_scalar(self, zone_uuid: str, action: str, argument: str,
                             value: int, bounds: tuple[int, int]) -> None:
        state = self._c.zone(zone_uuid)
        low, high = bounds
        await self.soap.call(
            state.host, const.RENDERING_CONTROL, action,
            {"InstanceID": 0, argument: max(low, min(high, int(value)))})

    async def set_loudness(self, zone_uuid: str, enabled: bool) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(state.host, const.RENDERING_CONTROL, "SetLoudness",
                             {"InstanceID": 0, "Channel": "Master",
                              "DesiredLoudness": enabled})

    #: The RenderingControl EQ types the home-theater products and line-in
    #: devices expose (GetEQ/SetEQ): on/off flags and levels.
    EQ_TYPES = ("NightMode", "DialogLevel", "SubEnable", "SubGain", "SubPolarity", "SurroundEnable",
                "SurroundLevel", "MusicSurroundLevel", "SurroundMode", "AudioDelayLeftRear",
                "AudioDelayRightRear", "AudioDelay", "HeightChannelLevel", "SpeechEnhanceEnabled")

    async def room_settings(self, zone_uuid: str) -> dict:
        """Everything a room's settings page can show beyond bass/treble: the
        EQ types the device answers for, its line-in level and name, and its
        autoplay setup. Absent keys mean the device has no such setting."""
        state = self._c.zone(zone_uuid)
        household = self._c.household_of(zone_uuid)
        zone: Zone | None = household.zones.get(zone_uuid) if household else None
        roles = {p.bonded_role for p in (zone.players if zone else []) if p.bonded_role}
        # Every player answers GetEQ for a sub or surrounds it does not have;
        # only the bonded roles say which settings are real.
        wanted = [t for t in self.EQ_TYPES
                  if (not t.startswith("Sub") or "SW" in roles)
                  and (not t.startswith(("Surround", "MusicSurround", "AudioDelayLeft", "AudioDelayRight"))
                       or roles & {"LR", "RR"})]
        # Every S2 player answers HeightChannelLevel too, 0, the Roam 2 and the
        # Ray as well as the Arc Ultra (measured 2026-10-05); what tells them
        # apart is the speaker's own feature list, where only a player with
        # height drivers declares HEIGHT_CHANNEL_TUNING.
        if "HEIGHT_CHANNEL_TUNING" not in await self._c.device_features(zone_uuid):
            wanted.remove("HeightChannelLevel")
        if not self._has_speech_switch(state):
            wanted.remove("SpeechEnhanceEnabled")
        out: dict = {"eq": {}}
        for eq_type in wanted:
            # Asking is how a type is found out: a player without it answers
            # 402, which is the expected answer and not worth a warning (a
            # Play:1 and a Connect filled the log with four apiece each time
            # their settings opened).
            try:
                result = await self.soap.call(state.host, const.RENDERING_CONTROL, "GetEQ",
                                              {"InstanceID": 0, "EQType": eq_type},
                                              quiet_codes=frozenset({"402"}))
                out["eq"][eq_type] = int(result.get("CurrentValue", "0") or 0)
            except Exception:
                continue
        # An Arc Ultra has speech enhancement as a switch, SpeechEnhanceEnabled,
        # with DialogLevel as its strength; older players have DialogLevel
        # alone, as the switch. The panes know one speech switch, DialogLevel,
        # so on a player with the separate switch that is what it reports, and
        # set_eq writes the switch for it. Reading DialogLevel as the switch
        # there let speech enhancement be turned on and never off: 0 is not a
        # strength, and the level stayed at 1.
        if "SpeechEnhanceEnabled" in out["eq"]:
            out["speech_level"] = out["eq"].get("DialogLevel")
            out["speech_max"] = state.speech_max
            out["eq"]["DialogLevel"] = out["eq"].pop("SpeechEnhanceEnabled")
        if state.supports_line_in:
            try:
                level = await self.soap.call(state.host, const.AUDIO_IN, "GetLineInLevel")
                out["line_in_level"] = int(level.get("CurrentLeftLineInLevel", "0") or 0)
                attrs = await self.soap.call(state.host, const.AUDIO_IN, "GetAudioInputAttributes")
                out["line_in_name"] = attrs.get("CurrentName", "")
                out["line_in_icon"] = attrs.get("CurrentIcon", "")
            except Exception:
                pass
        # The status light, read so a room's settings can show it as a
        # switch in its real position rather than as a pair of buttons.
        try:
            led = await self.soap.call(state.host, const.DEVICE_PROPERTIES, "GetLEDState")
            out["status_light"] = led.get("CurrentLEDState", "") == "On"
        except Exception:
            pass
        await self._read_hardware_settings(zone_uuid, state, out)
        # Autoplay is what a player does when sound arrives at its line-in socket: which room
        # plays it, grouped or not, at what volume. Every player answers the four reads, a
        # Play:1 with no socket included, so a successful read says nothing; only a player
        # with the AudioIn service is asked, and only it shows the settings.
        if not state.supports_line_in:
            return out
        try:
            room = await self.soap.call(state.host, const.DEVICE_PROPERTIES, "GetAutoplayRoomUUID", {"Source": ""})
            out["autoplay_room"] = room.get("RoomUUID", "")
            linked = await self.soap.call(state.host, const.DEVICE_PROPERTIES, "GetAutoplayLinkedZones", {"Source": ""})
            out["autoplay_linked"] = linked.get("IncludeLinkedZones", "0") == "1"
            use = await self.soap.call(state.host, const.DEVICE_PROPERTIES, "GetUseAutoplayVolume", {"Source": ""})
            out["autoplay_use_volume"] = use.get("UseVolume", "0") == "1"
            vol = await self.soap.call(state.host, const.DEVICE_PROPERTIES, "GetAutoplayVolume", {"Source": ""})
            out["autoplay_volume"] = int(vol.get("CurrentVolume", "0") or 0)
        except Exception:
            pass
        return out

    async def _read_hardware_settings(self, zone_uuid: str, state, out: dict) -> None:
        """The settings beyond sound that the Sonos app offers on a player's
        own page: touch controls, Trueplay, and on a home theater player its
        TV autoplay and IR. Each is asked for only where the player declares
        the hardware behind it, since every player answers these reads."""
        rc, dp, ht = const.RENDERING_CONTROL, const.DEVICE_PROPERTIES, const.HT_CONTROL
        capabilities = await self._c.device_capabilities(zone_uuid)
        features = await self._c.device_features(zone_uuid)
        try:
            lock = await self.soap.call(state.host, dp, "GetButtonLockState")
            out["button_lock"] = lock.get("CurrentButtonLockState", "") == "On"
        except Exception:
            pass
        # Trueplay can be switched off and on only once the room has a tuning.
        try:
            cal = await self.soap.call(state.host, rc, "GetRoomCalibrationStatus", {"InstanceID": 0})
            if cal.get("RoomCalibrationAvailable") == "1":
                out["trueplay"] = cal.get("RoomCalibrationEnabled") == "1"
        except Exception:
            pass
        if "HT_PLAYBACK" in capabilities:
            # TV autoplay is the line-in autoplay with the TV as its source: the
            # room is this one or none, and "ungroup" is the inverse of
            # including the grouped rooms.
            try:
                room = await self.soap.call(state.host, dp, "GetAutoplayRoomUUID", {"Source": "TV"})
                out["tv_autoplay"] = bool(room.get("RoomUUID"))
                linked = await self.soap.call(state.host, dp, "GetAutoplayLinkedZones", {"Source": "TV"})
                out["tv_autoplay_ungroup"] = linked.get("IncludeLinkedZones", "0") != "1"
            except Exception:
                pass
        if "IR_CONTROL" in capabilities:
            try:
                light = await self.soap.call(state.host, ht, "GetLEDFeedbackState")
                out["ir_light"] = light.get("LEDFeedbackState", "") == "On"
            except Exception:
                pass
        if "IR_TRANSMITTER" in features:
            try:
                rep = await self.soap.call(state.host, ht, "GetIRRepeaterState")
                out["ir_repeater"] = rep.get("CurrentIRRepeaterState", "") == "On"
            except Exception:
                pass

    async def set_speech_level(self, zone_uuid: str, level: int) -> None:
        """The strength of speech enhancement on a player that keeps it apart
        from the switch: 1 low to 3 high, 4 max where the player offers it."""
        state = self._c.zone(zone_uuid)
        if not self._has_speech_switch(state) or not 1 <= level <= (4 if state.speech_max else 3):
            raise ValueError(level)
        await self.soap.call(state.host, const.RENDERING_CONTROL, "SetEQ",
                             {"InstanceID": 0, "EQType": "DialogLevel", "DesiredValue": level})

    async def set_tv_autoplay(self, zone_uuid: str, on: bool | None = None, ungroup: bool | None = None) -> None:
        state = self._c.zone(zone_uuid)
        dp = const.DEVICE_PROPERTIES
        if on is not None:
            await self.soap.call(state.host, dp, "SetAutoplayRoomUUID",
                                 {"RoomUUID": zone_uuid if on else "", "Source": "TV"})
            # As in the Sonos app, turning autoplay off puts the grouped
            # rooms back in.
            if not on:
                ungroup = False
        if ungroup is not None:
            await self.soap.call(state.host, dp, "SetAutoplayLinkedZones",
                                 {"IncludeLinkedZones": "0" if ungroup else "1", "Source": "TV"})

    async def set_ir(self, zone_uuid: str, light: bool | None = None, repeater: bool | None = None) -> None:
        state = self._c.zone(zone_uuid)
        if light is not None:
            await self.soap.call(state.host, const.HT_CONTROL, "SetLEDFeedbackState",
                                 {"LEDFeedbackState": "On" if light else "Off"})
        if repeater is not None:
            await self.soap.call(state.host, const.HT_CONTROL, "SetIRRepeaterState",
                                 {"DesiredIRRepeaterState": "On" if repeater else "Off"})

    async def set_trueplay(self, zone_uuid: str, on: bool) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(state.host, const.RENDERING_CONTROL, "SetRoomCalibrationStatus",
                             {"InstanceID": 0, "RoomCalibrationEnabled": "1" if on else "0"})

    async def set_eq(self, zone_uuid: str, eq_type: str, value: int) -> None:
        if eq_type not in self.EQ_TYPES:
            raise ValueError(eq_type)
        state = self._c.zone(zone_uuid)
        # The speech switch, on a player that keeps it apart from its level
        # (see room_settings).
        if eq_type == "DialogLevel" and self._has_speech_switch(state):
            eq_type = "SpeechEnhanceEnabled"
            value = 1 if value else 0
        await self.soap.call(state.host, const.RENDERING_CONTROL, "SetEQ",
                             {"InstanceID": 0, "EQType": eq_type, "DesiredValue": value})

    @staticmethod
    def _has_speech_switch(state) -> bool:
        return (state.model_number or "").upper() in SPEECH_SWITCH_MODELS

    async def set_line_in(self, zone_uuid: str, level: int | None = None, name: str | None = None) -> None:
        state = self._c.zone(zone_uuid)
        if level is not None:
            await self.soap.call(state.host, const.AUDIO_IN, "SetLineInLevel",
                                 {"DesiredLeftLineInLevel": level, "DesiredRightLineInLevel": level})
        if name is not None:
            attrs = await self.soap.call(state.host, const.AUDIO_IN, "GetAudioInputAttributes")
            await self.soap.call(state.host, const.AUDIO_IN, "SetAudioInputAttributes",
                                 {"DesiredName": name, "DesiredIcon": attrs.get("CurrentIcon", "")})

    async def set_autoplay(self, zone_uuid: str, room: str | None = None, linked: bool | None = None,
                           use_volume: bool | None = None, volume: int | None = None) -> None:
        state = self._c.zone(zone_uuid)
        if room is not None:
            await self.soap.call(state.host, const.DEVICE_PROPERTIES, "SetAutoplayRoomUUID", {"RoomUUID": room, "Source": ""})
        if linked is not None:
            await self.soap.call(state.host, const.DEVICE_PROPERTIES, "SetAutoplayLinkedZones", {"IncludeLinkedZones": 1 if linked else 0, "Source": ""})
        if use_volume is not None:
            await self.soap.call(state.host, const.DEVICE_PROPERTIES, "SetUseAutoplayVolume", {"UseVolume": 1 if use_volume else 0, "Source": ""})
        if volume is not None:
            await self.soap.call(state.host, const.DEVICE_PROPERTIES, "SetAutoplayVolume", {"Volume": volume, "Source": ""})

    async def set_balance(self, zone_uuid: str, value: int) -> None:
        """Balance on a stereo pair, from -100 (left) to 100 (right).

        Sonos has no balance argument. It is expressed as the two channels'
        relative volumes, so the pair is driven by attenuating one side.
        """
        state = self._c.zone(zone_uuid)
        low, high = const.BALANCE_RANGE
        value = max(low, min(high, int(value)))
        left = 100 if value <= 0 else 100 - value
        right = 100 if value >= 0 else 100 + value
        for channel, level in (("LF", left), ("RF", right)):
            await self.soap.call(
                state.host, const.RENDERING_CONTROL, "SetVolume",
                {"InstanceID": 0, "Channel": channel, "DesiredVolume": level})

    # -- grouping ------------------------------------------------------------

    async def join(self, zone_uuid: str, coordinator_uuid: str) -> None:
        """Add a zone to another zone's group.

        Sonos expresses this by pointing the joining player's transport at the
        coordinator. It starts audio on the joining speaker whenever the group
        is already playing, which is why it sits in the audio tier.
        """
        state = self._c.zone(zone_uuid)
        target = self._c.zone(coordinator_uuid)
        await self.soap.call(
            state.host, const.AV_TRANSPORT, "SetAVTransportURI",
            {"InstanceID": 0,
             "CurrentURI": f"x-rincon:{target.uuid}",
             "CurrentURIMetaData": ""})

    async def unjoin(self, zone_uuid: str) -> None:
        """Remove a zone from its group, leaving it standalone and stopped."""
        state = self._c.zone(zone_uuid)
        await self.soap.call(
            state.host, const.AV_TRANSPORT,
            "BecomeCoordinatorOfStandaloneGroup", {"InstanceID": 0})

    async def delegate(self, coordinator_uuid: str, heir_uuid: str) -> None:
        """Hand a group's lead, and its music, to another member, and leave.

        The S1 app's Group Rooms does this when the room it was opened from is
        unticked but others in its group stay ticked: they carry on with the
        music and the opening room drops out (measured 2026-09-23).
        """
        state = self._c.coordinator_of(coordinator_uuid)
        await self.soap.call(
            state.host, const.AV_TRANSPORT, "DelegateGroupCoordinationTo",
            {"InstanceID": 0, "NewCoordinator": heir_uuid, "RejoinGroup": 0})

    async def group_all(self, coordinator_uuid: str) -> None:
        """Gather every zone in the household onto one coordinator."""
        household = self._c.household_of(coordinator_uuid)
        if household is None:
            raise KeyError(f"unknown zone {coordinator_uuid}")
        for zone in household.visible_zones:
            if zone.uuid == coordinator_uuid:
                continue
            await self.join(zone.uuid, coordinator_uuid)

    # -- queue ---------------------------------------------------------------

    async def clear_queue(self, zone_uuid: str) -> None:
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "RemoveAllTracksFromQueue",
            {"InstanceID": 0})

    async def reorder_queue(self, zone_uuid: str, start: int, count: int, insert_before: int) -> None:
        """Move ``count`` tracks from 1-based ``start`` to sit before 1-based
        ``insert_before`` (AVTransport#ReorderTracksInQueue)."""
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "ReorderTracksInQueue",
            {"InstanceID": 0, "StartingIndex": start, "NumberOfTracks": count,
             "InsertBefore": insert_before, "UpdateID": 0})

    async def remove_from_queue(self, zone_uuid: str, index: int) -> None:
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "RemoveTrackFromQueue",
            {"InstanceID": 0, "ObjectID": f"Q:0/{index}", "UpdateID": 0})

    async def add_to_queue(
        self, zone_uuid: str, uri: str, metadata: str = "",
        *, next_: bool = False, position: int = 0,
    ) -> dict:
        """Put something in a room's queue.

        ``position`` is the 1-based place the item should land in, which is
        what a drop between two rows asks for; 0 means the end, as the
        firmware reads it.
        """
        target = self._c.coordinator_of(zone_uuid)
        result = await self.soap.call(
            target.host, const.AV_TRANSPORT, "AddURIToQueue",
            {"InstanceID": 0,
             "EnqueuedURI": uri,
             "EnqueuedURIMetaData": metadata,
             "DesiredFirstTrackNumberEnqueued": max(0, position),
             "EnqueueAsNext": next_},
            # A whole album or playlist takes a player a while to take in, and
            # this is not retried (soap.ONCE_ONLY), so it is given time.
            timeout=20.0)
        return dict(result.args)

    async def add_oauth_account(self, zone_uuid: str, sid: int, token: str,
                                key: str, device_id: str) -> dict:
        """Store a linked service account on the household.

        The token and key come from the provider after the person signed in
        there; the speakers keep them and use them for every later request.

        ``AccountType`` is the service *type*, not the browse sid: every
        configured service on this household follows ``type = sid * 256 + 7``,
        and passing the bare sid is what a UPnP 402 "Invalid arguments" answers.

        The X means encrypted, as it does on ``SetAccountNicknameX``: the
        token, the key and the device id travel sealed under the household
        cipher. Sent in the clear, every shape was refused with 402 and this
        looked locked down; sealed, a probe with no such service got past
        the argument check to 809 (2026-09-28). Sealing the token and key but
        not the device id is still 402.
        """
        state = self._c.zone(zone_uuid)
        household = self._c.household_of(zone_uuid)
        if household is None:
            raise ValueError("that room is in no household, so there is no cipher to seal with")
        hid = household.id
        result = await self.soap.call(
            state.host, const.SYSTEM_PROPERTIES, "AddOAuthAccountX",
            {"AccountType": _account_type(sid),
             "AccountToken": seal(token, hid), "AccountKey": seal(key, hid),
             "OAuthDeviceID": seal(device_id, hid), "AuthorizationCode": "",
             "RedirectURI": "", "UserIdHashCode": "", "AccountTier": 0})
        return dict(result.args)

    async def replace_oauth_account(self, zone_uuid: str, udn: str, token: str,
                                    key: str, device_id: str) -> dict:
        """Give an account the household already has a new login, in place.

        ``ReplaceAccountX`` keeps the account's UDN and serial number, so the
        Favorites and playlists saved against it go on playing; removing it
        and adding it again gives it a new serial, and they stop. This is the
        Sonos app's Reauthorize. Every argument but the out-argument
        NewAccountUDN is sealed like AddOAuthAccountX's; the logon string and
        password are empty for an OAuth service. The idea came from a SoCo
        fork's onboarding module (SoCo, MIT); the argument list is the one
        the speakers' own SystemProperties1.xml publishes, S1 and S2 alike
        (2026-10-05).
        """
        state = self._c.zone(zone_uuid)
        household = self._c.household_of(zone_uuid)
        if household is None:
            raise ValueError("that room is in no household, so there is no cipher to seal with")
        hid = household.id
        result = await self.soap.call(
            state.host, const.SYSTEM_PROPERTIES, "ReplaceAccountX",
            {"AccountUDN": seal(udn, hid), "NewAccountID": "", "NewAccountPassword": "",
             "AccountToken": seal(token, hid), "AccountKey": seal(key, hid),
             "OAuthDeviceID": seal(device_id, hid)})
        return dict(result.args)

    async def add_anonymous_account(self, zone_uuid: str, sid: int) -> dict:
        """Add a service that needs no account at all."""
        state = self._c.zone(zone_uuid)
        result = await self.soap.call(
            state.host, const.SYSTEM_PROPERTIES, "AddAccountX",
            {"AccountType": _account_type(sid), "AccountID": "",
             "AccountPassword": ""})
        return dict(result.args)

    async def remove_account(self, zone_uuid: str, sid: int,
                             account_id: str = "") -> dict:
        """Take a service's account off the household.

        What the desktop app's Service Settings "Remove" button does: one
        ``SystemProperties#RemoveAccount`` with the service's account type and
        the account id the registration list reports (empty for an anonymous
        service). The speakers apply it household-wide, so every app sees the
        service go.
        """
        state = self._c.zone(zone_uuid)
        result = await self.soap.call(
            state.host, const.SYSTEM_PROPERTIES, "RemoveAccount",
            {"AccountType": _account_type(sid), "AccountID": account_id})
        return dict(result.args)

    async def rename_account(self, zone_uuid: str, account_udn: str,
                             nickname: str) -> dict:
        """Rename a service account, as Service Settings' "Edit" does.

        The ``X`` on ``SetAccountNicknameX`` means what it means on a share's
        ``r:usernameX``: both arguments travel sealed under the household
        cipher. Sent in the clear -- in either argument order, to any player,
        with or without the app's own headers -- the firmware answers 402, so
        this looked for a long time like an argument the action did not want.
        The desktop app renaming an account, read off the wire, sends
        ``2:``-tagged ciphertext for the UDN as well as the name.
        """
        household = self._c.household_of(zone_uuid)
        if household is None:
            raise ValueError(f"{zone_uuid} is not in a known household")
        # The name is the household's, so any player takes it: the room's
        # own when it answers, another when it has gone quiet (a rename from
        # Preferences went to an unreachable player and hung).
        result = await self.soap.call(
            self._household_host(zone_uuid), const.SYSTEM_PROPERTIES, "SetAccountNicknameX",
            {"AccountUDN": seal(account_udn, household.id),
             "AccountNickname": seal(nickname, household.id)})
        return dict(result.args)

    async def set_source(self, zone_uuid: str, uri: str,
                         metadata: str = "") -> None:
        """Point a group at a source directly, bypassing the queue.

        Used for radio, line-in and television, none of which are queueable.
        """
        target = self._c.coordinator_of(zone_uuid)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "SetAVTransportURI",
            {"InstanceID": 0, "CurrentURI": uri,
             "CurrentURIMetaData": metadata})

    async def play_line_in(self, zone_uuid: str,
                           source_uuid: str | None = None) -> None:
        """Switch a zone to a line-in source, its own by default."""
        state = self._c.zone(zone_uuid)
        source = source_uuid or state.uuid
        await self.set_source(zone_uuid, f"x-rincon-stream:{source}")

    async def play_tv(self, zone_uuid: str) -> None:
        """Switch a soundbar to its television input."""
        state = self._c.zone(zone_uuid)
        await self.set_source(zone_uuid, f"x-sonos-htastream:{state.uuid}:spdif")

    # -- zone settings -------------------------------------------------------

    async def rename_zone(self, zone_uuid: str, name: str) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(
            state.host, const.DEVICE_PROPERTIES, "SetZoneAttributes",
            {"DesiredZoneName": name, "DesiredIcon": "", "DesiredConfiguration": ""})

    # -- date and time -------------------------------------------------------
    #
    # Kept by the household: any player answers for all of them, and a change
    # made through one propagates. The desktop app's Date and Time Settings
    # pane is built on these AlarmClock actions.

    #: Sonos' default NTP pool, what "set the time from the Internet" selects.
    DEFAULT_TIME_SERVER = ("0.sonostime.pool.ntp.org,1.sonostime.pool.ntp.org,"
                           "2.sonostime.pool.ntp.org,3.sonostime.pool.ntp.org")

    # -- content filtering ---------------------------------------------------

    async def content_filtering(self, zone_uuid: str) -> dict:
        """Whether the household filters explicit content.

        The setting belongs to the household, so any of its players answers
        the same value; the zone's own player is asked first and another
        stands in when it is not answering.
        """
        text, host = await self._c.read_household_setting(
            self._c.household_hosts(zone_uuid), EXPLICIT_FILTERING)
        return self._note_filtering(zone_uuid, text, host)

    def _note_filtering(self, zone_uuid: str, text: str, host: str) -> dict:
        """Record what the speaker said, so browsing carries the same value."""
        on = HouseholdSettings.read_bool_text(text)
        household = self._c.household_of(zone_uuid)
        self._c.note_filtering(household.id if household else "", on)
        return {"filtering": on, "raw": text, "player": host,
                "changeable": hhsettings.CAN_WRITE}

    async def set_content_filtering(self, zone_uuid: str, on: bool) -> dict:
        """Turn the household's filter on or off.

        Written to one player, which replicates it to the rest; the write is
        offered to the household's other players if the first will not take
        it. The value is read back afterwards, from a different player where
        there is one, so the answer is the household's rather than this
        call's own optimism.
        """
        household = self._c.household_of(zone_uuid)
        hosts = [self._c.household_host(zone_uuid)]
        if household is not None:
            hosts += [p.host for p in household.players.values()
                      if p.online and p.host and not p.invisible
                      and p.host not in hosts]
        last: Exception | None = None
        refused = 0
        for host in hosts:
            try:
                await self._c.hhsettings.write_bool(host, EXPLICIT_FILTERING, on)
            except SettingsUnauthorized as exc:
                last, refused = exc, refused + 1
                continue
            except SettingsError as exc:
                last = exc
                log.info("content filtering: %s would not take it (%s)", host, exc)
                continue
            log.info("content filtering set to %s via %s", on, host)
            for reader in hosts[1:] + hosts[:1]:
                try:
                    text = await self._c.hhsettings.read(reader, EXPLICIT_FILTERING)
                except SettingsError:
                    continue
                return self._note_filtering(zone_uuid, text, host)
            return self._note_filtering(zone_uuid, "true" if on else "false", host)
        if refused and refused == len(hosts):
            raise SettingsUnauthorized(
                "This system does not allow its content filtering to be "
                "changed: the speakers ask for a credential of their own, "
                "and the Sonos command for it is not implemented on their "
                "software.")
        raise last or SettingsError("no player would take the setting")

    async def time_settings(self, zone_uuid: str) -> dict:
        """The household's time zone, clock, time source, and display formats."""
        host = self._c.household_host(zone_uuid)
        tz = (await self.soap.call(host, const.ALARM_CLOCK, "GetTimeZone")).args
        now = (await self.soap.call(host, const.ALARM_CLOCK, "GetTimeNow")).args
        server = (await self.soap.call(host, const.ALARM_CLOCK, "GetTimeServer")).args
        fmt = (await self.soap.call(host, const.ALARM_CLOCK, "GetFormat")).args
        return {
            "index": int(tz.get("Index", 0) or 0),
            "auto_dst": tz.get("AutoAdjustDst", "0") == "1",
            "utc": now.get("CurrentUTCTime", ""),
            "local": now.get("CurrentLocalTime", ""),
            "rule": now.get("CurrentTimeZone", ""),
            "server": server.get("CurrentTimeServer", ""),
            "server_fixed": self.time_server_fixed(zone_uuid),
            # "INV" is what the firmware reports before a format is chosen.
            "time_format": fmt.get("CurrentTimeFormat", ""),
            "date_format": fmt.get("CurrentDateFormat", ""),
            "zones": await self.time_zone_table(zone_uuid),
        }

    async def time_zone_table(self, zone_uuid: str) -> list[dict]:
        """The speaker's time-zone table: index, UTC offset and whether DST applies.

        The firmware holds a fixed list (75 entries on 11.x) addressed by index
        in SetTimeZone; each entry is a rule string whose first two bytes are
        the offset in minutes west of UTC and whose middle is the DST rule, all
        zero where none applies. Read once per household and kept.
        """
        host = self._c.household_host(zone_uuid)
        cached = self._tz_tables.get(host)
        if cached is not None:
            return cached
        table: list[dict] = []
        for index in range(0, 128):
            try:
                rule = (await self.soap.call(
                    host, const.ALARM_CLOCK, "GetTimeZoneRule",
                    {"Index": index})).args.get("TimeZone", "")
            except Exception:
                break
            # Past the end the firmware answers an all-zero rule (or repeats).
            if not rule or rule == "0" * len(rule) or (table and rule == table[-1]["rule"]
                                                      and index > 60 and rule.endswith("0000")):
                break
            west = int(rule[0:4], 16)
            if west >= 0x8000:
                west -= 0x10000
            table.append({"index": index, "rule": rule, "offset": -west,
                          "dst": rule[4:24] != "0" * 20})
        self._tz_tables[host] = table
        return table

    def _household_host(self, zone_uuid: str) -> str:
        """Where to send a change the whole household shares -- a favorite, a
        playlist, a saved station, a share, the clock -- which any player can
        make. The room's own speaker unless it has stopped answering, then
        another: a playlist deleted from a page whose room's speaker was
        unreachable waited 26 seconds and failed."""
        state = self._c.zone(zone_uuid)
        silent = getattr(self.soap, "is_silent", None)
        quiet = not getattr(state, "online", True) or (silent is not None and silent(state.host))
        if not quiet:
            return state.host
        household = self._c.household_of(zone_uuid)
        return (self._c.any_host(household) if household is not None else None) or state.host

    async def set_time_zone(self, zone_uuid: str, index: int, auto_dst: bool) -> None:
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.ALARM_CLOCK, "SetTimeZone",
                             {"Index": int(index), "AutoAdjustDst": 1 if auto_dst else 0})

    def time_server_fixed(self, zone_uuid: str) -> bool:
        """Whether this household's clock always follows the Internet.

        An S2 speaker answers ``SetTimeServer`` with an empty server as a
        success and keeps its server all the same (seen 2026-09-30 on 17.x:
        "Set the date and time from the Internet" switched off, and the next
        read had it back on). The S2 apps offer no such switch at all. So S2
        is taken to be fixed, and any other household that is seen to ignore
        the change is remembered as fixed too.
        """
        state = self._c.zone(zone_uuid)
        household = self._c.household_of(zone_uuid)
        learned = household is not None and household.id in self._fixed_time_server
        return learned or getattr(state, "generation", "") == "S2"

    async def set_time_server(self, zone_uuid: str, server: str) -> None:
        """Point the clock at NTP (Sonos' pool by default) or, empty, at nothing."""
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.ALARM_CLOCK, "SetTimeServer",
                             {"DesiredTimeServer": server})
        if server:
            return
        kept = (await self.soap.call(host, const.ALARM_CLOCK, "GetTimeServer")).args.get("CurrentTimeServer", "")
        household = self._c.household_of(zone_uuid)
        if kept and household is not None:
            self._fixed_time_server.add(household.id)

    #: What ``SetTimeNow`` takes for the time: the firmware's own
    #: ``CurrentLocalTime`` shape, a space between date and time. The ISO
    #: ``T`` is refused (402), as is anything shorter.
    _LOCAL_TIME = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")

    async def set_time_now(self, zone_uuid: str, local_time: str, tz_index: int) -> None:
        """Set the clock by hand: ``YYYY-MM-DD HH:MM:SS`` in the given zone.

        ``TimeZoneForDesiredTime`` is the zone's *rule string* (the
        ``A_ARG_TYPE_TimeZoneInformation`` that ``GetTimeZoneRule`` answers for
        the index), not the index: the index is refused with 402, and an empty
        rule is accepted but reads the time as UTC, which put a household seven
        hours out while this was being worked out (2026-09-14, S1 and S2 both).
        """
        if not self._LOCAL_TIME.match(local_time):
            raise ValueError("the time must be YYYY-MM-DD HH:MM:SS")
        try:
            datetime.strptime(local_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            raise ValueError(f"{local_time} is not a real date and time") from None
        host = self._household_host(zone_uuid)
        rule = next((z["rule"] for z in await self.time_zone_table(zone_uuid)
                     if z["index"] == int(tz_index)), "")
        if not rule:
            raise ValueError(f"no time zone at index {tz_index}")
        await self.soap.call(host, const.ALARM_CLOCK, "SetTimeNow",
                             {"DesiredTime": local_time, "TimeZoneForDesiredTime": rule})

    async def set_time_format(self, zone_uuid: str, time_format: str, date_format: str) -> None:
        """``12H``/``24H`` and ``MDY``/``DMY``/``YMD``, as the firmware names them."""
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.ALARM_CLOCK, "SetFormat",
                             {"DesiredTimeFormat": time_format, "DesiredDateFormat": date_format})

    # -- music library -------------------------------------------------------
    #
    # The Music Library Settings pane: the shared folders the household indexes,
    # the index itself (rebuild now, or nightly), and how compilations are
    # grouped. Shares are children of the ContentDirectory container "S:".

    _DIDL_NS = ('xmlns:dc="http://purl.org/dc/elements/1.1/" '
                'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
                'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
                'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"')

    async def library_settings(self, zone_uuid: str) -> dict:
        host = self._c.household_host(zone_uuid)
        shares = await self._c.content.shares(host)
        # This player's own answer, and what any other player of the
        # household has published: only the one doing the work says yes.
        indexing = (await self._c.content.share_index_state(host)).get("IsIndexing") == "1"
        household = self._c.household_of(zone_uuid)
        if household is not None and self._c.household_indexing(household.id):
            indexing = True
        option = (await self.soap.call(host, const.CONTENT_DIRECTORY,
                                       "GetAlbumArtistDisplayOption")).args
        daily = (await self.soap.call(host, const.ALARM_CLOCK,
                                      "GetDailyIndexRefreshTime")).args
        listed = [share_path(s) for s in shares]
        return {
            # `uri` is the browse URI the players answer with
            # (x-rincon-playlist:RINCON_...#S://host/share); `path` is the
            # share as a person wrote it, which is what a folder list should
            # show. The id carries it after "S:", and the title is the same
            # thing when the players kept it.
            "shares": [{"id": s.id, "title": s.title, "uri": s.uri,
                        "path": share_path(s)} for s in shares],
            # Shares the players took but have not listed yet. Reading the
            # list is what settles them, so a polling pane is what notices
            # one land.
            "pending_shares": self._c.settle_pending_shares(
                zone_uuid, listed, indexing, self._c.index_error(zone_uuid)),
            "indexing": indexing,
            # Empty unless the household's last index attempt failed. The
            # players publish it on ContentDirectory as ShareIndexLastError.
            "index_error": self._c.index_error(zone_uuid),
            # WMP groups by album artist, ITUNES by the iTunes compilation flag,
            # NONE leaves compilations split by artist.
            "album_artist_option": option.get("AlbumArtistDisplayOption", ""),
            # "" when no nightly update is scheduled.
            "daily_refresh": daily.get("CurrentDailyIndexRefreshTime", ""),
        }

    @staticmethod
    def share_uri(path: str) -> str:
        """``//host/share``, ``\\\\host\\share`` or ``smb://host/share`` as a Sonos share URI."""
        p = path.strip().replace("\\", "/")
        for prefix in ("x-file-cifs://", "smb://", "cifs://"):
            if p.lower().startswith(prefix):
                p = p[len(prefix):]
        p = p.lstrip("/")
        if "/" not in p:
            raise ValueError("a share path needs a host and a folder, like //nas/music")
        return "x-file-cifs://" + p

    async def add_share(self, zone_uuid: str, path: str,
                        username: str = "", password: str = "",
                        album_artist_option: str = "WMP", variant: str = "") -> dict:
        """Add a shared folder to the household's music library.

        ContentDirectory#CreateObject on "S:" with the DIDL the apps send. The
        shape is the one their own library builds (the template is in
        sclib-csharp.dll in both the S1 and the S2 desktop payloads, read
        2026-09-09): a *container*, and credentials in ``r:usernameX`` and
        ``r:passwordX`` rather than in the URI.

        Sonora used to write them into the resource URI's authority
        (``user:password@host``), which the players ignore -- they then mounted
        the share anonymously, and a server that refuses anonymous logins
        dropped the share a moment later with nothing to say why.

        A share with a password goes over the player's TLS port, which is
        where the desktop app sends it (measured 2026-09-10: the app's add is
        a TLS connection to 1443 and there is no CreateObject on 1400 at all).

        The add is offered to the room in view first, and then to the
        household's other players until one takes it. Not every player can
        necessarily reach the file server: on this household every add sent
        through one player came back ``1,<path>`` -- the players' code for
        could not reach or mount it, the same code a nonexistent host gives --
        while the same folder with the same credentials mounted and indexed
        when the request went through another.

        Indexing starts on its own once a player has mounted it.
        """
        uri = self.share_uri(path)
        household = self._c.household_of(zone_uuid)
        elements = self.share_elements(uri, username, password, variant,
                                       household_id=household.id if household else "")
        redacted = re.sub(r"<(r:password[X]?)>.*?</\1>", r"<\1>***</\1>", elements)
        hosts = [self._c.zone(zone_uuid).host]
        if household is not None:
            # Bonded satellites are skipped: Sonora has no event subscription
            # to them, so their ShareIndexLastError never arrives and silence
            # from one reads as success. A stereo pair's second speaker once
            # "took" every share the other players refused.
            hosts += [p.host for p in household.players.values()
                      if p.online and p.host and not p.invisible and p.host not in hosts]
        # The apps address the player by UDN as well as by address, and they
        # name themselves with an api key on every call (read off the wire
        # 2026-09-10). The UDN is plain addressing, so Sonora sends it too;
        # the key is Sonora's own name rather than an app's, since the point
        # is to find out whether the firmware wants the header at all.
        udns = {}
        if household is not None:
            udns = {p.host: f"uuid:{uuid}" for uuid, p in household.players.items() if p.host}

        args: dict = {}
        for attempt, host in enumerate(hosts):
            log.info("add share on %s (%s): %s", host,
                     "tls" if password else "plain", redacted)
            self._c.clear_index_error(zone_uuid)
            extra = {"X-Sonos-Api-Key": SONORA_API_KEY}
            if udns.get(host):
                extra["X-SONOS-TARGET-UDN"] = udns[host]
            try:
                # "http" in the variant forces the plain port, to find out
                # whether the firmware treats the two channels differently.
                over_tls = bool(password) and "http" not in variant
                result = await self.soap.call(
                    host, const.CONTENT_DIRECTORY, "CreateObject",
                    {"ContainerID": "S:", "Elements": elements}, secure=over_tls,
                    extra_headers=extra)
            except Exception as exc:
                if not password:
                    raise
                # Older players have no TLS port; the plain one is all they have.
                log.info("add share: TLS refused on %s (%s); using 1400", host, exc)
                try:
                    result = await self.soap.call(
                        host, const.CONTENT_DIRECTORY, "CreateObject",
                        {"ContainerID": "S:", "Elements": elements}, extra_headers=extra)
                except Exception as plain_exc:
                    # A player that reads the login and then cannot mount the
                    # folder says so here rather than through the evented
                    # error: an S1 player answered UPnP 900 to a share on a
                    # server it has no SMBv1 to reach (2026-09-11), and an S2
                    # one answered 907 for a folder that is not there. Both
                    # are this player refusing this share, so treat them as
                    # such and offer it to the next player instead of letting
                    # the whole request fail.
                    refusal = str(plain_exc)
                    log.info("add share: %s would not take it (%s)", host, refusal)
                    continue
            args = dict(result.args)
            log.info("add share answered by %s: %s", host,
                     {k: v for k, v in args.items() if k != "Result"})
            # And then ask the same player to index, which is what the desktop
            # app does: its add is two TLS calls a second apart, the second one
            # small enough to be a bare action with no payload, and its UI goes
            # straight to "Updating Music Library" (measured 2026-09-10).
            # Without it the players take the share and drop it again.
            try:
                await self.soap.call(host, const.CONTENT_DIRECTORY, "RefreshShareIndex",
                                     {"AlbumArtistDisplayOption": album_artist_option},
                                     secure=over_tls)
                log.info("add share: asked %s to index", host)
            except Exception as exc:
                log.info("add share: %s would not start an index (%s)", host, exc)
            refusal = await self._share_refused(zone_uuid, uri)
            if not refusal:
                if attempt:
                    log.info("add share: %s took it", host)
                return {**args, "took": host, "refused": ""}
            log.info("add share: %s could not mount it (%s)", host, refusal)
        return {**args, "took": "", "refused": refusal}

    async def _share_refused(self, zone_uuid: str, uri: str, seconds: float = 8.0) -> str:
        """The players' complaint about this share, if one arrives.

        ContentDirectory publishes ShareIndexLastError as ``<code>,<path>``
        within a few seconds of an add that cannot be mounted; silence for
        that long means a player has taken it and indexing is under way.
        """
        wanted = uri[len("x-file-cifs:"):].rstrip("/").lower()
        deadline = monotonic() + seconds
        while monotonic() < deadline:
            error = self._c.index_error(zone_uuid)
            if error and error.split(",", 1)[-1].rstrip("/").lower() == wanted:
                return error
            await asyncio.sleep(0.5)
        return ""

    #: The share DIDL exactly as the apps build it, read out of their own
    #: native library (libsonos-jni.so arm64, builder at 0xb5a600): the two
    #: spaces between the namespace attributes and the newline before the
    #: closing tag are the app's, and are kept so the request is the one the
    #: players are used to.
    _SHARE_DIDL_OPEN = (
        '<DIDL-Lite  xmlns:dc="http://purl.org/dc/elements/1.1/"'
        '  xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"'
        '  xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/"'
        '  xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<container id="" restricted="false">'
    )
    _SHARE_DIDL_CLOSE = "</container>\n</DIDL-Lite>"

    @classmethod
    def share_elements(cls, uri: str, username: str = "", password: str = "",
                       variant: str = "", household_id: str = "") -> str:
        """The CreateObject DIDL for a share, as the apps' own library builds it.

        Three things about it are not what a reading of DIDL would suggest,
        and all three come from the apps' native library (2026-09-10):

        * the share's path is the **title**. There is no ``<res>`` and no
          ``<upnp:class>``: the builder writes ``dc:title`` and the two
          credential elements, and nothing else. Sonora sent a res-based
          container for weeks; the players accepted it, created the object,
          and then would not mount it.
        * the path is written with forward slashes, the app converting any
          backslash as it copies it.
        * the ``X`` on ``usernameX`` and ``passwordX`` means **encrypted**.
          The value is AES-encrypted and then base64'd, in the scheme
          sonos-net discovered and published (see ``credentials.py``): the object the
          builder feeds is an ``RAesEncoder`` (named by its own RTTI at
          vtable 0x123ebd0, reached through the GOT slot at 0x124f3f8), and
          the base64 writer at 0xc46e5c wraps it. ``seal`` is that cipher,
          and a capture of the desktop app renaming a service account
          (2026-09-14) confirmed it byte for byte: the app's own ciphertext
          opens with Sonora's ``secret()``, checksum and all.

        The base64 alphabet is XML-safe, so the encoded values need no
        escaping of their own.
        """
        path = uri[len("x-file-cifs:"):] if uri.startswith("x-file-cifs:") else uri
        path = path.replace("\\", "/")
        # `variant` exists for experiments that try these
        # against a real household because nothing else can tell them apart:
        # the players accept every one of them and then say only "1,<path>".
        # Empty means the app's own shape, which is what Sonora sends.
        # The X means encrypted. `seal` is what the players accept; the other
        # two are the shapes Sonora used to send, kept for those experiments
        # so the difference can still be demonstrated against a real household.
        if "plain" in variant:
            wrap = escape
        elif "b64" in variant:
            wrap = _b64
        else:
            wrap = lambda value: seal(value, household_id)  # noqa: E731
        # "nox" drops the X, on the chance the firmware still reads the
        # cleartext element names the X ones replaced.
        user_tag, pass_tag = (("r:username", "r:password") if "nox" in variant
                              else ("r:usernameX", "r:passwordX"))
        credentials = ""
        if username:
            credentials = (f"<{user_tag}>{wrap(username)}</{user_tag}>"
                           f"<{pass_tag}>{wrap(password)}</{pass_tag}>")
        body = f"<dc:title>{escape(path)}</dc:title>"
        if "res" in variant:
            body += (f"<upnp:class>object.container</upnp:class>"
                     f'<res protocolInfo="x-file-cifs:*:*:*">'
                     f'{escape("x-file-cifs:" + path)}</res>')
        return f"{cls._SHARE_DIDL_OPEN}{body}{credentials}{cls._SHARE_DIDL_CLOSE}"

    async def media_info(self, zone_uuid: str) -> dict:
        """The coordinator's AVTransport#GetMediaInfo: what is loaded (a station,
        playlist or the queue) as ``uri`` and its DIDL ``metadata``."""
        host = self._c.coordinator_of(zone_uuid).host
        result = await self.soap.call(host, const.AV_TRANSPORT, "GetMediaInfo", {"InstanceID": 0})
        return {"uri": result.get("CurrentURI", ""), "metadata": result.get("CurrentURIMetaData", "")}

    async def add_favorite(self, zone_uuid: str, title: str, uri: str, metadata: str,
                           description: str, art: str) -> dict:
        """Add a Sonos Favorite: ContentDirectory#CreateObject on "FV:2" with the
        item the speakers themselves list there (read from a real household on
        2026-09-05): class ``object.itemobject.item.sonos-favorite``, the
        playable URI as its resource, ``r:type`` instantPlay, a description
        such as "Pandora Station", and the source's DIDL in ``r:resMD``."""
        host = self._household_host(zone_uuid)
        scheme = uri.split(":", 1)[0] if ":" in uri else "x-rincon-playlist"
        # Stations carry a MIME-ish middle part in the apps' entries.
        proto = f"{scheme}:*:audio/{scheme}:*" if scheme == "x-sonosapi-radio" else f"{scheme}:*:*:*"
        elements = (
            f'<DIDL-Lite {self._DIDL_NS}>'
            f'<item id="" parentID="FV:2" restricted="false">'
            f'<dc:title>{escape(title)}</dc:title>'
            f'<upnp:class>object.itemobject.item.sonos-favorite</upnp:class>'
            f'<res protocolInfo="{escape(proto)}">{escape(uri)}</res>'
            + (f'<upnp:albumArtURI>{escape(art)}</upnp:albumArtURI>' if art else '')
            + f'<r:type>instantPlay</r:type>'
            f'<r:description>{escape(description)}</r:description>'
            f'<r:resMD>{escape(metadata)}</r:resMD>'
            f'</item></DIDL-Lite>'
        )
        result = await self.soap.call(host, const.CONTENT_DIRECTORY, "CreateObject",
                                      {"ContainerID": "FV:2", "Elements": elements})
        return dict(result.args)

    async def add_radio_station(self, zone_uuid: str, title: str, url: str,
                                container: str = "R:0/0") -> dict:
        """Add a stream to TuneIn > My Radio Stations: ContentDirectory#CreateObject
        on "R:0/0" with the item the speakers list there (read from a real
        household 2026-09-05: class audioBroadcast, protocolInfo
        x-rincon-mp3radio). A plain http(s) URL becomes x-rincon-mp3radio://.

        ``container`` is "R:0/1" for My Radio Shows, which the speakers keep
        in exactly the same shape: TuneIn hands back a station's current show
        as its own stream item (id p1151215, "Marci Wiser"), so the row the
        apps call "Add to My Radio Shows" writes the show's own
        x-sonosapi-stream URI there (2026-09-07)."""
        host = self._household_host(zone_uuid)
        stream = url.strip()
        # A station already belonging to a music service goes in as it is,
        # with the service's own descriptor: the household's R:0/0 is full of
        # x-sonosapi-stream entries carrying sid=254, which is what the app's
        # "Add to My Radio Stations" writes for the station now playing
        # (2026-09-06). Only a bare URL needs the mp3radio scheme.
        service = stream.split(":", 1)[0] in (
            "x-sonosapi-stream", "x-sonosapi-radio", "x-sonosapi-hls")
        if not service:
            if "://" in stream and not stream.startswith("x-rincon-mp3radio:"):
                stream = "x-rincon-mp3radio://" + stream.split("://", 1)[1]
            elif "://" not in stream:
                stream = "x-rincon-mp3radio://" + stream
        proto = (stream.split(":", 1)[0] if service else "x-rincon-mp3radio")
        desc = ""
        if service:
            sid = re.search(r"[?&]sid=(\d+)", stream)
            if sid:
                stype = (int(sid.group(1)) << 8) | 7
                desc = ('<desc id="cdudn" nameSpace="urn:schemas-rincon'
                        f'networks-com:metadata-1-0/">SA_RINCON{stype}_'
                        f'X_#Svc{stype}-0-Token</desc>')
        elements = (
            f'<DIDL-Lite {self._DIDL_NS}>'
            f'<item id="" parentID="{container}" restricted="false">'
            f'<dc:title>{escape(title)}</dc:title>'
            f'<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>'
            f'<res protocolInfo="{proto}:*:*:*">{escape(stream)}</res>'
            f'{desc}'
            f'</item></DIDL-Lite>'
        )
        result = await self.soap.call(host, const.CONTENT_DIRECTORY, "CreateObject",
                                      {"ContainerID": container, "Elements": elements})
        return dict(result.args)

    async def create_playlist(self, zone_uuid: str, title: str) -> str:
        """An empty Sonos playlist: AVTransport#CreateSavedQueue with no URI
        (verified 2026-09-05; ContentDirectory#CreateObject on SQ: is refused)."""
        target = self._c.coordinator_of(zone_uuid)
        result = await self.soap.call(target.host, const.AV_TRANSPORT, "CreateSavedQueue",
                                      {"InstanceID": 0, "Title": title, "EnqueuedURI": "", "EnqueuedURIMetaData": ""})
        return result.get("AssignedObjectID", "")

    async def add_to_playlist(self, zone_uuid: str, object_id: str, uri: str,
                              metadata: str = "", title: str = "",
                              source_id: str = "") -> int:
        """Append one item to a Sonos playlist (the apps' Add to Sonos Playlist).

        Three things the players insist on, all found by trying them against a
        real playlist on 2026-09-06: the item goes at AddAtIndex, so the
        playlist's current length is read first to append; the container's own
        UpdateID has to be quoted back, or the write is refused with UPnP
        1028; and the row's title, artist and album come from the metadata's
        item id, not its tags (see saved_queue_didl). The fields for that id
        are read from the container the item was browsed in.
        """
        target = self._c.coordinator_of(zone_uuid)
        existing = await self._c.content.browse(target.host, object_id, count=0)
        source = await self._source_item(target.host, source_id, uri)
        if not metadata:
            if source is not None:
                metadata = saved_queue_didl(object_id, source)
            elif title:
                metadata = saved_queue_didl(
                    object_id, DidlItem(id="", parent_id="", restricted=True,
                                        title=title, upnp_class="", uri=uri))
        result = await self.soap.call(
            target.host, const.AV_TRANSPORT, "AddURIToSavedQueue",
            {"InstanceID": 0, "ObjectID": object_id,
             "UpdateID": existing.update_id,
             "EnqueuedURI": uri, "EnqueuedURIMetaData": metadata,
             "AddAtIndex": existing.total})
        return int(result.get("NumTracksAdded") or 0)

    async def remove_from_playlist(self, zone_uuid: str, object_id: str,
                                   index: int) -> None:
        """Drop one track from a Sonos playlist (the apps' Remove Song).

``index`` counts from one, as the queue's own
        removal does. ReorderTracksInSavedQueue is the only saved-queue
        editor the players expose, and moving a track to nowhere deletes it:
        the track list names the position, the new-position list is empty.
        That list counts from zero, unlike the play queue (checked against a
        three-track playlist on 2026-09-06: TrackList 0 took the first).
        """
        target = self._c.coordinator_of(zone_uuid)
        existing = await self._c.content.browse(target.host, object_id, count=0)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "ReorderTracksInSavedQueue",
            {"InstanceID": 0, "ObjectID": object_id,
             "UpdateID": existing.update_id,
             "TrackList": str(index - 1), "NewPositionList": ""})

    async def move_in_playlist(self, zone_uuid: str, object_id: str,
                               index: int, to: int) -> None:
        """Move one track of a Sonos playlist to another place in it, as the
        apps do when a track is dragged within the playlist's page (the S1
        Windows app, 2026-09-29: The Prize dragged above What Child Is This?
        on "test", and back).

        ``index`` and ``to`` count from one, the new place being where the
        track stands afterwards. The same editor as a removal: the track list
        names the track, the new-position list its place, both from zero.
        """
        if index == to:
            return
        target = self._c.coordinator_of(zone_uuid)
        existing = await self._c.content.browse(target.host, object_id, count=0)
        await self.soap.call(
            target.host, const.AV_TRANSPORT, "ReorderTracksInSavedQueue",
            {"InstanceID": 0, "ObjectID": object_id,
             "UpdateID": existing.update_id,
             "TrackList": str(index - 1), "NewPositionList": str(to - 1)})

    async def _source_item(self, host: str, source_id: str, uri: str):
        """The item as the container it was browsed in reports it.

        Its title, artist, album, and duration are what a saved-queue row
        records, and only the source knows them: a browse of a playlist or
        the queue gives no per-track metadata back to the interface.
        """
        if not source_id or not uri:
            return None
        start = 0
        while True:
            page = await self._c.content.browse(host, source_id, start=start, count=100)
            for item in page.items:
                if item.uri == uri:
                    return item
            start += page.returned or 0
            if not page.has_more or not page.returned:
                return None

    async def rename_object(self, zone_uuid: str, object_id: str, current: str, title: str) -> None:
        """Rename a ContentDirectory object (favorite, playlist) by swapping its dc:title."""
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.CONTENT_DIRECTORY, "UpdateObject",
                             {"ObjectID": object_id,
                              "CurrentTagValue": f"<dc:title>{escape(current)}</dc:title>",
                              "NewTagValue": f"<dc:title>{escape(title)}</dc:title>"})

    async def destroy_object(self, zone_uuid: str, object_id: str) -> None:
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.CONTENT_DIRECTORY, "DestroyObject", {"ObjectID": object_id})

    async def rename_favorite(self, zone_uuid: str, object_id: str, current: str, title: str) -> None:
        """Rename a Sonos Favorite: ContentDirectory#UpdateObject swapping its
        dc:title (verified on a real household 2026-09-05)."""
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.CONTENT_DIRECTORY, "UpdateObject",
                             {"ObjectID": object_id,
                              "CurrentTagValue": f"<dc:title>{escape(current)}</dc:title>",
                              "NewTagValue": f"<dc:title>{escape(title)}</dc:title>"})

    async def remove_favorite(self, zone_uuid: str, object_id: str) -> None:
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.CONTENT_DIRECTORY, "DestroyObject", {"ObjectID": object_id})

    #: What the speakers will hold in a queue. A station or a live stream is
    #: not one of them: it becomes the transport's own source. Everything else
    #: -- a service track, a library track, an album or playlist container --
    #: goes through the queue, which is what the apps' Play Now does with it.
    NOT_QUEUEABLE = ("x-sonos-htastream:", "x-rincon-stream:", "x-sonosapi-radio:",
                     "x-sonosapi-stream:", "x-rincon-mp3radio:", "hls-radio:",
                     "aac:", "http:", "https:")

    @classmethod
    def _queueable(cls, uri: str) -> bool:
        if not uri or uri.startswith(cls.NOT_QUEUEABLE):
            return False
        # A live HLS stream is a station; Amazon Music's tracks arrive as
        # x-sonosapi-hls-static and do sit in the queue (2026-09-07).
        return not (uri.startswith("x-sonosapi-hls:"))

    async def play_now(self, zone_uuid: str, uri: str, metadata: str = "",
                       kind: str = "") -> None:
        """Play a source at once, as the apps' Play Now does.

        Anything the queue can hold -- a track, an album, a playlist -- goes
        into the queue right after what is playing, the transport is pointed
        at the queue and the queue jumps to it. That is the state the app
        produces: a Plex album playing as Song [1/12] became Song [2/13] when
        Play Now was used on a track from another album (2026-09-06). Pointing
        the transport straight at the track instead left the room unable to
        seek within its queue, which is where Sonora's 701 on a double-clicked
        Plex track came from. A station or a live stream
        has no queue to join and becomes the transport's source.
        """
        target = self._c.coordinator_of(zone_uuid)
        # An audiobook is the exception among containers: Sonos' SMAPI
        # reference has the app hand the book's id to the player rather than
        # queue it, and the player plays the chapters in order and resumes.
        # Queued, the speaker expanded the book into 21 queue entries
        # (Libby by OverDrive, 2026-09-08). Its reference looks like any
        # playlist container, so the kind has to say so.
        if self._queueable(uri) and kind != "audiobook":
            result = await self.add_to_queue(zone_uuid, uri, metadata, next_=True)
            first = int(result.get("FirstTrackNumberEnqueued", "0") or 0)
            await self.soap.call(target.host, const.AV_TRANSPORT, "SetAVTransportURI",
                                 {"InstanceID": 0, "CurrentURI": f"x-rincon-queue:{target.uuid}#0",
                                  "CurrentURIMetaData": ""})
            if first:
                await self.soap.call(target.host, const.AV_TRANSPORT, "Seek",
                                     {"InstanceID": 0, "Unit": "TRACK_NR", "Target": str(first)})
        else:
            await self.set_source(zone_uuid, uri, metadata)
        await self.play(zone_uuid)

    async def replace_queue(self, zone_uuid: str, uri: str, metadata: str = "") -> None:
        """The apps' Replace Queue: empty the queue, add the source, play it."""
        target = self._c.coordinator_of(zone_uuid)
        await self.clear_queue(zone_uuid)
        await self.add_to_queue(zone_uuid, uri, metadata)
        await self.soap.call(target.host, const.AV_TRANSPORT, "SetAVTransportURI",
                             {"InstanceID": 0, "CurrentURI": f"x-rincon-queue:{target.uuid}#0",
                              "CurrentURIMetaData": ""})
        await self.soap.call(target.host, const.AV_TRANSPORT, "Seek",
                             {"InstanceID": 0, "Unit": "TRACK_NR", "Target": "1"})
        await self.play(zone_uuid)

    async def remove_share(self, zone_uuid: str, object_id: str) -> None:
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.CONTENT_DIRECTORY, "DestroyObject",
                             {"ObjectID": object_id})

    async def refresh_share_index(self, zone_uuid: str, album_artist_option: str) -> None:
        """Rebuild the index now; the option is how compilations are grouped."""
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.CONTENT_DIRECTORY, "RefreshShareIndex",
                             {"AlbumArtistDisplayOption": album_artist_option})

    async def set_daily_index_refresh(self, zone_uuid: str, at: str) -> None:
        """Nightly index update at ``HH:MM:SS``, or none when empty."""
        host = self._household_host(zone_uuid)
        await self.soap.call(host, const.ALARM_CLOCK, "SetDailyIndexRefreshTime",
                             {"DesiredDailyIndexRefreshTime": at})

    async def set_status_light(self, zone_uuid: str, on: bool) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(
            state.host, const.DEVICE_PROPERTIES, "SetLEDState",
            {"DesiredLEDState": "On" if on else "Off"})

    async def set_button_lock(self, zone_uuid: str, locked: bool) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(
            state.host, const.DEVICE_PROPERTIES, "SetButtonLockState",
            {"DesiredButtonLockState": "On" if locked else "Off"})

    async def create_stereo_pair(self, left_uuid: str, right_uuid: str) -> None:
        left = self._c.zone(left_uuid)
        right = self._c.zone(right_uuid)
        await self.soap.call(
            left.host, const.DEVICE_PROPERTIES, "CreateStereoPair",
            {"ChannelMapSet": f"{left.uuid}:LF,LF;{right.uuid}:RF,RF"})

    async def separate_stereo_pair(self, zone_uuid: str) -> None:
        state = self._c.zone(zone_uuid)
        household = self._c.household_of(zone_uuid)
        zone: Zone | None = household.zones.get(zone_uuid) if household else None
        if zone is None or not zone.is_paired:
            raise ValueError(f"{state.name} is not a stereo pair")
        channel_map = zone.players[0].channel_map
        await self.soap.call(
            state.host, const.DEVICE_PROPERTIES, "SeparateStereoPair",
            {"ChannelMapSet": channel_map})

    # -- alarms --------------------------------------------------------------

    async def list_alarms(self, zone_uuid: str) -> str:
        result = await self.soap.call(
            self._c.household_host(zone_uuid), const.ALARM_CLOCK, "ListAlarms")
        return result.get("CurrentAlarmList", "")

    async def _list_alarms_settled(self, zone_uuid: str) -> str:
        """ListAlarms, read again while the speaker is behind the change.

        The list is household state that every speaker serves, and one asked
        straight after another controller's change can still answer with the
        list from before it -- ListAlarms carries the version it is serving,
        and the AlarmClock event that woke the browsers carried the newer
        one. So the version count is compared with the last event's, and the
        read is repeated a few times while it lags (an alarm deleted in the
        Windows app was "sometimes" still listed).
        """
        state = self._c.zone(zone_uuid)
        household = self._c.household_of(zone_uuid)
        wanted = self._c._alarm_version.get(household.id) if household else None
        raw = ""
        for attempt in range(4):
            result = await self.soap.call(
                state.host, const.ALARM_CLOCK, "ListAlarms")
            raw = result.get("CurrentAlarmList", "")
            version = str(result.get("CurrentAlarmListVersion", "") or "")
            count = version.rpartition(":")[2]
            if (not wanted or not count.isdigit() or not wanted.isdigit()
                    or int(count) >= int(wanted)):
                break
            await asyncio.sleep(0.35 * (attempt + 1))
        return raw

    #: The attributes ListAlarms reports per alarm, in UpdateAlarm's argument
    #: names; StartTime is what the list calls StartLocalTime.
    _ALARM_FIELDS = ("ID", "StartTime", "Duration", "Recurrence", "Enabled",
                     "RoomUUID", "ProgramURI", "ProgramMetaData", "PlayMode",
                     "Volume", "IncludeLinkedZones")

    async def alarms(self, zone_uuid: str) -> list[dict]:
        """The household's alarms as plain dicts (ListAlarms parsed).

        Through the hardened parser, like every other document a speaker
        hands us: this one was still going through the standard library's,
        which honors entity and DTD declarations.
        """
        raw = await self._list_alarms_settled(zone_uuid)
        out: list[dict] = []
        if not raw:
            return out
        try:
            root = DET.fromstring(raw)
        except Exception:
            return out
        for node in root.iter("Alarm"):
            out.append({k: node.get(k, "") for k in self._ALARM_FIELDS})
        return out

    async def set_alarm_enabled(self, zone_uuid: str, alarm_id: str, enabled: bool) -> None:
        """Turn one alarm on or off, keeping everything else about it.

        UpdateAlarm takes the whole alarm, so the current definition is read
        back and re-sent with only Enabled changed.
        """
        alarm = next((a for a in await self.alarms(zone_uuid) if a["ID"] == str(alarm_id)), None)
        if alarm is None:
            raise KeyError(alarm_id)
        state = self._c.zone(zone_uuid)
        await self.soap.call(state.host, const.ALARM_CLOCK, "UpdateAlarm", {
            "ID": alarm["ID"], "StartLocalTime": alarm["StartTime"],
            "Duration": alarm["Duration"], "Recurrence": alarm["Recurrence"],
            "Enabled": 1 if enabled else 0, "RoomUUID": alarm["RoomUUID"],
            "ProgramURI": alarm["ProgramURI"], "ProgramMetaData": alarm["ProgramMetaData"],
            "PlayMode": alarm["PlayMode"], "Volume": alarm["Volume"],
            "IncludeLinkedZones": alarm["IncludeLinkedZones"]})

    def _alarm_args(self, alarm: dict) -> dict:
        return {"StartLocalTime": alarm["start_time"], "Duration": alarm.get("duration", ""),
                "Recurrence": alarm.get("recurrence", "ONCE"), "Enabled": 1 if alarm.get("enabled", True) else 0,
                "RoomUUID": alarm["room_uuid"], "ProgramURI": alarm.get("program_uri") or "x-rincon-buzzer:0",
                "ProgramMetaData": alarm.get("program_metadata", ""),
                "PlayMode": alarm.get("play_mode", "NORMAL"), "Volume": int(alarm.get("volume", 25)),
                "IncludeLinkedZones": 1 if alarm.get("include_linked_zones") else 0}

    async def create_alarm(self, zone_uuid: str, alarm: dict) -> str:
        """AlarmClock#CreateAlarm; returns the new alarm's id."""
        state = self._c.zone(zone_uuid)
        result = await self.soap.call(state.host, const.ALARM_CLOCK, "CreateAlarm", self._alarm_args(alarm))
        return result.get("AssignedID", "")

    async def update_alarm(self, zone_uuid: str, alarm_id: str, alarm: dict) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(state.host, const.ALARM_CLOCK, "UpdateAlarm",
                             {"ID": alarm_id, **self._alarm_args(alarm)})

    async def destroy_alarm(self, zone_uuid: str, alarm_id: str) -> None:
        state = self._c.zone(zone_uuid)
        await self.soap.call(state.host, const.ALARM_CLOCK, "DestroyAlarm",
                             {"ID": alarm_id})


def note_queue_source(state, transport, props: dict) -> None:
    """Keep ``transport.queue_source``: the one album or playlist the queue
    holds, which Save Queue offers as the playlist's name, as the desktop
    apps offer it ("Hamilton (Original Broadway Cast Recording)", "Chill
    Tracks"); a queue added to since is a mix (Windows app, 2026-09-29).

    A container handed to the queue while Sonora watched makes the queue as
    long as it is then, and a queue still that long is that container alone.
    The first report after start-up names only what was enqueued last, not
    whether anything was added after it, so it proves nothing.
    """
    if "EnqueuedTransportURI" in props:
        fresh = props["EnqueuedTransportURI"]
        if state.enqueued_seen and fresh and (fresh != state.enqueued_uri or state.queue_emptied):
            state.enqueued_length = transport.queue_length
            state.queue_emptied = False
        state.enqueued_seen = True
        state.enqueued_uri = fresh
        transport.queue_container, transport.queue_container_sid = _enqueued_container(
            fresh, getattr(state, "enqueued_metadata", "") or "")
    if transport.queue_length == 0:
        state.queue_emptied = True
        state.enqueued_length = -1
    transport.queue_source = (transport.container_title
                              if state.enqueued_length > 0 and transport.queue_length == state.enqueued_length
                              else "")


def _enqueued_container(uri: str, metadata: str) -> tuple[str, int | None]:
    """The list the queue was last filled from, as the web client reopens it
    from the bar's words: a library object (``A:TRACKS``, off an
    ``x-rincon-playlist:...#A:TRACKS``) with no service, or a service's own
    container id (``spotify:playlist:7mSU...``, the DIDL id of an
    ``x-rincon-cpcontainer:`` less its eight-digit prefix) with its ``sid``.
    A track played off a Spotify playlist reopens the playlist, not the
    track's album (play.sonos.com, 2026-09-30)."""
    import html as _html
    from urllib.parse import unquote
    if uri.startswith("x-rincon-playlist:") and "#" in uri:
        return uri.split("#", 1)[1], None
    if uri.startswith("x-rincon-cpcontainer:"):
        sid = re.search(r"[?&]sid=(\d+)", uri)
        found = re.search(r'<(?:item|container)\b[^>]*\bid="([^"]+)"', _html.unescape(metadata or ""))
        if found and sid:
            raw = unquote(found.group(1))
            return (raw[8:] if re.match(r"^[0-9a-fA-F]{8}", raw) else raw), int(sid.group(1))
    return "", None
