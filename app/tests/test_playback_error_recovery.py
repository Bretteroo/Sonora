"""A failure the speaker gets past is logged; one it does not is shown.

Pandora's audio ads could not load (the network's DNS blocks the
ad server) and the station played on, yet each raised a "cannot play" warning
on every open page. A failure is now reported to the pages only
when the group has stopped a moment later.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import SonosController


def _controller(state_after: str):
    lead = SimpleNamespace(uuid="RINCON_P", name="Terrace", transport=SimpleNamespace(state="TRANSITIONING"))
    sent = []
    ctl = SonosController.__new__(SonosController)
    ctl.PLAYBACK_RECOVERY = 0.01
    ctl._last_play_error = {}
    ctl.zones = {"RINCON_P": lead}
    group = SimpleNamespace(coordinator_uuid="RINCON_P", zone_uuids=["RINCON_P"])
    ctl.household_of = lambda uuid: SimpleNamespace(group_for_zone=lambda u: group)

    async def broadcast(message):
        sent.append(message)
    ctl._broadcast = broadcast
    noted = []

    async def failed(state, **kw):
        noted.append(kw["carried_on"])
    ctl.dropouts = SimpleNamespace(failed=failed)

    async def run():
        event = SimpleNamespace(properties={
            "TransportStatus": "ERROR_CANT_REACH_SERVER",
            "TransportErrorURI": "x-sonos-http:VC1::ST::AudioAd::1.mp3",
            "TransportErrorDescription": "8,0,,Pandora,,",
        })
        await ctl._note_playback_error(event, lead)
        lead.transport.state = state_after
        await asyncio.sleep(0.05)
    asyncio.run(run())
    # Every failure is a dropout, whether or not the pages are told.
    assert noted == [state_after == "PLAYING"]
    return sent


def test_a_failure_the_speaker_plays_past_is_not_shown():
    assert _controller("PLAYING") == []


def test_a_failure_that_leaves_the_room_stopped_is_shown():
    sent = _controller("STOPPED")
    assert len(sent) == 1
    assert sent[0]["type"] == "playbackError"
    assert sent[0]["room"] == "Terrace"
    assert sent[0]["status"] == "ERROR_CANT_REACH_SERVER"


def test_a_room_still_transitioning_has_not_recovered():
    assert len(_controller("TRANSITIONING")) == 1
