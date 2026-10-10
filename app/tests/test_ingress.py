"""Sonora inside Home Assistant, through its ingress proxy.

Home Assistant serves the app's page at /api/hassio_ingress/<token>/ on its
own address. The page has to be told that prefix, and a write from it carries
Home Assistant's Origin, which the same-origin check has to accept. Neither
may be something any other request can claim by sending a header.
"""

from __future__ import annotations

import pytest
from starlette.requests import Request
from starlette.responses import Response

from backend import ingress, origin

PATH = "/api/hassio_ingress/AbC123_-xyz"
SUPERVISOR = "172.30.32.2"
HEADERS = {"x-ingress-path": PATH, "x-forwarded-host": "homeassistant.local:8123",
           "host": "172.30.32.1:50205"}


@pytest.fixture
def addon(monkeypatch):
    monkeypatch.setenv("SONORA_HA_INGRESS", "1")


def test_the_prefix_counts_from_the_supervisor_in_the_addon(addon):
    assert ingress.prefix(HEADERS, SUPERVISOR) == PATH


def test_the_prefix_is_ignored_outside_the_addon(monkeypatch):
    monkeypatch.delenv("SONORA_HA_INGRESS", raising=False)
    assert ingress.prefix(HEADERS, SUPERVISOR) == ""


@pytest.mark.parametrize("client", ["192.168.1.50", "172.30.32.1", "127.0.0.1", None, "testclient"])
def test_the_prefix_is_ignored_from_anyone_else(addon, client):
    assert ingress.prefix(HEADERS, client) == ""


@pytest.mark.parametrize("path", [
    "/elsewhere", "/api/hassio_ingress/", "/api/hassio_ingress/a/b",
    '/api/hassio_ingress/x"><script>', "https://evil.example/api/hassio_ingress/x",
])
def test_only_an_ingress_path_is_taken(addon, path):
    assert ingress.prefix({**HEADERS, "x-ingress-path": path}, SUPERVISOR) == ""


def test_the_page_is_tagged_with_the_prefix():
    page = b"<!doctype html>\n<html><head>\n<title>Sonora</title></head></html>"
    tagged = ingress.tag_page(page, PATH)
    assert f'<meta name="sonora-base" content="{PATH}" />'.encode() in tagged
    assert ingress.tag_page(page, "") == page


async def _post(client, headers):
    """What the guard answers a POST to /api/refresh."""
    scope = {"type": "http", "method": "POST", "path": "/api/refresh",
             "headers": [(k.encode(), v.encode()) for k, v in headers.items()],
             "client": (client, 40000), "query_string": b""}

    async def ok(_request):
        return Response(status_code=200)

    return (await origin.guard(Request(scope), ok)).status_code


async def test_a_write_from_home_assistants_page_is_allowed(addon):
    assert await _post(SUPERVISOR, {**HEADERS, "origin": "http://homeassistant.local:8123"}) == 200


async def test_another_website_is_still_refused_through_ingress(addon):
    assert await _post(SUPERVISOR, {**HEADERS, "origin": "https://evil.example"}) == 403


async def test_a_forwarded_host_from_anyone_else_proves_nothing(addon):
    """A page cannot pick its own source address, so only the Supervisor's
    word on the browser's host counts."""
    assert await _post("192.168.1.50", {
        "host": "192.168.1.20:50205", "origin": "https://evil.example",
        "x-ingress-path": PATH, "x-forwarded-host": "evil.example"}) == 403
