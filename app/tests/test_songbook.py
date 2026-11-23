"""The songbook: the numbers it keeps, finding a service's artists, and
reading an artist's songs."""

import asyncio
import json

import pytest

from backend.sonos import songbook


def _row(ident, kind, *, folder=False, **more):
    return {"id": ident, "title": more.pop("title", ident), "item_type": kind,
            "is_container": folder, "can_play": more.pop("can_play", True), **more}


def _tree(pages):
    """An opener over a made-up tree: ``pages`` maps a container's id to its rows."""
    asked = []

    async def open_page(item, index):
        asked.append((item, index))
        if item not in pages:
            raise RuntimeError("no such container")
        rows = pages[item]
        return rows[index:index + 100], len(rows)

    open_page.asked = asked
    return open_page


def _run(coro):
    return asyncio.run(coro)


# -- numbers -------------------------------------------------------------------

def test_a_song_keeps_its_number(tmp_path):
    book = songbook.Songbook(tmp_path / "songbook.json")
    first = book.number([("a", {"t": "One"}), ("b", {"t": "Two"})])
    assert first == [songbook.FIRST, songbook.FIRST + 1]
    again = book.number([("b", {"t": "Two"}), ("c", {"t": "Three"}), ("a", {"t": "One"})])
    assert again == [songbook.FIRST + 1, songbook.FIRST + 2, songbook.FIRST]


def test_numbers_survive_a_restart_and_are_never_given_twice(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    book.number([("a", {"t": "One"}), ("b", {"t": "Two"})])
    reopened = songbook.Songbook(path)
    assert reopened.find(songbook.FIRST + 1)["t"] == "Two"
    assert reopened.number([("c", {"t": "Three"})]) == [songbook.FIRST + 2]
    assert len(reopened) == 3


def test_a_file_that_understates_its_next_number_is_not_believed(tmp_path):
    path = tmp_path / "songbook.json"
    path.write_text(json.dumps({"next": songbook.FIRST,
                                "songs": {"a": {"n": songbook.FIRST + 7, "t": "One"}}}))
    book = songbook.Songbook(path)
    assert book.number([("b", {"t": "Two"})]) == [songbook.FIRST + 8]


def test_a_broken_file_starts_a_new_book(tmp_path):
    path = tmp_path / "songbook.json"
    path.write_text("{not json")
    book = songbook.Songbook(path)
    assert book.number([("a", {"t": "One"})]) == [songbook.FIRST]


def test_a_corrected_title_reads_corrected_under_the_same_number(tmp_path):
    book = songbook.Songbook(tmp_path / "songbook.json")
    book.number([("a", {"t": "Teh Song"})])
    assert book.number([("a", {"t": "The Song"})]) == [songbook.FIRST]
    assert book.find(songbook.FIRST)["t"] == "The Song"


def test_when_the_numbers_run_out_a_song_goes_without(tmp_path, monkeypatch):
    monkeypatch.setattr(songbook, "LAST", songbook.FIRST + 1)
    book = songbook.Songbook(tmp_path / "songbook.json")
    assert book.number([("a", {}), ("b", {}), ("c", {})]) == [
        songbook.FIRST, songbook.FIRST + 1, None]
    assert book.number([("a", {})]) == [songbook.FIRST]


def test_an_unknown_number_finds_nothing(tmp_path):
    book = songbook.Songbook(tmp_path / "songbook.json")
    assert book.find(12345) is None


def test_a_favorite_keeps_its_number_when_the_list_is_reordered(tmp_path):
    book = songbook.Songbook(tmp_path / "songbook.json")
    assert book.favorite_numbers("hh", ["a", "b", "c"]) == [9001, 9002, 9003]
    assert book.favorite_numbers("hh", ["c", "a", "b"]) == [9003, 9001, 9002]


def test_a_removed_favorites_number_is_not_given_to_another(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    book.favorite_numbers("hh", ["a", "b", "c"])
    assert book.favorite_numbers("hh", ["a", "c", "d"]) == [9001, 9003, 9004]
    again = songbook.Songbook(path)
    assert again.favorite_numbers("hh", ["d", "b", "e"]) == [9004, 9002, 9005]


def test_each_household_numbers_its_favorites_from_the_first(tmp_path):
    book = songbook.Songbook(tmp_path / "songbook.json")
    assert book.favorite_numbers("one", ["a", "b"]) == [9001, 9002]
    assert book.favorite_numbers("two", ["b", "z"]) == [9001, 9002]


def test_when_the_favorite_numbers_run_out_a_favorite_goes_without(tmp_path, monkeypatch):
    monkeypatch.setattr(songbook, "FAVORITE_LAST", 9002)
    book = songbook.Songbook(tmp_path / "songbook.json")
    assert book.favorite_numbers("hh", ["a", "b", "c"]) == [9001, 9002, None]
    assert book.favorite_numbers("hh", ["c", "a"]) == [None, 9001]


def test_favorites_and_songs_are_kept_in_one_file_without_disturbing_each_other(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    key = songbook.song_key("hh", "library", "", "x-file-cifs://nas/a.mp3")
    assert book.number([(key, {"t": "A"})]) == [10000]
    book.favorite_numbers("hh", ["a"])
    again = songbook.Songbook(path)
    assert again.number([(key, {"t": "A"})]) == [10000]
    assert again.favorite_numbers("hh", ["a"]) == [9001]
    assert again.find(9001) is None


def test_a_file_written_before_favorites_were_numbered_still_loads(tmp_path):
    path = tmp_path / "songbook.json"
    path.write_text(json.dumps({"version": 1, "next": 10001, "shelves": {},
                                "songs": {"k": {"n": 10000, "t": "A"}}}))
    book = songbook.Songbook(path)
    assert book.find(10000)["t"] == "A"
    assert book.favorite_numbers("hh", ["a"]) == [9001]


def test_a_favorite_is_filed_under_what_it_plays_not_the_login_that_plays_it():
    key = songbook.favorite_key
    one = key("x-sonos-http:track%3a12.mp3?sid=2&flags=8224&sn=3", "", "FV:2/7")
    assert one == key("x-sonos-http:track%3a12.mp3?sid=2&flags=8232&sn=9", "", "FV:2/31")
    assert one != key("x-sonos-http:track%3a12.mp3?sid=9&flags=8224&sn=3", "", "FV:2/7")
    # A stream's own query says which stream it is, and stays.
    assert key("x-rincon-mp3radio://radio.invalid/live?station=3", "", "FV:2/1") != key(
        "x-rincon-mp3radio://radio.invalid/live?station=4", "", "FV:2/2")


def test_a_favorite_with_no_address_is_filed_under_its_description_or_its_id():
    key = songbook.favorite_key
    described = '<DIDL-Lite><item id="1006206cplaylist%3a55" parentID="-1"></item></DIDL-Lite>'
    assert key("", described, "FV:2/4") == key("", described, "FV:2/90")
    assert key("", "", "FV:2/4") != key("", "", "FV:2/90")


def test_song_keys_tell_households_sources_and_accounts_apart():
    keys = {songbook.song_key("H1", "svc:9", "1", "t"),
            songbook.song_key("H2", "svc:9", "1", "t"),
            songbook.song_key("H1", "svc:8", "1", "t"),
            songbook.song_key("H1", "svc:9", "2", "t")}
    assert len(keys) == 4


# -- what is known of a source's artist list -------------------------------------

def test_a_found_list_is_believed_for_a_month_and_none_for_a_week(tmp_path):
    now = [1000.0]
    book = songbook.Songbook(tmp_path / "songbook.json", clock=lambda: now[0])
    book.keep_shelf("with", {"item": "artists", "total": 40})
    book.keep_shelf("without", None)
    held = book.shelf("with")
    assert (held["item"], held["total"], held["at"]) == ("artists", 40, 1000.0)
    assert book.shelf("without")["item"] == ""
    assert book.shelf("never asked") is None
    now[0] += songbook.NO_SHELF_KEPT_S + 1
    assert book.shelf("without") is None and book.shelf("with") is not None
    now[0] += songbook.SHELF_KEPT_S
    assert book.shelf("with") is None


def test_a_forgotten_list_is_looked_for_again(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    book.keep_shelf("s", {"item": "artists", "total": 3})
    book.forget_shelf("s")
    assert songbook.Songbook(path).shelf("s") is None


def test_a_source_with_only_saved_lists_or_a_search_is_believed_for_a_month(tmp_path):
    now = [1000.0]
    book = songbook.Songbook(tmp_path / "songbook.json", clock=lambda: now[0])
    book.keep_shelf("saved", {"saved": ["songs", "albums"], "on_demand": True})
    book.keep_shelf("search", {"search": {"artists": "artist", "tracks": "song"}})
    now[0] += songbook.NO_SHELF_KEPT_S + 1
    assert book.shelf("saved")["saved"] == ["songs", "albums"]
    assert book.shelf("saved")["on_demand"] is True
    assert book.shelf("search")["search"] == {"artists": "artist", "tracks": "song"}


def test_an_answer_kept_in_an_older_shape_is_looked_for_again(tmp_path):
    path = tmp_path / "songbook.json"
    path.write_text(json.dumps({"shelves": {"s": {"item": "", "total": 0, "at": 1000.0}}}))
    book = songbook.Songbook(path, clock=lambda: 1001.0)
    assert book.shelf("s") is None


# -- artists written in ----------------------------------------------------------

def test_a_written_in_artist_stays_filed_behind_its_own_tab(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    book.file_artist("H1|svc:9:1", "ar1", "Nina Vega")
    book.file_artist("H1|svc:9:1", "ar2", "The Lanterns")
    book.file_artist("H1|svc:9:2", "ar3", "Other Account")
    reopened = songbook.Songbook(path)
    assert reopened.filed("H1|svc:9:1") == {"ar1": "Nina Vega", "ar2": "The Lanterns"}
    assert reopened.filed("H1|svc:9:2") == {"ar3": "Other Account"}
    assert reopened.filed("H1|svc:8:1") == {}


def test_a_filed_artist_can_be_taken_out_and_renamed(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    book.file_artist("s", "ar1", "Nina Vega")
    book.file_artist("s", "ar1", "Nina Vega Trio")
    book.file_artist("s", "ar2", "The Lanterns")
    book.unfile_artist("s", "ar2")
    book.unfile_artist("s", "never filed")
    assert songbook.Songbook(path).filed("s") == {"ar1": "Nina Vega Trio"}


def test_filing_artists_leaves_the_numbers_alone(tmp_path):
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path)
    book.number([("a", {"t": "One"})])
    book.file_artist("s", "ar1", "Nina Vega")
    reopened = songbook.Songbook(path)
    assert reopened.find(songbook.FIRST)["t"] == "One"
    assert reopened.number([("b", {"t": "Two"})]) == [songbook.FIRST + 1]


# -- finding a service's artists -------------------------------------------------

def test_a_page_is_an_artist_list_when_most_rows_are_artists():
    artists = [_row(f"a{i}", "artist", folder=True) for i in range(3)]
    assert songbook.is_artist_list(artists + [_row("all", "container", folder=True)])
    assert not songbook.is_artist_list(artists[:1] + [_row("x", "album", folder=True)] * 2)
    assert not songbook.is_artist_list([])


def test_the_longest_artist_list_wins_over_a_shelf_of_a_few():
    pages = {
        "root": [_row("picks", "container", folder=True),
                 _row("library", "container", folder=True),
                 _row("mix", "playlist", folder=True)],
        "picks": [_row(f"p{i}", "artist", folder=True) for i in range(4)],
        "library": [_row("lib-artists", "container", folder=True),
                    _row("lib-albums", "albumList", folder=True)],
        "lib-artists": [_row(f"a{i}", "artist", folder=True) for i in range(250)],
    }
    found = _run(songbook.find_artist_list(_tree(pages)))
    assert found == {"item": "lib-artists", "total": 250}


def test_only_plain_folders_are_opened_in_the_search():
    pages = {
        "root": [_row("mix", "playlist", folder=True), _row("st", "program", folder=True),
                 _row("al", "album", folder=True), _row("tr", "track")],
    }
    opener = _tree(pages)
    assert _run(songbook.find_artist_list(opener)) is None
    assert opener.asked == [("root", 0)]


def test_the_search_stops_at_its_budget_and_its_depth():
    pages = {"root": [_row(f"f{i}", "container", folder=True) for i in range(40)]}
    for i in range(40):
        pages[f"f{i}"] = [_row(f"f{i}-{j}", "container", folder=True) for j in range(40)]
    opener = _tree(pages)
    assert _run(songbook.find_artist_list(opener, budget=9, fan=5)) is None
    assert len(opener.asked) == 9
    # Never more than ``fan`` folders of one container.
    assert [item for item, _ in opener.asked[1:6]] == [f"f{i}" for i in range(5)]


def test_a_folder_that_will_not_open_does_not_end_the_search():
    pages = {"root": [_row("broken", "container", folder=True),
                      _row("artists", "container", folder=True)],
             "artists": [_row("a", "artist", folder=True)]}
    assert _run(songbook.find_artist_list(_tree(pages))) == {"item": "artists", "total": 1}


def test_a_service_that_refuses_its_root_is_an_error():
    with pytest.raises(RuntimeError):
        _run(songbook.find_artist_list(_tree({})))


# -- what a service's tree has for the binder ------------------------------------

def test_folders_are_opened_in_turn_so_a_long_one_does_not_starve_the_next():
    pages = {"root": [_row("new", "collection", folder=True),
                      _row("radio", "collection", folder=True),
                      _row("library", "collection", folder=True)],
             "new": [_row(f"n{i}", "collection", folder=True) for i in range(5)],
             "radio": [_row(f"r{i}", "collection", folder=True) for i in range(35)],
             "library": [_row("artists", "container", folder=True),
                         _row("albums", "container", folder=True),
                         _row("songs", "container", folder=True)],
             "artists": [_row("a1", "artist", folder=True)],
             "albums": [_row("al1", "album", folder=True, artist="Nina Vega", artist_id="a1")],
             "songs": [_row(f"t{i}", "track") for i in range(11)]}
    for i in range(5):
        pages[f"n{i}"] = []
    for i in range(35):
        pages[f"r{i}"] = [_row(f"st{i}", "stream")]
    opener = _tree(pages)
    found = _run(songbook.survey(opener, budget=16))
    assert [item for item, _ in opener.asked[4:10]] == ["n0", "r0", "artists", "n1", "r1", "albums"]
    assert (found["item"], found["total"]) == ("artists", 1)
    assert found["saved"] == ["albums", "songs"]
    assert found["on_demand"] is True


def test_saved_lists_are_the_ones_beside_the_accounts_own_playlists():
    pages = {"root": [_row("popular", "container", folder=True),
                      _row("new", "albumList", folder=True),
                      _row("mine", "collection", folder=True)],
             "popular": [_row(f"pl{i}", "playlist", folder=True) for i in range(3)],
             "new": [_row("x", "album", folder=True, artist="Promoted", artist_id="p1")],
             "mine": [_row("playlists", "collection", folder=True, user_content=True),
                      _row("songs", "trackList", folder=True),
                      _row("albums", "albumList", folder=True)],
             "playlists": [_row("mix", "playlist", folder=True)]}
    found = _run(songbook.survey(_tree(pages)))
    assert found["item"] == "" and found["saved"] == ["songs", "albums"]
    assert found["on_demand"] is True


def test_what_a_service_shows_at_its_top_is_not_taken_for_saved():
    pages = {"root": [_row("artists", "container", folder=True),
                      _row("new", "albumList", folder=True),
                      _row("charts", "trackList", folder=True)],
             "artists": [_row(f"a{i}", "artist", folder=True) for i in range(9)]}
    found = _run(songbook.survey(_tree(pages)))
    assert (found["item"], found["total"], found["saved"]) == ("artists", 9, [])


def test_a_service_of_stations_has_nothing_asked_for_by_name():
    pages = {"root": [_row("local", "container", folder=True), _row("s1", "stream")],
             "local": [_row("s2", "stream"), _row("p1", "program", folder=True)]}
    found = _run(songbook.survey(_tree(pages)))
    assert found == {"item": "", "total": 0, "saved": [], "follows": [], "on_demand": False,
                     "partial": False, "shut": [], "own": True}


def test_a_folder_that_fails_once_is_asked_again_before_the_answer():
    pages = {"root": [_row("artists", "container", folder=True),
                      _row("recent", "container", folder=True)],
             "artists": [_row(f"a{i}", "artist", folder=True) for i in range(40)],
             "recent": [_row("a7", "artist", folder=True)]}
    inner = _tree(pages)
    failed = []

    async def opener(item, index):
        if item == "artists" and not failed:
            failed.append(item)
            raise RuntimeError("timed out")
        return await inner(item, index)

    found = _run(songbook.survey(opener))
    assert (found["item"], found["total"], found["partial"]) == ("artists", 40, False)
    assert [item for item, _ in inner.asked] == ["root", "recent", "artists"]


def test_a_folder_that_never_opens_makes_the_answer_partial():
    pages = {"root": [_row("broken", "container", folder=True),
                      _row("recent", "container", folder=True)],
             "recent": [_row("a7", "artist", folder=True)]}
    opener = _tree(pages)
    found = _run(songbook.survey(opener))
    assert (found["item"], found["total"], found["partial"]) == ("recent", 1, True)
    assert [item for item, _ in opener.asked].count("broken") == 2


def test_a_list_that_runs_past_its_first_page_ends_the_search_at_its_level():
    pages = {"root": [_row("artists", "container", folder=True),
                      _row("more", "container", folder=True)],
             "artists": [_row(f"a{i}", "artist", folder=True) for i in range(140)],
             "more": [_row("deeper", "container", folder=True)],
             "deeper": [_row(f"d{i}", "artist", folder=True) for i in range(900)]}
    opener = _tree(pages)
    found = _run(songbook.survey(opener))
    assert (found["item"], found["total"]) == ("artists", 140)
    assert [item for item, _ in opener.asked] == ["root", "artists", "more"]


def _libraries(names, chosen, *, artists=3, restless=False):
    """An opener over a service that keeps several libraries: its root shows
    the chosen one, and opening a library in the list chooses it. A library's
    own page is the root's with one row swapped, the root's first folder
    repeats two of the root's rows, and the folder of libraries has a new id
    at every reading, as a service of this kind was seen to do. A ``restless``
    one also retitles a row at every reading."""
    state = {"chosen": chosen, "reads": 0}
    asked = []

    def top(name):
        state["reads"] += 1
        played = f"Played {state['reads']} ago" if restless else "Played"
        return [_row("discover", "container", folder=True, title=f"Discover ({name})"),
                _row("by-artist", "container", folder=True),
                _row("by-album", "albumList", folder=True),
                _row("recent", "albumList", folder=True, title=played),
                _row(f"libraries-{state['reads']}", "container", folder=True,
                     title="Libraries")]

    async def open_page(item, index):
        asked.append(item)
        if item == "root":
            return top(state["chosen"]), 5
        if item == "discover":
            return [_row("by-album", "albumList", folder=True),
                    _row("recent", "albumList", folder=True),
                    _row("fresh", "albumList", folder=True)], 3
        if item.startswith("libraries-"):
            return [_row(f"lib-{name}", "container", folder=True) for name in names], len(names)
        if item.startswith("lib-"):
            state["chosen"] = item[4:]
            return top(state["chosen"])[1:] + [_row("shuffle", "program")], 5
        if item == "by-artist":
            return [_row(f"{state['chosen']}-a{i}", "artist", folder=True)
                    for i in range(min(artists, 100))], artists
        return [], 0

    open_page.asked, open_page.state = asked, state
    return open_page


def test_a_folder_that_chooses_another_library_is_undone_and_its_list_left_shut():
    opener = _libraries(["one", "two", "three", "four"], "three")
    found = _run(songbook.survey(opener))
    assert opener.state["chosen"] == "three"
    assert (found["item"], found["total"]) == ("by-artist", 3)
    assert found["shut"] == ["Libraries", "libraries-1"]
    # One library was opened before the list was known for what it is, and
    # the ones after it only as far as the one that puts the root back.
    assert [item for item in opener.asked if item.startswith("lib-")] == [
        "lib-one", "lib-two", "lib-three"]


def test_a_list_of_libraries_known_from_before_is_not_gone_into():
    opener = _libraries(["one", "two", "three"], "two")
    # The id it had when it was found is not the one it has now.
    known = ["Libraries", "libraries-0"]
    found = _run(songbook.survey(opener, shut=known))
    assert opener.state["chosen"] == "two"
    assert found["shut"] == known
    assert opener.asked == ["root", "discover", "by-artist"]


def test_opening_the_library_already_chosen_opens_no_other():
    opener = _libraries(["one", "two", "three"], "one")
    found = _run(songbook.survey(opener))
    assert opener.state["chosen"] == "one" and found["shut"] == ["Libraries", "libraries-1"]
    assert [item for item in opener.asked if item.startswith("lib-")] == ["lib-one"]


def test_a_long_list_at_the_top_keeps_the_libraries_from_being_opened_at_all():
    opener = _libraries(["one", "two", "three"], "two", artists=400)
    found = _run(songbook.survey(opener))
    assert (found["item"], found["total"], found["shut"]) == ("by-artist", 400, [])
    assert "libraries-1" in opener.asked
    assert not [item for item in opener.asked if item.startswith("lib-")]


def test_a_folder_that_repeats_a_few_of_the_roots_rows_is_a_shelf_like_any_other():
    opener = _libraries(["one", "two"], "two", artists=400)
    found = _run(songbook.survey(opener))
    assert found["shut"] == []
    # Nothing was taken for the root again, so the root was read the once.
    assert opener.asked.count("root") == 1 and opener.asked.count("discover") == 1


def test_a_full_list_with_the_roots_featured_few_in_it_is_a_shelf_like_any_other():
    featured = [_row(f"s{i}", "stream") for i in range(6)]
    genres = [_row(f"g{i}", "container", folder=True) for i in range(3)]
    pages = {"root": featured + genres + [_row("all", "container", folder=True),
                                          _row("genres", "container", folder=True)],
             "all": featured + [_row(f"s{i}", "stream") for i in range(6, 51)],
             # Every folder the root has but itself and one other, among many more.
             "genres": genres + [_row(f"g{i}", "container", folder=True) for i in range(3, 30)],
             **{f"g{i}": [_row(f"g{i}-album", "album", folder=True)] for i in range(30)}}
    opener = _tree(pages)
    found = _run(songbook.survey(opener))
    assert found["shut"] == [] and found["on_demand"] is True
    assert [item for item, _ in opener.asked].count("root") == 1


def test_a_library_that_will_not_be_put_back_is_said_in_the_log(caplog):
    opener = _libraries(["one", "two", "three"], "elsewhere")
    with caplog.at_level("WARNING"):
        found = _run(songbook.survey(opener))
    assert found["shut"] == ["Libraries", "libraries-1"]
    assert "none beside it puts all of that back" in caplog.text


def test_a_root_that_never_reads_the_same_twice_ends_on_the_library_nearest_it():
    opener = _libraries(["one", "two", "three"], "two", restless=True)
    found = _run(songbook.survey(opener))
    assert found["shut"] == ["Libraries", "libraries-1"]
    # Each was tried, none read exactly as the root had, and the one that
    # read most like it was opened last.
    assert [item for item in opener.asked if item.startswith("lib-")] == [
        "lib-one", "lib-two", "lib-three", "lib-two"]
    assert opener.state["chosen"] == "two"


def test_libraries_listed_at_the_root_itself_are_each_undone_and_left_shut():
    state = {"chosen": "two"}
    names = ["one", "two", "three"]
    asked = []

    def top(name):
        return ([_row("by-artist", "container", folder=True)]
                + [_row(f"lib-{n}", "container", folder=True) for n in names]
                + [_row("picks", "albumList", folder=True, title=f"Picks ({name})")])

    async def opener(item, index):
        asked.append(item)
        if item.startswith("lib-"):
            state["chosen"] = item[4:]
            return top(state["chosen"])[:-1] + [_row("shuffle", "program")], 5
        if item == "root":
            return top(state["chosen"]), 5
        if item == "by-artist":
            return [_row(f"{state['chosen']}-a{i}", "artist", folder=True) for i in range(3)], 3
        return [], 0

    found = _run(songbook.survey(opener))
    assert state["chosen"] == "two"
    assert (found["item"], found["total"]) == ("by-artist", 3)
    assert found["shut"] == ["lib-one", "lib-three", "lib-two"]
    # The folder that put the root back the first time is the first tried
    # the second, and a folder read as a shelf is not tried at all.
    assert [item for item in asked if item != "root"] == [
        "by-artist", "lib-one", "lib-two", "lib-two", "lib-three", "lib-two"]


def test_the_folders_left_shut_outlive_what_else_is_known_of_a_source(tmp_path):
    now = [1000.0]
    path = tmp_path / "songbook.json"
    book = songbook.Songbook(path, clock=lambda: now[0])
    book.keep_shelf("s", {"item": "artists", "total": 3, "shut": ["libraries"]})
    assert book.shelf("s")["shut"] == ["libraries"]
    now[0] += songbook.SHELF_KEPT_S + 1
    assert book.shelf("s") is None and book.shut("s") == ["libraries"]
    book.forget_shelf("s")
    again = songbook.Songbook(path, clock=lambda: now[0])
    assert again.shelf("s") is None and again.shut("s") == ["libraries"]
    assert again.shut("never asked") == []


def test_a_partial_answer_is_believed_for_a_day(tmp_path):
    now = [1000.0]
    book = songbook.Songbook(tmp_path / "songbook.json", clock=lambda: now[0])
    book.keep_shelf("s", {"item": "recent", "total": 1, "partial": True})
    assert book.shelf("s")["total"] == 1
    now[0] += songbook.PARTIAL_SHELF_KEPT_S + 1
    assert book.shelf("s") is None


def test_saved_artists_are_read_off_the_saved_songs_and_albums():
    songs = [_row(f"t{i}", "track", artist="Nina Vega", artist_id="a1") for i in range(150)]
    songs.append(_row("t-last", "track", artist="The Lanterns", artist_id="a2"))
    pages = {"songs": songs,
             "albums": [_row("al1", "album", folder=True, artist="Nina Vega", artist_id="a1"),
                        _row("al2", "album", folder=True, artist="Solo Act", artist_id="a3"),
                        _row("al3", "album", folder=True, artist="No Id Given"),
                        _row("pl", "playlist", folder=True, artist="Someone", artist_id="a9")]}
    opener = _tree(pages)
    found = _run(songbook.saved_artists(opener, ["songs", "broken", "albums"]))
    assert found == {"a1": "Nina Vega", "a2": "The Lanterns", "a3": "Solo Act"}
    assert ("songs", 100) in opener.asked


def test_reading_the_saved_lists_keeps_to_its_budget():
    pages = {"songs": [_row(f"t{i}", "track", artist=f"Artist {i}", artist_id=f"a{i}")
                       for i in range(900)]}
    opener = _tree(pages)
    found = _run(songbook.saved_artists(opener, ["songs"], pages=10, budget=3))
    assert len(opener.asked) == 3 and len(found) == 300


def _followed_tree():
    """A service laid out as SoundCloud's was: accounts followed, as plain folders, each
    with a folder of its own songs; and a folder of charts beside it, whose folders hold
    other people's songs."""
    user = lambda n: f"user->sc:users:{n}"
    pages = {"root": [_row("likes", "playlist", folder=True),
                      _row("following", "container", folder=True),
                      _row("hot", "container", folder=True)],
             "following": [_row(user(n), "container", folder=True, title=f"Act {n}") for n in range(3)],
             "hot": [_row(f"new_and_hot->{g}", "container", folder=True) for g in ("music", "audio")]}
    for n in range(3):
        pages[user(n)] = [_row(f"songs-{n}", "playlist", folder=True), _row(f"sets-{n}", "playlist", folder=True)]
        pages[f"songs-{n}"] = [_row(f"t{n}", "track", artist=f"Act {n}", artist_id=user(n))]
    for g in ("music", "audio"):
        pages[f"new_and_hot->{g}"] = [_row(f"h-{g}", "track", artist="Someone", artist_id="user->sc:users:99")]
    return pages


def test_lists_of_accounts_followed_are_found_beside_the_rest():
    found = _run(songbook.survey(_tree(_followed_tree())))
    assert "following" in found["follows"]


def test_accounts_followed_are_artists_when_their_songs_say_so():
    pages = _followed_tree()
    found = _run(songbook.saved_artists(_tree(pages), [], follows=["following", "hot"]))
    assert found == {f"user->sc:users:{n}": f"Act {n}" for n in range(3)}


def test_folders_whose_songs_are_other_peoples_are_not_artists():
    pages = _followed_tree()
    found = _run(songbook.saved_artists(_tree(pages), [], follows=["hot"]))
    assert found == {}


def test_a_home_shelf_of_artists_alone_is_the_artists_followed():
    pages = {"picks": [_row("a1", "artist", folder=True), _row("al", "album", folder=True)],
             "followed": [_row(f"spotify:artist:{n}", "artist", folder=True, title=f"Act {n}") for n in range(3)],
             "charts": [_row(f"c{n}", "artist", folder=True) for n in range(300)],
             "mixes": [_row("m1", "playlist", folder=True)]}
    opener = _tree(pages)
    shelves = _run(songbook.artist_shelves(opener, ["picks", "gone", "followed", "charts", "mixes"]))
    assert shelves == ["followed"]
    found = _run(songbook.saved_artists(opener, [], follows=shelves))
    assert found == {f"spotify:artist:{n}": f"Act {n}" for n in range(3)}


def test_only_so_many_home_shelves_are_opened():
    pages = {f"s{n}": [_row(f"x{n}", "playlist", folder=True)] for n in range(40)}
    opener = _tree(pages)
    _run(songbook.artist_shelves(opener, list(pages), shelves=25))
    assert len(opener.asked) == 25


# -- an artist's songs -----------------------------------------------------------

def test_songs_are_read_from_the_albums_under_an_artist_each_once():
    pages = {
        "artist": [_row("al1", "album", folder=True), _row("al2", "album", folder=True),
                   _row("radio", "program", folder=True),
                   _row("similar", "artist", folder=True),
                   _row("liked", "playlist", folder=True)],
        "al1": [_row("t1", "track", title="Zebra", artist="The Band"),
                _row("t2", "track", title="Apple", artist="The Band")],
        "al2": [_row("t3", "track", title="apple", artist="The Band"),
                _row("t1", "track", title="Zebra", artist="The Band"),
                _row("t4", "track", title="Mango", artist="The Band")],
        "radio": [_row("x", "track", title="Other", artist="Someone")],
    }
    opener = _tree(pages)
    songs = _run(songbook.walk_songs(opener, "artist", "The Band"))
    assert [s["title"] for s in songs] == ["Apple", "Mango", "Zebra"]
    assert {item for item, _ in opener.asked} == {"artist", "al1", "al2"}


def test_other_artists_songs_under_an_artist_are_left_out():
    pages = {"artist": [_row("al", "album", folder=True)],
             "al": [_row("t1", "track", title="Theirs", artist="Björk"),
                    _row("t2", "track", title="Not theirs", artist="Somebody Else"),
                    _row("t3", "track", title="Unsigned", artist="")]}
    songs = _run(songbook.walk_songs(_tree(pages), "artist", "Bjork"))
    assert [s["title"] for s in songs] == ["Theirs", "Unsigned"]


def test_when_no_track_names_the_artist_the_services_word_stands():
    pages = {"artist": [_row("t1", "track", title="One", artist="Various"),
                        _row("t2", "track", title="Two", artist="Various")]}
    songs = _run(songbook.walk_songs(_tree(pages), "artist", "A Compilation Label"))
    assert [s["title"] for s in songs] == ["One", "Two"]


def test_a_folder_of_folders_under_an_artist_is_not_gone_through():
    pages = {"artist": [_row("albums", "container", folder=True),
                        _row("followers", "container", folder=True)],
             "albums": [_row("al", "album", folder=True)],
             "al": [_row("t1", "track", title="Theirs", artist="The Band")],
             "followers": [_row(f"fan{i}", "container", folder=True) for i in range(240)]}
    for i in range(240):
        pages[f"fan{i}"] = [_row(f"x{i}", "track", title=f"A fan's song {i}", artist="A Fan")]
    opener = _tree(pages)
    songs = _run(songbook.walk_songs(opener, "artist", "The Band"))
    assert [s["title"] for s in songs] == ["Theirs"]
    assert sorted(opener.asked) == [("al", 0), ("albums", 0), ("artist", 0), ("followers", 0)]


def test_an_artist_whose_songs_are_filed_as_playlists_is_read_from_them():
    pages = {"artist": [_row("uploads", "playlist", folder=True),
                        _row("sets", "playlist", folder=True),
                        _row("likes", "playlist", folder=True),
                        _row("followers", "container", folder=True)],
             "uploads": [_row("t1", "track", title="Mine", artist="The Uploader"),
                         _row("t2", "track", title="Also mine", artist="the uploader")],
             "sets": [_row("set1", "playlist", folder=True)],
             "set1": [_row("t9", "track", title="In a set", artist="The Uploader")],
             "likes": [_row("t3", "track", title="Liked", artist="Somebody Else"),
                       _row("t4", "track", title="Unsigned", artist="")],
             "followers": []}
    opener = _tree(pages)
    songs = _run(songbook.walk_songs(opener, "artist", "The Uploader"))
    assert [s["title"] for s in songs] == ["Also mine", "Mine"]
    assert "set1" not in {item for item, _ in opener.asked}


def test_playlists_under_an_artist_with_albums_are_left_shut():
    pages = {"artist": [_row("al", "album", folder=True), _row("mix", "playlist", folder=True)],
             "al": [_row("t1", "track", title="Theirs", artist="The Band")],
             "mix": [_row("t2", "track", title="Featuring them", artist="The Band and Friends")]}
    opener = _tree(pages)
    songs = _run(songbook.walk_songs(opener, "artist", "The Band"))
    assert [s["title"] for s in songs] == ["Theirs"]
    assert {item for item, _ in opener.asked} == {"artist", "al"}


def test_playlists_that_name_nobody_as_the_artist_give_no_songs():
    pages = {"artist": [_row("likes", "playlist", folder=True)],
             "likes": [_row("t3", "track", title="Liked", artist="Somebody Else")]}
    assert _run(songbook.walk_songs(_tree(pages), "artist", "The Listener")) == []


def test_a_long_album_is_read_to_its_end():
    pages = {"artist": [_row("al", "album", folder=True)],
             "al": [_row(f"t{i:03}", "track", title=f"Song {i:03}") for i in range(230)]}
    opener = _tree(pages)
    songs = _run(songbook.walk_songs(opener, "artist", ""))
    assert len(songs) == 230
    assert ("al", 200) in opener.asked


def test_tracks_that_cannot_be_played_are_not_listed():
    pages = {"artist": [_row("t1", "track", title="Plays"),
                        _row("t2", "track", title="Does not", can_play=False)]}
    songs = _run(songbook.walk_songs(_tree(pages), "artist", ""))
    assert [s["title"] for s in songs] == ["Plays"]


def test_the_walk_keeps_to_its_budget():
    pages = {"artist": [_row(f"al{i}", "album", folder=True) for i in range(50)]}
    for i in range(50):
        pages[f"al{i}"] = [_row(f"t{i}", "track", title=f"Song {i}")]
    opener = _tree(pages)
    songs = _run(songbook.walk_songs(opener, "artist", "", budget=10))
    assert len(opener.asked) <= 10 and 0 < len(songs) < 50


def test_found_artists_that_will_not_open_or_open_to_nothing_are_left_out():
    pages = {"a1": [_row("al", "album", folder=True)], "a3": [],
             "a4": [_row("t", "track", title="A song")]}
    found = [{"id": f"a{i}", "title": f"Artist {i}"} for i in range(1, 5)]
    opener = _tree(pages)
    kept = _run(songbook.with_a_page(found, opener))
    assert [a["id"] for a in kept] == ["a1", "a4"]
    assert sorted(opener.asked) == [("a1", 0), ("a2", 0), ("a3", 0), ("a4", 0)]


def test_only_the_first_found_artists_are_tried():
    pages = {f"a{i}": [_row("al", "album", folder=True)] for i in range(30)}
    found = [{"id": f"a{i}", "title": f"Artist {i}"} for i in range(30)]
    opener = _tree(pages)
    kept = _run(songbook.with_a_page(found, opener, tried=5))
    assert [a["id"] for a in kept] == ["a0", "a1", "a2", "a3", "a4"]
    assert len(opener.asked) == 5


def test_an_artist_that_will_not_open_is_an_error():
    with pytest.raises(RuntimeError):
        _run(songbook.walk_songs(_tree({}), "artist", "Anyone"))


# -- what a search answers with ------------------------------------------------

class _Searched:
    """A made-up service whose search answers with folders, and whose folder
    ids open to whatever the last answer filed under them."""

    def __init__(self, things, answers):
        self.things = things          # id -> the row as it reads back
        self.answers = answers        # words -> rows, a folder carrying "holds"
        self.under = {}
        self.read_ids = []
        self.asked = []
        self.opened = []

    def search(self, words):
        rows = self.answers.get(words, [])
        for row in rows:
            if "holds" in row:
                self.under[row["id"]] = row["holds"]
        return [{k: v for k, v in row.items() if k != "holds"} for row in rows]

    async def ask(self, words):
        self.asked.append(words)
        return self.search(words)

    async def read(self, ident):
        self.read_ids.append(ident)
        return self.things.get(ident)

    async def open_page(self, item, index):
        self.opened.append(item)
        if item in self.under:
            return [_row(ident, "artist", title="A library") for ident in self.under[item]], 2
        if item in self.things and self.things[item]["item_type"] == "artist":
            return [_row("al", "album", folder=True)], 1
        raise RuntimeError("no such container")


def _held(ident, title, summary, holds):
    return _row(ident, "container", folder=True, can_play=False, title=title,
                summary=summary, holds=holds)


def test_a_found_song_without_its_artist_is_read_again_for_it():
    service = _Searched(
        {"t1": _row("t1", "track", title="Low Tide", artist="The Marrows", artist_id="a1"),
         "t2": _row("t2", "track", title="Another song entirely", artist="Someone")},
        {"tide": [_row("t1", "track", title="Low Tide", summary="The Marrows on a server"),
                  _row("t2", "track", title="Low Tide Again"),
                  _row("t3", "track", title="Tide Pool", artist="Named Already")]})
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask))
    assert [(s["id"], s["title"], s.get("artist")) for s in songs] == [
        ("t1", "Low Tide", None), ("t2", "Low Tide Again", None),
        ("t3", "Tide Pool", "Named Already")]
    # With nothing to hold the songs to, the one the service describes in a
    # line of its own is shown by that line and not read again.
    assert songs[0]["summary"] == "The Marrows on a server"
    assert service.read_ids == ["t2"] and not service.asked


def test_a_folder_of_one_songs_copies_stands_for_the_song():
    service = _Searched(
        {"c1": _row("c1", "track", title="Low Tide", artist="The Marrows", artist_id="a1"),
         "c2": _row("c2", "track", title="Low Tide", artist="The Marrows", artist_id="b1")},
        {"tide": [_held("f1", "Low Tide", "The Marrows in 2 libraries", ["c1", "c2"]),
                  _row("al", "album", folder=True, title="Tides")]})
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask))
    assert [(s["id"], s["artist"]) for s in songs] == [("c1", "The Marrows")]
    assert service.opened == ["f1"] and not service.asked


def test_a_folder_that_opens_to_its_twins_song_is_asked_for_by_narrower_words():
    things = {"c1": _row("c1", "track", title="Low Tide", artist="The Marrows"),
              "c2": _row("c2", "track", title="Low Tide Rising", artist="Halden")}
    first = _held("f", "Low Tide", "The Marrows in 2 libraries", ["c1"])
    twin = _held("f", "Low Tide Rising", "Halden in 2 libraries", ["c2"])
    service = _Searched(things, {"tide": [first, twin], "Low Tide The": [first, twin],
                                 "Low Tide The Marrows": [first]})
    kept = {}
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, kept=kept))
    assert [(s["id"], s["artist"]) for s in songs] == [("c1", "The Marrows"), ("c2", "Halden")]
    assert service.asked == ["Low Tide The", "Low Tide The Marrows"]
    # The second time the same answer costs nothing.
    service.asked.clear(), service.opened.clear(), service.read_ids.clear()
    again = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, kept=kept))
    assert [s["id"] for s in again] == ["c1", "c2"]
    assert not service.asked and not service.opened and not service.read_ids


def test_the_twins_asked_for_in_one_answer_are_bounded_by_count_and_by_time():
    names = ["Halden", "Marrows", "Orrin", "Pell", "Quist"]
    things = {f"c{n}": _row(f"c{n}", "track", title=f"Low Tide {n}", artist=name)
              for n, name in enumerate(names)}
    twins = [_held("f", f"Low Tide {n}", f"{name} in 2 libraries", [f"c{n}"])
             for n, name in enumerate(names)]
    answers = {"tide": twins}
    answers.update({f"Low Tide {n} {name}": [twins[n]] for n, name in enumerate(names)})
    service = _Searched(things, answers)
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, narrow=9))
    assert [s["id"] for s in songs] == [f"c{n}" for n in range(5)]
    bounded = _Searched(things, answers)
    songs = _run(songbook.found_songs(bounded.search("tide"), bounded.open_page,
                                      bounded.read, bounded.ask, narrow=1))
    assert len(bounded.asked) == 1 and len(songs) < 5
    # With no time left for it none is asked for, and none is kept as empty:
    # the same search made again asks for them.
    kept = {}
    timed = _Searched(things, answers)
    _run(songbook.found_songs(timed.search("tide"), timed.open_page, timed.read, timed.ask,
                              kept=kept, narrow=9, within=0))
    assert not timed.asked and not any(not copies for copies in kept.values())
    songs = _run(songbook.found_songs(timed.search("tide"), timed.open_page, timed.read,
                                      timed.ask, kept=kept, narrow=9))
    assert [s["id"] for s in songs] == [f"c{n}" for n in range(5)]


def test_a_quick_look_opens_no_folder_and_answers_the_ones_already_read():
    things = {"c1": _row("c1", "track", title="Low Tide", artist="The Marrows", artist_id="a1"),
              "t3": _row("t3", "track", title="Tide Pool", artist="Named Already")}
    answer = {"tide": [_held("f1", "Low Tide", "The Marrows in 2 libraries", ["c1"]),
                       _row("t3", "track", title="Tide Pool", artist="Named Already")]}
    service = _Searched(things, answer)
    kept = {}
    assert songbook.folders_unread(service.search("tide"), kept)
    quick = _run(songbook.found_songs(service.search("tide"), service.open_page, service.read,
                                      service.ask, kept=kept, opened=False))
    assert [s["id"] for s in quick] == ["t3"] and not service.opened and not service.asked
    full = _run(songbook.found_songs(service.search("tide"), service.open_page, service.read,
                                     service.ask, kept=kept))
    assert [s["id"] for s in full] == ["c1", "t3"] and service.opened == ["f1"]
    # Once read, a folder is answered by a quick look too, and nothing is left unread.
    assert not songbook.folders_unread(service.search("tide"), kept)
    service.opened.clear()
    again = _run(songbook.found_songs(service.search("tide"), service.open_page, service.read,
                                      service.ask, kept=kept, opened=False))
    assert [s["id"] for s in again] == ["c1", "t3"] and not service.opened


def test_a_twin_that_narrower_words_cannot_single_out_is_left_out():
    things = {"c2": _row("c2", "track", title="Low Tide", artist="Halden")}
    first = _held("f", "Low Tide", "The Marrows in 2 libraries", ["c1"])
    twin = _held("f", "Low Tide", "Halden in 2 libraries", ["c2"])
    service = _Searched(things, {words: [first, twin] for words in (
        "tide", "Low Tide The", "Low Tide The Marrows", "Low Tide The Marrows in")})
    kept = {}
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, kept=kept))
    assert [(s["id"], s["artist"]) for s in songs] == [("c2", "Halden")]
    assert len(service.asked) == 3
    # It is not asked for again by the same search.
    again = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, kept=kept))
    assert [s["id"] for s in again] == ["c2"] and len(service.asked) == 3


def test_a_twin_whose_narrower_search_goes_unanswered_is_asked_for_again():
    things = {"c2": _row("c2", "track", title="Low Tide", artist="Halden")}
    first = _held("f", "Low Tide", "The Marrows in 2 libraries", ["c1"])
    twin = _held("f", "Low Tide", "Halden in 2 libraries", ["c2"])
    service = _Searched(things, {"tide": [first, twin]})
    calls = []

    async def ask(words):
        calls.append(words)
        raise RuntimeError("no answer")

    kept = {}
    for _ in range(2):
        songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                          service.read, ask, kept=kept))
        assert [s["id"] for s in songs] == ["c2"]
    assert len(calls) == 2


def test_a_found_folder_left_shut_is_never_opened():
    service = _Searched({}, {"tide": [_held("lib", "Low Tide", "", ["c1"])]})
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, shut=["lib"]))
    assert songs == [] and not service.opened and not service.read_ids


def test_a_folder_of_one_artists_copies_stands_for_the_copy_that_opens():
    things = {"x1": _row("x1", "track", title="Not an artist"),
              "a2": _row("a2", "artist", title="The Marrows"),
              "a3": _row("a3", "artist", title="The Marrows"),
              "a9": _row("a9", "artist", title="Marrowbone")}
    service = _Searched(things, {"marrows": [
        _held("f1", "The Marrows", "in 3 libraries", ["x1", "gone", "a2", "a3"]),
        _row("a9", "artist", title="Marrowbone"),
        _row("nope", "artist", title="Opens to nothing")]})
    artists = _run(songbook.found_artists(service.search("marrows"), service.open_page,
                                          service.read, service.ask))
    assert artists == [{"id": "a2", "title": "The Marrows"}, {"id": "a9", "title": "Marrowbone"}]


# -- what a tab holds, by its ids --------------------------------------------------

def _shelves(listed, *, root=("discover", "artists", "albums"), page=3, refuse=()):
    """An opener over a service whose list of artists is at ``artists``."""
    asked = []

    async def open_page(item, index):
        asked.append((item, index))
        if (item, index) in refuse:
            raise RuntimeError("no answer")
        if item == "root":
            return [_row(ident, "container", folder=True) for ident in root], len(root)
        if item == "artists":
            return ([_row(ident, "artist", folder=True, title=ident)
                     for ident in listed[index:index + page]], len(listed))
        return [_row("al", "album", folder=True)], 1

    open_page.asked = asked
    return open_page


_OWN = ["srv:2:10:artist", "srv:2:11:artist", "srv:2:12:artist", "srv:2:13:artist",
        "srv:2:14:artist", "srv:2:15:artist", "srv:2:16:artist"]


def test_the_lead_is_what_every_id_opens_with_up_to_its_last_mark():
    assert songbook.lead_of(_OWN) == "srv:2:"
    assert songbook.lead_of(["artist:100", "artist:101", "artist:155"]) == "artist:"
    assert songbook.lead_of(["a1", "a2"]) == ""
    assert songbook.lead_of(["srv:2:10:artist"]) == ""
    assert songbook.lead_of([]) == ""


def test_an_id_is_the_tabs_or_elsewhere_by_the_parts_it_fills_in():
    scope = songbook.Scope("srv:2:", _OWN)
    assert scope.home("srv:2:99:artist") == "srv:2:99:artist"
    assert scope.home("srv:3:10:artist") is None
    assert scope.home("other:2:10:artist") is None
    assert scope.home("other::10:artist") is None
    assert scope.home("srv::12:artist") == "srv:2:12:artist"
    assert scope.home("srv::99:artist") is None
    assert scope.home(":2:12:artist") == "srv:2:12:artist"
    assert scope.home("srv::12:album") is None
    # Built another way: it says nothing about where it is.
    assert scope.home("artist/99") == "artist/99"
    assert scope.home("srv:12") == "srv:12"
    assert scope.home("") == ""


def test_an_id_in_doubt_is_kept_where_the_list_was_not_read_to_its_end():
    scope = songbook.Scope("srv:2:", _OWN[:3], whole=False)
    assert scope.home("srv::11:artist") == "srv:2:11:artist"
    assert scope.home("srv::16:artist") == "srv::16:artist"
    assert scope.home("other::16:artist") is None
    assert scope.home("srv:3:16:artist") is None


def test_a_tabs_ids_are_read_where_its_list_is_a_row_of_the_root():
    opener = _shelves(_OWN)
    kept = {}
    scope = _run(songbook.scope_of(opener, "artists", kept=kept))
    assert scope.lead == "srv:2:" and scope.whole and scope.listed == _OWN
    assert sorted(opener.asked) == [("artists", 0), ("artists", 3), ("artists", 6), ("root", 0)]
    # The same list again costs its first page, and no more.
    assert _run(songbook.scope_of(opener, "artists", kept=kept)) is scope
    assert len(opener.asked) == 5
    first = _run(opener("artists", 0))
    assert _run(songbook.scope_of(opener, "artists", kept=kept, first=first)) is scope
    assert len(opener.asked) == 6


def test_a_list_kept_in_a_folder_says_nothing_of_what_a_search_finds():
    opener = _shelves(_OWN, root=("discover", "mine"))
    assert _run(songbook.scope_of(opener, "artists")) is None
    assert opener.asked == [("root", 0)]


def test_a_list_that_has_changed_is_read_again():
    kept = {}
    before = _run(songbook.scope_of(_shelves(_OWN), "artists", kept=kept))
    moved = [ident.replace("srv:2:", "srv:5:") for ident in _OWN]
    after = _run(songbook.scope_of(_shelves(moved), "artists", kept=kept))
    assert before.lead == "srv:2:" and after.lead == "srv:5:" and after.listed == moved


def test_a_list_too_long_or_not_read_to_its_end_leaves_the_doubtful_in():
    long = _run(songbook.scope_of(_shelves(_OWN), "artists", pages=2))
    assert not long.whole and long.listed == _OWN[:3]
    opener = _shelves(_OWN, refuse={("artists", 6)})
    kept = {}
    short = _run(songbook.scope_of(opener, "artists", kept=kept))
    assert not short.whole and "seen" not in kept
    assert short.home("srv::16:artist") == "srv::16:artist"


def test_ids_that_share_no_opening_say_nothing():
    assert _run(songbook.scope_of(_shelves(["a1", "b2", "c3"]), "artists")) is None


def test_a_found_song_by_an_artist_kept_elsewhere_is_left_out():
    service = _Searched(
        {"t2": _row("t2", "track", title="Low Tide", artist="The Marrows",
                    artist_id="other::10:artist"),
         "t5": _row("t5", "track", title="Neap", artist="Halden", artist_id="srv::11:artist")},
        {"tide": [_row("t1", "track", title="High Tide", artist="The Marrows",
                       artist_id="srv::10:artist"),
                  _row("t2", "track", title="Low Tide"),
                  _row("t3", "track", title="Tide Pool", artist="Nobody's Page"),
                  _row("t4", "track", title="Ebb", artist="Halden", artist_id="srv::99:artist"),
                  _row("t5", "track", title="Neap", artist="Halden")]})
    scope = songbook.Scope("srv:2:", _OWN)
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page,
                                      service.read, service.ask, scope=scope))
    assert [s["id"] for s in songs] == ["t1", "t3", "t5"]
    # No artist's page is opened to tell.
    assert not service.opened and sorted(service.read_ids) == ["t2", "t3", "t5"]


def test_a_found_song_whose_id_says_it_is_kept_elsewhere_is_not_read_again():
    service = _Searched(
        {"other::40:track": _row("other::40:track", "track", title="Low Tide", artist="Halden",
                                 artist_id="other::10:artist"),
         "srv::41:track": _row("srv::41:track", "track", title="Neap", artist="Halden",
                               artist_id="srv::11:artist")},
        {"tide": [_row("other::40:track", "track", title="Low Tide"),
                  _row("srv::41:track", "track", title="Neap")]})
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page, service.read,
                                      service.ask, scope=songbook.Scope("srv:2:", _OWN)))
    assert [s["id"] for s in songs] == ["srv::41:track"]
    assert service.read_ids == ["srv::41:track"]


def test_an_id_of_any_kind_says_where_it_is_by_its_opening_parts():
    scope = songbook.Scope("srv:2:", _OWN)
    assert scope.apart("other::40:track") and scope.apart("srv:3:40:track")
    assert not scope.apart("srv::40:track") and not scope.apart("srv:2:40:track")
    assert not scope.apart(":2:40:track") and not scope.apart("t40") and not scope.apart("")


def test_a_found_song_kept_elsewhere_is_left_out_though_it_names_no_artists_id():
    service = _Searched(
        {"other::40:track": _row("other::40:track", "track", title="Low Tide", artist="Nobody"),
         "srv::41:track": _row("srv::41:track", "track", title="Neap", artist="Nobody")},
        {"tide": [_row("other::40:track", "track", title="Low Tide", artist="Nobody"),
                  _row("srv::41:track", "track", title="Neap", artist="Nobody")]})
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page, service.read,
                                      service.ask, scope=songbook.Scope("srv:2:", _OWN)))
    assert [s["id"] for s in songs] == ["srv::41:track"]


def test_a_folder_of_copies_stands_for_the_copy_the_tab_holds():
    things = {"c1": _row("c1", "track", title="Low Tide", artist="The Marrows",
                         artist_id="other::10:artist"),
              "c2": _row("c2", "track", title="Low Tide", artist="The Marrows",
                         artist_id="srv::10:artist"),
              "d1": _row("d1", "track", title="Ebb", artist="Halden",
                         artist_id="other::11:artist")}
    service = _Searched(things, {"tide": [
        _held("f1", "Low Tide", "The Marrows in 2 libraries", ["c1", "c2"]),
        _held("f2", "Ebb", "Halden in 1 library", ["d1"])]})
    songs = _run(songbook.found_songs(service.search("tide"), service.open_page, service.read,
                                      service.ask, scope=songbook.Scope("srv:2:", _OWN)))
    assert [s["id"] for s in songs] == ["c2"]


def test_found_artists_kept_elsewhere_are_left_out_and_the_rest_go_by_the_tabs_ids():
    things = {ident: _row(ident, "artist", folder=True, title=title) for ident, title in (
        ("srv:2:10:artist", "The Marrows"), ("other:1:10:artist", "The Marrows"),
        ("srv:3:40:artist", "Marrow"), ("srv::12:artist", "Marrowbone"),
        ("srv:2:12:artist", "Marrowbone"), ("other:1:77:artist", "Halden"))}
    service = _Searched(things, {"marrow": [
        _held("f1", "The Marrows", "", ["other:1:10:artist", "srv:2:10:artist"]),
        _row("srv:3:40:artist", "artist", folder=True, title="Marrow"),
        _row("srv::12:artist", "artist", folder=True, title="Marrowbone"),
        _held("f2", "Halden", "", ["other:1:77:artist"])]})
    scope = songbook.Scope("srv:2:", _OWN)
    artists = _run(songbook.found_artists(service.search("marrow"), service.open_page,
                                          service.read, service.ask, scope=scope))
    assert artists == [{"id": "srv:2:10:artist", "title": "The Marrows"},
                       {"id": "srv:2:12:artist", "title": "Marrowbone"}]
    assert "other:1:10:artist" not in service.opened and "srv:3:40:artist" not in service.opened
    everything = _run(songbook.found_artists(service.search("marrow"), service.open_page,
                                             service.read, service.ask))
    assert [a["id"] for a in everything] == ["other:1:10:artist", "srv:3:40:artist",
                                             "srv::12:artist", "other:1:77:artist"]


# -- every found song has its number --------------------------------------------

def test_a_song_the_search_finds_is_numbered_and_keeps_the_number_when_it_is_picked(tmp_path):
    import inspect
    from types import SimpleNamespace

    from backend import main

    book = songbook.Songbook(tmp_path / "songbook.json")
    found = [SimpleNamespace(id=f"t{i}", title=f"Song {i}", artist="The Marrows",
                             album="Low Tide", mime_type="audio/flac") for i in range(3)]
    numbers = book.number([main._songbook_entry("H1", 9, "2", item) for item in found])
    assert all(isinstance(n, int) for n in numbers) and len(set(numbers)) == 3
    # Picking one reserves it under the same key, so it is the same number.
    assert book.number([main._songbook_entry("H1", 9, "2", found[1])]) == [numbers[1]]
    assert book.find(numbers[1])["t"] == "Song 1"
    # The search answers with the number, and a song that got none is left out.
    source = inspect.getsource(main.songbook_search)
    assert '"number": number' in source and "if number is None:" in source
    assert "_songbook_entry" in inspect.getsource(main.songbook_reserve)


def _paged(rows, calls, *, broken_at=None):
    async def ask(index, count):
        calls.append((index, count))
        if broken_at is not None and index >= broken_at:
            raise RuntimeError("no answer")
        return rows[index:index + count]
    return ask


def test_a_search_is_read_past_its_first_page_until_an_answer_comes_back_empty():
    rows = [{"id": f"t{n}"} for n in range(73)]
    calls = []
    got = _run(songbook.every_page(_paged(rows, calls)))
    assert [row["id"] for row in got] == [row["id"] for row in rows]
    assert calls == [(0, 50), (50, 50), (73, 50)]


def test_a_search_whose_total_is_known_is_not_asked_past_it():
    rows = [{"id": f"t{n}"} for n in range(73)]
    calls = []
    assert len(_run(songbook.every_page(_paged(rows, calls), total=lambda: 73))) == 73
    assert calls == [(0, 50), (50, 50)]
    # A total that a full page contradicts is not believed, nor one of nothing.
    calls = []
    assert len(_run(songbook.every_page(_paged(rows, calls), total=lambda: 50))) == 73
    calls = []
    assert len(_run(songbook.every_page(_paged(rows, calls), total=lambda: 0))) == 73
    assert calls == [(0, 50), (50, 50), (73, 50)]


def test_a_search_reads_on_from_a_first_page_already_in_hand():
    rows = [{"id": f"t{n}"} for n in range(73)]
    calls = []
    got = _run(songbook.every_page(_paged(rows, calls), first=rows[:50]))
    assert [row["id"] for row in got] == [row["id"] for row in rows]
    assert calls == [(50, 50), (73, 50)]
    calls = []
    assert _run(songbook.every_page(_paged(rows, calls), first=[])) == [] and not calls


def test_a_search_stops_at_its_bound_of_rows_and_of_asks():
    rows = [{"id": f"t{n}"} for n in range(400)]
    calls = []
    assert len(_run(songbook.every_page(_paged(rows, calls)))) == 100
    assert calls == [(0, 50), (50, 50)]
    calls = []
    assert len(_run(songbook.every_page(_paged(rows, calls), rows=1000, size=20))) == 80
    assert len(calls) == 4


def test_a_service_that_answers_every_index_with_its_first_page_is_asked_once_more_only():
    calls = []

    async def ask(index, count):
        calls.append(index)
        return [{"id": f"t{n}"} for n in range(20)]

    assert len(_run(songbook.every_page(ask))) == 20
    assert calls == [0, 20]


def test_a_later_page_that_fails_keeps_what_is_in_hand_and_a_first_that_fails_is_heard():
    rows = [{"id": f"t{n}"} for n in range(120)]
    assert len(_run(songbook.every_page(_paged(rows, [], broken_at=50)))) == 50
    with pytest.raises(RuntimeError):
        _run(songbook.every_page(_paged(rows, [], broken_at=0)))


def test_the_songbook_search_reads_its_songs_past_the_first_page():
    import inspect

    from backend import main

    source = inspect.getsource(main.songbook_search)
    assert "songbook.every_page(page, total=" in source
    assert 'found == "tracks" and not words' in source
    assert "rows=_SONGBOOK_SEARCH_ROWS" in source and main._SONGBOOK_SEARCH_ROWS == 100
    assert 'item.artist or lines[item.id]' in source
    picked = inspect.getsource(main.songbook_reserve)
    assert "if item is None or not item.artist:" in picked


def test_a_song_found_without_its_artist_keeps_the_one_it_was_numbered_with(tmp_path):
    book = songbook.Songbook(tmp_path / "songbook.json")
    [number] = book.number([("k1", {"t": "Low Tide", "a": "The Marrows"})])
    assert book.facts("k1")["a"] == "The Marrows" and book.facts("k1")["n"] == number
    assert book.facts("never") == {}


def test_a_list_in_the_services_own_menu_is_the_whole_catalog():
    pages = {"root": [_row("artists", "container", folder=True)],
             "artists": [_row(f"a{i}", "artist", folder=True) for i in range(9)]}
    assert _run(songbook.survey(_tree(pages)))["own"] is False


def test_a_list_among_the_accounts_things_is_the_accounts_own():
    mine = _row("liked", "trackList", folder=True)
    mine["user_content"] = True
    pages = {"root": [_row("library", "container", folder=True)],
             "library": [_row("artists", "container", folder=True), mine],
             "artists": [_row(f"a{i}", "artist", folder=True) for i in range(3)],
             "liked": [_row("t1", "track")]}
    assert _run(songbook.survey(_tree(pages)))["own"] is True


def test_a_list_the_root_no_longer_has_is_looked_for_again(monkeypatch):
    """A service turned to another library still opens the old list by its
    id. The root no longer having that row is what says the tab has moved."""
    from backend import main

    store = {"k": {"item": "old", "total": 3, "own": False}}
    looked = []

    class Kept:
        def shelf(self, key):
            return store.get(key)

        def forget_shelf(self, key):
            store.pop(key, None)

    async def look(key, household, sid, account):
        looked.append(key)
        store[key] = {"item": "new", "total": 5, "own": False}
        main._SONGBOOK_LOOKING.pop(key, None)

    root = [{"id": "new"}]

    async def opener(item, start):
        return root, len(root)

    monkeypatch.setattr(main, "_SONGBOOK", Kept())
    monkeypatch.setattr(main, "_songbook_look", look)
    monkeypatch.setattr(main, "_SONGBOOK_MOVED", {})
    monkeypatch.setattr(main, "_SONGBOOK_LOOKING", {})

    async def go(shelf):
        return await main._songbook_where_it_was("k", None, 1, "", shelf, opener)

    assert _run(go(store["k"]))["item"] == "new"
    assert looked == ["k"]
    # Still a row of the root: left alone.
    assert _run(go(store["k"]))["item"] == "new"
    # An account's own list is not one of the root's rows to begin with.
    mine = {"item": "elsewhere", "own": True}
    assert _run(go(mine)) is mine
    # Ids that do not hold are not looked for again and again.
    root[:] = [{"id": "other"}]
    assert _run(go(store["k"]))["item"] == "new"
    assert looked == ["k"]
