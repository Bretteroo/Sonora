"""A service's own playlists: which the account may add a song to.

The apps' "Add Song to <service> Playlist" lists the playlists under the
service's ``playlists`` container, and only the account's own take a song:
Spotify marks them readOnly="false" on the mediaCollection, and a playlist
the account only follows readOnly="true" (2026-09-24). The write that follows
must go out as the account named, never as another the household holds.
"""

import asyncio

import pytest

from backend.sonos.smapi import SmapiClient

ANSWER = """<?xml version="1.0" encoding="utf-8" ?><SOAP-ENV:Envelope
 xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body>
<ns2:getMetadataResponse xmlns:ns2="http://www.sonos.com/Services/1.1"><ns2:getMetadataResult>
<ns2:index>0</ns2:index><ns2:count>3</ns2:count><ns2:total>3</ns2:total>
<ns2:mediaCollection readOnly="true" renameable="false" userContent="false">
 <ns2:id>spotify:playlist:followed</ns2:id><ns2:itemType>playlist</ns2:itemType>
 <ns2:title>Yacht Rock</ns2:title><ns2:artist>Spotify</ns2:artist></ns2:mediaCollection>
<ns2:mediaCollection readOnly="false" renameable="true" userContent="false">
 <ns2:id>spotify:playlist:mine</ns2:id><ns2:itemType>playlist</ns2:itemType>
 <ns2:title>800 Steps</ns2:title><ns2:artist>alexsounds</ns2:artist></ns2:mediaCollection>
<ns2:mediaCollection>
 <ns2:id>spotify:view:shelf</ns2:id><ns2:itemType>container</ns2:itemType>
 <ns2:title>A shelf</ns2:title></ns2:mediaCollection>
</ns2:getMetadataResult></ns2:getMetadataResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>"""


def test_the_account_s_own_playlist_is_editable_and_a_followed_one_is_not():
    items = {item.id: item for item in SmapiClient._parse(ANSWER).items}
    assert items["spotify:playlist:mine"].editable is True
    assert items["spotify:playlist:followed"].editable is False


def test_a_row_that_says_nothing_is_not_taken_for_a_playlist():
    items = {item.id: item for item in SmapiClient._parse(ANSWER).items}
    assert items["spotify:view:shelf"].editable is None


class _Controller:
    """Holds a login for one Spotify account and not the other."""

    def credentials_for(self, household_id, sid, account_id="", single_account=False):
        logins = {"43": {"token": "t", "key": "k"}}
        if account_id:
            return logins.get(account_id)
        return logins["43"] if single_account else None

    def household_of(self, zone):
        return type("H", (), {"id": "HH", "cloud_id": "c"})()

    # Both accounts are the household's own, so neither is re-attributed.
    cloud = type("C", (), {"last_registrations": staticmethod(lambda _cid: [])})()

    def household_accounts(self, _household_id):
        return [type("A", (), {"serial": s, "username": "u" + s, "service_type": 12 << 8,
                               "service_id": 12})() for s in ("22", "43")]

    def tokens_for_service(self, household_id, sid):
        return {"43": {"token": "t", "key": "k"}}


def test_a_write_for_an_account_sonora_has_no_login_for_is_refused(monkeypatch):
    from fastapi import HTTPException

    import backend.main as main

    monkeypatch.setattr(main, "controller", lambda: _Controller())

    async def service(ctl, household, sid):
        return type("S", (), {"auth": "AppLink", "name": "Spotify", "endpoint": "https://x.invalid"})()

    monkeypatch.setattr(main, "_cached_service", service)
    # Reading may borrow the service's only login; writing as account 22 may not.
    ctl, _, _, creds = asyncio.run(main._service_login(12, "zone", "22"))
    assert creds["token"] == "t"
    with pytest.raises(HTTPException) as refused:
        asyncio.run(main._service_login(12, "zone", "22", exact=True))
    assert refused.value.status_code == 409
    ctl, _, _, creds = asyncio.run(main._service_login(12, "zone", "43", exact=True))
    assert creds["token"] == "t"
