"""A sleep timer that runs out on a soundbar's TV input.

The soundbar cannot stop the TV, so it fades to 0 and plays on in silence
(measured on a Beam, 2026-11-07). Sonora puts the TV in standby and gives
every speaker in the group its volume back.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos import controller as ctl_mod
from backend.sonos.controller import SonosController, ZoneState


class _Soap:
    def __init__(self, remaining):
        self.remaining = remaining
        self.calls = []

    async def call(self, host, service, action, args=None, **kw):
        self.calls.append((host, action, dict(args or {})))
        return SimpleNamespace(args={"RemainingSleepTimerDuration": self.remaining})


def _controller(uri="x-sonos-htastream:RINCON_A01400:spdif"):
    ctl = SonosController.__new__(SonosController)
    bar = ZoneState(uuid="RINCON_A01400", name="Den", host="192.168.0.10")
    bar.transport.track_uri = uri
    bar.group_members = ["RINCON_A01400", "RINCON_B01400"]
    sub = ZoneState(uuid="RINCON_B01400", name="Den Sub", host="192.168.0.11")
    bar.volume, sub.volume = 12, 20
    ctl.zones = {bar.uuid: bar, sub.uuid: sub}
    ctl.standby = []

    ctl.tv_takes_standby = True

    async def standby(host):
        ctl.standby.append(host)
        return ctl.tv_takes_standby

    ctl._tv_standby = standby
    ctl.tv_goes_off = True

    async def quiet(host):
        return ctl.tv_goes_off

    ctl._tv_went_quiet = quiet
    return ctl, bar, sub


def _run(ctl, bar, remaining, monkeypatch, now):
    ctl.soap = _Soap(remaining)
    monkeypatch.setattr(ctl_mod, "monotonic", lambda: now)
    asyncio.run(ctl._follow_sleep_timer(bar))
    return ctl.soap.calls


def _volumes_set(calls):
    return {(host, args["DesiredVolume"]) for host, action, args in calls if action == "SetVolume"}


def test_a_timer_that_runs_out_on_the_tv_turns_it_off_and_gives_the_volume_back(monkeypatch):
    ctl, bar, sub = _controller()
    _run(ctl, bar, "00:01:00", monkeypatch, now=1000.0)
    assert bar.sleep_due == 1060.0
    # The fade takes them to 0; the timer then clears.
    bar.volume = sub.volume = 0
    calls = _run(ctl, bar, "", monkeypatch, now=1067.0)
    assert ctl.standby == ["192.168.0.10"]
    assert _volumes_set(calls) == {("192.168.0.10", 12), ("192.168.0.11", 20)}
    assert bar.sleep_due is None


def test_a_cancelled_timer_does_nothing(monkeypatch):
    ctl, bar, sub = _controller()
    _run(ctl, bar, "00:10:00", monkeypatch, now=1000.0)
    calls = _run(ctl, bar, "", monkeypatch, now=1200.0)
    assert ctl.standby == [] and _volumes_set(calls) == set()


def test_music_is_left_to_the_speaker(monkeypatch):
    ctl, bar, sub = _controller(uri="x-sonosapi-stream:s1234?sid=254&flags=8224&sn=0")
    _run(ctl, bar, "00:01:00", monkeypatch, now=1000.0)
    calls = _run(ctl, bar, "", monkeypatch, now=1067.0)
    assert ctl.standby == [] and _volumes_set(calls) == set()


def test_the_volume_put_back_is_the_last_one_before_the_fade(monkeypatch):
    ctl, bar, sub = _controller()
    _run(ctl, bar, "00:01:00", monkeypatch, now=1000.0)
    bar.volume = 15
    monkeypatch.setattr(ctl_mod, "monotonic", lambda: 1030.0)
    ctl._note_volume_before_sleep(bar)      # turned up during the countdown
    for level in (10, 5, 0):
        bar.volume = level
        monkeypatch.setattr(ctl_mod, "monotonic", lambda: 1060.5)
        ctl._note_volume_before_sleep(bar)  # the fade, which is not kept
    calls = _run(ctl, bar, "", monkeypatch, now=1067.0)
    assert ("192.168.0.10", 15) in _volumes_set(calls)


def test_a_tv_that_stays_on_keeps_the_silence(monkeypatch):
    # No CEC, or an optical connection: the standby asks for nothing the TV
    # hears, and putting the volume back would have it playing out loud again.
    ctl, bar, sub = _controller()
    ctl.tv_goes_off = False
    _run(ctl, bar, "00:01:00", monkeypatch, now=1000.0)
    calls = _run(ctl, bar, "", monkeypatch, now=1067.0)
    assert ctl.standby == ["192.168.0.10"] and _volumes_set(calls) == set()


def test_a_soundbar_that_refuses_the_standby_is_not_waited_on(monkeypatch):
    # S1 firmware has no home theater commands, and a soundbar without CEC
    # refuses this one: nothing to wait for, and the silence stays.
    ctl, bar, sub = _controller()
    ctl.tv_takes_standby = False
    waited = []

    async def quiet(host):
        waited.append(host)
        return True

    ctl._tv_went_quiet = quiet
    _run(ctl, bar, "00:01:00", monkeypatch, now=1000.0)
    calls = _run(ctl, bar, "", monkeypatch, now=1067.0)
    assert waited == [] and _volumes_set(calls) == set()
