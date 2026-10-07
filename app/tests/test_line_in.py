"""A player has a line-in socket when it says it has one.

Sonora used to decide from a list of model numbers. One entry was wrong, so
it subscribed to AudioIn on a Play:1 that has no socket; the speaker refused
every attempt with HTTP 503 and the attempt came round again on every
rediscovery (135 of them in one day's log). A player
advertises its services in its own device description, which settles it.
"""

from backend.sonos.models import Player


def _player(**kw):
    return Player(uuid="U", name="Room", host="10.0.0.1", **kw)


def test_the_players_own_service_list_decides():
    listed = "AVTransport,AlarmClock,AudioIn,ConnectionManager,RenderingControl"
    assert _player(model="Sonos Connect", model_number="S15", services=listed).supports_line_in
    # The Play:1 whose model number was wrongly in the old list.
    bare = "AVTransport,AlarmClock,ConnectionManager,RenderingControl,VirtualLineIn"
    assert not _player(model="Sonos Play:1", model_number="S12", services=bare).supports_line_in


def test_virtual_line_in_is_not_a_socket():
    # Every player has VirtualLineIn: it is how a room follows another room,
    # not an input on the back of the box.
    assert not _player(model="Sonos One", services="VirtualLineIn,AVTransport").supports_line_in


def test_the_model_list_still_answers_until_the_description_is_read():
    assert _player(model="Sonos Connect", model_number="ZP90").supports_line_in
    assert _player(model="Sonos Play:5", model_number="S5").supports_line_in
    assert not _player(model="Sonos Play:1", model_number="S1").supports_line_in
    # S12 is gone from that fallback: it was the wrong entry.
    assert not _player(model="Sonos Play:1", model_number="S12").supports_line_in
