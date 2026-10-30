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


# --- two lines of S2 -------------------------------------------------------------------------

from backend.sonos.controller import parse_update_manifest, player_update_target, version_key  # noqa: E402

S2_ITEM = ('&lt;UpdateItem xmlns="urn:schemas-rinconnetworks-com:update-1-0" Type="Software" Version="97.2-81220" '
           'UpdateURL="http://update-firmware.sonos.com/firmware/Prod/97.2-81220-x/^97.2-81220" DownloadSize="0" '
           'ManifestURL="http://update.sonos.com/firmware/Prod/2026-Sonos-21-x/update.upm" Swgen="2" LatestSwgen="2"/&gt;')

# The shape of the manifest read on 2026-10-30: the system at 97.2-81220,
# the Play:1 (model 8 and model 20) and SYMFONISK Gen 1 (model 20) held at
# 86.10-81100, with milestones for players coming from far back.
MANIFEST = """<?xml version="1.0"?>
<update_manifest version="1.1" revision="0652fb08" system_version="97.2-81220" default_version="97.2-81220"
                 base_url="http://update-firmware.sonos.com/firmware/Prod/97.2-81220-x/^97.2-81220" swgen="2">
  <update_list>
    <image model="8" fromver_min="57.19-46310" fromver_max="57.99-99999" version="86.10-81100">http://f/86.10-81100/^86.10-81100</image>
    <image model="8" fromver_min="73.0-42060" version="86.10-81100">http://f/86.10-81100/^86.10-81100</image>
    <image model="20" fromver_min="54.2-71230" version="86.10-81100">http://f/86.10-81100/^86.10-81100</image>
    <image model="20" fromver_min="34.7-33246" fromver_max="57.5-87009" version="57.5-87010" flags="0x4">http://f/57.5-87010/^57.5-87010</image>
    <image model="8" fromver_min="58.0-00000" fromver_max="73.0-42059" version="73.0-42060" flags="0x4">http://f/73.0-42060/^73.0-42060</image>
    <image model="3" submodel_min="0" submodel_max="1" version="34.16-37101">http://f/34.16-37101/^34.16-37101</image>
    <image model="3" version="90.0-77070">http://f/90.0-77070/^90.0-77070</image>
  </update_list>
</update_manifest>
"""


def test_the_manifest_is_read():
    item = parse_update_item(S2_ITEM)
    assert item["manifest"].endswith("update.upm")
    manifest = parse_update_manifest(MANIFEST)
    assert manifest["default"] == "97.2-81220" and manifest["url"].endswith("^97.2-81220")
    assert len(manifest["images"]) == 7
    assert parse_update_manifest("<html>no</html>") == {} and parse_update_manifest("") == {}
    assert version_key("86.10-81100") < version_key("97.2-81220") < version_key("100.0-1")


def test_each_player_is_sent_to_its_own_line():
    manifest = parse_update_manifest(MANIFEST)
    # A Play:1 S12 (model 20) on the legacy line is current at 86.10-81100.
    assert player_update_target(manifest, "1.20.1.6-1.1", "86.10-81100") == ("86.10-81100", "http://f/86.10-81100/^86.10-81100")
    # A Ray (model 36) has no image of its own and takes the system's build.
    assert player_update_target(manifest, "1.36.1.8-1.2", "97.2-81220") == ("97.2-81220", manifest["url"])
    # A Play:1 (model 8) just moved from S1 goes to the legacy line's build,
    # and one from far back takes the next milestone first.
    assert player_update_target(manifest, "1.8.3.7-1.0", "57.23-74170")[0] == "86.10-81100"
    assert player_update_target(manifest, "1.8.3.7-1.0", "60.1-10000")[0] == "73.0-42060"
    # Submodel ranges hold: a Play:3 submodel 1 and submodel 3.
    assert player_update_target(manifest, "1.3.1.2-1.0", "30.0-1")[0] == "34.16-37101"
    assert player_update_target(manifest, "1.3.3.2-1.0", "30.0-1")[0] == "90.0-77070"
    # A player whose hardware version is not of that shape gets the default.
    assert player_update_target(manifest, "", "86.10-81100")[0] == "97.2-81220"


def _s2_controller(players, calls, manifest=MANIFEST):
    ctl, hh = _controller(players, S2_ITEM, calls)
    ctl._update_manifests = {}
    read = []

    async def _update_manifest(url):
        read.append(url)
        return parse_update_manifest(manifest) if manifest else {}

    ctl._update_manifest = _update_manifest
    return ctl, hh, read


def _s2_player(uuid, hardware, version):
    return SimpleNamespace(uuid=uuid, name=uuid, host=f"10.0.0.{uuid[-1]}", online=True,
                           software_version=version, hardware_version=hardware)


def test_a_legacy_player_current_on_its_own_line_is_not_behind():
    """The household of issue 23: a Port on 97.2-81220 beside Play:1s on
    86.10-81100, every one current, and the item from any of them naming
    97.2-81220."""
    calls = []
    ctl, hh, read = _s2_controller([_s2_player("P1", "1.23.1.1-1.0", "97.2-81220"),
                                    _s2_player("P2", "1.20.1.6-1.1", "86.10-81100"),
                                    _s2_player("P3", "1.8.3.7-1.0", "86.10-81100")], calls)
    status = asyncio.run(ctl.software_update(hh))
    assert status["pending"] is False and status["players"] == []
    assert read == ["http://update.sonos.com/firmware/Prod/2026-Sonos-21-x/update.upm"]


def test_a_legacy_player_behind_on_its_line_is_updated_to_that_line():
    calls = []
    ctl, hh, read = _s2_controller([_s2_player("P1", "1.36.1.8-1.2", "97.2-81220"),
                                    _s2_player("P2", "1.8.3.7-1.0", "57.23-74170")], calls)
    status = asyncio.run(ctl.software_update(hh))
    assert status["pending"] is True and [p["uuid"] for p in status["players"]] == ["P2"]
    # The row names the build that player is going to, not the system's.
    assert status["version"] == "86.10-81100" and status["display"] == ""
    result = asyncio.run(ctl.begin_software_update(hh))
    assert result["started"] == ["P2"]
    begun = [c for c in calls if c[1] == "BeginSoftwareUpdate"]
    assert begun == [("10.0.0.2", "BeginSoftwareUpdate",
                      {"UpdateURL": "http://f/86.10-81100/^86.10-81100", "Flags": 0, "ExtraOptions": ""})]


def test_a_modern_player_behind_names_the_system_build():
    calls = []
    ctl, hh, _ = _s2_controller([_s2_player("P1", "1.36.1.8-1.2", "96.1-80000"),
                                 _s2_player("P2", "1.20.1.6-1.1", "86.10-81100")], calls)
    status = asyncio.run(ctl.software_update(hh))
    assert status["pending"] is True and [p["uuid"] for p in status["players"]] == ["P1"]
    assert status["version"] == "97.2-81220"


def test_without_the_manifest_the_item_stands_for_every_player():
    calls = []
    ctl, hh, _ = _s2_controller([_s2_player("P1", "1.23.1.1-1.0", "97.2-81220"),
                                 _s2_player("P2", "1.20.1.6-1.1", "86.10-81100")], calls, manifest="")
    status = asyncio.run(ctl.software_update(hh))
    assert status["pending"] is True and [p["uuid"] for p in status["players"]] == ["P2"]
    assert status["version"] == "97.2-81220"
