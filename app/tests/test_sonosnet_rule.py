"""A speaker is on SonosNet only if its bridge runs spanning tree.

A speaker on the household's own WiFi still lists the Sonos units it hears on
its channel. This house's S1 speakers do, in station mode with STP off, and
reading that table as a mesh drew connections between rooms that exchange
nothing.
"""

from backend.sonos.diagnostics import MeshNeighbor, WirelessStatus, parse_showstp

OFF = "<ZPSupportInfo><Command cmdline='/usr/sbin/brctl showstp br0'>br0\n STP is disabled for this interface"


def _hearing():
    status = WirelessStatus(host="10.0.0.2")
    status.neighbors = [MeshNeighbor(mac="78:28:CA:21:2A:49", rx_margin=29, tx_margin=31)]
    return status


def test_stp_off_is_not_a_mesh_though_peers_are_heard():
    status = _hearing()
    status.bridge_stp = parse_showstp(OFF)
    assert status.bridge_stp is False
    assert status.on_sonosnet is False


def test_stp_on_with_peers_is_a_mesh():
    status = _hearing()
    status.bridge_stp = True
    assert status.on_sonosnet is True


def test_unread_bridge_falls_back_to_the_peer_table():
    status = _hearing()
    assert parse_showstp(None) is None
    assert status.on_sonosnet is True


def test_the_speakers_own_port_table_says_whether_it_is_wired():
    from backend.sonos.diagnostics import parse_enetports
    off = "<ZPSupportInfo><EnetPorts><Port port='0'><Link>0</Link><Speed>0</Speed></Port></EnetPorts></ZPSupportInfo>"
    on = "<EnetPorts><Port port='0'><Link>0</Link></Port><Port port='1'><Link>1</Link><Speed>100</Speed></Port></EnetPorts>"
    assert parse_enetports(off) is False
    assert parse_enetports(on) is True
    assert parse_enetports(None) is None


def test_a_pairs_second_half_is_known_from_its_ports_without_facts():
    from backend.sonos.network import ZoneRadio
    radio = ZoneRadio(zone_uuid="z", zone_name="Workshop", host="10.0.0.3", model="SYMFONISK",
                      wireless=_hearing(), ethernet=False)
    assert radio.facts is None and radio.wired is False
