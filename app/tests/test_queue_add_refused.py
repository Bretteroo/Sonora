"""A queue add a speaker refuses is logged with what was asked: the fault
alone names neither the item nor the state the room was in."""

import asyncio
import logging
from types import SimpleNamespace

import pytest

from backend.sonos.controller import Commands
from backend.sonos.soap import SoapFault

ALBUM = "x-rincon-cpcontainer:0004206cabc%3Aalbum?sid=212&flags=8300&sn=26"


class _Soap:
    async def call(self, host, service, action, args, **kwargs):
        raise SoapFault("800", "command not supported by this device", service, action)


def test_a_refused_add_names_the_item_and_the_room(caplog):
    transport = SimpleNamespace(state="PLAYING", media_uri="x-rincon-queue:RINCON_1#0",
                                play_mode="SHUFFLE", queue_length=12)
    zone = SimpleNamespace(uuid="RINCON_1", name="Den", host="192.0.2.10", transport=transport)
    commands = Commands(SimpleNamespace(soap=_Soap(), coordinator_of=lambda uuid: zone))
    with caplog.at_level(logging.WARNING), pytest.raises(SoapFault):
        asyncio.run(commands.add_to_queue("RINCON_1", ALBUM, "<DIDL-Lite/>", next_=True))
    line = caplog.records[-1].getMessage()
    assert ALBUM in line and "UPnP 800" in line and "as next True" in line
    assert "SHUFFLE" in line and "queue of 12" in line
    assert "DIDL" not in line
