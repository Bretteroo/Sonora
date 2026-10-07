"""Why a music-library share would not mount.

A player takes a share by mounting it itself: ContentDirectory#CreateObject
answers with a container whatever happens, and a share it cannot mount is
dropped a moment later rather than listed. That leaves the controller with a
share that vanished and nothing to tell the person who added it.

So when one vanishes, ask the file server the same questions the player just
asked it, from here: does anything answer on the SMB ports, which dialects
does it speak, and does it let a client in with no credentials at all. The
answers separate the causes that look identical from the player's side -- a
server that refuses anonymous logins, a server that speaks only SMB2 to an S1
household that has only SMBv1, a host that is not there, a path that is wrong.

Only anonymous logins are ever attempted here. The credentials someone types
for a share go to the player and nowhere else.
"""

from __future__ import annotations

import asyncio
import logging
import struct
import uuid

log = logging.getLogger(__name__)

SMB_PORTS = (445, 139)
# 3.1.1 is deliberately not offered: it requires negotiate contexts
# (preauth integrity), and a server that enforces that answers a bare offer
# with INVALID_PARAMETER, which would read here as "speaks no SMB2 at all".
_DIALECTS = (0x0202, 0x0210, 0x0300, 0x0302)
DIALECT_NAMES = {0x0202: "SMB 2.0.2", 0x0210: "SMB 2.1", 0x0300: "SMB 3.0",
                 0x0302: "SMB 3.0.2", 0x0311: "SMB 3.1.1"}
_MORE_PROCESSING = 0xC0000016


def share_host(path: str) -> str:
    """The host out of ``//host/share/folder``, ``\\\\host\\share`` or an x-file-cifs URI."""
    p = path.strip().replace("\\", "/")
    for prefix in ("x-file-cifs://", "smb://", "cifs://"):
        if p.lower().startswith(prefix):
            p = p[len(prefix):]
    p = p.lstrip("/")
    host = p.split("/", 1)[0]
    # credentials may ride in the authority; the host is what follows them
    if "@" in host:
        host = host.rsplit("@", 1)[1]
    return host


class _Smb:
    """One connection, enough of SMB to negotiate and try an anonymous login."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self._r, self._w = reader, writer
        self._mid = 0
        self._session = 0

    async def _exchange(self, payload: bytes) -> bytes:
        self._w.write(struct.pack(">I", len(payload)) + payload)
        await self._w.drain()
        head = await self._r.readexactly(4)
        return await self._r.readexactly(struct.unpack(">I", head)[0])

    async def smb1_negotiate(self, dialects: tuple[str, ...]) -> int | None:
        """The dialect index an SMB1 negotiate is answered with, or None when the
        server answers in SMB2 (which means SMB1 is off) or not at all."""
        data = b"".join(b"\x02" + d.encode() + b"\x00" for d in dialects)
        header = (b"\xffSMB" + b"\x72" + b"\x00" * 4 + b"\x18" + struct.pack("<H", 0xC853)
                  + b"\x00" * 2 + b"\x00" * 8 + b"\x00" * 2
                  + struct.pack("<HHHH", 0, 0xFEFF, 0, 1))
        reply = await self._exchange(header + b"\x00" + struct.pack("<H", len(data)) + data)
        if reply[:4] != b"\xffSMB":
            return None
        # A refusal is a negotiate response carrying dialect index -1.
        index = struct.unpack("<h", reply[37:39])[0] if len(reply) > 39 else -1
        return index

    def _header(self, command: int) -> bytes:
        head = (b"\xfeSMB" + struct.pack("<HHIHHIIQIIQ", 64, 0, 0, command, 1, 0, 0,
                                         self._mid, 0, 0, self._session) + b"\x00" * 16)
        self._mid += 1
        return head

    async def smb2_negotiate(self) -> int | None:
        """The dialect the server picks, or None when it does not speak SMB2."""
        body = (struct.pack("<HHHH", 36, len(_DIALECTS), 1, 0) + struct.pack("<I", 0)
                + uuid.uuid4().bytes + struct.pack("<Q", 0)
                + b"".join(struct.pack("<H", d) for d in _DIALECTS))
        reply = await self._exchange(self._header(0) + body)
        if reply[:4] != b"\xfeSMB" or struct.unpack("<I", reply[8:12])[0] != 0:
            return None
        return struct.unpack("<H", reply[68:70])[0]

    async def anonymous_login(self) -> bool:
        """Whether the server admits a client that offers no credentials."""
        token = (b"NTLMSSP\x00" + struct.pack("<I", 1) + struct.pack("<I", 0x00088207)
                 + struct.pack("<HHI", 0, 0, 32) + struct.pack("<HHI", 0, 0, 32))
        reply = await self._exchange(self._header(1) + _session_setup(token))
        status = struct.unpack("<I", reply[8:12])[0]
        self._session = struct.unpack("<Q", reply[40:48])[0] or self._session
        if status not in (0, _MORE_PROCESSING):
            return False
        offset, length = struct.unpack("<HH", reply[68:72])
        challenge = reply[offset:offset + length]
        mark = challenge.find(b"NTLMSSP\x00")
        flags = (struct.unpack("<I", challenge[mark + 20:mark + 24])[0]
                 if mark >= 0 and len(challenge) >= mark + 24 else 0x00088207)
        reply = await self._exchange(self._header(1) + _session_setup(_anonymous_auth(flags)))
        return struct.unpack("<I", reply[8:12])[0] == 0

    def close(self) -> None:
        try:
            self._w.close()
        except Exception:  # pragma: no cover - a closed transport is fine
            pass


def _session_setup(token: bytes) -> bytes:
    return struct.pack("<HBBIIHHQ", 25, 0, 1, 0, 0, 88, len(token), 0) + token


def _anonymous_auth(flags: int) -> bytes:
    """An NTLM type 3 message with no user, no domain and no responses."""
    lm = b"\x00"
    offset = 64
    fields = b""
    for part in (lm, b"", b"", b"", b"", b""):
        fields += struct.pack("<HHI", len(part), len(part), offset)
        offset += len(part)
    anonymous = (flags | 0x00000800) & ~0x00000010
    return b"NTLMSSP\x00" + struct.pack("<I", 3) + fields + struct.pack("<I", anonymous) + lm


async def probe(host: str, *, timeout: float = 4.0) -> dict:
    """What the file server at ``host`` will and will not do.

    ``{"host", "port": the port that answered or None, "smb1": bool | None,
    "smb2": dialect name or "", "anonymous": bool | None}``. A None means the
    question could not be put, not that the answer is no.
    """
    facts: dict = {"host": host, "port": None, "smb1": None, "smb2": "", "anonymous": None}
    if not host:
        return facts
    for port in SMB_PORTS:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=timeout)
        except (OSError, asyncio.TimeoutError):
            continue
        facts["port"] = port
        conn = _Smb(reader, writer)
        try:
            index = await asyncio.wait_for(
                conn.smb1_negotiate(("PC NETWORK PROGRAM 1.0", "LANMAN1.0", "NT LM 0.12")),
                timeout=timeout)
            facts["smb1"] = index is not None and index >= 0
        except (OSError, asyncio.TimeoutError, asyncio.IncompleteReadError, struct.error):
            # A server with SMB1 off may answer an SMB1 negotiate by hanging up.
            facts["smb1"] = False
        finally:
            conn.close()
        # SMB2 wants a connection of its own: the SMB1 exchange above may have
        # left this one unusable.
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=timeout)
        except (OSError, asyncio.TimeoutError):
            return facts
        conn = _Smb(reader, writer)
        try:
            dialect = await asyncio.wait_for(conn.smb2_negotiate(), timeout=timeout)
            if dialect:
                facts["smb2"] = DIALECT_NAMES.get(dialect, f"0x{dialect:04x}")
                facts["anonymous"] = await asyncio.wait_for(conn.anonymous_login(),
                                                            timeout=timeout)
        except (OSError, asyncio.TimeoutError, asyncio.IncompleteReadError, struct.error):
            pass
        finally:
            conn.close()
        return facts
    return facts


def explain(path: str, facts: dict, *, generation: str = "", credentials: bool = False) -> str:
    """Why the share did not mount, in one sentence a person can act on."""
    shown = path.strip()
    host = facts.get("host") or share_host(path)
    if not facts.get("port"):
        return (f"Nothing answered at {host} on the file-sharing ports (445 and 139). "
                f"Check that the server is on and that {shown} names the right host.")
    if generation == "S1" and facts.get("smb1") is False:
        return (f"{host} no longer speaks SMBv1, and S1 players can only use SMBv1 -- "
                "they have too little memory for anything newer. Either enable SMBv1 on "
                f"the server ({facts.get('smb2') or 'SMB2'} is all it offers now) or add "
                "this folder to an S2 system instead.")
    if facts.get("anonymous") is False and not credentials:
        return (f"{host} refuses connections that carry no credentials, and this share was "
                "added without a username and password. Add it again with an account that "
                "can read the folder.")
    if credentials:
        # Sonora seals the login the way the apps do now (see
        # sonos/credentials.py), so a refusal here is about the account or the
        # folder rather than about the shape of the request. It still will not
        # guess which: the players answer `1,<path>` whatever went wrong.
        return (f"{host} answered ({facts.get('smb2') or 'SMB1'}) but the players could not "
                f"mount {shown}. Check that this account can read that exact folder from "
                "another machine, and that the password is the one the server wants.")
    return (f"{host} answered ({facts.get('smb2') or 'SMB1'}) but the player could not mount "
            f"{shown}. Check that the share name and path are as the server exports them, "
            "and add a username and password if the share needs them.")
