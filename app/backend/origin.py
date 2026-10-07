"""Other websites may not drive Sonora through your browser.

Sonora has no login. Anyone who can reach it on the network can drive it, and
that is the deliberate shape of the thing: it is a controller for the speakers
in your house, on the network those speakers are on, and asking a household to
invent a password for their stereo is not the trade being made. That decision
is written down in SECURITY.md.

What that model does *not* extend to is a website deciding to drive it. A page
on the internet cannot reach a machine on your LAN by itself -- but your
browser can, and a page can ask your browser to. Two ways in, both measured
against the real Sonora:

* **A WebSocket from anywhere was accepted.** Sockets are not subject to the
  same-origin policy, so `https://evil.example` could open `/ws` and was sent
  the household snapshot on connect: every room, what each is playing, and the
  uuid of each.
* **A body-less POST from anywhere acted.** `POST /api/refresh` answered 200
  to a cross-origin request, and routes like
  `/api/zones/{uuid}/transport/{action}` take everything they need in the
  path, so they need no JSON body and so no preflight stands in the way. The
  uuid comes from the socket above.

So: any page, visited by anyone in the house, could read the household and
then control it.

The fix is not authentication, which would change what Sonora is. It is that a
request carrying an `Origin` from somewhere other than Sonora itself is
refused. A browser sets `Origin` on exactly the requests that matter here --
cross-origin writes, and every WebSocket handshake -- and never lets a page
forge it. A request with no `Origin` at all is left alone: that is curl, a
script, another program on the LAN, and the model above says those are welcome.

That check compares `Origin` with `Host`, and a page can make the two agree.
**DNS rebinding** (found in review): `evil.example` answers its
first lookup with its own server and the next with Sonora's LAN address. The
page then talks to Sonora as `http://evil.example:50205`, with a matching
`Host`, and is same-origin with it: it can read the household and drive it.
So the name a request was sent to must also be one of Sonora's own: an
address, `localhost`, a single-label or local-only name (`sonora`,
`sonora.local`, `sonora.lan`, `sonora.home.arpa`), this machine's own name, or
one listed in ``SONORA_ALLOWED_HOSTS``. A rebinding page has to use a name it
controls, which is a public one, and none of those are.
"""
from __future__ import annotations

import ipaddress
import logging
import os
import socket
from functools import lru_cache
from urllib.parse import urlsplit

from fastapi import Request
from fastapi.responses import JSONResponse, Response

log = logging.getLogger(__name__)

#: Methods that only read. A cross-origin GET is already useless to a page --
#: Sonora sends no CORS headers, so the browser will not let it read the
#: answer -- and blocking it would break an <img> or an <audio> that points at
#: Sonora from a page of the household's own.
READS = frozenset({"GET", "HEAD", "OPTIONS"})


def _host_of(value: str) -> str:
    """The host:port an Origin or Host header names, lowercased."""
    text = (value or "").strip()
    if not text:
        return ""
    if "://" in text:
        parts = urlsplit(text)
        return (parts.netloc or "").lower()
    return text.lower()


def is_same_origin(origin: str, host: str) -> bool:
    """Whether an Origin header belongs to the Sonora being addressed.

    Compared against the request's own Host, so it holds however Sonora was
    reached -- an address, a name, an mDNS name, a tunnel -- without Sonora
    having to be told what it is called.
    """
    origin_host = _host_of(origin)
    if not origin_host:
        return True          # no Origin: not a browser doing this
    if origin.strip().lower() == "null":
        return False         # a sandboxed frame, or a file:// page
    return origin_host == _host_of(host)


#: Suffixes no one can register publicly, so a rebinding page cannot use them.
LOCAL_SUFFIXES = (".local", ".lan", ".home", ".internal", ".home.arpa",
                  ".localhost", ".localdomain")


def _hostname(host: str) -> str:
    """The name in a Host header, without its port or IPv6 brackets."""
    text = _host_of(host)
    if text.startswith("["):
        return text[1:text.find("]")] if "]" in text else text[1:]
    if text.count(":") == 1:
        text = text.split(":", 1)[0]
    return text.rstrip(".")


@lru_cache(maxsize=1)
def _own_names() -> frozenset[str]:
    names = set()
    for name in (socket.gethostname(), socket.getfqdn()):
        if name:
            names.add(name.lower().rstrip("."))
    return frozenset(names)


def _configured() -> tuple[str, ...]:
    """``SONORA_ALLOWED_HOSTS``: comma-separated names; ``.example.net``
    allows every name under it."""
    raw = os.environ.get("SONORA_ALLOWED_HOSTS", "")
    return tuple(part.strip().lower().rstrip(".") for part in raw.split(",")
                 if part.strip())


def is_allowed_host(host: str) -> bool:
    """Whether a request's Host names Sonora rather than someone's website."""
    name = _hostname(host)
    if not name:
        return True          # no Host: not a browser doing this
    try:
        ipaddress.ip_address(name.split("%", 1)[0])
        return True
    except ValueError:
        pass
    if "." not in name or name == "localhost" or name.endswith(LOCAL_SUFFIXES):
        return True
    if name in _own_names():
        return True
    for allowed in _configured():
        if allowed.startswith("."):
            if name.endswith(allowed) or name == allowed[1:]:
                return True
        elif name == allowed:
            return True
    return False


_warned_hosts: set[str] = set()


def _refuse_host(host: str):
    name = _hostname(host)[:80]
    if name not in _warned_hosts:
        _warned_hosts.add(name)
        log.warning("refused requests addressed to %s; if that is Sonora's own "
                    "name, add it to SONORA_ALLOWED_HOSTS", name)
    return JSONResponse(
        {"detail": f"Sonora does not answer to the name {name}. "
                   "If this is its own name, add it to SONORA_ALLOWED_HOSTS."},
        status_code=403)


async def guard(request: Request, call_next):
    """Refuse a request sent to a name that is not Sonora's, and a write that
    some other website asked the browser to make."""
    host = request.headers.get("host", "")
    if not is_allowed_host(host):
        return _refuse_host(host)
    origin = request.headers.get("origin", "")
    if request.method not in READS and not is_same_origin(
            origin, request.headers.get("host", "")):
        log.warning("refused a %s to %s from origin %s",
                    request.method, request.url.path, origin[:60])
        return JSONResponse(
            {"detail": "that request came from another website"}, status_code=403)
    try:
        return await call_next(request)
    except RuntimeError as exc:
        # A browser that leaves before the answer (a phone locking its
        # screen, a page reloaded while Sonora was still reading the
        # services) left Starlette with nothing to send, and the whole stack
        # traced as a 500 in the log. Nobody is waiting for a reply,
        # so a quiet one stands in.
        if str(exc) == "No response returned." and await request.is_disconnected():
            return Response(status_code=499)
        raise


def websocket_allowed(websocket) -> bool:
    """Whether to accept this socket.

    Every browser sends `Origin` on the handshake, so this is the whole of the
    check for a page; a program opening a socket sends none and is allowed, as
    it is over HTTP.
    """
    host = websocket.headers.get("host", "")
    return is_allowed_host(host) and is_same_origin(
        websocket.headers.get("origin", ""), host)
