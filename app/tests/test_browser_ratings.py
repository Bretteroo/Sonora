"""The browser room's rating buttons.

No speaker plays what the page plays, so the buttons are asked for, and the
rating sent, by the service, the item, and the room the source was browsed
from; a rating the service skips on is answered with ``skip`` for the page to
move its own output on.
"""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend import main

STAR = {"id": "1", "icon": "https://x/STAR_UNSELECTED-p.png", "auto_skip": "NEVER"}
BAN = {"id": "0", "icon": "https://x/PROHIBITED_UNSELECTED-p.png", "auto_skip": "ALWAYS"}
LIT = {"id": "1", "icon": "https://x/STAR_SELECTED-p.png", "auto_skip": "NEVER"}


def _fake(monkeypatch, *, token="t", buttons=(STAR, BAN), inert=False, should_skip=False):
    sent = []
    household = SimpleNamespace(id="HH1")

    async def rate_item(**kwargs):
        sent.append(kwargs)
        return SimpleNamespace(should_skip=should_skip, message_string_id="")

    async def serial(_household):
        return "SERIAL"

    async def ratings(_uri):
        return {"matches": {"0": list(buttons)}}

    async def service(_ctl, _household, sid):
        return SimpleNamespace(id=sid, name="AccuRadio", endpoint="https://e", auth="DeviceLink", manifest_uri="m")

    async def texts(_service):
        return {1: "We'll try to play this more!", 0: "We'll play this less!"}

    fake = SimpleNamespace(
        zones={"RINCON_A": object()}, household_of=lambda uuid: household if uuid == "RINCON_A" else None,
        ordered_households=lambda: [household],
        credentials_for=lambda hh, sid, account, single_account=False: {"token": token, "key": "k"} if token else None,
        device_serial=serial, presentation=SimpleNamespace(ratings=ratings),
        smapi=SimpleNamespace(rate_item=rate_item))
    monkeypatch.setattr(main, "controller", lambda: fake)
    monkeypatch.setattr(main, "_cached_service", service)
    monkeypatch.setattr(main, "_rating_texts", texts)
    monkeypatch.setattr(main, "rating_is_inert", lambda button, _map: inert)
    return sent


def _rate(rating, zone="RINCON_A"):
    body = main.BrowserRateBody(sid=188, item_id="song:abc", rating=rating, zone=zone)
    return asyncio.run(main.rate_browser_item(body))


def test_a_ban_the_map_skips_on_is_sent_and_says_skip(monkeypatch):
    sent = _fake(monkeypatch)
    answer = _rate("0")
    assert answer["skip"] is True and answer["message"] == "We'll play this less!"
    assert sent == [{"endpoint": "https://e", "service_name": "AccuRadio", "item_id": "song:abc", "rating": 0,
                     "household_id": "HH1", "token": "t", "key": "k", "device_id": "SERIAL"}]


def test_a_star_is_sent_and_does_not_skip(monkeypatch):
    sent = _fake(monkeypatch)
    answer = _rate("1")
    assert answer["skip"] is False and answer["message"] == "We'll try to play this more!"
    assert sent[0]["rating"] == 1


def test_the_service_may_ask_for_a_skip_itself(monkeypatch):
    _fake(monkeypatch, should_skip=True)
    assert _rate("1")["skip"] is True


def test_a_lit_button_with_no_way_back_is_not_sent(monkeypatch):
    sent = _fake(monkeypatch, buttons=(LIT, BAN), inert=True)
    answer = _rate("1")
    assert answer["unchanged"] is True and answer["skip"] is False and sent == []


def test_without_a_login_the_rating_is_refused(monkeypatch):
    sent = _fake(monkeypatch, token="")
    with pytest.raises(HTTPException) as caught:
        _rate("0")
    assert caught.value.status_code == 409 and sent == []


def test_a_room_not_known_falls_back_to_the_first_household(monkeypatch):
    sent = _fake(monkeypatch)
    _rate("0", zone="")
    assert sent[0]["household_id"] == "HH1"


def test_the_buttons_are_read_for_the_item_the_page_plays(monkeypatch):
    _fake(monkeypatch)
    asked = []

    async def provider_item(ctl, household, service, sid, item, account, reported, zone):
        asked.append((household.id, sid, item, account, reported, zone))
        return {"ratings": ["drawn"]}

    monkeypatch.setattr(main, "_provider_item", provider_item)
    answer = asyncio.run(main.browser_item_metadata(188, "song:abc", "RINCON_A"))
    assert answer == {"ratings": ["drawn"]}
    # No speaker publishes a rating for it, so none is reported.
    assert asked == [("HH1", 188, "song:abc", "", 0, "RINCON_A")]
