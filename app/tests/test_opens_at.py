"""Where a home tile leads when it is opened rather than played.

The web client opens what a tile names instead of starting it: clicking a
Recently Played album takes the page to that album and nothing plays (checked
on play.sonos.com 2026-09-19, where the click changed the URL to the album's
own page and left the room paused). Following that means knowing the page
behind each URI, which the URI itself carries.

Anything these rules cannot place comes back empty, and the caller plays it
as before -- better than a tile that does nothing.
"""

from __future__ import annotations

from backend.main import _opens_at


def test_a_service_container_opens_its_list():
    got = _opens_at("x-rincon-cpcontainer:0004206c572d7b1b:3:96211:album?sid=212&flags=8300&sn=26")
    assert got["kind"] == "service-list"
    assert got["sid"] == 212
    assert got["item"] == "572d7b1b:3:96211:album"
    assert got["account"] == "26"


def test_a_station_opens_its_own_page():
    got = _opens_at("x-sonosapi-radio:ST%3a91902681555159579?sid=236&flags=0&sn=2")
    assert got["kind"] == "service-leaf"
    assert got["sid"] == 236
    # Percent-encoded on the wire, and the provider wants it back plain.
    assert got["item"] == "ST:91902681555159579"
    assert got["account"] == "2"


def test_a_stream_opens_the_same_way():
    got = _opens_at("x-sonosapi-stream:s33122?sid=254&flags=8224&sn=0")
    assert got["kind"] == "service-leaf"
    assert got["sid"] == 254
    assert got["item"] == "s33122"


def test_spotify_names_its_service_in_the_didl_rather_than_the_uri():
    # Spotify's containers carry no sid= in the URI; the DIDL's SA_RINCON
    # token does, in its high bits (3079 >> 8 == 12).
    got = _opens_at(
        "x-rincon-cpcontainer:1006206cspotify%3aalbum%3a2On33uhLKdn7nhqYtWvxhX",
        '<DIDL-Lite><item><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:'
        'metadata-1-0/">SA_RINCON3079_X_#Svc3079-0-Token</desc></item></DIDL-Lite>')
    assert got["kind"] == "service-list"
    assert got["sid"] == 12
    assert got["item"] == "spotify:album:2On33uhLKdn7nhqYtWvxhX"


def test_the_music_share_opens_the_library_at_that_path():
    got = _opens_at("x-rincon-playlist:RINCON_38420B0000D401400#A:ALBUM/Genesys/Anyma")
    assert got["kind"] == "library"
    assert got["item"] == "A:ALBUM/Genesys/Anyma"


def test_what_has_no_page_says_so():
    # A line-in, a raw stream and a saved queue have nowhere to open; the
    # caller falls back to playing them.
    for uri in ("x-rincon-stream:RINCON_000E580000C301400",
                "x-file-cifs://192.168.0.102/music/Alex/track.flac",
                "file:///jffs/settings/savedqueues.rsq#5",
                ""):
        assert _opens_at(uri)["kind"] == ""
