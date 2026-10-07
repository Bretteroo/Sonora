"""Wireless and network diagnostics scraped from a speaker's support pages.

Every ZonePlayer serves a set of unauthenticated diagnostic pages on port 1400
that the official apps use for their "submit diagnostics" feature. The useful
one for troubleshooting playback dropouts is
``/status/proc/ath_rincon/status``, which reports the radio's operating channel,
per-chain noise floor, accumulated PHY errors, and on SonosNet a table of every
peer the unit can hear with signal margins in both directions.

Interpreting the numbers
------------------------
The ``FROM`` and ``TO`` columns are not RSSI. They are signal-to-noise margins
in dB: how far above the noise floor the link sits. Combining a margin with the
reported noise floor recovers an approximate RSSI. The two directions differ
because transmit power and antenna placement are not symmetric, and an
asymmetric pair is itself a useful signal, since a link that is strong one way
and weak the other tends to produce stuttering rather than a clean dropout.

A SonosNet mesh only forms when at least one unit is wired to the network. Units
joined to ordinary WiFi report a channel and noise floor but no peer table,
which is why the Arc Ultra returns a much shorter document than a Play:1.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from defusedxml import ElementTree as DET

#: Margins in dB. Sonos' own support guidance treats the high twenties as the
#: point where a link stops being comfortable.
MARGIN_GOOD = 30
MARGIN_FAIR = 20
MARGIN_POOR = 12


def rate_margin(db: int) -> str:
    if db >= MARGIN_GOOD:
        return "good"
    if db >= MARGIN_FAIR:
        return "fair"
    if db >= MARGIN_POOR:
        return "poor"
    return "critical"


@dataclass(slots=True)
class MeshNeighbor:
    """One peer a speaker can hear on SonosNet."""

    mac: str
    #: Margin in dB for traffic arriving from the peer.
    rx_margin: int
    #: Margin in dB for traffic sent to the peer.
    tx_margin: int
    #: Spanning-tree port state as a raw hex string, e.g. ``04``.
    stp: str = ""
    model: str = ""
    key: str = ""

    @property
    def worst_margin(self) -> int:
        return min(self.rx_margin, self.tx_margin)

    @property
    def asymmetry(self) -> int:
        return abs(self.rx_margin - self.tx_margin)

    @property
    def quality(self) -> str:
        return rate_margin(self.worst_margin)

    @property
    def device_mac(self) -> str:
        """The peer's device MAC.

        A unit's radio address is its device address plus one, so undoing that
        lets a neighbor be matched to the room it belongs to.
        """
        return _mac_offset(self.mac, -1)


@dataclass(slots=True)
class WirelessStatus:
    """Radio state for one speaker."""

    host: str
    mode: str = ""
    operating_channel: int = 0
    ieee_channel: int = 0
    home_channel: int = 0
    ht_channel: int = 0
    ht_ap_mode: str = ""
    rf_chains_rx: int = 0
    rf_chains_tx: int = 0
    max_streams_rx: int = 0
    max_streams_tx: int = 0
    #: Noise floor in dBm per RF chain. Chains reporting 0 are unpopulated.
    noise_floor: list[int] = field(default_factory=list)
    phy_errors: int = 0
    ani_level: int | None = None
    spur_immunity: int | None = None
    reset_failures: int = 0
    region: str = ""
    neighbors: list[MeshNeighbor] = field(default_factory=list)
    #: Whether the unit's bridge runs spanning tree, from ``brctl showstp
    #: br0``: a SonosNet mesh is a bridge with STP on. None when unread.
    bridge_stp: bool | None = None
    raw: str = ""

    @property
    def active_noise_floor(self) -> int | None:
        """Worst noise floor across populated chains, in dBm."""
        live = [n for n in self.noise_floor if n < 0]
        return max(live) if live else None

    @property
    def on_sonosnet(self) -> bool:
        """Whether the unit is part of a SonosNet mesh.

        Hearing peers is not enough. A speaker on the household's own WiFi
        still lists every Sonos unit it can hear on its channel -- this house's
        S1 speakers do, all in station mode -- and read as a mesh they showed
        links between units that exchange nothing. A mesh is a
        bridge running spanning tree, so where ``showstp`` was read, it
        decides; the peer table alone stands in only when it was not.
        """
        if self.bridge_stp is not None:
            return self.bridge_stp and bool(self.neighbors)
        return bool(self.neighbors)

    @property
    def channel_matches_home(self) -> bool:
        """Whether the radio sits on the channel the household prefers.

        A unit operating away from the household's home channel has usually
        roamed because of interference, which is worth surfacing.
        """
        if not self.home_channel or not self.operating_channel:
            return True
        return self.operating_channel == self.home_channel

    def rssi_for(self, neighbor: MeshNeighbor) -> int | None:
        """Approximate RSSI in dBm for a neighbor's inbound signal."""
        floor = self.active_noise_floor
        if floor is None:
            return None
        return floor + neighbor.rx_margin

    @property
    def best_margin(self) -> int | None:
        """The strongest inbound margin in dB, across every neighbor."""
        if not self.neighbors:
            return None
        return max(n.rx_margin for n in self.neighbors)

    @property
    def best_rssi(self) -> int | None:
        """How well this speaker hears the mesh, in dBm.

        The radio reports margins above its own noise floor rather than a
        signal strength, so the strongest inbound margin plus the floor is the
        nearest thing to the RSSI a phone would show. A speaker on ordinary
        WiFi keeps no peer table and so reports nothing here: that is a real
        absence, not a zero, and the interface says so rather than drawing an
        empty meter.
        """
        floor = self.active_noise_floor
        margin = self.best_margin
        if floor is None or margin is None:
            return None
        return floor + margin


@dataclass(slots=True)
class InterfaceCounters:
    """Packet counters for one network interface."""

    name: str
    mac: str = ""
    address: str = ""
    rx_packets: int = 0
    rx_errors: int = 0
    rx_dropped: int = 0
    tx_packets: int = 0
    tx_errors: int = 0
    tx_dropped: int = 0
    collisions: int = 0
    rx_bytes: int = 0
    tx_bytes: int = 0

    @property
    def rx_drop_rate(self) -> float:
        total = self.rx_packets + self.rx_dropped
        return self.rx_dropped / total if total else 0.0

    @property
    def tx_drop_rate(self) -> float:
        total = self.tx_packets + self.tx_dropped
        return self.tx_dropped / total if total else 0.0


# --- parsing -----------------------------------------------------------------

_NODE_RE = re.compile(
    r"^Node\s+((?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})\s*-\s*"
    r"FROM\s+(-?\d+)\s*:\s*TO\s+(-?\d+)"
    r"(?:\s*:\s*STP\s+(\w+))?"
    r"(?:\s*:\s*MODEL\s+([\d.]+))?"
    r"(?:\s*:\s*KEY\s+(\w+))?",
    re.MULTILINE,
)


def unwrap_support_page(body: str) -> str:
    """Pull the plain text out of a ``ZPSupportInfo`` wrapper.

    The pages are XML documents whose payload is a single text node, so the
    wrapper has to come off before anything can be read out of it.
    """
    stripped = body.strip()
    if not stripped.startswith("<"):
        return body
    try:
        root = DET.fromstring(stripped)
    except Exception:
        return body
    chunks = [(node.text or "") for node in root.iter()
              if node.tag in ("File", "Command") and node.text]
    return "\n".join(chunks) if chunks else (root.text or "")


def parse_wireless_status(host: str, body: str) -> WirelessStatus:
    """Parse ``/status/proc/ath_rincon/status``."""
    text = unwrap_support_page(body)
    status = WirelessStatus(host=host, raw=text)

    if m := re.search(r"^Mode:\s*(.+)$", text, re.MULTILINE):
        status.mode = m.group(1).strip()
    if m := re.search(r"Operating on channel\s+(\d+)", text):
        status.operating_channel = int(m.group(1))
    if m := re.search(r"Home channel is\s+(\d+)", text):
        status.home_channel = int(m.group(1))
    # The first "IEEE channel" line belongs to the operating channel; a second
    # one follows the HT channel and is not the same thing.
    ieee = re.findall(r"IEEE channel:\s*(\d+)", text)
    if ieee:
        status.ieee_channel = int(ieee[0])
    if m := re.search(r"HT Channel is\s+(\d+)", text):
        status.ht_channel = int(m.group(1))
    if m := re.search(r"HT AP mode:\s*(\w+)", text):
        status.ht_ap_mode = m.group(1)
    if m := re.search(r"RF Chains:\s*RX:(\d+)\s*TX:(\d+)", text):
        status.rf_chains_rx, status.rf_chains_tx = int(m.group(1)), int(m.group(2))
    if m := re.search(r"Max Spatial Streams:\s*RX:(\d+)\s*TX:(\d+)", text):
        status.max_streams_rx, status.max_streams_tx = (
            int(m.group(1)), int(m.group(2)))
    status.noise_floor = [
        int(v) for v in re.findall(r"Noise Floor:\s*(-?\d+)\s*dBm", text)
    ]
    if m := re.search(r"PHY errors since last reading/reset:\s*(\d+)", text):
        status.phy_errors = int(m.group(1))
    if m := re.search(r"OFDM ANI level:\s*(\d+)", text):
        status.ani_level = int(m.group(1))
    if m := re.search(r"Spur Immunity Level:\s*(\d+)", text):
        status.spur_immunity = int(m.group(1))
    if m := re.search(r"HAL Reset Failures:\s*cnt:\s*(\d+)", text):
        status.reset_failures = int(m.group(1))
    if m := re.search(r"^Region:\s*(.+)$", text, re.MULTILINE):
        status.region = m.group(1).strip()

    for mac, frm, to, stp, model, key in _NODE_RE.findall(text):
        status.neighbors.append(MeshNeighbor(
            mac=mac.upper(),
            rx_margin=int(frm),
            tx_margin=int(to),
            stp=stp or "",
            model=model or "",
            key=key or "",
        ))
    return status


def parse_enetports(body: str | None) -> bool | None:
    """Whether any of ``/status/enetports``'s ports has a link, or None."""
    if not body:
        return None
    links = re.findall(r"<Link>\s*(\d+)\s*</Link>", body)
    if not links:
        return None
    return any(link != "0" for link in links)


def parse_showstp(body: str | None) -> bool | None:
    """Whether ``brctl showstp br0`` says spanning tree is on, or None."""
    if not body:
        return None
    if re.search(r"STP is disabled", body, re.IGNORECASE):
        return False
    if re.search(r"designated root|port id|forwarding", body, re.IGNORECASE):
        return True
    return None


_IFACE_RE = re.compile(r"^(\S+)\s+Link encap:", re.MULTILINE)


def parse_ifconfig(body: str) -> dict[str, InterfaceCounters]:
    """Parse ``/status/ifconfig`` into per-interface counters."""
    text = unwrap_support_page(body)
    blocks: dict[str, InterfaceCounters] = {}
    starts = [(m.start(), m.group(1)) for m in _IFACE_RE.finditer(text)]
    for index, (start, name) in enumerate(starts):
        end = starts[index + 1][0] if index + 1 < len(starts) else len(text)
        block = text[start:end]
        iface = InterfaceCounters(name=name)
        if m := re.search(r"HWaddr\s+((?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})", block):
            iface.mac = m.group(1).upper()
        if m := re.search(r"inet addr:(\S+)", block):
            iface.address = m.group(1)
        if m := re.search(r"RX packets:(\d+) errors:(\d+) dropped:(\d+)", block):
            iface.rx_packets, iface.rx_errors, iface.rx_dropped = map(
                int, m.groups())
        if m := re.search(r"TX packets:(\d+) errors:(\d+) dropped:(\d+)", block):
            iface.tx_packets, iface.tx_errors, iface.tx_dropped = map(
                int, m.groups())
        if m := re.search(r"collisions:(\d+)", block):
            iface.collisions = int(m.group(1))
        if m := re.search(r"RX bytes:(\d+)", block):
            iface.rx_bytes = int(m.group(1))
        if m := re.search(r"TX bytes:(\d+)", block):
            iface.tx_bytes = int(m.group(1))
        blocks[name] = iface
    return blocks


def _mac_offset(mac: str, delta: int) -> str:
    """Shift the last octet of a MAC address."""
    parts = mac.split(":")
    if len(parts) != 6:
        return mac
    try:
        last = (int(parts[5], 16) + delta) & 0xFF
    except ValueError:
        return mac
    return ":".join(parts[:5] + [f"{last:02X}"]).upper()


def mac_from_uuid(uuid: str) -> str:
    """Recover a device MAC from a ``RINCON_<mac><port>`` UUID."""
    body = uuid.removeprefix("RINCON_")
    if len(body) < 12:
        return ""
    hexpart = body[:12]
    return ":".join(hexpart[i:i + 2] for i in range(0, 12, 2)).upper()
