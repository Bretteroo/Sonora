"""Play Now from the end of the queue.

A song reserved from the Karaoke Machine's songbook while nothing plays
joins the end of the queue, as Add to End of Queue puts it, and the queue
plays from it. Plain Play Now still puts an item after the track playing.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands, SonosController, ZoneState


class _Soap:
    def __init__(self, first):
        self.first = first
        self.calls = []

    async def call(self, host, service, action, args=None, **kw):
        self.calls.append((action, dict(args or {})))
        if action == "AddURIToQueue":
            return SimpleNamespace(args={"FirstTrackNumberEnqueued": str(self.first)})
        return SimpleNamespace(args={})


def _commands(first):
    ctl = SonosController.__new__(SonosController)
    room = ZoneState(uuid="RINCON_A01400", name="Den", host="192.168.0.10")
    room.group_members = [room.uuid]
    ctl.zones = {room.uuid: room}
    ctl.soap = _Soap(first)
    ctl.coordinator_of = lambda uuid: room
    cmd = Commands(ctl)
    return cmd, ctl.soap


def _run(at_end, first):
    cmd, soap = _commands(first)
    asyncio.run(cmd.play_now("RINCON_A01400", "x-file-cifs://song.mp3", "<DIDL/>", at_end=at_end))
    return soap.calls


def test_play_now_from_the_end_joins_the_end_and_plays_from_it():
    calls = _run(True, 12)
    add = next(args for action, args in calls if action == "AddURIToQueue")
    assert add["EnqueueAsNext"] is False and add["DesiredFirstTrackNumberEnqueued"] == 0
    seek = next(args for action, args in calls if action == "Seek")
    assert seek["Unit"] == "TRACK_NR" and seek["Target"] == "12"
    assert [action for action, _ in calls][-1] == "Play"


def test_plain_play_now_still_goes_after_the_track_playing():
    calls = _run(False, 4)
    add = next(args for action, args in calls if action == "AddURIToQueue")
    assert add["EnqueueAsNext"] is True


def test_a_saved_queue_loaded_quietly_does_not_start():
    cmd, soap = _commands(1)
    asyncio.run(cmd.replace_queue("RINCON_A01400", "file:///jffs/settings/savedqueues.rsq#3", "<DIDL/>", play=False))
    actions = [action for action, _ in soap.calls]
    assert "AddURIToQueue" in actions and "Seek" in actions and "Play" not in actions


def test_replace_queue_still_plays_by_default():
    cmd, soap = _commands(1)
    asyncio.run(cmd.replace_queue("RINCON_A01400", "file:///jffs/settings/savedqueues.rsq#3", "<DIDL/>"))
    assert [action for action, _ in soap.calls][-1] == "Play"


def test_play_now_leaves_a_transport_already_on_the_queue_where_it_is():
    """Pointed at its queue again, a speaker goes back to the first track until the seek lands."""
    cmd, soap = _commands(5)
    cmd._c.zones["RINCON_A01400"].transport.media_uri = "x-rincon-queue:RINCON_A01400#0"
    asyncio.run(cmd.play_now("RINCON_A01400", "x-file-cifs://song.mp3", "<DIDL/>"))
    actions = [action for action, _ in soap.calls]
    assert "SetAVTransportURI" not in actions
    assert actions[-2:] == ["Seek", "Play"]


def test_play_now_takes_a_room_off_a_station_and_onto_its_queue():
    cmd, soap = _commands(5)
    cmd._c.zones["RINCON_A01400"].transport.media_uri = "x-sonosapi-stream:s1?sid=254"
    asyncio.run(cmd.play_now("RINCON_A01400", "x-file-cifs://song.mp3", "<DIDL/>"))
    actions = [action for action, _ in soap.calls]
    assert actions.index("SetAVTransportURI") < actions.index("Seek")
