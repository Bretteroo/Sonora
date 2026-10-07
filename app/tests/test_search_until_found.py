"""Start-up that finds no speakers keeps looking.

A machine that boots before its network is up found nothing, and Sonora did
not look again until someone pressed "Search again" (found in review).
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import SonosController


def test_it_looks_again_until_a_household_appears():
    controller = SonosController.__new__(SonosController)
    controller.registry = SimpleNamespace(households={})
    looked = []

    async def refresh():
        looked.append(1)
        if len(looked) == 3:
            controller.registry.households = {"HH": SimpleNamespace()}

    controller.refresh = refresh
    controller._read_directories = lambda: looked.append("read")
    asyncio.run(controller._search_until_found(first=0.001, longest=0.004))
    assert looked == [1, 1, 1, "read"]


def test_a_failed_look_does_not_end_the_search():
    controller = SonosController.__new__(SonosController)
    controller.registry = SimpleNamespace(households={})
    tries = []

    async def refresh():
        tries.append(1)
        if len(tries) == 1:
            raise OSError("network is unreachable")
        controller.registry.households = {"HH": SimpleNamespace()}

    controller.refresh = refresh
    controller._read_directories = lambda: None
    asyncio.run(controller._search_until_found(first=0.001, longest=0.002))
    assert len(tries) == 2
