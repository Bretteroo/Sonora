"""The radio status a speaker reports, and what can be read off it.

The interesting part is that ``/status/proc/ath_rincon/status`` gives margins
above the unit's own noise floor rather than a signal strength, so a signal
figure has to be recovered from the two together, and a unit on ordinary WiFi
has no peer table to recover it from.
"""

from backend.sonos.diagnostics import WirelessStatus, MeshNeighbor, parse_wireless_status


# The shape the speakers actually answer with, trimmed to the lines the
# parser reads: one Noise Floor line per RF chain, and one Node line per peer.
SONOSNET = """
Mode: AP (SonosNet)
Operating on channel 11
Home channel is 11
IEEE channel: 11
RF Chains: RX:2 TX:2
Noise Floor: -87 dBm
Noise Floor: -89 dBm
PHY errors since last reading/reset: 1234
Node aa:bb:cc:dd:ee:01 - FROM 31 : TO 28 : STP 04
Node aa:bb:cc:dd:ee:03 - FROM 12 : TO 14 : STP 04
"""


def status(**kw) -> WirelessStatus:
    st = WirelessStatus(host="10.0.0.1", **kw)
    return st


def test_best_rssi_uses_the_strongest_margin_over_the_floor():
    st = status(noise_floor=[-87, -89, 0], neighbors=[
        MeshNeighbor(mac="aa:bb:cc:dd:ee:01", rx_margin=31, tx_margin=28),
        MeshNeighbor(mac="aa:bb:cc:dd:ee:03", rx_margin=12, tx_margin=14),
    ])
    assert st.active_noise_floor == -87
    assert st.best_margin == 31
    assert st.best_rssi == -56


def test_no_peer_table_means_no_signal_figure():
    """A speaker joined to ordinary WiFi reports a floor but no neighbors."""
    st = status(noise_floor=[-92, 0, 0])
    assert st.on_sonosnet is False
    assert st.best_margin is None
    assert st.best_rssi is None


def test_no_floor_means_no_signal_figure():
    st = status(neighbors=[MeshNeighbor(mac="aa:bb:cc:dd:ee:01", rx_margin=20, tx_margin=20)])
    assert st.best_rssi is None


def test_parsed_status_carries_the_neighbors_through():
    st = parse_wireless_status("10.0.0.1", SONOSNET)
    assert st.on_sonosnet is True
    assert len(st.neighbors) == 2
    assert st.best_margin == 31
    assert st.best_rssi == st.active_noise_floor + 31
