"""DIDL-Lite metadata, the format Sonos carries content in.

Every track, album, playlist, and radio station arrives as a DIDL-Lite
document, and outgoing commands that set a transport URI have to supply one
too. The dialect is mostly standard UPnP with Sonos additions in the ``r:``
namespace, and it is not always well formed, so parsing is deliberately
forgiving.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html import unescape
from urllib.parse import quote, unquote
from xml.sax.saxutils import escape as _escape

import xml.etree.ElementTree as ET
from defusedxml import ElementTree as DET

from .const import NS, SONOS_PORT


def escape(text: str) -> str:
    """Escape text for XML, quotes included, so it is safe in an attribute too."""
    return _escape(text, {'"': "&quot;", "'": "&apos;"})


def proxied(url: str) -> str:
    """A speaker URL, routed through Sonora so the browser need not reach it.

    Matches ``cachedArt`` in the frontend, which wraps the same way for the
    art it builds itself; both are idempotent, so wrapping twice is harmless.
    """
    if not url or url.startswith("/api/art?"):
        return url
    return "/api/art?u=" + quote(url, safe="")


#: Object classes seen on a live household, mapped to something a user
#: interface can branch on without knowing UPnP.
CLASS_KINDS = {
    "object.item.audioItem.musicTrack": "track",
    # A podcast episode in the queue: the apps' row menu reads Play Episode /
    # Remove Episode for it (Amazon Music episode, 2026-09-07).
    "object.item.audioItem.podcast": "podcast",
    # An audiobook chapter (the class sclib writes for one; its DIDL carries
    # r:narrator and r:book beside dc:creator).
    "object.item.audioItem.audioBook": "audiobook",
    "object.item.audioItem.audioBroadcast": "station",
    "object.item.audioItem": "audio",
    "object.container.album.musicAlbum": "album",
    "object.container.person.musicArtist": "artist",
    "object.container.person.composer": "composer",
    "object.container.genre.musicGenre": "genre",
    "object.container.playlistContainer": "playlist",
    "object.container.playlistContainer.sameArtist": "artist_tracks",
    "object.container.albumlist": "album_list",
    "object.container.storageFolder": "folder",
    "object.container": "container",
    "object.itemobject.item.sonos-favorite": "favorite",
}


def kind_for_class(upnp_class: str) -> str:
    """Reduce a UPnP class string to a coarse kind.

    Sonos invents subclasses freely, so the longest known prefix wins rather
    than requiring an exact match.
    """
    best = ""
    for known in CLASS_KINDS:
        if upnp_class.startswith(known) and len(known) > len(best):
            best = known
    if best:
        return CLASS_KINDS[best]
    return "container" if ".container" in upnp_class else "item"


@dataclass(slots=True)
class DidlItem:
    """One entry from a browse result or a track in a queue."""

    id: str
    parent_id: str = ""
    title: str = ""
    upnp_class: str = ""
    uri: str = ""
    art_uri: str = ""
    creator: str = ""
    artist: str = ""
    album: str = ""
    album_artist: str = ""
    genre: str = ""
    track_number: int | None = None
    duration: str = ""
    description: str = ""
    #: A Sonos Favorite's own r:type. An S2 household keeps its pinned
    #: collections in FV:2 beside its favorites, typed "shortcut" where a
    #: favorite is "instantPlay"; the S2 apps draw them as Pinned collection
    #: rows and leave them out of Sonos Favorites (Plex's "Music" and
    #: "Recently Added in Music", 2026-09-22).
    favorite_type: str = ""
    #: The speaker's own r:tags bitmask, whose 1 bit is explicit. A queued
    #: Spotify track carries <r:tags>1</r:tags> for Dr. Dre's "2001", and the
    #: product badges those rows in its queue (2026-09-22). None where the
    #: entry has no tags at all.
    explicit: bool | None = None
    #: What a radio stream is announcing right now, from ``r:streamContent``.
    #: This is where a station's current track text lives; ``description`` is
    #: a different field and stays empty for these (measured 2026-09-06 on
    #: 80s80s, whose track metadata carries "Sade - Is It a Crime" here).
    stream_content: str = ""
    #: Audiobook fields, when the item is a chapter.
    narrator: str = ""
    book: str = ""
    #: The show a station says is on air, from ``r:radioShowMd``. 80s80s
    #: sends none, which is why the app's "On Now" line reads empty there.
    #: The field arrives as "<show>,<show id>" -- TuneIn sends "Marci
    #: Wiser,p1151215" -- and the apps print only the name, so the id is
    #: kept apart (2026-09-07).
    stream_show: str = ""
    #: The provider's id for that show, from the same field. It is what
    #: "Add to My Radio Shows" saves.
    stream_show_id: str = ""
    #: Sonos' opaque descriptor needed to enqueue an item from a service.
    resource_metadata: str = ""
    #: The item's own DIDL-Lite, as the speaker reported it. Kept because a
    #: saved-queue write has to hand back metadata in exactly this shape: the
    #: speaker records title, artist, album, and duration from it, and builds
    #: nothing from a document we compose ourselves (tried 2026-09-06).
    raw_xml: str = ""
    #: Sonos' rating on a playing item (NONE, THUMBSUP, THUMBSDOWN) and the
    #: provider item id it rates by, both from the ``r:`` extensions.
    rating: str = ""
    tiid: str = ""
    restricted: bool = True
    child_count: int | None = None
    protocol_info: str = ""

    @property
    def kind(self) -> str:
        return kind_for_class(self.upnp_class)

    @property
    def is_container(self) -> bool:
        return ".container" in self.upnp_class

    @property
    def display_artist(self) -> str:
        """Whichever artist field is populated, preferring the specific one."""
        return self.artist or self.album_artist or self.creator

    def art_url(self, host: str) -> str:
        """Album art, as a URL the browser can actually fetch.

        Art references are usually paths relative to the speaker that served
        them, so they need a host attached. But the browser is not required to
        be able to reach the speakers -- Sonora is the thing on their network,
        and a phone on mobile data or a guest network is a supported way to use
        it -- so the address is wrapped in Sonora's own art proxy rather than
        handed over raw. A speaker that a browser cannot route to does not
        refuse the request, it swallows it until the connection times out, so
        this is the difference between art that is slow and a page that hangs.

        A provider's own https URL is left alone: it is not on the speakers'
        network, and the proxy has nothing to add to it.
        """
        if not self.art_uri:
            return ""
        if self.art_uri.startswith(("http://", "https://")):
            return self.art_uri
        return proxied(f"http://{host}:{SONOS_PORT}{self.art_uri}")

    def as_dict(self, host: str = "") -> dict:
        return {
            "id": self.id,
            "parent_id": self.parent_id,
            "title": self.title,
            "kind": self.kind,
            "is_container": self.is_container,
            "uri": self.uri,
            "art": self.art_url(host) if host else self.art_uri,
            "artist": self.display_artist,
            "album": self.album,
            "album_artist": self.album_artist,
            "genre": self.genre,
            "track_number": self.track_number,
            "duration": self.duration,
            "description": self.description,
            "favorite_type": self.favorite_type,
            "explicit": self.explicit,
            "narrator": self.narrator,
            "book": self.book,
            "metadata": self.resource_metadata,
            "child_count": self.child_count,
        }


#: Extensions Sonos will leave in a title when it had nothing better to use.
_MEDIA_SUFFIXES = (
    ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".wma",
    ".aiff", ".alac", ".m3u", ".m3u8", ".pls",
)


def clean_title(title: str) -> str:
    """Tidy a title that is really a filename.

    When a source supplies no metadata, Sonos falls back to the last path
    segment of the URI, which can arrive as
    ``6d92e3.mp3?authSig=eyJhbGciOi...``. Showing that to a person is worse
    than showing nothing, so the query string and extension come off and
    percent-escapes are decoded.
    """
    if not title:
        return title
    candidate = title.split("?", 1)[0].strip()
    lowered = candidate.casefold()
    for suffix in _MEDIA_SUFFIXES:
        if lowered.endswith(suffix):
            candidate = candidate[: -len(suffix)]
            break
    else:
        # No media extension, so this is a real title and must not be touched.
        return title
    candidate = unquote(candidate).strip()
    # A bare identifier is not worth showing; an empty string lets the
    # interface fall back to the stream or source name instead.
    if not candidate or _looks_like_identifier(candidate):
        return ""
    return candidate


def _looks_like_identifier(value: str) -> bool:
    """Whether a string is a machine identifier rather than a name."""
    if value.startswith("RINCON_"):
        return True
    stripped = value.replace("-", "").replace("_", "")
    return len(stripped) >= 16 and all(
        c in "0123456789abcdefABCDEF" for c in stripped)


def parse_didl(payload: str) -> list[DidlItem]:
    """Parse a DIDL-Lite document into items, in document order."""
    text = (payload or "").strip()
    if not text:
        return []
    if not text.startswith("<"):
        text = unescape(text)
    try:
        root = DET.fromstring(text)
    except Exception:
        return []

    items: list[DidlItem] = []
    for node in root:
        tag = node.tag.rsplit("}", 1)[-1]
        if tag not in ("item", "container"):
            continue
        items.append(_parse_node(node))
    return items


def _explicit_tag(value: str) -> bool | None:
    """The explicit bit of an r:tags bitmask, or None where there is none."""
    try:
        return bool(int(value) & 1) if value else None
    except ValueError:
        return None


def _parse_node(node) -> DidlItem:
    def text_of(path: str) -> str:
        found = node.find(path, NS)
        return (found.text or "").strip() if found is not None else ""

    resource = node.find("didl:res", NS)
    child_count = node.get("childCount")
    track_raw = text_of("upnp:originalTrackNumber")

    return DidlItem(
        id=node.get("id", ""),
        parent_id=node.get("parentID", ""),
        restricted=node.get("restricted", "true") == "true",
        title=text_of("dc:title"),
        upnp_class=text_of("upnp:class"),
        uri=(resource.text or "").strip() if resource is not None else "",
        protocol_info=resource.get("protocolInfo", "") if resource is not None else "",
        art_uri=text_of("upnp:albumArtURI"),
        creator=text_of("dc:creator"),
        artist=text_of("r:artist") or text_of("dc:creator"),
        album=text_of("upnp:album"),
        album_artist=text_of("r:albumArtist"),
        genre=text_of("upnp:genre"),
        track_number=int(track_raw) if track_raw.isdigit() else None,
        duration=resource.get("duration", "") if resource is not None else "",
        description=text_of("r:description") or text_of("dc:description"),
        favorite_type=text_of("r:type"),
        explicit=_explicit_tag(text_of("r:tags")),
        stream_content=text_of("r:streamContent"),
        narrator=text_of("r:narrator"),
        book=text_of("r:book"),
        stream_show=_show_name(text_of("r:radioShowMd")),
        stream_show_id=_show_id(text_of("r:radioShowMd")),
        resource_metadata=text_of("r:resMD"),
        rating=text_of("r:rating/r:type"),
        tiid=text_of("r:tiid"),
        child_count=int(child_count) if child_count and child_count.isdigit() else None,
        raw_xml=_serialize(node),
    )


#: ``r:radioShowMd`` is the show's name, a comma, then the provider's id for
#: it ("Marci Wiser,p1151215"). The id has no spaces and ends in digits,
#: which is what tells it from a name that happens to hold a comma.
_SHOW_ID = re.compile(r"^[A-Za-z]{0,3}\d+$")


def _show_name(value: str) -> str:
    name, sep, tail = value.rpartition(",")
    # The id can be missing and the comma still there: Community Radio Plus
    # publishes "Your family-friendly radio station," and the app prints the
    # show without the trailing comma.
    if sep and (not tail.strip() or _SHOW_ID.match(tail.strip())):
        return name.strip()
    return value.strip()


def _show_id(value: str) -> str:
    name, sep, tail = value.rpartition(",")
    return tail.strip() if sep and name and _SHOW_ID.match(tail.strip()) else ""


def _serialize(node) -> str:
    """One DIDL item back as a standalone document.

    Serialization only, so the standard library's writer is used with the
    four DIDL prefixes registered; parsing stays with defusedxml above.
    """
    for prefix in ("didl", "dc", "upnp", "r"):
        ET.register_namespace("" if prefix == "didl" else prefix, NS[prefix])
    return ("<DIDL-Lite "
            + " ".join(f'xmlns{"" if p == "didl" else ":" + p}="{NS[p]}"'
                       for p in ("didl", "dc", "upnp", "r"))
            + ">" + ET.tostring(node, encoding="unicode") + "</DIDL-Lite>")


def build_didl(
    *,
    item_id: str,
    parent_id: str,
    title: str,
    upnp_class: str,
    uri: str = "",
    desc_token: str = "",
) -> str:
    """Construct the DIDL-Lite a speaker expects when handed a URI.

    Sonos will not play a service URI without accompanying metadata naming the
    service, which is what ``desc_token`` carries.
    """
    resource = f"<res>{escape(uri)}</res>" if uri else ""
    desc = (f'<desc id="cdudn" '
            f'nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">'
            f"{escape(desc_token)}</desc>") if desc_token else ""
    return (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
        'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        f'<item id="{escape(item_id)}" parentID="{escape(parent_id)}" '
        f'restricted="true">'
        f"<dc:title>{escape(title)}</dc:title>"
        f"<upnp:class>{escape(upnp_class)}</upnp:class>"
        f"{resource}{desc}"
        "</item></DIDL-Lite>"
    )


def saved_queue_didl(object_id: str, item: DidlItem) -> str:
    """The metadata a Sonos playlist needs when a track is appended to it.

    A saved queue does not read the title, artist and album out of the
    document's own tags: it reads them out of the item's *id*, which the
    players write as ``<playlist>/<escaped uri>:A<title>,<creator>,<album>,
    <seconds, ten digits>,<tags>``. Hand it a document whose id lacks that
    (a queue row's ``Q:0/1``, or anything we compose plainly) and the track
    lands with every field blank; hand it this shape and the row reads as it
    does in the app. Established against a real playlist on 2026-09-06.
    """
    if not item.uri:
        return ""
    def part(value: str) -> str:
        # The players write these escapes in lower case ("%3a", "%3f"), so
        # the ids we build read the same as the ones they build.
        return re.sub(r"%[0-9A-F]{2}", lambda m: m.group(0).lower(),
                      quote(value or "", safe=""))
    composite = (f"{object_id}/{part(item.uri)}:A{part(item.title)},"
                 f"{part(item.artist or item.creator)},{part(item.album)},"
                 f"{_seconds(item.duration):010d},1")
    duration = f' duration="{escape(item.duration)}"' if item.duration else ""
    resource = (f'<res protocolInfo="{escape(item.protocol_info)}"{duration}>'
                f"{escape(item.uri)}</res>")
    art = (f"<upnp:albumArtURI>{escape(item.art_uri)}</upnp:albumArtURI>"
           if item.art_uri else "")
    return (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
        'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        f'<item id="{escape(composite)}" parentID="{escape(object_id)}" '
        f'restricted="true">{resource}{art}'
        f"<dc:title>{escape(item.title)}</dc:title>"
        f"<upnp:class>{escape(item.upnp_class or 'object.item.audioItem.musicTrack')}</upnp:class>"
        f"<dc:creator>{escape(item.artist or item.creator)}</dc:creator>"
        f"<upnp:album>{escape(item.album)}</upnp:album>"
        "</item></DIDL-Lite>"
    )


def _seconds(duration: str) -> int:
    """"H:MM:SS" as a count of seconds; 0 for anything unparseable."""
    parts = (duration or "").split(":")
    total = 0
    try:
        for part in parts:
            total = total * 60 + int(float(part))
    except ValueError:
        return 0
    return total
