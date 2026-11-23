"""Stop on a soundbar hands the room back to its television input."""
import asyncio
from types import SimpleNamespace

from backend.sonos.controller import Commands


class Soap:
    def __init__(self):
        self.calls = []

    async def call(self, host, service, action, args=None):
        self.calls.append((host, action, (args or {}).get("CurrentURI", "")))
        return {}


def commands(media_uri, capabilities):
    lead = SimpleNamespace(uuid="RINCON_A", host="10.0.0.1",
                           transport=SimpleNamespace(media_uri=media_uri))

    async def device_capabilities(uuid):
        return set(capabilities)

    controller = SimpleNamespace(
        coordinator_of=lambda uuid: lead,
        zone=lambda uuid: lead,
        zones={"RINCON_A": lead},
        device_capabilities=device_capabilities,
        soap=Soap(),
    )
    cmd = Commands.__new__(Commands)
    cmd._c = controller
    return cmd


def actions(cmd):
    return [(action, uri) for _, action, uri in cmd.soap.calls]


def test_soundbar_on_its_queue_goes_to_the_television():
    cmd = commands("x-rincon-queue:RINCON_A#0", {"PLAYBACK", "HT_PLAYBACK"})
    asyncio.run(cmd.stop_to_tv("RINCON_B"))
    assert actions(cmd) == [("SetAVTransportURI", "x-sonos-htastream:RINCON_A:spdif"), ("Play", "")]


def test_soundbar_already_on_television_is_only_stopped():
    cmd = commands("x-sonos-htastream:RINCON_A:spdif", {"PLAYBACK", "HT_PLAYBACK"})
    asyncio.run(cmd.stop_to_tv("RINCON_A"))
    assert actions(cmd) == [("Stop", "")]


def test_other_rooms_are_only_stopped():
    cmd = commands("x-rincon-queue:RINCON_A#0", {"PLAYBACK", "LINE_IN"})
    asyncio.run(cmd.stop_to_tv("RINCON_A"))
    assert actions(cmd) == [("Stop", "")]
