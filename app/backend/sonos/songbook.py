"""The songbook: a binder of a household's music, one number to a song.

A karaoke room keeps a binder: a tab for each catalog, the artists in order
behind it, and against every title the number that is keyed in to ask for it.
This is what fills one. It answers three things about a household's music:

* which sources keep a list of artists, and where in their tree it is;
* what songs an artist has there;
* what number a song is known by.

Whether a source has a list of artists is read off what it answers, never off
which service it is: a row a service types ``artist`` is an artist on every
service that says so. The same holds for an artist's songs, which are whatever
rows typed ``track`` sit under the artist, in the albums and lists found there.

A service that shows no list of artists until it is searched still has a
section. Its artists are the ones of the songs and albums the account has
saved, where it keeps such lists, and the ones written in: a name looked up in
the service's own search and filed here, behind the service's tab, from then on.

A number is given once, the first time a song is printed, and kept on disk
from then on, so a number written down last month still finds its song. The
favorites are numbered the same way, each household's from 9001. Every
call to a service here is counted against a small budget and remembered, so a
binder being leafed through asks a provider for each thing once.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import unicodedata
from collections.abc import Awaitable, Callable, Iterable
from pathlib import Path

log = logging.getLogger(__name__)

#: The numbers the binder gives out. Everything under ten thousand stays with
#: the queue's places, which are numbered where they stand, and the favorites.
FIRST = 10000
LAST = 99999

#: The numbers a household's favorites take, each given once and kept like a
#: song's.
FAVORITE_FIRST = 9001
FAVORITE_LAST = 9999

#: Row types that are worth opening when looking for a list of artists: the
#: plain folders a service files its lists in. Anything a service types more
#: closely (an album, a playlist, a station) is not a folder of lists.
_FOLDERS = frozenset({"container", "collection", ""})

#: Row types that can hold an artist's songs: an album, or a list the service
#: files under the artist. Stations and playlists are other people's choices
#: of song, and another artist's row leads away from this one.
_SONG_HOLDERS = frozenset({"album", "container", "collection", "albumList",
                           "trackList", ""})

#: The plain folders among them. One on an artist's page is a shelf of the
#: artist's albums or songs; a plain folder inside a plain folder is a list of
#: something else (the accounts that follow the artist, each a folder).
_PLAIN_HOLDERS = frozenset({"container", ""})

#: Row types that are a list of songs or albums in themselves, as a service
#: files what an account has saved.
_LISTS = frozenset({"trackList", "albumList", "playlist"})

#: Row types that are asked for by name. A service whose tree shows none of
#: them plays stations, and an artist found in its search has no songs to list.
_ON_DEMAND = frozenset({"track", "album", "artist", "playlist", "trackList", "albumList"})

#: How long an answer about a source is kept: one with something for the
#: binder is looked through again after a month (or as soon as opening its
#: list fails), one with nothing after a week.
SHELF_KEPT_S = 30 * 86400.0
NO_SHELF_KEPT_S = 7 * 86400.0
#: An answer read while a folder of the service would not open is kept a day:
#: the folder may have held the list.
PARTIAL_SHELF_KEPT_S = 86400.0

#: The shape of what is kept about a source. An answer kept in an older shape
#: says less than is now asked, so the source is looked through again.
SHELF_SHAPE = 9


def fold(text: str) -> str:
    """A name as it is compared: case and accents put aside."""
    plain = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in plain if not unicodedata.combining(c)).casefold().strip()


def is_artist_list(rows: list[dict]) -> bool:
    """Whether a page of rows is a list of artists: most of them typed so."""
    if not rows:
        return False
    artists = sum(1 for row in rows if row.get("item_type") == "artist")
    return artists * 2 > len(rows)


def _is_folder(row: dict) -> bool:
    return bool(row.get("is_container")) and (row.get("item_type") or "") in _FOLDERS


Opener = Callable[[str, int], Awaitable[tuple[list[dict], int]]]


def _stem(ident: str) -> str:
    """An id without its last part, which is what tells one of a kind from
    another: ``user->soundcloud:users:`` for ``user->soundcloud:users:123``.
    Empty where nothing is left that says what kind it is."""
    stem = re.sub(r"[A-Za-z0-9_-]+$", "", ident or "")
    return stem if len(stem) >= 3 else ""


def _mostly(rows: list[dict], kinds: tuple[str, ...]) -> bool:
    return bool(rows) and sum(1 for row in rows
                              if (row.get("item_type") or "") in kinds) * 2 > len(rows)


def _as_shown(rows: list[dict]) -> list[str]:
    """A page as a reader sees it: its titles in order. The ids are left out,
    since a service may hand a folder a new one each time the page is read."""
    return [row.get("title") or "" for row in rows]


async def survey(open_page: Opener, *, budget: int = 24, depth: int = 2,
                 fan: int = 12, shut: Iterable[str] = ()) -> dict:
    """What a service's tree has for the binder, read within ``depth`` folders
    of its root:

    * ``item`` and ``total``: where it keeps its artists and how many, the
      longest list of them it shows (``item`` is empty when it shows none);
    * ``saved``: the lists of songs and albums the account has saved;
    * ``on_demand``: whether anything in it is asked for by name (a track, an
      album, an artist, a playlist) and not only tuned to;
    * ``partial``: whether a folder refused to open both times it was asked,
      so the answer may be short of what the service has;
    * ``shut``: the folders that are not to be opened or gone into again
      (below), each by its id and by its title, those passed in among them.

    ``open_page(item, index)`` answers one page of a container's rows and the
    container's length, and raises when the service refuses. The tree is read
    a level at a time, so a list near the top is found before the budget is
    spent on a directory of genres, and within a level the folders are taken
    in turn, the first of each container before the second of any, so a
    container of thirty stations does not keep the one after it waiting. At
    most ``fan`` folders of any one container are opened and ``budget``
    containers in all. The longest list of artists wins because a service may
    also show a shelf of a few suggested ones, and the binder wants the
    catalog.

    What an account has saved is told by where it is, since no service marks
    a saved song as the account's own: it is in the folder the artist list is
    in, when that is not the root, and otherwise in the first folder under
    the root that holds a row the service marks as the user's content (a
    folder of the account's playlists). The saved lists are that folder's
    rows typed as a list of tracks or albums, and its plain folders that open
    to tracks or albums. The root is never taken for it: what a service shows
    at its top is what it is promoting.

    Opening a folder is not always only a reading. A service that keeps
    several libraries lists them in a folder, and opening one there chooses
    it: the root shows that library from then on, to everything that browses
    the service through this controller (Plex, 2026-11-16). Nothing on the
    row says so. Two things keep the survey from changing what a listener
    sees. It goes no deeper than the
    level where it finds a list of artists that runs past its first page (a
    catalog, not a shelf of a few), so such a list at the top is taken
    without the folders beside it being gone into. And a folder whose page
    carries most of the root's folders, and little that the root does not
    have, is the root again, as some other choice shows it. (A folder that
    repeats a few of the root's rows is a shelf like any other, and so is a
    full list that has the root's featured few somewhere in it.) It is not
    read as a shelf, its container's other folders are left shut, and the
    root is read once more. If its titles are no longer the ones it first
    had, the folders beside the one opened are opened in turn, the root read
    after each, until they are; should none bring them all back, the one
    that brought the most is opened last. The container comes back in
    ``shut`` (the folder itself, when it sits at the root) and, passed in
    the next time, is not gone into at all. It is known there by its title
    as well as its id, because the service this was seen on gives the folder
    of its libraries a new id at every reading of the root.
    """
    best: dict | None = None
    pages: dict[str, list[dict]] = {}
    parent: dict[str, str] = {}
    kinds: set[str] = set()
    shut = set(shut)
    first: list[tuple[str, str]] = []
    top: set[str] = set()
    top_folders: set[str] = set()
    home: set[str] = set()
    titled: dict[str, str] = {}
    level = ["root"]
    opened = 0
    missed = False
    settled = False

    async def as_at_first() -> int:
        """How many of the root's rows read as they did at first, fewer by
        each row it has gained or lost."""
        try:
            rows, _total = await open_page("root", 0)
        except Exception as exc:
            log.info("songbook: the root would not open again: %s", exc)
            return -1
        now = _as_shown(rows)
        return sum(1 for was, reads in zip(first, now) if was == reads) - abs(len(first) - len(now))

    async def put_back(holder: str, chose: str, near: int) -> None:
        """Open the folder of ``holder`` that makes the root read as it first
        did, after ``chose`` was opened and left ``near`` of its rows so. A
        folder already read as a shelf chose nothing and is not tried; the
        one that put the root back before is tried first."""
        beside = [row.get("id") for row in pages.get(holder, [])
                  if _is_folder(row) and row.get("id")
                  and row.get("id") != chose and row.get("id") not in pages]
        beside.sort(key=lambda ident: ident not in home)
        nearest, last = chose, chose
        for ident in beside:
            try:
                await open_page(ident, 0)
            except Exception as exc:
                log.info("songbook: a folder would not open: %s", exc)
                continue
            last = ident
            reads = await as_at_first()
            if reads == len(first):
                home.add(ident)
                return
            if reads > near:
                nearest, near = ident, reads
        log.warning("songbook: a folder changed what the service shows at its top, "
                    "and none beside it puts all of that back")
        if nearest != last:
            try:
                await open_page(nearest, 0)
            except Exception as exc:
                log.info("songbook: a folder would not open: %s", exc)

    def root_again(rows: list[dict]) -> bool:
        """Whether a folder's page is the root as some other choice shows it."""
        here = {row.get("id") for row in rows}
        return (len(top_folders & here) * 2 > len(top_folders)
                and len(top & here) * 2 > len(here))

    def is_shut(item: str) -> bool:
        return item in shut or (item in titled and titled[item] in shut)

    for at in range(depth + 1):
        folders: dict[str, list[str]] = {}
        again: list[str] = []

        async def take(item: str, rows: list[dict], total: int, at: int = at,
                       folders: dict[str, list[str]] = folders) -> None:
            nonlocal best, settled
            if item == "root":
                first.extend(_as_shown(rows))
                top.update(row["id"] for row in rows if row.get("id"))
                top_folders.update(row["id"] for row in rows
                                   if row.get("id") and row.get("is_container"))
            elif root_again(rows):
                holder = parent.get(item, "root")
                mark = item if holder == "root" else holder
                shut.update(name for name in (mark, titled.get(mark)) if name)
                reads = await as_at_first()
                if reads == len(first):
                    home.add(item)
                else:
                    await put_back(holder, item, reads)
                return
            pages[item] = rows
            titled.update((row["id"], row.get("title") or "") for row in rows if row.get("id"))
            kinds.update(row.get("item_type") or "" for row in rows)
            if is_artist_list(rows):
                if best is None or total > best["total"]:
                    best = {"item": item, "total": total}
                settled = settled or total > len(rows)
                return
            if at < depth and not is_shut(item):
                inside = [row["id"] for row in rows if _is_folder(row) and row.get("id")][:fan]
                for child in inside:
                    parent.setdefault(child, item)
                folders[item] = inside

        for item in level:
            if opened >= budget:
                break
            if is_shut(item) or is_shut(parent.get(item, "")):
                continue
            opened += 1
            try:
                rows, total = await open_page(item, 0)
            except Exception:  # a refusal closes this branch, not the search
                if item == "root":
                    raise
                again.append(item)
                continue
            await take(item, rows, total)
        # A folder that would not open is asked once more when the rest of its
        # level has been, within the same budget: a service that was slow for
        # a moment is not read as one without the folder.
        for item in again:
            if opened >= budget:
                missed = True
                break
            if is_shut(item) or is_shut(parent.get(item, "")):
                continue
            opened += 1
            try:
                rows, total = await open_page(item, 0)
            except Exception as exc:
                log.info("songbook: a folder would not open: %s", exc)
                missed = True
                continue
            await take(item, rows, total)
        if settled:
            break
        level = [inside[turn] for turn in range(fan) for inside in folders.values()
                 if turn < len(inside)]
        if not level:
            break

    holder = parent.get(best["item"], "root") if best else "root"
    # Whose the artists are. A list in the service's own menu is the service's
    # whole catalog; one kept a folder further in, or marked as the account's,
    # holds what the account has saved. A service with no list has only what
    # is gathered from the account's saved music.
    own = (not best or holder != "root"
           or any(row.get("user_content") for row in pages.get("root", [])
                  if row.get("id") == best["item"]))
    if holder == "root":
        holder = next((row["id"] for row in pages.get("root", [])
                       if _is_folder(row) and any(inner.get("user_content")
                                                  for inner in pages.get(row.get("id"), []))),
                      "")
    saved: list[str] = []
    for row in pages.get(holder, []) if holder else []:
        ident, kind = row.get("id"), row.get("item_type") or ""
        if not ident or not row.get("is_container") or (best and ident == best["item"]):
            continue
        if kind in _LISTS or (kind in _FOLDERS
                              and _mostly(pages.get(ident, []), ("track", "album"))):
            saved.append(ident)
    # Lists of artists the account follows: a folder beside the saved lists, or in the root's
    # own menu, whose rows are all folders (or artists) whose ids are of one kind. Whether
    # they are artists is told later, by their songs (``saved_artists``); here they are only
    # candidates. The catalog's own list of artists is never one.
    follows: list[str] = []
    for row in [*pages.get("root", []), *(pages.get(holder, []) if holder and holder != "root" else [])]:
        ident = row.get("id")
        if not ident or ident in saved or ident in follows or not _is_folder(row) or (best and ident == best["item"]):
            continue
        inner = pages.get(ident) or []
        if (len(inner) >= 2 and all(_is_folder(r) or r.get("item_type") == "artist" for r in inner)
                and len({_stem(r.get("id") or "") for r in inner}) == 1 and _stem(inner[0].get("id") or "")):
            follows.append(ident)
    return {"item": best["item"] if best else "", "total": best["total"] if best else 0,
            "saved": saved[:6], "follows": follows[:3], "on_demand": bool(kinds & _ON_DEMAND),
            "partial": missed, "shut": sorted(shut), "own": own}


async def find_artist_list(open_page: Opener, *, budget: int = 20, depth: int = 2,
                           fan: int = 12) -> dict | None:
    """Where a service keeps its artists: the longest list of them within
    ``depth`` folders of the root, or None when it shows none."""
    found = await survey(open_page, budget=budget, depth=depth, fan=fan)
    return {"item": found["item"], "total": found["total"]} if found["item"] else None


async def _names_itself(open_page: Opener, row: dict, *, budget: int = 4) -> bool:
    """Whether a folder is an artist: songs in it, or in a list in it, name it
    as their artist. A service need not type the rows of the artists
    an account follows as artists (SoundCloud's Following, 2026-11-22, types
    them as plain folders), but their songs say whose they are."""
    ident = row.get("id") or ""
    if row.get("item_type") == "artist":
        return True
    queue, spent = [ident], 0
    while queue and spent < budget:
        item = queue.pop(0)
        spent += 1
        try:
            rows, _total = await open_page(item, 0)
        except Exception as exc:  # noqa: BLE001 - a folder that will not open says nothing
            log.debug("songbook: a followed folder would not open: %s", exc)
            continue
        if any((r.get("item_type") or "") == "track" and r.get("artist_id") == ident for r in rows):
            return True
        # Any list in it, not only plain folders: SoundCloud types an account's own songs as
        # a playlist. A list of other people's songs (its likes) names no one as this one.
        if item == ident:
            queue += [r["id"] for r in rows if r.get("is_container") and r.get("id")][:3]
    return False


async def artist_shelves(open_page: Opener, ids: list[str], *, shelves: int = 25,
                         most: int = 200) -> list[str]:
    """Of a home page's shelves, the ones that hold nothing but artists, and
    no more than ``most`` of them: the artists an account follows, where a
    service shows them only there. A shelf of picks mixes artists with albums
    and playlists. At most ``shelves`` are opened; one that will not open is
    passed over."""
    found: list[str] = []
    for item in ids[:shelves]:
        try:
            rows, total = await open_page(item, 0)
        except Exception as exc:  # noqa: BLE001 - one shelf is its own
            log.debug("songbook: a home shelf would not open: %s", exc)
            continue
        if rows and total <= most and all(r.get("item_type") == "artist" for r in rows):
            found.append(item)
    return found


async def saved_artists(open_page: Opener, lists: list[str], *, pages: int = 10,
                        budget: int = 30, follows: Iterable[str] = ()) -> dict[str, str]:
    """The artists of what an account has saved: each one's id and name, off
    the rows typed ``track`` or ``album`` in the saved lists that name both,
    and the artists it follows, off the rows of ``follows`` once the first of
    them has shown it is an artist (``_names_itself``).

    At most ``pages`` pages of any one list are read and ``budget`` in all; a
    list that will not open is passed over.
    """
    found: dict[str, str] = {}
    spent = 0
    for item in follows:
        if spent >= budget:
            break
        try:
            spent += 1
            rows, total = await open_page(item, 0)
        except Exception as exc:  # noqa: BLE001 - one list is its own
            log.debug("songbook: a followed list would not open: %s", exc)
            continue
        if not rows or not any([await _names_itself(open_page, row) for row in rows[:2]]):
            continue
        stem = _stem(rows[0].get("id") or "")
        index = 0
        for _ in range(pages):
            for row in rows:
                if row.get("id") and row.get("title") and (row.get("item_type") == "artist" or _stem(row["id"]) == stem):
                    found.setdefault(row["id"], row["title"])
            index += len(rows)
            if not rows or index >= total or spent >= budget:
                break
            spent += 1
            try:
                rows, total = await open_page(item, index)
            except Exception as exc:  # noqa: BLE001
                log.debug("songbook: a followed list would not open further: %s", exc)
                break
    for item in lists:
        index = 0
        for _ in range(pages):
            if spent >= budget:
                log.info("songbook: the saved lists were not read to their end")
                return found
            spent += 1
            try:
                rows, total = await open_page(item, index)
            except Exception as exc:
                log.debug("songbook: a saved list would not open: %s", exc)
                break
            for row in rows:
                if ((row.get("item_type") or "") in ("track", "album")
                        and row.get("artist_id") and row.get("artist")):
                    found.setdefault(row["artist_id"], row["artist"])
            index += len(rows)
            if not rows or index >= total:
                break
    return found


def _by_artist(track: dict, artist: str) -> bool:
    """Whether a track's own artist line allows that it is this artist's.
    A line left empty says nothing against it."""
    theirs = fold(track.get("artist") or "")
    if not theirs:
        return True
    return artist in theirs or theirs in artist


async def walk_songs(open_page: Opener, artist_id: str, artist_name: str, *,
                     budget: int = 60, depth: int = 2, limit: int = 2000,
                     lanes: int = 4) -> list[dict]:
    """An artist's songs: every row typed ``track`` under the artist, in the
    albums and lists found there, each once.

    The same recording is often filed twice (on its album and in a list of all
    the artist's tracks) and the same song on two albums; the first of each
    is kept, by id and then by title. Where a service fills an artist's page
    with other artists' songs (a station of similar music), the tracks whose
    own artist line names someone else are dropped, unless that would leave
    nothing, in which case the service's word stands.

    A service that files an artist's own songs in rows typed ``playlist``
    (SoundCloud's page for an account, 2026-11-16: its uploads, its sets, and
    what it has liked, all three typed so) gives the walk above nothing. Those
    rows on the artist's own page are then read, and only the tracks whose
    artist line names the artist are taken from them: a list of liked songs is
    mostly other people's.
    """
    spent = 0
    found: list[dict] = []
    lists: list[dict] = []
    gate = asyncio.Semaphore(lanes)

    async def read(item: str, plain: bool = False) -> tuple[list[dict], list[dict]]:
        """All of one container: its tracks and the rows worth opening.
        ``plain`` says the container is itself a plain folder."""
        nonlocal spent
        tracks: list[dict] = []
        holders: list[dict] = []
        index = 0
        while spent < budget and index < limit:
            spent += 1
            try:
                async with gate:
                    rows, total = await open_page(item, index)
            except Exception as exc:
                if item == artist_id and index == 0:
                    raise
                log.debug("songbook: a list under an artist would not open: %s", exc)
                break
            for row in rows:
                kind = row.get("item_type") or ""
                if kind == "track" and row.get("can_play", True):
                    tracks.append(row)
                elif not row.get("is_container"):
                    continue
                elif kind in _SONG_HOLDERS:
                    if not (plain and kind in _PLAIN_HOLDERS):
                        holders.append(row)
                elif kind == "playlist" and item == artist_id:
                    lists.append(row)
            index += len(rows)
            if not rows or index >= total:
                break
            # A list whose first page holds nothing to take or to open is not
            # read to its end.
            if not tracks and not holders:
                break
        return tracks, holders

    level = [(artist_id, False)]
    for at in range(depth + 1):
        results = await asyncio.gather(*(read(item, plain) for item, plain in level))
        level = []
        for tracks, holders in results:
            found.extend(tracks)
            if at < depth:
                level.extend((row["id"], (row.get("item_type") or "") in _PLAIN_HOLDERS)
                             for row in holders if row.get("id"))
        if not level or spent >= budget or len(found) >= limit:
            break

    name = fold(artist_name)
    if not found and name and lists:
        results = await asyncio.gather(*(read(row["id"]) for row in lists if row.get("id")))
        found = [t for tracks, _ in results for t in tracks
                 if fold(t.get("artist") or "") and _by_artist(t, name)]
    theirs = [t for t in found if _by_artist(t, name)] if name else found
    kept = theirs or found
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()
    out: list[dict] = []
    for track in kept:
        key, title = track.get("id") or "", fold(track.get("title") or "")
        if not key or not title or key in seen_ids or title in seen_titles:
            continue
        seen_ids.add(key)
        seen_titles.add(title)
        out.append(track)
    out.sort(key=lambda t: fold(t.get("title") or ""))
    return out[:limit]


async def with_a_page(artists: list[dict], open_page: Opener, *, tried: int = 12,
                      lanes: int = 6) -> list[dict]:
    """The artists a search found that have a page to turn to, in the order
    found: the first ``tried`` are opened, and one that refuses or opens to
    nothing is left out, as are the ones past those tried.

    A search can answer with what the same service will not open: of eleven
    artists Plex found for one word, one opened (2026-11-16).
    """
    gate = asyncio.Semaphore(lanes)

    async def opens(artist: dict) -> bool:
        try:
            async with gate:
                rows, _total = await open_page(artist["id"], 0)
        except Exception as exc:
            log.info("songbook: a found artist would not open: %s", exc)
            return False
        return bool(rows)

    first = artists[:tried]
    return [artist for artist, good in zip(first, await asyncio.gather(*map(opens, first)))
            if good]


Reader = Callable[[str], Awaitable[dict | None]]
Asker = Callable[[str], Awaitable[list[dict]]]

def lead_of(ids: Iterable[str]) -> str:
    """The opening every one of ``ids`` shares, cut back to end on a mark: a
    character that is neither a letter, a digit, nor a space. Empty where
    there are fewer than two ids or they share no such opening."""
    ids = [ident for ident in ids if ident]
    if len(ids) < 2:
        return ""
    shared = os.path.commonprefix(ids)
    cut = max((n for n, ch in enumerate(shared) if not (ch.isalnum() or ch.isspace())),
              default=-1)
    return shared[:cut + 1]


class Scope:
    """Which of a service's artists are the ones a tab lists, told by their ids.

    A service that keeps several libraries says in an id which one a thing is
    in: every artist a tab lists opens with the same parts (``lead``), and
    what a search finds elsewhere opens with other ones. Plex's ids are four
    parts with a colon between, the server and the library first, and its
    search answers from every library on every server the account reaches;
    the artist id a found song carries leaves the library's part empty, and
    is the listed artist's in its other parts where the song is in the
    library listed (2026-11-17).

    ``listed`` is the ids of the tab's own list, and ``whole`` whether that is
    all of them.
    """

    def __init__(self, lead: str, listed: Iterable[str], *, whole: bool = True):
        self.lead = lead
        self.mark = lead[-1]
        self.head = lead.split(self.mark)[:-1]
        self.listed = [ident for ident in listed if ident]
        self.whole = whole
        self.widths = {len(ident.split(self.mark)) for ident in self.listed}
        self._by: dict[tuple, dict[tuple, str]] = {}

    def home(self, ident: str) -> str | None:
        """The id the tab knows an artist by, or None for an artist kept
        somewhere the tab does not list.

        An id that opens as the list's own do is the tab's. One built another
        way (not in as many parts as the list's) says nothing about where it
        is, and is answered as it came. One that fills in every part the list's
        opening has, or differs from it in one it does fill in, is elsewhere.
        One that leaves such a part empty is the listed artist that agrees
        with it in every other part, and elsewhere when there is none; where
        the list was too long to read to its end (``whole`` is False) and
        none of what was read agrees, it is answered as it came.
        """
        if not ident or ident.startswith(self.lead):
            return ident
        parts = ident.split(self.mark)
        if len(parts) not in self.widths:
            return ident
        said = parts[:len(self.head)]
        if all(said) or any(part and part != own for part, own in zip(said, self.head)):
            return None
        told = tuple(n for n, part in enumerate(parts) if part or n >= len(self.head))
        table = self._by.get((len(parts), told))
        if table is None:
            table = self._by[(len(parts), told)] = {}
            for own in self.listed:
                cut = own.split(self.mark)
                if len(cut) == len(parts):
                    table.setdefault(tuple(cut[n] for n in told), own)
        return table.get(tuple(parts[n] for n in told)) or (None if self.whole else ident)

    def apart(self, ident: str) -> bool:
        """Whether an id of any kind (a song's, an album's) says it is kept
        somewhere the tab does not list: built in as many parts as the list's
        own ids, with one of the opening parts filled in another way. An id
        that leaves those parts empty, or is built otherwise, does not say.
        """
        parts = ident.split(self.mark) if ident else []
        if len(parts) not in self.widths:
            return False
        return any(part and part != own for part, own in zip(parts, self.head))


async def scope_of(open_page: Opener, item: str, *, first: tuple[list[dict], int] | None = None,
                   kept: dict | None = None, pages: int = 100, lanes: int = 6,
                   clock: Callable[[], float] = time.monotonic) -> Scope | None:
    """What the tab whose artists are listed at ``item`` holds, or None where
    its ids do not say: everything the service finds is the tab's then.

    Ids are read this way only where the list is a row of the service's root.
    A list kept in a folder is what an account has saved out of a catalog
    (see ``survey``), and a search there rightly finds the rest of the
    catalog. A list at the root is the whole of what the tab has.

    The whole list is read, a page in each of ``lanes`` at a time, and kept in
    ``kept`` for as long as the list's length and its first page stay as they
    were; ``first`` is that page where the caller has just read it. A list
    longer than ``pages`` pages is not read past its first (see
    ``Scope.home`` for what that leaves undecided), and one that would not be
    read to its end is read again the next time.
    """
    kept = {} if kept is None else kept
    rooted = kept.get("rooted")
    if rooted is None or rooted[0] != item or clock() - rooted[2] > 600:
        try:
            rows, _total = await open_page("root", 0)
        except Exception as exc:
            log.info("songbook: the root would not open: %s", exc)
            return None
        rooted = kept["rooted"] = (item, any(row.get("id") == item for row in rows), clock())
    if not rooted[1]:
        return None
    try:
        rows, total = first if first is not None else await open_page(item, 0)
    except Exception as exc:
        log.info("songbook: a list of artists would not open: %s", exc)
        return None
    ids = [row["id"] for row in rows if row.get("id")]
    seen = (item, total, tuple(ids))
    if kept.get("seen") == seen:
        return kept["scope"]
    lead = lead_of(ids)
    if not lead:
        return None
    whole = True
    rest = range(len(rows), total, len(rows))
    if len(rest) >= pages:
        whole = False
        log.info("songbook: a list of %d artists is too long to read to its end", total)
    elif rest:
        gate = asyncio.Semaphore(lanes)

        async def page(start: int) -> list[str]:
            async with gate:
                more, _total = await open_page(item, start)
            return [row["id"] for row in more if row.get("id")]

        try:
            for more in await asyncio.gather(*map(page, rest)):
                ids.extend(more)
        except Exception as exc:
            log.info("songbook: a list of artists would not be read to its end: %s", exc)
            return Scope(lead, ids, whole=False)
    scope = Scope(lead, ids, whole=whole)
    kept["seen"], kept["scope"] = seen, scope
    return scope


def _by_summary(folder: dict, copy: dict) -> bool:
    """Whether a folder's line of description starts with a copy's artist."""
    artist = fold(copy.get("artist") or "")
    return bool(artist) and fold(folder.get("summary") or "").startswith(artist)


class _Found:
    """What a search's folders hold.

    A search can answer with a folder where one thing is kept in several
    places: Plex answers a song or an artist held in more than one library
    with a plain folder that carries the thing's title, and under it a row for
    each library, each of which reads back as the thing itself (2026-11-17).
    Such a folder is opened, its rows read again, and the ones that read back
    under the folder's own title are its copies.

    A folder's id does not always name its contents. Two folders in one
    answer can share an id, and the id then opens to the later one's rows
    whichever is asked for. The one that opened to another's rows is asked for
    again by narrower words until it is the only folder answered with that
    id, and opened then. One that no words single out is left out, and is
    not asked for again while what was found is kept.
    """

    def __init__(self, kind: str, open_page: Opener, read: Reader, ask: Asker, *,
                 shut: Iterable[str], kept: dict | None, lanes: int, copies: int):
        self.kind = kind
        self.open_page = open_page
        self.read = read
        self.ask = ask
        self.shut = frozenset(shut)
        self.kept = {} if kept is None else kept
        self.gate = asyncio.Semaphore(lanes)
        self.copies = copies

    def is_folder(self, row: dict) -> bool:
        return (_is_folder(row) and (row.get("item_type") or "") in _PLAIN_HOLDERS
                and bool(row.get("id")) and bool(row.get("title"))
                and row["id"] not in self.shut)

    @staticmethod
    def name(folder: dict) -> tuple:
        return folder["id"], fold(folder["title"]), folder.get("summary") or ""

    async def again(self, ident: str) -> dict | None:
        try:
            async with self.gate:
                return await self.read(ident)
        except Exception as exc:
            log.info("songbook: a found row would not be read again: %s", exc)
            return None

    async def under(self, ident: str) -> list[dict]:
        """A folder's rows, each as it reads back, the ones of the kind looked for."""
        try:
            async with self.gate:
                rows, _total = await self.open_page(ident, 0)
        except Exception as exc:
            log.info("songbook: a found folder would not open: %s", exc)
            return []
        read = await asyncio.gather(*(self.again(row["id"]) for row in rows[:self.copies]
                                      if row.get("id") and row["id"] not in self.shut))
        return [row for row in read if row and row.get("item_type") == self.kind
                and row.get("id") and row.get("title")]

    @staticmethod
    def of(folder: dict, rows: list[dict]) -> list[dict]:
        """The rows that are the folder's own: the ones under its title, those
        its description names the artist of first."""
        mine = [row for row in rows if fold(row["title"]) == fold(folder["title"])]
        return sorted(mine, key=lambda row: not _by_summary(folder, row))

    async def narrowed(self, folder: dict, terms: list[str]) -> list[dict] | None:
        """A folder's copies, read after asking for the folder by narrower
        words: the first of ``terms`` that is answered with this folder and no
        other under its id. None where the service would not answer."""
        for term in terms:
            try:
                answer = await self.ask(term)
            except Exception as exc:
                log.info("songbook: a narrower search was not answered: %s", exc)
                return None
            twins = [row for row in answer if self.is_folder(row) and row["id"] == folder["id"]]
            if len(twins) == 1 and self.name(twins[0]) == self.name(folder):
                return self.of(folder, await self.under(folder["id"]))
        return []

    async def resolve(self, rows: list[dict], terms: Callable[[dict], list[str]], *,
                      narrow: int = 3, within: float | None = None,
                      opened: bool = True) -> dict[tuple, list[dict]]:
        """The copies behind each folder among ``rows``, by the folder's name.
        No more than ``narrow`` folders are asked for again by narrower words,
        and none once ``within`` seconds have gone to it: each is a search of
        its own, made one after another. A folder not reached is left out and
        not kept, so the same search made again goes on from there.
        With ``opened`` off no folder is opened or asked for: the ones whose
        copies are kept are answered, and the rest left out."""
        folders = [row for row in rows if self.is_folder(row)]
        if not opened:
            return {self.name(f): self.kept[self.name(f)] for f in folders
                    if self.name(f) in self.kept}
        shared: dict[str, int] = {}
        titled: dict[tuple, int] = {}
        for folder in folders:
            shared[folder["id"]] = shared.get(folder["id"], 0) + 1
            title = (folder["id"], fold(folder["title"]))
            titled[title] = titled.get(title, 0) + 1
        fresh = list(dict.fromkeys(f["id"] for f in folders if self.name(f) not in self.kept))
        opened = dict(zip(fresh, await asyncio.gather(*map(self.under, fresh))))
        out: dict[tuple, list[dict]] = {}
        until = None if within is None else time.monotonic() + within
        for folder in folders:
            name = self.name(folder)
            if name in self.kept:
                out[name] = self.kept[name]
                continue
            if name in out:
                continue
            mine = self.of(folder, opened.get(folder["id"], []))
            settled = False
            if shared[folder["id"]] > 1:
                # The id may have opened to its twin. A song counts as this
                # folder's when the folder's description names its artist; an
                # artist's folder describes nothing, and is believed when no
                # twin has its title.
                if self.kind == "track":
                    believed = any(_by_summary(folder, row) for row in mine)
                else:
                    believed = bool(mine) and titled[(folder["id"], fold(folder["title"]))] == 1
                if not believed:
                    mine = []
                    if narrow > 0 and (until is None or time.monotonic() < until):
                        narrow -= 1
                        answered = await self.narrowed(folder, terms(folder))
                        mine, settled = answered or [], answered is not None
            out[name] = mine
            if mine or settled:
                self.kept[name] = mine
        return out


async def every_page(ask_page: Callable[[int, int], Awaitable[list]], *,
                     rows: int = 100, asks: int = 4, size: int = 50,
                     total: Callable[[], int] | None = None,
                     first: list | None = None) -> list:
    """All a search answers with, not only its first page: ``ask_page(index,
    count)`` is asked for ``size`` rows at a time, from where the last answer
    left off, until an answer comes back empty or holds nothing not already
    in hand (a service that answers every index with its first page), or
    ``rows`` are in hand, or ``asks`` requests have been made. A short page
    ends the reading too where the service has said how many rows it has
    (``total``, read after each answer) and that many have been asked past:
    the empty answer that would say the same is not waited for. A row is told
    from another by its ``id``. A later page the service will not answer
    (``ask_page`` raising) ends the reading with what is in hand; the first
    one raising is the caller's to hear of. ``first`` is the first page where
    it has been asked for already (with the same ``size``): the reading goes
    on from its end.
    """
    out: list = []
    met: set = set()
    for row in first or []:
        if _row_id(row) not in met:
            met.add(_row_id(row))
            out.append(row)
    index = len(first or [])
    if first is not None and (not out or len(out) >= rows):
        return out[:rows]
    for turn in range(1 if first is not None else 0, asks):
        try:
            page = await ask_page(index, size)
        except Exception:
            if not turn:
                raise
            break
        fresh = [row for row in page if _row_id(row) not in met]
        if not fresh:
            break
        met.update(_row_id(row) for row in fresh)
        out.extend(fresh)
        index += len(page)
        if len(out) >= rows:
            break
        if len(page) < size and total is not None and 0 < total() <= index:
            break
    return out[:rows]


def _row_id(row) -> str:
    """What tells one row of an answer from another: its id."""
    get = row.get if isinstance(row, dict) else lambda name: getattr(row, name, "")
    return get("id") or ""


def folders_unread(rows: list[dict], kept: dict, shut: Iterable[str] = ()) -> bool:
    """Whether a search's answer has a folder whose copies are not kept yet."""
    found = _Found("", None, None, None, shut=shut, kept=kept, lanes=1, copies=0)
    return any(found.is_folder(row) and found.name(row) not in kept for row in rows)


async def found_songs(rows: list[dict], open_page: Opener, read: Reader, ask: Asker, *,
                      shut: Iterable[str] = (), kept: dict | None = None,
                      scope: Scope | None = None,
                      lanes: int = 6, copies: int = 6, opened: bool = True,
                      narrow: int = 3, within: float | None = None) -> list[dict]:
    """The songs among what a search for songs answered, in its order, each
    with its artist where the service will say it, and none whose artist is
    kept somewhere the tab does not list (``scope``, where the tab's ids say
    what it holds), or whose own id says it is. A song the service names no
    artist's id for is kept where its own id does not say otherwise.

    A found song that names no artist is read again on its own, which is
    where a service that leaves the artist off its search rows gives it; so
    is one without its artist's id, where there is a ``scope`` to hold it to,
    unless its own id already says the tab does not hold it.
    With no ``scope``, a song the service describes in a line of its own
    (``summary``) is not read again: the line is what the service's own lists
    show under the title, and the song is read when it is picked.
    A folder that holds copies of one song (see ``_Found``) stands for the
    first of them the tab holds, the one by the artist its description starts
    with before any other; ``ask`` searches the songs again by other words,
    for a folder that shares its id with another, for no more than ``narrow``
    folders in one search, and for no longer than ``within`` seconds where
    that is given. With ``opened`` off no
    folder is opened: one whose copies are kept is answered, the rest are not.
    """
    found = _Found("track", open_page, read, ask, shut=shut, kept=kept, lanes=lanes,
                   copies=copies)

    def terms(folder: dict) -> list[str]:
        words = (folder.get("summary") or "").split()
        return [f'{folder["title"]} {" ".join(words[:n])}' for n in range(1, min(3, len(words)) + 1)]

    async def named(row: dict) -> dict:
        if row.get("artist") and (scope is None or row.get("artist_id")):
            return row
        if scope is None and row.get("summary"):
            return row
        if scope is not None and scope.apart(row["id"]):
            # Its own id says the tab does not hold it: it is left out below,
            # whatever reading it again would say.
            return row
        again = await found.again(row["id"])
        if (again and again.get("item_type") == "track" and again.get("id")
                and fold(again.get("title") or "") == fold(row.get("title") or "")):
            return again
        return row

    plain = [row for row in rows if row.get("item_type") == "track" and row.get("id")]
    copies_of, read_again = await asyncio.gather(
        found.resolve(rows, terms, opened=opened, narrow=narrow, within=within),
        asyncio.gather(*map(named, plain)))
    by_id = {row["id"]: again for row, again in zip(plain, read_again)}
    lined: list[list[dict]] = []
    for row in rows:
        if row.get("item_type") == "track" and row.get("id"):
            lined.append([by_id[row["id"]]])
        elif found.is_folder(row):
            lined.append(copies_of.get(found.name(row), []))
    out: list[dict] = []
    for among in lined:
        out.extend([song for song in among
                    if scope is None or (not scope.apart(song.get("id") or "")
                                         and scope.home(song.get("artist_id") or "") is not None)][:1])
    return out


async def found_artists(rows: list[dict], open_page: Opener, read: Reader, ask: Asker, *,
                        shut: Iterable[str] = (), kept: dict | None = None,
                        scope: Scope | None = None,
                        tried: int = 12, lanes: int = 6, copies: int = 6,
                        opened: bool = True) -> list[dict]:
    """The artists among what a search for artists answered that have a page
    to turn to, in the order found, from the first ``tried`` rows. One kept
    somewhere the tab does not list is left out (``scope``, where the tab's
    ids say what it holds), and the rest go by the ids the tab knows them by.

    A folder that holds copies of one artist (see ``_Found``) stands for the
    first copy the tab holds that opens, under the folder's title. With
    ``opened`` off only the folders whose copies are kept are answered.
    """
    found = _Found("artist", open_page, read, ask, shut=shut, kept=kept, lanes=lanes,
                   copies=copies)
    rows = [row for row in rows if row.get("id") and row.get("title")
            and (row.get("item_type") == "artist" or found.is_folder(row))][:tried]
    copies_of = await found.resolve(rows, lambda folder: [folder["title"]], opened=opened)
    lined: list[dict] = []
    for row in rows:
        if row.get("item_type") == "artist":
            lined.append({"id": row["id"], "title": row["title"]})
        else:
            lined.extend({"id": copy["id"], "title": row["title"], "of": found.name(row)}
                         for copy in copies_of.get(found.name(row), []))
    if scope is not None:
        lined = [{**artist, "id": home} for artist in lined
                 if (home := scope.home(artist["id"])) is not None]
    opening = await with_a_page(lined, open_page, tried=len(lined), lanes=lanes)
    out: list[dict] = []
    met: set = set()
    for artist in opening:
        of = artist.pop("of", None)
        if of is not None:
            if of in met:
                continue
            met.add(of)
        out.append(artist)
    return out


def song_key(household: str, source: str, account: str, track: str) -> str:
    """What a song is filed under: the household it was found in, the source
    (``svc:<sid>`` or ``library``), the account on it, and the source's own
    id for the track."""
    return "|".join((household, source, account, track))


#: The parts of a favorite's address that say which login plays it, not what
#: it plays.
_LOGIN_PARTS = ("sn=", "flags=")


def favorite_key(uri: str, metadata: str, own_id: str) -> str:
    """What a favorite is filed under in its household: what it plays.

    The login in the address is left out, so a service signed into again
    keeps its favorites' numbers, and a favorite taken off the list and put
    back finds the number it had. A favorite with no address is filed under
    the item its description names, and one with neither under the speakers'
    own id for it.
    """
    head, _, query = (uri or "").partition("?")
    if head:
        kept = [part for part in query.split("&")
                if part and not part.startswith(_LOGIN_PARTS)]
        target = head + ("?" + "&".join(kept) if kept else "")
    else:
        named = re.search(r'<item id="([^"]+)"', metadata or "")
        target = f"item:{named.group(1)}" if named else f"own:{own_id}"
    return target


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    os.replace(tmp, path)


class Songbook:
    """The numbers given out, what is known of each source, and the artists
    written in.

    Kept as one JSON file: ``songs`` maps a song's key to its number and the
    few facts that play it again (its source, account, id, title, and so on);
    ``favorites`` maps a household to its favorites' keys and their numbers,
    and nothing more, since the speakers keep the favorites themselves;
    ``shelves`` maps a source to what its tree has for the binder (where its
    artist list is, which lists hold what the account has saved, which of its
    search categories find artists and songs), with the time that was learned;
    ``filed`` maps a source to the artists written in, each id with its name.
    No login is written here:
    what plays a song is built afresh from the household's accounts when the
    number is asked for.
    """

    def __init__(self, path: Path, *, clock: Callable[[], float] = time.time):
        self._path = path
        self._clock = clock
        self._songs: dict[str, dict] = {}
        self._shelves: dict[str, dict] = {}
        self._favorites: dict[str, dict[str, int]] = {}
        self._filed: dict[str, dict[str, str]] = {}
        self._next = FIRST
        try:
            data = json.loads(path.read_text())
        except FileNotFoundError:
            data = {}
        except (OSError, ValueError) as exc:
            log.warning("songbook: %s could not be read (%s); starting a new one",
                        path.name, exc)
            data = {}
        if isinstance(data, dict):
            songs = data.get("songs")
            if isinstance(songs, dict):
                self._songs = {k: v for k, v in songs.items()
                               if isinstance(v, dict) and isinstance(v.get("n"), int)}
            shelves = data.get("shelves")
            if isinstance(shelves, dict):
                self._shelves = {k: v for k, v in shelves.items() if isinstance(v, dict)}
            favorites = data.get("favorites")
            if isinstance(favorites, dict):
                self._favorites = {
                    household: {k: n for k, n in held.items() if type(n) is int}
                    for household, held in favorites.items() if isinstance(held, dict)}
            filed = data.get("filed")
            if isinstance(filed, dict):
                self._filed = {
                    source: {k: name for k, name in held.items() if isinstance(name, str)}
                    for source, held in filed.items() if isinstance(held, dict)}
        self._by_number = {v["n"]: k for k, v in self._songs.items()}
        # Never below a number already given, whatever the file says.
        highest = max(self._by_number, default=FIRST - 1)
        stated = data.get("next") if isinstance(data, dict) else None
        self._next = max(highest + 1, stated if isinstance(stated, int) else FIRST, FIRST)

    def __len__(self) -> int:
        return len(self._songs)

    def _save(self) -> None:
        try:
            _write_json(self._path, {"version": 1, "next": self._next,
                                     "songs": self._songs, "favorites": self._favorites,
                                     "shelves": self._shelves, "filed": self._filed})
        except OSError as exc:
            log.warning("songbook: could not be saved: %s", exc)

    # -- numbers ----------------------------------------------------------

    def number(self, songs: list[tuple[str, dict]]) -> list[int | None]:
        """The number of each song, giving one to any that has none yet.

        ``songs`` is a list of (key, facts). A song met before keeps its
        number and takes the facts as they now stand (a title corrected at
        the source reads corrected here). A number is never given twice: when
        the last one has gone, a song goes without, and None says so.
        """
        out: list[int | None] = []
        changed = False
        for key, facts in songs:
            held = self._songs.get(key)
            if held is not None:
                fresh = {**facts, "n": held["n"]}
                if fresh != held:
                    self._songs[key] = fresh
                    changed = True
                out.append(held["n"])
                continue
            if self._next > LAST:
                out.append(None)
                continue
            n = self._next
            self._next += 1
            self._songs[key] = {**facts, "n": n}
            self._by_number[n] = key
            out.append(n)
            changed = True
        if changed:
            self._save()
        return out

    def find(self, number: int) -> dict | None:
        """The facts kept for a number, or None when it was never given."""
        key = self._by_number.get(number)
        return dict(self._songs[key]) if key else None

    def facts(self, key: str) -> dict:
        """The facts kept for a song's key, none where it has no number."""
        return dict(self._songs.get(key) or {})

    def favorite_numbers(self, household: str, keys: list[str]) -> list[int | None]:
        """The number of each of a household's favorites, giving one to any
        that has none yet.

        A favorite met before keeps its number however the list has been
        reordered since. A favorite that has gone stays on file, so its number
        is not given to another and is its own again if it comes back. When
        the last number has gone a favorite goes without, and None says so.
        """
        held = self._favorites.get(household, {})
        following = max(held.values(), default=FAVORITE_FIRST - 1) + 1
        out: list[int | None] = []
        changed = False
        for key in keys:
            number = held.get(key)
            if number is None and following <= FAVORITE_LAST:
                number = held[key] = following
                following += 1
                changed = True
            out.append(number)
        if changed:
            self._favorites[household] = held
            self._save()
        return out

    # -- what a source has ---------------------------------------------------

    def shelf(self, source: str) -> dict | None:
        """What is known of a source and still believed, or None when it has
        to be looked through: ``item`` and ``total`` for its artist list
        (``item`` empty for a source without one), ``saved`` for the lists
        holding what the account has saved, ``search`` for the search
        categories that find ``artists`` and ``tracks``, each under its id,
        and ``on_demand`` for whether it has songs to ask for by name."""
        held = self._shelves.get(source)
        if not held or held.get("v") != SHELF_SHAPE:
            return None
        useful = (held.get("item") or held.get("saved") or held.get("follows") or held.get("home")
                  or held.get("search"))
        kept = (PARTIAL_SHELF_KEPT_S if held.get("partial")
                else SHELF_KEPT_S if useful else NO_SHELF_KEPT_S)
        if self._clock() - float(held.get("at") or 0) > kept:
            return None
        return held

    def keep_shelf(self, source: str, found: dict | None) -> None:
        found = found or {}
        self._shelves[source] = {
            "item": found.get("item") or "", "total": int(found.get("total") or 0),
            "saved": [str(item) for item in found.get("saved") or []],
            "follows": [str(item) for item in found.get("follows") or []],
            "home": bool(found.get("home")),
            "search": {str(k): str(v) for k, v in (found.get("search") or {}).items()},
            "on_demand": bool(found.get("on_demand")),
            "partial": bool(found.get("partial")),
            "shut": [str(item) for item in found.get("shut") or []],
            "own": bool(found.get("own")),
            "v": SHELF_SHAPE, "at": self._clock()}
        self._save()

    def shut(self, source: str) -> list[str]:
        """The folders of a source that a look through it never opens or
        goes into, however old what else is known of it."""
        return list((self._shelves.get(source) or {}).get("shut") or [])

    def forget_shelf(self, source: str) -> None:
        held = self._shelves.pop(source, None)
        if held is None:
            return
        if held.get("shut"):
            self._shelves[source] = {"shut": held["shut"]}
        self._save()

    # -- artists written in -------------------------------------------------

    def filed(self, source: str) -> dict[str, str]:
        """The artists written in behind a source's tab: each id and its name."""
        return dict(self._filed.get(source, {}))

    def file_artist(self, source: str, artist: str, name: str) -> None:
        """Keep an artist behind a source's tab. One filed before takes the
        name as it now reads."""
        held = self._filed.setdefault(source, {})
        if held.get(artist) != name:
            held[artist] = name
            self._save()

    def unfile_artist(self, source: str, artist: str) -> None:
        held = self._filed.get(source)
        if held and held.pop(artist, None) is not None:
            if not held:
                del self._filed[source]
            self._save()
