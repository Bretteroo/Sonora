"""The order a service's search categories are mixed in.

A search of one service answers with a row from each of its categories in
turn, which is why Mixcloud's artists, shows and tags land one to a column.
The turn is taken by the kind of thing a category answers with and not by
the order the service's map declares them in: SoundCloud declares artists,
albums, tracks and the product draws artists, tracks, albums, and Community
Radio Plus declares its stations first where the product leads with its
songs (play.sonos.com, 2026-09-20).
"""

from __future__ import annotations

from backend.main import _search_rank


def named(kind: str) -> dict:
    return {"id": kind, "title": kind, "items": [{"item_type": kind}]}


def order(*kinds: str) -> list[str]:
    cats = [named(kind) for kind in kinds]
    return [c["id"] for c in sorted(cats, key=_search_rank)]


def test_soundcloud_draws_artists_then_tracks_then_albums():
    assert order("artist", "album", "track") == ["artist", "track", "album"]


def test_community_radio_puts_its_songs_before_its_stations():
    assert order("stream", "track") == ["track", "stream"]


def test_tunein_keeps_stations_ahead_of_what_it_cannot_name():
    assert order("stream", "show") == ["stream", "show"]


def test_a_category_with_nothing_in_it_sorts_last():
    assert _search_rank({"id": "empty", "items": []}) == 5
