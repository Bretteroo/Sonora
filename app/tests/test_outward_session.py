"""Fetches a caller can aim stay off this machine, redirects included.

The stream proxy checked the URL it was given and then followed whatever
redirect the server sent, to 127.0.0.1 as readily as anywhere; and a name
could resolve to a LAN address for the check and to loopback for the
connection (found in review).
"""

import asyncio
import socket
from types import SimpleNamespace

import pytest
from yarl import URL

from backend.sonos import fetchguard


def _hop(url):
    called = []

    async def handler(request):
        called.append(str(request.url))
        return "answered"

    result = asyncio.run(fetchguard._every_hop(SimpleNamespace(url=URL(url)), handler))
    return result, called


@pytest.mark.parametrize("url", [
    "http://127.0.0.1:9931/private", "http://[::1]/", "http://169.254.169.254/latest",
    "http://0.0.0.0:50205/", "file:///etc/passwd",
])
def test_a_hop_to_this_machine_is_refused(url):
    with pytest.raises(fetchguard.Refused):
        _hop(url)


@pytest.mark.parametrize("url", ["http://10.0.0.5:1400/getaa", "https://radio.example/stream"])
def test_a_hop_elsewhere_goes_ahead(url):
    assert _hop(url) == ("answered", [url])


def _resolver(answers):
    resolver = fetchguard.GuardedResolver.__new__(fetchguard.GuardedResolver)

    async def base(self, host, port=0, family=socket.AF_INET):
        return [{"hostname": host, "host": a, "port": port, "family": family,
                 "proto": 0, "flags": 0} for a in answers]

    return resolver, base


def test_a_name_that_resolves_to_loopback_is_refused(monkeypatch):
    resolver, base = _resolver(["127.0.0.1"])
    monkeypatch.setattr(fetchguard.DefaultResolver, "resolve", base)
    with pytest.raises(fetchguard.Refused):
        asyncio.run(resolver.resolve("rebind.example", 80))


def test_loopback_answers_are_dropped_from_a_mixed_lookup(monkeypatch):
    resolver, base = _resolver(["127.0.0.1", "203.0.113.7"])
    monkeypatch.setattr(fetchguard.DefaultResolver, "resolve", base)
    kept = asyncio.run(resolver.resolve("mixed.example", 80))
    assert [entry["host"] for entry in kept] == ["203.0.113.7"]
