"""Where Sonora may not be sent.

Sonora fetches URLs on behalf of whoever is driving it: a station's stream, a
playlist that has to be read to find the stream inside it, a picture. Some of
those URLs arrive from the caller. That makes Sonora a fetching engine sitting
inside the network, and the caller can aim it.

Aiming it *at the LAN* is the product: the speakers are there, a music library
share is there, a radio bridge may be. The caller is on that LAN too, so it
buys them nothing they did not already have.

Aiming it at the machine Sonora runs on is different. `127.0.0.1` is
Sonora's own loopback, not the caller's, and whatever else that machine runs
for itself -- another app's admin port, a database, a metadata service on
`169.254.169.254` -- is reachable from here and from nowhere else. Measured
before the fix: a request to `/api/stream?uri=http://127.0.0.1:9931/private` from
another machine on the LAN fetched a loopback-only service and returned a line
of its body in the answer, because a response that parses as a playlist is read
and its first URL handed back.

So the line drawn here is the machine, not the network: loopback, link-local,
the unspecified address and the reserved ranges are refused, and the LAN is
left alone.

Checking a URL before fetching it is not the whole of it (found in
review). The server that answers can redirect, and the fetch followed the
redirect unchecked; and a name can resolve to one address for the check and
another for the connection. So the fetches a caller can aim go through
``outward_session()``: every hop is checked as it is made, and every address
a name resolves to is checked at the moment of connecting.
"""
from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urlsplit

import aiohttp
from aiohttp.resolver import DefaultResolver

log = logging.getLogger(__name__)

#: Schemes Sonora will fetch at all. A `file://` or `gopher://` reaching a
#: fetch is a bug somewhere upstream; it stops here either way.
SCHEMES = ("http", "https")


def _addresses(host: str) -> list[ipaddress._BaseAddress]:
    """Every address a host resolves to, or [] if it resolves to none.

    All of them are checked, not the first: a name that answers with both a
    public address and 127.0.0.1 is a way to pass a check that looks at one.
    """
    try:
        return [ipaddress.ip_address(host.strip("[]"))]
    except ValueError:
        pass
    try:
        found = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError, ValueError):
        return []
    out = []
    for entry in found:
        try:
            out.append(ipaddress.ip_address(entry[4][0]))
        except ValueError:
            continue
    return out


def is_own_machine(address: ipaddress._BaseAddress) -> bool:
    """Whether this address belongs to the machine Sonora runs on, or to
    something only that machine can see."""
    return bool(
        address.is_loopback        # 127.0.0.0/8, ::1
        or address.is_link_local   # 169.254.0.0/16 (cloud metadata), fe80::/10
        or address.is_unspecified  # 0.0.0.0, ::
        or address.is_multicast
        or address.is_reserved,
    )


def safe_host(host: str) -> bool:
    """Whether a host, named or numbered, is somewhere other than this machine."""
    addresses = _addresses(host or "")
    return bool(addresses) and not any(is_own_machine(a) for a in addresses)


def safe_to_fetch(url: str) -> bool:
    """Whether Sonora may fetch this URL on a caller's behalf.

    A host that cannot be resolved is refused: it cannot be fetched anyway,
    and refusing it here keeps the failure on this side of the network.
    """
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    if parts.scheme.lower() not in SCHEMES or not parts.hostname:
        return False
    addresses = _addresses(parts.hostname)
    if not addresses:
        return False
    return not any(is_own_machine(address) for address in addresses)


def refuse(url: str, why: str = "") -> None:
    """Note a refusal without putting the whole URL in the log."""
    log.warning("refused to fetch %s%s", url[:60], f": {why}" if why else "")


class Refused(aiohttp.ClientConnectionError):
    """A fetch that would have reached this machine, stopped before it did."""


class GuardedResolver(DefaultResolver):
    """Resolves as usual and drops every address on this machine, so a name
    that answered with a LAN address for the check cannot answer with
    127.0.0.1 for the connection."""

    async def resolve(self, host, port=0, family=socket.AF_INET):
        found = await super().resolve(host, port, family)
        kept = [entry for entry in found
                if not is_own_machine(ipaddress.ip_address(entry["host"].split("%", 1)[0]))]
        if not kept:
            raise Refused(f"{host} resolves only to this machine")
        return kept


async def _every_hop(request, handler):
    """Checks each request the session makes, redirects included. A name is
    left to the resolver; an address is checked here, as the resolver never
    sees one."""
    url = request.url
    if (url.scheme or "").lower() not in SCHEMES or not url.host:
        raise Refused(f"not a place Sonora fetches from: {str(url)[:60]}")
    try:
        address = ipaddress.ip_address(url.host.strip("[]").split("%", 1)[0])
    except ValueError:
        address = None
    if address is not None and is_own_machine(address):
        refuse(str(url), "a hop to this machine")
        raise Refused(f"refused to fetch {str(url)[:60]}")
    return await handler(request)


def outward_session() -> aiohttp.ClientSession:
    """The session for fetches a caller can aim: streams and pictures."""
    return aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(resolver=GuardedResolver()),
        middlewares=(_every_hop,))
