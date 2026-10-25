"""A dragged group volume slider: the speakers are sent the newest step, not a queue.

A slider sends a step every 90ms or so. Each set is one call to the group's
coordinator, and a step that arrives while one is under way waits in a single
place, replaced by any newer one. The volume snapshot the coordinator scales
the members by is taken when an adjustment begins, not for every step.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands


class _SlowSoap:
    """A coordinator that takes a while to answer each call."""

    def __init__(self, delay=0.05):
        self.delay = delay
        self.calls = []

    async def call(self, host, service, action, args, **_kwargs):
        self.calls.append((action, args.get("DesiredVolume")))
        await asyncio.sleep(self.delay)
        return SimpleNamespace(args={})


def _commands(soap):
    coordinator = SimpleNamespace(uuid="RINCON_C", host="192.0.2.10", name="Office")
    controller = SimpleNamespace(soap=soap, coordinator_of=lambda uuid: coordinator)
    return Commands(controller)


def test_steps_that_arrive_while_one_is_sent_collapse_to_the_newest():
    soap = _SlowSoap()
    commands = _commands(soap)

    async def drag():
        await asyncio.gather(*(commands.set_group_volume("RINCON_M", level) for level in (11, 12, 13, 14, 15)))

    asyncio.run(drag())
    sets = [level for action, level in soap.calls if action == "SetGroupVolume"]
    assert sets == [11, 15]


def test_one_snapshot_per_adjustment():
    soap = _SlowSoap(delay=0)
    commands = _commands(soap)

    async def two_adjustments():
        for level in (20, 21, 22):
            await commands.set_group_volume("RINCON_C", level)
        commands._group_volume_sent["RINCON_C"] -= Commands.GROUP_VOLUME_GESTURE_S + 0.1
        await commands.set_group_volume("RINCON_C", 30)

    asyncio.run(two_adjustments())
    assert [action for action, _ in soap.calls] == [
        "SnapshotGroupVolume", "SetGroupVolume", "SetGroupVolume", "SetGroupVolume",
        "SnapshotGroupVolume", "SetGroupVolume",
    ]


def test_levels_are_clamped():
    soap = _SlowSoap(delay=0)
    asyncio.run(_commands(soap).set_group_volume("RINCON_C", 140))
    assert ("SetGroupVolume", 100) in soap.calls
