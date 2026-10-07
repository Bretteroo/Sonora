"""Reading an item's details may borrow another account's login; writing
may not (a room's Spotify Connect track from account 51, which
Sonora holds no login for)."""

from types import SimpleNamespace

from backend.main import _reading_creds
from backend.sonos.controller import SonosController

HH = "Sonos_x"


class _Ctl:
    credentials_for = SonosController.credentials_for
    tokens_for_service = SonosController.tokens_for_service

    def __init__(self, tokens):
        self.service_tokens = tokens
        self.cloud = SimpleNamespace(last_registrations=lambda _cid: [])

    def household_accounts(self, _household_id):
        return []

    def remember_service_token(self, *args, **kwargs):
        pass


def _login(name):
    return {"token": name, "key": "", "standalone": False}


def test_the_items_own_account_is_used_when_held():
    ctl = _Ctl({(HH, 12, "22"): _login("a22"), (HH, 12, "51"): _login("a51")})
    creds, borrowed = _reading_creds(ctl, SimpleNamespace(id=HH, cloud_id='c'), 12, "51")
    assert creds["token"] == "a51" and borrowed is False


def test_another_account_is_borrowed_when_the_items_is_not_held():
    ctl = _Ctl({(HH, 12, "22"): _login("a22"), (HH, 12, "43"): _login("a43")})
    creds, borrowed = _reading_creds(ctl, SimpleNamespace(id=HH, cloud_id='c'), 12, "51")
    assert creds["token"] in {"a22", "a43"} and borrowed is True


def test_no_account_named_and_one_login_is_not_borrowing():
    ctl = _Ctl({(HH, 12, "22"): _login("a22")})
    creds, borrowed = _reading_creds(ctl, SimpleNamespace(id=HH, cloud_id='c'), 12, "")
    assert creds["token"] == "a22" and borrowed is False


def test_nothing_held_is_nothing():
    ctl = _Ctl({})
    assert _reading_creds(ctl, SimpleNamespace(id=HH, cloud_id='c'), 12, "51") == ({}, False)


def _household_ctl(tokens, listed):
    import backend.main as m
    ctl = _Ctl(tokens)
    ctl.cloud = SimpleNamespace(last_registrations=lambda _cid: [])
    ctl.household_accounts = lambda _hid: [SimpleNamespace(serial=a, username="u" + a, service_type=12 << 8,
                                                           service_id=12) for a in listed]
    return m, ctl


def test_a_connect_serial_is_the_first_held_account():
    m, ctl = _household_ctl({(HH, 12, "22"): _login("a22"), (HH, 12, "43"): _login("a43")}, ["22", "43"])
    hh = SimpleNamespace(id=HH, cloud_id="c")
    assert m._item_account(ctl, hh, 12, "51") == "22"
    creds, borrowed = m._reading_creds(ctl, hh, 12, "51")
    assert creds["token"] == "a22" and borrowed is False


def test_the_readers_choice_wins_for_a_connect_serial():
    m, ctl = _household_ctl({(HH, 12, "22"): _login("a22"), (HH, 12, "43"): _login("a43")}, ["22", "43"])
    hh = SimpleNamespace(id=HH, cloud_id="c")
    token = m._ACCOUNT_CHOICE.set({f"{HH}:12": "43"})
    try:
        assert m._item_account(ctl, hh, 12, "51") == "43"
    finally:
        m._ACCOUNT_CHOICE.reset(token)


def test_a_household_account_is_itself():
    m, ctl = _household_ctl({}, ["22", "43"])
    assert m._item_account(ctl, SimpleNamespace(id=HH, cloud_id="c"), 12, "43") == "43"
