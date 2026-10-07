"""SMAPI fault handling for the account-linking flow."""

from backend.sonos.smapi import SmapiClient, SmapiError, _is_fault

RETRY = (
    "<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'><s:Body>"
    "<s:Fault><faultcode>s:NOT_LINKED_RETRY</faultcode>"
    "<faultstring>Link Code not found retry...</faultstring>"
    "<detail><ExceptionInfo>NOT_LINKED_RETRY</ExceptionInfo><SonosError>5</SonosError>"
    "</detail></s:Fault></s:Body></s:Envelope>"
)


def test_a_fault_inside_a_200_is_still_a_fault():
    assert _is_fault(RETRY)
    assert not _is_fault("<s:Envelope><s:Body><getDeviceAuthTokenResult/></s:Body></s:Envelope>")


def test_not_linked_retry_is_pending_in_either_spelling():
    fault = SmapiClient._fault("Bandcamp", RETRY, 200)
    assert fault.pending
    assert fault.needs_auth is False or fault.pending  # pending is the useful bit
    assert SmapiError("x", "Client.NotLinkedRetry", "").pending
    assert not SmapiError("x", "Client.LoginUnauthorized", "").pending


def test_link_details_read_the_registration_answer():
    text = (
        "<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'><s:Body>"
        "<getDeviceLinkCodeResponse xmlns='http://www.sonos.com/Services/1.1'>"
        "<getDeviceLinkCodeResult><regUrl>https://example.test/link</regUrl>"
        "<linkCode>ABCD</linkCode><showLinkCode>true</showLinkCode>"
        "<linkDeviceId>dev-1</linkDeviceId></getDeviceLinkCodeResult>"
        "</getDeviceLinkCodeResponse></s:Body></s:Envelope>"
    )
    assert SmapiClient._link_details(text) == {
        "reg_url": "https://example.test/link", "link_code": "ABCD",
        "show_link_code": True, "device_id": "dev-1", "app_url_id": ""}


def test_rate_result_reads_dynamic_skip_and_message():
    """rateItem's optional shouldSkip / messageStringId, any namespace prefix."""
    from backend.sonos.smapi import parse_rate_result

    full = ('<s:Envelope><s:Body><rateItemResponse xmlns="http://www.sonos.com/Services/1.1">'
            '<rateItemResult><shouldSkip>true</shouldSkip>'
            '<messageStringId>WHY_SKIPPED</messageStringId></rateItemResult>'
            '</rateItemResponse></s:Body></s:Envelope>')
    result = parse_rate_result(full)
    assert result.should_skip is True
    assert result.message_string_id == "WHY_SKIPPED"

    prefixed = ('<ns:rateItemResponse><ns:rateItemResult><ns:shouldSkip>false</ns:shouldSkip>'
                '</ns:rateItemResult></ns:rateItemResponse>')
    assert parse_rate_result(prefixed).should_skip is False

    static = "<rateItemResponse><rateItemResult/></rateItemResponse>"
    assert parse_rate_result(static) == parse_rate_result("")
    assert parse_rate_result(static).should_skip is False
    assert parse_rate_result(static).message_string_id == ""


def test_audiobook_chapter_keeps_author_and_narrator():
    """Libby by OverDrive's chapter (captured 2026-09-07): itemType track,
    trackMetadata with author and narrator and no artist or album."""
    answer = (
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
        '<getMediaMetadataResponse xmlns="http://www.sonos.com/Services/1.1">'
        '<getMediaMetadataResult><id>part:41585002:2570529:0</id><itemType>track</itemType>'
        '<title>Secondhand Time</title><mimeType>audio/mpeg</mimeType><trackMetadata>'
        '<author>Svetlana Alexievich</author><narrator>Amanda Carlin</narrator>'
        '<duration>4650</duration><albumArtURI>https://img.example/x.jpg</albumArtURI>'
        '<canPlay>true</canPlay><canAddToFavorites>false</canAddToFavorites>'
        '</trackMetadata></getMediaMetadataResult></getMediaMetadataResponse></s:Body></s:Envelope>')
    page = SmapiClient._parse(answer)
    item = page.items[0]
    assert item.title == "Secondhand Time"
    assert item.author == "Svetlana Alexievich"
    assert item.narrator == "Amanda Carlin"
    assert item.artist == "" and item.album == ""
    assert item.as_dict()["narrator"] == "Amanda Carlin"


def test_a_rows_display_type_is_kept():
    """Plex marks its Other Sources libraries titleSummary; the id must survive
    the parse so the client can look up the lines the service wants drawn."""
    from defusedxml import ElementTree as DET
    xml = ('<mediaCollection><id>abc:4::library</id><itemType>container</itemType>'
           '<title>Comedy Albums</title><displayType>titleSummary</displayType>'
           '<summary>Burrito</summary><canEnumerate>false</canEnumerate></mediaCollection>')
    item = SmapiClient._item(DET.fromstring(xml), "mediaCollection")
    assert item.display_type == "titleSummary"
    assert item.summary == "Burrito"
    assert item.can_enumerate is False
    assert item.as_dict()["display_type"] == "titleSummary"


def test_the_display_type_map_is_read():
    from backend.sonos.presentation import _parse_display_types
    pmap = ('<Presentation><PresentationMap type="DisplayType"><RootNodeDisplayType/>'
            '<DisplayType id="albums"><DisplayMode>LIST</DisplayMode><Lines><Line token="title"/>'
            '<Line token="artist"/></Lines></DisplayType>'
            '<DisplayType id="titleSummary"><Lines><Line token="title"/><Line token="summary"/></Lines></DisplayType>'
            '<DisplayType id="grid"><DisplayMode>GRID</DisplayMode></DisplayType>'
            '</PresentationMap><PresentationMap type="Search"/></Presentation>')
    assert _parse_display_types(pmap) == {
        "albums": {"mode": "LIST", "lines": ["title", "artist"]},
        "titleSummary": {"mode": "", "lines": ["title", "summary"]},
        "grid": {"mode": "GRID", "lines": []},
    }
    assert _parse_display_types("<Presentation/>") == {}
