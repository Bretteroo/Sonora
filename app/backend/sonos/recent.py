"""What each household has played lately, for the web theme's Recently Played.

The official web app leads its home with the household's listening history,
which Sonos keeps in its cloud. Nothing on the LAN holds such a list, so this
is Sonora's own: every time a room starts playing a container -- a station, an
album, a playlist -- the controller notes it here, most recent first, one
entry per source, twenty per household, saved beside the other state so it
survives a restart. Individual tracks are not history; the container they
came from is, which is also how the apps show it.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from time import time

log = logging.getLogger(__name__)

LIMIT = 20


class RecentlyPlayed:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._items: dict[str, list[dict]] = {}
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                self._items = {k: [e for e in v if isinstance(e, dict) and e.get("uri")]
                               for k, v in data.items() if isinstance(v, list)}
        except (OSError, ValueError):
            pass

    def items(self, household_id: str) -> list[dict]:
        return list(self._items.get(household_id, []))

    def note(self, household_id: str, entry: dict) -> bool:
        """Put ``entry`` at the front of the household's list. True if it moved."""
        uri = entry.get("uri", "")
        if not uri or not entry.get("title"):
            return False
        current = self._items.setdefault(household_id, [])
        if current and current[0].get("uri") == uri:
            return False
        rest = [e for e in current if e.get("uri") != uri]
        self._items[household_id] = [{**entry, "at": time()}, *rest][:LIMIT]
        self._save()
        return True

    def fill_art(self, household_id: str, uri: str, art: str) -> bool:
        """Give the entry for ``uri`` a picture if it has none. True if it got one.

        An entry is noted the moment its source starts, before the speaker has
        a picture for it; the next track to arrive with art supplies one.
        """
        if not art:
            return False
        for entry in self._items.get(household_id, []):
            if entry.get("uri") == uri and not entry.get("art"):
                entry["art"] = art
                self._save()
                return True
        return False

    def set_art(self, household_id: str, uri: str, art: str) -> None:
        """Give the entry for ``uri`` a better picture, and keep it."""
        changed = False
        for entry in self._items.get(household_id, []):
            if entry.get("uri") == uri and entry.get("art") != art:
                entry["art"] = art
                changed = True
        if changed:
            self._save()

    def _save(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(self._items, ensure_ascii=False))
        except OSError as exc:
            log.warning("could not save the recently played list: %s", exc)


def kind_of(upnp_class: str, uri: str) -> str:
    """The apps' word for a source: station, album, playlist, or other."""
    cls = upnp_class or ""
    if "audioBroadcast" in cls or uri.startswith(("x-sonosapi-stream", "x-sonosapi-hls",
                                                   "x-rincon-mp3radio", "x-sonosapi-radio")):
        return "station"
    if "musicAlbum" in cls:
        return "album"
    if "playlistContainer" in cls:
        return "playlist"
    return "other"
