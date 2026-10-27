"""Recently Played tiles for a service's albums and tracks get their picture
from the service: when none was recorded, and when the one recorded has
stopped loading. Plex's picture addresses carry a token, and one the server
no longer takes would otherwise leave the tile on the empty note for good.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from backend import main

ALBUM = "x-rincon-cpcontainer:0004206c572d7b1b:3:96211:album?sid=212&flags=8300&sn=26"


class Fake:
    def __init__(self, answers, loads):
        self.answers = list(answers)
        self.asked = 0
        self.loads = loads
        self.saved = []
        self.smapi = SimpleNamespace(get_extended_metadata_item=self.lookup)
        self.art_cache = SimpleNamespace(get=self.fetch)
        self.recent = SimpleNamespace(set_art=lambda _h, _u, art: self.saved.append(art))

    async def lookup(self, **_):
        self.asked += 1
        return SimpleNamespace(art=self.answers.pop(0))

    async def fetch(self, url):
        return object() if url in self.loads else None

    async def device_serial(self, _household):
        return "serial"


@pytest.fixture(autouse=True)
def service(monkeypatch):
    for kept in (main._STATION_ART, main._SERVICE_ART_LOADS, main._SERVICE_ART_RETRIED):
        kept.clear()

    async def cached_service(_ctl, _household, _sid):
        return SimpleNamespace(endpoint="https://plex.example/smapi", name="Plex", auth="Anonymous")

    monkeypatch.setattr(main, "_cached_service", cached_service)
    monkeypatch.setattr(main, "_reading_creds", lambda *_a, **_k: ({}, False))


def visit(ctl, entry):
    asyncio.run(main._station_pictures(ctl, SimpleNamespace(id="H"), [entry], "10.0.0.2"))


def test_a_tile_with_no_picture_gets_the_services():
    ctl = Fake(["https://img.example/new.jpg"], loads=set())
    entry = {"uri": ALBUM, "art": "", "service_id": "212", "title": "Hello Nasty"}
    visit(ctl, entry)
    assert entry["art"] == "https://img.example/new.jpg"
    assert ctl.saved == ["https://img.example/new.jpg"]


def test_a_picture_that_stopped_loading_is_looked_up_again():
    ctl = Fake(["https://img.example/new.jpg"], loads={"https://img.example/new.jpg"})
    entry = {"uri": ALBUM, "art": "https://img.example/old.jpg?token=gone", "service_id": "212", "title": "Hello Nasty"}
    visit(ctl, entry)
    assert entry["art"] == "https://img.example/new.jpg"
    assert ctl.saved == ["https://img.example/new.jpg"]


def test_a_picture_that_loads_is_left_alone_and_checked_once():
    ctl = Fake([], loads={"https://img.example/a.jpg"})
    entry = {"uri": ALBUM, "art": "https://img.example/a.jpg", "service_id": "212", "title": "Hello Nasty"}
    visit(ctl, entry)
    visit(ctl, entry)
    assert ctl.asked == 0 and ctl.saved == []
    assert ("H", ALBUM, "https://img.example/a.jpg") in main._SERVICE_ART_LOADS


def test_the_same_broken_address_back_is_kept_and_not_asked_about_again():
    ctl = Fake(["https://img.example/old.jpg"], loads=set())
    entry = {"uri": ALBUM, "art": "https://img.example/old.jpg", "service_id": "212", "title": "Hello Nasty"}
    visit(ctl, entry)
    visit(ctl, entry)
    assert ctl.asked == 1
    assert entry["art"] == "https://img.example/old.jpg" and ctl.saved == []


def test_a_playlist_with_no_login_takes_its_favorites_picture(monkeypatch):
    # SoundCloud hands the speaker a playlist with no picture in its metadata,
    # and Sonora holds no SoundCloud login to ask with; a Sonos Favorite of
    # the same playlist carries one, and is read without asking the service.
    playlist = "x-rincon-cpcontainer:1006206cplaylist-%3esoundcloud%3aplaylists%3a1492453105?sid=160&flags=8300&sn=4"
    favorite = SimpleNamespace(as_dict=lambda _host: {"uri": playlist.replace("sn=4", "sn=7"), "art": "https://img.example/pool.jpg"})
    ctl = Fake([], loads=set())
    ctl.content = SimpleNamespace(favorites=lambda _host: asyncio.sleep(0, [favorite]))

    async def needs_login(_ctl, _household, _sid):
        return SimpleNamespace(endpoint="https://soundcloud.example/smapi", name="SoundCloud", auth="AppLink")

    monkeypatch.setattr(main, "_cached_service", needs_login)
    entry = {"uri": playlist, "art": "", "service_id": 160, "title": "Poolsuite FM"}
    visit(ctl, entry)
    assert entry["art"] == "https://img.example/pool.jpg"
    assert ctl.saved == ["https://img.example/pool.jpg"] and ctl.asked == 0
