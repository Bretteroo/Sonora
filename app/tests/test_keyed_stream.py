"""A station that announces its song as keyed fields in r:streamContent.

TYPE=SNG|TITLE ...|ARTIST ...|ALBUM ... is how TuneIn's BBC Radio 1 and
private SMAPI stations (issue 19) name what is on air. The S2 app shows the
song and its artist; Sonora shows them too, as the room's track.
"""

from backend.sonos.controller import SonosController
from backend.sonos.didl import keyed_song
from backend.sonos.models import TransportState


def _track(stream: str, *, title: str = "", creator: str = "") -> str:
    return (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
        'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="-1" parentID="-1" restricted="true">'
        f"<r:streamContent>{stream}</r:streamContent>"
        + (f"<dc:title>{title}</dc:title>" if title else "")
        + (f"<dc:creator>{creator}</dc:creator>" if creator else "")
        + "<upnp:class>object.item</upnp:class></item></DIDL-Lite>"
    )


def _station() -> TransportState:
    return TransportState(
        media_uri="x-sonosapi-hls:station-1?sid=255&flags=8232&sn=1",
        track_uri="x-sonosapi-hls:station-1?sid=255",
        container_title="Example FM",
    )


def test_the_fields_are_read():
    assert keyed_song("TYPE=SNG|TITLE Example Song|ARTIST Example Artist|ALBUM ") == (
        "Example Song", "Example Artist", "")
    assert keyed_song("TYPE=SNG|TITLE Midnight Sun|ARTIST Zara Larsson|ALBUM Midnight Sun") == (
        "Midnight Sun", "Zara Larsson", "Midnight Sun")


def test_a_pipe_inside_a_field_stays_in_it():
    assert keyed_song("TYPE=SNG|TITLE Either|Or|ARTIST Someone") == ("Either|Or", "Someone", "")


def test_only_a_song_with_a_title_counts():
    assert keyed_song("TYPE=AD|TITLE Buy things|ARTIST Shop") is None
    assert keyed_song("TYPE=SNG|TITLE |ARTIST Someone") is None
    assert keyed_song("Example Artist - Example Song") is None
    assert keyed_song("") is None


def test_the_song_becomes_the_rooms_track():
    transport = _station()
    SonosController._apply_track_metadata(
        transport, _track("TYPE=SNG|TITLE Example Song|ARTIST Example Artist|ALBUM Example Album"))
    assert (transport.title, transport.artist, transport.album) == (
        "Example Song", "Example Artist", "Example Album")
    # the raw fields are not left to print as an Information line
    assert transport.stream_content == ""


def test_a_station_that_names_its_track_keeps_its_own():
    """Sonos Radio puts the song in dc:title and dc:creator; that wins."""
    transport = _station()
    SonosController._apply_track_metadata(
        transport, _track("TYPE=SNG|TITLE Other|ARTIST Other", title="Real Song", creator="Real Artist"))
    assert (transport.title, transport.artist) == ("Real Song", "Real Artist")


def test_anything_but_a_song_is_left_alone():
    transport = _station()
    SonosController._apply_track_metadata(transport, _track("TYPE=AD|TITLE Buy things|ARTIST "))
    assert transport.title == "Example FM"
    assert transport.artist == ""
    assert transport.stream_content.startswith("TYPE=AD")


def test_plain_stream_text_is_unchanged():
    transport = _station()
    SonosController._apply_track_metadata(transport, _track("Example Artist - Example Song"))
    assert transport.stream_content == "Example Artist - Example Song"
    assert transport.artist == ""

