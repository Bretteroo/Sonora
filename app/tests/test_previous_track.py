"""Previous on a queue's first track goes back to the start of the track.

The speaker leaves Previous out of its actions there and answers the command
with 711; play.sonos.com keeps the button live and restarts the track, which
it did at 3:00 of track 1 (2026-09-24).
"""

import asyncio
from types import SimpleNamespace

import pytest

from backend.sonos.controller import Commands
from backend.sonos.models import TransportState
from backend.sonos.soap import SoapFault


def _commands(refusal):
    sent = []

    async def call(host, service, action, args, **kwargs):
        sent.append((action, args))
        if action == "Previous" and refusal:
            raise SoapFault(refusal, "", "AVTransport", action)
        return {}

    async def repost_position(uuid):
        return None

    ctl = SimpleNamespace(coordinator_of=lambda uuid: SimpleNamespace(uuid=uuid, host="10.0.0.1", transport=TransportState()),
                          soap=SimpleNamespace(call=call), repost_position=repost_position)
    commands = Commands.__new__(Commands)
    commands._c = ctl
    return commands, sent


def test_a_refused_previous_restarts_the_track():
    commands, sent = _commands("711")
    asyncio.run(commands.previous_track("RINCON_PLAYROOM"))
    assert [action for action, _ in sent] == ["Previous", "Seek"]
    assert sent[1][1] == {"InstanceID": 0, "Unit": "REL_TIME", "Target": "0:00:00"}


def test_a_previous_the_speaker_takes_is_all_that_is_sent():
    commands, sent = _commands(None)
    asyncio.run(commands.previous_track("RINCON_PLAYROOM"))
    assert [action for action, _ in sent] == ["Previous"]


def test_any_other_refusal_still_reaches_the_caller():
    commands, sent = _commands("701")
    with pytest.raises(SoapFault):
        asyncio.run(commands.previous_track("RINCON_PLAYROOM"))
    assert [action for action, _ in sent] == ["Previous"]
