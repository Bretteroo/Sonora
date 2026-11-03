"""Alarms that set a scene: Sonora's own, kept on disk beside the scenes.

The speakers' alarms each ring in one room, which a scene has no use for, so
an alarm that sets a scene is not a speaker alarm at all. Sonora keeps it,
lists it with the system's own alarms, and sets the scene when its time comes
on the system's clock (the speakers' local time, which may not be this
machine's). Like everything else Sonora does, it happens only while Sonora runs.

An alarm is stored in the speakers' own terms, so the alarm windows read it as
they read theirs: ``StartTime`` ("HH:MM:SS") and ``Recurrence`` ("ONCE",
"DAILY", "WEEKDAYS", "WEEKENDS" or "ON_" and the days, 0 = Sunday).
"""

from __future__ import annotations

import json
import os
import re
import secrets
from datetime import datetime
from pathlib import Path

#: The prefix of a scene alarm's id, which no speaker alarm id has.
ID_PREFIX = "sa_"
_TIME_RE = re.compile(r"^\d{2}:\d{2}:\d{2}$")
_RECURRENCE_RE = re.compile(r"^(ONCE|DAILY|WEEKDAYS|WEEKENDS|ON_[0-6]{1,7})$")


def is_scene_alarm(alarm_id: str) -> bool:
    return str(alarm_id).startswith(ID_PREFIX)


def recurs_on(recurrence: str, day: datetime) -> bool:
    """Whether an alarm of ``recurrence`` goes off on ``day`` (ONCE: any day)."""
    weekday = (day.weekday() + 1) % 7                # 0 = Sunday, as the speakers count
    if recurrence in ("ONCE", "DAILY"):
        return True
    if recurrence == "WEEKDAYS":
        return 1 <= weekday <= 5
    if recurrence == "WEEKENDS":
        return weekday in (0, 6)
    if recurrence.startswith("ON_"):
        return str(weekday) in recurrence[3:]
    return False


def due(alarm: dict, local: datetime) -> bool:
    """Whether ``alarm`` goes off in the minute ``local`` (the system's time) is in."""
    return (alarm.get("Enabled") == "1" and alarm.get("StartTime", "")[:5] == local.strftime("%H:%M")
            and recurs_on(alarm.get("Recurrence", ""), local))


class SceneAlarms:
    """The scene alarms, in one JSON file."""

    def __init__(self, path: Path) -> None:
        self._path = path
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            data = {}
        self._items: list[dict] = [a for a in data.get("alarms", []) if isinstance(a, dict) and is_scene_alarm(a.get("ID", ""))]

    def items(self, household: str | None = None) -> list[dict]:
        return [dict(a) for a in self._items if household is None or a["household"] == household]

    def get(self, alarm_id: str) -> dict | None:
        return next((dict(a) for a in self._items if a["ID"] == alarm_id), None)

    def save(self, household: str, scene: str, start_time: str, recurrence: str, enabled: bool,
             alarm_id: str = "") -> dict:
        """Add an alarm, or replace the one ``alarm_id`` names."""
        if not _TIME_RE.match(start_time):
            raise ValueError("start_time must be HH:MM:SS")
        if not _RECURRENCE_RE.match(recurrence):
            raise ValueError(f"unknown recurrence {recurrence!r}")
        alarm = {"ID": alarm_id or ID_PREFIX + secrets.token_hex(6), "household": household, "scene": scene,
                 "StartTime": start_time, "Recurrence": recurrence, "Enabled": "1" if enabled else "0"}
        self._items = [a for a in self._items if a["ID"] != alarm["ID"]] + [alarm]
        self._write()
        return dict(alarm)

    def set_enabled(self, alarm_id: str, enabled: bool) -> bool:
        for alarm in self._items:
            if alarm["ID"] == alarm_id:
                alarm["Enabled"] = "1" if enabled else "0"
                self._write()
                return True
        return False

    def remove(self, alarm_id: str) -> bool:
        kept = [a for a in self._items if a["ID"] != alarm_id]
        if len(kept) == len(self._items):
            return False
        self._items = kept
        self._write()
        return True

    def remove_scene(self, scene: str) -> int:
        """Delete every alarm that sets ``scene``; how many there were."""
        kept = [a for a in self._items if a["scene"] != scene]
        removed = len(self._items) - len(kept)
        if removed:
            self._items = kept
            self._write()
        return removed

    def _write(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(".tmp")
        temp.write_text(json.dumps({"alarms": self._items}, indent=1))
        os.replace(temp, self._path)

