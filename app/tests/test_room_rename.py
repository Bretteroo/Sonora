"""Renaming a room and changing its icon. SetZoneAttributes takes the name, the
icon and the configuration together, so whichever the caller leaves out is
read back from the player and sent unchanged; an empty icon would wipe the
room's glyph in the apps that draw one."""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands


class _Soap:
    def __init__(self):
        self.sets = []

    async def call(self, host, service, action, args=None, **kwargs):
        if action == "GetZoneAttributes":
            return {"CurrentZoneName": "Kitchen", "CurrentIcon": "x-rincon-roomicon:kitchen",
                    "CurrentConfiguration": "1"}
        self.sets.append((action, dict(args or {})))
        return {}


def _commands(soap):
    commands = Commands.__new__(Commands)
    zone = SimpleNamespace(host="h")
    commands._c = SimpleNamespace(zone=lambda uuid: zone, soap=soap)
    return commands


def test_a_new_name_keeps_the_rooms_icon_and_configuration():
    soap = _Soap()
    asyncio.run(_commands(soap).rename_zone("Z", "Den"))
    assert soap.sets == [("SetZoneAttributes", {"DesiredZoneName": "Den",
                                                "DesiredIcon": "x-rincon-roomicon:kitchen",
                                                "DesiredConfiguration": "1"})]


def test_an_icon_alone_keeps_the_rooms_name():
    soap = _Soap()
    asyncio.run(_commands(soap).rename_zone("Z", None, "x-rincon-roomicon:patio"))
    assert soap.sets == [("SetZoneAttributes", {"DesiredZoneName": "Kitchen",
                                                "DesiredIcon": "x-rincon-roomicon:patio",
                                                "DesiredConfiguration": "1"})]


def test_a_name_and_icon_together():
    soap = _Soap()
    asyncio.run(_commands(soap).rename_zone("Z", "Garden", "x-rincon-roomicon:garden"))
    assert soap.sets[0][1]["DesiredZoneName"] == "Garden"
    assert soap.sets[0][1]["DesiredIcon"] == "x-rincon-roomicon:garden"
