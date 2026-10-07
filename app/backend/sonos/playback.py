"""Playable form of a music-service item.

A speaker cannot play a SMAPI item from its id alone. Every Sonos controller
hands it a URI in one of Sonos' own schemes, carrying the service id and the
account's serial number on the speaker, plus a DIDL-Lite description whose
``desc`` element names the account to authenticate the fetch with. The speaker
then calls the service's ``getMediaURI`` itself. This module builds both.

The shapes follow what Sonos' own controllers and the reverse-engineered
libraries (SoCo, node-sonos-ts) send, which the speakers have accepted for
years:

- a track: ``x-sonos-http:<id>.<ext>?sid=<sid>&flags=8224&sn=<sn>``
- a station (stream): ``x-sonosapi-stream:<id>?sid=<sid>&flags=8224&sn=<sn>``
- a program (radio): ``x-sonosapi-radio:<id>?sid=<sid>&flags=8300&sn=<sn>``
- a playable container: ``x-rincon-cpcontainer:<prefix><id>?sid=<sid>&flags=8300&sn=<sn>``

The DIDL item id carries a type prefix Sonos uses to pick the right handler,
and ``desc`` is ``SA_RINCON<type>_X_#Svc<type>-0-Token``, where the type is
``sid * 256 + 7``, the same relationship the household's registrations show.
"""

from __future__ import annotations

import urllib.parse

from .didl import escape
from .smapi import SmapiItem

_DIDL_NS = (
    'xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
    'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
    'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"'
)

#: The media types that mean "this is an HLS playlist, not a file". A service
#: that answers with one of these wants the hls-static scheme and no extension:
#: Mixcloud describes every cloudcast as application/vnd.apple.mpegurl, and the
#: Windows app duly queues x-sonosapi-hls-static:cloudcast%3a... for it. Handed
#: the x-sonos-http: form instead, a player takes the track, reports Play, and
#: then sits silent.
_HLS_TYPES = {
    "application/vnd.apple.mpegurl", "application/x-mpegurl",
    "audio/mpegurl", "audio/x-mpegurl",
}

#: File extension by MIME type, for the track scheme.
_EXT = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "mp4",
    "audio/aac": "mp4", "audio/x-m4a": "mp4", "audio/flac": "flac",
    "audio/x-flac": "flac", "audio/ogg": "ogg", "audio/x-ms-wma": "wma",
    "audio/wav": "wav", "audio/x-wav": "wav",
}

#: DIDL id prefix and class per playable container kind.
_CONTAINERS = {
    "album": ("0004206c", "object.container.album.musicAlbum"),
    "albumList": ("000d206c", "object.container.albumlist"),
    "playlist": ("0006206c", "object.container.playlistContainer"),
    "artistTrackList": ("100f006c", "object.container.playlistContainer"),
    "show": ("1006206c", "object.container.playlistContainer"),
    "audiobook": ("1006206c", "object.container.playlistContainer"),
}


def playable(item: SmapiItem, sid: int, sn: str, *,
             for_favorite: bool = False, udn: str = "") -> tuple[str, str] | None:
    """The (uri, metadata) a speaker plays this item with, or None.

    ``sn`` is the account's serial number on the speaker (the registration's
    account id; "0" for an account-less service). ``udn`` is the descriptor
    the speakers know that account by, where the household's own list has it;
    without one the common ``X_#Svc<type>-0-Token`` form is composed, which
    is right for most accounts and wrong for an anonymous one. None when the
    item is not something the speakers can be told to play directly.

    ``for_favorite`` builds the same reference for a container the provider
    marks unplayable. The apps let such a row be saved as a Sonos Favorite --
    AccuRadio's "Most Popular Channels" and its like -- and the favorite
    then opens the container rather than playing it (seen 2026-09-06).
    """
    if not item.can_play and not (for_favorite and item.is_container):
        return None
    stype = (sid << 8) | 7
    qid = urllib.parse.quote(item.id, safe="")
    kind = item.item_type or ("container" if item.is_container else "track")
    query = f"sid={sid}&flags={{flags}}&sn={sn}"

    if item.is_container:
        if kind == "program":
            uri = f"x-sonosapi-radio:{qid}?" + query.format(flags=8300)
            did, cls = f"000c206c{qid}", "object.item.audioItem.audioBroadcast"
            tag = "item"
        elif kind == "audiobook":
            # The reference the Windows app hands the player for a book, read
            # back from a speaker it had set playing (Libby by OverDrive,
            # 2026-09-08): prefix 1013606c, flags 24684, described as an
            # audioBook ITEM with the author as creator. Sonora's playlist
            # container form for the same id drew UPnP 714 "unrecognized URI".
            uri = f"x-rincon-cpcontainer:1013606c{qid}?" + query.format(flags=24684)
            did, cls, tag = f"1013606c{qid}", "object.item.audioItem.audioBook", "item"
        else:
            prefix, cls = _CONTAINERS.get(kind, ("1006206c",
                                                 "object.container.playlistContainer"))
            uri = f"x-rincon-cpcontainer:{prefix}{qid}?" + query.format(flags=8300)
            did, tag = f"{prefix}{qid}", "container"
    elif kind == "stream":
        uri = f"x-sonosapi-stream:{qid}?" + query.format(flags=8224)
        did, cls, tag = f"F00092020{qid}", "object.item.audioItem.audioBroadcast", "item"
    elif kind == "program":
        uri = f"x-sonosapi-radio:{qid}?" + query.format(flags=8300)
        did, cls, tag = f"000c206c{qid}", "object.item.audioItem.audioBroadcast", "item"
    else:  # a track, episode or other single audio item
        mime = (item.mime_type or "").split(";")[0].strip().lower()
        if mime in _HLS_TYPES:
            uri = f"x-sonosapi-hls-static:{qid}?" + query.format(flags=8224)
        else:
            ext = _EXT.get(mime, "mp3")
            uri = f"x-sonos-http:{qid}.{ext}?" + query.format(flags=8224)
        did, cls, tag = f"00032020{qid}", "object.item.audioItem.musicTrack", "item"

    extra = ""
    if kind == "audiobook":
        author = item.author or item.artist
        if author:
            extra += f"<dc:creator>{escape(author)}</dc:creator>"
        if item.art:
            extra += f"<upnp:albumArtURI>{escape(item.art)}</upnp:albumArtURI>"
    metadata = (
        f'<DIDL-Lite {_DIDL_NS}>'
        f'<{tag} id="{escape(did)}" parentID="0" restricted="true">'
        f'<dc:title>{escape(item.title)}</dc:title>'
        f'<upnp:class>{cls}</upnp:class>'
        f'{extra}'
        f'<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">'
        f'{escape(udn or f"SA_RINCON{stype}_X_#Svc{stype}-0-Token")}</desc>'
        f'</{tag}></DIDL-Lite>'
    )
    return uri, metadata


def station_didl(uri: str, title: str, udn: str = "") -> str:
    """Metadata for a service station URI that arrived without any.

    The speakers' saved radio list (``R:0/0``) hands back stations with an
    empty ``r:resMD``, so playing one straight from that list sends no
    metadata at all and the player answers UPnP 402 Invalid Args. The apps
    compose the descriptor themselves from the URI, which is all it takes:
    the service type in ``sid`` names the account descriptor, and the object
    id is the encoded stream id (measured 2026-09-06 against TuneIn's own
    favorites, whose stored metadata has exactly this shape).
    """
    scheme, _, rest = uri.partition(":")
    ident, _, query = rest.partition("?")
    params = urllib.parse.parse_qs(query)
    try:
        sid = int((params.get("sid") or ["0"])[0])
    except ValueError:
        return ""
    if not sid or scheme not in ("x-sonosapi-stream", "x-sonosapi-radio",
                                 "x-sonosapi-hls"):
        return ""
    stype = (sid << 8) | 7
    prefix = "F00092020" if scheme == "x-sonosapi-stream" else "000c206c"
    did = f"{prefix}{ident}"
    return (
        f'<DIDL-Lite {_DIDL_NS}>'
        f'<item id="{escape(did)}" parentID="0" restricted="true">'
        f'<dc:title>{escape(title)}</dc:title>'
        f'<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>'
        f'<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">'
        f'{escape(udn or f"SA_RINCON{stype}_X_#Svc{stype}-0-Token")}</desc>'
        f'</item></DIDL-Lite>'
    )
