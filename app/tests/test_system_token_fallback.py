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
