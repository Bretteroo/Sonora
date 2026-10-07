"""A Sonos Favorite's r:type survives parsing.

An S2 household keeps its pinned collections in FV:2 beside its favorites,
typed "shortcut"; the web theme leaves those out of Sonos Favorites, so the
type has to reach it (Plex's "Music" pinned on the S2 household, 2026-09-22).
"""
from backend.sonos.didl import parse_didl

FV2 = (
    '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
    'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
    'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
    '<item id="FV:2/1" parentID="FV:2" restricted="false"><dc:title>Music</dc:title>'
    '<upnp:class>object.itemobject.item.sonos-favorite</upnp:class><r:ordinal>0</r:ordinal>'
    '<res></res><r:type>shortcut</r:type><r:description>Plex</r:description></item>'
    '<item id="FV:2/2" parentID="FV:2" restricted="false"><dc:title>KIIS FM</dc:title>'
    '<upnp:class>object.itemobject.item.sonos-favorite</upnp:class>'
    '<res>x-sonosapi-stream:s33122?sid=254</res><r:type>instantPlay</r:type>'
    '<r:description>TuneIn Station</r:description></item>'
    '</DIDL-Lite>'
)


def test_a_pin_and_a_favorite_are_told_apart():
    pin, favorite = parse_didl(FV2)
    assert pin.favorite_type == "shortcut"
    assert favorite.favorite_type == "instantPlay"
    assert pin.as_dict("192.168.0.100")["favorite_type"] == "shortcut"


QUEUE = (
    '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
    'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
    'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
    '<item id="Q:0/25" parentID="Q:0" restricted="true"><dc:title>Lolo - Intro</dc:title>'
    '<upnp:class>object.item.audioItem.musicTrack</upnp:class><r:tags>1</r:tags></item>'
    '<item id="Q:0/26" parentID="Q:0" restricted="true"><dc:title>So What</dc:title>'
    '<upnp:class>object.item.audioItem.musicTrack</upnp:class><r:tags>0</r:tags></item>'
    '<item id="Q:0/27" parentID="Q:0" restricted="true"><dc:title>Untagged</dc:title>'
    '<upnp:class>object.item.audioItem.musicTrack</upnp:class></item>'
    '</DIDL-Lite>'
)


def test_a_queued_track_says_whether_it_is_explicit():
    explicit, clean, silent = parse_didl(QUEUE)
    assert (explicit.explicit, clean.explicit, silent.explicit) == (True, False, None)
