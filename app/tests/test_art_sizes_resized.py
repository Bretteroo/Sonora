"""Pictures kept small for the sizes they are drawn at.

The Windows app's core keeps browse art at 40px, Info art at 120 and Now
Playing at 512 (ArtworkFinder.cs); Sonora was handing every 40px row the
full cover, a megabyte for the S2 test library's albums.
"""

import asyncio
import io
from dataclasses import replace
from time import monotonic

from PIL import Image

from backend.sonos.artcache import ArtCache, Picture, SIZES, _shrink


def _jpeg(w, h):
    out = io.BytesIO()
    Image.new("RGB", (w, h), (200, 30, 30)).save(out, "JPEG", quality=95)
    return Picture(body=out.getvalue(), content_type="image/jpeg", fetched_at=0.0)


def test_a_cover_is_shrunk_to_the_size_asked():
    small = _shrink(_jpeg(1024, 1024), 64)
    with Image.open(io.BytesIO(small.body)) as im:
        assert max(im.size) == 64
    assert small.content_type == "image/jpeg"


def test_a_picture_already_small_is_left_alone():
    tiny = _jpeg(50, 50)
    assert _shrink(tiny, 64) is tiny


def test_transparency_survives_as_png():
    out = io.BytesIO()
    Image.new("RGBA", (400, 200), (0, 0, 0, 0)).save(out, "PNG")
    logo = Picture(body=out.getvalue(), content_type="image/png", fetched_at=0.0)
    small = _shrink(logo, 128)
    assert small.content_type == "image/png"
    with Image.open(io.BytesIO(small.body)) as im:
        assert im.size == (128, 64)


def test_an_svg_is_served_as_it_is():
    svg = Picture(body=b"<svg xmlns='http://www.w3.org/2000/svg'/>", content_type="image/svg+xml", fetched_at=0.0)
    assert _shrink(svg, 64) is svg


def test_sizes_snap_up_and_share_one_download():
    cache = ArtCache(session=None)
    fetched = []

    async def fetch(url):
        fetched.append(url)
        return replace(_jpeg(1000, 800), fetched_at=monotonic())

    cache._fetch = fetch

    async def main():
        a, b = await asyncio.gather(cache.sized("http://h/x", 40), cache.sized("http://h/x", 60))
        c = await cache.sized("http://h/x", 200)
        return a, b, c

    a, b, c = asyncio.run(main())
    assert fetched == ["http://h/x"]
    assert a is b                                   # 40 and 60 both land on 64
    with Image.open(io.BytesIO(c.body)) as im:
        assert max(im.size) == 256
    assert SIZES[0] == 64
