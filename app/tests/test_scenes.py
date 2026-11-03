"""Scenes: the store, applying one to the speakers, and ending it."""

import asyncio
import time
from types import SimpleNamespace

import pytest

from backend.sonos import scenes
from backend.sonos.soap import SoapFault


@pytest.fixture(autouse=True)
def _no_settling(monkeypatch):
    # The fakes here never hear a topology event, so a regrouping is not waited on.
    monkeypatch.setattr(scenes, "GROUP_SETTLE", 0)


def _body(**extra):
    return {"name": "Dinner Party",
            "groups": [{"rooms": [{"uuid": "A", "name": "Kitchen", "volume": 25},
                                  {"uuid": "B", "name": "Dining Room", "volume": 130,
                                   "tone": {"bass": -20, "treble": 3, "loudness": 1}}],
                        "play": None, "play_mode": "SHUFFLE", "sleep": 45}],
            **extra}


def _one(play=None, play_mode=None, **extra):
    body = _body(**extra)
    body["groups"][0]["play"] = play
    body["groups"][0]["play_mode"] = play_mode
    return body


def test_normalize_clamps_and_settles_the_groups():
    scene = scenes.normalize(_body(), "HH")
    rooms = scenes.rooms_of(scene)
    assert rooms[1]["volume"] == 100
    assert rooms[1]["tone"] == {"bass": -10, "treble": 3, "loudness": True}
    assert rooms[0]["tone"] is None and rooms[0]["soundbar"] is None
    assert scene["groups"][0]["play"] is None and scene["groups"][0]["play_mode"] == "SHUFFLE" and scene["groups"][0]["sleep"] == 45
    assert scenes.normalize(_one(play_mode="BACKWARDS"), "HH")["groups"][0]["play_mode"] is None
    # A scene saved with one timer for the whole of it hands that timer to each group.
    shared = scenes.normalize({"name": "Old", "sleep": 30, "groups": [{"rooms": [{"uuid": "A"}]}, {"rooms": [{"uuid": "B"}]}]}, "HH")
    assert [g["sleep"] for g in shared["groups"]] == [30, 30] and "sleep" not in shared
    assert scenes.normalize(_one(play={"kind": "item", "uri": ""}), "HH")["groups"][0]["play"] is None
    assert scenes.normalize(_one(play={"kind": "tv", "source": "B"}), "HH")["groups"][0]["play"]["kind"] == "tv"
    # A room in two groups stays in the first; an emptied group is dropped.
    body = _body()
    body["groups"].append({"rooms": [{"uuid": "A", "name": "Kitchen"}], "play": None})
    body["groups"].append({"rooms": [{"uuid": "C", "name": "Patio"}], "play": {"kind": "line_in", "source": "C"}})
    scene = scenes.normalize(body, "HH")
    assert [[r["uuid"] for r in g["rooms"]] for g in scene["groups"]] == [["A", "B"], ["C"]]
    assert scene["groups"][1]["play"]["kind"] == "line_in"
    # The earlier one-group shape still reads.
    old = scenes.normalize({"name": "Old", "rooms": [{"uuid": "A"}], "play": {"kind": "tv", "source": "A"}, "play_mode": "NORMAL"}, "HH")
    assert old["groups"] == [{"household": "HH", "rooms": [{"uuid": "A", "name": "", "volume": None, "tone": None, "soundbar": None}],
                              "play": {"kind": "tv", "uri": "", "metadata": "", "title": "", "art": "", "item_kind": "", "service": "", "source": "A"},
                              "play_mode": "NORMAL", "keep_levels": False, "sleep": None, "delay": None}]
    for bad in ({"name": " ", "groups": [{"rooms": [{"uuid": "A"}]}]}, {"name": "x", "groups": []},
                {"name": "x", "groups": [{"rooms": []}]}):
        try:
            scenes.normalize(bad, "HH")
        except ValueError:
            continue
        raise AssertionError(bad)


def test_store_round_trip(tmp_path):
    path = tmp_path / "scenes.json"
    store = scenes.Scenes(path)
    scene = store.add(_body(household="HH"))
    assert scene["id"].startswith("sc_") and scene["groups"][0]["household"] == "HH"
    again = scenes.Scenes(path)
    assert again.items()[0]["name"] == "Dinner Party"
    assert again.update(scene["id"], _body(name="Supper"))["name"] == "Supper"
    assert again.update("sc_nope", _body()) is None
    assert again.get(scene["id"])["created"] == scene["created"]
    assert again.remove(scene["id"])["name"] == "Supper"
    assert again.items() == [] and again.remove(scene["id"]) is None


def test_store_survives_junk(tmp_path):
    path = tmp_path / "scenes.json"
    path.write_text('{"HH": [{"id": "sc_1", "name": "", "groups": []}, 5, {"id": "sc_2", "name": "Ok", "groups": [{"rooms": [{"uuid": "A"}]}]}], "X": "no"}')
    store = scenes.Scenes(path)
    assert [s["id"] for s in store.items()] == ["sc_2"] and store.items()[0]["groups"][0]["household"] == "HH"
    path.write_text("not json")
    assert scenes.Scenes(path).items() == []
    # The file as it is written now: a flat list, each group naming its system.
    store.add({"name": "Both", "groups": [{"household": "S1", "rooms": [{"uuid": "A"}]}, {"household": "S2", "rooms": [{"uuid": "B"}]}]})
    assert [g["household"] for g in scenes.Scenes(path).items()[-1]["groups"]] == ["S1", "S2"]


def test_active_store_keeps_and_expires(tmp_path):
    path = tmp_path / "scene_state.json"
    store = scenes.Active(path)
    before = {"name": "Party", "household": "HH", "at": 1.0e12, "rooms": {"A": {"name": "Kitchen"}}}
    store.set("sc_1", before)
    store.set("try:HH", {**before, "at": 1})          # long ago: gone on the next look
    assert scenes.Active(path).get("sc_1")["name"] == "Party"
    assert scenes.Active(path).get("try:HH") is None
    assert list(scenes.Active(path).listing()) == ["sc_1"]
    store.remove("sc_1")
    assert scenes.Active(path).get("sc_1") is None
    path.write_text('{"sc_2": "junk", "sc_3": {"rooms": {}, "at": 1e12}}')
    assert scenes.Active(path).get("sc_3") is not None and scenes.Active(path).get("sc_2") is None


def test_a_scene_ends_on_its_own_only_when_every_group_has_a_duration():
    timed = {"groups": [{"sleep": 30}, {"sleep": 20, "delay": 90}]}
    assert scenes.ends_after(timed) == (90 + 20) * 60
    assert scenes.ends_after({"groups": [{"sleep": 30}, {"sleep": None}]}) is None
    assert scenes.ends_after({"groups": []}) is None


def test_a_scene_that_ends_later_than_a_day_out_is_kept_until_then(tmp_path):
    import time
    path = tmp_path / "scene_state.json"
    store = scenes.Active(path)
    long_ago = time.time() - scenes.ACTIVE_FOR - 60
    store.set("sc_1", {"name": "Long", "at": long_ago, "rooms": {}})
    store.set_end("sc_1", time.time() + 600)
    store.set("sc_2", {"name": "Old", "at": long_ago, "rooms": {}})
    again = scenes.Active(path)
    assert list(again.listing()) == ["sc_1"]
    assert again.ending() == {"sc_1": pytest.approx(time.time() + 600, abs=5)}
    again.set_end("sc_1", None)
    assert scenes.Active(path).ending() == {}


def test_ending_overlapping_scenes_in_any_order_lands_on_the_first_record(tmp_path):
    first = {"name": "Dinner", "at": 1.0e12, "rooms": {"A": {"volume": 10}, "B": {"volume": 20}}}
    second = {"name": "Party", "at": 1.0e12 + 60, "rooms": {"B": {"volume": 50}, "C": {"volume": 30}}}
    third = {"name": "Late", "at": 1.0e12 + 120, "rooms": {"B": {"volume": 70}}}

    # The first scene ends while the others still have room B: only A goes
    # back now, and the second scene takes over the first's record of B.
    # The third then puts B back under the second, and the second ends on
    # the record the first left it.
    store = scenes.Active(tmp_path / "s.json")
    for key, before in (("sc_1", first), ("sc_2", second), ("sc_3", third)):
        store.set(key, dict(before, rooms={k: dict(v) for k, v in before["rooms"].items()}))
    assert store.release("sc_1")["rooms"] == {"A": {"volume": 10}}
    assert store.release("sc_3")["rooms"] == {"B": {"volume": 70}}
    assert store.release("sc_2")["rooms"] == {"B": {"volume": 20}, "C": {"volume": 30}}
    assert store.listing() == {}

    # Newest first: each puts back what it found, which is the scene before it.
    store = scenes.Active(tmp_path / "t.json")
    for key, before in (("sc_1", first), ("sc_2", second), ("sc_3", third)):
        store.set(key, dict(before, rooms={k: dict(v) for k, v in before["rooms"].items()}))
    assert store.release("sc_3")["rooms"] == {"B": {"volume": 70}}
    assert store.release("sc_2")["rooms"] == {"B": {"volume": 50}, "C": {"volume": 30}}
    assert store.release("sc_1")["rooms"] == {"A": {"volume": 10}, "B": {"volume": 20}}
    assert store.release("sc_1") is None


class _Transport(SimpleNamespace):
    @property
    def is_home_theater(self):
        return self.track_uri.startswith("x-sonos-htastream:")

    @property
    def source(self):
        if self.media_uri.startswith("x-rincon-queue:"):
            return "queue"
        return "station" if self.media_uri else ""


def _zone(uuid, name, coordinator=None, online=True, muted=False, media_uri="", state="STOPPED", volume=30):
    return SimpleNamespace(uuid=uuid, name=name, host=f"10.0.0.{uuid.lower()}", model_number="S1", online=online,
                           muted=muted, volume=volume, bass=1, treble=2, loudness=True, media_metadata="<meta/>",
                           coordinator=coordinator or uuid,
                           transport=_Transport(track_uri=media_uri, media_uri=media_uri, state=state,
                                                play_mode="NORMAL", container_title="Jazz FM", title="",
                                                album_art_uri="http://art", track_number=3, rel_time="0:01:30"))


class _Controller:
    def __init__(self, *zones, groups=()):
        self.zones = {z.uuid: z for z in zones}
        self._groups = {f"G{c}": SimpleNamespace(coordinator_uuid=c, zone_uuids=list(m)) for c, m in groups}
        self.household = SimpleNamespace(id="HH", groups=self._groups,
                                         group_for_zone=lambda u: next(
                                             (g for g in self._groups.values() if u in g.zone_uuids), None))
        self.households = {"HH": self.household}

    def zone(self, uuid):
        if uuid not in self.zones:
            raise KeyError(uuid)
        return self.zones[uuid]

    def coordinator_of(self, uuid):
        return self.zones[self.zone(uuid).coordinator]

    def household_of(self, uuid):
        return self.household

    def account_udn(self, household_id, sid, serial=""):
        return f"SA_RINCON{(sid << 8) | 7}_"


class _Soap:
    """The raw SOAP calls a scene makes: GetEQ answers, Browse pages out a queue."""

    def __init__(self, eq=None, queue=()):
        self.eq = eq or {}
        self.queue = list(queue)
        self.calls = []

    async def call(self, host, service, action, args=None, **kwargs):
        self.calls.append((action, host, dict(args or {})))
        if action == "GetEQ":
            return SimpleNamespace(get=lambda k, d="": str(self.eq.get(args["EQType"], 0)))
        if action == "Browse":
            start = args["StartingIndex"]
            page = self.queue[start:start + args["RequestedCount"]]
            xml = "".join(f'<item id="Q:0/{i}"><dc:title>T{i}</dc:title><res protocolInfo="x">{u}</res></item>'
                          for i, u in enumerate(page, start + 1))
            values = {"Result": xml, "TotalMatches": str(len(self.queue))}
            return SimpleNamespace(get=lambda k, d="": values.get(k, d))
        return SimpleNamespace(get=lambda k, d="": d, args={})


class _Commands:
    """Records every call; refuses what ``refuse`` names, as (method, uuid)."""

    def __init__(self, refuse=(), soap=None, sleep=""):
        self.calls = []
        self.refuse = set(refuse)
        self.soap = soap or _Soap()
        self._sleep = sleep

    def _queueable(self, uri):
        return not uri.startswith(("x-sonosapi-stream:", "x-rincon-stream:", "x-sonos-htastream:"))

    @staticmethod
    def _has_speech_switch(state):
        return state.model_number == "ARC_ULTRA"

    async def sleep_timer_remaining(self, uuid):
        self.calls.append(("sleep_timer_remaining", uuid))
        return self._sleep

    def __getattr__(self, name):
        async def call(*args, **kwargs):
            self.calls.append((name, *args))
            if (name, args[0]) in self.refuse:
                raise SoapFault("701", "Transition not available", "AVTransport", name)
        return call


def _apply(controller, commands, scene):
    return asyncio.run(scenes.apply(controller, commands, scenes.normalize(scene, "HH")))


def test_apply_sets_levels_gathers_rooms_and_starts_the_source():
    ctl = _Controller(_zone("A", "Kitchen", muted=True), _zone("B", "Dining Room"),
                      _zone("C", "Patio", coordinator="B"),
                      groups=(("A", ["A"]), ("B", ["B", "C"])))
    cmd = _Commands()
    report = _apply(ctl, cmd, _one(play={"kind": "item", "uri": "x-sonosapi-stream:s1?sid=254",
                                         "metadata": "<DIDL/>", "title": "Jazz FM"}, play_mode="SHUFFLE"))
    assert report["set"] == ["Kitchen", "Dining Room"] and report["missing"] == [] and report["failed"] == []
    names = [c[0] for c in cmd.calls]
    # Levels first, the mute lifted where a volume was set.
    assert ("set_volume", "A", 25) in cmd.calls and ("set_mute", "A", False) in cmd.calls
    assert ("set_bass", "B", -10) in cmd.calls and ("set_loudness", "B", True) in cmd.calls
    # Nothing to start would have kept a room already leading; with a
    # station to start the first room leads: the dining room joins the
    # kitchen, and the patio, not in the scene, leaves the dining room's group.
    assert ("join", "B", "A") in cmd.calls and ("unjoin", "C") in cmd.calls
    # The station starts on the lead, then the mode and the timer.
    assert ("play_now", "A", "x-sonosapi-stream:s1?sid=254", "<DIDL/>") in cmd.calls
    assert ("set_play_mode", "A", "SHUFFLE") in cmd.calls and ("set_sleep_timer", "A", "0:45:00") in cmd.calls
    assert names.index("join") > names.index("set_volume") and names.index("play_now") > names.index("join")
    # What the rooms were is in the report, for an End.
    before = report["before"]
    assert set(before["rooms"]) == {"A", "B", "C"}
    assert before["rooms"]["A"]["muted"] and before["rooms"]["C"]["coordinator"] == "B"
    assert before["rooms"]["B"]["transport"]["state"] == "STOPPED" and before["rooms"]["C"]["transport"] is None


def test_apply_keeps_the_room_already_playing_in_the_lead():
    ctl = _Controller(_zone("A", "Kitchen"), _zone("B", "Dining Room", media_uri="x-sonosapi-stream:x", state="PLAYING"),
                      groups=(("A", ["A"]), ("B", ["B"])))
    cmd = _Commands()
    _apply(ctl, cmd, _body())
    assert ("join", "A", "B") in cmd.calls and not any(c[0] == "unjoin" for c in cmd.calls)
    assert ("set_sleep_timer", "B", "0:45:00") in cmd.calls


def test_apply_several_groups_each_with_their_own_music():
    ctl = _Controller(_zone("A", "Living Room"), _zone("B", "Dining Room", coordinator="A"),
                      _zone("C", "Kitchen", coordinator="A"), _zone("D", "Patio"),
                      groups=(("A", ["A", "B", "C"]), ("D", ["D"])))
    cmd = _Commands()
    scene = {"name": "Party", "groups": [
        {"rooms": [{"uuid": "A", "name": "Living Room", "volume": 20}, {"uuid": "B", "name": "Dining Room", "volume": 20}],
         "play": {"kind": "item", "uri": "x-sonosapi-stream:jazz", "metadata": "<j/>", "title": "Jazz"}},
        {"rooms": [{"uuid": "C", "name": "Kitchen", "volume": 30}],
         "play": {"kind": "item", "uri": "x-sonosapi-stream:pop", "metadata": "<p/>", "title": "Pop"}},
        {"rooms": [{"uuid": "D", "name": "Patio", "volume": 40}],
         "play": {"kind": "line_in", "source": "D"}}]}
    report = _apply(ctl, cmd, scene)
    assert report["set"] == ["Living Room", "Dining Room", "Kitchen", "Patio"] and report["failed"] == []
    # The kitchen steps out of the living room's group to lead its own.
    assert ("unjoin", "C") in cmd.calls
    assert ("play_now", "A", "x-sonosapi-stream:jazz", "<j/>") in cmd.calls
    assert ("play_now", "C", "x-sonosapi-stream:pop", "<p/>") in cmd.calls
    assert ("play_line_in", "D", "D") in cmd.calls and ("play", "D") in cmd.calls
    assert ("join", "B", "A") not in cmd.calls          # already there


def test_apply_reports_missing_rooms_and_refusals_and_carries_on():
    ctl = _Controller(_zone("A", "Kitchen"), _zone("B", "Dining Room", online=False),
                      groups=(("A", ["A"]), ("B", ["B"])))
    cmd = _Commands(refuse={("set_volume", "A"), ("set_play_mode", "A")})
    report = _apply(ctl, cmd, _body())
    assert report["missing"] == ["Dining Room"] and report["set"] == ["Kitchen"]
    # A refused play mode is not a failure: the music plays without it.
    assert report["failed"] == [{"room": "Kitchen", "step": "volume"}]
    # The timer still went out to the room that is there.
    assert ("set_sleep_timer", "A", "0:45:00") in cmd.calls
    # No room at all: nothing is sent, and nothing is reported as set.
    cmd = _Commands()
    report = _apply(_Controller(), cmd, _body())
    assert report["set"] == [] and report["missing"] == ["Kitchen", "Dining Room"] and cmd.calls == []
    assert report["before"] is None


def test_apply_tv_line_in_and_pausing_the_rest():
    ctl = _Controller(_zone("A", "Den", coordinator="B"), _zone("B", "Living Room"),
                      _zone("C", "Office", media_uri="x-sonosapi-stream:x", state="PLAYING"),
                      _zone("D", "Bar", media_uri="x-sonos-htastream:D:spdif", state="PLAYING"),
                      groups=(("B", ["B", "A"]), ("C", ["C"]), ("D", ["D"])))
    cmd = _Commands(refuse={("pause", "C")}, soap=_Soap(eq={"NightMode": 0, "DialogLevel": 1}))
    scene = {"name": "Movie Night",
             "groups": [{"rooms": [{"uuid": "A", "name": "Den", "volume": 30,
                                    "soundbar": {"night_mode": True, "speech": False}}],
                         "play": {"kind": "tv", "source": "A"}}],
             "pause_others": True}
    report = _apply(ctl, cmd, scene)
    assert report["failed"] == []
    # The den steps out of the living room's group before it leads.
    assert ("unjoin", "A") in cmd.calls and ("play_tv", "A") in cmd.calls and ("play", "A") in cmd.calls
    assert ("set_eq", "A", "NightMode", 1) in cmd.calls and ("set_eq", "A", "DialogLevel", 0) in cmd.calls
    # The office's stream refused Pause and was stopped; the TV room was left alone.
    assert ("pause", "C") in cmd.calls and ("stop", "C") in cmd.calls
    assert not any(c[1] == "D" for c in cmd.calls if c[0] != "sleep_timer_remaining")
    # The soundbar's modes were read first, and the paused office remembered as playing.
    assert report["before"]["rooms"]["A"]["eq"] == {"NightMode": 0, "DialogLevel": 1}
    assert report["before"]["rooms"]["C"]["transport"]["state"] == "PLAYING"
    cmd = _Commands()
    _apply(ctl, cmd, {"name": "Vinyl", "groups": [{"rooms": [{"uuid": "B", "name": "Living Room"}],
                                                   "play": {"kind": "line_in", "source": "C"}}]})
    assert ("play_line_in", "B", "C") in cmd.calls
    # Silence pauses a group that is playing (a stream refuses that and is
    # stopped) and leaves one that is not alone.
    cmd = _Commands(refuse={("pause", "C")})
    report = _apply(ctl, cmd, {"name": "Hush", "groups": [{"rooms": [{"uuid": "C", "name": "Office"}], "play": {"kind": "silence"}},
                                                          {"rooms": [{"uuid": "B", "name": "Living Room"}], "play": {"kind": "silence"}}]})
    assert report["failed"] == [] and ("pause", "C") in cmd.calls and ("stop", "C") in cmd.calls
    assert not any(c[0] in ("pause", "stop") and c[1] == "B" for c in cmd.calls)


def test_apply_writes_down_a_queue_it_replaces():
    ctl = _Controller(_zone("A", "Kitchen", media_uri="x-rincon-queue:A#0", state="PLAYING"), groups=(("A", ["A"]),))
    soap = _Soap(queue=[f"x-file-cifs://nas/{i}.mp3" for i in range(250)])
    cmd = _Commands(soap=soap, sleep="0:20:00")
    report = _apply(ctl, cmd, _one(play={"kind": "item", "uri": "x-rincon-cpcontainer:1006206cplaylist", "metadata": "<pl/>"}))
    assert ("replace_queue", "A", "x-rincon-cpcontainer:1006206cplaylist", "<pl/>") in cmd.calls
    before = report["before"]["rooms"]["A"]
    assert len(before["queue"]) == 250 and before["queue"][0]["uri"] == "x-file-cifs://nas/0.mp3"
    assert before["queue"][7]["metadata"].startswith("<DIDL-Lite") and "T8" in before["queue"][7]["metadata"]
    assert before["transport"] == {"state": "PLAYING", "media_uri": "x-rincon-queue:A#0", "media_metadata": "<meta/>", "title": "Jazz FM",
                                   "play_mode": "NORMAL", "track_number": 3, "rel_time": "0:01:30", "sleep": "0:20:00"}
    assert [c[0] for c in soap.calls].count("Browse") == 2


def test_revert_puts_the_rooms_back():
    # Before: the kitchen led the dining room, playing its queue at track 3;
    # the patio stood alone, paused. The scene put the patio under the
    # kitchen, replaced the queue with a playlist, turned everything up and
    # set a timer.
    before = {"name": "Party", "household": "HH", "at": 1e12, "rooms": {
        "A": {"name": "Kitchen", "coordinator": "A", "volume": 20, "muted": False, "bass": 0, "treble": 0, "loudness": True,
              "eq": None, "queue": [{"uri": "x-file-cifs://nas/1.mp3", "metadata": "<m1/>"}],
              "transport": {"state": "PLAYING", "media_uri": "x-rincon-queue:A#0", "media_metadata": "", "play_mode": "NORMAL",
                            "track_number": 3, "rel_time": "0:01:30", "sleep": ""}},
        "B": {"name": "Dining Room", "coordinator": "A", "volume": 20, "muted": False, "bass": 0, "treble": 0, "loudness": True,
              "eq": None, "queue": None, "transport": None},
        "C": {"name": "Patio", "coordinator": "C", "volume": 15, "muted": True, "bass": 2, "treble": 0, "loudness": False,
              "eq": {"NightMode": 1, "DialogLevel": 0}, "queue": None,
              "transport": {"state": "PAUSED_PLAYBACK", "media_uri": "x-sonosapi-stream:x", "media_metadata": "<x/>",
                            "play_mode": "SHUFFLE", "track_number": 0, "rel_time": "", "sleep": ""}},
        "Z": {"name": "Attic", "coordinator": "Z", "volume": 1, "muted": False, "bass": 0, "treble": 0, "loudness": False,
              "eq": None, "queue": None, "transport": None}}}
    now_a = _zone("A", "Kitchen", media_uri="x-rincon-queue:A#0", state="PLAYING", volume=40)
    now_a.transport.play_mode = "NORMAL"
    ctl = _Controller(now_a, _zone("B", "Dining Room", coordinator="A", volume=40),
                      _zone("C", "Patio", coordinator="A", volume=40),
                      groups=(("A", ["A", "B", "C"]),))
    cmd = _Commands(sleep="0:40:00")
    report = asyncio.run(scenes.revert(ctl, cmd, before))
    assert report["set"] == ["Kitchen", "Dining Room", "Patio"] and report["missing"] == ["Attic"] and report["failed"] == []
    names = [c[0] for c in cmd.calls]
    # The patio steps out to stand alone again; the dining room stays with the kitchen.
    assert ("unjoin", "C") in cmd.calls and not any(c[0] == "join" for c in cmd.calls)
    # The kitchen's queue is put back and the transport pointed at it, at the track and place it was.
    assert ("clear_queue", "A") in cmd.calls
    adds = [c for c in cmd.soap.calls if c[0] == "AddMultipleURIsToQueue"]
    assert len(adds) == 1 and adds[0][2]["EnqueuedURIs"] == "x-file-cifs://nas/1.mp3"
    assert ("set_source", "A", "x-rincon-queue:A#0", "") in cmd.calls
    seeks = [c for c in cmd.soap.calls if c[0] == "Seek"]
    assert [s[2] for s in seeks] == [{"InstanceID": 0, "Unit": "TRACK_NR", "Target": 3}] and ("seek_time", "A", "0:01:30") in cmd.calls
    assert "seek_track" not in names
    assert ("play", "A") in cmd.calls and ("set_sleep_timer", "A", None) in cmd.calls
    assert names.index("clear_queue") > names.index("unjoin")
    # The patio, quiet on its own since it stepped out, gets its stream back
    # without being started, shuffled, at its old levels and modes.
    assert ("set_source", "C", "x-sonosapi-stream:x", "<x/>") in cmd.calls and ("play", "C") not in cmd.calls
    assert ("set_play_mode", "C", "SHUFFLE") in cmd.calls
    assert ("set_volume", "C", 15) in cmd.calls and ("set_mute", "C", True) in cmd.calls
    assert ("set_bass", "C", 2) in cmd.calls and ("set_loudness", "C", False) in cmd.calls
    assert ("set_eq", "C", "NightMode", 1) in cmd.calls and ("set_eq", "C", "DialogLevel", 0) in cmd.calls
    # Levels that did not change are left alone.
    assert ("set_volume", "A", 20) in cmd.calls and ("set_loudness", "A", True) not in cmd.calls
    # Nothing is sent for a room that is gone; a refusal is reported and the rest goes on.
    cmd = _Commands(refuse={("set_volume", "C")})
    report = asyncio.run(scenes.revert(ctl, cmd, before))
    assert report["failed"] == [{"room": "Patio", "step": "volume"}] and ("set_bass", "C", 2) in cmd.calls


def test_revert_leaves_music_that_carried_on_alone():
    # The scene kept what was playing; the stream is still on and at the
    # same place, so the transport is not touched and nothing jumps back.
    before = {"name": "Keep", "household": "HH", "at": 1e12, "rooms": {
        "A": {"name": "Kitchen", "coordinator": "A", "volume": 30, "muted": False, "bass": 1, "treble": 2, "loudness": True,
              "eq": None, "queue": None,
              "transport": {"state": "PLAYING", "media_uri": "x-sonosapi-stream:x", "media_metadata": "", "play_mode": "NORMAL",
                            "track_number": 0, "rel_time": "", "sleep": ""}}}}
    ctl = _Controller(_zone("A", "Kitchen", media_uri="x-sonosapi-stream:x", state="PLAYING"), groups=(("A", ["A"]),))
    cmd = _Commands()
    asyncio.run(scenes.revert(ctl, cmd, before))
    assert [c[0] for c in cmd.calls] == ["sleep_timer_remaining"]


def test_capture_reads_the_rooms_as_they_stand():
    ctl = _Controller(_zone("A", "Kitchen", coordinator="B"),
                      _zone("B", "Dining Room", media_uri="x-sonosapi-stream:s1?sid=254"),
                      _zone("C", "Patio", media_uri="x-sonos-htastream:C:spdif"),
                      groups=(("B", ["B", "A"]), ("C", ["C"])))
    body = scenes.capture(ctl, [["A", "B", "nowhere"], ["C"], ["nowhere"]])
    assert [[r["name"] for r in g["rooms"]] for g in body["groups"]] == [["Kitchen", "Dining Room"], ["Patio"]]
    assert body["groups"][0]["household"] == "HH"
    first = body["groups"][0]
    assert first["rooms"][0]["volume"] == 30 and first["rooms"][0]["tone"] == {"bass": 1, "treble": 2, "loudness": True}
    assert first["play"] == {"kind": "item", "uri": "x-sonosapi-stream:s1?sid=254", "metadata": "<meta/>",
                             "title": "Jazz FM", "art": "http://art", "item_kind": "station", "service": "", "source": ""}
    assert body["groups"][1]["play"]["kind"] == "tv" and body["groups"][1]["play"]["source"] == "C"
    queued = _Controller(_zone("B", "Dining Room", media_uri="x-rincon-queue:B#0"), groups=(("B", ["B"]),))
    assert scenes.capture(queued, [["B"]])["groups"][0]["play"] is None


def test_a_group_keeping_its_levels_sends_no_volume_or_tone():
    ctl = _Controller(_zone("A", "Kitchen", muted=True), _zone("B", "Dining Room"), groups=(("A", ["A"]), ("B", ["B"])))
    cmd = _Commands()
    scene = {"name": "As You Were",
             "groups": [{"rooms": [{"uuid": "A", "name": "Kitchen", "volume": 25, "tone": {"bass": 3, "treble": -2, "loudness": False},
                                    "soundbar": {"night_mode": True, "speech": True}}],
                         "keep_levels": True, "play": {"kind": "item", "uri": "x-sonosapi-stream:s1?sid=254", "metadata": "<DIDL/>", "title": "Jazz FM"}},
                        {"rooms": [{"uuid": "B", "name": "Dining Room", "volume": 40}]}]}
    report = _apply(ctl, cmd, scene)
    assert report["failed"] == []
    # The kitchen's levels and modes are left as they stand; its music still starts.
    assert not any(c[0] in ("set_volume", "set_mute", "set_bass", "set_treble", "set_loudness", "set_eq") and c[1] == "A" for c in cmd.calls)
    assert any(c[0] == "play_now" and c[1] == "A" for c in cmd.calls)
    # The other group's volume goes out as ever.
    assert ("set_volume", "B", 40) in cmd.calls


def test_ending_a_scene_resumes_only_the_rooms_it_paused():
    # Office played and was paused by the scene; the den was paused already, the bar stopped.
    ctl = _Controller(_zone("A", "Kitchen"),
                      _zone("C", "Office", media_uri="x-sonosapi-stream:x", state="PLAYING"),
                      _zone("D", "Den", media_uri="x-sonosapi-stream:y", state="PAUSED_PLAYBACK"),
                      _zone("E", "Bar", media_uri="x-sonosapi-stream:z", state="STOPPED"),
                      groups=(("A", ["A"]), ("C", ["C"]), ("D", ["D"]), ("E", ["E"])))
    cmd = _Commands()
    report = _apply(ctl, cmd, {"name": "Dinner", "pause_others": True,
                               "groups": [{"rooms": [{"uuid": "A", "name": "Kitchen", "volume": 20}]}]})
    assert ("pause", "C") in cmd.calls
    assert not any(c[0] in ("pause", "stop", "play") and c[1] in ("D", "E") for c in cmd.calls)
    # Later, the office stands paused where the scene left it.
    ctl.zones["C"].transport.state = "PAUSED_PLAYBACK"
    cmd = _Commands()
    asyncio.run(scenes.revert(ctl, cmd, report["before"]))
    assert ("play", "C") in cmd.calls
    assert not any(c[0] == "play" and c[1] in ("D", "E") for c in cmd.calls)


def test_revert_leaves_a_room_that_was_quiet_quiet():
    # The office stood stopped on its queue; the scene played a playlist
    # there. Ending the scene stops the office before its queue goes back,
    # or the player, still playing, would take up the queue and go on.
    before = {"name": "Office only", "household": "HH", "at": 1e12, "rooms": {
        "A": {"name": "Office", "coordinator": "A", "volume": 20, "muted": False, "bass": 0, "treble": 0, "loudness": True,
              "eq": None, "queue": [{"uri": "x-file-cifs://nas/1.mp3", "metadata": "<m1/>"}],
              "transport": {"state": "STOPPED", "media_uri": "x-rincon-queue:A#0", "media_metadata": "", "play_mode": "NORMAL",
                            "track_number": 2, "rel_time": "0:00:00", "sleep": ""}}}}
    ctl = _Controller(_zone("A", "Office", media_uri="x-rincon-queue:A#0", state="PLAYING", volume=20), groups=(("A", ["A"]),))
    cmd = _Commands()
    report = asyncio.run(scenes.revert(ctl, cmd, before))
    names = [c[0] for c in cmd.calls]
    assert report["failed"] == [] and ("stop", "A") in cmd.calls and "play" not in names and "pause" not in names
    assert names.index("stop") < names.index("clear_queue") < names.index("set_source")
    # Paused on the same source, the room is paused where it is rather than stopped.
    before["rooms"]["A"]["queue"] = None
    before["rooms"]["A"]["transport"]["state"] = "PAUSED_PLAYBACK"
    cmd = _Commands()
    asyncio.run(scenes.revert(ctl, cmd, before))
    assert ("pause", "A") in cmd.calls and ("stop", "A") not in cmd.calls and ("play", "A") not in cmd.calls
    # And a room that is already quiet is left alone.
    ctl.zones["A"].transport.state = "STOPPED"
    cmd = _Commands()
    asyncio.run(scenes.revert(ctl, cmd, before))
    assert not any(c[0] in ("pause", "stop", "play") for c in cmd.calls)


def test_revert_sends_a_queue_back_bare():
    ctl = _Controller(_zone("A", "Den", media_uri="x-sonosapi-stream:x", state="PLAYING"), groups=(("A", ["A"]),))
    before = {"name": "Dinner Party", "at": 1.0e12, "rooms": {"A": {
        "name": "Den", "coordinator": "A", "volume": 20, "muted": False, "bass": 0, "treble": 0, "loudness": True,
        "eq": None, "queue": None,
        "transport": {"state": "STOPPED", "media_uri": "x-rincon-queue:A#0", "media_metadata": "", "title": "",
                      "play_mode": "NORMAL", "track_number": 0, "rel_time": "", "sleep": ""}}}}
    cmd = _Commands()
    asyncio.run(scenes.revert(ctl, cmd, before))
    assert ("set_source", "A", "x-rincon-queue:A#0", "") in cmd.calls


def test_revert_composes_metadata_for_a_bare_station():
    # The den stood stopped on a station its speaker held no metadata for;
    # sent back bare, the URI would be refused, so the descriptor is made
    # from the URI, the title, and the household's account.
    before = {"name": "Bare", "household": "HH", "at": 1e12, "rooms": {
        "A": {"name": "Den", "coordinator": "A", "volume": 10, "muted": False, "bass": 0, "treble": 0, "loudness": True,
              "eq": None, "queue": None,
              "transport": {"state": "STOPPED", "media_uri": "x-sonosapi-stream:stream_100?sid=894&flags=8232&sn=5",
                            "media_metadata": "", "title": "Radio X", "play_mode": "NORMAL",
                            "track_number": 0, "rel_time": "", "sleep": ""}}}}
    ctl = _Controller(_zone("A", "Den", media_uri="x-sonosapi-stream:other?sid=516", state="PLAYING"), groups=(("A", ["A"]),))
    cmd = _Commands()
    report = asyncio.run(scenes.revert(ctl, cmd, before))
    sent = [c for c in cmd.calls if c[0] == "set_source"]
    assert report["failed"] == [] and len(sent) == 1 and sent[0][2] == before["rooms"]["A"]["transport"]["media_uri"]
    assert "<dc:title>Radio X</dc:title>" in sent[0][3] and "SA_RINCON228871_</desc>" in sent[0][3]
    assert 'id="F00092020stream_100"' in sent[0][3]
    assert ("stop", "A") in cmd.calls and ("play", "A") not in cmd.calls


def test_normalize_keeps_the_service_name():
    body = {"name": "Eighties", "groups": [{"household": "HH", "rooms": [{"uuid": "A"}],
            "play": {"kind": "item", "uri": "x-sonosapi-stream:x?sid=321", "title": "80s80s Reggae", "service": "80s80s - REAL 80s Radio"}}]}
    scene = scenes.normalize(body)
    assert scene["groups"][0]["play"]["service"] == "80s80s - REAL 80s Radio"


def test_a_regrouping_is_waited_on_until_the_speakers_report_it(monkeypatch):
    monkeypatch.setattr(scenes, "GROUP_SETTLE", 2.0)
    ctl = _Controller(_zone("A", "Kitchen"), _zone("B", "Dining Room", coordinator="A"), groups=(("A", ["A", "B"]),))
    looks = []

    async def go():
        async def regroup():
            await asyncio.sleep(0.25)
            ctl.zones["B"].coordinator = "B"
        asyncio.get_running_loop().create_task(regroup())
        started = asyncio.get_running_loop().time()
        await scenes._settle_groups(ctl, {"B": "B"})
        looks.append(asyncio.get_running_loop().time() - started)
    asyncio.run(go())
    assert 0.2 < looks[0] < 1.5


def test_a_group_with_a_delay_is_handed_back_for_later():
    ctl = _Controller(_zone("A", "Kitchen"), _zone("B", "Dining Room"), groups=(("A", ["A"]), ("B", ["B"])))
    cmd = _Commands()
    body = _body()
    body["groups"] = [{"rooms": [{"uuid": "A", "name": "Kitchen", "volume": 25}], "play": None, "play_mode": None},
                      {"rooms": [{"uuid": "B", "name": "Dining Room", "volume": 20}], "play": None, "play_mode": None, "delay": 10}]
    report = _apply(ctl, cmd, body)
    assert report["set"] == ["Kitchen"]
    assert report["later"] == [{"minutes": 10, "rooms": ["Dining Room"]}]
    assert [g["rooms"][0]["uuid"] for g in report["later_groups"]] == ["B"]
    assert ("set_volume", "B", 20) not in cmd.calls
    assert "B" not in report["before"]["rooms"]


def test_a_later_group_adds_its_rooms_to_the_record(tmp_path):
    store = scenes.Active(tmp_path / "s.json")
    store.set("sc_1", {"name": "Dinner", "at": 1.0e12, "rooms": {"A": {"volume": 10}}})
    store.merge("sc_1", {"rooms": {"A": {"volume": 99}, "B": {"volume": 20}}})
    assert store.get("sc_1")["rooms"] == {"A": {"volume": 10}, "B": {"volume": 20}}
    store.merge("sc_2", {"rooms": {"C": {}}})
    assert store.get("sc_2") is None


def test_a_source_without_play_modes_refusing_one_is_not_a_failure():
    ctl = _Controller(_zone("A", "Kitchen"), groups=(("A", ["A"]),))
    cmd = _Commands(refuse={("set_play_mode", "A")})
    report = _apply(ctl, cmd, _one(play={"kind": "item", "uri": "x-sonosapi-stream:s1?sid=254", "title": "KPCC"}, play_mode="SHUFFLE"))
    assert report["set"] == ["Kitchen"]
    assert report["failed"] == []
    assert ("play_now", "A", "x-sonosapi-stream:s1?sid=254", "") in cmd.calls or any(c[0] == "play_now" for c in cmd.calls)


def test_groups_waiting_on_their_delay_outlive_a_restart(tmp_path):
    # A scene's delayed groups are kept with its record, each with when it is
    # due, so Sonora can set them on time after a restart instead of losing them.
    path = tmp_path / "scene_state.json"
    store = scenes.Active(path)
    store.set("sc_1", {"name": "timer test", "at": time.time(), "rooms": {}})
    group = {"rooms": [{"uuid": "RINCON_A", "name": "Office"}], "delay": 2, "sleep": 5, "play": None}
    store.set_later("sc_1", [{"id": 0, "due": 1000.0, "group": group},
                             {"id": 1, "due": 2000.0, "group": {**group, "delay": 5}}])
    again = scenes.Active(path)
    name, waiting = again.waiting()["sc_1"]
    assert name == "timer test" and [e["due"] for e in waiting] == [1000.0, 2000.0]
    assert waiting[0]["group"]["rooms"][0]["name"] == "Office"
    # Once set, a group is forgotten; with none left the scene waits on nothing.
    again.drop_later("sc_1", 0)
    assert [e["id"] for e in scenes.Active(path).waiting()["sc_1"][1]] == [1]
    again.drop_later("sc_1", 1)
    assert "sc_1" not in scenes.Active(path).waiting()


def test_setting_a_scene_again_replaces_what_waited(tmp_path):
    store = scenes.Active(tmp_path / "s.json")
    store.set("sc_1", {"name": "t", "at": time.time(), "rooms": {}})
    store.set_later("sc_1", [{"id": 0, "due": 1.0, "group": {}}])
    store.set_later("sc_1", [])
    assert store.waiting() == {}


def test_a_test_starts_every_group_now_and_sets_no_timer(monkeypatch):
    # Testing a scene is for hearing it: a group's start delay and play
    # duration are left out of the test, and stay in the saved scene.
    import backend.main as main
    seen = {}

    async def run(scene, key, page=""):
        seen.update(scene=scene, key=key)
        return {"active": key}
    monkeypatch.setattr(main, "_run_scene", run)
    body = main.SceneBody(name="timer test", groups=[
        {"household": "S1", "rooms": [{"uuid": "RINCON_A", "name": "Office", "volume": 20}], "delay": 2, "sleep": 5},
        {"household": "S2", "rooms": [{"uuid": "RINCON_B", "name": "Guest Room", "volume": 20}], "delay": 5, "sleep": 7},
    ])
    asyncio.run(main.apply_unsaved_scene(body, page="p1"))
    assert seen["key"] == "try"
    assert [(g.get("delay"), g.get("sleep")) for g in seen["scene"]["groups"]] == [(None, None), (None, None)]
    assert scenes.ends_after(seen["scene"]) is None


def test_a_restart_sets_a_group_whose_time_came_while_sonora_was_down(monkeypatch, tmp_path):
    import backend.main as main
    store = scenes.Active(tmp_path / "scene_state.json")
    store.set("sc_1", {"name": "timer test", "at": time.time(), "rooms": {}})
    group = {"rooms": [{"uuid": "RINCON_A", "name": "Office", "volume": 20}], "delay": 2, "sleep": 5, "play": None}
    store.set_later("sc_1", [{"id": 0, "due": time.time() - 30, "group": group}])
    monkeypatch.setattr(main, "_ACTIVE", store)
    monkeypatch.setattr(main, "_PENDING", {})
    monkeypatch.setattr(main, "_TIMED", {})
    monkeypatch.setattr(main, "controller", lambda: None)
    monkeypatch.setattr(main, "commands", lambda: None)
    monkeypatch.setattr(main, "_check_test_later", lambda *_: None)
    set_now = []

    async def apply(controller, commands, scene, metadata_for=None):
        set_now.append(scene)
        return {"before": {"rooms": {}}}

    async def changed():
        return None
    monkeypatch.setattr(main.scenes, "apply", apply)
    monkeypatch.setattr(main, "_scenes_changed", changed)

    async def run():
        main._resume_scene_ends()
        await asyncio.gather(*main._PENDING.get("sc_1", []))
    asyncio.run(run())
    assert len(set_now) == 1
    assert set_now[0]["groups"][0]["rooms"][0]["name"] == "Office"
    assert set_now[0]["groups"][0]["delay"] is None
    assert store.waiting() == {}
