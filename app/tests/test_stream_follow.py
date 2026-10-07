"""A station listed as mirrors, each an HLS manifest, is played as HLS.

Sonos Radio's BBC stations answer getMediaURI with an M3U of four mirrors,
each a redirect to an HLS manifest. Sonora handed the list to the page as
plain audio, and "This browser" showed the art and played nothing:
Firefox has no HLS of its own, so the page has to be told.
"""

import asyncio
from types import SimpleNamespace

import backend.main as main

MIRRORS = "#EXTM3U\nhttps://a.example/one\nhttps://b.example/two\n"
MANIFEST = ("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=96000\n"
            "https://c.example/radio.m3u8\n")


class _Answer:
    def __init__(self, url, kind, body):
        self.url, self.headers, self._body = url, {"Content-Type": kind}, body.encode()
        self.content = SimpleNamespace(read=self._read)

    async def _read(self, n):
        return self._body[:n]

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session:
    def __init__(self, pages):
        self.pages = pages

    def get(self, url, **kw):
        kind, body = self.pages[url]
        return _Answer(url, kind, body)


def _follow(monkeypatch, pages, url):
    monkeypatch.setitem(main.state, "outward", _Session(pages))
    monkeypatch.setattr(main.fetchguard, "safe_to_fetch", lambda url: True)
    return asyncio.run(main._followed(url))


def test_mirrors_that_are_hls_are_played_as_hls(monkeypatch):
    pages = {"https://x.example/tune": ("audio/x-mpegurl", MIRRORS),
             "https://a.example/one": ("application/x-mpegurl", MANIFEST)}
    found = _follow(monkeypatch, pages, "https://x.example/tune")
    assert found == {"url": "https://a.example/one", "reason": "", "hls": True}


def test_mirrors_of_plain_audio_are_still_a_list(monkeypatch):
    pages = {"https://x.example/tune": ("audio/x-mpegurl", MIRRORS),
             "https://a.example/one": ("audio/mpeg", "ID3")}
    found = _follow(monkeypatch, pages, "https://x.example/tune")
    assert found["urls"] == ["https://a.example/one", "https://b.example/two"]
    assert not found.get("hls")
