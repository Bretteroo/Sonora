"""Error and drop rates, the readings every speaker gives, peers or none.

An S2 system of three spread-out rooms has no signal figure to show (no peers
to measure against, or no noise floor), but every speaker counts PHY errors on
its radio and dropped or failed packets on its interfaces (2026-10-02).
"""

import asyncio

from backend.sonos import network
from backend.sonos.diagnostics import InterfaceCounters
from backend.sonos.network import NetworkCollector, NetworkSnapshot, ZoneRadio
from backend.sonos.diagnostics import WirelessStatus

RADIO = "Mode: INFRA (station)\nPHY errors since last reading/reset: {phy}\n"
IFCONFIG = ("apcli0    Link encap:Ethernet  HWaddr 38:42:0B:F8:BF:92\n"
            "          RX packets:1000 errors:0 dropped:{drop} overruns:0 frame:0\n"
            "          TX packets:500 errors:1 dropped:0 overruns:0 carrier:0\n"
            "br0       Link encap:Ethernet  HWaddr 38:42:0B:F8:BF:92\n"
            "          RX packets:1000 errors:0 dropped:9000 overruns:0 frame:0\n"
            "          TX packets:500 errors:0 dropped:0 overruns:0 carrier:0\n"
            "lo        Link encap:Local Loopback\n"
            "          RX packets:9 errors:0 dropped:50 overruns:0 frame:0\n"
            "          TX packets:9 errors:0 dropped:0 overruns:0 carrier:0\n")


def test_rates_are_per_minute_over_the_check(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(network, "monotonic", lambda: clock[0])

    async def no_sleep(seconds):
        clock[0] += seconds

    monkeypatch.setattr(network.asyncio, "sleep", no_sleep)
    collector = NetworkCollector(session=None)  # type: ignore[arg-type]

    async def fetch(host, path):
        return RADIO.replace("{phy}", "30") if "ath_rincon" in path else IFCONFIG.replace("{drop}", "12")

    collector._fetch = fetch
    radio = ZoneRadio(zone_uuid="Z", zone_name="Blue Room", host="h", model="Sonos Beam",
                      wireless=WirelessStatus(host="h"), read_at=100.0,
                      interfaces={"apcli0": InterfaceCounters(name="apcli0", rx_packets=900, rx_dropped=10, tx_errors=1),
                                  "br0": InterfaceCounters(name="br0", rx_packets=900, rx_dropped=8000),
                                  "lo": InterfaceCounters(name="lo", rx_dropped=50)})
    snapshot = NetworkSnapshot(household_id="HH")
    snapshot.radios["P"] = radio
    clock[0] = 112.0   # the probes took 12 seconds
    asyncio.run(collector._rates(snapshot))
    # 30 PHY errors and 2 more drops on the radio in 12 seconds; the bridge's
    # 1000 and loopback's are not the link's
    assert radio.phy_errors_per_min == 150.0
    assert radio.drops_per_min == 10.0


def test_a_speaker_listing_no_radio_interface_has_no_drop_rate():
    only_bridge = {"br0": InterfaceCounters(name="br0", rx_packets=5, rx_dropped=9),
                   "eth0": InterfaceCounters(name="eth0"),
                   "lo": InterfaceCounters(name="lo", rx_packets=3)}
    assert NetworkCollector._drop_total(only_bridge) is None
