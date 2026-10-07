"""Speech enhancement on a player that keeps the switch apart from its level.

An Arc Ultra has SpeechEnhanceEnabled as the switch and DialogLevel as the
strength. Sonora read and wrote DialogLevel as the switch, so speech
enhancement could be turned on and never off: 0 is not a strength, and
the level stayed at 1.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands
from backend.sonos.soap import SoapFault


class _Soap:
    def __init__(self, values):
        self.values = dict(values)
        self.sets = []

    def is_silent(self, host):
        return False

    async def call(self, host, service, action, args=None, **kwargs):
        if action == "GetEQ":
            if args["EQType"] not in self.values:
                raise SoapFault("402", "Invalid Args")
            return {"CurrentValue": str(self.values[args["EQType"]])}
        if action == "SetEQ":
            self.sets.append((args["EQType"], args["DesiredValue"]))
            self.values[args["EQType"]] = args["DesiredValue"]
            return {}
        raise SoapFault("401", "Invalid Action")


def _commands(values):
    zone = SimpleNamespace(host="192.168.0.110", online=True, supports_line_in=False, generation="S2")
    household = SimpleNamespace(id="HH", zones={"Z": SimpleNamespace(players=[])})
    soap = _Soap(values)
    commands = Commands.__new__(Commands)
    async def features(uuid):
        return {"HEIGHT_CHANNEL_TUNING"}   # what an Arc Ultra declares in /info
    commands._c = SimpleNamespace(zone=lambda uuid: zone, household_of=lambda uuid: household, soap=soap,
                                  device_features=features)
    commands._speech_switch = set()
    return commands, soap


def test_an_arc_ultra_reports_its_switch_as_the_speech_toggle():
    commands, _ = _commands({"DialogLevel": 1, "SpeechEnhanceEnabled": 0, "NightMode": 0})
    settings = asyncio.run(commands.room_settings("Z"))
    assert settings["eq"]["DialogLevel"] == 0      # the switch, which is off
    assert "SpeechEnhanceEnabled" not in settings["eq"]
    assert settings["speech_level"] == 1


def test_turning_it_off_writes_the_switch_not_the_level():
    commands, soap = _commands({"DialogLevel": 1, "SpeechEnhanceEnabled": 1})
    asyncio.run(commands.set_eq("Z", "DialogLevel", 0))
    assert soap.sets == [("SpeechEnhanceEnabled", 0)]
    assert soap.values["DialogLevel"] == 1


def test_an_older_player_keeps_dialog_level_as_its_switch():
    commands, soap = _commands({"DialogLevel": 1, "NightMode": 0})
    settings = asyncio.run(commands.room_settings("Z"))
    assert settings["eq"]["DialogLevel"] == 1 and "speech_level" not in settings
    asyncio.run(commands.set_eq("Z", "DialogLevel", 0))
    assert soap.sets == [("DialogLevel", 0)]



def test_height_is_offered_only_where_the_speaker_declares_it():
    """Every S2 player answers GetEQ HeightChannelLevel with 0, a Roam 2 and a
    Ray included (2026-10-05); only the speaker's feature list says which have
    height drivers."""
    import asyncio
    commands, _ = _commands({"HeightChannelLevel": 0, "SubGain": 0})

    async def portable(uuid):
        return {"PORTABLE", "MONO_SPEAKER"}
    commands._c.device_features = portable
    assert "HeightChannelLevel" not in asyncio.run(commands.room_settings("Z"))["eq"]

    async def arc(uuid):
        return {"HEIGHT_CHANNEL_TUNING", "DOLBY_ATMOS"}
    commands._c.device_features = arc
    assert "HeightChannelLevel" in asyncio.run(commands.room_settings("Z"))["eq"]
