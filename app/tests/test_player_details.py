"""A product's lines for View System Details come from the player itself.

play.sonos.com's row reads "Beam • Black" and its View dialog adds the serial
number, model, color, Max Volume and "S2 97.1-80312" (2026-09-24). The model
name and color are the player's own /info; Max Volume is the
volumeScalingFactor of its player settings on 1443. A player on an older
board names no color, and one that does not answer /info still has a model
to show.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import SonosController


class _Response:
    def __init__(self, status, body):
        self.status, self._body = status, body

    async def json(self, content_type=None):
        return self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session:
    def __init__(self, info, settings):
        self.info, self.settings, self.asked = info, settings, []

    def get(self, url, **kwargs):
        self.asked.append(url)
        if url.endswith("/info"):
            if self.info is None:
                raise ConnectionError("no answer")
            return _Response(200, self.info)
        if url.endswith("/settings/player"):
            return _Response(200, self.settings)
        raise AssertionError(url)


def _controller(session, generation="S2"):
    player = SimpleNamespace(uuid="RINCON_A", name="Blue Room", host="10.0.0.5",
                             model="Sonos Beam", model_number="S31", display_name="",
                             serial="38-42-0B-00-00-F6:1", software_version="97.1-80312",
                             online=True)
    household = SimpleNamespace(generation=generation, players={"RINCON_A": player})
    ctl = SonosController.__new__(SonosController)
    ctl.registry = SimpleNamespace(households={"HH": household})
    ctl._session = session
    ctl._player_info = {}
    return ctl


def test_the_row_and_dialog_lines_are_the_players_own():
    session = _Session(
        {"device": {"modelDisplayName": "Beam", "color": "Black",
                    "serialNumber": "38-42-0B-00-00-F6:1", "softwareVersion": "97.1-80312"}},
        {"volumeScalingFactor": 1.0})
    found = asyncio.run(_controller(session).player_details("RINCON_A"))
    assert found["model"] == "Beam (Gen 2)"
    assert found["color"] == "Black"
    assert found["max_volume"] == 100
    assert found["generation"] == "S2"
    assert found["software_version"] == "97.1-80312"


def test_a_player_without_info_still_names_its_model():
    session = _Session(None, {"volumeScalingFactor": 0.6})
    found = asyncio.run(_controller(session, "S1").player_details("RINCON_A"))
    assert found["model"] == "Beam (Gen 2)"  # "Sonos Beam", less the maker, and which Beam
    assert found["color"] == ""
    assert found["max_volume"] == 60


def test_info_is_asked_once_and_the_volume_limit_each_time():
    session = _Session({"device": {"modelDisplayName": "Beam", "color": "Black"}},
                       {"volumeScalingFactor": 1.0})
    ctl = _controller(session)
    asyncio.run(ctl.player_details("RINCON_A"))
    asyncio.run(ctl.player_details("RINCON_A"))
    assert sum(url.endswith("/info") for url in session.asked) == 1
    assert sum(url.endswith("/settings/player") for url in session.asked) == 2


def test_an_unknown_player_has_no_details():
    assert asyncio.run(_controller(_Session(None, {})).player_details("RINCON_Z")) is None


def test_a_lost_speaker_is_described_from_what_is_known():
    """The Roam 2, switched off: the speakers' VanishedDevices entry names its
    model number, and the rest is what was last seen of it (2026-09-28)."""
    import asyncio
    from types import SimpleNamespace
    from backend.sonos.controller import SonosController
    from backend.sonos.models import VanishedZone
    ctl = SonosController.__new__(SonosController)
    gone = VanishedZone(uuid="RINCON_C438750000E501400", name="Roam 2", reason="powered off",
                        model_number="S54")
    member = SimpleNamespace(software_version="97.1-80312")
    household = SimpleNamespace(generation="S2", vanished=[gone], players={"x": member})
    ctl.registry = SimpleNamespace(households={"h": household})
    ctl._known = {gone.uuid: {"color": "Black", "serial": "C4-38-75-00-00-E5:1"}}
    found = asyncio.run(ctl.player_details(gone.uuid))
    assert found["model"] == "Roam 2" and found["color"] == "Black"
    assert found["serial"] == "C4-38-75-00-00-E5:1"
    assert found["software_version"] == "97.1-80312" and found["online"] is False
    assert found["max_volume"] is None
