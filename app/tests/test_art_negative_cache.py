"""A picture that will not load is not asked for again straight away.

A media server that is switched off answers nothing at all, so every ask
costs the whole connect timeout. One dead URL on a local server was fetched
119 times in a day -- once for each page that asked for it -- which is what
this remembers for a minute.
"""

import asyncio

from backend.sonos.artcache import ArtCache


class _Session:
    """A session that refuses everything and counts the attempts."""

    def __init__(self) -> None:
        self.tries = 0

    def get(self, url, **kwargs):
        self.tries += 1
        raise OSError("Cannot connect to host 10.0.0.7:8097")


def test_a_dead_url_is_tried_once_a_minute():
    session = _Session()
    cache = ArtCache(session)  # type: ignore[arg-type]
    clock = [1000.0]
    cache.FAILED_TTL = 60.0

    async def go():
        for _ in range(5):
            assert await cache.get("http://10.0.0.7:8097/art.jpg") is None

    import backend.sonos.artcache as module
    real = module.monotonic
    module.monotonic = lambda: clock[0]
    try:
        asyncio.run(go())
        assert session.tries == 1
        # Past the minute it is worth another try, in case the server is back.
        clock[0] += 61
        asyncio.run(go())
        assert session.tries == 2
    finally:
        module.monotonic = real


class _Response:
    status = 200
    headers = {"Content-Type": "image/png"}

    async def read(self):
        return b"\x89PNG\r\n\x1a\n" + b"0" * 32

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Flaky(_Session):
    """Refuses the first ask and answers the second."""

    def get(self, url, **kwargs):
        self.tries += 1
        if self.tries == 1:
            raise OSError("Cannot connect")
        return _Response()


def test_a_picture_that_loads_clears_the_mark():
    session = _Flaky()
    cache = ArtCache(session)  # type: ignore[arg-type]
    clock = [1000.0]
    import backend.sonos.artcache as module
    real = module.monotonic
    module.monotonic = lambda: clock[0]
    try:
        assert asyncio.run(cache.get("http://10.0.0.7:8097/art.png")) is None
        clock[0] += 61
        picture = asyncio.run(cache.get("http://10.0.0.7:8097/art.png"))
        assert picture is not None and picture.content_type == "image/png"
        assert cache._failed == {}
        # And it is a cache hit from here, not a third request.
        assert asyncio.run(cache.get("http://10.0.0.7:8097/art.png")) is picture
        assert session.tries == 2
    finally:
        module.monotonic = real


def test_a_first_failure_is_held_briefly_and_longer_each_time():
    """A speaker asked for a new track's art at once may not have it yet; a
    minute's refusal left the page without it until a reload.
    The wait starts at 5 seconds and doubles to the minute."""
    session = _Session()
    cache = ArtCache(session)  # type: ignore[arg-type]
    clock = [1000.0]
    import backend.sonos.artcache as module
    real = module.monotonic
    module.monotonic = lambda: clock[0]
    url = "http://192.168.0.110:1400/getaa?s=1&u=x"
    try:
        tried = []
        for wait in (0, 4, 2, 9, 2, 19, 21, 41, 59, 61):
            clock[0] += wait
            asyncio.run(cache.get(url))
            tried.append(session.tries)
        # Each wait is from the last failure: held 5s (4 no, 6 yes), then 10s
        # (9 no, 11 yes), 20s (19 no, 40 yes), 40s (41 yes), then a minute
        # (59 no, 61 yes).
        assert tried == [1, 1, 2, 2, 3, 3, 4, 5, 5, 6]
    finally:
        module.monotonic = real
