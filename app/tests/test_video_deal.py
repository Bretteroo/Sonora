"""The karaoke themes' videos are dealt like cards: each plays once before any plays again."""
from backend import video_deal


def setup_function():
    video_deal.forget()


def test_every_video_plays_once_before_any_again():
    pool = [f"v{i}" for i in range(7)]
    first = [video_deal.deal("room", f"song{i}", pool) for i in range(7)]
    assert sorted(first) == sorted(pool)
    again = video_deal.deal("room", "song7", pool)
    assert again in pool and again != first[-1]


def test_a_song_keeps_its_video_for_every_browser():
    pool = ["a", "b", "c"]
    one = video_deal.deal("room", "song", pool)
    assert video_deal.deal("room", "song", pool) == one


def test_rooms_deal_on_their_own():
    pool = ["a", "b"]
    video_deal.deal("one", "x", pool)
    video_deal.deal("one", "y", pool)
    assert {video_deal.deal("two", "x", pool), video_deal.deal("two", "y", pool)} == {"a", "b"}


def test_a_video_that_will_not_play_is_passed_over():
    pool = ["a", "b"]
    assert video_deal.deal("room", "song", pool, skip=["a"]) == "b"
    assert video_deal.deal("room", "other", ["a"]) == "a"


def test_a_video_gone_from_the_list_is_dealt_again():
    one = video_deal.deal("room", "song", ["a"])
    assert one == "a"
    assert video_deal.deal("room", "song", ["b"]) == "b"
