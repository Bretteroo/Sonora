"""What a cached logo is, read from the picture rather than its file name.

Every logo is written to the cache under the same ``.img`` name, so the name
says nothing about what is inside it. An SVG read back off disk was handed
to the browser as ``image/png``, which draws nothing: Plex's chevron left an
empty circle at the head of its pinned row on the home until this was fixed.
"""

from __future__ import annotations

from pathlib import Path

from backend.sonos.logos import _kind

CACHED = Path("54279-square-large.img")


def test_an_svg_is_an_svg_whatever_the_file_is_called():
    body = b'<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="..."/>'
    assert _kind(CACHED, body=body) == "image/svg+xml"
    assert _kind(CACHED, body=b"<svg viewBox='0 0 24 24'/>") == "image/svg+xml"


def test_the_ordinary_formats_are_named_too():
    assert _kind(CACHED, body=b"\x89PNG\r\n\x1a\n") == "image/png"
    assert _kind(CACHED, body=b"\xff\xd8\xff\xe0") == "image/jpeg"
    assert _kind(CACHED, body=b"GIF89a") == "image/gif"
    assert _kind(CACHED, body=b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"


def test_the_url_answers_for_a_picture_not_yet_read():
    assert _kind(CACHED, "https://example.test/mark.svg") == "image/svg+xml"
    assert _kind(CACHED) == "image/png"
