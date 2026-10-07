"""Music service logos, kept the way the Sonos desktop client keeps them.

The client does not fetch a logo per view. Its ``RMSLogoMgr`` reads one public
manifest, ``update-services.sonos.com/services/mslogo.xml`` (a redirect to
``service-catalog.ws.sonos.com/mslogo``), writes each picture into a
``logocache`` directory beside its other state, and fetches one again only
when the manifest says the cached copy is out of date. Every image in the
manifest carries its own ``lastModified``, which is what "out of date" means.

Sonora does the same, for the same reasons and with the same effect on Sonos'
servers: one manifest a day, and a picture only when it has actually changed.

Two things follow from using this rather than the signed-in endpoint.

* The manifest and the images are public. A household that never signs in, or
  one that signs out, keeps every logo it has already seen -- and can fetch
  ones it has not. Logos used to come from ``play.sonos.com`` behind the
  session, so signing out emptied them.
* The manifest is keyed by service *type*, which the speakers publish
  themselves. Sonora needs nothing from the cloud to know which logo belongs
  to which service.

``type >> 8`` is the browse sid, as it is everywhere else in Sonos' numbering;
across all 244 services in the manifest that mapping is one to one (checked
2026-09-17), so a logo can be found from either number.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from pathlib import Path

import aiohttp
from defusedxml import ElementTree as DET

log = logging.getLogger(__name__)

#: The manifest the desktop client reads. Public: no account, no token.
MANIFEST = "http://update-services.sonos.com/services/mslogo.xml"

#: How long a manifest is used before it is read again. The client re-reads on
#: its own schedule; a day is well inside what a logo list changes at.
MANIFEST_TTL = 24 * 60 * 60.0

#: How soon a manifest that could not be read is tried again.
MANIFEST_RETRY = 5 * 60.0

#: Placements the manifest publishes, smallest first. A request for a size
#: takes the first that is at least as big, else the biggest there is.
PLACEMENTS = [
    ("square:x-small", 20),
    ("square:small", 40),
    ("square:medium", 80),
    ("square", 112),
    ("square:large", 200),
    ("square:x-large", 400),
]

_SAFE = re.compile(r"[^a-z0-9_-]+")


def _file_name(service_type: int, placement: str) -> str:
    """``48135-square-small.img``: the client's own ``<type>-<name>`` shape."""
    return f"{service_type}-{_SAFE.sub('-', placement.lower())}.img"


class LogoCache:
    """The manifest, the pictures on disk, and the rule for refetching one."""

    def __init__(self, session: aiohttp.ClientSession, data_dir: Path) -> None:
        self._session = session
        self._dir = Path(data_dir) / "logocache"
        #: service type -> placement -> (url, lastModified)
        self._index: dict[int, dict[str, tuple[str, str]]] = {}
        #: browse sid -> service type, so either number finds a logo.
        self._by_sid: dict[int, int] = {}
        self._read_at = 0.0
        self._lock = asyncio.Lock()
        self._timeout = aiohttp.ClientTimeout(total=20)

    # -- the manifest --------------------------------------------------------

    def _fresh(self) -> bool:
        """Whether the index is recent enough to use without asking again.

        An index that could not be filled is retried after a few minutes,
        not on every call: each try can wait out the whole timeout.
        """
        age = time.monotonic() - self._read_at
        return age < (MANIFEST_TTL if self._index else MANIFEST_RETRY) and self._read_at > 0

    async def _load(self) -> None:
        """Read the manifest, at most once per TTL and once at a time."""
        if self._fresh():
            return
        async with self._lock:
            if self._fresh():
                return
            text = None
            try:
                async with self._session.get(MANIFEST, timeout=self._timeout) as resp:
                    resp.raise_for_status()
                    text = await resp.text()
            except Exception as exc:
                log.info("logo manifest unavailable: %s", exc)
            manifest = self._dir / "mslogo.xml"
            if text is None:
                # The copy from the last good read, as the client keeps its
                # index beside the pictures; a stale index still serves.
                if self._index or not manifest.exists():
                    self._read_at = time.monotonic()
                    return
                text = manifest.read_text(encoding="utf-8", errors="replace")
            else:
                try:
                    self._dir.mkdir(parents=True, exist_ok=True)
                    manifest.write_text(text, encoding="utf-8")
                except OSError as exc:
                    log.info("logo manifest not saved: %s", exc)
            index: dict[int, dict[str, tuple[str, str]]] = {}
            try:
                root = DET.fromstring(text)
            except Exception as exc:
                log.info("logo manifest unreadable: %s", exc)
                self._read_at = time.monotonic()
                return
            for node in root.iter("service"):
                try:
                    service_type = int(node.get("id") or "")
                except ValueError:
                    continue
                # A service appears more than once: the manifest has a
                # "sized" section and a "presentationmap" section, and each
                # names its own placements. Merging rather than replacing is
                # what keeps the square icons when the second block carries
                # only brand logos (found when every service whose
                # id appeared twice came back with no icon at all).
                images = index.setdefault(service_type, {})
                for image in node.iter("image"):
                    url = (image.text or "").strip()
                    placement = image.get("placement") or ""
                    if url and placement:
                        images.setdefault(placement, (url, image.get("lastModified") or ""))
            index = {k: v for k, v in index.items() if v}
            if index:
                self._index = index
                self._by_sid = {t >> 8: t for t in index}
                log.info("logo manifest: %d services", len(index))
            self._read_at = time.monotonic()

    # -- one picture ---------------------------------------------------------

    def _pick(self, images: dict[str, tuple[str, str]], size: int) -> tuple[str, str] | None:
        for placement, px in PLACEMENTS:
            if px >= size and placement in images:
                return images[placement]
        for placement, _ in reversed(PLACEMENTS):
            if placement in images:
                return images[placement]
        return None

    def _placement_for(self, images: dict[str, tuple[str, str]], size: int) -> str:
        for placement, px in PLACEMENTS:
            if px >= size and placement in images:
                return placement
        for placement, _ in reversed(PLACEMENTS):
            if placement in images:
                return placement
        return ""

    async def logo(self, service_type: int, size: int = 80) -> tuple[bytes, str] | None:
        """The picture for a service, from disk where the copy is current.

        Returns ``None`` when the manifest names no logo for it and nothing is
        cached. A cached copy is served even when the manifest cannot be read,
        which is what keeps logos alive with no network and no account.
        """
        await self._load()
        images = self._index.get(service_type) or {}
        placement = self._placement_for(images, size)
        stamp_path = None
        path = None
        if placement:
            path = self._dir / _file_name(service_type, placement)
            stamp_path = path.with_suffix(".stamp")
            url, modified = images[placement]
            if path.exists() and self._stamp(stamp_path) == modified:
                body = path.read_bytes()
                return body, _kind(path, body=body)
            body = await self._fetch(url)
            if body is not None:
                self._write(path, stamp_path, body, modified)
                return body, _kind(path, url, body)
        # No manifest, or the fetch failed: anything already on disk will do.
        for candidate, _ in reversed(PLACEMENTS):
            on_disk = self._dir / _file_name(service_type, candidate)
            if on_disk.exists():
                body = on_disk.read_bytes()
                return body, _kind(on_disk, body=body)
        return None

    def type_for_sid(self, sid: int) -> int | None:
        return self._by_sid.get(sid)

    def knows(self, service_type: int) -> bool:
        return service_type in self._index

    async def prime(self) -> None:
        """Read the manifest once at start-up, so the first page is quick."""
        await self._load()

    # -- disk ----------------------------------------------------------------

    @staticmethod
    def _stamp(path: Path) -> str:
        try:
            return path.read_text(encoding="utf-8").strip()
        except OSError:
            return ""

    def _write(self, path: Path, stamp: Path, body: bytes, modified: str) -> None:
        try:
            self._dir.mkdir(parents=True, exist_ok=True)
            # Written beside and renamed, so a half-written file is never read.
            temp = path.with_suffix(".part")
            temp.write_bytes(body)
            temp.replace(path)
            stamp.write_text(modified, encoding="utf-8")
        except OSError as exc:
            log.info("could not cache logo %s: %s", path.name, exc)

    async def _fetch(self, url: str) -> bytes | None:
        try:
            async with self._session.get(url, timeout=self._timeout) as resp:
                if resp.status != 200:
                    log.info("logo %s answered %s", url[:80], resp.status)
                    return None
                return await resp.read()
        except Exception as exc:
            log.info("logo %s failed: %s", url[:80], exc)
            return None


def _kind(path: Path, url: str = "", body: bytes = b"") -> str:
    """What the picture is, read from the picture itself where it can be.

    Every logo is cached under the same ``.img`` name, so the file's own name
    says nothing: an SVG read back off disk was being served as image/png,
    and a browser draws nothing for that. Plex's chevron is one -- its row on
    the home carried an empty circle until this was fixed -- and so is any other
    service whose manifest names an SVG. The URL is consulted for a picture
    just fetched, and the extension last.
    """
    head = body[:64].lstrip()
    if head.startswith(b"<?xml") or head.startswith(b"<svg"):
        return "image/svg+xml"
    if head.startswith(b"\x89PNG"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"GIF8"):
        return "image/gif"
    if head[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    name = (url or path.name).lower()
    if name.endswith(".svg"):
        return "image/svg+xml"
    return "image/png"
