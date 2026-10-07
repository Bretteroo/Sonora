"""Playback dropouts: pauses to buffer mid-track, and sources a speaker
could not play (sonos/dropouts.py)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from backend.sonos import dropouts
from backend.sonos.dropouts import DropoutLog, DropoutWatch
from backend.sonos.models import TransportState


def room(**transport):
    return SimpleNamespace(uuid="Z", name="Pantry", transport=TransportState(
        track_uri="aac://http://ice6.somafm.com/digitalis", track_number=1,
        container_title="Digitalis", service_name="SomaFM Radio", **transport))


def run(watch, state, *steps):
    async def go():
        for before, after, pause in steps:
            await watch.transport(state, before, after)
            if pause:
                await asyncio.sleep(pause)
    asyncio.run(go())


def watcher(positions=()):
    queue = list(positions)

    async def where(_state):
        return queue.pop(0) if queue else None
    return DropoutWatch(DropoutLog(), where)


def test_a_pause_to_buffer_on_the_same_track_is_logged(monkeypatch):
    monkeypatch.setattr(dropouts, "MIN_STALL_S", 0.05)
    watch, kitchen = watcher(), room()
    run(watch, kitchen, ("PLAYING", "TRANSITIONING", 0.08), ("TRANSITIONING", "PLAYING", 0))
    [entry] = watch.log.recent()
    assert entry["kind"] == "buffering" and entry["room"] == "Pantry"
    assert entry["seconds"] >= 0.05 and entry["source"] == "Digitalis"


def test_a_track_change_is_not_a_dropout(monkeypatch):
    monkeypatch.setattr(dropouts, "MIN_STALL_S", 0.05)
    watch, kitchen = watcher(), room()
    async def go():
        await watch.transport(kitchen, "PLAYING", "TRANSITIONING")
        await asyncio.sleep(0.08)
        kitchen.transport.track_number = 2
        await watch.transport(kitchen, "TRANSITIONING", "PLAYING")
    asyncio.run(go())
    assert watch.log.recent() == []


def test_a_seek_is_not_a_dropout(monkeypatch):
    monkeypatch.setattr(dropouts, "MIN_STALL_S", 0.05)
    watch, kitchen = watcher(positions=[30.0, 95.0]), room()
    run(watch, kitchen, ("PLAYING", "TRANSITIONING", 0.08), ("TRANSITIONING", "PLAYING", 0))
    assert watch.log.recent() == []


def test_a_short_hand_off_and_a_pause_by_hand_are_not_dropouts():
    watch, kitchen = watcher(), room()
    run(watch, kitchen, ("PLAYING", "TRANSITIONING", 0), ("TRANSITIONING", "PLAYING", 0))
    run(watch, kitchen, ("PLAYING", "TRANSITIONING", 0), ("TRANSITIONING", "PAUSED_PLAYBACK", 0))
    assert watch.log.recent() == []


def test_a_source_the_speaker_could_not_play(tmp_path):
    log = DropoutLog(tmp_path / "dropouts.json")
    watch = DropoutWatch(log, lambda _s: None)
    asyncio.run(watch.failed(room(), carried_on=True, item="Ad break",
                             service="Pandora", reason="ERROR_CANT_REACH_SERVER"))
    again = DropoutLog(tmp_path / "dropouts.json")
    again.load()
    [entry] = again.recent()
    assert (entry["kind"], entry["title"], entry["detail"]) == ("skipped", "Ad break", "ERROR_CANT_REACH_SERVER")


def test_the_log_keeps_a_week():
    log = DropoutLog(max_entries=3)
    import time
    now = time.time()
    for age in (8 * 86400, 2, 1, 0.5, 0):
        log.add({"time": now - age})
    assert len(log.recent()) == 3 and all(now - e["time"] < 86400 for e in log.recent())
