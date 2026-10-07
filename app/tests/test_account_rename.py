"""Renaming a service account: both arguments travel sealed, never in the clear.

``SetAccountNicknameX`` is answered 402 for plaintext arguments -- the ``X``
means encrypted, as it does on a share's ``r:usernameX``. Read off the wire
from the desktop app on 2026-09-14.
"""

import asyncio
import base64
from types import SimpleNamespace

from backend.sonos.controller import Commands

UDN = "SA_RINCON48135_X_#Svc48135-0-Token"


class _Soap:
    def __init__(self):
        self.sent = None

    async def call(self, host, service, action, args):
        self.sent = (host, service, action, args)
        return SimpleNamespace(args={})


def _commands():
    soap = _Soap()
    zone = SimpleNamespace(uuid="RINCON_1", host="192.0.2.10")
    controller = SimpleNamespace(
        soap=soap,
        zone=lambda uuid: zone,
        household_of=lambda uuid: SimpleNamespace(id="Sonos_test"),
    )
    return Commands(controller), soap


def test_both_arguments_are_sealed():
    commands, soap = _commands()
    asyncio.run(commands.rename_account("RINCON_1", UDN, "Alex"))
    _host, _service, action, args = soap.sent
    assert action == "SetAccountNicknameX"
    assert set(args) == {"AccountUDN", "AccountNickname"}
    for value in args.values():
        assert value.startswith("2:"), "the X on the action means encrypted"
        # Sixteen bytes of IV in front, then whole AES blocks.
        raw = base64.b64decode(value[2:])
        assert len(raw) > 16 and len(raw) % 16 == 0
    assert UDN not in args["AccountUDN"]
    assert "Alex" not in args["AccountNickname"]


def test_a_zone_outside_a_household_is_refused():
    commands, soap = _commands()
    commands._c.household_of = lambda uuid: None
    try:
        asyncio.run(commands.rename_account("RINCON_1", UDN, "Alex"))
    except ValueError:
        assert soap.sent is None
        return
    raise AssertionError("a zone with no household has no cipher to seal with")


def test_an_oauth_account_goes_on_sealed():
    """AddOAuthAccountX answers 402 in the clear; sealed, it reads the account
    (a probe got past the argument check to 809 on 2026-09-28)."""
    commands, soap = _commands()
    asyncio.run(commands.add_oauth_account("RINCON_1", 181, "the-token", "the-key", "C4-38-75:6"))
    _host, _service, action, args = soap.sent
    assert action == "AddOAuthAccountX"
    for name in ("AccountToken", "AccountKey", "OAuthDeviceID"):
        assert args[name].startswith("2:"), f"{name} must travel sealed"
    assert "the-token" not in args["AccountToken"]
    assert args["AccountType"] == 181 * 256 + 7
