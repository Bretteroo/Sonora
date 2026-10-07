"""SMAPI: browsing a music service directly against its own provider.

Sonos music services speak SMAPI, a SOAP interface each provider hosts itself.
The endpoints come from the household's own catalog
(``MusicServices#ListAvailableServices``), and they point at the provider
rather than at Sonos: ``legato.radiotime.com`` for TuneIn,
``www.accuradio.com`` for AccuRadio, ``sonos.plex.tv`` for Plex. So browsing a
service stays within the local-first rule; the only thing that came from Sonos
was the address.

Authentication is the dividing line. A service whose policy is ``Anonymous``
answers ``getMetadata`` with no credentials at all. ``DeviceLink`` and
``AppLink`` services need a token that lives on the household, and the
firmware exposes no way to read it: ``/status/accounts`` returns an empty
document. Those services are reported as needing linking rather than being
silently shown as empty.
"""

from __future__ import annotations

import html
import logging
import os
import re
import time
from dataclasses import dataclass, field
from urllib.parse import unquote
from xml.sax.saxutils import escape

import aiohttp
from defusedxml import ElementTree as DET
from .. import locale as locales

log = logging.getLogger(__name__)

SMAPI_NS = "http://www.sonos.com/Services/1.1"

#: A controller identifies itself to a service. Sonos' own controllers send a
#: household id and a device id; anonymous services ignore both.
DEVICE_PROVIDER = "Sonos"


def prose(value: str) -> str:
    """Text a service means to be read, with its HTML entities resolved.

    SMAPI carries text as XML, so the parser has already turned ``&amp;`` back
    into an ampersand -- but providers write their descriptions as HTML and
    escape them a second time on the way in. Libby's audiobook summaries reach
    a controller saying ``NEW YORK TIMES BESTSELLER &bull;`` and full of
    ``&rsquo;`` and ``&mdash;``; the product shows the punctuation, so this
    resolves it too (measured 2026-09-20). Ids, URIs and tokens are left
    alone: an unescaper following the HTML5 rules would read a query string's
    ``&copy=`` as a copyright sign.
    """
    if "&" not in value:
        return value
    return html.unescape(value)


class SmapiError(Exception):
    """A fault returned by a music service."""

    def __init__(self, service: str, code: str, detail: str,
                 sonos_error: int | None = None,
                 refresh: tuple[str, str] | None = None):
        self.service = service
        self.code = code
        self.detail = detail
        #: (token, key) the provider handed back with a TokenRefreshRequired
        #: fault. SMAPI rotates login tokens this way: the old pair is refused,
        #: the fault's detail carries the new one, and the client is expected
        #: to store it and repeat the request.
        self.refresh = refresh
        #: The numeric SonosError from the fault, when present. These are
        #: standard across providers: 5 is NOT_LINKED_RETRY, 6 is
        #: NOT_LINKED_FAILURE, 403 is NOT_AUTHORIZED.
        self.sonos_error = sonos_error
        super().__init__(f"{service}: {code}{f' ({detail})' if detail else ''}")

    @property
    def pending(self) -> bool:
        """The provider has not seen the person sign in yet; ask again.

        Recognized both as the ``NOT_LINKED_RETRY`` string and as SonosError 5,
        which Spotify (and others) return by number rather than by name during
        the wait for the person to sign in.
        """
        if self.sonos_error == 5:
            return True
        blob = f"{self.code} {self.detail}".replace("_", "").lower()
        return "notlinkedretry" in blob

    @property
    def needs_auth(self) -> bool:
        """Whether the fault means "log in" rather than "something broke"."""
        markers = ("Client.LoginUnauthorized", "Client.LoginUnsupported",
                   "Client.TokenRefreshRequired", "Client.NotLinkedRetry",
                   "Client.NotLinkedFailure", "Client.AuthTokenExpired",
                   # TuneIn phrases it in prose under a bare s:Client code.
                   "Login token is required", "LoginTokenRequired")
        return any(m in self.code or m in self.detail for m in markers)


def _dump(service_name: str, action: str, body: str, text: str) -> None:
    """With SONORA_SMAPI_DUMP naming a directory, keep each answer there.

    A research aid: what a service sent, to read the fields Sonora does not
    parse yet. Only answers are written; the request's credentials are in
    its header, which is never kept.
    """
    where = os.environ.get("SONORA_SMAPI_DUMP")
    if not where:
        return
    try:
        stamp = f"{time.time():.3f}"
        path = os.path.join(where, f"{stamp}-{re.sub(r'[^A-Za-z0-9]+', '_', service_name)}-{action}.xml")
        with open(path, "w", encoding="utf-8") as out:
            out.write(f"<!-- {escape(body)} -->\n{text}")
    except OSError:
        pass

def _flag(said: str) -> bool | None:
    """A SMAPI boolean: true, false, or not said."""
    said = (said or "").strip().lower()
    if said in ("true", "1"):
        return True
    if said in ("false", "0"):
        return False
    return None

def _can_play(item_level: str, track_level: str, kind: str) -> bool:
    """Whether a service is offering this item to be played.

    ``canPlay`` turns up at the item's own level on some services and inside
    ``trackMetadata`` on others. A stated value wins wherever it is stated;
    with nothing stated, a piece of mediaMetadata is playable and a collection
    is not.
    """
    for stated in (item_level, track_level):
        if stated:
            return stated == "true"
    return kind == "mediaMetadata"


@dataclass(slots=True)
class SmapiItem:
    """One entry from a service's browse tree."""

    id: str
    title: str
    item_type: str = ""
    art: str = ""
    can_play: bool = False
    #: Three-valued: the service said true, said false, or said nothing. The
    #: difference matters -- Plex marks the one library currently in view
    #: ``<canEnumerate>false</canEnumerate>`` in Other Sources and the app
    #: grays that row, while its other libraries say nothing and open
    #: (2026-09-14). Reading silence as false grayed them all.
    can_enumerate: bool | None = None
    #: Whether a browse document's shelf says it can be opened as a page of
    #: its own. Its own policy, not the softened can_enumerate above: the
    #: product hangs View All on exactly the shelves that carry it.
    can_open: bool = False
    is_container: bool = False
    #: Present on playable leaves.
    mime_type: str = ""
    artist: str = ""
    album: str = ""
    duration: int = 0
    #: The provider's own second line for an item. Plex puts the server name
    #: here, which is the only thing telling two "Music" libraries apart.
    summary: str = ""
    #: What the provider says the item IS, beyond its item type: Pocket Casts
    #: returns semanticType "episode.podcast" for an episode, and that is what
    #: decides the apps' Now Playing labels (2026-09-06).
    semantic_type: str = ""
    #: A podcast episode names its show and its date; the apps label these
    #: "Podcast" and "Release Date" in Now Playing (2026-09-06).
    podcast: str = ""
    release_date: str = ""
    #: The show's own id and the episode's producer, from trackMetadata:
    #: Amazon's Info & Options opens "Podcast Info" on the first and labels
    #: the second "Provider" (Tinkercast, 2026-09-07).
    podcast_id: str = ""
    producer: str = ""
    #: An audiobook chapter's trackMetadata names its author, narrator and
    #: book instead of an artist and album (Libby by OverDrive, 2026-09-07);
    #: the apps then label Now Playing Chapter / Author / Narrator and print
    #: "Book" under the art.
    author: str = ""
    narrator: str = ""
    book: str = ""
    #: What a stream is playing now. The app shows this as the row's tooltip,
    #: not as a second line (80s80s: "Our show" on hover, 2026-09-06).
    stream_show: str = ""
    #: The provider's own ids for the item's artist and album, which is how
    #: the apps' Info & Options offers "Artist Info" and "Album Info" (Plex
    #: returns artistId and albumId on a track and artistId on an album,
    #: 2026-09-07).
    artist_id: str = ""
    album_id: str = ""
    #: Whether the provider will take this item as one of its own favorites.
    #: None when the provider does not say. The distinction matters: Plex
    #: says false on items it will not take and the apps then drop the
    #: favorites rows, while Mixcloud says nothing at all and the apps keep
    #: Favorite Show / Unfavorite Show up -- reading silence as false made
    #: those two rows vanish a moment after they appeared.
    can_add_to_favorites: bool | None = None
    #: The service's ``<displayType>`` for the row, an id into the DisplayType
    #: map in its presentation map, which names the lines the row shows.
    #: Plex marks its Other Sources libraries ``titleSummary`` (title over the
    #: server's name) and Pandora its stations ``station`` (title over the
    #: date last played); a row with none shows its title alone, whatever
    #: summary it carries (Pocket Casts' root, 2026-09-14).
    display_type: str = ""
    #: The item's <dynamic><property> pairs. A service's NowPlayingRatings
    #: map matches on one of these -- Amazon Music watches
    #: "ratings-one-button" -- to decide which rating buttons to draw.
    properties: dict = field(default_factory=dict)
    #: Whether the service marks this item explicit. Three-valued: marked,
    #: marked as not, or not spoken about. The wire shape is the service's
    #: own, measured 2026-09-19: Spotify and Pandora both send
    #: ``<tags><explicit>0|1</explicit></tags>`` and Pandora adds
    #: ``<isExplicit>false</isExplicit>`` beside it, while AccuRadio, Plex and
    #: the radio services say nothing at all. Nothing sends SMAPI's documented
    #: ``TAG_EXPLICIT`` string.
    explicit: bool | None = None
    #: Where the row came from: "smapi" for getMetadata, "browse" for a row
    #: of the service's browse-endpoint home.
    origin: str = "smapi"
    #: Whether the row's browse policies speak to playback at all (a
    #: ``canPlay`` key, whatever its value). The apps offer "Add to Sonos
    #: Playlist" on a home row exactly then: Amazon's rows declare canPlay and
    #: get the item -- even "Try Amazon Music Unlimited", canPlay false --
    #: while Spotify's shelves declare no policies and Sonos Radio's only
    #: favorites, and neither gets it (measured 2026-09-07 and 2026-09-14).
    #: It used to be keyed on ``origin`` alone, from the Amazon measurement,
    #: which gave Spotify and Sonos Radio a row the app never draws.
    playlist_policy: bool = False
    #: The first children a browse-endpoint row arrives with. A service's
    #: home is a document of shelves -- Spotify's "New releases for you",
    #: Sonos Radio's "Trending Now", TuneIn's "Recents" -- and each shelf
    #: carries its own first rows inside it. The product draws those as a
    #: line of tiles under the shelf's name rather than making you open the
    #: shelf to see anything (measured 2026-09-19). SMAPI rows have none.
    children: tuple = ()
    #: A playlist the account may add to (``<isEditable>``) and one that is
    #: the user's own (``<userContent>``): what the apps' "Add Song to
    #: <service> Playlist" lists. None where the service does not say.
    editable: bool | None = None
    user_content: bool | None = None

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "item_type": self.item_type,
            "art": self.art,
            "can_play": self.can_play,
            "can_enumerate": self.can_enumerate,
            "can_open": self.can_open,
            "is_container": self.is_container,
            "artist": self.artist,
            "album": self.album,
            "duration": self.duration,
            "summary": self.summary,
            "stream_show": self.stream_show,
            "semantic_type": self.semantic_type,
            "podcast": self.podcast,
            "release_date": self.release_date,
            "podcast_id": self.podcast_id,
            "producer": self.producer,
            "author": self.author,
            "narrator": self.narrator,
            "book": self.book,
            "artist_id": self.artist_id,
            "album_id": self.album_id,
            "can_add_to_favorites": self.can_add_to_favorites,
            "display_type": self.display_type,
            "explicit": self.explicit,
            "properties": dict(self.properties),
            "origin": self.origin,
            "playlist_policy": self.playlist_policy,
            "children": [child.as_dict() for child in self.children],
            "editable": self.editable,
            "user_content": self.user_content,
        }


@dataclass(slots=True)
class SmapiPage:
    items: list[SmapiItem] = field(default_factory=list)
    index: int = 0
    count: int = 0
    total: int = 0

    def as_dict(self) -> dict:
        return {
            "index": self.index,
            "count": self.count,
            "total": self.total,
            "items": [i.as_dict() for i in self.items],
        }


@dataclass
class RateResult:
    """What a provider said back to ``rateItem``."""

    should_skip: bool = False
    message_string_id: str = ""


def parse_rate_result(text: str) -> RateResult:
    """Read ``shouldSkip`` and ``messageStringId`` out of a rateItem answer.

    Both are optional per Sonos' SMAPI reference: a provider whose ratings
    are static leaves them out and the presentation map's AutoSkip and
    OnSuccessStringId stand. Namespace prefixes vary, so the tag names are
    matched loosely.
    """
    skip = re.search(r"<(?:\w+:)?shouldSkip\b[^>]*>\s*(true|1)\s*<", text, re.I)
    msg = re.search(r"<(?:\w+:)?messageStringId\b[^>]*>\s*([^<]*?)\s*<", text, re.I)
    return RateResult(should_skip=bool(skip),
                      message_string_id=(msg.group(1) if msg else "").strip())


def smapi_item_id(track_uri: str) -> str:
    """The provider's own id for a track URI the speakers are playing.

    ``x-sonos-http:<escaped id>.<ext>?sid=...`` carries it percent-encoded
    with a file extension bolted on, which is how ``playable()`` built it.
    """
    scheme, _, rest = track_uri.partition(":")
    # Only the schemes playable() builds for a service item carry one. A raw
    # stream (hls-radio://, http://) names no provider id at all. Amazon
    # Music's tracks arrive as x-sonosapi-hls-static with the id in the same
    # place (2026-09-07).
    if scheme not in ("x-sonos-http", "x-sonos-spotify", "x-sonosprog-http",
                      "x-sonosapi-hls", "x-sonosapi-hls-static"):
        return ""
    rest = rest.split("?", 1)[0]
    rest = re.sub(r"\.(mp3|m4a|mp4|aac|flac|ogg|wma|wav)$", "", rest,
                  flags=re.IGNORECASE)
    return unquote(rest)


#: Schemes whose remainder is a provider item id, with the service in `sid`.
_SERVICE_SCHEMES = (
    "x-sonos-http", "x-sonosprog-http", "x-sonosapi-hls", "x-sonosapi-hls-static",
    # Stations: TuneIn and the rest publish these, and getMediaURI resolves
    # them the same way it resolves a track.
    "x-sonosapi-stream", "x-sonosapi-radio",
)


def smapi_media_ref(uri: str) -> tuple[int, str]:
    """``(sid, item id)`` for a service URI, or ``(0, "")``.

    ``x-sonosapi-stream:s34635?sid=254&flags=8224&sn=0`` is TuneIn station
    ``s34635``; ``x-sonos-http:track%3a232168008.mp3?sid=160`` is track
    ``track:232168008``. The id is percent-encoded and, for a track, carries
    the file extension ``playable()`` bolted on.
    """
    scheme, _, rest = (uri or "").partition(":")
    if scheme not in _SERVICE_SCHEMES or not rest:
        return 0, ""
    item, _, query = rest.partition("?")
    item = re.sub(r"\.(mp3|m4a|mp4|aac|flac|ogg|wma|wav)$", "", item, flags=re.IGNORECASE)
    sid = 0
    for part in query.split("&"):
        field, _, value = part.partition("=")
        if field == "sid" and value.isdigit():
            sid = int(value)
    return sid, unquote(item)


def smapi_container_ref(uri: str) -> tuple[int, str]:
    """``(sid, container id)`` for an album, playlist or audiobook URI.

    ``x-rincon-cpcontainer:1013606caudiobook%3A41585002%3A2570529?sid=305`` is
    Libby's audiobook ``audiobook:41585002:2570529``. The eight hex digits in
    front are the container's flags, which the speakers put there and the
    service does not want back.
    """
    scheme, _, rest = (uri or "").partition(":")
    if scheme != "x-rincon-cpcontainer" or not rest:
        return 0, ""
    item, _, query = rest.partition("?")
    if re.match(r"^[0-9a-fA-F]{8}", item):
        item = item[8:]
    sid = 0
    for part in query.split("&"):
        field, _, value = part.partition("=")
        if field == "sid" and value.isdigit():
            sid = int(value)
    return sid, unquote(item)


def smapi_sid(uri: str) -> int:
    """The service a URI names, whatever its scheme."""
    _, _, rest = (uri or "").partition(":")
    for part in rest.partition("?")[2].split("&"):
        field, _, value = part.partition("=")
        if field == "sid" and value.isdigit():
            return int(value)
    return 0


def smapi_account_serial(uri: str) -> str:
    """The ``sn`` a service URI names: which of the household's accounts."""
    _, _, rest = (uri or "").partition(":")
    for part in rest.partition("?")[2].split("&"):
        field, _, value = part.partition("=")
        if field == "sn":
            return value
    return ""


def _is_fault(text: str) -> bool:
    """Whether a SOAP body carries a Fault element, whatever its status."""
    return "Fault>" in text and ("faultcode" in text or "faultstring" in text)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


#: A namespace prefix used without being declared. At least one provider in a
#: live household emits this, which a strict parser refuses outright.
_UNBOUND = re.compile(r"<(/?)(?:[A-Za-z][\w.-]*):([A-Za-z][\w.-]*)")
#: Prefixes the document declares, so an undeclared one can be told apart.
_DECLARED = re.compile(r"xmlns:([A-Za-z][\w.-]*)\s*=")
#: A prefixed attribute, for dropping the ones nothing declares.
_ATTR = re.compile(r"\s([A-Za-z][\w.-]*):([A-Za-z][\w.-]*)\s*=\s*(\"[^\"]*\"|'[^']*')")


def _lenient_fromstring(text: str):
    try:
        return DET.fromstring(text)
    except Exception:
        # Retry without the prefixes a strict parser cannot resolve. Element
        # prefixes go entirely -- local names are all this parser uses -- and
        # an attribute whose prefix the document never declares is dropped:
        # Sonos Radio answers getMetadata with a bare xsi:nil="true" and no
        # xmlns:xsi, which took down the whole browse with a 500.
        declared = set(_DECLARED.findall(text)) | {"xmlns", "xml"}

        def keep(match: re.Match) -> str:
            return "" if match.group(1) not in declared else match.group(0)

        return DET.fromstring(_UNBOUND.sub(r"<\1\2", _ATTR.sub(keep, text)))


class SmapiClient:
    """Issues SMAPI calls to a provider's own endpoint."""

    def __init__(self, session: aiohttp.ClientSession, *, timeout: float = 12.0):
        #: Called as (household_id, old_token, new_token, new_key) when a
        #: provider rotates a login token, so the owner of the token store can
        #: persist the replacement. Without it a rotated token is used once.
        self.on_token_refresh = None
        #: Called as (household_id) -> bool: whether that household filters
        #: explicit content. Set by the controller. Every call carries the
        #: answer in its context header, so the filtering is the service's
        #: own and nothing here has to know which services do it.
        self.content_filtering = None
        self._session = session
        self._timeout = aiohttp.ClientTimeout(total=timeout)

    async def get_metadata(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str = "root",
        index: int = 0,
        count: int = 100,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> SmapiPage:
        """Fetch one page of a service's browse tree."""
        body = (
            f"<id>{escape(item_id)}</id>"
            f"<index>{int(index)}</index>"
            f"<count>{int(count)}</count>"
        )
        # `recursive` is optional in SMAPI and false by default, so it is left
        # out: SomaFM validates requests against a strict schema and rejects
        # the element outright, while no provider needs it present.
        text = await self._call(endpoint, service_name, "getMetadata", body,
                                household_id=household_id, token=token, key=key,
                                device_id=device_id)
        return self._filtered(self._parse(text), household_id)

    async def get_media_metadata(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> SmapiItem | None:
        """What the service itself says about one item.

        The apps' Now Playing labels come from here rather than from the DIDL
        the speaker holds: a Pocket Casts episode's queue entry carries an
        empty artist and album, yet the app prints "Podcast  This American
        Life" and "Release Date  9/7/2026", which only the provider knows
        (measured 2026-09-06).
        """
        text = await self._call(endpoint, service_name, "getMediaMetadata",
                                f"<id>{escape(item_id)}</id>",
                                household_id=household_id, token=token,
                                key=key, device_id=device_id)
        page = self._parse(text)
        return page.items[0] if page.items else None

    async def get_media_uri(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> dict:
        """The URL a player would fetch for one item, from the service itself.

        This is the call a speaker makes when it is handed an
        ``x-sonosapi-stream:`` or ``x-sonos-http:`` URI: the scheme names the
        service and the item, and the service answers with a real URL, plus
        the headers to send with it when the stream is an authenticated one.

        Sonora makes the same call for the "This browser" room, with the same
        household credentials it browses with. Where a service answers with
        headers, the page cannot send them and the stream is proxied instead.
        """
        text = await self._call(endpoint, service_name, "getMediaURI",
                                f"<id>{escape(item_id)}</id>",
                                household_id=household_id, token=token,
                                key=key, device_id=device_id)
        root = _lenient_fromstring(text)
        url = ""
        headers: dict[str, str] = {}
        for node in root.iter():
            name = _local(node.tag)
            if name == "getMediaURIResult":
                url = (node.text or "").strip()
            elif name == "httpHeader":
                pair = {_local(child.tag): (child.text or "") for child in node}
                if pair.get("header"):
                    headers[pair["header"]] = pair.get("value", "")
        if not url:
            # Worth seeing: a service that answers without a fault and without
            # a URL is saying something in a shape this does not read yet.
            log.info("%s getMediaURI(%s) gave no URL: %s", service_name, item_id,
                     " ".join(text.split())[:400])
        return {"url": url, "headers": headers}

    async def get_extended_metadata(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> dict:
        """The extra things a service offers for one item.

        The apps' Info & Options rows below the metadata come from here: a
        Mixcloud show offers Favorite Show, Unfavorite Show, Related shows and
        Description, which are this call's dynamic properties, relatedBrowse
        and relatedText (2026-09-06). Returned raw-ish so the caller can
        decide what to show.
        """
        text = await self._call(endpoint, service_name, "getExtendedMetadata",
                                f"<id>{escape(item_id)}</id>",
                                household_id=household_id, token=token,
                                key=key, device_id=device_id)
        root = _lenient_fromstring(text)
        out: dict = {"actions": [], "related": [], "text": "", "text_type": "", "links": [],
                     "related_play": None}
        for node in root.iter():
            name = _local(node.tag)
            if name == "action":
                # <relatedActions> carries the things a container offers that
                # are not browsing: Amazon Music's "Try Amazon Music
                # Unlimited" is a container that cannot enumerate and holds an
                # openUrl action to amzn.to (2026-09-07). TuneIn puts a
                # simpleHttpRequest here for its own favorites.
                kind = (node.findtext("./{*}actionType") or "").strip()
                url = (node.findtext(".//{*}url") or "").strip()
                if kind and url:
                    headers = {}
                    for h in node.findall(".//{*}httpHeader"):
                        name = (h.findtext("./{*}header") or "").strip()
                        if name:
                            headers[name] = (h.findtext("./{*}value") or "").strip()
                    out["links"].append({
                        "id": (node.findtext("./{*}id") or "").strip(),
                        "string_id": (node.findtext("./{*}title") or "").strip(),
                        "type": kind,
                        "url": url,
                        "method": (node.findtext(".//{*}method") or "").strip(),
                        "headers": headers,
                        "refresh": (node.findtext(".//{*}refreshOnSuccess") or "").strip() == "true",
                        "failure_id": (node.findtext("./{*}failureMessageStringId") or "").strip(),
                    })
            elif name == "property":
                pid = (node.findtext("./{*}id") or "").strip()
                label = (node.findtext("./{*}value") or "").strip()
                if pid or label:
                    out["actions"].append({"id": pid, "label": label})
            elif name == "relatedBrowse":
                out["related"].append({
                    "id": (node.findtext("./{*}id") or "").strip(),
                    "type": (node.findtext("./{*}type") or "").strip(),
                })
            elif name == "relatedPlay":
                # What a service's RelatedPlay menu item would play: Spotify
                # sends a track radio here for a track. An item without one
                # gets no such row -- Pandora's InfoView names "Play Curated
                # Mode", but a station's answer carries none and the app's
                # page for it has no such row (2026-09-23).
                out["related_play"] = {
                    "id": (node.findtext("./{*}id") or "").strip(),
                    "item_type": (node.findtext("./{*}itemType") or "").strip(),
                    "title": (node.findtext("./{*}title") or "").strip(),
                }
            elif name == "relatedText":
                out["text"] = (node.findtext("./{*}id") or node.text or "").strip()
                out["text_type"] = (node.findtext("./{*}type") or "").strip()
        return out

    async def get_extended_metadata_item(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> SmapiItem | None:
        """The item itself as ``getExtendedMetadata`` describes it.

        The same call that carries the related list also returns the item's
        own ``mediaCollection`` or ``mediaMetadata``, with the fields the
        apps' Info & Options is built from: what type of thing it is, its
        artist and album, their provider ids, and whether the provider will
        favorite it.
        """
        text = await self._call(endpoint, service_name, "getExtendedMetadata",
                                f"<id>{escape(item_id)}</id>",
                                household_id=household_id, token=token,
                                key=key, device_id=device_id)
        root = _lenient_fromstring(text)
        for node in root.iter():
            name = _local(node.tag)
            if name in ("mediaCollection", "mediaMetadata"):
                return self._item(node, name)
        return None

    #: Search categories tried when a provider does not list its own.
    DEFAULT_SEARCH_CATEGORIES = (("artists", "Artists"), ("albums", "Albums"),
                                 ("tracks", "Tracks"), ("stations", "Stations"),
                                 ("playlists", "Playlists"))

    async def search_categories(self, *, endpoint: str, service_name: str,
                                household_id: str = "", token: str = "", key: str = "",
                                device_id: str = "") -> list[tuple[str, str]]:
        """The provider's search categories, or a standard set if it has none.

        SMAPI lists them as the children of the ``search`` item; providers
        without a presentation map answer that with a fault, in which case
        the usual category ids are tried and the empty ones dropped.
        """
        try:
            page = await self.get_metadata(endpoint=endpoint, service_name=service_name,
                                           item_id="search", count=20, household_id=household_id,
                                           token=token, key=key, device_id=device_id)
        except SmapiError:
            return list(self.DEFAULT_SEARCH_CATEGORIES)
        cats = [(item.id, item.title or item.id) for item in page.items if item.id]
        return cats or list(self.DEFAULT_SEARCH_CATEGORIES)

    async def search(self, *, endpoint: str, service_name: str, category_id: str,
                     term: str, index: int = 0, count: int = 20, household_id: str = "",
                     token: str = "", key: str = "", device_id: str = "") -> SmapiPage:
        """One page of a provider's search results in one category."""
        body = (
            f"<id>{escape(category_id)}</id>"
            f"<term>{escape(term)}</term>"
            f"<index>{int(index)}</index>"
            f"<count>{int(count)}</count>"
        )
        text = await self._call(endpoint, service_name, "search", body,
                                household_id=household_id, token=token, key=key,
                                device_id=device_id)
        return self._filtered(self._parse(text), household_id)

    async def get_extended_metadata_text(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str,
        text_type: str,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> str:
        """One piece of prose a service keeps about an item.

        ``getExtendedMetadata`` hands back a ``relatedText`` id; this fetches
        what it points at, which is what the apps' "Description" row opens.
        """
        body = (f"<id>{escape(item_id)}</id>"
                f"<type>{escape(text_type)}</type>")
        text = await self._call(endpoint, service_name,
                                "getExtendedMetadataText", body,
                                household_id=household_id, token=token,
                                key=key, device_id=device_id)
        root = _lenient_fromstring(text)
        for node in root.iter():
            if _local(node.tag) == "getExtendedMetadataTextResult":
                return (node.text or "").strip()
        return ""

    async def set_favorite(
        self,
        *,
        endpoint: str,
        service_name: str,
        item_id: str,
        favorite: bool,
        household_id: str = "",
        token: str = "",
        key: str = "",
        device_id: str = "",
    ) -> None:
        """Add or remove one of the service's own favorites.

        The apps' Favorite/Unfavorite rows are NOT ratings. Measured against
        Mixcloud on 2026-09-06: its schema rejects ``rateItem`` outright
        ("No matching global declaration"), while ``createItem`` and
        ``deleteItem`` with a ``<favorite>`` both validate and work -- the
        household's favorites list went 0 -> 1 when the app favorited a
        show, then 1 -> 0 on deleteItem and back to 1 on createItem.
        """
        action = "createItem" if favorite else "deleteItem"
        await self._call(endpoint, service_name, action,
                         f"<favorite>{escape(item_id)}</favorite>",
                         household_id=household_id, token=token, key=key,
                         device_id=device_id)

    # -- the user's own playlists on the service ------------------------------
    # What the apps' "Add Song to <service> Playlist" does (S1 Mac app,
    # 2026-09-24): list the playlists under the service's ``playlists``
    # container -- the ones marked readOnly="false" take a song -- and then
    # addToContainer, or createContainer seeded with the song for New
    # Playlist.

    async def add_to_container(self, *, endpoint: str, service_name: str,
                               item_id: str, parent_id: str, index: int = -1,
                               household_id: str = "", token: str = "",
                               key: str = "", device_id: str = "") -> str:
        """Put ``item_id`` into the playlist ``parent_id``; its new updateId."""
        text = await self._call(
            endpoint, service_name, "addToContainer",
            f"<id>{escape(item_id)}</id><parentId>{escape(parent_id)}</parentId>"
            f"<index>{index}</index><updateId></updateId>",
            household_id=household_id, token=token, key=key, device_id=device_id)
        found = re.search(r"<(?:\w+:)?updateId>([^<]*)</", text)
        return found.group(1) if found else ""

    async def create_container(self, *, endpoint: str, service_name: str,
                               title: str, seed_id: str = "",
                               household_id: str = "", token: str = "",
                               key: str = "", device_id: str = "") -> str:
        """A new playlist named ``title``, holding ``seed_id``; its id."""
        text = await self._call(
            endpoint, service_name, "createContainer",
            f"<containerType>playlist</containerType><title>{escape(title)}</title>"
            f"<parentId></parentId><seedId>{escape(seed_id)}</seedId>",
            household_id=household_id, token=token, key=key, device_id=device_id)
        found = re.search(r"<(?:\w+:)?id>([^<]*)</", text)
        return found.group(1) if found else ""

    async def remove_from_container(self, *, endpoint: str, service_name: str,
                                    container_id: str, indices: list[int],
                                    household_id: str = "", token: str = "",
                                    key: str = "", device_id: str = "") -> None:
        """Take the rows at ``indices`` out of the playlist ``container_id``."""
        await self._call(
            endpoint, service_name, "removeFromContainer",
            f"<id>{escape(container_id)}</id><indices>{','.join(str(i) for i in indices)}</indices>"
            "<updateId></updateId>",
            household_id=household_id, token=token, key=key, device_id=device_id)

    async def rate_item(self, *, endpoint: str, service_name: str, item_id: str,
                        rating: int, household_id: str = "", token: str = "",
                        key: str = "", device_id: str = "") -> "RateResult":
        """Rate an item with one of the ratings the provider's presentation map
        defines (Pandora: 1 thumbs up, 2 thumbs down).

        The answer carries the provider's dynamic decisions, both optional:
        ``shouldSkip`` (move on to the next track now, as a ban does) and
        ``messageStringId`` (a string id from its strings file to show
        instead of the map's OnSuccess text, e.g. why it skipped).
        """
        body = f"<id>{escape(item_id)}</id><rating>{int(rating)}</rating>"
        text = await self._call(endpoint, service_name, "rateItem", body,
                                household_id=household_id, token=token, key=key,
                                device_id=device_id)
        return parse_rate_result(text or "")

    # -- linking an account -----------------------------------------------------
    #
    # Sonos' own controllers link a service with a code: the provider issues a
    # short code and a registration URL, the person signs in there and enters
    # the code, and the controller polls until the provider hands back a token
    # and key. Those two strings, stored on the household with
    # SystemProperties#AddOAuthAccountX, are the account. Providers whose
    # policy is DeviceLink offer this directly; AppLink providers, meant to be
    # brokered by Sonos' app, usually include the same code-entry details in
    # their getAppLink answer, so both are tried.

    async def get_device_link_code(self, *, endpoint: str, service_name: str,
                                   household_id: str, device_id: str = "") -> dict:
        body = f"<householdId>{escape(household_id)}</householdId>"
        text = await self._call(endpoint, service_name, "getDeviceLinkCode",
                                body, household_id=household_id, device_id=device_id)
        return self._link_details(text)

    async def get_app_link(self, *, endpoint: str, service_name: str,
                           household_id: str, device_id: str = "") -> dict:
        # The callback is where the provider sends the browser once the person
        # has signed in. Sonora does not receive it (the token is fetched by
        # polling getDeviceAuthToken with the link code), but some providers
        # reject an empty or arbitrary callback: deliver.media requires the
        # "sonos://" app scheme and Soundtrack requires any non-empty value.
        # Sending the app scheme the real controller uses satisfies every
        # AppLink provider tested and breaks none.
        body = (
            f"<householdId>{escape(household_id)}</householdId>"
            "<hardware>Sonora</hardware>"
            "<osVersion>1.0</osVersion>"
            "<sonosAppName>Sonora</sonosAppName>"
            "<callbackPath>sonos://</callbackPath>"
        )
        text = await self._call(endpoint, service_name, "getAppLink", body,
                                household_id=household_id, device_id=device_id)
        return self._link_details(text)

    async def get_device_auth_token(self, *, endpoint: str, service_name: str,
                                    household_id: str, link_code: str,
                                    link_device_id: str = "",
                                    device_id: str = "") -> dict:
        """The token once the person has signed in; raises ``pending`` before."""
        body = (
            f"<householdId>{escape(household_id)}</householdId>"
            f"<linkCode>{escape(link_code)}</linkCode>"
        )
        if link_device_id:
            body += f"<linkDeviceId>{escape(link_device_id)}</linkDeviceId>"
        text = await self._call(endpoint, service_name, "getDeviceAuthToken",
                                body, household_id=household_id, device_id=device_id)
        root = _lenient_fromstring(text)
        out = {"token": "", "key": "", "nickname": ""}
        for node in root.iter():
            name = _local(node.tag)
            if name == "authToken" and node.text:
                out["token"] = node.text.strip()
            elif name == "privateKey" and node.text:
                out["key"] = node.text.strip()
            elif name == "nickname" and node.text:
                out["nickname"] = node.text.strip()
        if not out["token"]:
            raise SmapiError(service_name, "NoToken",
                             "the provider answered without a token")
        # Some device-link providers (iHeartRadio, for one) return only an
        # authToken and no privateKey; their login credentials then use that
        # same value as the key. So the token stands in for a missing key.
        if not out["key"]:
            out["key"] = out["token"]
        return out

    @staticmethod
    def _link_details(text: str) -> dict:
        root = _lenient_fromstring(text)
        out = {"reg_url": "", "link_code": "", "show_link_code": True,
               "device_id": "", "app_url_id": ""}
        for node in root.iter():
            name = _local(node.tag)
            value = (node.text or "").strip()
            if name == "regUrl" and value:
                out["reg_url"] = value
            elif name == "linkCode" and value:
                out["link_code"] = value
            elif name == "showLinkCode" and value:
                out["show_link_code"] = value.lower() == "true"
            elif name == "linkDeviceId" and value:
                out["device_id"] = value
            elif name == "appUrlStringId" and value:
                out["app_url_id"] = value
        return out

    async def _call(self, endpoint: str, service_name: str, action: str,
                    body: str, *, household_id: str = "", token: str = "",
                    key: str = "", device_id: str = "",
                    _retried: bool = False) -> str:
        try:
            return await self._call_once(endpoint, service_name, action, body,
                                         household_id=household_id, token=token,
                                         key=key, device_id=device_id)
        except SmapiError as exc:
            # A rotated token: store the pair the provider sent and try once
            # more with it. Only once, so a provider that keeps rotating cannot
            # loop the request.
            if _retried or not token:
                raise
            if exc.refresh is None:
                # Expired with no new pair in the fault: ask for one. SMAPI's
                # refreshAuthToken takes the old pair in the header and
                # answers with authToken and privateKey (or with the
                # TokenRefreshRequired fault that carries them). A provider
                # that will not refresh leaves the original error standing.
                # The idea came from a SoCo fork's SMAPI transport (SoCo, MIT).
                if not self._expired(exc) or action == "refreshAuthToken":
                    raise
                fresh = await self._ask_for_refresh(endpoint, service_name,
                                                    household_id, token, key, device_id)
                if fresh is None:
                    raise
                exc.refresh = fresh
            new_token, new_key = exc.refresh
            if self.on_token_refresh is not None:
                self.on_token_refresh(household_id, token, new_token, new_key or key)
            return await self._call(endpoint, service_name, action, body,
                                    household_id=household_id, token=new_token,
                                    key=new_key or key, device_id=device_id,
                                    _retried=True)

    async def _call_once(self, endpoint: str, service_name: str, action: str,
                         body: str, *, household_id: str = "", token: str = "",
                         key: str = "", device_id: str = "") -> str:
        header = self._credentials(household_id, token, key, device_id)
        envelope = (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
            f'<s:Header>{header}</s:Header>'
            f'<s:Body><{action} xmlns="{SMAPI_NS}">{body}</{action}>'
            "</s:Body></s:Envelope>"
        )
        headers = {
            "Content-Type": 'text/xml; charset="utf-8"',
            "SOAPAction": f'"{SMAPI_NS}#{action}"',
            # The reader's own locale: a service's labels, its strings table
            # and the message after a rating all come back in whatever the
            # call asks for (BCP 47, from the browser's own header).
            "Accept-Language": locales.current(),
        }
        # A link's polls are small and frequent, and a person is watching them:
        # a stalled one should give way to the next, not hold it for the full
        # timeout (Mixcloud, 2026-09-28).
        timeout = aiohttp.ClientTimeout(total=6) if action == "getDeviceAuthToken" else self._timeout
        for attempt in (1, 2):
            try:
                async with self._session.post(
                    endpoint, data=envelope.encode("utf-8"), headers=headers,
                    timeout=timeout,
                ) as resp:
                    text = await resp.text()
                    _dump(service_name, action, body, text)
                    # Some providers answer a fault with HTTP 200 (Bandcamp's
                    # NOT_LINKED_RETRY arrives that way), so the body is checked
                    # for one regardless of the status.
                    if resp.status >= 400 or _is_fault(text):
                        raise self._fault(service_name, text, resp.status)
                return text
            except SmapiError:
                raise
            except (aiohttp.ServerDisconnectedError, aiohttp.ClientOSError) as exc:
                # A kept-alive connection the provider had already closed:
                # "Connection reset by peer" on the reuse. Once more, on a
                # fresh connection, before calling it a failure.
                if attempt == 1:
                    continue
                raise SmapiError(service_name, "Transport", str(exc)) from exc
            except (aiohttp.ClientError, TimeoutError) as exc:
                raise SmapiError(service_name, "Transport", str(exc)) from exc
        raise SmapiError(service_name, "Transport", "no answer")

    @staticmethod
    def _expired(exc: "SmapiError") -> bool:
        blob = f"{exc.code} {exc.detail}"
        return "TokenRefreshRequired" in blob or "AuthTokenExpired" in blob

    async def _ask_for_refresh(self, endpoint: str, service_name: str,
                               household_id: str, token: str, key: str,
                               device_id: str) -> tuple[str, str] | None:
        try:
            text = await self._call_once(endpoint, service_name, "refreshAuthToken", "",
                                         household_id=household_id, token=token,
                                         key=key, device_id=device_id)
        except SmapiError as again:
            return again.refresh
        new_token = new_key = ""
        for node in _lenient_fromstring(text).iter():
            name = _local(node.tag)
            if name == "authToken" and node.text:
                new_token = node.text.strip()
            elif name == "privateKey" and node.text:
                new_key = node.text.strip()
        if not new_token:
            return None
        log.info("%s gave a fresh login after an expired one", service_name)
        return new_token, new_key or key

    @staticmethod
    def _credentials(household_id: str, token: str, key: str,
                     device_id: str = "") -> str:
        # The credentials header identifies the controller by a device id. The
        # supported value is the household's R_TrialZPSerial (e.g.
        # "C4-38-75-00-00-A7:6"); the household id is only a fallback for the
        # anonymous case where the field is ignored.
        parts = [f'<deviceProvider>{DEVICE_PROVIDER}</deviceProvider>']
        ident = device_id or household_id
        if ident:
            parts.insert(0, f"<deviceId>{escape(ident)}</deviceId>")
        if token and key:
            parts.append(
                "<loginToken>"
                f"<token>{escape(token)}</token>"
                f"<key>{escape(key)}</key>"
                f"<householdId>{escape(household_id)}</householdId>"
                "</loginToken>"
            )
        return (f'<credentials xmlns="{SMAPI_NS}">'
                f'{"".join(parts)}</credentials>')

    def _filtered(self, page: SmapiPage, household_id: str) -> SmapiPage:
        """The page without the items the service itself marks explicit.

        The household's own switch decides whether this happens; what it acts
        on is the service's marking, so one rule covers every service that
        marks anything and a service that says nothing is left alone. The
        counts are left as the service stated them: they describe its list,
        not this page, and a reader paging through wants the service's own
        indices to keep meaning what they meant.
        """
        if not self.filters(household_id):
            return page
        kept = [item for item in page.items if item.explicit is not True]
        if len(kept) != len(page.items):
            log.info("content filtering dropped %d of %d items",
                     len(page.items) - len(kept), len(page.items))
            page.items = kept
        return page

    def filters(self, household_id: str) -> bool:
        """Whether this household's browsing should be filtered.

        The envelope carries nothing about it. The desktop core names a SMAPI
        "context header" holding ``timeZone`` and ``contentFiltering``, and a
        ``<context>`` element in the SMAPI namespace was the obvious reading
        -- but it is wrong, or at least not what the services accept. Sent to
        all 102 configured services on 2026-09-17, a context header of any
        shape (filtering alone, with a time zone, either order, with or
        without the namespace) made Deezer fault
        ``Client.ServiceUnavailable`` with the single word "context" as its
        detail, and turned Amazon Music's error from LoginInvalid into
        ServiceUnknownError. Every other service was unmoved. A header that
        breaks a service that works is worse than no header, so none is sent
        until its real shape is known.

        The flag is kept here all the same: it is what the browse layer asks
        before deciding whether to drop the items a service itself marks
        explicit, which is filtering Sonora can do by the same rule for every
        service.
        """
        if self.content_filtering is None or not household_id:
            return False
        try:
            return bool(self.content_filtering(household_id))
        except Exception:  # noqa: BLE001 - never fail a browse over this
            return False

    @staticmethod
    def _fault(service: str, text: str, status: int) -> SmapiError:
        code, detail = f"HTTP {status}", ""
        sonos_error: int | None = None
        new_token, new_key = "", ""
        try:
            root = _lenient_fromstring(text)
            for node in root.iter():
                name = _local(node.tag)
                # <refreshAuthTokenResult><authToken/><privateKey/></...>
                # rides in the detail of a Client.TokenRefreshRequired fault.
                if name == "authToken" and node.text:
                    new_token = node.text.strip()
                elif name == "privateKey" and node.text:
                    new_key = node.text.strip()
                elif name in ("faultcode", "Code", "Value") and node.text:
                    code = node.text.strip()
                elif name in ("faultstring", "Reason", "Text") and node.text:
                    detail = node.text.strip()
                elif name == "SonosError" and node.text:
                    detail = f"SonosError {node.text.strip()}"
                    try:
                        sonos_error = int(node.text.strip())
                    except ValueError:
                        pass
        except Exception:
            detail = text[:160]
        return SmapiError(service, code, detail, sonos_error,
                          refresh=(new_token, new_key) if new_token else None)

    @staticmethod
    def _parse(text: str) -> SmapiPage:
        root = _lenient_fromstring(text)
        page = SmapiPage()
        for node in root.iter():
            name = _local(node.tag)
            if name == "getMetadataResult":
                page.index = int(node.findtext("./{*}index", "0") or 0)
                page.count = int(node.findtext("./{*}count", "0") or 0)
                page.total = int(node.findtext("./{*}total", "0") or 0)
            elif name in ("mediaCollection", "mediaMetadata"):
                page.items.append(SmapiClient._item(node, name))
            elif name == "getMediaMetadataResult":
                # getMediaMetadata answers with the item's fields directly in
                # the result, with no mediaMetadata wrapper (Pocket Casts,
                # 2026-09-06), so the result element IS the item.
                page.items.append(SmapiClient._item(node, "mediaMetadata"))
        return page

    @staticmethod
    def _item(node, kind: str) -> SmapiItem:
        def text(tag: str) -> str:
            found = node.find(f"./{{*}}{tag}")
            return (found.text or "").strip() if found is not None else ""

        item_type = text("itemType")
        art = text("albumArtURI")
        track = node.find("./{*}trackMetadata")
        artist = album = ""
        duration = 0
        # A stream carries neither albumArtURI nor trackMetadata: its art is
        # <streamMetadata><logo> and its second line is the show on air.
        # 80s80s answers getMetadata that way for all 42 of its stations, so
        # without this every row came back with no art.
        stream = node.find("./{*}streamMetadata")
        stream_show = ""
        if stream is not None:
            def smeta(tag: str) -> str:
                found = stream.find(f"./{{*}}{tag}")
                return (found.text or "").strip() if found is not None else ""
            if not art:
                art = smeta("logo")
            stream_show = smeta("currentShow") or smeta("currentHost")
        if track is not None:
            def tmeta(tag: str) -> str:
                found = track.find(f"./{{*}}{tag}")
                return (found.text or "").strip() if found is not None else ""
            artist = tmeta("artist")
            album = tmeta("album")
            if not art:
                art = tmeta("albumArtURI")
            try:
                duration = int(tmeta("duration") or 0)
            except ValueError:
                duration = 0

        # A collection (album, playlist) names its artist directly, as the
        # SMAPI mediaCollection does; the apps show it under the title.
        if not artist:
            artist = text("artist")
        artist_id = text("artistId") or (tmeta("artistId") if track is not None else "")
        album_id = text("albumId") or (tmeta("albumId") if track is not None else "")
        said = text("canAddToFavorites") or (tmeta("canAddToFavorites") if track is not None else "")
        can_favorite = (said.lower() == "true") if said else None
        # Explicit, however the service chooses to say it. Both shapes seen
        # on the wire are booleans: a tags/explicit of 0 or 1, and an
        # isExplicit of true or false. Read by local name so a namespaced
        # answer (Spotify's ns2:) counts the same as a bare one.
        explicit: bool | None = None
        for tag in ("tags/explicit", "isExplicit"):
            found = node.find("./" + "/".join(f"{{*}}{part}" for part in tag.split("/")))
            said = (found.text or "").strip().lower() if found is not None else ""
            if said in ("1", "true"):
                explicit = True
                break
            if said in ("0", "false"):
                explicit = False
        properties: dict[str, str] = {}
        for prop in node.findall("./{*}dynamic/{*}property"):
            name = (prop.findtext("./{*}name") or "").strip()
            if name:
                properties[name] = (prop.findtext("./{*}value") or "").strip()
        return SmapiItem(
            id=text("id"),
            title=prose(text("title")),
            item_type=item_type,
            art=art,
            # A service can refuse a single track while handing it over in a
            # list: Mixcloud marks its subscriber-only shows
            # <trackMetadata><canPlay>false</canPlay>, and the web client
            # draws those rows at a fifth of the brightness of the rest
            # (measured 2026-09-22). The flag is read wherever it is put, and
            # a stated "false" outweighs the assumption that a piece of
            # mediaMetadata is playable. Nothing here is per-service: any
            # service that says it gets the same answer.
            can_play=_can_play(text("canPlay"),
                               tmeta("canPlay") if track is not None else "",
                               kind),
            can_enumerate=(text("canEnumerate") == "true") if text("canEnumerate") else None,
            is_container=kind == "mediaCollection",
            mime_type=text("mimeType"),
            artist=prose(artist),
            album=prose(album),
            duration=duration,
            summary=prose(text("summary")),
            stream_show=prose(stream_show),
            semantic_type=text("semanticType"),
            podcast=text("podcast") or (tmeta("podcast") if track is not None else ""),
            release_date=text("releaseDate") or (tmeta("releaseDate") if track is not None else ""),
            podcast_id=text("podcastId") or (tmeta("podcastId") if track is not None else ""),
            producer=prose((text("producer") or (tmeta("producer") if track is not None else "")).strip()),
            author=prose(text("author") or (tmeta("author") if track is not None else "")),
            narrator=prose(text("narrator") or (tmeta("narrator") if track is not None else "")),
            book=prose(text("book") or (tmeta("book") if track is not None else "")),
            artist_id=artist_id,
            album_id=album_id,
            can_add_to_favorites=can_favorite,
            display_type=text("displayType"),
            explicit=explicit,
            properties=properties,
            # Spotify says it as attributes of the mediaCollection --
            # readOnly="false" on a playlist its user may add to, "true" on
            # one they only follow (2026-09-24) -- where SMAPI's schema also
            # allows child elements.
            editable=(not _flag(node.get("readOnly"))) if node.get("readOnly") is not None
                     else _flag(text("isEditable")),
            user_content=_flag(node.get("userContent") or text("userContent") or text("isUserContent")),
        )
