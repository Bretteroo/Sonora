"""A portable speaker's battery, read from its own support page."""

from __future__ import annotations

from backend.sonos.battery import lowest, parse_battery

ROAM2 = """<?xml version="1.0" ?>
<?xml-stylesheet type="text/xsl" href="/xml/review.xsl"?><ZPSupportInfo><LocalBatteryStatus>
<Data name="Health">GREEN</Data>
<Data name="Level">100</Data>
<Data name="Temperature">NORMAL</Data>
<Data name="PowerSource">BATTERY</Data>
</LocalBatteryStatus><!-- SDT: 0 ms --></ZPSupportInfo>"""

NONE = """<?xml version="1.0" ?>
<?xml-stylesheet type="text/xsl" href="/xml/review.xsl"?><ZPSupportInfo></ZPSupportInfo>"""


def test_a_roam_on_battery_as_measured():
    assert parse_battery(ROAM2) == {"level": 100, "charging": False, "power_source": "BATTERY",
                                    "health": "GREEN", "temperature": "NORMAL"}


def test_any_other_power_source_is_charging():
    for source in ("SONOS_CHARGING_RING", "USB_POWER"):
        assert parse_battery(ROAM2.replace("BATTERY", source))["charging"] is True


def test_a_speaker_without_a_battery_has_none():
    assert parse_battery(NONE) is None
    assert parse_battery("not xml") is None


def test_a_room_shows_its_lowest_battery():
    a = parse_battery(ROAM2)
    b = parse_battery(ROAM2.replace(">100<", ">15<"))
    assert lowest([a, None, b])["level"] == 15
    assert lowest([None]) is None
