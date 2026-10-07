"""A service the household has an account for is in use, saved from or not.

The local list inferred use from the sids carried by favorites, playlists and
saved stations. A service linked in the Sonos app but never saved from carries
no such sid, so it went unlisted for anyone not signed in to Sonos. The
speakers name every configured account themselves, in ThirdPartyMediaServersX,
and that is the direct answer.
"""

import asyncio

from backend.sonos.services import ServiceReader

LIST = (
    '&lt;Services&gt;'
    '&lt;Service Id="188" Name="AccuRadio" Version="1.1" Uri="https://a.invalid/s"&gt;'
    '&lt;Policy Auth="DeviceLink" PollInterval="30"/&gt;&lt;/Service&gt;'
    '&lt;Service Id="12" Name="Spotify" Version="1.1" Uri="https://b.invalid/s"&gt;'
    '&lt;Policy Auth="AppLink" PollInterval="30"/&gt;&lt;/Service&gt;'
    '&lt;/Services&gt;'
)


class _Soap:
    async def call(self, host, service, action, args=None, **kw):
        return {"AvailableServiceDescriptorList": LIST}


async def _none(*args, **kw):
    """No saved content names a service, and no anonymous one is on the household."""
    return set()


def _reader():
    reader = ServiceReader(_Soap())
    reader._service_ids_in_use = _none
    reader._anonymous_in_use = _none
    return reader


def test_without_the_account_list_nothing_reads_as_in_use():
    directory = asyncio.run(_reader().read("10.0.0.1"))
    assert [s.name for s in directory.in_use] == []


def test_an_account_is_enough_on_its_own():
    # 48135 >> 8 == 188, AccuRadio's browse sid.
    directory = asyncio.run(_reader().read("10.0.0.1", configured={48135 >> 8}))
    assert [s.name for s in directory.in_use] == ["AccuRadio"]


def test_every_configured_account_counts():
    directory = asyncio.run(_reader().read("10.0.0.1", configured={188, 12}))
    assert sorted(s.name for s in directory.in_use) == ["AccuRadio", "Spotify"]


def test_an_id_the_catalog_does_not_offer_invents_nothing():
    # A household's account list also names Sonos' own internal ids. Taking
    # them at face value appended rows called "Service 1".
    directory = asyncio.run(_reader().read("10.0.0.1", configured={1, 3, 188}))
    assert [s.name for s in directory.in_use] == ["AccuRadio"]
    assert not [s for s in directory.services if s.name.startswith("Service ")]


def test_saved_content_does_not_list_a_service_the_account_list_lacks():
    # A favorite from Deezer outlived its account. With the account list in
    # hand, the content is no evidence: only the listed accounts count.
    reader = _reader()

    async def saved(*args, **kw):
        return {12}
    reader._service_ids_in_use = saved
    directory = asyncio.run(reader.read("10.0.0.1", configured={188}))
    assert [s.name for s in directory.in_use] == ["AccuRadio"]


def test_without_the_account_list_saved_content_still_counts():
    reader = _reader()

    async def saved(*args, **kw):
        return {12}
    reader._service_ids_in_use = saved
    directory = asyncio.run(reader.read("10.0.0.1"))
    assert [s.name for s in directory.in_use] == ["Spotify"]


def test_only_account_types_name_a_service():
    # A service's account type is sid * 256 + 7. The list also carries Sonos'
    # own records: type 711 reads as sid 2 (Deezer) but is not an account,
    # and listed a service nobody had added.
    from types import SimpleNamespace
    from backend.sonos.accounts import Account
    from backend.sonos.controller import SonosController
    ctl = SonosController.__new__(SonosController)
    held = {"a": Account("u1", 12 * 256 + 7, "me", "Mine", ""),
            "b": Account("u2", 711, "", "Deezer 34", ""),
            "c": Account("u3", 894, "", "Sonos", "")}
    ctl._accounts_for = lambda household_id: held
    assert ctl.configured_sids("h") == {12}
