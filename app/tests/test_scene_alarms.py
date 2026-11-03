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
