"""What the browser room can play, and what it must decline."""

from backend.sonos.localplay import browser_url, stream_host
from backend.sonos.smapi import smapi_account_serial, smapi_media_ref


def test_a_radio_uri_is_a_url_behind_a_scheme_prefix():
    answer = browser_url("x-rincon-mp3radio://ice1.somafm.com/groovesalad-256-mp3")
    assert answer == {"url": "http://ice1.somafm.com/groovesalad-256-mp3", "reason": ""}
    assert browser_url("aac://stream.example/hi")["url"] == "http://stream.example/hi"
    assert browser_url("hls-radio://stream.example/x.m3u8")["url"] == "https://stream.example/x.m3u8"
    # the prefix sometimes wraps a URL that carries its own scheme
    assert browser_url("x-rincon-mp3radio://https://stream.example/x")["url"] == "https://stream.example/x"


def test_a_plain_stream_passes_through():
    for url in ("http://ha.local/media/chime.mp3", "https://ha.local/media/chime.mp3"):
        assert browser_url(url) == {"url": url, "reason": ""}


def test_what_only_a_speaker_can_fetch_says_so():
    # The service ones stop here only when the service cannot be asked; the
    # resolver in main.py hands them to getMediaURI first.
    for uri in ("x-sonosapi-stream:s34635?sid=254&flags=8224&sn=0",
                "x-sonosapi-radio:ST%3a919?sid=236",
                "x-sonos-http:track%3a232168008.mp3?sid=160",
                "x-sonos-spotify:spotify%3atrack%3a0wvIGF?sid=12",
                "x-file-cifs://192.168.0.102/music/Alex/music1/a.mp3",
                "x-rincon-stream:RINCON_000E580000C301400",
                "x-sonos-htastream:RINCON_000E580000C301400:spdif"):
        assert browser_url(uri) == {"url": "", "reason": "needs-speaker"}, uri


def test_a_list_is_not_a_stream():
    # An album, a playlist or the speaker's queue: an ordered list the player
    # keeps, not one URL, so the browser room says something else about it.
    for uri in ("x-rincon-cpcontainer:1004206cspotify%3aalbum%3a2On",
                "x-rincon-queue:RINCON_000E580000C301400#0"):
        assert browser_url(uri) == {"url": "", "reason": "needs-queue"}, uri


def test_nothing_and_nonsense_are_told_apart_from_a_refusal():
    assert browser_url("")["reason"] == "unknown"
    assert browser_url("mystery:12345")["reason"] == "unknown"
    # a prefix with nothing after it is not a stream
    assert browser_url("x-rincon-mp3radio://")["reason"] == "unknown"


def test_the_host_is_read_for_the_line_under_the_title():
    assert stream_host("http://ice1.somafm.com/groovesalad-256-mp3") == "ice1.somafm.com"
    assert stream_host("") == ""


def test_the_service_reference_a_uri_carries():
    assert smapi_media_ref("x-sonosapi-stream:s34635?sid=254&flags=8224&sn=0") == (254, "s34635")
    assert smapi_media_ref("x-sonosapi-radio:ST%3a919?sid=236&sn=2") == (236, "ST:919")
    assert smapi_media_ref("x-sonos-http:track%3a232168008.mp3?sid=160&sn=4") == (160, "track:232168008")
    # A share, a container and a Spotify track name no SMAPI item to ask for.
    assert smapi_media_ref("x-file-cifs://nas/music/a.mp3") == (0, "")
    assert smapi_media_ref("x-rincon-cpcontainer:1004206cspotify%3aalbum%3a2On?sid=12") == (0, "")
    assert smapi_account_serial("x-sonosapi-stream:s34635?sid=254&sn=7") == "7"


def test_a_playlist_hands_back_every_stream_in_order():
    from backend.sonos.localplay import looks_like_playlist, playlist_streams
    m3u = "#EXTM3U\n#EXTINF:-1,ad\nhttps://cdn.example/preroll.mp3\nhttps://cdn.example/live\n"
    assert playlist_streams(m3u) == {"urls": ["https://cdn.example/preroll.mp3",
                                              "https://cdn.example/live"], "hls": False}
    pls = "[playlist]\nNumberOfEntries=1\nFile1=http://ice.example/stream\nTitle1=X\n"
    assert playlist_streams(pls)["urls"] == ["http://ice.example/stream"]
    # A manifest is the stream itself, and is said to be one.
    assert playlist_streams("#EXTM3U\n#EXT-X-VERSION:3\nseg1.ts\n") == {"urls": [], "hls": True}
    assert looks_like_playlist("audio/x-mpegurl", "http://x/y")
    assert looks_like_playlist("", "http://x/station.pls")
    assert looks_like_playlist("application/vnd.apple.mpegurl", "http://x/stream.m3u8")
    assert not looks_like_playlist("audio/mpeg", "http://ice1.somafm.com/groovesalad-256-mp3")

