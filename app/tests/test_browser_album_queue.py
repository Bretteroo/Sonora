"""An album or playlist played to This browser has a queue.

The session reads the container whole, answers with its tracks as queue items,
says which one plays, and can be moved to any of them; a station keeps no list.
"""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend import main


def _item(n, duration=203):
    return SimpleNamespace(id=f"track:{n}", title=f"Song {n}", artist="TWRP", album="Guardians of the Zone",
                           art="", duration=duration, is_container=False)


def test_a_queue_entry_looks_like_a_speakers_queue_item():
    entry = main._queue_entry(_item(3), 3)
    assert entry["title"] == "Song 3" and entry["kind"] == "track" and entry["is_container"] is False
    assert entry["duration"] == "0:03:23"
    assert entry["track_number"] == 3


def test_a_jump_moves_to_the_chosen_track_and_skips_what_will_not_play(monkeypatch):
    served = []

    async def media_uri(*, item_id, **_):
        served.append(item_id)
        return {"url": "" if item_id == "track:2" else f"https://media.example/{item_id}.mp3", "headers": {}}

    fake = SimpleNamespace(smapi=SimpleNamespace(get_media_uri=media_uri), remember_picture=lambda *_: None)
    monkeypatch.setattr(main, "controller", lambda: fake)
    session = {"tracks": [_item(n) for n in range(1, 6)], "pos": -1, "smapi": {}, "at": 0}

    first = asyncio.run(main._album_track(session))
    assert first["index"] == 0 and first["track"]["title"] == "Song 1"
    session["pos"] = 1 - 1            # what /api/stream/jump sets for index 1
    second = asyncio.run(main._album_track(session))
    assert second["index"] == 2       # Song 2 had no URL and was passed over
    session["pos"] = 4
    assert asyncio.run(main._album_track(session)) is None   # past the end: the album is over
    assert served == ["track:1", "track:2", "track:3"]


def test_a_jump_needs_an_album_session():
    main._RADIO_SESSIONS["station"] = {"station": "s", "queue": [], "at": 0}
    try:
        with pytest.raises(HTTPException) as caught:
            asyncio.run(main.stream_jump("station", 0))
        assert caught.value.status_code == 404
    finally:
        main._RADIO_SESSIONS.pop("station", None)


def _session(n=5, pos=2):
    return {"tracks": [_item(i) for i in range(1, n + 1)], "pos": pos, "playing": True, "smapi": {}, "at": 0}


def _edit(session, **body):
    main._RADIO_SESSIONS["s"] = session
    try:
        return asyncio.run(main.stream_queue_edit("s", main.BrowserQueueEdit(**body)))
    finally:
        main._RADIO_SESSIONS.pop("s", None)


def test_removing_a_track_before_the_playing_one_keeps_the_place():
    session = _session()
    answer = _edit(session, action="remove", index=0)
    assert [t["title"] for t in answer["queue"]] == ["Song 2", "Song 3", "Song 4", "Song 5"]
    assert answer["index"] == 1 and answer["playing"] is True     # still Song 3


def test_removing_the_playing_track_plays_on_and_next_goes_to_what_followed():
    session = _session()
    answer = _edit(session, action="remove", index=2)
    assert answer["playing"] is False and answer["index"] == 1
    assert session["tracks"][session["pos"] + 1].title == "Song 4"


def test_moving_tracks_follows_the_playing_one():
    session = _session()
    answer = _edit(session, action="move", start=4, count=1, insert_before=0)
    assert [t["title"] for t in answer["queue"]] == ["Song 5", "Song 1", "Song 2", "Song 3", "Song 4"]
    assert answer["queue"][answer["index"]]["title"] == "Song 3"
    answer = _edit(session, action="move", start=0, count=2, insert_before=5)
    assert [t["title"] for t in answer["queue"]] == ["Song 2", "Song 3", "Song 4", "Song 5", "Song 1"]
    assert answer["queue"][answer["index"]]["title"] == "Song 3"


def test_clearing_empties_the_list():
    answer = _edit(_session(), action="clear")
    assert answer["queue"] == [] and answer["playing"] is False


def test_an_album_can_start_at_a_named_track(monkeypatch):
    """A reload resumes the track the album was on, named by its service id."""
    async def media_uri(*, item_id, **_):
        return {"url": f"https://media.example/{item_id}.mp3", "headers": {}}

    async def listing(session):
        return [_item(n) for n in range(1, 6)]

    fake = SimpleNamespace(smapi=SimpleNamespace(get_media_uri=media_uri), remember_picture=lambda *_: None)
    monkeypatch.setattr(main, "controller", lambda: fake)
    monkeypatch.setattr(main, "_album_tracks", listing)
    answer = asyncio.run(main._radio_session("x-rincon-cpcontainer:album", SimpleNamespace(id="HH"),
                                             SimpleNamespace(name="Plex"), {}, "album",
                                             container=True, start="track:4"))
    try:
        assert answer["index"] == 3 and answer["track"]["title"] == "Song 4"
        assert len(answer["queue"]) == 5
    finally:
        main._RADIO_SESSIONS.pop(answer["session"], None)
