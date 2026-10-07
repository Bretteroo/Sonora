"""A service's browse endpoint: the JSON root the apps show for some services.

Most services are browsed entirely over SMAPI. A few declare an
``endpoints`` entry of type ``browse`` in their manifest, and for those the
apps' first screen comes from that document instead of
``getMetadata("root")``. Amazon Music is the clearest case: its SMAPI root
holds Library and User Playlists, while the desktop app opens on the
account's home rows -- Collections, Try Amazon Music Unlimited, Albums for
You, Playlists for You, Podcasts You May Like, All-Access Playlists, Top
Playlists, A Whole Mood, Top Stations. Those come from
``https://sonos.smapi.amazonmusic.com/api/home`` (2026-09-07).

The document is a page of rows:

    {"content": {"container": {"name": "Home", ...}},
     "displayType": "rootBrowsePage", "id": {"objectId": "root"},
     "total": 11,
     "views": [{"content": {"container": {"name": "Collections", ...}},
                "id": {"objectId": "collections"},
                "browsePolicies": {...}, "items": [...]}, ...]}

Each row is a container in its own right, and its object id opens over plain
SMAPI, so only the root goes through here. The nested ``items`` are the
row's first entries, for the phone apps' carousels; the desktop apps show
the row names alone, so they are ignored.

Authentication is the household's own service token as a bearer, plus the
device id SMAPI sends. Amazon rejects the request without the device id
(401) and accepts it with no household id, but both are sent, as SMAPI does.
"""

from __future__ import annotations

import html
import logging
import re

import aiohttp

from .smapi import SmapiError, SmapiItem, SmapiPage

log = logging.getLogger(__name__)


class ContentService:
    """Reads a service's browse endpoint."""

    def __init__(self, session: aiohttp.ClientSession, *, timeout: float = 12.0):
        self._session = session
        self._timeout = aiohttp.ClientTimeout(total=timeout)

    async def home(self, *, endpoint: str, service_name: str, token: str,
                   device_id: str = "", household_id: str = "",
                   filtering: bool = False) -> SmapiPage:
        """Fetch the service's root page from its browse endpoint."""
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if device_id:
            headers["X-Sonos-Device-Id"] = device_id
        if household_id:
            headers["X-Sonos-Household-Id"] = household_id
        if filtering:
            # The household's content filtering, stated the way the desktop
            # core states it on this kind of request: an HTTP header beside
            # X-Sonos-Context-TimeZone. A service that does not know it
            # ignores it, which is why this one is safe to send and the SOAP
            # equivalent was not (see SmapiClient.filters).
            headers["X-Sonos-Context-ContentFiltering"] = "true"
        try:
            async with self._session.get(
                    endpoint, headers=headers, timeout=self._timeout) as resp:
                if resp.status >= 400:
                    raise SmapiError(service_name, f"HTTP {resp.status}",
                                     (await resp.text())[:160])
                data = await resp.json(content_type=None)
        except SmapiError:
            raise
        except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
            raise SmapiError(service_name, "Transport", str(exc)) from exc
        if not isinstance(data, dict):
            raise SmapiError(service_name, "Browse", "not a browse document")
        return _page(data)


def _page(data: dict) -> SmapiPage:
    views = [v for v in (data.get("views") or []) if isinstance(v, dict)]
    items = [_item(v) for v in views]
    items = [i for i in items if i.title]
    return SmapiPage(items=items, index=0, count=len(items),
                     total=int(data.get("total") or len(items)))


#: Content-service types that open a page rather than play where they stand.
#: The dotted names ("trackList.program") are cut at the first segment.
_CONTAINER_TYPES = {"container", "album", "playlist", "artist", "albumList",
                    "trackList", "streamList", "collection", "show", "favorites"}


_TAGS = re.compile(r"<[^>]+>")


def _plain(text: str) -> str:
    """A service's sentence without the markup it wrapped it in.

    Amazon Music's upsell shelf sends its line as HTML -- a paragraph around
    a link -- and the product prints the markup on the page, tags and all.
    Sonora prints the sentence.
    """
    if not text:
        return text
    return html.unescape(_TAGS.sub("", text)).strip()


def _item(view: dict, *, deep: bool = True) -> SmapiItem:
    content = view.get("content") or {}
    body = content.get("container") or content.get("track") or {}
    policies = view.get("browsePolicies") or {}
    kind = str(body.get("type") or "container")
    return SmapiItem(
        id=str(((view.get("id") or {}).get("objectId")) or ""),
        title=str(body.get("name") or ""),
        # Content-service types are dotted ("trackList.program"); the rest of
        # Sonora speaks SMAPI's flat names, so the last segment is used.
        item_type=kind.rsplit(".", 1)[-1],
        art=str(body.get("imageUrl") or ""),
        # Whoever made it, where the document says: a shelf's tiles carry the
        # album's artist or the playlist's owner under the name, which is the
        # line the product prints there ("bad taste" over "Freya Skye").
        artist=str(((body.get("artist") or {}).get("name")) or ""),
        # A shelf of words rather than things: Amazon Music's upsell carries
        # its sentence here and nothing else.
        summary=_plain(str(body.get("summary") or "")),
        # The shelf says how it wants drawing (CAROUSEL, Grid, List...), and
        # its tiles say what they are (albumItem, ...).
        display_type=str(view.get("displayType") or ""),
        can_play=bool(policies.get("canPlay")),
        # A row that came with its first children has them whatever the
        # policies say -- Amazon marks Collections canEnumerate false and
        # lists Library, Explore Podcasts and the rest inside it. A row with
        # neither is not a page at all: "Try Amazon Music Unlimited" holds an
        # openUrl action and nothing else (2026-09-07).
        can_enumerate=bool(policies.get("canEnumerate")) or bool(view.get("items")),
        # What the shelf itself says, kept apart from the line above: the
        # product puts View All on a shelf whose policies say canEnumerate
        # and on no other. Amazon Music's Followed Playlists carries one and
        # its Collections, which says false, does not; TuneIn's shelves state
        # no policies at all and carry none (measured 2026-09-20).
        can_open=bool(policies.get("canEnumerate")),
        # A container row opens whatever the policies say: Amazon marks
        # Collections canEnumerate false and the app still opens it (its
        # object id browses fine over SMAPI).
        #
        # A shelf's own rows carry no policies at all, so the type has to
        # answer it: an album, a playlist, an artist, or a program opens a
        # page of its own, where a track or a station is played where it
        # stands. Without this every tile on Spotify's home was a leaf with
        # no URI, which is to say a picture that did nothing.
        is_container=kind.split(".", 1)[0] in _CONTAINER_TYPES
        or bool(policies.get("canEnumerate")),
        can_add_to_favorites=(bool(policies["canAddToFavorites"])
                              if "canAddToFavorites" in policies else None),
        origin="browse",
        playlist_policy="canPlay" in policies,
        # A shelf arrives with its own first rows. They are the page: the
        # product draws them as tiles under the shelf's name, and a shelf
        # without them would be a heading over nothing. One level only --
        # their own `items`, where a service sends any, are not drawn.
        children=tuple(_item(child, deep=False) for child in (view.get("items") or [])
                       if isinstance(child, dict)) if deep else (),
    )
