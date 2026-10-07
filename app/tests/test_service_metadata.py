"""Parsing the things services say about their items.

Every case here was measured against a real provider (see the parity notes
for the captures), and each one cost a debugging cycle to find, so they are
pinned rather than left to be rediscovered.
"""

from backend.sonos.didl import parse_didl
from backend.sonos.playback import station_didl
from backend.sonos.presentation import _parse_info_view, _parse_strings
from backend.sonos.smapi import SmapiClient, _lenient_fromstring

NS = 'xmlns="http://www.sonos.com/Services/1.1"'


def test_get_media_metadata_has_no_wrapper_element():
    """Pocket Casts puts the item's fields straight in the result.

    There is no <mediaMetadata> around them, so a parser that only collects
    that element finds nothing at all.
    """
    text = (
        f"<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'><s:Body>"
        f"<getMediaMetadataResponse {NS}><getMediaMetadataResult>"
        "<id>show#ep</id><itemType>track</itemType>"
        "<semanticType>episode.podcast</semanticType>"
        "<title>Middle School</title><summary>This American Life</summary>"
        "<releaseDate>2026-09-07T00:00:00.000Z</releaseDate>"
        "<trackMetadata><artist>This American Life</artist>"
        "<podcast>This American Life</podcast></trackMetadata>"
        "</getMediaMetadataResult></getMediaMetadataResponse></s:Body></s:Envelope>"
    )
    page = SmapiClient._parse(text)
    assert len(page.items) == 1
    item = page.items[0]
    assert item.semantic_type == "episode.podcast"
    assert item.title == "Middle School"
    assert item.podcast == "This American Life"
    assert item.release_date.startswith("2026-09-07")


def test_a_stream_keeps_its_art_and_show_in_stream_metadata():
    """80s80s sends neither albumArtURI nor trackMetadata for its stations."""
    text = (
        f"<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'><s:Body>"
        f"<getMetadataResponse {NS}><getMetadataResult>"
        "<index>0</index><count>1</count><total>1</total>"
        "<mediaMetadata><id>abc</id><title>80s80s MV</title>"
        "<itemType>stream</itemType><streamMetadata>"
        "<logo>https://example.test/logo.jpg</logo>"
        "<currentShow>Our show</currentShow></streamMetadata>"
        "</mediaMetadata></getMetadataResult></getMetadataResponse></s:Body></s:Envelope>"
    )
    item = SmapiClient._parse(text).items[0]
    assert item.art == "https://example.test/logo.jpg"
    # The show is the row's tooltip, not a second line, so it stays apart
    # from `summary`.
    assert item.stream_show == "Our show"
    assert item.summary == ""


def test_an_undeclared_attribute_prefix_does_not_break_the_parse():
    """Sonos Radio answers with a bare xsi:nil and no xmlns:xsi."""
    text = (
        "<soap:Envelope xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'>"
        f"<soap:Body><getMetadataResponse {NS} xsi:nil='true'>"
        "</getMetadataResponse></soap:Body></soap:Envelope>"
    )
    root = _lenient_fromstring(text)
    assert [t.tag.rsplit("}", 1)[-1] for t in root.iter()][:2] == ["Envelope", "Body"]


def test_stream_content_is_its_own_field():
    """r:streamContent carries a station's current track.

    ``description`` reads r:description and stays empty for these, which is
    why the Information line was blank before it was parsed separately.
    """
    didl = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/"'
        ' xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"'
        ' xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/"'
        ' xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="-1" parentID="-1" restricted="true">'
        "<r:streamContent>Sade - Is It a Crime</r:streamContent>"
        "<r:radioShowMd>The Quiet Hour</r:radioShowMd>"
        "<dc:title>regc-stream-192</dc:title></item></DIDL-Lite>"
    )
    item = parse_didl(didl)[0]
    assert item.stream_content == "Sade - Is It a Crime"
    assert item.stream_show == "The Quiet Hour"
    assert item.description == ""


def test_a_show_with_no_id_keeps_no_dangling_comma():
    """``r:radioShowMd`` is "<show>,<id>", and the id can be missing.

    Community Radio Plus publishes "Your family-friendly radio station," with
    nothing after the comma, and Sonora printed the comma where the app shows
    none.
    """
    def show(raw):
        didl = (
            '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/"'
            ' xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"'
            ' xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/"'
            ' xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
            '<item id="-1" parentID="-1" restricted="true">'
            f"<r:radioShowMd>{raw}</r:radioShowMd>"
            "<dc:title>x</dc:title></item></DIDL-Lite>"
        )
        return parse_didl(didl)[0]

    bare = show("Your family-friendly radio station,")
    assert bare.stream_show == "Your family-friendly radio station"
    assert bare.stream_show_id == ""
    # The usual form still parses, id and all.
    named = show("Marci Wiser,p1151215")
    assert named.stream_show == "Marci Wiser"
    assert named.stream_show_id == "p1151215"
    # And a show whose name really does hold a comma keeps it.
    listy = show("Jazz, Blues and Soul")
    assert listy.stream_show == "Jazz, Blues and Soul"


def test_a_station_from_the_saved_list_gets_composed_metadata():
    """R:0/0 hands stations back with an empty r:resMD.

    Playing one with no metadata is refused with UPnP 402, so the descriptor
    is composed from the URI: the service type comes from ``sid``.
    """
    built = station_didl("x-sonosapi-stream:s32299?sid=254&flags=32", "Comedy 1440")
    assert "SA_RINCON65031_" in built           # (254 << 8) | 7
    assert "F00092020s32299" in built
    assert "<dc:title>Comedy 1440</dc:title>" in built
    # Nothing to compose for a URI that names no service.
    assert station_didl("http://example.test/stream.mp3", "x") == ""


def test_info_view_names_the_menu_items_and_the_strings_supply_the_words():
    """Mixcloud's own presentation map and string table."""
    menu = _parse_info_view(
        '<Presentation><PresentationMap type="InfoView"><Match>'
        '<MenuItemOverrides>'
        '<MenuItem StringId="FAVORITE_TRACK" MenuItem="AddTrackToFavorites"/>'
        '<MenuItem StringId="UNFAVORITE_TRACK" MenuItem="RemoveTrackFromFavorites"/>'
        "</MenuItemOverrides></Match></PresentationMap></Presentation>"
    )
    assert [m["item"] for m in menu] == ["AddTrackToFavorites",
                                         "RemoveTrackFromFavorites"]
    table = _parse_strings(
        '<stringtables><stringtable xml:lang="de-DE">'
        '<string stringId="FAVORITE_TRACK">Sendung merken</string></stringtable>'
        '<stringtable xml:lang="en-US">'
        '<string stringId="FAVORITE_TRACK">Favorite Show</string>'
        '<string stringId="RELATED_TRACKS">Related shows</string>'
        "</stringtable></stringtables>", "en")
    assert table["FAVORITE_TRACK"] == "Favorite Show"
    assert table["RELATED_TRACKS"] == "Related shows"


def test_strings_fall_back_when_the_language_is_missing():
    xml = ('<stringtables><stringtable xml:lang="en-US">'
           '<string stringId="A">only english</string></stringtable></stringtables>')
    assert _parse_strings(xml, "hu")["A"] == "only english"


def test_the_provider_id_survives_the_round_trip_through_a_track_uri():
    """``playable()`` escapes the id and bolts on an extension; this undoes it."""
    from backend.main import _smapi_item_id
    assert _smapi_item_id(
        "x-sonos-http:8e740d01%233782b780.mp3?sid=233&flags=24608&sn=14"
    ) == "8e740d01#3782b780"
    # A raw stream names no provider id, so nothing is sent to the service.
    assert _smapi_item_id("hls-radio://https://example.test/live") == ""
    assert _smapi_item_id("x-sonosapi-stream:s24939?sid=254") == ""
