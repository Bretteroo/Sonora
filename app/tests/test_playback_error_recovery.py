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
    lead = SimpleNamespace(uuid="RINCON_P", name="Terrace", transport=SimpleNamespace(
        state="TRANSITIONING", media_uri="x-sonosapi-radio:ST%3a123?sid=236&flags=8300&sn=2"))
    sent = []
    ctl = SonosController.__new__(SonosController)
    ctl.PLAYBACK_RECOVERY = 0.01
    ctl.PLAYBACK_SETTLING = 0.02
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


def test_a_room_that_opens_the_next_item_while_still_transitioning_is_not_shown():
    # A station just started: the first item fails, the player sits in
    # TRANSITIONING past the first look while it fetches the next, then plays.
    lead = SimpleNamespace(uuid="RINCON_P", name="Terrace", transport=SimpleNamespace(
        state="TRANSITIONING", media_uri="x-sonosapi-radio:ST%3a123?sid=236&flags=8300&sn=2"))
    sent = []
    ctl = SonosController.__new__(SonosController)
    ctl.PLAYBACK_RECOVERY = 0.01
    ctl.PLAYBACK_SETTLING = 0.5
    ctl._last_play_error = {}
    ctl.zones = {"RINCON_P": lead}
    group = SimpleNamespace(coordinator_uuid="RINCON_P", zone_uuids=["RINCON_P"])
    ctl.household_of = lambda uuid: SimpleNamespace(group_for_zone=lambda u: group)

    async def broadcast(message):
        sent.append(message)
    ctl._broadcast = broadcast

    async def failed(state, **kw):
        pass
    ctl.dropouts = SimpleNamespace(failed=failed)

    async def run():
        event = SimpleNamespace(properties={
            "TransportStatus": "ERROR_CANT_REACH_SERVER",
            "TransportErrorURI": "x-sonos-http:VC1::ST::AudioAd::1.mp3",
            "TransportErrorDescription": "8,0,,Pandora,,",
        })
        await ctl._note_playback_error(event, lead)
        await asyncio.sleep(0.15)
        lead.transport.state = "PLAYING"
        await asyncio.sleep(0.6)
    asyncio.run(run())
    assert sent == []


def test_a_room_with_nothing_to_play_raises_no_notice():
    # A room just out of its group, standing with no source: the speaker
    # says ERROR_NO_CONTENT and names no URI.
    lead = SimpleNamespace(uuid="RINCON_P", name="Terrace", transport=SimpleNamespace(state="STOPPED"))
    sent = []
    ctl = SonosController.__new__(SonosController)
    ctl.PLAYBACK_RECOVERY = 0.01
    ctl.PLAYBACK_SETTLING = 0.02
    ctl._last_play_error = {}
    ctl.zones = {"RINCON_P": lead}
    group = SimpleNamespace(coordinator_uuid="RINCON_P", zone_uuids=["RINCON_P"])
    ctl.household_of = lambda uuid: SimpleNamespace(group_for_zone=lambda u: group)

    async def broadcast(message):
        sent.append(message)
    ctl._broadcast = broadcast
    ctl.dropouts = SimpleNamespace(failed=None)

    async def run():
        event = SimpleNamespace(properties={"TransportStatus": "ERROR_NO_CONTENT", "TransportErrorURI": "",
                                            "TransportErrorDescription": "8,0,Pandora,,,"})
        await ctl._note_playback_error(event, lead)
        await asyncio.sleep(0.1)
    asyncio.run(run())
    assert sent == []
