"""Alarms that set a scene: Sonora's own store, and when each one goes off."""

from datetime import datetime

import pytest

from backend.sonos import scene_alarms
from backend.sonos.scene_alarms import SceneAlarms

# 2026-11-02 is a Monday, 2026-11-07 a Saturday, 2026-11-08 a Sunday.
MONDAY, SATURDAY, SUNDAY = datetime(2026, 11, 2, 7, 0, 30), datetime(2026, 11, 7, 7, 0), datetime(2026, 11, 8, 7, 0)


@pytest.mark.parametrize("recurrence, monday, saturday, sunday", [
    ("ONCE", True, True, True),
    ("DAILY", True, True, True),
    ("WEEKDAYS", True, False, False),
    ("WEEKENDS", False, True, True),
    ("ON_0", False, False, True),
    ("ON_16", True, True, False),
])
def test_each_recurrence_goes_off_on_its_days(recurrence, monday, saturday, sunday):
    assert [scene_alarms.recurs_on(recurrence, d) for d in (MONDAY, SATURDAY, SUNDAY)] == [monday, saturday, sunday]


def test_an_alarm_is_due_in_its_minute_only_and_only_when_on():
    alarm = {"StartTime": "07:00:00", "Recurrence": "DAILY", "Enabled": "1"}
    assert scene_alarms.due(alarm, MONDAY)
    assert not scene_alarms.due(alarm, MONDAY.replace(minute=1))
    assert not scene_alarms.due({**alarm, "Enabled": "0"}, MONDAY)


def test_the_store_keeps_alarms_by_system_and_scene(tmp_path):
    path = tmp_path / "scene_alarms.json"
    store = SceneAlarms(path)
    first = store.save("S1", "sc_a", "07:00:00", "DAILY", True)
    second = store.save("S2", "sc_b", "08:30:00", "ON_135", False)
    assert scene_alarms.is_scene_alarm(first["ID"]) and first["ID"] != second["ID"]
    again = SceneAlarms(path)
    assert [a["scene"] for a in again.items("S1")] == ["sc_a"]
    assert again.get(second["ID"])["Enabled"] == "0"
    # Saving under an id replaces that alarm.
    again.save("S1", "sc_b", "06:45:00", "WEEKDAYS", True, first["ID"])
    assert again.get(first["ID"])["StartTime"] == "06:45:00" and len(again.items()) == 2
    assert again.set_enabled(first["ID"], False) and again.get(first["ID"])["Enabled"] == "0"
    # Deleting a scene deletes every alarm that sets it.
    assert again.remove_scene("sc_b") == 2 and again.items() == []
    assert not again.remove(first["ID"])


def test_the_store_refuses_a_malformed_time_or_recurrence(tmp_path):
    store = SceneAlarms(tmp_path / "scene_alarms.json")
    with pytest.raises(ValueError):
        store.save("S1", "sc_a", "7:00", "DAILY", True)
    with pytest.raises(ValueError):
        store.save("S1", "sc_a", "07:00:00", "SOMETIMES", True)


@pytest.fixture
def two_systems(monkeypatch, tmp_path):
    from types import SimpleNamespace
    from backend import main
    from backend.sonos import scenes
    households = {"S1": SimpleNamespace(id="S1"), "S2": SimpleNamespace(id="S2")}
    rooms = {"r1": "S1", "r2": "S2"}
    fake = SimpleNamespace(zones={}, households=households,
                           household_of=lambda uuid: households.get(rooms.get(uuid, "")))

    async def speaker_alarms(zone):
        return [{"ID": "1", "RoomUUID": "", "StartTime": "06:00:00"}] if rooms[zone] == "S1" else []
    monkeypatch.setattr(main, "controller", lambda: fake)
    monkeypatch.setattr(main, "commands", lambda: SimpleNamespace(alarms=speaker_alarms))
    store = scenes.Scenes(tmp_path / "scenes.json")
    monkeypatch.setattr(main, "_SCENES", store)
    monkeypatch.setattr(main, "_SCENE_ALARMS", SceneAlarms(tmp_path / "scene_alarms.json"))
    on_s2 = store.add({"name": "Upstairs", "groups": [{"household": "S2", "rooms": [{"uuid": "r2", "name": "r2"}], "play": None}]})
    return SimpleNamespace(main=main, scene=on_s2["id"])


def test_every_scene_alarm_is_listed_whichever_system_is_read(two_systems):
    import asyncio
    main = two_systems.main
    main._SCENE_ALARMS.save("S1", two_systems.scene, "07:00:00", "DAILY", True)
    main._SCENE_ALARMS.save("S2", two_systems.scene, "08:00:00", "DAILY", True)
    for room in ("r1", "r2"):
        listed = asyncio.run(main._named_alarms(room))
        assert sorted(a["StartTime"] for a in listed if a.get("scene")) == ["07:00:00", "08:00:00"]
    assert len(asyncio.run(main._named_alarms("r1"))) == 3


def test_a_scene_alarm_keeps_the_clock_of_a_system_its_scene_plays_on(two_systems):
    main = two_systems.main

    def body(zone):
        return main.AlarmDefinition(zone=zone, start_time="07:00:00", recurrence="DAILY", scene=two_systems.scene)
    # Made while S1 is selected, it goes on the clock of S2, where its scene plays.
    main._save_scene_alarm(body("r1"))
    alarm = main._SCENE_ALARMS.items()[0]
    assert alarm["household"] == "S2"
    # Edited from the other system, it keeps the clock it has.
    main._SCENE_ALARMS.save("S1", alarm["scene"], "07:00:00", "DAILY", True, alarm["ID"])
    main._save_scene_alarm(body("r2"), alarm["ID"])
    assert main._SCENE_ALARMS.get(alarm["ID"])["household"] == "S1"
