"""Collapsing players into rooms, including the moments a pair is forming."""

from backend.sonos.models import Player
from backend.sonos.models import zones_from_players


def _player(uuid, name, **kw):
    return Player(uuid=uuid, name=name, host=f"192.168.1.{uuid[-2:]}", **kw)


def test_settled_pair_is_one_room():
    left = _player("RINCON_A1", "Workshop", channel_map="RINCON_A1:LF,LF;RINCON_B2:RF,RF")
    right = _player("RINCON_B2", "Workshop", invisible=True,
                    channel_map="RINCON_A1:LF,LF;RINCON_B2:RF,RF")
    zones = zones_from_players([left, right])
    assert list(zones) == ["RINCON_A1"]
    assert [p.uuid for p in zones["RINCON_A1"].players] == ["RINCON_A1", "RINCON_B2"]


def test_forming_pair_hides_the_claimed_unit_at_once():
    # Right after "Create stereo pair": the coordinator already names both
    # units in its channel map, the other still has its old room name and is
    # not yet flagged invisible.
    left = _player("RINCON_A1", "Workshop", channel_map="RINCON_A1:LF,LF;RINCON_B2:RF,RF")
    right = _player("RINCON_B2", "Workshop 2")
    zones = zones_from_players([left, right])
    assert list(zones) == ["RINCON_A1"], "Workshop 2 must not appear as its own room"
    zone = zones["RINCON_A1"]
    assert zone.name == "Workshop"
    assert right.invisible is True
    assert [p.uuid for p in zone.players] == ["RINCON_A1", "RINCON_B2"]


def test_unrelated_rooms_stay_separate():
    a = _player("RINCON_A1", "Pantry")
    b = _player("RINCON_B2", "Terrace")
    assert sorted(zones_from_players([a, b])) == ["RINCON_A1", "RINCON_B2"]


# --- a slow speaker is not an absent one -------------------------------------


def test_a_slow_description_does_not_mark_a_player_offline():
    """A Play:5 answered in 5.5s against a 6s timeout.

    Every refresh that caught it on the wrong side of that marked a speaker
    offline while it was audibly playing, which took its model, its software
    version, its place in diagnostics and its rooms in the group pickers.
    """
    import asyncio

    from backend.sonos import discovery
    from backend.sonos.models import Player

    asked: list[float] = []

    async def slow_then_fine(session, host, *, timeout=6.0):
        asked.append(timeout)
        if len(asked) == 1:
            raise TimeoutError("too slow on the first ask")
        return {"model": "Sonos Play:5", "display_version": "11.16.1"}

    reader = discovery.HouseholdRegistry.__new__(discovery.HouseholdRegistry)
    reader._session = None
    player = Player(uuid="RINCON_X", name="Terrace", host="192.168.0.107")

    original = discovery.fetch_device_description
    discovery.fetch_device_description = slow_then_fine
    try:
        asyncio.run(reader._enrich({player.uuid: player}))
    finally:
        discovery.fetch_device_description = original

    assert player.online is True
    assert player.model == "Sonos Play:5"
    assert asked == [6.0, discovery.SLOW_DESCRIPTION_TIMEOUT], asked


def test_a_listed_speaker_that_answers_neither_time_stays_online():
    """A wireless speaker on a weak link timed out its description while the
    household's topology still listed it and it played; the Sonos apps showed
    it online and Sonora called it offline."""
    import asyncio

    from backend.sonos import discovery
    from backend.sonos.models import Household, Player

    async def never(session, host, *, timeout=6.0):
        raise TimeoutError("gone")

    class Soap:
        silent: list[str] = []

        def mark_silent(self, host):
            self.silent.append(host)

    reader = discovery.HouseholdRegistry.__new__(discovery.HouseholdRegistry)
    reader._session = None
    reader._soap = Soap()
    last = Player(uuid="RINCON_Y", name="Shed", host="192.168.0.110",
                  model="Sonos Play:1", serial="00-0E-58-AA-BB-CC:1", display_version="11.16.1")
    reader.households = {"HH": Household(id="HH", players={last.uuid: last}, zones={}, groups={},
                                         control_id="", vanished=[])}
    player = Player(uuid="RINCON_Y", name="Shed", host="192.168.0.110", software_version="57.23-74170")

    original = discovery.fetch_device_description
    discovery.fetch_device_description = never
    try:
        asyncio.run(reader._enrich({player.uuid: player}))
    finally:
        discovery.fetch_device_description = original

    assert player.online is True
    assert (player.model, player.serial, player.display_version) == (
        "Sonos Play:1", "00-0E-58-AA-BB-CC:1", "11.16.1")
    assert player.software_version == "57.23-74170"
    assert reader._soap.silent == ["192.168.0.110"]


# --- a stale speaker is outvoted ---------------------------------------------


def _registry_with_views(views):
    """A registry whose players each describe the household their own way."""
    from backend.sonos.discovery import HouseholdRegistry
    from backend.sonos.models import Household

    class Soap:
        def is_silent(self, host):
            return False

    registry = HouseholdRegistry(Soap(), session=None)
    loaded: list[str] = []

    async def shape(host):
        return views[host]

    async def load_from(host):
        loaded.append(host)
        return Household(id="HH", players={}, zones={}, groups={}, control_id="", vanished=[])

    registry._shape = shape
    registry.load_from = load_from
    players = {h: _player(f"RINCON_{i:02d}", h) for i, h in enumerate(views)}
    for host, player in players.items():
        player.host = host
        player.online = True
    first = Household(id="HH", players={p.uuid: p for p in players.values()}, zones={}, groups={},
                      control_id="", vanished=[])
    return registry, first, loaded


def test_a_stale_first_answer_is_outvoted():
    """A speaker back from half a minute off the network still had a
    grouped room missing; the other speakers had it grouped."""
    import asyncio

    grouped = (frozenset({("T", frozenset({"T", "O"}))}), 3)
    stale = (frozenset({("T", frozenset({"T"}))}), 2)
    registry, first, loaded = _registry_with_views({"mb": stale, "tr": grouped, "of": grouped})
    asyncio.run(registry._second_opinion(first, "mb"))
    assert loaded == ["tr"], "the picture must come from a speaker that agrees with another"


def test_two_views_that_agree_cost_no_reload():
    import asyncio

    same = (frozenset({("T", frozenset({"T", "O"}))}), 3)
    registry, first, loaded = _registry_with_views({"tr": same, "of": same, "po": same})
    assert asyncio.run(registry._second_opinion(first, "tr")) is first
    assert loaded == []


def test_topology_events_during_a_refresh_bring_another():
    """A coordinator hand-off whose events landed while a slow refresh was
    reading the topology left Sonora showing the old group."""
    import asyncio

    from backend.sonos.controller import SonosController
    from backend.sonos.events import Event

    ctl = SonosController.__new__(SonosController)
    ctl._retopology = None
    ctl._retopology_again = False
    ctl._service_blob = {}
    calls: list[int] = []

    async def refresh():
        calls.append(1)
        if len(calls) == 1:
            # The rest of the burst arrives while this one is still reading.
            await ctl._on_topology_event(Event(host="h", service="ZoneGroupTopology", seq=0))
            await ctl._on_topology_event(Event(host="h", service="ZoneGroupTopology", seq=7))

    ctl.refresh = refresh

    async def run():
        await ctl._on_topology_event(Event(host="h", service="ZoneGroupTopology", properties={}))
        await ctl._retopology

    asyncio.run(run())
    assert len(calls) == 2


def test_a_speaker_already_down_is_asked_once():
    """Twenty-six seconds a refresh for a speaker known to be gone held every
    grouping change back that long."""
    import asyncio

    from backend.sonos import discovery
    from backend.sonos.models import Player

    asked: list[float] = []

    async def never(session, host, *, timeout=6.0):
        asked.append(timeout)
        raise TimeoutError("gone")

    reader = discovery.HouseholdRegistry.__new__(discovery.HouseholdRegistry)
    reader._session = None
    player = Player(uuid="RINCON_Y", name="Main Bedroom", host="192.168.0.106")

    original = discovery.fetch_device_description
    discovery.fetch_device_description = never
    try:
        asyncio.run(reader._enrich({player.uuid: player}))
        assert asked == [6.0, discovery.SLOW_DESCRIPTION_TIMEOUT]
        asked.clear()
        asyncio.run(reader._enrich({player.uuid: player}))
    finally:
        discovery.fetch_device_description = original

    assert asked == [6.0]
    assert player.online is True


def test_a_fresh_subscription_during_a_refresh_brings_none():
    """Each refresh subscribes again, and each new subscription opens with
    the state as it stands (SEQ 0). Taking those for changes kept Sonora
    refreshing without end."""
    import asyncio

    from backend.sonos.controller import SonosController
    from backend.sonos.events import Event

    ctl = SonosController.__new__(SonosController)
    ctl._retopology = None
    ctl._retopology_again = False
    ctl._service_blob = {}
    calls: list[int] = []

    async def refresh():
        calls.append(1)
        await ctl._on_topology_event(Event(host="h", service="ZoneGroupTopology", seq=0))

    ctl.refresh = refresh

    async def run():
        await ctl._on_topology_event(Event(host="h", service="ZoneGroupTopology", seq=3))
        await ctl._retopology

    asyncio.run(run())
    assert len(calls) == 1


def _zgs(groups):
    """A ZoneGroupState document: groups as (coordinator, [(uuid, name)])."""
    body = "".join(
        f'<ZoneGroup Coordinator="{c}" ID="{c}:1">'
        + "".join(f'<ZoneGroupMember UUID="{u}" Location="http://192.168.1.{u[-2:]}:1400/xml/device_description.xml" ZoneName="{n}"/>'
                  for u, n in members)
        + "</ZoneGroup>"
        for c, members in groups)
    return f"<ZoneGroupState><ZoneGroups>{body}</ZoneGroups></ZoneGroupState>"


def _controller_with(households):
    import asyncio  # noqa: F401

    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    registry = type("R", (), {"households": households})()
    ctl.registry = registry
    ctl._last_sent = {}
    ctl._last_evented_topology = None
    sent: list[dict] = []
    ctl._rebuild_zones = lambda hh: None
    ctl.snapshot = lambda: {}

    async def broadcast(message):
        sent.append(message)

    ctl._broadcast = broadcast
    return ctl, sent


def test_an_evented_regroup_applies_at_once():
    """The Windows app shows one room joining another as the speakers
    announce it; Sonora waited on a ten-second rediscovery."""
    import asyncio

    from backend.sonos.models import Household, zones_from_players
    from backend.sonos.topology import parse_zone_group_state, remap_groups

    apart = _zgs([("RINCON_A1", [("RINCON_A1", "Lab")]), ("RINCON_B2", [("RINCON_B2", "Workshop")])])
    players, groups, _ = parse_zone_group_state(apart)
    zones = zones_from_players(players.values())
    household = Household(id="HH", players=players, zones=zones, groups=remap_groups(groups, zones, players))
    ctl, sent = _controller_with({"HH": household})

    together = _zgs([("RINCON_A1", [("RINCON_A1", "Lab"), ("RINCON_B2", "Workshop")])])
    assert asyncio.run(ctl._apply_topology("192.168.1.A1", together)) is True
    assert [sorted(g.zone_uuids) for g in household.groups.values()] == [["RINCON_A1", "RINCON_B2"]]
    assert sent and sent[0]["type"] == "snapshot"


def test_an_evented_state_naming_a_new_player_waits_for_discovery():
    import asyncio

    from backend.sonos.models import Household, zones_from_players
    from backend.sonos.topology import parse_zone_group_state, remap_groups

    one = _zgs([("RINCON_A1", [("RINCON_A1", "Lab")])])
    players, groups, _ = parse_zone_group_state(one)
    zones = zones_from_players(players.values())
    household = Household(id="HH", players=players, zones=zones, groups=remap_groups(groups, zones, players))
    ctl, sent = _controller_with({"HH": household})

    more = _zgs([("RINCON_A1", [("RINCON_A1", "Lab"), ("RINCON_C3", "Den")])])
    assert asyncio.run(ctl._apply_topology("192.168.1.A1", more)) is False
    assert sent == []


def test_a_rebuild_keeps_the_television_input_the_cloud_named():
    """The cloud names a soundbar's input only when it changes; a rebuild
    that dropped it left a soundbar on HDMI showing a bare
    "TV"."""
    from backend.sonos.controller import SonosController
    from backend.sonos.models import Household, zones_from_players
    from backend.sonos.topology import parse_zone_group_state, remap_groups

    players, groups, _ = parse_zone_group_state(_zgs([("RINCON_A1", [("RINCON_A1", "Sunroom")])]))
    zones = zones_from_players(players.values())
    household = Household(id="HH", players=players, zones=zones, groups=remap_groups(groups, zones, players))
    ctl = SonosController.__new__(SonosController)
    ctl.zones = {}
    ctl._rebuild_zones({"HH": household})
    first = ctl.zones["RINCON_A1"]
    first.ht_input, first.ht_signal, first.ht_audio_in = "HDMI", "Dolby MAT", 84934718
    ctl._rebuild_zones({"HH": household})
    again = ctl.zones["RINCON_A1"]
    assert again is not first
    assert (again.ht_input, again.ht_signal, again.ht_audio_in) == ("HDMI", "Dolby MAT", 84934718)


def test_a_soundbar_on_tv_reports_its_format_code():
    """HTAudioIn travels with the transport so every theme can name the
    format (lib/tvFormat.js); off the TV input it is not sent."""
    from backend.sonos.controller import ZoneState

    state = ZoneState(uuid="RINCON_A1", name="Sunroom", host="192.168.1.57")
    state.ht_audio_in = 84934718
    state.transport.track_uri = "x-sonos-htastream:RINCON_A1:spdif"
    assert state.as_dict()["transport"]["tv_format_code"] == 84934718
    state.transport.track_uri = "x-sonos-spotify:spotify:track:1"
    assert state.as_dict()["transport"]["tv_format_code"] is None


def test_every_tv_format_code_has_a_name():
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "src"
    table = (root / "lib" / "tvFormat.js").read_text()
    codes = re.findall(r"\d+", table[table.index("TV_FORMAT_CODES = ["):table.index("]")])
    english = (root / "i18n" / "en-US.js").read_text()
    assert len(codes) == 24
    for code in codes:
        assert f"'tvFormat.{code}':" in english, code


def test_a_listed_speaker_unread_since_start_up_keeps_its_remembered_model():
    from backend.sonos.controller import SonosController
    from backend.sonos.models import Household, Player

    ctl = SonosController.__new__(SonosController)
    ctl._known = {"RINCON_Y": {"model": "Sonos Play:1", "model_number": "S1", "serial": "00-0E-58-AA-BB-CC:1"}}
    player = Player(uuid="RINCON_Y", name="Shed", host="192.168.0.110")
    ctl._fill_from_known({"HH": Household(id="HH", players={player.uuid: player}, zones={}, groups={},
                                          control_id="", vanished=[])})
    assert (player.model, player.model_number, player.serial) == ("Sonos Play:1", "S1", "00-0E-58-AA-BB-CC:1")
