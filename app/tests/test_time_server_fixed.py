"""A system that keeps its time server says so, and is not asked to clear it.

On S2 "Set the date and time from the Internet" switched off and came back
on at the next read (2026-09-30): the speaker answered ``SetTimeServer`` with
an empty server as a success and kept its server all the same.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands


class _Soap:
    def __init__(self, keeps):
        self.server = "0.sonostime.pool.ntp.org"
        self.keeps = keeps
        self.calls = []

    def is_silent(self, host):
        return False

    async def call(self, host, service, action, args=None):
        self.calls.append(action)
        if action == "SetTimeServer" and not self.keeps:
            self.server = args["DesiredTimeServer"]
        return SimpleNamespace(args={"CurrentTimeServer": self.server})


def _commands(generation, keeps):
    zone = SimpleNamespace(host="192.168.0.110", online=True, generation=generation)
    household = SimpleNamespace(id="HH")
    soap = _Soap(keeps)
    commands = Commands.__new__(Commands)
    commands._c = SimpleNamespace(zone=lambda uuid: zone, household_of=lambda uuid: household, soap=soap)
    commands._fixed_time_server = set()
    return commands, soap


def test_s2_is_taken_to_keep_its_time_server():
    commands, _ = _commands("S2", keeps=True)
    assert commands.time_server_fixed("RINCON_X") is True


def test_s1_can_leave_the_internet_and_is_not_marked():
    commands, soap = _commands("S1", keeps=False)
    assert commands.time_server_fixed("RINCON_X") is False
    asyncio.run(commands.set_time_server("RINCON_X", ""))
    assert soap.server == ""
    assert commands.time_server_fixed("RINCON_X") is False


def test_a_system_seen_to_ignore_the_change_is_remembered():
    commands, soap = _commands("S1", keeps=True)
    asyncio.run(commands.set_time_server("RINCON_X", ""))
    assert soap.calls[-1] == "GetTimeServer"
    assert commands.time_server_fixed("RINCON_X") is True


def test_setting_a_server_is_not_checked_afterwards():
    commands, soap = _commands("S1", keeps=False)
    asyncio.run(commands.set_time_server("RINCON_X", "pool.example"))
    assert soap.calls == ["SetTimeServer"]
