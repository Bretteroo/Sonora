"""Reauthorize keeps a household account in place, and an expired login is renewed.

ReplaceAccountX gives the speakers' account a new login without changing its
serial number, so what was saved against it keeps playing; a login the
speakers share is handed on when it rotates; and a provider that says a token
has expired, with no new one attached, is asked for one.
"""

import asyncio

from backend.sonos.credentials import unseal
from backend.sonos.smapi import SmapiClient, SmapiError


HOUSEHOLD = "Sonos_TestHousehold0000000000"


class _Result:
    def __init__(self, args):
        self.args = args


class _Soap:
    def __init__(self):
        self.calls = []

    async def call(self, host, service, action, args=None):
        self.calls.append((host, action, dict(args or {})))
        return _Result({"NewAccountUDN": ""})


def _commands(soap):
    from backend.sonos.controller import Commands

    zone = type("Z", (), {"host": "192.168.1.35", "uuid": "RINCON_A1"})()
    household = type("H", (), {"id": HOUSEHOLD})()
    ctl = type("C", (), {"zone": lambda self, u: zone, "household_of": lambda self, u: household,
                         "soap": soap})()
    commands = Commands.__new__(Commands)
    commands._c = ctl
    return commands


def test_replace_seals_every_argument_and_keeps_the_udn():
    soap = _Soap()
    commands = _commands(soap)
    asyncio.run(commands.replace_oauth_account("RINCON_A1", "SA_RINCON41735_X_#Svc41735-abc-Token",
                                               "tok", "key", "C4-38-75-00-00-A7:6"))
    (_host, action, args), = soap.calls
    assert action == "ReplaceAccountX"
    assert set(args) == {"AccountUDN", "NewAccountID", "NewAccountPassword",
                         "AccountToken", "AccountKey", "OAuthDeviceID"}
    assert "NewAccountUDN" not in args          # the speakers' out-argument
    assert unseal(args["AccountUDN"], HOUSEHOLD) == "SA_RINCON41735_X_#Svc41735-abc-Token"
    assert unseal(args["AccountToken"], HOUSEHOLD) == "tok"
    assert unseal(args["AccountKey"], HOUSEHOLD) == "key"
    assert args["NewAccountID"] == "" and args["NewAccountPassword"] == ""


def test_a_shared_login_that_rotates_is_handed_to_the_speakers():
    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    ctl.service_tokens = {(HOUSEHOLD, 160, "3"): {"token": "old", "key": "k", "standalone": False,
                                                  "seen_accounts": [], "system_udn": "SA_RINCON40967_x"}}
    ctl._unpairable = {}
    ctl._persist_tokens = lambda: None
    shared = []

    async def share(hid, udn, token, key):
        shared.append((hid, udn, token, key))

    ctl._share_rotated_login = share

    async def run():
        ctl._refresh_service_token(HOUSEHOLD, "old", "new", "k2")
        await asyncio.sleep(0)

    asyncio.run(run())
    assert ctl.service_tokens[(HOUSEHOLD, 160, "3")]["token"] == "new"
    assert ctl.service_tokens[(HOUSEHOLD, 160, "3")]["system_udn"] == "SA_RINCON40967_x"
    assert shared == [(HOUSEHOLD, "SA_RINCON40967_x", "new", "k2")]


def test_an_expired_login_with_no_new_one_attached_is_renewed():
    client = SmapiClient.__new__(SmapiClient)
    client.on_token_refresh = None
    seen = []

    async def once(endpoint, service_name, action, body, *, household_id="", token="", key="", device_id=""):
        seen.append((action, token))
        if action == "refreshAuthToken":
            return ("<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'><s:Body>"
                    "<refreshAuthTokenResponse xmlns='http://www.sonos.com/Services/1.1'><refreshAuthTokenResult>"
                    "<authToken>fresh</authToken><privateKey>fkey</privateKey>"
                    "</refreshAuthTokenResult></refreshAuthTokenResponse></s:Body></s:Envelope>")
        if token == "old":
            raise SmapiError("Svc", "Client.AuthTokenExpired", "expired")
        return "ok"

    client._call_once = once
    rotated = []
    client.on_token_refresh = lambda *args: rotated.append(args)
    answer = asyncio.run(client._call("https://svc.example/", "Svc", "getMetadata", "",
                                      household_id=HOUSEHOLD, token="old", key="k"))
    assert answer == "ok"
    assert [a for a, _t in seen] == ["getMetadata", "refreshAuthToken", "getMetadata"]
    assert rotated == [(HOUSEHOLD, "old", "fresh", "fkey")]


def test_a_provider_that_will_not_refresh_leaves_the_original_error():
    client = SmapiClient.__new__(SmapiClient)
    client.on_token_refresh = None

    async def once(endpoint, service_name, action, body, *, household_id="", token="", key="", device_id=""):
        if action == "refreshAuthToken":
            raise SmapiError("Svc", "Client.LoginUnsupported", "no")
        raise SmapiError("Svc", "Client.AuthTokenExpired", "expired")

    client._call_once = once
    try:
        asyncio.run(client._call("https://svc.example/", "Svc", "getMetadata", "",
                                 household_id=HOUSEHOLD, token="old", key="k"))
    except SmapiError as exc:
        assert "AuthTokenExpired" in exc.code
    else:
        raise AssertionError("expected the expiry to stand")


def test_a_new_services_login_is_found_for_its_new_account_at_once():
    """Browsing as the account a link has just created finds the login made for it."""
    from backend.sonos.accounts import Account
    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    ctl.service_tokens = {(HOUSEHOLD, 333, ""): {"token": "t", "key": "k", "standalone": True,
                                               "seen_accounts": ["2"], "system_udn": ""}}
    ctl._unpairable = {}
    ctl._persist_tokens = lambda: None
    accounts = [Account(udn="SA_RINCON85255_a", service_type=333 * 256 + 7, username="a", nickname="", serial="2"),
                Account(udn="SA_RINCON85255_b", service_type=333 * 256 + 7, username="b", nickname="", serial="5")]
    ctl.household_accounts = lambda hid: accounts
    assert ctl.credentials_for(HOUSEHOLD, 333, "2") is None       # there before the login: not its account
    found = ctl.credentials_for(HOUSEHOLD, 333, "5")             # appeared since: it is
    assert found is not None and found["token"] == "t"
    assert (HOUSEHOLD, 333, "5") in ctl.service_tokens


def test_a_new_login_is_not_guessed_onto_one_of_two_new_accounts():
    from backend.sonos.accounts import Account
    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    ctl.service_tokens = {(HOUSEHOLD, 333, ""): {"token": "t", "key": "k", "standalone": True,
                                               "seen_accounts": [], "system_udn": ""}}
    ctl._unpairable = {}
    ctl._persist_tokens = lambda: None
    ctl.household_accounts = lambda hid: [
        Account(udn="x", service_type=333 * 256 + 7, username="a", nickname="", serial="4"),
        Account(udn="y", service_type=333 * 256 + 7, username="b", nickname="", serial="5")]
    assert ctl.credentials_for(HOUSEHOLD, 333, "5") is None
