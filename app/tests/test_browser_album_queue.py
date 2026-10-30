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


# --- Add to Queue ---------------------------------------------------------------------------

def _resolving(monkeypatch, refuse=()):
    """``_browser_track`` as the service would answer it: a track per URI, a
    context of its own, refused for the URIs named."""
    async def browser_track(uri, zone):
        n = uri.rsplit(":", 1)[-1]
        if uri in refuse:
            return {"reason": "needs-link", "service": "Plex"}
        return {"item": _item(n), "context": {"endpoint": f"ctx:{n}"}, "sid": 212,
                "service": SimpleNamespace(name="Plex"), "household": SimpleNamespace(id="HH")}
    monkeypatch.setattr(main, "_browser_track", browser_track)


def test_add_to_queue_goes_to_the_end_and_play_next_after_the_playing_track(monkeypatch):
    _resolving(monkeypatch)
    session = _session(3, pos=1)
    listing = _edit(session, action="add", uri="x-sonos-http:track:8", zone="Z")
    assert [t["title"] for t in listing["queue"]] == ["Song 1", "Song 2", "Song 3", "Song 8"]
    assert listing["index"] == 1 and listing.get("reason", "") == ""
    listing = _edit(session, action="add", uri="x-sonos-http:track:9", zone="Z", next=True)
    assert [t["title"] for t in listing["queue"]] == ["Song 1", "Song 2", "Song 9", "Song 3", "Song 8"]
    assert session["pos"] == 1
    # The added track is fetched with its own context, the album's own with the list's.
    assert main._track_context(session, session["tracks"][2]) == {"endpoint": "ctx:9"}
    assert main._track_context(session, session["tracks"][0]) == {}
    assert session["sids"]["track:9"] == 212


def test_an_add_the_service_refuses_says_why_and_leaves_the_list(monkeypatch):
    _resolving(monkeypatch, refuse=("x-sonos-http:track:8",))
    session = _session(2, pos=0)
    listing = _edit(session, action="add", uri="x-sonos-http:track:8", zone="Z")
    assert listing["reason"] == "needs-link" and listing["service"] == "Plex"
    assert len(listing["queue"]) == 2


def test_a_room_with_no_list_starts_one_from_what_plays_and_what_was_added(monkeypatch):
    _resolving(monkeypatch)
    started = asyncio.run(main.stream_queue_start(main.BrowserQueueStart(
        uri="x-sonos-http:track:8", zone="Z", now_uri="x-sonos-http:track:1", now_zone="Z")))
    try:
        assert [t["title"] for t in started["queue"]] == ["Song 1", "Song 8"]
        assert started["index"] == 0 and started["playing"] is True and started["reason"] == ""
        held = main._RADIO_SESSIONS[started["session"]]
        assert held["pos"] == 0 and held["tracks"][1].id == "track:8"
    finally:
        main._RADIO_SESSIONS.pop(started["session"], None)


def test_a_room_playing_nothing_starts_a_list_that_waits_for_play(monkeypatch):
    _resolving(monkeypatch)
    started = asyncio.run(main.stream_queue_start(main.BrowserQueueStart(uri="x-sonos-http:track:8", zone="Z")))
    try:
        assert [t["title"] for t in started["queue"]] == ["Song 8"]
        assert started["index"] == -1 and started["playing"] is False
    finally:
        main._RADIO_SESSIONS.pop(started["session"], None)
    refused = asyncio.run(main.stream_queue_start(main.BrowserQueueStart(uri="x-sonos-http:track:8", zone="Z")))
    assert refused["reason"] == "" or "session" in refused
    _resolving(monkeypatch, refuse=("x-sonos-http:track:8",))
    refused = asyncio.run(main.stream_queue_start(main.BrowserQueueStart(uri="x-sonos-http:track:8", zone="Z")))
    assert refused == {"reason": "needs-link", "service": "Plex"}


def _row(uri, title, art="/getaa?s=1&u=x", duration="0:03:23"):
    return SimpleNamespace(uri=uri, title=title, artist="TWRP", creator="", album="Guardians of the Zone",
                           art_uri=art, duration=duration)


def _playlist_household(monkeypatch, rows, token="t"):
    """The speakers and the service as a Sonos playlist is read through them."""
    served = []

    async def browse_all(host, object_id, limit=0):
        assert object_id == "SQ:17"
        return rows

    async def media_uri(*, item_id, **_):
        served.append(item_id)
        return {"url": f"https://media.example/{item_id}.mp3", "headers": {}}

    fake = SimpleNamespace(content=SimpleNamespace(browse_all=browse_all),
                           smapi=SimpleNamespace(get_media_uri=media_uri),
                           household_of=lambda zone: SimpleNamespace(id="HH"),
                           credentials_for=lambda *a, **k: {"token": token} if token else {},
                           remember_picture=lambda *_: None)
    monkeypatch.setattr(main, "controller", lambda: fake)
    monkeypatch.setattr(main, "_host_for", lambda zone: "10.0.0.5")

    async def cached(ctl, household, sid):
        return SimpleNamespace(name="Plex", id=sid, auth="DeviceLink", endpoint="e")

    async def context(household, service, ctl):
        return {"endpoint": "ctx"}

    monkeypatch.setattr(main, "_cached_service", cached)
    monkeypatch.setattr(main, "_service_context", context)
    return served


def test_a_sonos_playlist_plays_here_from_its_service_tracks(monkeypatch):
    rows = [_row("x-sonos-http:track%3a1.flac?sid=212", "Song 1"),
            _row("x-file-cifs://nas/music/a.flac", "On the share"),
            _row("x-sonos-http:track%3a2.flac?sid=212", "Song 2", art="https://art.example/2.jpg")]
    served = _playlist_household(monkeypatch, rows)
    answer = asyncio.run(main._speaker_list_stream("file:///jffs/settings/savedqueues.rsq#17", "RINCON_X"))
    # The library file only a speaker can fetch is left out; the rest is the list.
    assert [t["title"] for t in answer["queue"]] == ["Song 1", "Song 2"]
    assert answer["url"] == "https://media.example/track:1.mp3" and answer["index"] == 0
    assert answer["queue"][0]["duration"] == "0:03:23"
    held = main._RADIO_SESSIONS.pop(answer["session"])
    assert main._track_context(held, held["tracks"][1]) == {"endpoint": "ctx"}
    assert held["sids"]["track:2"] == 212
    # Speaker-relative art is named by the speaker that served it; a provider's own is kept.
    assert held["tracks"][0].art == "http://10.0.0.5:1400/getaa?s=1&u=x"
    assert held["tracks"][1].art == "https://art.example/2.jpg"
    assert served == ["track:1"]


def test_a_sonos_playlist_can_start_at_a_named_track(monkeypatch):
    rows = [_row(f"x-sonos-http:track%3a{n}.flac?sid=212", f"Song {n}") for n in range(1, 4)]
    _playlist_household(monkeypatch, rows)
    answer = asyncio.run(main._speaker_list_stream("file:///jffs/settings/savedqueues.rsq#17", "RINCON_X", start="track:3"))
    main._RADIO_SESSIONS.pop(answer["session"])
    assert answer["index"] == 2 and answer["url"].endswith("track:3.mp3")


def test_a_sonos_playlist_of_library_files_or_an_unlinked_service_says_why(monkeypatch):
    _playlist_household(monkeypatch, [_row("x-file-cifs://nas/music/a.flac", "On the share")])
    answer = asyncio.run(main._speaker_list_stream("file:///jffs/settings/savedqueues.rsq#17", "RINCON_X"))
    assert answer == {"url": "", "reason": "needs-speaker"}
    _playlist_household(monkeypatch, [_row("x-sonos-http:track%3a1.flac?sid=212", "Song 1")], token="")
    answer = asyncio.run(main._speaker_list_stream("file:///jffs/settings/savedqueues.rsq#17", "RINCON_X"))
    assert answer == {"url": "", "reason": "needs-link", "service": "Plex"}
    # Anything else is not a Sonos playlist and is left to the other routes.
    assert asyncio.run(main._speaker_list_stream("x-rincon-cpcontainer:1004206calbum?sid=212", "RINCON_X")) is None
    assert main._didl_seconds("1:02:03") == 3723 and main._didl_seconds("") == 0
