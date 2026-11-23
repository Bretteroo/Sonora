"""A playing track's position is pinned to the speaker's own count.

The reading taken when a track begins is often taken while the speaker is
still buffering, so clients counting from it run ahead of the music. Once
the music plays, the server reads the position until the speaker's whole
second ticks over and marks that reading exact.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos import controller as ctl_mod
from backend.sonos.controller import SonosController, ZoneState


class _Speaker:
    """Answers GetPositionInfo from a clock that started `offset` seconds ago."""

    def __init__(self, clock, offset):
        self.clock = clock
        self.offset = offset
        self.calls = 0

    async def call(self, host, service, action, args=None, **kw):
        self.calls += 1
        self.clock[0] += 0.03          # each call takes a little time
        whole = int(self.clock[0] - self.offset)
        rel = f"0:{whole // 60:02d}:{whole % 60:02d}"
        return SimpleNamespace(get=lambda k, d="": {"RelTime": rel}.get(k, d))


def _setup(monkeypatch, offset, state="PLAYING"):
    clock = [100.0]
    monkeypatch.setattr(ctl_mod, "monotonic", lambda: clock[0])

    async def sleep(seconds):
        clock[0] += seconds
    monkeypatch.setattr(ctl_mod.asyncio, "sleep", sleep)
    ctl = SonosController.__new__(SonosController)
    room = ZoneState(uuid="RINCON_A01400", name="Den", host="192.168.0.10")
    room.transport.track_uri = "x-file-cifs://song.mp3"
    room.transport.state = state
    ctl.zones = {room.uuid: room}
    ctl.soap = _Speaker(clock, offset)
    published = []

    async def publish(state):
        published.append((state.transport.rel_time, state.transport.position_read_at, state.transport.position_exact))
    ctl._publish_zone = publish
    return ctl, room, clock, published


def test_the_reading_is_taken_as_the_second_ticks(monkeypatch):
    # The music started 0.37 s past the ninetieth second of the server's clock.
    ctl, room, clock, published = _setup(monkeypatch, offset=90.37)
    placed = asyncio.run(ctl._read_tick(room, room.transport.track_uri))
    assert placed and room.transport.position_exact
    seconds = ctl_mod._clock_seconds(room.transport.rel_time)
    # Where the speaker really was at the stamped moment, against the reading.
    true_position = room.transport.position_read_at - 90.37
    assert abs(true_position - seconds) < 0.12


def test_a_track_that_stopped_is_left_alone(monkeypatch):
    ctl, room, clock, published = _setup(monkeypatch, offset=90.0, state="PAUSED_PLAYBACK")
    asyncio.run(ctl._settle_position(room, room.transport.track_uri))
    assert not published and ctl.soap.calls == 0


def test_settling_publishes_an_exact_reading_twice(monkeypatch):
    ctl, room, clock, published = _setup(monkeypatch, offset=90.6)
    asyncio.run(ctl._settle_position(room, room.transport.track_uri))
    assert len(published) == 2 and all(exact for _, _, exact in published)


def test_another_track_stops_the_settling(monkeypatch):
    ctl, room, clock, published = _setup(monkeypatch, offset=90.0)
    asyncio.run(ctl._settle_position(room, "x-file-cifs://another.mp3"))
    assert not published
