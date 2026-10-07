"""The cloud's lists are answered from what is held and refreshed behind it.

A household's registrations were kept five minutes and then waited on, so
every fifth minute a theme's service list stood behind a round trip to Sonos.
Now a held list is the answer, an old one is fetched again behind it,
callers arriving together share one fetch, and a household change drops the
list so the next caller waits for the new one.
"""

import asyncio
from time import monotonic

from backend.sonos import cloud as module
from backend.sonos.cloud import SonosCloud, _Cached


def _cloud(fetch):
    cloud = SonosCloud.__new__(SonosCloud)
    cloud._registrations = {}
    cloud._catalog = {}
    cloud._inflight = {}
    cloud._gen = {}
    cloud._fetch_registrations = fetch
    return cloud


def test_a_held_list_is_the_answer_and_an_old_one_is_fetched_behind_it():
    fetched = []

    async def fetch(household_id):
        fetched.append(household_id)
        return ["new"]

    async def go():
        cloud = _cloud(fetch)
        cloud._registrations["H"] = _Cached(["old"], at=monotonic() - module.REGISTRATIONS_TTL - 1)
        first = await cloud.registrations("H")
        for _ in range(3):
            await asyncio.sleep(0)
        return first, fetched[:]

    first, fetched_then = asyncio.run(go())
    assert first == ["old"]
    assert fetched_then == ["H"]


def test_callers_with_nothing_held_share_one_fetch():
    fetched = []

    async def fetch(household_id):
        fetched.append(household_id)
        await asyncio.sleep(0.02)
        return ["list"]

    async def go():
        cloud = _cloud(fetch)
        return await asyncio.gather(*(cloud.registrations("H") for _ in range(4)))

    assert asyncio.run(go()) == [["list"]] * 4
    assert fetched == ["H"]


def test_a_household_change_makes_the_next_caller_wait_for_a_new_list():
    answers = iter([["before"], ["after"]])

    async def fetch(household_id):
        return next(answers)

    async def go():
        cloud = _cloud(fetch)
        cloud._registrations["H"] = _Cached(["held"])
        held = await cloud.registrations("H")
        cloud.forget_registrations("H")
        return held, await cloud.registrations("H")

    assert asyncio.run(go()) == (["held"], ["before"])
