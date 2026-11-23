"""Which of the karaoke themes' videos plays under which song in a room.

The videos are dealt as a deck is: each room draws from the ones it has not
yet shown, so every video plays once before any plays again, and the round
starts afresh once all have. A song keeps the video it was dealt for as long
as it is remembered, so every browser showing the room is told the same one
and they play the same picture together; the browsers ask here rather than
each choosing, which is what keeps them agreed. Nothing is kept on disk: a
restart starts every room on a new round.
"""

from __future__ import annotations

import random
from collections import OrderedDict

#: Songs a room remembers the video of; the longest untouched go first.
SONGS_KEPT = 200
#: Limits on what a page may send.
MOST_VIDEOS = 500
LONGEST_ID = 64
LONGEST_KEY = 512

_rooms: dict[str, dict] = {}


def _room(room: str) -> dict:
    kept = _rooms.get(room)
    if kept is None:
        kept = _rooms[room] = {"shown": set(), "songs": OrderedDict(), "last": ""}
    return kept


def deal(room: str, song: str, pool: list[str], skip: list[str] | tuple = ()) -> str:
    """The video for ``song`` in ``room``, chosen from ``pool`` less ``skip``
    (videos that will not play in the asking browser). The same answer for the
    same song while it is remembered and still in the pool; otherwise the next
    card: one this room has not shown this round, never the one shown last
    while there is another."""
    videos = list(dict.fromkeys(v for v in pool if isinstance(v, str) and v))
    if not videos:
        return ""
    blocked = set(skip)
    usable = [v for v in videos if v not in blocked] or videos
    kept = _room(room)
    had = kept["songs"].get(song)
    if had in usable:
        kept["songs"].move_to_end(song)
        return had
    left = [v for v in usable if v not in kept["shown"]]
    if not left:
        kept["shown"] = set()
        left = [v for v in usable if v != kept["last"]] or usable
    video = random.choice(left)
    kept["shown"].add(video)
    kept["last"] = video
    kept["songs"][song] = video
    kept["songs"].move_to_end(song)
    while len(kept["songs"]) > SONGS_KEPT:
        kept["songs"].popitem(last=False)
    return video


def forget() -> None:
    """Every room starts a new round (for tests)."""
    _rooms.clear()
