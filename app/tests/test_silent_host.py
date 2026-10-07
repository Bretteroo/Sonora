"""A player that stops answering is steered around for household-wide reads."""

from types import SimpleNamespace

from backend.sonos.controller import SonosController


def _controller(silent):
    """The method under test, bound to a stand-in with just what it reads."""
    zone_a = SimpleNamespace(uuid="A", host="10.0.0.1")
    zone_b = SimpleNamespace(uuid="B", host="10.0.0.2")
    players = {
        "A": SimpleNamespace(host="10.0.0.1", online=True),
        "B": SimpleNamespace(host="10.0.0.2", online=True),
        "C": SimpleNamespace(host="10.0.0.3", online=False),
    }
    household = SimpleNamespace(id="H", zones={"A": zone_a, "B": zone_b}, players=players)
    fake = SimpleNamespace(
        soap=SimpleNamespace(is_silent=lambda host: host in silent),
        zone=lambda uuid: {"A": zone_a, "B": zone_b}[uuid],
        household_of=lambda uuid: household,
    )
    fake.household_host = lambda uuid: SonosController.household_host(fake, uuid)
    return fake


def test_the_zones_own_player_answers_when_it_is_awake():
    assert _controller(set()).household_host("A") == "10.0.0.1"


def test_a_silent_player_is_replaced_by_an_awake_one_of_the_household():
    assert _controller({"10.0.0.1"}).household_host("A") == "10.0.0.2"


def test_an_offline_player_never_stands_in():
    # Only C is left awake, and it is offline, so the zone's own host stays.
    assert _controller({"10.0.0.1", "10.0.0.2"}).household_host("A") == "10.0.0.1"


def test_a_household_change_skips_a_room_that_has_gone_quiet():
    """Deleting a playlist from a page whose room's speaker was
    unreachable waited 26 seconds and failed; any other player could have
    done it."""
    from types import SimpleNamespace

    from backend.sonos.controller import Commands

    guest = SimpleNamespace(host="192.168.0.104", online=False)
    household = SimpleNamespace(id="HH")
    ctl = SimpleNamespace(zone=lambda uuid: guest, household_of=lambda uuid: household,
                          any_host=lambda hh: "192.168.0.105",
                          soap=SimpleNamespace(is_silent=lambda host: False))
    commands = Commands.__new__(Commands)
    commands._c = ctl
    assert commands._household_host("RINCON_GUEST") == "192.168.0.105"

    guest.online = True
    assert commands._household_host("RINCON_GUEST") == "192.168.0.104"
    ctl.soap = SimpleNamespace(is_silent=lambda host: host == "192.168.0.104")
    assert commands._household_host("RINCON_GUEST") == "192.168.0.105"


def test_an_account_rename_goes_to_a_player_that_answers():
    """Renaming a service account from Preferences went to the household's
    first room, an unreachable one, and hung."""
    import asyncio
    from types import SimpleNamespace

    from backend.sonos.controller import Commands

    guest = SimpleNamespace(host="192.168.0.104", online=False)
    household = SimpleNamespace(id="HH")
    sent = []

    async def call(host, service, action, args):
        sent.append(host)
        return SimpleNamespace(args={})

    ctl = SimpleNamespace(zone=lambda uuid: guest, household_of=lambda uuid: household,
                          any_host=lambda hh: "192.168.0.105",
                          soap=SimpleNamespace(call=call, is_silent=lambda host: False))
    commands = Commands.__new__(Commands)
    commands._c = ctl
    asyncio.run(commands.rename_account("RINCON_GUEST", "SA_RINCON48135_x", "Alex"))
    assert sent == ["192.168.0.105"]
