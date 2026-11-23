"""A play mode for a queue the room is not playing from.

A speaker takes shuffle and repeat only for a queue that is its source:
SetPlayMode beside a station answers 712 (measured 2026-10-02 on every room).
A room can hold a long queue beside a stopped station all the same, and the
queue's own page has a Shuffle switch, so a mode asked for the queue there is
kept and set when the queue next plays.
"""
import asyncio

import pytest

from backend.sonos.controller import Commands, SonosController, ZoneState
from backend.sonos.models import TransportState
from backend.sonos.soap import SoapFault

QUEUE = "x-rincon-queue:RINCON_L01400#0"
STATION = "x-sonosapi-radio:ST%3a1?sid=236&flags=8300&sn=2"
ALL = "SHUFFLE,REPEAT,REPEATONE,CROSSFADE"


class _Soap:
    def __init__(self, refuse=""):
        self.calls = []
        self.refuse = refuse

    async def call(self, host, service, action, args=None, **kw):
        self.calls.append((action, dict(args or {})))
        if action == "SetPlayMode" and self.refuse:
            raise SoapFault(self.refuse, "", "AVTransport", action)
        return {}


def _room(media, modes, play_mode="NORMAL", length=0):
    ctl = SonosController.__new__(SonosController)
    lead = ZoneState(uuid="RINCON_L01400", name="Lounge", host="192.168.0.40")
    lead.is_coordinator = True
    lead.transport.media_uri = media
    lead.transport.valid_play_modes = modes
    lead.transport.play_mode = play_mode
    lead.transport.queue_length = length
    ctl.zones = {lead.uuid: lead}
    ctl.published = []

    async def publish(state):
        ctl.published.append(state.transport.queue_play_mode)

    async def repost(uuid):
        return None

    ctl._publish_zone = publish
    ctl.repost_position = repost
    ctl.soap = _Soap()
    cmd = Commands.__new__(Commands)
    cmd._c = ctl
    return ctl, cmd, lead


def _modes_set(ctl):
    return [args["NewPlayMode"] for action, args in ctl.soap.calls if action == "SetPlayMode"]


def test_what_a_queue_will_play_in_is_said_only_while_it_waits():
    playing = TransportState(media_uri=QUEUE, valid_play_modes=ALL, play_mode="SHUFFLE")
    assert playing.plays_own_queue and playing.queue_play_mode == ""
    beside = TransportState(media_uri=STATION, valid_play_modes="CROSSFADE", play_mode="NORMAL",
                            queue_mode_seen="SHUFFLE_NOREPEAT")
    assert not beside.can_shuffle and beside.queue_play_mode == "SHUFFLE_NOREPEAT"
    # Nothing seen since Sonora started: what the speaker reports stands in.
    assert TransportState(media_uri=STATION, play_mode="REPEAT_ALL").queue_play_mode == "REPEAT_ALL"
    # A Spotify Connect session is a queue by its URI and is not the room's.
    connect = TransportState(media_uri="x-rincon-queue:RINCON_L01400#vli")
    assert not connect.plays_own_queue and connect.queue_play_mode == "NORMAL"


def test_a_mode_for_a_queue_beside_a_station_is_kept_not_sent():
    async def go():
        ctl, cmd, lead = _room(STATION, "CROSSFADE")
        await cmd.set_play_mode(lead.uuid, "SHUFFLE_NOREPEAT", held=True)
        await asyncio.sleep(0)
        return ctl, lead
    ctl, lead = asyncio.run(go())
    assert _modes_set(ctl) == []
    assert lead.transport.queue_play_mode == "SHUFFLE_NOREPEAT"
    assert ctl.published == ["SHUFFLE_NOREPEAT"]


def test_without_the_word_the_speakers_refusal_is_the_answer():
    """A scene puts back the mode it found, on a station too, and counts on
    the 712; it must not leave a mode waiting for the room's queue."""
    async def go():
        ctl, cmd, lead = _room(STATION, "CROSSFADE")
        ctl.soap.refuse = "712"
        with pytest.raises(SoapFault):
            await cmd.set_play_mode(lead.uuid, "SHUFFLE")
        return lead
    assert asyncio.run(go()).transport.queue_mode_wanted == ""


def test_the_queue_playing_takes_the_mode_at_once():
    async def go():
        ctl, cmd, lead = _room(QUEUE, ALL, length=12)
        await cmd.set_play_mode(lead.uuid, "SHUFFLE", held=True)
        return ctl, lead
    ctl, lead = asyncio.run(go())
    assert _modes_set(ctl) == ["SHUFFLE"] and lead.transport.queue_mode_wanted == ""


def test_an_empty_queue_refuses_and_the_mode_waits_for_it_to_fill():
    async def go():
        ctl, cmd, lead = _room(QUEUE, ALL)
        ctl.soap.refuse = "712"
        await cmd.set_play_mode(lead.uuid, "SHUFFLE_NOREPEAT", held=True)
        ctl.soap.refuse = ""
        # The album arrives: the queue is emptied, filled and played.
        await cmd._queue_took_over(lead)
        return ctl, lead
    ctl, lead = asyncio.run(go())
    assert _modes_set(ctl) == ["SHUFFLE_NOREPEAT", "SHUFFLE_NOREPEAT"]
    assert lead.transport.queue_mode_wanted == ""


def test_a_queue_row_played_beside_a_station_sets_the_kept_mode_before_the_seek():
    async def go():
        ctl, cmd, lead = _room(STATION, "CROSSFADE")
        await cmd.set_play_mode(lead.uuid, "SHUFFLE_NOREPEAT", held=True)
        await cmd.seek_track(lead.uuid, 5)
        return ctl
    ctl = asyncio.run(go())
    assert [action for action, _ in ctl.soap.calls] == ["SetAVTransportURI", "SetPlayMode", "Seek"]
    assert _modes_set(ctl) == ["SHUFFLE_NOREPEAT"]


def test_a_switch_made_elsewhere_is_caught_from_the_speakers_report():
    tr = TransportState(media_uri=STATION, valid_play_modes="CROSSFADE", queue_mode_wanted="SHUFFLE")
    assert tr.note_queue_mode() == ""              # still the station
    tr.media_uri, tr.valid_play_modes, tr.queue_length = QUEUE, ALL, 0
    assert tr.note_queue_mode() == ""              # nothing in it to order yet
    assert tr.queue_play_mode == "SHUFFLE"
    tr.queue_length = 40
    assert tr.note_queue_mode() == "SHUFFLE"       # due now, and asked once
    assert tr.note_queue_mode() == "" and tr.queue_mode_wanted == ""


def test_a_kept_mode_the_queue_already_plays_in_is_not_sent_again():
    tr = TransportState(media_uri=QUEUE, valid_play_modes=ALL, play_mode="SHUFFLE",
                        queue_length=3, queue_mode_wanted="SHUFFLE")
    assert tr.note_queue_mode() == "" and tr.queue_mode_wanted == ""
    assert tr.queue_mode_seen == "SHUFFLE"


def test_the_mode_a_queue_played_in_is_remembered_past_a_station():
    tr = TransportState(media_uri=QUEUE, valid_play_modes=ALL, play_mode="SHUFFLE_NOREPEAT", queue_length=9)
    tr.note_queue_mode()
    tr.media_uri, tr.valid_play_modes, tr.play_mode = STATION, "CROSSFADE", "NORMAL"
    tr.note_queue_mode()
    assert tr.queue_play_mode == "SHUFFLE_NOREPEAT"


def test_a_room_under_another_reports_the_mode_kept_for_its_leaders_queue():
    assert "queue_play_mode" in SonosController._MODE_FLAGS
    lead = ZoneState(uuid="RINCON_L01400", name="Lounge", host="192.168.0.40")
    lead.transport.media_uri = STATION
    lead.transport.queue_mode_wanted = "SHUFFLE"
    assert lead.as_dict()["transport"]["queue_play_mode"] == "SHUFFLE"
