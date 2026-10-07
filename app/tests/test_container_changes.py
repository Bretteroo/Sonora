"""A household's containers are announced once, not once per player.

ContentDirectory publishes ``ContainerUpdateIDs`` on every player. The queue
is the player's own, but favorites, Sonos playlists, and saved stations belong
to the household, so each player reports the same change and one edit used to
reach the interface as many times as there were rooms.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import SonosController


def _controller():
    """The method under test, bound to a stand-in with just what it reads."""
    zones = {
        "10.0.0.1": SimpleNamespace(uuid="A"),
        "10.0.0.2": SimpleNamespace(uuid="B"),
    }
    household = SimpleNamespace(id="H")
    sent: list[dict] = []

    async def broadcast(message):
        sent.append(message)

    fake = SimpleNamespace(
        _container_ids={},
        _container_said={},
        _zone_for_host=lambda host: zones.get(host),
        household_of=lambda uuid: household,
        _broadcast=broadcast,
        sent=sent,
    )
    fake.note = lambda event: SonosController._note_container_changes(fake, event)
    return fake


def _event(host, raw):
    return SimpleNamespace(host=host, properties={"ContainerUpdateIDs": raw})


def _run(ctl, *events):
    async def go():
        for event in events:
            await ctl.note(event)
    asyncio.run(go())
    return ctl.sent


def test_a_favorite_edit_is_announced_once_for_the_household():
    ctl = _controller()
    # Each player's first report is its subscription's opening snapshot.
    _run(ctl, _event("10.0.0.1", "FV:2,7"), _event("10.0.0.2", "FV:2,7"))
    assert ctl.sent == []
    # The edit: both players report the new revision, the interface hears once.
    _run(ctl, _event("10.0.0.1", "FV:2,8"), _event("10.0.0.2", "FV:2,8"))
    assert [m["type"] for m in ctl.sent] == ["favorites"]


def test_playlists_and_stations_are_household_wide_too():
    ctl = _controller()
    _run(ctl, _event("10.0.0.1", "SQ:,3,R:0,4"), _event("10.0.0.2", "SQ:,3,R:0,4"))
    assert ctl.sent == []
    _run(ctl, _event("10.0.0.1", "SQ:,4,R:0,5"), _event("10.0.0.2", "SQ:,4,R:0,5"))
    assert [m["type"] for m in ctl.sent] == ["playlists", "radio"]


def test_players_that_count_differently_still_announce_once():
    """The counters are each player's own, not the household's.

    Read off a real household on 2026-09-21: eight players answered one edit
    of the saved stations with eight revisions of their own, and keying the
    last-seen revision on the household made every one of them look like a
    fresh change -- 56 edits were announced 319 times in a day.
    """
    ctl = _controller()
    _run(ctl, _event("10.0.0.1", "FV:2,7"), _event("10.0.0.2", "FV:2,41"))
    assert ctl.sent == []
    _run(ctl, _event("10.0.0.1", "FV:2,8"), _event("10.0.0.2", "FV:2,42"))
    assert [m["type"] for m in ctl.sent] == ["favorites"]


def test_a_later_edit_is_announced_again(monkeypatch):
    """Quiet for the burst, not for the day."""
    from backend.sonos import controller as module
    clock = [1000.0]
    monkeypatch.setattr(module, "monotonic", lambda: clock[0])
    ctl = _controller()
    _run(ctl, _event("10.0.0.1", "FV:2,7"), _event("10.0.0.2", "FV:2,41"))
    _run(ctl, _event("10.0.0.1", "FV:2,8"), _event("10.0.0.2", "FV:2,42"))
    assert [m["type"] for m in ctl.sent] == ["favorites"]
    clock[0] += module.CONTAINER_BURST + 1
    _run(ctl, _event("10.0.0.1", "FV:2,9"), _event("10.0.0.2", "FV:2,43"))
    assert [m["type"] for m in ctl.sent] == ["favorites", "favorites"]


def test_each_players_queue_still_speaks_for_itself():
    ctl = _controller()
    _run(ctl, _event("10.0.0.1", "Q:0,11"), _event("10.0.0.2", "Q:0,11"))
    assert ctl.sent == []
    # Two rooms, two queues: both changes are news, and each names its room.
    _run(ctl, _event("10.0.0.1", "Q:0,12"), _event("10.0.0.2", "Q:0,12"))
    assert [(m["type"], m["zone"]) for m in ctl.sent] == [("queue", "A"), ("queue", "B")]
