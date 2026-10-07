"""Event parsing, including the malformed XML speakers really send."""

from backend.sonos.events import parse_notify

RCS = (
    '<?xml version="1.0"?>'
    '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0"><e:property>'
    "<LastChange>"
    '&lt;Event xmlns="urn:schemas-upnp-org:metadata-1-0/RCS/"&gt;'
    '&lt;InstanceID val="0"&gt;'
    '&lt;Volume channel="Master" val="38"/&gt;'
    '&lt;Volume channel="LF" val="100"/&gt;'
    '&lt;Mute channel="Master" val="0"/&gt;'
    '&lt;Bass val="3"/&gt;'
    "&lt;/InstanceID&gt;&lt;/Event&gt;"
    "</LastChange></e:property></e:propertyset>"
)


def test_channel_values_are_split_out_and_master_promoted():
    event = parse_notify("10.0.0.1", "RenderingControl", RCS, seq=7)
    assert event.seq == 7
    assert event.properties["Volume"] == "38"
    assert event.properties["Bass"] == "3"
    assert event.channels["LF"]["Volume"] == "100"
    assert event.channels["Master"]["Mute"] == "0"


def test_direct_properties_without_lastchange():
    body = (
        '<?xml version="1.0"?>'
        '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">'
        "<e:property><UpdateID>12</UpdateID></e:property>"
        "<e:property><Curated>0</Curated></e:property>"
        "</e:propertyset>"
    )
    event = parse_notify("10.0.0.1", "Queue", body)
    assert event.properties == {"UpdateID": "12", "Curated": "0"}


def test_bare_ampersand_in_a_track_title_is_repaired():
    body = (
        '<?xml version="1.0"?>'
        '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0"><e:property>'
        "<LastChange>"
        '&lt;Event xmlns="urn:schemas-upnp-org:metadata-1-0/AVT/"&gt;'
        '&lt;InstanceID val="0"&gt;'
        '&lt;CurrentTrackURI val="x-sonos-http:t?sid=12&amp;sn=9"/&gt;'
        "&lt;/InstanceID&gt;&lt;/Event&gt;"
        "</LastChange></e:property></e:propertyset>"
    )
    event = parse_notify("10.0.0.1", "AVTransport", body)
    assert event.properties["CurrentTrackURI"] == "x-sonos-http:t?sid=12&sn=9"


def test_lastchange_never_leaks_as_an_empty_property():
    event = parse_notify("10.0.0.1", "AVTransport", RCS)
    assert "LastChange" not in event.properties


def test_filename_titles_are_cleaned_and_identifiers_dropped():
    from backend.sonos.didl import clean_title

    assert clean_title("Voices Carry") == "Voices Carry"
    assert clean_title("RINCON_542A1B0000B201400.mp3") == ""
    assert clean_title("6d92e3c132f50077da22052fcb324767.mp3?authSig=abc") == ""
    assert clean_title("Sealed%20With%20A%20Kiss.flac") == "Sealed With A Kiss"
    # A real title containing a question mark must survive untouched.
    assert clean_title("Where Did You Sleep Last Night?") == (
        "Where Did You Sleep Last Night?")


def test_uri_schemes_cover_third_party_lan_servers():
    from backend.sonos.models import TransportState

    cases = {
        "http://192.168.0.101:8097/x.flac": "http_stream",
        "x-sonos-spotify:spotify:track:abc?sid=12": "service_track",
        "x-rincon-mp3radio://http://host/stream": "radio",
        "x-sonos-vli:RINCON_1:2,spotify:xyz": "external_session",
        "x-rincon-queue:RINCON_1#0": "queue",
        "": "idle",
    }
    for uri, expected in cases.items():
        assert TransportState(track_uri=uri).source == expected, uri


def test_home_theater_is_detected_but_input_not_guessed():
    from backend.sonos.models import TransportState

    tv = TransportState(track_uri="x-sonos-htastream:RINCON_1:spdif")
    assert tv.is_home_theater and tv.source == "tv"
    # The :spdif URI token is fixed and must never become a displayed label:
    # an HDMI bar reports the same token, so a guess would be wrong.
    assert not hasattr(tv, "tv_input")
    assert not TransportState(track_uri="x-rincon-queue:RINCON_1#0").is_home_theater


GOOLARRI_TRACK = (
    '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
    'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
    'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
    '<item id="-1" parentID="-1" restricted="true">'
    '<res protocolInfo="x-rincon-mp3radio:*:*:*">'
    "x-rincon-mp3radio://https://firstnationsmedia.stream/8012/stream</res>"
    "<r:streamContent></r:streamContent><dc:title>stream</dc:title>"
    "<upnp:class>object.item</upnp:class></item></DIDL-Lite>"
)


def test_a_broadcast_titled_from_its_own_url_keeps_no_title():
    """Radio Goolarri (Community Radio Plus) as the speaker really reports it.

    The player names the track after the stream URL's last segment, so the
    DIDL reads <dc:title>stream</dc:title>. The room card must go on reading
    "Radio - Radio Goolarri" from the container, as the app's does.
    """
    from backend.sonos.controller import SonosController
    from backend.sonos.models import TransportState

    transport = TransportState(
        media_uri="x-sonosapi-stream:cbaa_svc_6GME?sid=330&flags=40&sn=10",
        track_uri="x-rincon-mp3radio://https://firstnationsmedia.stream/8012/stream",
        container_title="Radio Goolarri",
    )
    SonosController._apply_track_metadata(transport, GOOLARRI_TRACK)
    # The station's own name, which is what an event brings too.
    assert transport.title == "Radio Goolarri"


def test_a_stream_id_is_no_title():
    """Sonos Radio's BBC Radio 1 titles its track "bbc_radio_one", and the
    room's title flipped between that and the station's name."""
    from backend.sonos.controller import SonosController
    from backend.sonos.models import TransportState

    didl = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="-1"><dc:title>bbc_radio_one</dc:title></item></DIDL-Lite>'
    )
    transport = TransportState(
        media_uri="x-sonosapi-stream:tunein%3A9496?sid=303&flags=8224&sn=16",
        track_uri="x-sonosapi-hls:bbc_radio_one?sid=303",
        container_title="BBC Radio 1",
    )
    SonosController._apply_track_metadata(transport, didl)
    assert transport.title == "BBC Radio 1"


def test_a_real_song_on_a_station_survives():
    """The same scrub must not touch a station that names its track."""
    from backend.sonos.controller import SonosController
    from backend.sonos.models import TransportState

    didl = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="-1"><dc:title>Unitary</dc:title></item></DIDL-Lite>'
    )
    transport = TransportState(
        media_uri="x-sonosapi-stream:synphaera?sid=516&flags=8232&sn=5",
        track_uri="x-rincon-mp3radio://https://ice.somafm.com/synphaera",
        container_title="Synphaera Radio",
    )
    SonosController._apply_track_metadata(transport, didl)
    assert transport.title == "Unitary"


def test_a_position_carries_how_old_it_is():
    """RelTime is not evented, so a client has to know how stale it is.

    Without the age, a browser rendering a minute after the last reading
    starts its own clock from that reading and stays behind for the rest of
    the track (measured at a constant 29 seconds on 2026-09-14).
    """
    from time import monotonic

    from backend.sonos.controller import ZoneState
    from backend.sonos.models import TransportState

    state = ZoneState(uuid="RINCON_1", name="Spare Room", host="10.0.0.1")
    state.transport = TransportState(
        state="PLAYING", rel_time="0:00:30",
        position_read_at=monotonic() - 12.0)
    age = state.as_dict()["transport"]["position_age"]
    assert 11.5 <= age <= 12.5

    # A position never read reports no age rather than the whole uptime.
    state.transport.position_read_at = 0.0
    assert state.as_dict()["transport"]["position_age"] == 0.0
