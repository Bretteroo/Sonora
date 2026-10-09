"""A soundbar's settings beyond sound, as the Sonos app offers them: TV
autoplay, the IR signal light and repeater, touch controls, Trueplay, and the
speech enhancement level. Each is read only where the player declares the
hardware behind it, since every player answers these reads."""

import asyncio
from types import SimpleNamespace

import pytest

from backend.sonos.controller import Commands
from backend.sonos.soap import SoapFault

ARC = "RINCON_ARC01400"


class _Soap:
    """A speaker that answers every read the soundbar settings make."""

    def __init__(self, **values):
        self.values = {"RoomUUID": ARC, "IncludeLinkedZones": "0", "LEDFeedbackState": "On",
                       "CurrentIRRepeaterState": "Off", "CurrentButtonLockState": "Off",
                       "RoomCalibrationAvailable": "1", "RoomCalibrationEnabled": "1",
                       "CurrentLEDState": "On", **values}
        self.sets = []

    def is_silent(self, host):
        return False

    async def call(self, host, service, action, args=None, **kwargs):
        if action == "GetEQ":
            raise SoapFault("402", "Invalid Args")
        if action.startswith(("Get", "Is")):
            return dict(self.values)
        self.sets.append((action, dict(args or {})))
        return {}


def _commands(soap, capabilities=(), features=(), model_number="S45", speech_max=False):
    zone = SimpleNamespace(host="h", online=True, supports_line_in=False, generation="S2",
                           model_number=model_number, speech_max=speech_max)
    household = SimpleNamespace(id="HH", zones={ARC: SimpleNamespace(players=[])})
    commands = Commands.__new__(Commands)

    async def feats(uuid):
        return set(features)

    async def caps(uuid):
        return set(capabilities)
    commands._c = SimpleNamespace(zone=lambda uuid: zone, household_of=lambda uuid: household, soap=soap,
                                  device_features=feats, device_capabilities=caps)
    return commands


def test_a_soundbar_reports_its_tv_and_ir_settings():
    commands = _commands(_Soap(), {"HT_PLAYBACK", "IR_CONTROL"}, {"IR_TRANSMITTER"})
    out = asyncio.run(commands.room_settings(ARC))
    assert out["tv_autoplay"] is True and out["tv_autoplay_ungroup"] is True
    assert out["ir_light"] is True and out["ir_repeater"] is False
    assert out["button_lock"] is False and out["trueplay"] is True


def test_a_speaker_without_the_hardware_reports_none_of_it():
    commands = _commands(_Soap(RoomCalibrationAvailable="0"), model_number="S12")
    out = asyncio.run(commands.room_settings(ARC))
    for key in ("tv_autoplay", "tv_autoplay_ungroup", "ir_light", "ir_repeater", "trueplay"):
        assert key not in out


def test_only_a_player_with_an_ir_transmitter_has_a_repeater():
    commands = _commands(_Soap(), {"HT_PLAYBACK", "IR_CONTROL"})
    assert "ir_repeater" not in asyncio.run(commands.room_settings(ARC))


def test_tv_autoplay_on_names_this_room_and_off_regroups():
    soap = _Soap()
    commands = _commands(soap)
    asyncio.run(commands.set_tv_autoplay(ARC, on=True))
    assert soap.sets == [("SetAutoplayRoomUUID", {"RoomUUID": ARC, "Source": "TV"})]
    soap.sets.clear()
    asyncio.run(commands.set_tv_autoplay(ARC, on=False))
    assert soap.sets == [("SetAutoplayRoomUUID", {"RoomUUID": "", "Source": "TV"}),
                         ("SetAutoplayLinkedZones", {"IncludeLinkedZones": "1", "Source": "TV"})]


def test_ungroup_is_the_inverse_of_including_grouped_rooms():
    soap = _Soap()
    asyncio.run(_commands(soap).set_tv_autoplay(ARC, ungroup=True))
    assert soap.sets == [("SetAutoplayLinkedZones", {"IncludeLinkedZones": "0", "Source": "TV"})]


def test_speech_level_max_only_where_the_player_offers_it():
    soap = _Soap()
    asyncio.run(_commands(soap).set_speech_level(ARC, 3))
    assert soap.sets == [("SetEQ", {"InstanceID": 0, "EQType": "DialogLevel", "DesiredValue": 3})]
    with pytest.raises(ValueError):
        asyncio.run(_commands(_Soap()).set_speech_level(ARC, 4))
    asyncio.run(_commands(_Soap(), speech_max=True).set_speech_level(ARC, 4))
    with pytest.raises(ValueError):           # a Beam keeps DialogLevel as its switch
        asyncio.run(_commands(_Soap(), model_number="S31").set_speech_level(ARC, 2))


def test_ir_and_trueplay_writes():
    soap = _Soap()
    commands = _commands(soap)
    asyncio.run(commands.set_ir(ARC, light=False, repeater=True))
    asyncio.run(commands.set_trueplay(ARC, False))
    assert soap.sets == [("SetLEDFeedbackState", {"LEDFeedbackState": "Off"}),
                         ("SetIRRepeaterState", {"DesiredIRRepeaterState": "On"}),
                         ("SetRoomCalibrationStatus", {"InstanceID": 0, "RoomCalibrationEnabled": "0"})]
