"""Sonora fetches on a caller's behalf, and must not be aimed at its own host.

Found while auditing before launch. `/api/stream?uri=` took any
URL the caller wrote and Sonora fetched it: a request from another machine on
the LAN reached a service bound to 127.0.0.1 on Sonora's host -- unreachable
to the caller, reachable to Sonora -- and, because a response that parses as a
playlist is read and its first URL handed back, a line of that service's body
came back in the answer. The same aim reached 169.254.169.254.

The line is the machine, not the network. The LAN is where the speakers and a
music share live and where the caller already is; loopback and link-local are
Sonora's alone.
"""

from __future__ import annotations

import pytest

from backend.sonos import fetchguard


@pytest.mark.parametrize("url", [
    "http://127.0.0.1:9931/private",
    "http://127.0.0.1/",
    "http://localhost:8080/admin",
    "http://[::1]/",
    "http://0.0.0.0:80/",
    # The cloud metadata endpoint, which is the reason link-local is in here.
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "http://[fe80::1]/",
])
def test_sonoras_own_machine_is_refused(url):
    assert fetchguard.safe_to_fetch(url) is False


@pytest.mark.parametrize("url", [
    "file:///etc/passwd",
    "gopher://127.0.0.1:11211/",
    "ftp://example.com/x",
    "",
    "not a url at all",
    "http://",
])
def test_only_http_is_fetched(url):
    assert fetchguard.safe_to_fetch(url) is False


def test_a_name_that_does_not_resolve_is_refused():
    """It could not be fetched anyway; refusing here keeps the failure on this
    side of the network rather than in a socket timeout."""
    assert fetchguard.safe_to_fetch("https://nothing.invalid/stream.mp3") is False


@pytest.mark.parametrize("address,own", [
    ("127.0.0.1", True), ("127.1.2.3", True), ("::1", True),
    ("169.254.169.254", True), ("fe80::1", True),
    ("0.0.0.0", True), ("224.0.0.1", True),
    # The LAN is the product: the speakers are there, and so is the caller.
    ("192.168.0.104", False), ("10.0.0.5", False), ("172.16.3.9", False),
    ("8.8.8.8", False),
])
def test_where_the_line_is_drawn(address, own):
    import ipaddress
    assert fetchguard.is_own_machine(ipaddress.ip_address(address)) is own


def test_every_address_of_a_name_is_checked():
    """A name answering with a public address and 127.0.0.1 must not pass on
    the strength of the public one."""
    import ipaddress
    mixed = [ipaddress.ip_address("93.184.216.34"), ipaddress.ip_address("127.0.0.1")]
    assert any(fetchguard.is_own_machine(a) for a in mixed)
