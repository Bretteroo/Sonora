"""Browsing a service linked only in a Sonos app.

A service that refuses Sonora the sign-in (Apple Music, SoundCloud, and the
rest) can still be linked in a Sonos app. The speakers then hold its login in
``ThirdPartyMediaServersX``, and ``credentials_for`` falls back to it so the
service browses and plays here. The fallback login is marked ``from_system``:
usable, but not Sonora's own, so nothing offers to remove it.
"""

from types import SimpleNamespace

from backend.sonos.accounts import Account
from backend.sonos.controller import SonosController
from backend.sonos.smapi import SmapiClient

HH = "Sonos_x"
SID = 204  # Apple Music


class _Ctl:
    credentials_for = SonosController.credentials_for
    _own_login = SonosController._own_login
    tokens_for_service = SonosController.tokens_for_service

    def __init__(self, tokens, accounts):
        self.service_tokens = tokens
        self._accounts = accounts

    def household_accounts(self, _household_id):
        return self._accounts

    def remember_service_token(self, *args, **kwargs):
        raise AssertionError("a system login is never recorded as Sonora's own")


def _apple(serial, token, key=""):
    return Account(udn=f"SA_RINCON{SID * 256 + 7}_X_#Svc-{serial}-Token",
                   service_type=SID * 256 + 7, username=f"u{serial}",
                   nickname="Apple", serial=serial, token=token, key=key)


def test_the_speakers_login_is_used_when_sonora_holds_none():
    ctl = _Ctl({}, [_apple("64", "apple-token")])
    creds = ctl.credentials_for(HH, SID, "64")
    assert creds["token"] == "apple-token"
    assert creds["from_system"] is True


def test_a_key_less_account_still_yields_a_login():
    # Apple Music stores a token and no key.
    ctl = _Ctl({}, [_apple("64", "apple-token", key="")])
    creds = ctl.credentials_for(HH, SID, "64")
    assert creds["token"] == "apple-token" and creds["key"] == ""


def test_no_account_named_and_one_account_uses_it():
    ctl = _Ctl({}, [_apple("64", "apple-token")])
    assert ctl.credentials_for(HH, SID, "")["token"] == "apple-token"


def test_no_account_named_and_several_is_ambiguous():
    ctl = _Ctl({}, [_apple("63", "t63"), _apple("64", "t64")])
    assert ctl.credentials_for(HH, SID, "") is None


def test_the_named_account_is_the_one_used():
    ctl = _Ctl({}, [_apple("63", "t63"), _apple("64", "t64")])
    assert ctl.credentials_for(HH, SID, "63")["token"] == "t63"


def test_an_account_without_a_token_yields_nothing():
    ctl = _Ctl({}, [_apple("64", "")])
    assert ctl.credentials_for(HH, SID, "64") is None


def test_sonoras_own_login_wins_over_the_speakers():
    own = {"token": "own", "key": "k", "standalone": False}
    ctl = _Ctl({(HH, SID, "64"): own}, [_apple("64", "apple-token")])
    creds = ctl.credentials_for(HH, SID, "64")
    assert creds["token"] == "own" and not creds.get("from_system")


def test_a_token_only_login_reaches_the_smapi_header():
    # The credentials header carries the token with no key element when the
    # account has no key, and still carries the household id.
    header = SmapiClient._credentials("Sonos_x", "apple-token", "", "serial:1")
    assert "<token>apple-token</token>" in header
    assert "<key>" not in header
    assert "<householdId>Sonos_x</householdId>" in header


def test_a_token_and_key_login_still_sends_both():
    header = SmapiClient._credentials("Sonos_x", "tok", "kee", "serial:1")
    assert "<token>tok</token>" in header and "<key>kee</key>" in header


# A borrowed login the service turns down. When the service cannot be linked
# in Sonora either (AppLink), offering to link it leads nowhere, so the page
# says so instead (Apple Music on S2 refuses the S2 speakers' token).

def _service(auth):
    from backend.sonos.services import MusicService
    return MusicService(id=SID, name="Apple Music", uri="", secure_uri="",
                        container_type="MService", capabilities=0, auth=auth)


def test_a_refused_system_login_for_an_applink_service_is_said_plainly():
    from backend.main import _system_login_refused, _system_refused_error
    service = _service("AppLink")
    assert _system_login_refused(service, {"token": "t", "from_system": True})
    error = _system_refused_error(service)
    assert error["system_login_refused"] and not error["needs_auth"]
    assert error["message"].startswith("Apple Music won't accept")


def test_sonoras_own_refused_login_still_asks_to_link():
    from backend.main import _system_login_refused
    assert not _system_login_refused(_service("AppLink"), {"token": "t"})


def test_a_service_sonora_can_link_still_asks_to_link():
    from backend.main import _system_login_refused
    assert not _system_login_refused(_service("DeviceLink"),
                                     {"token": "t", "from_system": True})


# A login made by an S2 app is accepted only under the household id scoped to
# its account, one made by an S1 app only under the bare household id.

import asyncio

from backend.sonos.smapi import SmapiError

_EXPIRED = SmapiError("Apple Music", "SOAP-ENV:Client.AuthTokenExpired", "InvalidTokenException")


def _client_accepting(household_ok):
    client = SmapiClient(session=None)
    client.account_identity = lambda hh, token: f"{hh}_0000beef"
    sent = []

    async def once(endpoint, service_name, action, body, *, household_id="", token="", key="", device_id=""):
        login = client._identity.get((household_id, token), household_id)
        sent.append((action, login))
        if action == "refreshAuthToken" or login != household_ok:
            raise _EXPIRED
        return "<ok/>"

    client._call_once = once
    return client, sent


def test_an_expired_login_is_tried_under_its_accounts_scoped_id_and_kept():
    client, sent = _client_accepting("Sonos_x_0000beef")
    call = lambda: client._call("https://x", "Apple Music", "getMetadata", "", household_id="Sonos_x", token="t")
    assert asyncio.run(call()) == "<ok/>"
    assert sent == [("getMetadata", "Sonos_x"), ("getMetadata", "Sonos_x_0000beef")]
    sent.clear()
    assert asyncio.run(call()) == "<ok/>"
    assert sent == [("getMetadata", "Sonos_x_0000beef")]


def test_a_login_accepted_bare_never_moves():
    client, sent = _client_accepting("Sonos_x")
    asyncio.run(client._call("https://x", "Apple Music", "getMetadata", "", household_id="Sonos_x", token="t"))
    assert sent == [("getMetadata", "Sonos_x")]


def test_a_login_refused_both_ways_still_fails_and_is_not_kept():
    client, sent = _client_accepting("nowhere")
    try:
        asyncio.run(client._call("https://x", "Apple Music", "getMetadata", "", household_id="Sonos_x", token="t"))
    except SmapiError:
        pass
    else:
        raise AssertionError("expected the refusal to stand")
    assert ("getMetadata", "Sonos_x_0000beef") in sent
    assert not client._identity



# A login the speakers keep after the service stopped honoring it is no
# better than none, and is asked about once per token.

class _Probe:
    note_system_login = SonosController.note_system_login
    system_login_works = SonosController.system_login_works

    def __init__(self, fault=None):
        self._system_login_ok = {}
        self.calls = 0
        probe = self

        class _Smapi:
            async def get_metadata(self, **kwargs):
                probe.calls += 1
                if fault:
                    raise fault
        self.smapi = _Smapi()

    async def device_serial(self, household):
        return ""


def _check(probe, token="t"):
    household = SimpleNamespace(id=HH)
    service = SimpleNamespace(id=SID, name="Apple Music", endpoint="https://x")
    return asyncio.run(probe.system_login_works(household, service, {"token": token}))


def test_a_borrowed_login_the_service_refuses_does_not_count():
    probe = _Probe(_EXPIRED)
    assert not _check(probe) and not _check(probe)
    assert probe.calls == 1


def test_a_borrowed_login_the_service_takes_counts():
    probe = _Probe()
    assert _check(probe) and _check(probe)
    assert probe.calls == 1


def test_a_new_token_is_asked_about_afresh():
    probe = _Probe(_EXPIRED)
    _check(probe, "old")
    _check(probe, "new")
    assert probe.calls == 2
