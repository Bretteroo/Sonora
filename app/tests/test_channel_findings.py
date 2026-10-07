"""Channel findings judge only what a channel means for each speaker.

On SonosNet the speakers relay for one another and must share a channel. On
the household's WiFi each speaker is on its access point's channel, and two
on different channels have joined different access points, which is normal.
Overlap is a 2.4GHz matter only.
"""

from backend.sonos.diagnostics import MeshNeighbor, WirelessStatus
from backend.sonos.network import NetworkCollector, NetworkSnapshot, ZoneRadio


FREQ = {3: 2422, 6: 2437, 11: 2462, 36: 5180, 149: 5745}


def _radio(name, channel, mesh):
    status = WirelessStatus(host=f"10.0.0.{len(name)}")
    status.operating_channel = FREQ[channel]  # the speaker reports MHz
    status.neighbors = [MeshNeighbor(mac="78:28:CA:21:2A:49", rx_margin=29, tx_margin=31)]
    status.bridge_stp = mesh
    return ZoneRadio(zone_uuid=name, zone_name=name, host=status.host, model="S1", wireless=status)


def _codes(radios):
    snap = NetworkSnapshot(household_id="h", radios={r.zone_uuid: r for r in radios})
    return [f.code for f in NetworkCollector._derive_findings(snap)]


def test_wifi_speakers_on_different_access_points_are_not_flagged():
    codes = _codes([_radio("Pantry", 11, False), _radio("Gym", 11, False),
                    _radio("Workshop", 6, False), _radio("Terrace", 6, False), _radio("Guest", 6, False)])
    assert "channel_outlier" not in codes


def test_a_mesh_speaker_off_the_mesh_channel_is_flagged():
    codes = _codes([_radio("Pantry", 11, True), _radio("Workshop", 6, True), _radio("Terrace", 6, True)])
    assert "channel_outlier" in codes


def test_five_gigahertz_channels_do_not_overlap():
    assert "overlapping_channel" not in _codes([_radio("Pantry", 36, False), _radio("Workshop", 149, False)])
    assert "overlapping_channel" in _codes([_radio("Pantry", 3, False)])
