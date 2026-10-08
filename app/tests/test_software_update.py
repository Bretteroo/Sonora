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


# --- the speakers' announcement ------------------------------------------------------------

from backend.sonos.events import Event  # noqa: E402


def _zgs(versions):
    members = "".join(
        f'<ZoneGroupMember UUID="{u}" Location="http://10.0.0.{u[-1]}:1400/xml/device_description.xml" '
        f'ZoneName="{u}" SoftwareVersion="{v}"/>' for u, v in versions.items())
    return f'<ZoneGroupState><ZoneGroups><ZoneGroup Coordinator="P1" ID="P1:1">{members}</ZoneGroup></ZoneGroups></ZoneGroupState>'


def _announcing(players):
    ctl = SonosController.__new__(SonosController)
    ctl._software_updates = {"HH": (0.0, {"pending": False})}
    ctl._update_seen = {}
    ctl.zones = {}
    household = SimpleNamespace(id="HH", players={p.uuid: p for p in players})
    ctl.registry = SimpleNamespace(households={"HH": household})
    sent = []

    async def broadcast(message):
        sent.append(message)

    ctl._broadcast = broadcast
    return ctl, household, sent


def _event(item, versions):
    return Event(host="10.0.0.1", service="ZoneGroupTopology",
                 properties={"AvailableSoftwareUpdate": item, "ZoneGroupState": _zgs(versions)})


def test_an_announced_update_is_passed_on_at_once_and_its_install_too():
    """The S1 apps keep no timer: the topology event's AvailableSoftwareUpdate
    tells them. The first event only records; a new item, and later the
    players running it, each drop the cached answer and tell the pages."""
    p1, p2 = _player("P1", "57.23-74170"), _player("P2", "57.23-74170")
    ctl, hh, sent = _announcing([p1, p2])
    current = ITEM.replace("80060", "74170")
    asyncio.run(ctl._note_software_update(_event(current, {"P1": "57.23-74170", "P2": "57.23-74170"})))
    assert sent == [] and "HH" in ctl._software_updates

    asyncio.run(ctl._note_software_update(_event(ITEM, {"P1": "57.23-74170", "P2": "57.23-74170"})))
    assert sent == [{"type": "softwareUpdate", "household": "HH"}]
    assert "HH" not in ctl._software_updates

    # The same announcement again is no news.
    asyncio.run(ctl._note_software_update(_event(ITEM, {"P1": "57.23-74170", "P2": "57.23-74170"})))
    assert len(sent) == 1

    # A player back on the new version: its record follows what it says.
    asyncio.run(ctl._note_software_update(_event(ITEM, {"P1": "57.23-80060", "P2": "57.23-74170"})))
    assert len(sent) == 2 and p1.software_version == "57.23-80060"


def test_an_event_from_another_household_is_not_counted_here():
    ctl, hh, sent = _announcing([_player("P1", "57.23-74170")])
    stranger = Event(host="10.9.9.9", service="ZoneGroupTopology", properties={"AvailableSoftwareUpdate": ITEM})
    asyncio.run(ctl._note_software_update(stranger))
    assert ctl._update_seen == {} and sent == []
