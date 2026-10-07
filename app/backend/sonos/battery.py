"""A portable speaker's battery, read from the speaker itself.

A Roam, Roam 2 or Move publishes its battery at ``/status/batterystatus`` on
port 1400, the same support page SoCo reads (``get_battery_info``). Measured
on a Roam 2 (S2 18.8) on 2026-10-05::

    <ZPSupportInfo><LocalBatteryStatus>
    <Data name="Health">GREEN</Data>
    <Data name="Level">100</Data>
    <Data name="Temperature">NORMAL</Data>
    <Data name="PowerSource">BATTERY</Data>
    </LocalBatteryStatus></ZPSupportInfo>

A speaker with no battery answers 200 with an empty ``ZPSupportInfo``, which
is how a portable one is told apart without a list of models. Nothing here
goes beyond the LAN.
"""
from __future__ import annotations

from defusedxml import ElementTree

#: PowerSource values that mean the speaker is taking a charge. SoCo lists
#: BATTERY, SONOS_CHARGING_RING and USB_POWER; anything but BATTERY is wall
#: power of some kind, and the apps draw the charging bolt for it.
_ON_BATTERY = "BATTERY"


def parse_battery(text: str) -> dict | None:
    """The battery facts in a ``/status/batterystatus`` answer, or None when
    the player has no battery (or the answer is not one)."""
    try:
        root = ElementTree.fromstring(text)
    except Exception:
        return None
    status = root.find("LocalBatteryStatus")
    if status is None:
        return None
    data = {item.get("name", ""): (item.text or "").strip() for item in status.findall("Data")}
    try:
        level = int(data.get("Level", ""))
    except ValueError:
        return None
    level = max(0, min(100, level))
    source = data.get("PowerSource", "")
    return {
        "level": level,
        "charging": bool(source) and source != _ON_BATTERY,
        "power_source": source,
        "health": data.get("Health", ""),
        "temperature": data.get("Temperature", ""),
    }


def lowest(readings: list[dict]) -> dict | None:
    """The reading a room shows: its lowest battery, as the S1 Windows app's
    room tile does (ZonePlayerViewModel's getLowestBatteryDevice)."""
    found = [r for r in readings if r]
    return min(found, key=lambda r: r["level"]) if found else None
