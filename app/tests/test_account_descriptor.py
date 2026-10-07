"""The account a piece of service content names in its DIDL.

Sonos content carries the account it came from as
``SA_RINCON<service type>_<logon string>``. Sonora composed that from the
service type alone -- ``X_#Svc<type>-0-Token``, the form the common libraries
send -- which is right for an account with a token and wrong for an anonymous
one, whose logon string is empty. The speakers answer the wrong descriptor
with UPnP 402 Invalid Args and play nothing: every Community Radio Plus
station in the household did exactly that until this was fixed.

The household's own account list has the true descriptor, so it is used where
it is known and composed only where it is not.
"""

from __future__ import annotations

from backend.sonos.playback import playable, station_didl
from backend.sonos.smapi import SmapiItem

STATION = SmapiItem(id="cbaa_svc_6ACR", title="Radio NGM", item_type="stream",
                    can_play=True)


def test_the_households_own_descriptor_is_used_when_it_is_known():
    _, metadata = playable(STATION, 330, "10", udn="SA_RINCON84487_")
    assert ">SA_RINCON84487_</desc>" in metadata


def test_the_common_form_is_composed_when_it_is_not():
    _, metadata = playable(STATION, 330, "10")
    assert ">SA_RINCON84487_X_#Svc84487-0-Token</desc>" in metadata


def test_a_station_built_from_a_bare_uri_takes_one_too():
    uri = "x-sonosapi-stream:cbaa_svc_6ACR?sid=330&flags=8224&sn=10"
    assert ">SA_RINCON84487_</desc>" in station_didl(uri, "Radio NGM", "SA_RINCON84487_")
    assert ">SA_RINCON84487_X_#Svc84487-0-Token</desc>" in station_didl(uri, "Radio NGM")


def test_a_descriptor_is_escaped_not_pasted():
    # A logon string is opaque: one service or another will carry something
    # XML cares about. Element text needs & < > escaped and nothing else.
    _, metadata = playable(STATION, 236, "11", udn='SA_RINCON60423_X_&<>')
    assert "SA_RINCON60423_X_&amp;&lt;&gt;</desc>" in metadata
