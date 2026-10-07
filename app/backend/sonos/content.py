"""Browsing and searching a household's content.

``ContentDirectory`` answers for the whole household from any member, so a
single speaker can be used as the query endpoint. The object hierarchy is
Sonos' own rather than a plain UPnP tree; the identifiers are listed in
``const.BROWSE_ROOTS``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .const import BROWSE_ROOTS, CONTENT_DIRECTORY, QUEUE
from .didl import DidlItem, parse_didl
from .soap import SoapClient, SoapFault

log = logging.getLogger(__name__)

#: Speakers cap a single browse response. Asking for more silently truncates,
#: so paging is mandatory for anything but a small folder.
MAX_PER_REQUEST = 500


@dataclass(slots=True)
class BrowseResult:
    """One page of a browse or search."""

    object_id: str
    items: list[DidlItem]
    returned: int
    total: int
    start: int
    #: The container's version, which the saved-queue writes must quote back
    #: (AddURIToSavedQueue answers 1028 to a stale one).
    update_id: int = 0

    @property
    def has_more(self) -> bool:
        return self.start + self.returned < self.total

    def as_dict(self, host: str = "") -> dict:
        return {
            "object_id": self.object_id,
            "start": self.start,
            "returned": self.returned,
            "total": self.total,
            "has_more": self.has_more,
            "items": [item.as_dict(host) for item in self.items],
        }


class ContentBrowser:
    """Reads a household's library, favorites, playlists, and queue."""

    def __init__(self, soap: SoapClient) -> None:
        self._soap = soap

    async def browse(
        self,
        host: str,
        object_id: str,
        *,
        start: int = 0,
        count: int = 100,
        sort: str = "",
        metadata: bool = False,
    ) -> BrowseResult:
        """Browse one container, or fetch a single object's own metadata."""
        try:
            result = await self._soap.call(
                host, CONTENT_DIRECTORY, "Browse", {
                    "ObjectID": object_id,
                    "BrowseFlag": "BrowseMetadata" if metadata
                                  else "BrowseDirectChildren",
                    "Filter": "*",
                    "StartingIndex": start,
                    "RequestedCount": min(count, MAX_PER_REQUEST),
                    "SortCriteria": sort,
                })
        except SoapFault as exc:
            # The speaker's refusal names no object, so the log could not say
            # which container was missing (the 701s a reader asked about).
            # It says now, and the fault carries on as before.
            log.info("browse of %r on %s refused: %s %s",
                     object_id, host, exc.code, exc.description)
            raise
        return BrowseResult(
            object_id=object_id,
            items=parse_didl(result.get("Result", "")),
            returned=result.int_("NumberReturned"),
            total=result.int_("TotalMatches"),
            start=start,
            update_id=result.int_("UpdateID"),
        )

    async def browse_all(
        self,
        host: str,
        object_id: str,
        *,
        sort: str = "",
        limit: int = 5000,
    ) -> list[DidlItem]:
        """Page through a container until it is exhausted or ``limit`` is hit."""
        items: list[DidlItem] = []
        start = 0
        while len(items) < limit:
            page = await self.browse(
                host, object_id, start=start,
                count=min(MAX_PER_REQUEST, limit - len(items)), sort=sort)
            if not page.items:
                break
            items.extend(page.items)
            start += page.returned
            if not page.has_more:
                break
        return items

    async def search(
        self,
        host: str,
        container: str,
        term: str,
        *,
        start: int = 0,
        count: int = 100,
    ) -> BrowseResult:
        """Search the local music library.

        Sonos implements search as a browse against a synthetic container
        whose identifier embeds the term, rather than through the standard
        UPnP ``Search`` action, which it declares but does not implement
        usefully.
        """
        object_id = f"{container}:{term}"
        return await self.browse(host, object_id, start=start, count=count)

    # -- convenience readers -------------------------------------------------

    async def library_root(self, host: str) -> BrowseResult:
        return await self.browse(host, BROWSE_ROOTS["library_root"])

    async def favorites(self, host: str) -> list[DidlItem]:
        return await self.browse_all(host, BROWSE_ROOTS["sonos_favorites"])

    async def radio_favorites(self, host: str) -> list[DidlItem]:
        return await self.browse_all(host, BROWSE_ROOTS["radio_stations"])

    async def sonos_playlists(self, host: str) -> list[DidlItem]:
        return await self.browse_all(host, BROWSE_ROOTS["sonos_playlists"])

    async def shares(self, host: str) -> list[DidlItem]:
        return await self.browse_all(host, BROWSE_ROOTS["shares"])

    async def line_in_sources(self, host: str) -> list[DidlItem]:
        return await self.browse_all(host, BROWSE_ROOTS["line_in"])

    async def queue(
        self, host: str, *, start: int = 0, count: int = 200
    ) -> BrowseResult:
        """Read a coordinator's queue."""
        return await self.browse(
            host, BROWSE_ROOTS["queue"], start=start, count=count)

    async def queue_length(self, host: str) -> int:
        page = await self.browse(host, BROWSE_ROOTS["queue"], start=0, count=1)
        return page.total

    async def share_index_state(self, host: str) -> dict[str, str]:
        """Whether the music library index is currently being rebuilt."""
        result = await self._soap.call(
            host, CONTENT_DIRECTORY, "GetShareIndexInProgress")
        return dict(result.args)
