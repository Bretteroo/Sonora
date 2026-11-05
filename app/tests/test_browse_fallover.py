"""A household-wide browse asks the household's next player when the first
does not answer in time, rather than failing on a speaker whose web server
has hung; a queue is only ever asked of its own player."""

import asyncio
from types import SimpleNamespace

import pytest

from backend import main


@pytest.fixture
def house(monkeypatch):
    asked = []

    async def browse(host, object_id, **kwargs):
        asked.append((host, kwargs.get("timeout"), kwargs.get("retries")))
        if host == "hung":
            raise ConnectionError(f"{host} did not answer ContentDirectory#Browse: ")
        return SimpleNamespace(host=host)

    fake = SimpleNamespace(
        zones={"Z": object()},
        household_hosts=lambda uuid: ["hung", "fine"],
        household_host=lambda uuid: "hung",
        content=SimpleNamespace(browse=browse),
    )
    monkeypatch.setattr(main, "controller", lambda: fake)
    return asked


def test_a_hung_player_hands_over_to_the_next(house):
    result, host = asyncio.run(main._browse_household("Z", "FV:2"))
    assert host == "fine" and result.host == "fine"
    # The hung one gets a short wait and no retries; the last one asked gets the client's own.
    assert house == [("hung", main._BROWSE_STEP_S, 0), ("fine", None, None)]


def test_a_queue_is_asked_of_its_own_player_only(house):
    with pytest.raises(ConnectionError):
        asyncio.run(main._browse_household("Z", "Q:0"))
    assert [h for h, _, _ in house] == ["hung"]
