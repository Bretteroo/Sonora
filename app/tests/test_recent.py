"""The recently played list: one entry per source, newest first, kept on disk."""

from backend.sonos.recent import LIMIT, RecentlyPlayed, is_announcement, kind_of


def test_newest_first_and_no_repeats(tmp_path):
    store = RecentlyPlayed(tmp_path / "recent.json")
    assert store.note("H", {"uri": "a", "title": "A"})
    assert store.note("H", {"uri": "b", "title": "B"})
    # Playing the same source again does not move anything.
    assert not store.note("H", {"uri": "b", "title": "B"})
    # An older source played again comes to the front, once.
    assert store.note("H", {"uri": "a", "title": "A"})
    assert [e["uri"] for e in store.items("H")] == ["a", "b"]


def test_bounded_and_persisted(tmp_path):
    path = tmp_path / "recent.json"
    store = RecentlyPlayed(path)
    for i in range(LIMIT + 5):
        store.note("H", {"uri": f"u{i}", "title": f"T{i}"})
    assert len(store.items("H")) == LIMIT
    assert store.items("H")[0]["uri"] == f"u{LIMIT + 4}"
    again = RecentlyPlayed(path)
    assert [e["uri"] for e in again.items("H")] == [e["uri"] for e in store.items("H")]
    assert again.items("elsewhere") == []


def test_untitled_or_empty_sources_are_not_history(tmp_path):
    store = RecentlyPlayed(tmp_path / "recent.json")
    assert not store.note("H", {"uri": "", "title": "A"})
    assert not store.note("H", {"uri": "a", "title": ""})
    assert store.items("H") == []


def test_kind_words():
    assert kind_of("object.item.audioItem.audioBroadcast", "x-sonosapi-stream:1") == "station"
    assert kind_of("", "x-rincon-mp3radio://host/stream") == "station"
    assert kind_of("object.container.album.musicAlbum", "x-rincon-cpcontainer:1") == "album"
    assert kind_of("object.container.playlistContainer", "x-rincon-cpcontainer:2") == "playlist"
    assert kind_of("object.container", "x-rincon-cpcontainer:3") == "other"


def test_announcements_and_chimes_are_not_history(tmp_path):
    # A chime a device on the network serves, and Home Assistant's spoken
    # announcements, on its own address or an outside one.
    for uri in ("http://192.168.1.245:33793/chime-0.wav",
                "http://192.168.1.17:8123/api/tts_proxy/abc123.mp3",
                "https://example.ui.nabu.casa/api/tts_proxy/abc123.mp3",
                "http://homeassistant.local:8123/local/doorbell.mp3"):
        assert is_announcement(uri), uri
    # Music reaches a speaker under schemes of its own, and a station on the
    # internet is a station.
    for uri in ("x-sonos-http:track%3a1.mp3?sid=212&sn=26",
                "x-rincon-mp3radio://ice1.somafm.com/groovesalad-256-mp3",
                "x-sonosapi-stream:s34635?sid=254",
                "https://stream.example.com/live.mp3",
                "x-file-cifs://nas/Music/a.flac"):
        assert not is_announcement(uri), uri
    store = RecentlyPlayed(tmp_path / "recent.json")
    assert not store.note("H", {"uri": "http://192.168.1.245:33793/chime-0.wav", "title": "Sonority chime"})
    assert store.items("H") == []


def test_an_announcement_kept_before_the_rule_is_not_listed(tmp_path):
    path = tmp_path / "recent.json"
    path.write_text('{"H": [{"uri": "http://192.168.1.245:33793/chime-0.wav", "title": "chime"}, '
                    '{"uri": "x-sonosapi-stream:s34635?sid=254", "title": "LAist"}]}')
    assert [e["title"] for e in RecentlyPlayed(path).items("H")] == ["LAist"]


def test_knows_what_is_on_the_list(tmp_path):
    store = RecentlyPlayed(tmp_path / "recent.json")
    store.note("H", {"uri": "a", "title": "A"})
    assert store.knows("H", "a")
    assert not store.knows("H", "b")
    assert not store.knows("elsewhere", "a")


def test_a_source_played_while_sonora_was_not_listening_is_caught_up(tmp_path):
    """A room first seen stopped on a source that is not on the list played it
    while nothing was listening: it goes to the front. One already listed
    stays where it is, since when it last played is not known."""
    import asyncio
    from types import SimpleNamespace

    from backend.sonos.controller import SonosController, ZoneState

    ctl = SonosController.__new__(SonosController)
    ctl.recent = RecentlyPlayed(tmp_path / "recent.json")
    ctl.recent.note("H", {"uri": "old", "title": "Old"})
    ctl.recent.note("H", {"uri": "newer", "title": "Newer"})
    ctl.household_of = lambda _uuid: SimpleNamespace(id="H")
    sent = []

    async def broadcast(message):
        sent.append(message)

    ctl._broadcast = broadcast

    def room(uri, title):
        state = ZoneState(uuid="RINCON_A1", name="Playroom", host="192.168.1.9")
        state.transport.media_uri = uri
        state.transport.title = title
        state.transport.state = "STOPPED"
        return state

    asyncio.run(ctl._note_recently_played(room("old", "Old"), catch_up=True))
    assert [e["uri"] for e in ctl.recent.items("H")] == ["newer", "old"]
    asyncio.run(ctl._note_recently_played(
        room("x-sonosapi-stream:stream_100?sid=894&flags=8232&sn=9", "80er Kultnight"), catch_up=True))
    assert ctl.recent.items("H")[0]["title"] == "80er Kultnight"
    assert sent == [{"type": "recent", "household": "H"}]
