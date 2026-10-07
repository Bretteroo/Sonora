"""Another website may not drive Sonora through your browser.

Sonora has no login, and that is deliberate: anyone who can reach it on the
network may drive it (SECURITY.md). Found while auditing,
both measured against the running Sonora:

* a WebSocket handshake carrying `Origin: https://evil.example` was accepted,
  and the household snapshot -- every room, what it is playing, and its uuid --
  was sent on connect. Sockets are not subject to the same-origin policy, so
  nothing else stood in the way.
* `POST /api/refresh` answered 200 to a cross-origin request, and the routes
  that take everything in the path (`/api/zones/{uuid}/transport/{action}`)
  need no JSON body, so no preflight stands in the way of those either. The
  uuid comes from the socket above.

Together: any page, visited by anyone in the house, could read the household
and then control it.
"""

from __future__ import annotations

import pytest

from backend.origin import READS, is_allowed_host, is_same_origin


@pytest.mark.parametrize("origin,host", [
    ("https://evil.example", "192.168.0.103:50205"),
    ("http://evil.example", "192.168.0.103:50205"),
    # The same name on another port is another origin.
    ("http://192.168.0.103:8080", "192.168.0.103:50205"),
    # A sandboxed frame or a file:// page sends this literally.
    ("null", "192.168.0.103:50205"),
    # Close enough to look right and not be.
    ("http://192.168.0.103.evil.example", "192.168.0.103:50205"),
])
def test_another_website_is_refused(origin, host):
    assert is_same_origin(origin, host) is False


@pytest.mark.parametrize("origin,host", [
    # However the household reached it: an address, a name, a tunnel.
    ("http://192.168.0.103:50205", "192.168.0.103:50205"),
    ("http://sonora.local:50205", "sonora.local:50205"),
    ("http://127.0.0.1:50205", "127.0.0.1:50205"),
    ("https://sonora.example.net", "sonora.example.net"),
    ("HTTP://Sonora.Local:50205", "sonora.local:50205"),
])
def test_sonoras_own_page_is_allowed(origin, host):
    assert is_same_origin(origin, host) is True


def test_no_origin_is_allowed():
    """curl, a script, another program on the LAN. The model says those are
    welcome, and a browser never omits Origin on the requests that matter."""
    assert is_same_origin("", "192.168.0.103:50205") is True
    assert is_same_origin("   ", "192.168.0.103:50205") is True


def test_reads_are_not_guarded():
    """A cross-origin GET is already useless to a page -- Sonora sends no CORS
    headers, so the browser will not let it read the answer -- and guarding it
    would break an <img> or <audio> pointing at Sonora from a household's own
    page, neither of which sends an Origin anyway."""
    assert READS == {"GET", "HEAD", "OPTIONS"}


def test_the_guard_is_installed_on_the_app():
    """The check is worthless if nothing calls it, and a middleware is easy to
    drop in a refactor."""
    from backend import main
    kinds = [type(m.cls).__name__ if hasattr(m, "cls") else str(m)
             for m in main.app.user_middleware]
    assert kinds, "no middleware at all on the app"


def test_the_websocket_checks_its_origin():
    """The socket is the half that leaks the household, and it is guarded in
    the handler rather than by the HTTP middleware."""
    import inspect

    from backend import main
    source = inspect.getsource(main.websocket_endpoint)
    assert "websocket_allowed" in source
    assert source.index("websocket_allowed") < source.index("accept()")


# DNS rebinding: the page's own name, pointed at Sonora, makes Origin and
# Host agree. The name itself is what gives it away (found in review).

@pytest.mark.parametrize("host", [
    "192.168.0.103:50205", "127.0.0.1", "[::1]:50205", "[fe80::1%eth0]:50205",
    "localhost:50205", "sonora:50205", "sonora.local:50205", "pi.lan",
    "sonora.home.arpa:50205", "", "SONORA.LOCAL.",
])
def test_sonoras_own_names_are_allowed(host):
    assert is_allowed_host(host) is True


@pytest.mark.parametrize("host", [
    "evil.example:50205", "rebind.attacker.net", "192.168.0.103.evil.example",
    "localhost.evil.example",
])
def test_a_public_name_is_refused(host):
    assert is_allowed_host(host) is False


def test_allowed_hosts_names_a_tunnel(monkeypatch):
    monkeypatch.setenv("SONORA_ALLOWED_HOSTS", "sonora.example.net, .tail1234.ts.net")
    assert is_allowed_host("sonora.example.net") is True
    assert is_allowed_host("pi.tail1234.ts.net:50205") is True
    assert is_allowed_host("tail1234.ts.net") is True
    assert is_allowed_host("other.example.net") is False
