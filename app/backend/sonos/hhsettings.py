"""Settings that belong to a household rather than to any one speaker.

A handful of settings are the household's: every controller sees the same
value, and changing it in one changes it everywhere. Explicit content
filtering is one of them. The speakers hold them, and the apps reach them at
the player's TLS port:

    https://<player>:1443/api/v1/households/local/settings/<domain>/<name>

The URL template, the domain names and the request shapes are in the desktop
core (``sclib_csharp.dll`` in the S2 17.2.3 payload, and the same strings in
the S1 Android build's native library): a GET answers the bare value as
``text/plain``, a POST of the bare value sets it, and the module behind them
is called ``HHSettings``. Its own messages name the two halves -- "Failed to
get household setting name=%s" and "Failed to set household setting name=%s".
The values are replicated across the household by ``SCSettingsReplicator``,
which is what makes them shared rather than per-controller.

There are four domains. ``restricted-admin`` is the one that holds content
filtering, and it answers any caller that sends an api-key header at all --
Sonora's own key is enough, no Sonos account and no app's key (measured on
both households, every speaker, 2026-09-17). ``protected-admin`` is the
networking domain and wants a credential Sonora does not have; asking for
filtering there is what made this look unreachable for a while.

The plain port has none of this: 1400 answers 403 to the same path.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import aiohttp

from .const import SONORA_API_KEY, SONOS_TLS_PORT
from .soap import _PLAYER_TLS

log = logging.getLogger(__name__)

#: The settings domains the desktop core names, in its own order.
DOMAINS = ("public", "restricted-admin", "protected", "protected-admin")


@dataclass(frozen=True, slots=True)
class Setting:
    """One household setting: which domain holds it, and what it is called."""

    domain: str
    name: str

    @property
    def path(self) -> str:
        return (f"/api/v1/households/local/settings/{self.domain}/{self.name}")


#: Whether the household filters explicit content. The apps' Parental
#: Controls / Content Filters page is this one boolean.
EXPLICIT_FILTERING = Setting("restricted-admin", "explicitContentFiltering")

#: The household's name, as the Sonos apps show it ("Your System" until
#: someone names it). S2 speakers keep it; an S1 household has no such key.
HOUSEHOLD_NAME = Setting("restricted-admin", "museHHName")

#: Whether SONORA can change it. Reading is open to anything on the network;
#: writing is refused everywhere it was asked. The speakers answer 401 and
#: name a realm the Sonos account token is not of, and the cloud command for
#: it answers that the firmware does not implement it (see
#: SettingsUnauthorized). The S1 Android app can write it and asks for the
#: password to do so, so what is missing is a credential rather than a route.
#: Flip this when Sonora has one.
CAN_WRITE = False

#: The Muse command that would do it, recorded for the day it works. The name
#: is the vendor's: the web app ships a generated client naming every command
#: and its path, household restrictedAdmin included, and in that table a
#: setter always shares its getter's path.
MUSE_SET_COMMAND = "setRestrictedAdminSettings"


class SettingsError(Exception):
    """A speaker would not read or write the setting."""


class SettingsUnanswered(SettingsError):
    """The speaker did not answer at all, which another player may."""


class SettingsUnauthorized(SettingsError):
    """The speaker wants a credential for this.

    Reading is open; writing is not. Every player of both households answers
    401 to a POST and names its realm -- ``Bearer realm="service"`` -- and the
    account bearer from the optional Sonos sign-in is refused there as an
    invalid token on S2 and as an insufficient one on S1 (403).

    Nor is there a way round it through the cloud. The Muse command is
    ``setRestrictedAdminSettings``: a real name, not a guess -- an invented
    one answers ``ERROR_BAD_REQUEST``, while this one is recognized and
    refused, with ``ERROR_UNSUPPORTED_COMMAND`` on the S1 household's 57.23
    and ``ERROR_NYI`` on the S2 household's 97.1 (measured 2026-09-17 as the
    households' own owner).

    An app does write it. The Sonos S1 app for Android moved this household's
    value false-true-false on 2026-09-19, and every player of the household
    followed within five seconds. It asked for the account password on each
    toggle although it was already signed in, which is what the realm above
    is asking for and what Sonora has no way to obtain. So the setting is
    readable, writable by an app, and not by this controller.
    """


class HouseholdSettings:
    """Reads and writes household settings on a speaker."""

    def __init__(self, session: aiohttp.ClientSession, *,
                 timeout: float = 8.0) -> None:
        self._session = session
        self._timeout = aiohttp.ClientTimeout(total=timeout)

    def _headers(self) -> dict[str, str]:
        # The header has to be there; its value is not checked. Sonora sends
        # its own name rather than an app's.
        return {"X-Sonos-Api-Key": SONORA_API_KEY, "X-Sonos-SWGen": "1"}

    def _url(self, host: str, setting: Setting) -> str:
        return f"https://{host}:{SONOS_TLS_PORT}{setting.path}"

    async def read(self, host: str, setting: Setting, *,
                   timeout: float | None = None) -> str:
        """The setting's value as the speaker states it, as plain text.

        ``timeout`` overrides the reader's own, for a caller with another
        player to ask.
        """
        limit = self._timeout if timeout is None else aiohttp.ClientTimeout(total=timeout)
        try:
            async with self._session.get(
                self._url(host, setting), headers=self._headers(),
                timeout=limit, ssl=_PLAYER_TLS,
            ) as resp:
                text = (await resp.text()).strip()
                if resp.status != 200:
                    raise SettingsError(
                        f"{host} answered {resp.status} for {setting.name}"
                        + (f": {text}" if text else ""))
                return text
        except SettingsError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise SettingsUnanswered(f"{host} did not answer: {exc}") from exc

    async def write(self, host: str, setting: Setting, value: str) -> None:
        """Set it. The body is the bare value, as the apps send it."""
        headers = {**self._headers(), "Content-Type": "text/plain"}
        try:
            async with self._session.post(
                self._url(host, setting), data=value.encode("ascii"),
                headers=headers, timeout=self._timeout, ssl=_PLAYER_TLS,
            ) as resp:
                text = (await resp.text()).strip()
                if resp.status in (401, 403):
                    raise SettingsUnauthorized(
                        f"{host} wants a credential to set {setting.name} "
                        f"(HTTP {resp.status})")
                if resp.status >= 300:
                    raise SettingsError(
                        f"{host} answered {resp.status} setting {setting.name}"
                        + (f": {text}" if text else ""))
        except SettingsError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise SettingsError(f"{host} did not answer: {exc}") from exc

    async def read_bool(self, host: str, setting: Setting) -> bool:
        return self.read_bool_text(await self.read(host, setting))

    @staticmethod
    def read_bool_text(text: str) -> bool:
        return text.strip().strip('"').lower() == "true"

    async def write_bool(self, host: str, setting: Setting, value: bool) -> None:
        await self.write(host, setting, "true" if value else "false")
