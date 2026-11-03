"""The household's own list of service accounts, read off the speakers.

``ThirdPartyMediaServersX`` rides in every ``ZoneGroupTopology`` event and is
the household's account list: which services are configured, under which
logins, and what each account is called. It is sealed with the household
cipher (``credentials.seal``), so opening it needs nothing but the household
id the speakers already publish -- no cloud sign-in.

Sonora reads it for one thing the cloud is bad at: the **nickname**. The
registration list Sonos serves trails the speakers by seconds to minutes, so a
rename made here (or in a Sonos app) does not show up in it for a while, while
this blob carries it at once.

Each account also carries a ``Token`` and a ``Key``. Those are the account's
live credentials: they let Sonora browse and play a service the person linked
in a Sonos app but cannot link from here (Apple Music, SoundCloud and the
rest that refuse a non-Sonos caller the sign-in). They are held in memory
only, kept off the ``repr`` so an account never logs them, and never written
to disk; the controller uses them through ``credentials_for``.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from defusedxml import ElementTree

from .credentials import unseal

log = logging.getLogger(__name__)

#: ``SA_RINCON<service type>_<logon string>``, the app's own ``SA_RINCON%u_%s``.
_UDN_TYPE = re.compile(r"^SA_RINCON(\d+)_")


@dataclass(frozen=True, slots=True)
class Account:
    """One configured account, with the login the speakers hold for it.

    ``token`` and ``key`` are live credentials, kept out of ``repr`` so they
    never reach a log line.
    """

    udn: str
    service_type: int
    username: str
    nickname: str
    serial: str
    token: str = field(default="", repr=False)
    key: str = field(default="", repr=False)

    @property
    def service_id(self) -> int:
        """The browse sid, which the type carries in its high bits."""
        return self.service_type >> 8


def account_udn(service_type: int, username: str) -> str:
    """The UDN for an account, as the speakers spell it.

    ``SA_RINCON%u_%s`` in the apps' own sclib, and ``SA_RINCON%u_`` for an
    anonymous service, which has no logon string.
    """
    return f"SA_RINCON{service_type}_{username}"


def parse(blob: str, household_id: str) -> list[Account]:
    """Open the blob and read its accounts. Returns [] if it cannot be read."""
    if not blob:
        return []
    try:
        plain = unseal(blob, household_id)
    except ValueError as exc:
        log.info("could not open the household account list: %s", exc)
        return []
    try:
        root = ElementTree.fromstring(plain)
    except Exception as exc:  # a half-written blob is not worth an exception
        log.info("household account list is not XML: %s", exc)
        return []

    out: list[Account] = []
    for node in root.iter("Service"):
        udn = node.get("UDN", "")
        match = _UDN_TYPE.match(udn)
        if match is None:
            continue
        service_type = int(match.group(1))
        try:
            count = max(1, int(node.get("NumAccounts", "1")))
        except ValueError:
            count = 1
        for index in range(count):
            username = node.get(f"Username{index}")
            if username is None:
                continue
            out.append(Account(
                udn=account_udn(service_type, username),
                service_type=service_type,
                username=username,
                nickname=node.get(f"Nickname{index}", "") or "",
                serial=node.get(f"SerialNum{index}", "") or "",
                token=node.get(f"Token{index}", "") or "",
                key=node.get(f"Key{index}", "") or "",
            ))
    return out
