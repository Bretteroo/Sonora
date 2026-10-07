"""Album art fetched once and kept, so every window gets it at once.

The speakers hand out art through ``/getaa``, a proxy that fetches the
picture from the service on each request and sends no cache headers. For
some services that takes seconds every time -- Libby by OverDrive's covers
took four to nine seconds per fetch on 2026-09-07 -- so a second browser
window (the Mini Controller) sat gray for that long while the main window
already had the picture. Sonora fetches each picture once, keeps the bytes
for a while, and serves them itself with cache headers the browser honors.
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
from collections import OrderedDict
from dataclasses import dataclass
from time import monotonic

import aiohttp
from urllib.parse import urlsplit

log = logging.getLogger(__name__)

#: The sizes a picture is kept at besides its own, in pixels on the longer
#: side. The apps do the same: the Windows app's core keeps browse art at 40,
#: Info and grouping art at 120 and Now Playing at 512 (ArtworkFinder.cs),
#: each cache sized for pictures of that size. The page asks for the smallest
#: of these that covers what it draws, device pixels included.
SIZES = (64, 128, 256, 512, 1024)


@dataclass
class Picture:
    body: bytes
    content_type: str
    fetched_at: float


class ArtCache:
    """A small LRU of pictures by URL, bounded in entries, bytes, and age."""

    #: How long a URL that would not load is left alone. A media server that
    #: is switched off answers nothing at all, and every ask costs the connect
    #: timeout: one dead picture on a local server was fetched 119 times in a
    #: day, once for each page that asked. Short
    #: enough that the server coming back is picked up within the minute.
    FAILED_TTL = 60.0
    #: How long a URL's *first* failure is held. A speaker asked for a new
    #: track's art the moment the track changes may not have it yet, and a
    #: minute's refusal left the page without the picture until a reload.
    #: So the wait starts short and doubles with each
    #: failure in a row, up to FAILED_TTL: a dead server still costs a try a
    #: minute, and a picture that was only late is served seconds later.
    FIRST_FAILED_TTL = 5.0

    def __init__(self, session: aiohttp.ClientSession, *, max_entries: int = 200,
                 max_bytes: int = 32 * 1024 * 1024, ttl: float = 1800.0,
                 timeout: float = 25.0) -> None:
        self._session = session
        self._pictures: OrderedDict[str, Picture] = OrderedDict()
        self._bytes = 0
        self.max_entries = max_entries
        self.max_bytes = max_bytes
        self.ttl = ttl
        self._timeout = aiohttp.ClientTimeout(total=timeout)
        self._pending: dict[str, "asyncio.Future[Picture | None]"] = {}
        #: url -> (when it last failed, how many times in a row)
        self._failed: dict[str, tuple[float, int]] = {}
        #: Smaller copies by (url, size): a few kilobytes each, so thousands
        #: fit where a few dozen originals would. A library cover is often a
        #: megabyte, and a list of fifty drawn at 40px was fetching and
        #: decoding fifty of them (S2 test library).
        self._small: OrderedDict[tuple[str, int], Picture] = OrderedDict()
        self._small_bytes = 0
        self.max_small_bytes = 48 * 1024 * 1024
        self._small_pending: dict[tuple[str, int], "asyncio.Future[Picture | None]"] = {}
        #: A few downloads at a time per speaker or server. A long list asked
        #: one Play:1 for every cover at once and each then took seconds.
        self._gates: dict[str, asyncio.Semaphore] = {}

    def peek(self, url: str) -> Picture | None:
        picture = self._pictures.get(url)
        if picture is None:
            return None
        if monotonic() - picture.fetched_at > self.ttl:
            self._drop(url)
            return None
        self._pictures.move_to_end(url)
        return picture

    def _failed_ttl(self, times: int) -> float:
        return min(self.FAILED_TTL, self.FIRST_FAILED_TTL * 2 ** max(0, times - 1))

    async def get(self, url: str) -> Picture | None:
        """The picture at ``url``, from the cache or fetched now.

        Concurrent asks for the same URL share one fetch. ``None`` when the
        source answered with an error or something that is not an image.
        """
        import asyncio

        hit = self.peek(url)
        if hit is not None:
            return hit
        failed = self._failed.get(url)
        if failed is not None:
            failed_at, times = failed
            if monotonic() - failed_at < self._failed_ttl(times):
                return None
        pending = self._pending.get(url)
        if pending is not None:
            return await pending
        future: asyncio.Future[Picture | None] = asyncio.get_running_loop().create_future()
        self._pending[url] = future
        try:
            picture = await self._fetch(url)
            if picture is not None:
                self._store(url, picture)
                self._failed.pop(url, None)
            else:
                times = self._failed.pop(url, (0.0, 0))[1] + 1
                self._failed[url] = (monotonic(), times)
                while len(self._failed) > self.max_entries:
                    del self._failed[next(iter(self._failed))]
            future.set_result(picture)
            return picture
        except BaseException as exc:  # the waiters must not hang
            if not future.done():
                future.set_exception(exc)
            raise
        finally:
            self._pending.pop(url, None)

    async def sized(self, url: str, size: int) -> Picture | None:
        """The picture at ``url`` no larger than ``size`` on its longer side.

        ``size`` is snapped up to one of ``SIZES``; anything past the largest
        is the original. A picture already that small, or one Pillow cannot
        read (an SVG), is the original too.
        """
        bucket = next((b for b in SIZES if b >= size), 0) if size > 0 else 0
        if not bucket:
            return await self.get(url)
        key = (url, bucket)
        hit = self._small.get(key)
        if hit is not None and monotonic() - hit.fetched_at <= self.ttl:
            self._small.move_to_end(key)
            return hit
        pending = self._small_pending.get(key)
        if pending is not None:
            return await pending
        future: asyncio.Future[Picture | None] = asyncio.get_running_loop().create_future()
        self._small_pending[key] = future
        try:
            original = await self.get(url)
            small = None
            if original is not None:
                small = await asyncio.to_thread(_shrink, original, bucket)
                if small is not original:
                    self._keep_small(key, small)
            future.set_result(small)
            return small
        except BaseException as exc:
            if not future.done():
                future.set_exception(exc)
            raise
        finally:
            self._small_pending.pop(key, None)

    def _keep_small(self, key: tuple[str, int], picture: Picture) -> None:
        old = self._small.pop(key, None)
        if old is not None:
            self._small_bytes -= len(old.body)
        self._small[key] = picture
        self._small_bytes += len(picture.body)
        while self._small and self._small_bytes > self.max_small_bytes:
            _, dropped = self._small.popitem(last=False)
            self._small_bytes -= len(dropped.body)

    def _gate(self, url: str) -> asyncio.Semaphore:
        host = urlsplit(url).netloc
        gate = self._gates.get(host)
        if gate is None:
            gate = self._gates[host] = asyncio.Semaphore(4)
        return gate

    async def _fetch(self, url: str) -> Picture | None:
        async with self._gate(url):
            return await self._fetch_now(url)

    async def _fetch_now(self, url: str) -> Picture | None:
        try:
            async with self._session.get(url, timeout=self._timeout,
                                         headers={"Accept": "image/*"}) as resp:
                if resp.status != 200:
                    log.info("art %s answered %s", url[:80], resp.status)
                    return None
                content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
                body = await resp.read()
        except (aiohttp.ClientError, TimeoutError, OSError) as exc:
            log.info("art %s failed: %s", url[:80], exc)
            return None
        if not body:
            return None
        if not content_type or content_type == "application/octet-stream":
            content_type = _sniff(body)
        if not content_type.startswith("image/"):
            log.info("art %s is %s, not an image", url[:80], content_type or "untyped")
            return None
        return Picture(body=body, content_type=content_type, fetched_at=monotonic())

    def _store(self, url: str, picture: Picture) -> None:
        if len(picture.body) > self.max_bytes // 4:
            return
        if url in self._pictures:
            self._drop(url)
        self._pictures[url] = picture
        self._bytes += len(picture.body)
        while self._pictures and (len(self._pictures) > self.max_entries
                                  or self._bytes > self.max_bytes):
            oldest, _ = next(iter(self._pictures.items()))
            self._drop(oldest)

    def _drop(self, url: str) -> None:
        picture = self._pictures.pop(url, None)
        if picture is not None:
            self._bytes -= len(picture.body)


#: Query parameters that set a picture's size in pixels, by the names image
#: hosts and media servers use for them. The rule keys on the parameter, not
#: on any host: imgix's ``w=``, a Plex server's ``width=``, and OverDrive's
#: ``width=``/``height=`` are all this one pattern (measured 2026-10-05).
_SIZE_PARAM = re.compile(
    r"(?P<lead>[?&]|%3[fF]|%26)(?P<name>w|h|width|height|size|sz|maxwidth|maxheight|max_width|max_height)"
    r"(?P<eq>=|%3[dD])(?P<value>\d{1,4})(?=$|[&#]|%26)",
    re.IGNORECASE)


def upsized(url: str, target: int) -> str:
    """``url`` with the size it asks for raised so its longer side is ``target``.

    A provider often hands out a picture at a fraction of what it holds -- a
    Plex cover named at 300px from a 1500px original, a Sonos Radio cover at
    200px on an image host that will make any size -- and a page drawing it
    large stretches it. Every size parameter in the query is scaled by the
    same factor, so a width and height keep their proportion. A URL wrapped
    in another (``...&url=https%3A...%26width%3D300``) is looked into one
    level, as its encoded parameters are matched too. Values under 16 are
    flags, not sizes (``height=1``), and are left alone; a URL that already
    asks for ``target`` or more, or names no size, comes back unchanged.
    """
    matches = [m for m in _SIZE_PARAM.finditer(url) if int(m.group("value")) >= 16]
    if not matches or target <= 0:
        return url
    largest = max(int(m.group("value")) for m in matches)
    if largest >= target:
        return url
    scale = target / largest

    def raise_one(m: re.Match) -> str:
        value = int(m.group("value"))
        if value < 16:
            return m.group(0)
        return f"{m.group('lead')}{m.group('name')}{m.group('eq')}{round(value * scale)}"

    return _SIZE_PARAM.sub(raise_one, url)


def _sniff(body: bytes) -> str:
    """The image type from the first bytes, for a source that names none."""
    if body[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if body[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if body[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    if body.lstrip()[:5].lower() in (b"<svg ", b"<?xml"):
        return "image/svg+xml"
    return ""


def _shrink(picture: Picture, size: int) -> Picture:
    """A copy no larger than ``size`` px on its longer side: JPEG for an opaque
    picture, PNG where it has transparency. The original when it is already
    that small or is not something Pillow reads."""
    if picture.content_type == "image/svg+xml":
        return picture
    try:
        from PIL import Image
        with Image.open(io.BytesIO(picture.body)) as image:
            if max(image.size) <= size:
                return picture
            image.draft("RGB", (size, size))   # JPEG decodes at a fraction of full size
            image = image.convert("RGBA") if image.mode in ("RGBA", "LA", "P") else image.convert("RGB")
            image.thumbnail((size, size), Image.LANCZOS)
            out = io.BytesIO()
            if image.mode == "RGBA" and image.getextrema()[3][0] < 255:
                image.save(out, "PNG", optimize=True)
                kind = "image/png"
            else:
                image.convert("RGB").save(out, "JPEG", quality=86, progressive=True)
                kind = "image/jpeg"
    except Exception as exc:  # a picture Pillow cannot read is served as it is
        log.info("art could not be resized: %s", exc)
        return picture
    return Picture(body=out.getvalue(), content_type=kind, fetched_at=picture.fetched_at)
