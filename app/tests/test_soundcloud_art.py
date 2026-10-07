"""SoundCloud covers come from oEmbed, keyed off the id in the art URL.

SoundCloud is a device-certificate service Sonora cannot sign in to, and the
S1 speakers' /getaa answers 404 for its art, so covers were blank. The track's
numeric id is already in the getaa art URL (``...soundcloud:tracks:<id>...``),
and SoundCloud's public oEmbed endpoint returns the cover from it.
"""

import asyncio

from backend.sonos.soundcloud_art import SoundCloudArt, soundcloud_ref


def test_the_id_is_read_out_of_a_queue_art_url():
    # The art URL Sonora emits for a queue row: /api/art's u= is the speaker's
    # getaa, whose own u= is the track URI, url-encoded twice over.
    art = ("http://192.168.0.111:1400/getaa?s=1&u="
           "x-sonosapi-hls-static%3atrack-%253esoundcloud%253atracks%253a904330642"
           "%3fsid%3d160%26flags%3d8224%26sn%3d4")
    assert soundcloud_ref(art) == ("tracks", "904330642")


def test_the_raw_track_and_container_uris_are_read_too():
    assert soundcloud_ref("x-sonosapi-hls-static:track->soundcloud:tracks:191302607?sid=160") \
        == ("tracks", "191302607")
    assert soundcloud_ref(
        "x-rincon-cpcontainer:1006206cplaylist-%3esoundcloud%3aplaylists%3a1492453105?sid=160") \
        == ("playlists", "1492453105")
    assert soundcloud_ref("soundcloud%3ausers%3a90064554") == ("users", "90064554")


def test_a_non_soundcloud_url_is_left_alone():
    assert soundcloud_ref("http://192.168.0.108:1400/getaa?s=1&u=x-sonos-spotify%3a...") is None
    assert soundcloud_ref("") is None


def _resolver(answer):
    art = SoundCloudArt.__new__(SoundCloudArt)
    art.max_entries = 4000
    art._covers = {}

    async def fetch(kind, scid):
        fetch.calls += 1
        return answer
    fetch.calls = 0
    art._fetch = fetch
    return art, fetch


def test_a_cover_is_resolved_once_and_kept():
    art, fetch = _resolver("https://i1.sndcdn.com/artworks-x-t500x500.jpg")

    async def go():
        a = await art.cover_url("tracks", "904330642")
        b = await art.cover_url("tracks", "904330642")
        return a, b

    a, b = asyncio.run(go())
    assert a == b == "https://i1.sndcdn.com/artworks-x-t500x500.jpg"
    assert fetch.calls == 1  # the second draw uses the kept answer


def test_the_placeholder_counts_as_no_cover():
    # SoundCloud returns fb_placeholder.png for an art-less item; the row
    # should keep its service glyph, not show the grey wordmark.
    import json

    class _Resp:
        status = 200

        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def json(self, content_type=None):
            return {"thumbnail_url": "https://soundcloud.com/images/fb_placeholder.png"}

    class _Session:
        def get(self, *a, **k): return _Resp()

    art = SoundCloudArt(_Session())
    assert asyncio.run(art.cover_url("playlists", "1492453105")) is None
