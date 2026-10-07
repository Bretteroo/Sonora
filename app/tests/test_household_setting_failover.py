"""A household setting is read from any player that answers.

Every player of a household holds the same value, so one that does not
answer is passed over. The S1 system's content filtering showed "could not
be read" at times: the read went to one player only, the first
online S1 room, and a player that did not answer within 8 seconds left the
setting unknown in every theme.
"""

import asyncio
from types import SimpleNamespace

import pytest

from backend.sonos.controller import SonosController
from backend.sonos.hhsettings import EXPLICIT_FILTERING, SettingsError, SettingsUnanswered


def _controller(answers):
    asked, silenced = [], []

    class Settings:
        async def read(self, host, setting, timeout=None):
            asked.append((host, timeout))
            answer = answers[host]
            if isinstance(answer, Exception):
                raise answer
            return answer

    ctl = SonosController.__new__(SonosController)
    ctl.hhsettings = Settings()
    ctl.soap = SimpleNamespace(mark_silent=silenced.append)
    return ctl, asked, silenced


def test_a_player_that_does_not_answer_is_passed_over_and_steered_around():
    ctl, asked, silenced = _controller({
        "10.0.0.35": SettingsUnanswered("10.0.0.35 did not answer"),
        "10.0.0.66": "false",
    })
    text, host = asyncio.run(ctl.read_household_setting(["10.0.0.35", "10.0.0.66"], EXPLICIT_FILTERING))
    assert (text, host) == ("false", "10.0.0.66")
    assert asked == [("10.0.0.35", 4.0), ("10.0.0.66", None)]   # a short try, then the last with patience
    assert silenced == ["10.0.0.35"]


def test_a_refusal_is_an_answer_and_is_not_asked_elsewhere():
    ctl, asked, _ = _controller({
        "10.0.0.35": SettingsError("10.0.0.35 answered 403"),
        "10.0.0.66": "false",
    })
    with pytest.raises(SettingsError):
        asyncio.run(ctl.read_household_setting(["10.0.0.35", "10.0.0.66"], EXPLICIT_FILTERING))
    assert [host for host, _ in asked] == ["10.0.0.35"]


def test_when_no_player_answers_the_last_failure_is_reported():
    ctl, _, _ = _controller({
        "10.0.0.35": SettingsUnanswered("35 did not answer"),
        "10.0.0.66": SettingsUnanswered("66 did not answer"),
    })
    with pytest.raises(SettingsUnanswered, match="66"):
        asyncio.run(ctl.read_household_setting(["10.0.0.35", "10.0.0.66"], EXPLICIT_FILTERING))
