"""The recently played list: one entry per source, newest first, kept on disk."""

from backend.sonos.recent import LIMIT, RecentlyPlayed, kind_of


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
