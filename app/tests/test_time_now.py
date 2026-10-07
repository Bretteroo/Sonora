"""Setting the clock by hand: what ``AlarmClock#SetTimeNow`` takes.

Its second argument is the time zone's rule string, not the index the rest of
the service deals in, and the time is spelt the way the player spells its own
``CurrentLocalTime``. Worked out against S1 and S2 players on 2026-09-14.
"""

import asyncio
from types import SimpleNamespace

import pytest

from backend.sonos.controller import Commands

# The player's table is read from index 0 until an empty rule answers, so the
# fake has to fill the indices below the one under test.
RULES = {index: f"{0x0800 - 60 * index:04x}" + "0" * 24 for index in range(4)}
RULES[4] = "01e00b000102000003000202ffc4"


class _Soap:
    def __init__(self):
        self.sent = []

    async def call(self, host, service, action, args):
        self.sent.append((action, args))
        if action == "GetTimeZoneRule":
            return SimpleNamespace(args={"TimeZone": RULES.get(args["Index"], "")})
        return SimpleNamespace(args={})


def _commands():
    soap = _Soap()
    zone = SimpleNamespace(uuid="RINCON_1", host="192.0.2.10")
    return Commands(SimpleNamespace(soap=soap, zone=lambda uuid: zone,
                                    household_host=lambda uuid: zone.host)), soap


def test_sends_the_rule_for_the_index_and_the_time_as_given():
    commands, soap = _commands()
    asyncio.run(commands.set_time_now("RINCON_1", "2026-09-14 21:31:06", 4))
    action, args = soap.sent[-1]
    assert action == "SetTimeNow"
    assert args == {"DesiredTime": "2026-09-14 21:31:06",
                    "TimeZoneForDesiredTime": RULES[4]}


@pytest.mark.parametrize("value", ["2026-09-14T21:31:06", "2026-09-14 21:31",
                                   "2026-13-40 21:31:06", "", "now"])
def test_a_malformed_time_is_refused_before_the_player_sees_it(value):
    commands, soap = _commands()
    with pytest.raises(ValueError):
        asyncio.run(commands.set_time_now("RINCON_1", value, 4))
    assert not any(action == "SetTimeNow" for action, _ in soap.sent)


def test_an_unknown_zone_index_is_refused():
    commands, soap = _commands()
    with pytest.raises(ValueError):
        asyncio.run(commands.set_time_now("RINCON_1", "2026-09-14 21:31:06", 99))
    assert not any(action == "SetTimeNow" for action, _ in soap.sent)
