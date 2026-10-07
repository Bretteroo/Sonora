"""The service catalog is read from the speakers, not rebuilt for every page.

Building one asks a player for the whole list and then browses the favorites,
the playlists and the saved stations to see what the household uses. A day's
log showed 1465 of them against 31 asks for the service list itself: every
page of every service browse was paying for one. The controller keeps the
reading and drops it when the household's accounts change.

The service list itself went on reading afresh for each window that asked,
and one S1 Play:1 slow to answer made that 4 to 56 seconds. Now
it is answered from the kept copy too, an old copy is refreshed behind the
answer rather than waited on, everyone who asks during a read waits on that
one read, and a player that stalls is given one short try before the next is
asked.
"""

import asyncio
from time import monotonic
from types import SimpleNamespace

from backend.sonos.controller import SonosController


def _controller(read):
    ctl = SonosController.__new__(SonosController)
    ctl._directories = {}
    ctl._stale_directories = {}
    ctl._directory_reads = {}
    ctl._directory_gen = {}
    ctl._directory_host = {}
    ctl._directory_basis = {}
    ctl.configured_sids = lambda household_id: set()
    ctl.read_service_directory = read
    return ctl


def _counting():
    built = []

    async def read(household):
        built.append(household.id)
        return SimpleNamespace(services=[], by_id=lambda sid: None)

    return _controller(read), built


HOUSEHOLD = SimpleNamespace(id="HH")


def test_the_catalog_is_read_once_for_many_asks():
    ctl, built = _counting()

    async def go():
        for _ in range(5):
            await ctl.service_directory(HOUSEHOLD)
    asyncio.run(go())
    assert built == ["HH"]


def test_each_household_keeps_its_own():
    ctl, built = _counting()

    async def go():
        await ctl.service_directory(SimpleNamespace(id="H1"))
        await ctl.service_directory(SimpleNamespace(id="H2"))
        await ctl.service_directory(SimpleNamespace(id="H1"))
    asyncio.run(go())
    assert built == ["H1", "H2"]


def test_an_account_change_drops_it():
    ctl, built = _counting()
    asyncio.run(ctl.service_directory(HOUSEHOLD))
    ctl.forget_service_directories()
    asyncio.run(ctl.service_directory(HOUSEHOLD))
    assert built == ["HH", "HH"]


def test_after_ten_minutes_it_is_read_again_behind_the_answer():
    from backend.sonos import controller as module
    ctl, built = _counting()
    clock = [1000.0]
    real = module.monotonic
    module.monotonic = lambda: clock[0]

    async def go():
        first = await ctl.service_directory(HOUSEHOLD)
        clock[0] += 599
        assert await ctl.service_directory(HOUSEHOLD) is first
        assert built == ["HH"]
        clock[0] += 2
        # Past ten minutes the held copy is still the answer, and a read
        # starts behind it rather than in front of it.
        assert await ctl.service_directory(HOUSEHOLD) is first
        for _ in range(3):
            await asyncio.sleep(0)
        assert built == ["HH", "HH"]
        assert await ctl.service_directory(HOUSEHOLD) is not first

    try:
        asyncio.run(go())
    finally:
        module.monotonic = real


def test_callers_arriving_together_share_one_read():
    reads = []

    async def read(household):
        reads.append(household.id)
        await asyncio.sleep(0.05)
        return "directory"

    async def main():
        ctl = _controller(read)
        return await asyncio.gather(*(ctl.service_directory(HOUSEHOLD) for _ in range(5)))

    assert asyncio.run(main()) == ["directory"] * 5
    assert reads == ["HH"]


def test_an_old_copy_is_answered_at_once_and_read_again_once():
    reads = []

    async def read(household):
        reads.append(household.id)
        return "new"

    async def main():
        ctl = _controller(read)
        ctl._directories["HH"] = (monotonic() - ctl.DIRECTORY_FRESH - 1, "old")
        first = await ctl.service_directory(HOUSEHOLD)
        second = await ctl.service_directory(HOUSEHOLD)   # the refresh is still pending
        await asyncio.sleep(0)                              # let it run
        await asyncio.sleep(0)
        third = await ctl.service_directory(HOUSEHOLD)
        return first, second, third

    assert asyncio.run(main()) == ("old", "old", "new")
    assert reads == ["HH"]


def test_a_fresh_copy_is_answered_without_asking_the_speakers():
    async def read(household):
        raise AssertionError("no read expected")

    async def main():
        ctl = _controller(read)
        ctl._directories["HH"] = (monotonic(), "held")
        return await ctl.service_directory(HOUSEHOLD)

    assert asyncio.run(main()) == "held"


def test_a_read_begun_before_an_account_change_is_not_kept():
    answers = iter(["before the change", "after the change"])
    gates = []

    async def read(household):
        gate = asyncio.Event()
        gates.append(gate)
        await gate.wait()
        return next(answers)

    async def until(count):
        for _ in range(100):
            if len(gates) >= count:
                return
            await asyncio.sleep(0)
        raise AssertionError(f"only {len(gates)} reads started")

    async def main():
        ctl = _controller(read)
        early = asyncio.ensure_future(ctl.service_directory(HOUSEHOLD))
        await until(1)
        ctl.forget_service_directories()                  # an account was added
        late = asyncio.ensure_future(ctl.service_directory(HOUSEHOLD))
        await until(2)
        for gate in gates:
            gate.set()
        results = await asyncio.gather(early, late)
        return results, ctl._directories["HH"][1]

    (early, late), kept = asyncio.run(main())
    assert early == "before the change"
    assert late == "after the change"
    # The read that began before the change does not put its answer back.
    assert kept == "after the change"


def _reading_controller(reader, hosts):
    players = {h: SimpleNamespace(host=h, online=True, invisible=False) for h in hosts}
    household = SimpleNamespace(id="HH", players=players)
    ctl = SonosController.__new__(SonosController)
    ctl.services = reader
    ctl.soap = SimpleNamespace(is_silent=lambda host: False)
    ctl.configured_sids = lambda hid: set()
    ctl._service_names = {}
    ctl._directory_host = {}
    return ctl, household


def test_the_player_that_answered_last_is_asked_first_and_others_briefly():
    asked = []

    class Reader:
        async def read(self, host, configured=None, **opts):
            asked.append((host, opts))
            if host == "10.0.0.1":
                raise ConnectionError("stalled")
            return SimpleNamespace(services=[])

    ctl, household = _reading_controller(Reader(), ["10.0.0.1", "10.0.0.2", "10.0.0.3"])
    asyncio.run(ctl.read_service_directory(household))
    # The first player was given one short try before the next was asked.
    assert asked[0] == ("10.0.0.1", {"timeout": 4.0, "retries": 0, "strict": True})
    assert asked[1][0] == "10.0.0.2"
    assert ctl._directory_host["HH"] == "10.0.0.2"

    asked.clear()
    asyncio.run(ctl.read_service_directory(household))
    assert asked[0][0] == "10.0.0.2"          # the one that answered goes first


def test_the_last_player_left_gets_the_clients_own_patience():
    asked = []

    class Reader:
        async def read(self, host, configured=None, **opts):
            asked.append(opts)
            return SimpleNamespace(services=[])

    ctl, household = _reading_controller(Reader(), ["10.0.0.1"])
    asyncio.run(ctl.read_service_directory(household))
    assert asked == [{}]


def test_the_first_account_list_drops_a_directory_read_without_it():
    """A directory read before the speakers' account list arrived knows none
    of the household's accounts; kept, it would count too few services in
    use until it next went stale."""
    ctl = _controller(None)
    ctl._directories["HH"] = (monotonic(), "read without accounts")
    ctl._service_blob = {}
    ctl._host_to_zone = {"10.0.0.1": "RINCON_A", "10.0.0.2": "RINCON_B"}
    ctl.household_of = lambda zone: HOUSEHOLD if zone in ("RINCON_A", "RINCON_B") else None
    ctl._note_accounts = lambda host, blob: None
    event = SimpleNamespace(host="10.0.0.1", properties={"ThirdPartyMediaServersX": "sealed"})

    ctl._directory_basis["HH"] = frozenset()             # read before any accounts
    ctl.configured_sids = lambda household_id: {12, 188}  # the list now open
    asyncio.run(SonosController._note_service_change(ctl, event))
    assert "HH" not in ctl._directories

    # Another player's first list, the same accounts the directory was read
    # with: nothing to fix, so it stays.
    ctl._directories["HH"] = (monotonic(), "read with accounts")
    ctl._directory_basis["HH"] = frozenset({12, 188})
    asyncio.run(SonosController._note_service_change(ctl, SimpleNamespace(
        host="10.0.0.2", properties={"ThirdPartyMediaServersX": "sealed"})))
    assert "HH" in ctl._directories

    # A later list from the same player is news, and takes the usual path.
    ctl._directories["HH"] = (monotonic(), "kept")
    ctl._services_refresh = None
    scheduled = []
    async def refresh():
        scheduled.append(True)
    ctl._debounced_services_refresh = refresh

    async def go():
        await SonosController._note_service_change(ctl, SimpleNamespace(
            host="10.0.0.1", properties={"ThirdPartyMediaServersX": "sealed again"}))
        await asyncio.sleep(0)
    asyncio.run(go())
    assert scheduled == [True]


def test_a_sign_in_uses_the_dropped_copy_while_the_next_is_read():
    """Linking needs only the service's endpoint. After an account change a
    dozen players report it one by one, and a sign-in poll that waited for
    each fresh catalog took 9 to 18 s (Libby)."""
    gate = asyncio.Event()
    reads = []

    async def read(household):
        reads.append(household.id)
        await gate.wait()
        return "fresh"

    async def main():
        ctl = _controller(read)
        ctl._directories["HH"] = (monotonic(), "held")
        ctl.forget_service_directories()                  # an account was added
        quick = await ctl.service_directory(HOUSEHOLD, stale_ok=True)
        waiting = asyncio.ensure_future(ctl.service_directory(HOUSEHOLD))
        await asyncio.sleep(0)
        gate.set()
        return quick, await waiting

    quick, fresh = asyncio.run(main())
    assert quick == "held"
    assert fresh == "fresh"
