"""The household's explicit-content setting, and what carries it.

The route, the domain and the request shapes were read out of the desktop
core and then confirmed against both households on 2026-09-17: every speaker
answers ``restricted-admin/explicitContentFiltering`` over its TLS port to any
caller that sends an api-key header, with no Sonos account involved.
"""

from __future__ import annotations

import pytest

from backend.sonos.hhsettings import (CAN_WRITE, DOMAINS, EXPLICIT_FILTERING,
                                      MUSE_SET_COMMAND, HouseholdSettings,
                                      Setting)
from backend.sonos.smapi import SMAPI_NS, SmapiClient


def test_the_setting_names_the_domain_the_speakers_answer():
    assert EXPLICIT_FILTERING.domain == "restricted-admin"
    assert EXPLICIT_FILTERING.name == "explicitContentFiltering"
    assert EXPLICIT_FILTERING.domain in DOMAINS
    assert EXPLICIT_FILTERING.path == (
        "/api/v1/households/local/settings/"
        "restricted-admin/explicitContentFiltering")


def test_the_url_is_the_players_tls_port():
    client = HouseholdSettings(session=None)
    url = client._url("192.168.0.104", EXPLICIT_FILTERING)
    assert url.startswith("https://192.168.0.104:1443/")
    # 1400 answers 403 to the same path, so the plain port is never used.
    assert ":1400" not in url


def test_the_header_is_sent_but_its_value_is_sonoras_own():
    headers = HouseholdSettings(session=None)._headers()
    assert "X-Sonos-Api-Key" in headers
    # Not an app's key: the speakers accept any value, and Sonora does not
    # wear somebody else's name to be let in.
    assert headers["X-Sonos-Api-Key"] != ""


@pytest.mark.parametrize("text,expected", [
    ("false", False), ("true", True), ("TRUE", True),
    ('"true"', True), (" false ", False), ("", False),
])
def test_the_value_is_plain_text(text, expected):
    assert HouseholdSettings.read_bool_text(text) is expected


def test_the_setting_is_readable_and_nothing_can_write_it():
    """Both halves were measured on 2026-09-17, on both households.

    The speakers answer 401 to the POST and name ``Bearer realm="service"``,
    which the Sonos account token is not of. The cloud command is the
    vendor's own -- an invented name answers ERROR_BAD_REQUEST while
    setRestrictedAdminSettings is recognized -- and it is refused as
    ERROR_UNSUPPORTED_COMMAND on the S1 household's 57.23 and ERROR_NYI on
    the S2 household's 97.1, asked as the households' owner. So the write is
    off for every controller, the Sonos apps included, and the UI has to say
    that rather than point at the Sonos app.
    """
    assert CAN_WRITE is False
    assert MUSE_SET_COMMAND == "setRestrictedAdminSettings"


def test_a_setting_elsewhere_keeps_its_own_domain():
    other = Setting("protected-admin", "sonosnetEnabled")
    assert other.path.endswith("protected-admin/sonosnetEnabled")


# -- what the browse knows ----------------------------------------------------

def test_the_browse_layer_can_ask_whether_a_household_filters():
    client = SmapiClient(session=None)
    client.content_filtering = lambda hh: hh == "on"
    assert client.filters("on") is True
    assert client.filters("off") is False


def test_a_controller_that_cannot_read_the_setting_says_no():
    client = SmapiClient(session=None)
    assert client.filters("HH") is False
    client.content_filtering = lambda hh: (_ for _ in ()).throw(RuntimeError)
    # Reading the flag must never be the reason a browse fails.
    assert client.filters("HH") is False


def test_the_anonymous_case_says_no():
    client = SmapiClient(session=None)
    client.content_filtering = lambda hh: True
    assert client.filters("") is False


def test_no_soap_header_carries_it():
    """Deezer faults on a <context> header of any shape; none is sent.

    Measured against all 102 configured services on 2026-09-17: every variant
    made Deezer answer Client.ServiceUnavailable with "context" as the detail
    and changed Amazon Music's error. The envelope carries credentials alone.
    """
    envelope = SmapiClient._credentials("HH", "tok", "key", "dev")
    assert "context" not in envelope
    assert f'<credentials xmlns="{SMAPI_NS}">' in envelope


# --- the marking services actually send -------------------------------------
#
# Measured on the household 2026-09-19 with a script that walked it: of the
# seventeen services in use, Spotify and Pandora mark explicit tracks and
# nobody else says anything. Neither sends SMAPI's documented TAG_EXPLICIT
# string; both send a boolean, and Pandora sends it twice under two names.

SPOTIFY = """<ns2:mediaMetadata xmlns:ns2="http://www.sonos.com/Services/1.1">
  <ns2:id>spotify:track:5Z01</ns2:id><ns2:itemType>track</ns2:itemType>
  <ns2:title>Lose Yourself</ns2:title>
  <ns2:tags><ns2:explicit>1</ns2:explicit></ns2:tags>
</ns2:mediaMetadata>"""

PANDORA = """<mediaCollection xmlns="http://www.sonos.com/Services/1.1">
  <id>SF:21586:33066978</id><itemType>program</itemType>
  <title>Love The Way You Lie</title>
  <tags><explicit>0</explicit></tags><isExplicit>false</isExplicit>
</mediaCollection>"""

QUIET = """<mediaCollection xmlns="http://www.sonos.com/Services/1.1">
  <id>stream_32</id><itemType>stream</itemType><title>80er-Radio harmony</title>
</mediaCollection>"""


def _one(xml: str):
    from backend.sonos.smapi import SmapiClient, _lenient_fromstring

    node = _lenient_fromstring(xml)
    kind = node.tag.split("}")[-1]
    return SmapiClient._item(node, kind)


def test_a_namespaced_tags_explicit_is_read():
    assert _one(SPOTIFY).explicit is True


def test_a_bare_zero_means_not_explicit():
    assert _one(PANDORA).explicit is False


def test_a_service_that_says_nothing_says_nothing():
    """Not False: an unmarked item is not an item marked clean."""
    assert _one(QUIET).explicit is None


def test_filtering_drops_only_what_is_marked():
    from backend.sonos.smapi import SmapiClient, SmapiItem, SmapiPage

    client = SmapiClient.__new__(SmapiClient)
    client.content_filtering = lambda household_id: True
    page = SmapiPage(items=[
        SmapiItem(id="a", title="marked", explicit=True),
        SmapiItem(id="b", title="marked clean", explicit=False),
        SmapiItem(id="c", title="unmarked"),
    ], total=3, count=3)
    kept = client._filtered(page, "HH")
    assert [i.id for i in kept.items] == ["b", "c"]
    # The service's own counts describe the service's list, not this page.
    assert kept.total == 3


def test_nothing_is_dropped_while_the_household_is_unfiltered():
    from backend.sonos.smapi import SmapiClient, SmapiItem, SmapiPage

    client = SmapiClient.__new__(SmapiClient)
    client.content_filtering = lambda household_id: False
    page = SmapiPage(items=[SmapiItem(id="a", title="marked", explicit=True)])
    assert [i.id for i in client._filtered(page, "HH").items] == ["a"]
