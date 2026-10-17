"""Finding speakers by DNS-SD, asked of the system's DNS server.

Speakers announce ``_sonos._tcp`` over mDNS, which is multicast like SSDP, so
on most networks it adds nothing. It matters where no multicast reaches Sonora
at all but its DNS server can still see the LAN: a container behind a VM's
NAT, as Docker Desktop runs them on a Mac, sends DNS to a server that answers
``.local`` names from the Mac's own mDNS. A PTR question for the service there
lists the speakers, and their names resolve to LAN addresses. One speaker is
enough; its topology names the rest.

Plain unicast DNS, stdlib only: one question per packet, answers read back
with name compression.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import socket
import struct
from pathlib import Path

log = logging.getLogger(__name__)

SERVICE = "_sonos._tcp.local"
A, PTR, SRV = 1, 12, 33

#: Enough instances to be sure of one speaker that answers HTTP, without
#: asking after every player in a large house.
MAX_INSTANCES = 6


def nameservers(path: Path = Path("/etc/resolv.conf")) -> list[str]:
    """The IPv4 DNS servers the system is set to ask, in order."""
    try:
        lines = path.read_text().splitlines()
    except OSError:
        return []
    servers = []
    for line in lines:
        parts = line.split()
        if len(parts) >= 2 and parts[0] == "nameserver":
            try:
                socket.inet_aton(parts[1])
            except OSError:
                continue
            servers.append(parts[1])
    return servers


def encode_name(name: str) -> bytes:
    out = b""
    for label in name.rstrip(".").split("."):
        raw = label.encode()
        out += bytes([len(raw)]) + raw
    return out + b"\0"


def build_query(qid: int, name: str, qtype: int) -> bytes:
    # Recursion desired: the server is a forwarder, not the authority.
    return struct.pack(">6H", qid, 0x0100, 1, 0, 0, 0) + encode_name(name) + struct.pack(">HH", qtype, 1)


def _read_name(buf: bytes, off: int) -> tuple[str, int]:
    labels: list[str] = []
    end = None
    for _ in range(128):  # a compression loop must not hang the reader
        length = buf[off]
        if length == 0:
            off += 1
            break
        if length & 0xC0 == 0xC0:
            if end is None:
                end = off + 2
            off = ((length & 0x3F) << 8) | buf[off + 1]
            continue
        labels.append(buf[off + 1:off + 1 + length].decode(errors="replace"))
        off += 1 + length
    else:
        raise ValueError("name compression loop")
    return ".".join(labels), (end if end is not None else off)


def parse_response(buf: bytes) -> tuple[int, list[tuple[str, int, object]]]:
    """A response's id and every record in it, as (name, type, value).

    PTR and SRV values are the names they point to (SRV as (target, port)),
    A values are dotted addresses; other types are dropped.
    """
    qid, _flags, qd, an, ns, ar = struct.unpack(">6H", buf[:12])
    off = 12
    for _ in range(qd):
        _, off = _read_name(buf, off)
        off += 4
    records: list[tuple[str, int, object]] = []
    for _ in range(an + ns + ar):
        name, off = _read_name(buf, off)
        rtype, _cls, _ttl, length = struct.unpack(">HHIH", buf[off:off + 10])
        off += 10
        data = buf[off:off + length]
        if rtype == A and length == 4:
            records.append((name, A, socket.inet_ntoa(data)))
        elif rtype == PTR:
            records.append((name, PTR, _read_name(buf, off)[0]))
        elif rtype == SRV and length >= 7:
            port = struct.unpack(">H", data[4:6])[0]
            records.append((name, SRV, (_read_name(buf, off + 6)[0], port)))
        off += length
    return qid, records


class _Answer(asyncio.DatagramProtocol):
    def __init__(self, qid: int) -> None:
        self.qid = qid
        self.done: asyncio.Future = asyncio.get_running_loop().create_future()

    def datagram_received(self, data: bytes, addr) -> None:
        try:
            qid, records = parse_response(data)
        except Exception:
            return
        if qid == self.qid and not self.done.done():
            self.done.set_result(records)


async def query(server: str, name: str, qtype: int, *, timeout: float = 2.0,
                port: int = 53) -> list[tuple[str, int, object]]:
    """Ask ``server`` one question; no answer in time is no records."""
    loop = asyncio.get_running_loop()
    qid = secrets.randbelow(0x10000)
    transport, protocol = await loop.create_datagram_endpoint(
        lambda: _Answer(qid), remote_addr=(server, port), family=socket.AF_INET)
    try:
        transport.sendto(build_query(qid, name, qtype))
        return await asyncio.wait_for(protocol.done, timeout)
    except (asyncio.TimeoutError, OSError):
        return []
    finally:
        transport.close()


async def sonos_hosts(servers: list[str] | None = None, *, port: int = 53,
                      timeout: float = 2.0) -> list[str]:
    """Speaker addresses the DNS server knows by DNS-SD, or none."""
    for server in (nameservers() if servers is None else servers):
        records = await query(server, SERVICE, PTR, timeout=timeout, port=port)
        instances = [value for name, rtype, value in records
                     if rtype == PTR and name.lower() == SERVICE][:MAX_INSTANCES]
        if not instances:
            continue
        hosts: list[str] = []
        for instance in instances:
            # A server may hand the target and address over with the
            # pointer; when it does not, they are asked for in turn.
            targets = [v[0] for n, t, v in records if t == SRV and n == instance]
            if not targets:
                targets = [v[0] for n, t, v in await query(server, instance, SRV, timeout=timeout, port=port)
                           if t == SRV]
            # Most speakers name the instance after their host name
            # (Sonos-<MAC>), so a server that will not answer SRV still
            # leaves an address to ask for.
            label = instance.split(".", 1)[0]
            if not targets and label.startswith("Sonos-"):
                targets = [f"{label}.local"]
            for target in targets[:1]:
                addresses = [v for n, t, v in records if t == A and n.lower() == target.lower()]
                if not addresses:
                    addresses = [v for n, t, v in await query(server, target, A, timeout=timeout, port=port)
                                 if t == A]
                hosts.extend(a for a in addresses if a not in hosts)
        if hosts:
            log.info("DNS-SD via %s named %d speaker(s)", server, len(hosts))
            return hosts
    return []
