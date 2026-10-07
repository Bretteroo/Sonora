"""The speakers' own update decides the "Update Now" row, never the app's."""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import SonosController, parse_update_item

ITEM = ('&lt;UpdateItem xmlns="urn:schemas-rinconnetworks-com:update-1-0" Type="Software" '
        'Version="57.23-80060" UpdateURL="http://update-firmware.sonos.com/firmware/Prod/'
        '57.23-80060-v11.16.2-x/^57.23-80060" DownloadSize="0"/&gt;')


def test_the_update_item_is_read():
    item = parse_update_item(ITEM)
    assert item["type"] == "Software"
    assert item["version"] == "57.23-80060"
    assert item["url"].endswith("^57.23-80060")


def _controller(players, item, calls):
    ctl = SonosController.__new__(SonosController)
    ctl._software_updates = {}
    ctl.any_host = lambda household: "192.168.0.105"

    async def call(host, service, action, args, **kw):
        calls.append((host, action, args))
        if action == "CheckForUpdate":
            return {"UpdateItem": item}
        return {}

    ctl.soap = SimpleNamespace(call=call)
    household = SimpleNamespace(id="HH", players={p.uuid: p for p in players})
    return ctl, household


def _player(uuid, version, online=True):
    return SimpleNamespace(uuid=uuid, name=uuid, host=f"10.0.0.{uuid[-1]}", online=online, software_version=version)


def test_players_behind_the_item_make_an_update_pending_and_only_they_are_updated():
    calls = []
    ctl, hh = _controller([_player("P1", "57.23-74170"), _player("P2", "57.23-80060"),
                           _player("P3", "57.23-74170", online=False)], ITEM, calls)
    status = asyncio.run(ctl.software_update(hh))
    assert status["pending"] is True
    assert [p["uuid"] for p in status["players"]] == ["P1"]
    result = asyncio.run(ctl.begin_software_update(hh))
    begun = [c for c in calls if c[1] == "BeginSoftwareUpdate"]
    assert result["started"] == ["P1"]
    assert begun == [("10.0.0.1", "BeginSoftwareUpdate",
                      {"UpdateURL": parse_update_item(ITEM)["url"], "Flags": 0, "ExtraOptions": ""})]


def test_current_players_mean_no_row_and_nothing_is_started():
    """Every S1 player on 57.23-74170 with the item at 57.23-74170: the
    household of 2026-09-23, where only the Mac app wanted an update."""
    calls = []
    current = ITEM.replace("80060", "74170")
    ctl, hh = _controller([_player("P1", "57.23-74170"), _player("P2", "57.23-74170")], current, calls)
    assert asyncio.run(ctl.software_update(hh))["pending"] is False
    assert asyncio.run(ctl.begin_software_update(hh))["started"] == []
    assert not [c for c in calls if c[1] == "BeginSoftwareUpdate"]
