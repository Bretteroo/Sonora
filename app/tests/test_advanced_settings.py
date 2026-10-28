"""The household settings the 2018 Windows app kept on its Advanced tab, and
Line-Out Level. Each Advanced setting is a SystemProperties string; only the
names and values the app's own core writes are accepted."""

import asyncio
from types import SimpleNamespace

import pytest

from backend.sonos.controller import Commands, SonosController


class _Soap:
    def __init__(self, values=None):
        self.values = values or {}
        self.sets = []

    async def call(self, host, service, action, args=None, **kwargs):
        if action == "GetString":
            return {"StringValue": self.values.get(args["VariableName"], "")}
        self.sets.append((action, dict(args or {})))
        return {}


def _controller(soap):
    ctl = SonosController.__new__(SonosController)
    ctl.soap = soap
    ctl.any_host = lambda household: "h"
    return ctl


HOUSEHOLD = SimpleNamespace(id="Sonos_HH")


def test_the_advanced_settings_read_as_the_household_keeps_them():
    soap = _Soap({"R_AudioInEncodeType": "COMPRESSED", "R_UpdatePreference": "all",
                  "R_ShowNSSServers": "1", "R_ShowRhapUPnP": "0", "R_BrowseByFolderSort": "Tracknum"})
    got = asyncio.run(_controller(soap).advanced_settings(HOUSEHOLD))
    assert got == {"audio_compression": "COMPRESSED", "auto_update": "all", "show_media_servers": "1",
                   "show_upnp": "0", "folder_sort": "Tracknum"}


def test_a_setting_is_written_by_its_property_name():
    soap = _Soap()
    asyncio.run(_controller(soap).set_advanced_setting(HOUSEHOLD, "audio_compression", "UNCOMPRESSED"))
    assert soap.sets == [("SetString", {"VariableName": "R_AudioInEncodeType", "StringValue": "UNCOMPRESSED"})]


@pytest.mark.parametrize("key, value", [("audio_compression", "LOSSY"), ("show_upnp", "yes"),
                                        ("R_RadioLocation", "x"), ("nonsense", "1")])
def test_anything_the_app_would_not_write_is_refused(key, value):
    soap = _Soap()
    with pytest.raises(ValueError):
        asyncio.run(_controller(soap).set_advanced_setting(HOUSEHOLD, key, value))
    assert soap.sets == []


def test_line_out_level_fixed_and_variable():
    soap = _Soap()
    commands = Commands.__new__(Commands)
    zone = SimpleNamespace(host="h", fixed_output=False)
    commands._c = SimpleNamespace(zone=lambda uuid: zone, soap=soap)
    asyncio.run(commands.set_fixed_output("Z", True))
    asyncio.run(commands.set_fixed_output("Z", False))
    assert soap.sets == [("SetOutputFixed", {"InstanceID": 0, "DesiredFixed": "1"}),
                         ("SetOutputFixed", {"InstanceID": 0, "DesiredFixed": "0"})]
    assert zone.fixed_output is False
