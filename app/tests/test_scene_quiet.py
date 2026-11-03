"""Asking whether to end a scene whose rooms have all gone quiet: not while
Sonora is setting or ending a scene itself, and not about rooms a later
scene has taken over."""

import asyncio
import time
from types import SimpleNamespace

import pytest

from backend import main
from backend.sonos import scenes


def _zone(state):
    return SimpleNamespace(online=True, transport=SimpleNamespace(state=state))


@pytest.fixture
def house(monkeypatch, tmp_path):
    zones = {"A": _zone("PLAYING"), "B": _zone("PLAYING")}
    fake = SimpleNamespace(zones=zones, coordinator_of=lambda uuid: zones[uuid])
    monkeypatch.setattr(main, "controller", lambda: fake)
    store = scenes.Scenes(tmp_path / "scenes.json")
    monkeypatch.setattr(main, "_SCENES", store)
    monkeypatch.setattr(main, "_ACTIVE", scenes.Active(tmp_path / "scene_state.json"))
    monkeypatch.setattr(main, "_HEARD", set())
    monkeypatch.setattr(main, "_QUIET", {})
    monkeypatch.setattr(main, "_scene_busy", {"working": 0, "until": 0.0})
    monkeypatch.setattr(main, "QUIET_FOR", 0.01)
    sent = []

    async def fan_out(message):
        sent.append(message)
    monkeypatch.setattr(main, "_fan_out", fan_out)

    def add(name, rooms, at):
        scene = store.add({"name": name, "groups": [{"rooms": [{"uuid": u, "name": u} for u in rooms], "play": None}]})
        main._ACTIVE.set(scene["id"], {"name": name, "at": time.time() + at, "rooms": {u: {} for u in rooms}})
        return scene["id"]
    return SimpleNamespace(zones=zones, sent=sent, add=add)


def test_a_scene_silenced_by_hand_is_asked_about(house):
    async def run():
        key = house.add("Dinner", ["A"], 1)
        await main._watch_scenes({"type": "zone"})
        house.zones["A"] = _zone("PAUSED_PLAYBACK")
        await main._watch_scenes({"type": "zone"})
        await asyncio.sleep(0.05)
        assert house.sent == [{"type": "sceneQuiet", "key": key, "name": "Dinner"}]
    asyncio.run(run())


def test_nothing_is_asked_while_sonora_sets_or_ends_a_scene(house):
    async def run():
        house.add("Dinner", ["A"], 1)
        await main._watch_scenes({"type": "zone"})
        main._scene_busy["working"] = 1
        house.zones["A"] = _zone("STOPPED")
        await main._watch_scenes({"type": "zone"})
        await asyncio.sleep(0.05)
        assert house.sent == []
    asyncio.run(run())


def test_a_room_a_later_scene_holds_is_judged_there(house):
    async def run():
        house.add("Dinner", ["A"], 1)
        late = house.add("Quiet", ["A", "B"], 2)
        await main._watch_scenes({"type": "zone"})
        house.zones["A"] = _zone("PAUSED_PLAYBACK")
        await main._watch_scenes({"type": "zone"})
        await asyncio.sleep(0.05)
        # Dinner's only room is Quiet's now, and Quiet still plays in B.
        assert house.sent == []
        house.zones["B"] = _zone("STOPPED")
        await main._watch_scenes({"type": "zone"})
        await asyncio.sleep(0.05)
        assert [m["key"] for m in house.sent] == [late]
    asyncio.run(run())
