"""A music service's own presentation: its Info & Options rows and labels.

The apps do not carry the rows they show under Info & Options. Each service
declares them, and the pieces live behind the ``<Manifest Uri>`` that
``ListAvailableServices`` gives for it:

* the manifest is JSON naming a ``presentationMap`` and a ``strings`` document;
* the presentation map's ``PresentationMap type="InfoView"`` lists the menu
  items the service overrides, each with the string id of its label;
* the strings document holds every label, per language.

Proved against Mixcloud on 2026-09-06: its InfoView declares
AddTrackToFavorites/FAVORITE_TRACK and RemoveTrackFromFavorites/
UNFAVORITE_TRACK, and its English table reads "Favorite Show", "Unfavorite
Show", "Related shows" and "Description" -- exactly the four rows the Windows
app showed for one of its shows, in that order.

These documents change about as often as a service's branding, and the
manifest carries a version, so they are cached for a long time. Fetching them
must never sit on a per-render path.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time

import aiohttp
from .. import locale as locales

log = logging.getLogger(__name__)

#: Manifests are versioned and change rarely; an hour is cautious.
TTL = 3600.0

_MENU = re.compile(
    r'<MenuItem\b([^>]*)/?>', re.IGNORECASE)
_ATTR = re.compile(r'(\w+)\s*=\s*"([^"]*)"')
_INFO_VIEW = re.compile(
    r'<PresentationMap\s+type="InfoView">(.*?)</PresentationMap>',
    re.IGNORECASE | re.DOTALL)
_SEARCH_VIEW = re.compile(
    r'<PresentationMap\s+type="Search">(.*?)</PresentationMap>',
    re.IGNORECASE | re.DOTALL)
_CATEGORY = re.compile(r'<(Category|CustomCategory)\b([^>]*)/?>', re.IGNORECASE)
# Two spellings are in the catalog: AccuRadio and Amazon Music publish
# NowPlayingRatings, Pandora publishes NowPlayingRatings_v2. The bodies are
# the same shape -- Match / Ratings / Rating / Icon -- and v2 only adds a
# `type` to each Match and a Type and State to each Rating, so both are read
# here (compared side by side 2026-09-15). Reading only the first spelling
# left Pandora with no buttons of its own, which is why its thumbs had been
# hand-transcribed into the backend instead.
_RATINGS_VIEW = re.compile(
    r'<PresentationMap\s+type="NowPlayingRatings(?:_v\d+)?"[^>]*>(.*?)</PresentationMap>',
    re.IGNORECASE | re.DOTALL)
_MATCH = re.compile(r'<Match\b([^>]*)>(.*?)</Match>', re.IGNORECASE | re.DOTALL)
_RATING = re.compile(r'<Rating\b([^>]*)>(.*?)</Rating>', re.IGNORECASE | re.DOTALL)
_ICON = re.compile(r'<Icon\b([^>]*)/?>', re.IGNORECASE)
_TABLE = re.compile(
    r'<stringtable\b([^>]*)>(.*?)</stringtable>', re.IGNORECASE | re.DOTALL)
_STRING = re.compile(
    r'<string\s+stringId="([^"]+)"\s*>(.*?)</string>',
    re.IGNORECASE | re.DOTALL)


class Presentation:
    """Reads and caches each service's presentation documents."""

    def __init__(self, session: aiohttp.ClientSession, *, timeout: float = 12.0):
        self._session = session
        self._timeout = aiohttp.ClientTimeout(total=timeout)
        self._cache: dict[str, tuple[float, dict]] = {}
        #: Which browse endpoints answer a caller with no credentials.
        self._public: dict[str, bool] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def info_view(self, manifest_uri: str, language: str = "") -> dict:
        """The service's Info & Options menu items with their labels.

        ``{"menu": [{"item": ..., "label": ..., "string_id": ...}],
        "strings": {id: text}}``, and empty when the service declares none.
        """
        blank: dict = {"menu": [], "strings": {}}
        if not manifest_uri:
            return blank
        # The reader's locale unless a caller names one; the cache is keyed by
        # it, since the same map answers differently per language.
        language = language or locales.current()
        key = f"{manifest_uri}|{language}"
        hit = self._cache.get(key)
        if hit is not None and (time.monotonic() - hit[0]) < TTL:
            return hit[1]
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            hit = self._cache.get(key)
            if hit is not None and (time.monotonic() - hit[0]) < TTL:
                return hit[1]
            try:
                found = await self._read(manifest_uri, language)
            except Exception as exc:
                log.info("no presentation for %s: %s", manifest_uri, exc)
                found = blank
            self._cache[key] = (time.monotonic(), found)
            return found

    async def search_categories(self, manifest_uri: str, language: str = "") -> list[dict]:
        """The service's search categories, as its presentation map declares them.

        ``PresentationMap type="Search"`` lists the categories the apps put in
        the scope bar: a ``Category`` names one of Sonos' own ids (the
        controller supplies the label -- "podcasts" reads "Podcasts & Shows",
        which is why TuneIn's tab says that where its SMAPI tree calls the
        container "Shows") and a ``CustomCategory`` carries the service's own
        string id instead (Plex's EPISODES). ``mappedId`` is the id to search.
        """
        view = await self.info_view(manifest_uri, language)
        out = []
        for cat in view.get("search") or []:
            entry = dict(cat)
            entry["label"] = (view.get("strings") or {}).get(cat.get("string_id") or "", "")
            out.append(entry)
        return out

    async def browse_endpoint(self, manifest_uri: str) -> str:
        """The service's browse endpoint, when its manifest declares one.

        A manifest may list ``endpoints``, and one of type ``browse`` points
        at a JSON resource that stands in for the service's SMAPI root. Nine
        of the 108 services this household offers declare one -- Amazon Music,
        Apple Music, Spotify, Sonos Radio, SiriusXM, Deezer, TuneIn (New),
        Soundtrack and Sonos Backgrounds -- and for those the app's first
        screen is that document, not ``getMetadata("root")``: Amazon's SMAPI
        root answers with Library and User Playlists alone, while the app
        shows Collections, Try Amazon Music Unlimited, Albums for You and the
        rest of the account's home rows (2026-09-07). Everything below the
        root is plain SMAPI again, keyed by the object ids the document gives.
        """
        view = await self.info_view(manifest_uri)
        return view.get("browse_endpoint", "")

    async def display_types(self, manifest_uri: str) -> dict:
        """The service's DisplayType map: id -> {"mode", "lines"}.

        ``PresentationMap type="DisplayType"`` gives each id a ``DisplayMode``
        (LIST, GRID, HERO...) and the ``Line`` tokens a row shows (title,
        artist, summary...). A row names one in its ``<displayType>``. The
        desktop app draws only what the lines name: Plex's ``titleSummary``
        puts the server after the library, Pandora's ``station`` the date
        under the station, and a row with no display type gets its title
        alone (measured 2026-09-14).
        """
        view = await self.info_view(manifest_uri)
        return view.get("display_types") or {}

    async def public_home(self, manifest_uri: str) -> bool:
        """Whether the service's home can be read with no credentials at all.

        Some browse endpoints answer anyone: Sonos Radio hands back its
        twenty-six shelves to a caller with no token, which is why its page
        opens in Sonora on a household whose account Sonora does not hold.
        Others refuse -- Spotify's answers 401 -- and those services really
        do need linking, and say so with a caution on the home.

        One request per endpoint per run, remembered either way.
        """
        endpoint = await self.browse_endpoint(manifest_uri)
        if not endpoint:
            return False
        known = self._public.get(endpoint)
        if known is not None:
            return known
        try:
            async with self._session.get(
                    endpoint, headers={"Accept": "application/json"},
                    timeout=self._timeout) as resp:
                answered = resp.status == 200
        except Exception as exc:                  # noqa: BLE001 - a no is a no
            log.info("anonymous browse of %s: %s", endpoint, exc)
            answered = False
        self._public[endpoint] = answered
        return answered

    async def sized(self, manifest_uri: str, url: str, want: int) -> str:
        """The same picture at the size wanted, where the service offers sizes.

        Providers publish one URL per item and two substitution tables:
        ``ArtWorkSizeMap`` for cover art and ``BrowseIconSizeMap`` for the
        glyphs on browse rows. Each lists a size with the suffix that URL
        carries at that size, so a controller swaps one suffix for another
        rather than asking for a picture by number. Pandora hands out
        ``..._90W_90H.jpg`` covers and a ``..._40.png`` stations icon; the
        product draws them at 156px, which is why Sonora's tiles were soft
        and its icon arrived as a white box rather than the transparent SVG
        (measured against play.sonos.com 2026-09-19).

        A URL whose suffix is in neither table is returned untouched, which
        is most of them.
        """
        if not url or not manifest_uri:
            return url
        view = await self.info_view(manifest_uri)
        for table in ("art_sizes", "icon_sizes"):
            swapped = _swap_size(view.get(table) or [], url, want)
            if swapped:
                return swapped
        return url

    async def ratings(self, manifest_uri: str, language: str = "en") -> dict:
        """The service's Now Playing rating buttons.

        ``PresentationMap type="NowPlayingRatings"`` gives one ``Match`` per
        value of a track property -- Amazon Music matches
        ``ratings-one-button`` 0 and 1 -- and each match lists the buttons to
        draw then, with the rating id to send, the string id of the tooltip,
        the string id of the message on success, and one icon per controller
        ("pcdcr" is the Windows desktop's, "universal" an SVG). Measured on
        Amazon Music 2026-09-07, whose value 0 offers the empty heart that
        rates 1, and value 1 the filled heart that rates 0.
        """
        view = await self.info_view(manifest_uri, language)
        return {"propname": view.get("ratings_propname", ""),
                "matches": view.get("ratings", {}),
                "kinds": view.get("ratings_kinds", {}),
                "strings": view.get("strings", {})}

    async def _read(self, manifest_uri: str, language: str) -> dict:
        manifest = json.loads(await self._get(manifest_uri))
        pm_uri = ((manifest.get("presentationMap") or {}).get("uri") or "")
        st_uri = ((manifest.get("strings") or {}).get("uri") or "")
        strings = _parse_strings(await self._get(st_uri), language) if st_uri else {}
        pmap = await self._get(pm_uri) if pm_uri else ""
        menu = _parse_info_view(pmap) if pmap else []
        for entry in menu:
            entry["label"] = strings.get(entry["string_id"], "")
        propname, ratings, kinds = _parse_ratings(pmap) if pmap else ("", {}, {})
        search = _parse_search(pmap) if pmap else []
        display_types = _parse_display_types(pmap) if pmap else {}
        art_sizes = _parse_sizes(pmap, "ArtWorkSizeMap", "imageSizeMap") if pmap else []
        icon_sizes = _parse_sizes(pmap, "BrowseIconSizeMap", "browseIconSizeMap") if pmap else []
        for buttons in ratings.values():
            for button in buttons:
                button["label"] = strings.get(button["string_id"], "")
                button["message"] = strings.get(button["on_success"], "")
        browse = ""
        for entry in manifest.get("endpoints") or []:
            if (entry or {}).get("type") == "browse":
                browse = (entry.get("uri") or "").strip()
        return {"menu": [e for e in menu if e["label"]], "strings": strings,
                "ratings_propname": propname, "ratings": ratings,
                "ratings_kinds": kinds,
                "search": search, "browse_endpoint": browse,
                "display_types": display_types,
                "art_sizes": art_sizes, "icon_sizes": icon_sizes}

    async def _get(self, url: str) -> str:
        async with self._session.get(url, timeout=self._timeout) as resp:
            resp.raise_for_status()
            return await resp.text()


def _parse_info_view(text: str) -> list[dict]:
    block = _INFO_VIEW.search(text)
    if block is None:
        return []
    out = []
    for match in _MENU.finditer(block.group(1)):
        attrs = {k: v for k, v in _ATTR.findall(match.group(1))}
        item = attrs.get("MenuItem", "")
        string_id = attrs.get("StringId", "")
        if item and string_id:
            out.append({"item": item, "string_id": string_id, "label": ""})
    return out


def _parse_display_types(text: str) -> dict:
    """Each ``<DisplayType id>`` with its DisplayMode and Line tokens."""
    out: dict[str, dict] = {}
    block = re.search(r'<PresentationMap[^>]*type="DisplayType"[^>]*>(.*?)</PresentationMap>',
                      text, re.S)
    if not block:
        return out
    for node in re.finditer(r'<DisplayType\s+id="([^"]+)"[^>]*>(.*?)</DisplayType>',
                            block.group(1), re.S):
        mode = re.search(r"<DisplayMode>\s*([^<\s]+)\s*</DisplayMode>", node.group(2))
        lines = re.findall(r'<Line\s+token="([^"]+)"', node.group(2))
        out[node.group(1).strip()] = {"mode": mode.group(1) if mode else "", "lines": lines}
    return out


def _parse_sizes(text: str, kind: str, table: str) -> list[tuple[int, str]]:
    """One size map: ``[(size, suffix)]``, smallest first.

    ``<sizeEntry size="290" substitution="_290.svg"/>``. Size 0 is the
    provider's own default -- the suffix its URLs already carry -- so it
    takes part in the matching but is never chosen as a target.
    """
    block = re.search(rf'<PresentationMap[^>]*type="{kind}"[^>]*>(.*?)</PresentationMap>',
                      text, re.S)
    if not block:
        return []
    body = re.search(rf"<{table}>(.*?)</{table}>", block.group(1), re.S)
    if not body:
        return []
    out: list[tuple[int, str]] = []
    for node in re.finditer(r"<sizeEntry\b([^>]*)/?>", body.group(1)):
        attrs = {k: v for k, v in _ATTR.findall(node.group(1))}
        suffix = attrs.get("substitution", "")
        try:
            size = int(attrs.get("size", "0") or 0)
        except ValueError:
            continue
        if suffix:
            out.append((size, suffix))
    return sorted(out)


def _swap_size(sizes: list[tuple[int, str]], url: str, want: int) -> str:
    """Swap the suffix the URL carries for the one nearest the size wanted."""
    here = max((entry for entry in sizes if url.endswith(entry[1])),
               key=lambda entry: len(entry[1]), default=None)
    if here is None:
        return ""
    bigger = [entry for entry in sizes if entry[0] >= want]
    target = min(bigger) if bigger else max(sizes)
    if target[1] == here[1]:
        return ""
    return url[:-len(here[1])] + target[1]


def _parse_search(text: str) -> list[dict]:
    """The Search map's categories, in the order the service lists them."""
    block = _SEARCH_VIEW.search(text)
    if block is None:
        return []
    out = []
    for tag, attrs in _CATEGORY.findall(block.group(1)):
        fields = {k.lower(): v for k, v in _ATTR.findall(attrs)}
        mapped = fields.get("mappedid", "")
        if not mapped:
            continue
        out.append({"id": fields.get("id", "") or fields.get("stringid", ""),
                    "mapped_id": mapped,
                    "string_id": fields.get("stringid", ""),
                    # A CustomCategory is the service's own, named in its own
                    # words; a Category takes the controller's wording.
                    "custom": tag.lower() == "customcategory"})
    return out


def _parse_ratings(text: str) -> tuple[str, dict[str, list[dict]], dict[str, str]]:
    """The rating map: the property watched, the buttons per value, and
    (where the map gives them) the rating words each value stands for."""
    block = _RATINGS_VIEW.search(text)
    if block is None:
        return "", {}, {}
    propname = ""
    out: dict[str, list[dict]] = {}
    kinds: dict[str, str] = {}
    for attrs, body in _MATCH.findall(block.group(1)):
        fields = {k.lower(): v for k, v in _ATTR.findall(attrs)}
        propname = propname or fields.get("propname", "")
        value = fields.get("value", "")
        # v2's Match also names the rating in the words the speakers use for
        # it (NONE, THUMBSUP, THUMBSDOWN), which is how a controller can tell
        # which set of buttons to draw for a service that does not return the
        # property with the item.
        if fields.get("type"):
            kinds[fields["type"].upper()] = value
        buttons: list[dict] = []
        for rattrs, rbody in _RATING.findall(body):
            rfields = {k.lower(): v for k, v in _ATTR.findall(rattrs)}
            icons = {}
            for iattrs in _ICON.findall(rbody):
                ifields = {k.lower(): v for k, v in _ATTR.findall(iattrs)}
                controller = ifields.get("controller", "")
                if controller and ifields.get("uri"):
                    icons[controller] = ifields["uri"]
            buttons.append({
                "id": rfields.get("id", ""),
                "string_id": rfields.get("stringid", ""),
                "on_success": rfields.get("onsuccessstringid", ""),
                "auto_skip": rfields.get("autoskip", ""),
                # v2 only: the rating this button stands for, in the words the
                # players use, and whether the item already carries it -- so a
                # press on a RATED button is the one that takes the rating
                # away. That is the whole state machine the map describes.
                "rating_type": rfields.get("type", ""),
                "rating_state": rfields.get("state", ""),
                "icon": icons.get("pcdcr") or icons.get("universal") or "",
                "icons": icons,
                "label": "",
                "message": "",
            })
        if buttons:
            out[value] = buttons
    return propname, out, kinds


def _parse_strings(text: str, language: str) -> dict[str, str]:
    """The table for a language, falling back to plain English then anything.

    A service ships one ``stringtable`` per language, tagged with
    ``xml:lang``. Mixcloud's is "en-US"; others use bare "en".
    """
    tables: dict[str, dict[str, str]] = {}
    for attrs, body in _TABLE.findall(text):
        lang = ""
        for key, value in _ATTR.findall(attrs):
            if key.lower().endswith("lang"):
                lang = value
        tables[lang.lower()] = {
            sid: _unescape(value.strip()) for sid, value in _STRING.findall(body)
        }
    want = language.lower()
    for candidate in (want, f"{want}-us", want.split("-")[0]):
        if candidate in tables:
            return tables[candidate]
    for lang, table in tables.items():
        if lang.startswith(want.split("-")[0]):
            return table
    return next(iter(tables.values()), {})


def _unescape(value: str) -> str:
    return (value.replace("&amp;", "&").replace("&lt;", "<")
            .replace("&gt;", ">").replace("&quot;", '"')
            .replace("&#39;", "'").replace("&apos;", "'"))
