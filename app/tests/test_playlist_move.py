"""Moving a track within a Sonos playlist: the saved-queue editor takes the
track and its new place counting from zero, and the place is where the track
stands afterwards (checked on "test", 2026-09-29: 5 -> 4 swapped The Prize
above What Child Is This?, 2 -> 6 put Movimiento Latino sixth)."""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands


class _Soap:
    def __init__(self):
        self.sent = []

    async def call(self, host, service, action, args):
        self.sent.append((host, action, args))
        return {}


def _commands():
    soap = _Soap()
    zone = SimpleNamespace(uuid="RINCON_1", host="192.0.2.10")

    async def browse(host, object_id, count=0, **kw):
        return SimpleNamespace(update_id="7")

    controller = SimpleNamespace(soap=soap, coordinator_of=lambda uuid: zone,
                                 content=SimpleNamespace(browse=browse))
    return Commands(controller), soap


def test_positions_go_out_from_zero_with_the_update_id():
    commands, soap = _commands()
    asyncio.run(commands.move_in_playlist("RINCON_1", "SQ:12", 5, 4))
    (_host, action, args), = soap.sent
    assert action == "ReorderTracksInSavedQueue"
    assert args["ObjectID"] == "SQ:12" and args["UpdateID"] == "7"
    assert args["TrackList"] == "4" and args["NewPositionList"] == "3"


def test_a_move_to_the_same_place_sends_nothing():
    commands, soap = _commands()
    asyncio.run(commands.move_in_playlist("RINCON_1", "SQ:12", 3, 3))
    assert soap.sent == []
