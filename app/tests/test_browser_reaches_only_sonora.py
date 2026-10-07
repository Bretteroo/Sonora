"""The browser is not required to be able to reach the speakers.

Sonora is the thing on the speakers' network; the browser need not be. A phone
on mobile data, a guest network or a different VLAN, or a browser reaching
Sonora through a tunnel, all have to work -- so everything the page fetches has
to come from Sonora's own origin.

It fails badly rather than gracefully when it does not: a request to a speaker
the browser cannot route to is not refused, it is swallowed until the
connection times out, so the page hangs and the art never arrives with nothing
to say why.

Measured before the fix: one page load fetched 28 times from
Sonora and 14 times straight from a speaker, because the queue's art came back
as an absolute ``http://<speaker>:1400/getaa`` URL.
"""

from __future__ import annotations

import pathlib
import re

import pytest

from backend.sonos.didl import DidlItem, proxied

FRONTEND = pathlib.Path(__file__).resolve().parent.parent / "frontend/src"


def test_speaker_art_is_handed_over_proxied():
    item = DidlItem(id="x", parent_id="", title="t", art_uri="/getaa?s=1&u=abc")
    art = item.as_dict(host="192.168.0.104")["art"]
    assert art.startswith("/api/art?u="), art
    assert "192.168.0.104" not in art.split("u=")[0], "the host may only be inside the parameter"


def test_a_providers_own_url_is_left_alone():
    """It is not on the speakers' network, so the proxy has nothing to add."""
    item = DidlItem(id="x", parent_id="", title="t",
                    art_uri="https://art.example/cover.jpg")
    assert item.as_dict(host="192.168.0.104")["art"] == "https://art.example/cover.jpg"


def test_an_item_with_no_art_stays_empty():
    item = DidlItem(id="x", parent_id="", title="t", art_uri="")
    assert item.as_dict(host="192.168.0.104")["art"] == ""


@pytest.mark.parametrize("url", [
    "http://192.168.0.104:1400/getaa?s=1&u=x%3ay",
    "https://art.example/cover.jpg?a=1&b=2",
])
def test_proxying_is_idempotent(url):
    once = proxied(url)
    assert proxied(once) == once, "wrapping twice must not double-wrap"


def test_the_whole_url_survives_the_round_trip():
    """The query is what identifies the art, so it has to arrive intact."""
    from urllib.parse import parse_qs, urlparse

    original = "http://192.168.0.104:1400/getaa?s=1&u=x-sonos-http%3aabc%3fsid%3d212"
    got = parse_qs(urlparse(proxied(original)).query)["u"][0]
    assert got == original


def test_no_frontend_file_builds_a_speaker_url_for_rendering():
    """A `:1400` address in a src or href is the shape of this bug."""
    offenders = []
    for path in FRONTEND.rglob("*.jsx"):
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"(src|href)=\{([^}]*:1400[^}]*)\}", text):
            offenders.append(f"{path.relative_to(FRONTEND)}: {match.group(0)[:70]}")
    assert not offenders, offenders


def test_a_services_rating_icon_may_be_served_back():
    """The picture a rating button draws is Sonora's to hand over.

    Routing those icons through ``/api/art`` left every rating
    button in the desktop-family themes a broken image: the icons live on
    Sonos' own asset host, no zone reports them, and the allow-list had no
    reason to know them. They are now vouched for where they are read, which
    is the one place every service's rating map passes through.
    """
    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    ctl.zones = {}
    ctl._vouched_art = {}
    icon = "https://integration-image-assets.ws.sonos.com/ratings-icons/THUMBSUP_UNSELECTED.png"
    assert not ctl.art_url_allowed(icon)
    ctl.remember_picture(icon)
    assert ctl.art_url_allowed(icon)


def test_vouching_drops_the_oldest_picture_first():
    """A set dropped an arbitrary one, which could be the one on screen."""
    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    ctl.zones = {}
    ctl._vouched_art = {}
    for n in range(300):
        ctl.remember_picture(f"https://art.example/{n}.png")
    assert not ctl.art_url_allowed("https://art.example/0.png")
    assert ctl.art_url_allowed("https://art.example/299.png")


def test_a_picture_that_is_not_a_url_is_not_vouched_for():
    from backend.sonos.controller import SonosController

    ctl = SonosController.__new__(SonosController)
    ctl.zones = {}
    ctl._vouched_art = {}
    ctl.remember_picture("file:///etc/passwd")
    assert not ctl.art_url_allowed("file:///etc/passwd")
