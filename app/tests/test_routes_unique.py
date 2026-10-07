"""No two handlers answer the same method and path: the first registered wins
and the second is dead code that looks alive (room rename, status light and
button lock were dropped this way)."""

from collections import Counter

from backend.main import app


def test_every_method_and_path_has_one_handler():
    seen = Counter()
    for route in app.routes:
        for method in getattr(route, "methods", None) or ():
            seen[(method, getattr(route, "path", ""))] += 1
    assert [key for key, n in seen.items() if n > 1] == []
