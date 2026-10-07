"""Next and Previous on a source that will not take them.

A room played Sonos Radio's "Rare Grooves" station: its
``CurrentTransportActions`` read "Set, Stop, Pause, Play, Next", Next answered
UPnP 800 four presses in a row, and Previous, which it never offered, 701.
The S1 Android app reads 800 on Next or Previous as a skip
limit reached and says so each time, leaving the key live; Sonora does the
same, and keeps the 800 out of the error log.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from backend.sonos import controller as module
from backend.sonos.models import TransportState
from backend.sonos.soap import SoapFault

STATION = "x-sonosapi-radio:sonos%3A3009?sid=303&flags=8300&sn=16"


def _commands(lead):
    calls = []

    class Soap:
        async def call(self, host, service, action, args, quiet_codes=frozenset()):
            calls.append((action, set(quiet_codes)))
            raise SoapFault("800", "", "AVTransport", action)

    ctl = SimpleNamespace(coordinator_of=lambda uuid: lead, soap=Soap())
    cmd = module.Commands.__new__(module.Commands)
    cmd._c = ctl
    return cmd, calls


def test_a_skip_limit_is_asked_every_time_and_not_logged_as_a_fault():
    lead = SimpleNamespace(uuid="OFFICE", host="192.168.1.144",
                           transport=TransportState(media_uri=STATION))
    cmd, calls = _commands(lead)
    for _ in range(2):
        with pytest.raises(SoapFault) as fault:
            asyncio.run(cmd.next_track("OFFICE"))
        assert fault.value.code == "800"
    assert calls == [("Next", {"800"}), ("Next", {"800"})]


def test_previous_is_not_put_to_a_source_that_offers_none():
    lead = SimpleNamespace(uuid="OFFICE", host="192.168.1.144",
                           transport=TransportState(media_uri=STATION, can_previous=False, can_seek=False))
    cmd, calls = _commands(lead)
    with pytest.raises(SoapFault):
        asyncio.run(cmd.previous_track("OFFICE"))
    assert calls == []


def test_a_track_number_jump_is_not_a_seek():
    """Pandora: "Set, Stop, Pause, Play, Next, X_DLNA_SeekTrackNr".
    The letters "seek" in the track-number jump read as a time seek, offered a
    seek bar, and the speaker refused the drag with 701."""
    def actions_of(text):
        class Soap:
            async def call(self, host, service, action, args):
                return {"Actions": text}
        ctl = module.SonosController.__new__(module.SonosController)
        ctl.soap = Soap()
        return asyncio.run(ctl._transport_actions("10.0.0.1"))
    assert actions_of("Set, Stop, Pause, Play, Next, X_DLNA_SeekTrackNr") == (True, False, True, False)
    assert actions_of("Set, Stop, Pause, Play, X_DLNA_SeekTime, Previous, X_DLNA_SeekTrackNr") == (True, True, False, True)
    assert actions_of("Set, Stop, Play") == (False, False, False, False)
