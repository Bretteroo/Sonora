"""DNS-SD discovery through the system's DNS server, against a stand-in server."""

import asyncio
import socket
import struct

from backend.sonos import dnssd
from backend.sonos.dnssd import A, PTR, SRV, SERVICE


def _rr(name: str, rtype: int, data: bytes) -> bytes:
    return dnssd.encode_name(name) + struct.pack(">HHIH", rtype, 1, 120, len(data)) + data


def _response(qid: int, question: bytes, records: list[bytes]) -> bytes:
    return struct.pack(">6H", qid, 0x8180, 1, len(records), 0, 0) + question + b"".join(records)


class _Server(asyncio.DatagramProtocol):
    """Answers from a table of (name, type) -> records; anything else, nothing."""

    def __init__(self, table):
        self.table = table
        self.asked: list[tuple[str, int]] = []

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        qid = struct.unpack(">H", data[:2])[0]
        name, off = dnssd._read_name(data, 12)
        qtype = struct.unpack(">H", data[off:off + 2])[0]
        self.asked.append((name, qtype))
        records = self.table.get((name.lower(), qtype))
        if records is not None:
            self.transport.sendto(_response(qid, data[12:off + 4], records), addr)


async def _serve(table):
    loop = asyncio.get_running_loop()
    transport, server = await loop.create_datagram_endpoint(
        lambda: _Server(table), local_addr=("127.0.0.1", 0), family=socket.AF_INET)
    return transport, server, transport.get_extra_info("sockname")[1]


def _ptr(instance: str) -> bytes:
    return _rr(SERVICE, PTR, dnssd.encode_name(instance))


def _a(name: str, ip: str) -> bytes:
    return _rr(name, A, socket.inet_aton(ip))


async def test_pointer_then_address_as_docker_desktop_answers():
    # Docker Desktop's server answered the PTR question with bare pointers.
    table = {
        (SERVICE, PTR): [_ptr("Sonos-949F3EB8069A._sonos._tcp.local")],
        ("sonos-949f3eb8069a.local", A): [_a("Sonos-949F3EB8069A.local", "192.168.1.138")],
    }
    transport, server, port = await _serve(table)
    try:
        hosts = await dnssd.sonos_hosts(["127.0.0.1"], port=port, timeout=0.5)
    finally:
        transport.close()
    assert hosts == ["192.168.1.138"]


async def test_instance_named_for_its_room_goes_through_srv():
    instance = "RINCON_38420BF8BF9201400@Pink Room._sonos._tcp.local"
    srv = struct.pack(">HHH", 0, 0, 1443) + dnssd.encode_name("Sonos-38420BF8BF92.local")
    table = {
        (SERVICE, PTR): [_ptr(instance)],
        (instance.lower(), SRV): [_rr(instance, SRV, srv)],
        ("sonos-38420bf8bf92.local", A): [_a("Sonos-38420BF8BF92.local", "192.168.1.40")],
    }
    transport, server, port = await _serve(table)
    try:
        hosts = await dnssd.sonos_hosts(["127.0.0.1"], port=port, timeout=0.5)
    finally:
        transport.close()
    assert hosts == ["192.168.1.40"]


async def test_no_answer_is_no_speakers():
    transport, server, port = await _serve({})
    try:
        hosts = await dnssd.sonos_hosts(["127.0.0.1"], port=port, timeout=0.3)
    finally:
        transport.close()
    assert hosts == []
    assert server.asked == [(SERVICE, PTR)]


def test_compressed_names_are_followed():
    question = dnssd.encode_name(SERVICE) + struct.pack(">HH", PTR, 1)
    # The answer's name points back at the question (offset 12).
    answer = b"\xc0\x0c" + struct.pack(">HHIH", PTR, 1, 10, 0)
    target = dnssd.encode_name("Sonos-1._sonos._tcp.local")
    answer = answer[:-2] + struct.pack(">H", len(target)) + target
    buf = struct.pack(">6H", 7, 0x8180, 1, 1, 0, 0) + question + answer
    qid, records = dnssd.parse_response(buf)
    assert qid == 7
    assert records == [(SERVICE, PTR, "Sonos-1._sonos._tcp.local")]


def test_nameservers_skip_ipv6_and_comments(tmp_path):
    conf = tmp_path / "resolv.conf"
    conf.write_text("# generated\nnameserver 192.168.65.7\nnameserver fe80::1\nsearch lan\n")
    assert dnssd.nameservers(conf) == ["192.168.65.7"]
    assert dnssd.nameservers(tmp_path / "missing") == []


async def test_the_sweep_finds_players_beside_the_one_named(monkeypatch):
    # The households DNS-SD left out are found by asking the named speaker's
    # network. Every 127.0.0.x reaches a server on all interfaces, so each
    # answers; only a Sonos description counts.
    import aiohttp
    from aiohttp import web
    from backend.sonos import discovery

    async def describe(request):
        return web.Response(
            text="<root><device><manufacturer>Sonos, Inc.</manufacturer></device></root>"
            if request.host.startswith("127.0.0.7:") else "<root/>")

    app = web.Application()
    app.router.add_get("/xml/device_description.xml", describe)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 0)
    await site.start()
    monkeypatch.setattr(discovery, "SONOS_PORT", site._server.sockets[0].getsockname()[1])
    try:
        async with aiohttp.ClientSession() as session:
            hosts = await discovery.sweep_for_players(session, ["127.0.0.40"])
    finally:
        await runner.cleanup()
    assert hosts == ["127.0.0.7"]
