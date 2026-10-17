"""UPnP eventing (GENA) against ZonePlayers.

Sonos pushes state changes to subscribers rather than expecting a controller to
poll, which is how the official apps stay in step with the hardware. A
subscription is an HTTP ``SUBSCRIBE`` naming a callback URL on this machine;
the speaker then sends ``NOTIFY`` requests to it until the subscription lapses,
so a controller must renew before the timeout or go deaf.

Two payload shapes turn up. Most renderer services wrap everything in a single
``LastChange`` property holding an escaped XML document. Topology and queue
services instead send their properties directly. Both are normalized here into
flat dictionaries.
"""

from __future__ import annotations

import asyncio
from time import monotonic
import ipaddress
import logging
import re
import secrets
import socket
import struct
from collections import defaultdict
from dataclasses import dataclass, field
from html import unescape
from pathlib import Path
from typing import Awaitable, Callable

import aiohttp
from aiohttp import web
from defusedxml import ElementTree as DET

from .const import SONOS_PORT, Service

log = logging.getLogger(__name__)


def _why(exc: BaseException) -> str:
    """A reason worth printing.

    Several of the errors a speaker's silence raises carry no message at all:
    aiohttp's ServerDisconnectedError and asyncio's TimeoutError both stringify
    to nothing, so the log read "SUBSCRIBE 192.168.0.104 AVTransport failed: "
    and stopped, which says less than nothing. The class
    name is the least that identifies what happened.
    """
    return str(exc) or exc.__class__.__name__

#: Requested subscription lifetime. Sonos honors this but may shorten it, so
#: the actual timeout is read back from the response.
SUBSCRIPTION_SECONDS = 600

#: Renew this far ahead of expiry to survive a dropped renewal.
RENEW_MARGIN = 60


@dataclass(slots=True)
class Event:
    """A normalized state change from one service on one player."""

    host: str
    service: str
    properties: dict[str, str] = field(default_factory=dict)
    #: Per-channel values, for services that report volume per channel.
    channels: dict[str, dict[str, str]] = field(default_factory=dict)
    seq: int = 0


EventHandler = Callable[[Event], Awaitable[None] | None]


@dataclass(slots=True)
class _Subscription:
    host: str
    service: Service
    sid: str
    timeout: int
    task: asyncio.Task | None = None


def on_own_link(host: str, route_table: Path = Path("/proc/net/route")) -> bool:
    """Whether ``host`` is on a network this machine is directly attached to.

    Read from the kernel's routing table. Where there is none to read (not
    Linux), the answer is yes, which keeps the plain choice of address.
    """
    try:
        rows = route_table.read_text().splitlines()[1:]
        target = struct.unpack("!I", socket.inet_aton(host))[0]
    except (OSError, ValueError):
        return True
    for row in rows:
        cols = row.split()
        if len(cols) < 8:
            continue
        try:
            # The table prints each address as the host-order hex of its
            # network-order bytes.
            dest, gateway, mask = (socket.ntohl(int(c, 16)) for c in (cols[1], cols[2], cols[7]))
        except ValueError:
            continue
        if gateway == 0 and mask and target & mask == dest:
            return True
    return False


def local_ip_for(host: str) -> str:
    """Which of our addresses a speaker will be able to reach us on.

    Opening a UDP socket toward the target makes the kernel pick the right
    source address, which matters on a machine with several interfaces.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect((host, SONOS_PORT))
        return sock.getsockname()[0]
    finally:
        sock.close()


class EventListener:
    """Runs the NOTIFY callback server and manages subscriptions."""

    def __init__(self, session: aiohttp.ClientSession, *, port: int = 0) -> None:
        # SUBSCRIBE, renewals and UNSUBSCRIBE go out on connections of their
        # own that are never kept for reuse. On the shared session a pooled
        # keep-alive connection to a Connect went dead without a
        # word, and every subscription to it then waited out its 8 s timeout
        # -- all day, retried every few minutes -- while a fresh connection
        # answered in 10 ms. Sonora never heard the Connect's
        # changes and showed it idle at volume 0 when it was paused at 26.
        # Subscriptions are rare, so a new connection each costs nothing.
        self._shared_session = session
        self._session = session
        self._own_session: aiohttp.ClientSession | None = None
        self._port = port
        self._runner: web.AppRunner | None = None
        self._subs: dict[tuple[str, str], _Subscription] = {}
        #: Players that have stopped taking subscriptions, and when that was
        #: last a warning, so a slow player is reported once rather than once
        #: per service per try (see _failed).
        self._failing: dict[str, float] = {}
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._any_handlers: list[EventHandler] = []
        self.bound_port: int | None = None
        self._callback_ip: str | None = None
        self._callback_lock = asyncio.Lock()
        #: Answered at /whoami by this listener alone; see _find_own_address.
        self._token = secrets.token_hex(16)

    # -- lifecycle -----------------------------------------------------------

    async def start(self) -> None:
        if self._own_session is None:
            self._own_session = aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(force_close=True))
            self._session = self._own_session
        app = web.Application()
        app.router.add_route("NOTIFY", "/notify/{host}/{service}", self._on_notify)
        app.router.add_get("/whoami", self._on_whoami)
        self._runner = web.AppRunner(app, access_log=None)
        await self._runner.setup()
        site = web.TCPSite(self._runner, "0.0.0.0", self._port)
        try:
            await site.start()
        except OSError as exc:
            if not self._port:
                raise
            # Something else has the port. Any port works on an open
            # network; behind a firewall the speakers' updates stop until
            # the rule names the new one, so it is said loudly.
            log.warning("event port %s is in use (%s); listening on a free port "
                        "instead, which a firewall may block (set SONORA_EVENT_PORT)",
                        self._port, exc)
            site = web.TCPSite(self._runner, "0.0.0.0", 0)
            await site.start()
        # Ask the socket what it actually got, since port 0 means "any".
        sockets = list(site._server.sockets or [])  # type: ignore[attr-defined]
        self.bound_port = sockets[0].getsockname()[1] if sockets else self._port
        log.info("event listener on port %s", self.bound_port)

    async def stop(self) -> None:
        await asyncio.gather(
            *(self.unsubscribe(host, name) for host, name in list(self._subs)),
            return_exceptions=True,
        )
        if self._runner is not None:
            await self._runner.cleanup()
            self._runner = None
        if self._own_session is not None:
            await self._own_session.close()
            self._own_session = None
            self._session = self._shared_session

    async def __aenter__(self) -> "EventListener":
        await self.start()
        return self

    async def __aexit__(self, *exc_info) -> None:
        await self.stop()

    # -- handlers ------------------------------------------------------------

    def on(self, service_name: str | None, handler: EventHandler) -> None:
        """Register a handler for one service, or for every service if ``None``."""
        if service_name is None:
            self._any_handlers.append(handler)
        else:
            self._handlers[service_name].append(handler)

    # -- subscriptions -------------------------------------------------------

    #: How long each address is given on each try, and how many are asked at
    #: once. The address that forwards here answers in milliseconds, so the
    #: first try is short and only addresses that never answer pay for it;
    #: the later, longer ones are for a port the VM has only just started
    #: forwarding. Docker Desktop relays every connection through the Mac,
    #: and 254 at once under one short deadline came back with nothing.
    SWEEP_TIMEOUTS_S = (0.5, 1.5)
    SWEEP_AT_ONCE = 64

    async def _on_whoami(self, request: web.Request) -> web.Response:
        return web.Response(text=self._token)

    async def _callback_address(self, host: str) -> str:
        """The address to give speakers for their NOTIFYs.

        Normally the kernel's own choice toward the speaker. When that address
        is not on the speaker's network, Sonora is behind a NAT the speakers
        cannot reach into (a container in Docker Desktop's VM on a Mac sees
        only the VM's addresses), and the address they can reach is the
        host's, found by _find_own_address.
        """
        local = local_ip_for(host)
        if on_own_link(host):
            return local
        for each in self.SWEEP_TIMEOUTS_S:
            found = await self._find_own_address(host, each)
            if found:
                log.info("speakers are not on this machine's network; NOTIFYs go to %s, "
                         "which forwards to this listener", found)
                return found
        log.warning("speakers are not on this machine's network and no address "
                    "near them forwards here; NOTIFYs go to %s, which they may not reach",
                    local)
        return local

    async def _find_own_address(self, host: str, each: float = 1.5) -> str | None:
        """An address on ``host``'s /24 that reaches this listener, if any.

        Each one is asked for /whoami on the event port; only a host that
        forwards that port here can answer with this listener's token.
        """
        network = ipaddress.ip_network(f"{host}/24", strict=False)
        limit = asyncio.Semaphore(self.SWEEP_AT_ONCE)

        async def ask(ip: str) -> str | None:
            async with limit:
                try:
                    async with self._session.get(
                        f"http://{ip}:{self.bound_port}/whoami",
                        timeout=aiohttp.ClientTimeout(total=each),
                    ) as resp:
                        return ip if resp.status == 200 and await resp.text() == self._token else None
                except Exception:
                    return None

        tasks = [asyncio.create_task(ask(str(ip))) for ip in network.hosts()]
        try:
            for done in asyncio.as_completed(tasks):
                if found := await done:
                    return found
        finally:
            for task in tasks:
                task.cancel()
        return None

    async def subscribe(self, host: str, service: Service, *, why: list | None = None) -> bool:
        """Subscribe to one service on one player, and keep it renewed.

        With ``why`` given (subscribe_many does), a failure is recorded there
        for one line about the player instead of being logged on its own.
        """
        if self.bound_port is None:
            raise RuntimeError("start() the listener before subscribing")
        if self._callback_ip is None:
            async with self._callback_lock:
                if self._callback_ip is None:
                    self._callback_ip = await self._callback_address(host)

        callback = (f"<http://{self._callback_ip}:{self.bound_port}"
                    f"/notify/{host}/{service.name}>")
        url = f"http://{host}:{SONOS_PORT}{service.event}"
        headers = {
            "CALLBACK": callback,
            "NT": "upnp:event",
            "TIMEOUT": f"Second-{SUBSCRIPTION_SECONDS}",
        }
        try:
            async with self._session.request(
                "SUBSCRIBE", url, headers=headers,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status != 200:
                    if why is not None:
                        why.append((service.name, f"HTTP {resp.status}"))
                    else:
                        self._failed(host, "SUBSCRIBE %s %s -> HTTP %s",
                                     host, service.name, resp.status)
                    return False
                sid = resp.headers.get("SID", "")
                timeout = _parse_timeout(resp.headers.get("TIMEOUT", ""))
        except Exception as exc:
            if why is not None:
                why.append((service.name, _why(exc)))
            else:
                self._failed(host, "SUBSCRIBE %s %s failed: %s", host, service.name, _why(exc))
            return False

        if not sid:
            return False
        sub = _Subscription(host=host, service=service, sid=sid, timeout=timeout)
        key = (host, service.name)
        old = self._subs.get(key)
        if old is not None and old.task is not None:
            old.task.cancel()
        self._subs[key] = sub
        sub.task = asyncio.create_task(
            self._renew_loop(sub), name=f"renew:{host}:{service.name}")
        log.debug("subscribed %s %s sid=%s timeout=%ss",
                  host, service.name, sid, timeout)
        return True

    async def subscribe_many(
        self, host: str, services: tuple[Service, ...]
    ) -> dict[str, bool]:
        failures: list[tuple[str, str]] = []
        results = await asyncio.gather(
            *(self.subscribe(host, s, why=failures) for s in services),
            return_exceptions=True,
        )
        # One line for the player: which services failed and why. A player
        # that answers slowly (a Connect on a weak link) failed all nine at
        # each try, nine warnings a time.
        if failures:
            reasons = sorted({reason for _, reason in failures})
            names = ", ".join(name for name, _ in failures)
            self._failed(host, "SUBSCRIBE %s failed for %d of %d services (%s): %s",
                         host, len(failures), len(services), names, "; ".join(reasons))
        else:
            self._failing.pop(host, None)
        return {
            s.name: (r is True)
            for s, r in zip(services, results)
        }

    #: How long a player that keeps failing stays quiet before it is a
    #: warning again.
    QUIET_S = 3600.0

    def _failed(self, host: str, message: str, *args) -> None:
        """Log a player's failed subscription: a warning the first time, and
        only a note while it goes on failing, whatever the reason this time.

        A speaker on a weak wireless link timed out one try, refused the
        connection the next, and failed the renewals one service at a time,
        and each of those had been a fresh warning: 98 of the error log's 100
        entries in a day were one speaker, and pushed out everything else. It
        is a warning again once every subscription to it has succeeded, or
        after an hour of failing.
        """
        now = monotonic()
        warned = self._failing.get(host)
        if warned is not None and now - warned < self.QUIET_S:
            log.info(message, *args)
            return
        self._failing[host] = now
        log.warning(message, *args)

    async def unsubscribe(self, host: str, service_name: str) -> None:
        sub = self._subs.pop((host, service_name), None)
        if sub is None:
            return
        if sub.task is not None:
            sub.task.cancel()
        url = f"http://{host}:{SONOS_PORT}{sub.service.event}"
        try:
            async with self._session.request(
                "UNSUBSCRIBE", url, headers={"SID": sub.sid},
                timeout=aiohttp.ClientTimeout(total=5),
            ):
                pass
        except Exception:
            pass  # the speaker will time us out anyway

    async def _renew_loop(self, sub: _Subscription) -> None:
        url = f"http://{sub.host}:{SONOS_PORT}{sub.service.event}"
        while True:
            delay = max(30, sub.timeout - RENEW_MARGIN)
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return
            try:
                async with self._session.request(
                    "SUBSCRIBE", url,
                    headers={"SID": sub.sid,
                             "TIMEOUT": f"Second-{SUBSCRIPTION_SECONDS}"},
                    timeout=aiohttp.ClientTimeout(total=8),
                ) as resp:
                    if resp.status == 200:
                        sub.timeout = _parse_timeout(
                            resp.headers.get("TIMEOUT", ""))
                        continue
                    log.info("renewal for %s %s rejected (HTTP %s), resubscribing",
                             sub.host, sub.service.name, resp.status)
            except Exception as exc:
                log.info("renewal for %s %s failed (%s), resubscribing",
                         sub.host, sub.service.name, _why(exc))
            # A rejected renewal means the speaker forgot us, usually after a
            # reboot. Start a fresh subscription and retire this loop.
            asyncio.create_task(self.subscribe(sub.host, sub.service))
            return

    # -- inbound NOTIFY ------------------------------------------------------

    async def _on_notify(self, request: web.Request) -> web.Response:
        host = request.match_info["host"]
        service = request.match_info["service"]
        # A player that hangs up in the middle of its own NOTIFY is not a
        # fault worth a traceback: it happens when one reboots, drops off the
        # air or is power-cycled with an event half sent, and aiohttp's own
        # handler prints the whole stack for it (one speaker did it fifteen
        # times in a day). The event is simply lost; the
        # next one arrives with the state anyway.
        try:
            body = await request.text()
        except (OSError, asyncio.IncompleteReadError, asyncio.TimeoutError) as exc:
            log.info("NOTIFY from %s %s cut short: %s", host, service, _why(exc))
            return web.Response(status=200)
        seq = int(request.headers.get("SEQ", 0) or 0)
        try:
            event = parse_notify(host, service, body, seq)
        except Exception as exc:
            log.warning("unparseable NOTIFY from %s %s: %s", host, service, exc)
            return web.Response(status=200)

        for handler in (*self._handlers.get(service, ()), *self._any_handlers):
            try:
                result = handler(event)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                log.exception("event handler failed for %s %s", host, service)
        return web.Response(status=200)


def _parse_timeout(header: str) -> int:
    if header.lower().startswith("second-"):
        try:
            return int(header.split("-", 1)[1])
        except ValueError:
            pass
    return SUBSCRIPTION_SECONDS


def parse_notify(host: str, service: str, body: str, seq: int = 0) -> Event:
    """Normalize a GENA NOTIFY body into an ``Event``."""
    event = Event(host=host, service=service, seq=seq)
    root = _lenient_fromstring(body)

    for prop in root.iter():
        tag = _localname(prop.tag)
        if tag not in ("property",):
            continue
        for child in prop:
            name = _localname(child.tag)
            if name == "LastChange":
                # Normally escaped text. Handle the element form too rather
                # than silently recording an empty property.
                if (child.text or "").strip():
                    _merge_last_change(event, child.text)
                elif len(child):
                    for node in child:
                        _merge_instance(event, node)
                continue
            event.properties[name] = child.text or ""
    return event


def _merge_last_change(event: Event, payload: str) -> None:
    """Unpack the document that renderer services hide state inside.

    The XML parser has already decoded one layer of escaping by the time the
    text reaches us, so decoding again would eat the escaping on the track
    metadata nested inside and corrupt it. Only decode when the payload has
    genuinely arrived still escaped.
    """
    text = payload.strip()
    if not text.startswith("<"):
        text = unescape(text)
    inner = _lenient_fromstring(text)
    for instance in inner:
        _merge_instance(event, instance)


def _merge_instance(event: Event, instance) -> None:
    """Flatten one ``InstanceID`` or ``QueueID`` block into the event."""
    if _localname(instance.tag) not in ("InstanceID", "QueueID"):
        return
    for node in instance:
        name = _localname(node.tag)
        value = node.get("val")
        if value is None:
            continue
        channel = node.get("channel")
        if channel:
            event.channels.setdefault(channel, {})[name] = value
            # Master is the value a controller shows, so promote it.
            if channel == "Master":
                event.properties[name] = value
        else:
            event.properties[name] = value


def _lenient_fromstring(text: str):
    """Parse XML that a speaker may have emitted slightly wrong.

    Sonos does not always escape ampersands inside track titles and stream
    descriptions, which is fatal to a strict parser. Rather than lose the whole
    event, repair bare ampersands and try once more.
    """
    try:
        return DET.fromstring(text)
    except Exception:
        repaired = _BARE_AMP.sub("&amp;", text)
        return DET.fromstring(repaired)


#: An ampersand that does not begin a valid entity reference.
_BARE_AMP = re.compile(r"&(?!#\d+;|#x[0-9a-fA-F]+;|[A-Za-z][A-Za-z0-9]*;)")


def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]
