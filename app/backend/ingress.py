"""Home Assistant's ingress: Sonora's page inside Home Assistant.

The Home Assistant app (homeassistant/sonora/) shows Sonora in Home
Assistant's sidebar. Home Assistant serves an app's page through its own
proxy, at ``/api/hassio_ingress/<token>/`` on Home Assistant's address, and
its Supervisor passes each request on with the prefix taken off. Two facts
about such a request come in headers:

* ``X-Ingress-Path`` is the prefix the browser sees. The page needs it, or
  every ``/api/...`` it asks for goes to Home Assistant's own API. The index
  carries it to the page in a meta tag (frontend/src/lib/base.js).
* ``X-Forwarded-Host`` is the name the browser used for Home Assistant, which
  is what a browser's ``Origin`` names. ``Host`` names the Supervisor's way
  in, so a write from the page would fail the same-origin check against it.

Headers are anyone's to send, so they count only when the app said so
(``SONORA_HA_INGRESS``, set in its config) and the request came from the
Supervisor's own address on Home Assistant's internal network, which nothing
outside that machine can use. Home Assistant has signed the person in by then.
"""
from __future__ import annotations

import html
import ipaddress
import os
import re

#: The Supervisor's address on Home Assistant's internal network, which every
#: ingress request comes from.
SUPERVISOR = ipaddress.ip_address("172.30.32.2")

_PREFIX = re.compile(r"/api/hassio_ingress/[A-Za-z0-9_-]+")


def enabled() -> bool:
    return os.environ.get("SONORA_HA_INGRESS", "").strip().lower() in {"1", "true", "yes"}


def client_host(connection) -> str | None:
    """The address a request or socket came from, if it says."""
    client = getattr(connection, "client", None)
    return client.host if client else None


def _from_supervisor(client_host: str | None) -> bool:
    try:
        return ipaddress.ip_address(client_host or "") == SUPERVISOR
    except ValueError:
        return False


def prefix(headers, client_host: str | None) -> str:
    """The ingress path this request came through, or '' if it did not."""
    if not enabled() or not _from_supervisor(client_host):
        return ""
    path = (headers.get("x-ingress-path") or "").strip().rstrip("/")
    return path if _PREFIX.fullmatch(path) else ""


def browser_host(headers, client_host: str | None) -> str:
    """The host the browser addressed: Home Assistant's, through ingress."""
    if prefix(headers, client_host):
        forwarded = (headers.get("x-forwarded-host") or "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return headers.get("host", "")


def tag_page(body: bytes, path: str) -> bytes:
    """index.html with the ingress path in it for the page to find."""
    if not path:
        return body
    tag = f'<meta name="sonora-base" content="{html.escape(path, quote=True)}" />'
    return body.replace(b"<head>", b"<head>\n    " + tag.encode(), 1)
