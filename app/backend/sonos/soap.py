"""Async SOAP transport for ZonePlayer control endpoints.

Speakers are addressed directly over HTTP on the LAN. Nothing in this module
contacts Sonos' servers; see ``backend/sonos/cloud.py`` for the narrow set of
operations that have no local equivalent.
"""

from __future__ import annotations

import asyncio
import time
import logging
import ssl
from dataclasses import dataclass
from typing import Any, Mapping
from xml.sax.saxutils import escape

import aiohttp
from defusedxml import ElementTree as DET

from .const import NS, SONOS_PORT, SONOS_TLS_PORT, SOAP_ENVELOPE, Service
from .safety import Tier, classify

log = logging.getLogger(__name__)

#: UPnP faults worth surfacing with a friendlier message. Sonos reuses the
#: standard UPnP error space and adds its own codes above 700.
UPNP_ERRORS = {
    "401": "Invalid action for this service",
    "402": "Invalid arguments",
    "501": "Action failed",
    "600": "Argument value invalid",
    "701": "Transition not available in the current transport state",
    "702": "No content in the queue",
    "704": "Playback refused: the group is not in a playable state",
    "705": "Transport is locked",
    "711": "Illegal seek target",
    "712": "Play mode not supported for this source",
    "714": "Unsupported or unrecognized URI",
    "718": "Requested queue index is out of range",
    "719": "Coordinator is not the local player",
    "800": "Command not supported by this device",
}


#: Faults that mean "not valid right now" rather than "something is broken".
#: A controller should tell the user their request conflicts with the current
#: state, not that the speaker failed.
CONFLICT_CODES = frozenset({
    "701",  # transition not available in the current transport state
    "702",  # no content in the queue
    "704",  # group not in a playable state
    "705",  # transport locked
    "711",  # illegal seek target
    "712",  # play mode unsupported for this source
    "714",  # unrecognized URI
    "718",  # queue index out of range
    "719",  # coordinator is not the local player
})


#: Actions whose faults are expected answers rather than problems.
QUIET_FAULTS = {"GetSessionId"}

#: Actions that change something each time they arrive, so a request that
#: may have reached the player is never sent again: a timed-out
#: AddURIToQueue the player had acted on was retried twice, which can add
#: the same items three times; a removal or a move by position would take
#: the next row; Next twice skips two. A connection that never opened did
#: not deliver anything and is still retried.
ONCE_ONLY = frozenset({
    "AddURIToQueue", "AddMultipleURIsToQueue", "RemoveTrackFromQueue", "RemoveTrackRangeFromQueue",
    "ReorderTracksInQueue", "SaveQueue", "CreateSavedQueue", "AddURIToSavedQueue",
    "ReorderTracksInSavedQueue", "CreateObject", "Next", "Previous",
    "SetRelativeVolume", "SetRelativeGroupVolume",
})


class SoapFault(Exception):
    """A UPnP fault returned by a speaker."""

    def __init__(self, code: str, description: str, service: str, action: str):
        self.code = code
        self.description = description
        self.service = service
        self.action = action
        hint = UPNP_ERRORS.get(code)
        msg = f"{service}#{action} failed with UPnP error {code}"
        if description and description != code:
            msg += f" ({description})"
        if hint:
            msg += f": {hint}"
        super().__init__(msg)

    @property
    def is_conflict(self) -> bool:
        """Whether the speaker refused because of its state, not a failure."""
        return self.code in CONFLICT_CODES


@dataclass(slots=True)
class SoapResult:
    """Flattened output arguments from a successful action."""

    action: str
    args: dict[str, str]

    def __getitem__(self, key: str) -> str:
        return self.args[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.args.get(key, default)

    def int_(self, key: str, default: int = 0) -> int:
        try:
            return int(self.args[key])
        except (KeyError, TypeError, ValueError):
            return default

    def bool_(self, key: str, default: bool = False) -> bool:
        raw = self.args.get(key)
        if raw is None:
            return default
        return raw.strip() in ("1", "true", "True")


#: A player presents its own certificate, issued by Sonos for the device and
#: not by any public authority, so the chain and the name are not checked;
#: the point of using it is that the password is not on the wire in clear.
_PLAYER_TLS = ssl.create_default_context()
_PLAYER_TLS.check_hostname = False
_PLAYER_TLS.verify_mode = ssl.CERT_NONE


#: What a bare error code means, for the log. A speaker often sends the code
#: alone -- ``<errorCode>701</errorCode>`` with a faultstring of the literal
#: "UPnPError" and no description -- so the line used to end in a word that
#: said nothing. These are the standard UPnP meanings plus
#: the ones Sonos adds, and only the codes Sonora has actually seen.
FAULT_MEANINGS = {
    "401": "invalid action",
    "402": "invalid arguments",
    "501": "action failed",
    "600": "argument value invalid",
    "701": "no such object",
    "714": "illegal MIME type",
    "800": "command not supported by this device",
    "801": "a group member did not answer",
    "806": "invalid or expired credentials",
}


class SoapClient:
    """Issues SOAP actions to speakers.

    A single client is shared across the whole app so connections to the
    speakers are pooled. Sonos units are small embedded devices and get unhappy
    when a controller opens a new socket per request.
    """

    def __init__(
        self,
        session: aiohttp.ClientSession,
        *,
        timeout: float = 8.0,
        retries: int = 2,
    ) -> None:
        self._session = session
        self._timeout = aiohttp.ClientTimeout(total=timeout)
        self._retries = retries
        #: Hosts that last failed to answer at all, by the time they did. A
        #: player whose HTTP server has stalled (seen on a Play:1 for minutes
        #: at a stretch, 2026-09-14) makes every household-wide query aimed
        #: at it wait out the timeout; callers ask ``is_silent`` and aim at
        #: another player of the same household meanwhile.
        self._silent: dict[str, float] = {}

    async def call(
        self,
        host: str,
        service: Service,
        action: str,
        args: Mapping[str, Any] | None = None,
        *,
        port: int = SONOS_PORT,
        secure: bool = False,
        extra_headers: Mapping[str, str] | None = None,
        quiet_codes: frozenset[str] | set[str] = frozenset(),
        timeout: float | None = None,
        retries: int | None = None,
    ) -> SoapResult:
        """Invoke ``action`` on ``service`` at ``host``.

        ``secure`` sends it to the player's TLS port instead, which is where
        the desktop app puts a request carrying a password: the certificate
        is the player's own, so it is not checked against a public chain.

        ``timeout`` and ``retries`` override the client's own for this call,
        for a caller with somewhere else to go: a household-wide read can ask
        another player rather than wait out three full timeouts on one.
        """
        tier = classify(service.name, action)

        body = self._build_body(service, action, args or {})
        scheme, where = ("https", SONOS_TLS_PORT) if secure else ("http", port)
        url = f"{scheme}://{host}:{where}{service.control}"
        headers = {
            "Content-Type": 'text/xml; charset="utf-8"',
            "SOAPACTION": service.soap_action(action),
            **(extra_headers or {}),
        }

        last_exc: Exception | None = None
        tries = self._retries if retries is None else retries
        limit = self._timeout if timeout is None else aiohttp.ClientTimeout(total=timeout)
        for attempt in range(tries + 1):
            try:
                async with self._session.post(
                    url, data=body.encode("utf-8"), headers=headers,
                    timeout=limit,
                    ssl=_PLAYER_TLS if secure else None,
                ) as resp:
                    text = await resp.text()
                    if resp.status == 500:
                        fault = self._parse_fault(text, service.name, action)
                        # Faults are answers, not transport failures, but a
                        # refusal is worth a line: it is what a person sees as
                        # a toast, and the log is where it can be traced.
                        # The anonymous-service probe asks a question whose
                        # answer is a fault, so its refusals are not news.
                        # A refusal the caller expects and handles is not
                        # news: group volume answers 801 whenever a member
                        # lags, which the caller tolerates, and the log said
                        # WARNING for it anyway.
                        expected = action in QUIET_FAULTS or fault.code in quiet_codes
                        level = logging.DEBUG if expected else logging.WARNING
                        log.log(level, "%s %s#%s refused: UPnP error %s %s",
                                host, service.name, action, fault.code,
                                fault.description or FAULT_MEANINGS.get(fault.code, ""))
                        raise fault
                    resp.raise_for_status()
                    if tier is not Tier.READ:
                        log.info("%s %s#%s ok", host, service.name, action)
                    self._silent.pop(host, None)
                    return self._parse_response(text, action)
            except SoapFault:
                self._silent.pop(host, None)
                raise  # a fault is a real answer, not a transport problem
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_exc = exc
                delivered = not isinstance(exc, aiohttp.ClientConnectorError)
                if action in ONCE_ONLY and delivered:
                    break
                if attempt < tries:
                    await asyncio.sleep(0.25 * (attempt + 1))
                    continue
        self._silent[host] = time.monotonic()
        raise ConnectionError(
            f"{host} did not answer {service.name}#{action}: {last_exc}"
        ) from last_exc

    #: How long a player is steered around after it stopped answering. Long
    #: enough to cover a stall, short enough that a player back on its feet is
    #: asked again soon.
    SILENCE = 90.0

    def mark_silent(self, host: str) -> None:
        """Note a player that failed to answer something other than SOAP,
        such as its 1443 settings, so household-wide reads steer around it
        for the same minute and a half."""
        self._silent[host] = time.monotonic()

    def is_silent(self, host: str) -> bool:
        """Whether ``host`` failed to answer within the last minute and a half."""
        at = self._silent.get(host)
        return at is not None and time.monotonic() - at < self.SILENCE

    # -- wire format ---------------------------------------------------------

    @staticmethod
    def _build_body(service: Service, action: str, args: Mapping[str, Any]) -> str:
        parts = [f'<u:{action} xmlns:u="{service.type}">']
        for key, value in args.items():
            if value is None:
                value = ""
            elif isinstance(value, bool):
                value = "1" if value else "0"
            parts.append(f"<{key}>{escape(str(value))}</{key}>")
        parts.append(f"</u:{action}>")
        return SOAP_ENVELOPE.format(body="".join(parts))

    @staticmethod
    def _parse_response(text: str, action: str) -> SoapResult:
        root = DET.fromstring(text)
        body = root.find("s:Body", NS)
        if body is None or len(body) == 0:
            return SoapResult(action=action, args={})
        response = body[0]
        args = {child.tag: (child.text or "") for child in response}
        return SoapResult(action=action, args=args)

    @staticmethod
    def _parse_fault(text: str, service: str, action: str) -> SoapFault:
        code, description = "?", ""
        try:
            root = DET.fromstring(text)
            fault = root.find(".//s:Fault", NS)
            if fault is not None:
                # "UPnPError" is the wrapper's name, not a description of
                # anything; a speaker sends it whenever it has nothing to say.
                faultstring = (fault.findtext("faultstring") or "").strip()
                description = "" if faultstring == "UPnPError" else faultstring
                # Sonos nests its numeric code inside UPnPError
                for elem in fault.iter():
                    if elem.tag.endswith("errorCode") and elem.text:
                        code = elem.text.strip()
                    elif elem.tag.endswith("errorDescription") and elem.text:
                        description = elem.text.strip()
        except Exception:  # a malformed fault is still a fault
            description = text[:200]
        return SoapFault(code, description, service, action)
