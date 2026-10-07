"""One verdict per speaker's connection, from what every speaker can be
measured by. The Network check showed three kinds of signal figure side by
side and called nearly every healthy speaker uneven; this is
what it leads with instead.
"""

from types import SimpleNamespace

from backend.sonos.network import room_health
from backend.sonos.probe import LatencyReport


def _report(samples, failures=0):
    return LatencyReport(host="h", samples=list(samples), failures=failures)


def _radio(drops=None, extender=False):
    return SimpleNamespace(drops_per_min=drops, facts=SimpleNamespace(behind_extender=extender))


def test_ordinary_wifi_is_good():
    # One speaker's real spread: 4 to 32 ms, median 6.
    health = room_health(_radio(drops=0.0), _report([4, 5, 6, 6, 6, 7, 9, 12, 20, 31, 32, 6, 5, 6, 8]))
    assert health["level"] == "good"
    assert health["reasons"] == [{"code": "ok", "median": 6}]


def test_one_long_stall_is_worth_watching():
    # Another's: a typical 10 ms answer and one of a second.
    health = room_health(_radio(), _report([4, 8, 10, 10, 11, 9, 12, 30, 36, 10, 9, 8, 10, 11, 1012]))
    assert health["level"] == "watch"
    assert health["reasons"][0]["code"] == "stall"


def test_lost_replies_and_no_answer_are_problems():
    assert room_health(_radio(), _report([5] * 10, failures=5))["level"] == "problem"
    assert room_health(_radio(), _report([], failures=15)) == {
        "level": "problem", "reasons": [{"code": "no_answer", "attempts": 15}]}


def test_a_dropping_link_and_an_extender_are_named():
    health = room_health(_radio(drops=12.0, extender=True), _report([5] * 15))
    assert health["level"] == "watch"
    assert [r["code"] for r in health["reasons"]] == ["dropping", "extender"]
