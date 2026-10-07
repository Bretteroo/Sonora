"""Removing a saved station destroys only what My Radio Stations holds."""

import asyncio

import pytest
from fastapi import HTTPException

from backend import main


class _Commands:
    def __init__(self):
        self.destroyed: list[str] = []

    async def destroy_object(self, zone, object_id):
        self.destroyed.append(object_id)


def _remove(monkeypatch, object_id):
    commands = _Commands()
    monkeypatch.setattr(main, "commands", lambda: commands)
    body = main.RadioRemoveBody(zone="RINCON_X", id=object_id)
    return commands, asyncio.run(main.remove_radio_station(body))


def test_a_saved_station_is_removed(monkeypatch):
    commands, answer = _remove(monkeypatch, "R:0/0/104")
    assert answer == {"ok": True}
    assert commands.destroyed == ["R:0/0/104"]


def test_a_saved_show_is_removed(monkeypatch):
    commands, _ = _remove(monkeypatch, "R:0/1/7")
    assert commands.destroyed == ["R:0/1/7"]


@pytest.mark.parametrize("object_id", ["FV:2/3", "SQ:12", "R:0/0", "A:ALBUM/x", "R:0/2/1"])
def test_anything_else_is_refused(monkeypatch, object_id):
    with pytest.raises(HTTPException) as refused:
        _remove(monkeypatch, object_id)
    assert refused.value.status_code == 400
