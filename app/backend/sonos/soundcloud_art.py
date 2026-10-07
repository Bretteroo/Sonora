"""SoundCloud cover art via the public oEmbed endpoint.

SoundCloud is one of the services a third-party controller cannot sign in to
-- it demands the Sonos device certificate the speakers hold -- so Sonora keeps
no SMAPI login for it and cannot read a track's cover the way it reads other
services'. On S1 the speakers' own ``/getaa`` proxy answers 404 for SoundCloud
art as well (an S2 speaker serves the same URI, an S1 one does not, seen
2026-09-29), so its covers were blank discs.

SoundCloud's oEmbed endpoint returns the artwork for a track, playlist or user
from just its numeric id, with no account and no key:

    GET https://soundcloud.com/oembed?format=json&url=https://api.soundcloud.com/tracks/<id>

The id is already in the art URL Sonora emits -- the queue's getaa target is
``...soundcloud:tracks:<id>...`` -- so ``/api/art`` reads it out and fetches
the cover this way instead. Resolved covers are kept for a day; a lookup that
fails is remembered briefly so a dead id is not asked for on every draw.
"""

from __future__ import annotations

import logging
import time
from re import compile as _re
from urllib.parse import unquote

import aiohttp

log = logging.getLogger(__name__)

#: ``soundcloud:tracks:904330642`` and its playlist / user kin, once the getaa
#: target is url-decoded.
_REF = _re(r"soundcloud:(tracks|playlists|users):(\d+)")
OEMBED = "https://soundcloud.com/oembed"
#: A cover URL is stable, so it is kept a day; a miss is retried within ten
#: minutes rather than on the next draw.
OK_TTL = 24 * 3600.0
FAIL_TTL = 600.0
#: SoundCloud hands this back for an item that has no artwork of its own; it is
#: a grey wordmark, not a cover, so it is treated as no art and the row keeps
#: the service's placeholder.
PLACEHOLDER = "fb_placeholder.png"


def soundcloud_ref(url: str) -> tuple[str, str] | None:
    """The (kind, id) an art URL points at -- ``("tracks", "904330642")`` --
    or ``None``. The id rides inside the getaa target, url-encoded a couple of
    times over, so the string is unquoted until it stops changing."""
    if not url or "soundcloud" not in url:
        return None
    s = url
    for _ in range(4):
        d = unquote(s)
        if d == s:
            break
        s = d
    m = _REF.search(s)
    return (m.group(1), m.group(2)) if m else None


class SoundCloudArt:
    """Resolves a SoundCloud ``(kind, id)`` to its cover URL through oEmbed and
    keeps the answer, so the lookup happens once per item, not once per draw."""

    def __init__(self, session: aiohttp.ClientSession, *, max_entries: int = 4000) -> None:
        self._session = session
        self.max_entries = max_entries
        #: (kind, id) -> (cover url or None, when it was resolved)
        self._covers: dict[tuple[str, str], tuple[str | None, float]] = {}

    async def cover_url(self, kind: str, scid: str) -> str | None:
        key = (kind, scid)
        hit = self._covers.get(key)
        if hit is not None:
            url, at = hit
            if time.monotonic() - at < (OK_TTL if url else FAIL_TTL):
                return url
        url = await self._fetch(kind, scid)
        self._covers[key] = (url, time.monotonic())
        while len(self._covers) > self.max_entries:
            self._covers.pop(next(iter(self._covers)))
        return url

    async def _fetch(self, kind: str, scid: str) -> str | None:
        target = f"https://api.soundcloud.com/{kind}/{scid}"
        try:
            async with self._session.get(
                    OEMBED, params={"format": "json", "url": target},
                    timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json(content_type=None)
        except (aiohttp.ClientError, TimeoutError, ValueError, OSError) as exc:
            log.info("soundcloud oembed %s/%s failed: %s", kind, scid, exc)
            return None
        thumb = (data or {}).get("thumbnail_url") or ""
        if not thumb or thumb.rsplit("/", 1)[-1] == PLACEHOLDER:
            return None
        return thumb
