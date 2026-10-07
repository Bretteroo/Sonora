"""The form a player accepts for a share's username and password.

``r:usernameX`` and ``r:passwordX`` in the share DIDL are not base64 of the
plain text, whatever the element names suggest. The X means encrypted, and a
player that is handed anything else throws both fields away and mounts the
share anonymously -- which is why every credentialed add from Sonora used to
end as ``1,<path>`` while the same folder went in from a Sonos app without
complaint. Measured with an SMB server of our own on 2026-09-11: the app's add
made the player log in as ``read``; Sonora's made it log in as ``guest``.

The scheme and its one constant come from Stephan van Rooij's sonos-net
(https://github.com/svrooij/sonos-net, GPL-3.0), which discovered them and
published them first, in April 2026: ``THIRD_PARTY_MEDIA_SERVERS_KEY`` and
``DecryptMediaServers`` in ``src/Sonos.Base/Services/ZoneGroupTopologyService.cs``.
The credit for finding them is that project's alone. As sonos-net lays it
out, plus the four-byte checksum an encrypted value carries:

    S  = MD5(household id, ASCII, no NUL || SALT)
    IV = 16 random bytes
    K  = MD5(IV || S)
    body = value || MD5(value)[:4]
    out  = "2:" + base64(IV || AES-128-CBC(K, IV, PKCS#7(body)))

The IV travels in the clear at the front, so the player can derive K the same
way. Nothing about the output is deterministic and nothing needs to be: two
calls on the same value give different bytes and the player takes both.

``SALT`` is the one constant: sonos-net's ``THIRD_PARTY_MEDIA_SERVERS_KEY``,
which the shipped Sonos apps carry unchanged.

The AES here is written out rather than taken from a library: Sonora's
dependencies are four packages and a share add encrypts two short strings, so
a hundred lines beat making every self-hoster build ``cryptography``. It only
ever encrypts, so there is no inverse in here.
"""

from __future__ import annotations

import base64
import hashlib
import os

#: The constant sonos-net discovered and published (https://github.com/svrooij/sonos-net):
#: its THIRD_PARTY_MEDIA_SERVERS_KEY. All credit for it is sonos-net's.
SALT = bytes.fromhex("1a01a731c96e9ebde8475182b274b70e")

_SBOX = bytes.fromhex(
    "637c777bf26b6fc53001672bfed7ab76"
    "ca82c97dfa5947f0add4a2af9ca472c0"
    "b7fd9326363ff7cc34a5e5f171d83115"
    "04c723c31896059a071280e2eb27b275"
    "09832c1a1b6e5aa0523bd6b329e32f84"
    "53d100ed20fcb15b6acbbe394a4c58cf"
    "d0efaafb434d338545f9027f503c9fa8"
    "51a3408f929d38f5bcb6da2110fff3d2"
    "cd0c13ec5f974417c4a77e3d645d1973"
    "60814fdc222a908846eeb814de5e0bdb"
    "e0323a0a4906245cc2d3ac629195e479"
    "e7c8376d8dd54ea96c56f4ea657aae08"
    "ba78252e1ca6b4c6e8dd741f4bbd8b8a"
    "703eb5664803f60e613557b986c11d9e"
    "e1f8981169d98e949b1e87e9ce5528df"
    "8ca1890dbfe6426841992d0fb054bb16")

_RCON = (0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36)


def _xtime(byte: int) -> int:
    byte <<= 1
    return (byte ^ 0x1B) & 0xFF if byte & 0x100 else byte


def _expand(key: bytes) -> list[list[int]]:
    """AES-128 key schedule: eleven round keys of sixteen bytes."""
    words = [list(key[i * 4:i * 4 + 4]) for i in range(4)]
    for i in range(4, 44):
        word = list(words[i - 1])
        if i % 4 == 0:
            word = word[1:] + word[:1]
            word = [_SBOX[b] for b in word]
            word[0] ^= _RCON[i // 4 - 1]
        words.append([a ^ b for a, b in zip(words[i - 4], word)])
    return [sum(words[r * 4:r * 4 + 4], []) for r in range(11)]


def _encrypt_block(schedule: list[list[int]], block: bytes) -> bytes:
    state = [b ^ k for b, k in zip(block, schedule[0])]
    for rnd in range(1, 11):
        state = [_SBOX[b] for b in state]
        # ShiftRows, on the column-major state AES actually uses.
        state = [state[(i + (i % 4) * 4) % 16] for i in range(16)]
        if rnd != 10:
            mixed = []
            for c in range(4):
                col = state[c * 4:c * 4 + 4]
                total = col[0] ^ col[1] ^ col[2] ^ col[3]
                mixed += [col[i] ^ total ^ _xtime(col[i] ^ col[(i + 1) % 4])
                          for i in range(4)]
            state = mixed
        state = [b ^ k for b, k in zip(state, schedule[rnd])]
    return bytes(state)


#: The inverse of the S-box and of the ShiftRows permutation, both derived
#: from the forward ones above rather than written out again, so there is one
#: table to be wrong about.
_INV_SBOX = bytes(_SBOX.index(i) for i in range(256))
_SHIFT = [(i + (i % 4) * 4) % 16 for i in range(16)]
_INV_SHIFT = [_SHIFT.index(i) for i in range(16)]


def _mul(a: int, b: int) -> int:
    """Multiply in GF(2^8), for InvMixColumns' 9, 11, 13, 14."""
    out = 0
    while b:
        if b & 1:
            out ^= a
        a = _xtime(a)
        b >>= 1
    return out


#: InvMixColumns' four products, looked up rather than worked out: the
#: bit-by-bit multiply above, called 16 times a column, had a household's
#: account list take a quarter of Sonora's CPU at start-up, a dozen speakers
#: each sending their own sealed copy (profiled).
_M9, _M11, _M13, _M14 = (bytes(_mul(a, k) for a in range(256)) for k in (9, 11, 13, 14))


def _decrypt_block(schedule: list[list[int]], block: bytes) -> bytes:
    state = list(block)
    for rnd in range(10, 0, -1):
        state = [b ^ k for b, k in zip(state, schedule[rnd])]
        if rnd != 10:
            unmixed = []
            for c in range(0, 16, 4):
                a0, a1, a2, a3 = state[c], state[c + 1], state[c + 2], state[c + 3]
                unmixed += (_M14[a0] ^ _M11[a1] ^ _M13[a2] ^ _M9[a3],
                            _M14[a1] ^ _M11[a2] ^ _M13[a3] ^ _M9[a0],
                            _M14[a2] ^ _M11[a3] ^ _M13[a0] ^ _M9[a1],
                            _M14[a3] ^ _M11[a0] ^ _M13[a1] ^ _M9[a2])
            state = unmixed
        state = [state[_INV_SHIFT[i]] for i in range(16)]
        state = [_INV_SBOX[b] for b in state]
    return bytes(b ^ k for b, k in zip(state, schedule[0]))


def aes128_cbc(key: bytes, iv: bytes, data: bytes) -> bytes:
    """Encrypt PKCS#7-padded ``data``."""
    if len(key) != 16 or len(iv) != 16:
        raise ValueError("AES-128-CBC wants a 16 byte key and a 16 byte IV")
    schedule = _expand(key)
    out = bytearray()
    previous = iv
    for at in range(0, len(data), 16):
        block = bytes(a ^ b for a, b in zip(data[at:at + 16], previous))
        previous = _encrypt_block(schedule, block)
        out += previous
    return bytes(out)


def aes128_cbc_decrypt(key: bytes, iv: bytes, data: bytes) -> bytes:
    """The inverse of ``aes128_cbc``, padding left on."""
    if len(key) != 16 or len(iv) != 16:
        raise ValueError("AES-128-CBC wants a 16 byte key and a 16 byte IV")
    if not data or len(data) % 16:
        raise ValueError("ciphertext is not a whole number of blocks")
    schedule = _expand(key)
    out = bytearray()
    previous = iv
    for at in range(0, len(data), 16):
        block = data[at:at + 16]
        out += bytes(a ^ b for a, b in zip(_decrypt_block(schedule, block), previous))
        previous = block
    return bytes(out)


def _pad(data: bytes) -> bytes:
    fill = 16 - len(data) % 16
    return data + bytes([fill]) * fill


def secret(household_id: str) -> bytes:
    """The household's standing secret: MD5 of its id and the apps' salt.

    A controller that has not joined a household hashes the salt on its own,
    which is what the apps do with their empty default.
    """
    return hashlib.md5(household_id.encode("utf-8") + SALT).digest()


def seal(value: str, household_id: str, iv: bytes | None = None) -> str:
    """``value`` as ``r:usernameX`` / ``r:passwordX`` want it.

    ``iv`` is only for the tests; live calls take sixteen fresh random bytes,
    as the apps do.
    """
    iv = os.urandom(16) if iv is None else iv
    key = hashlib.md5(iv + secret(household_id)).digest()
    body = value.encode("utf-8")
    body += hashlib.md5(body).digest()[:4]
    return "2:" + base64.b64encode(iv + aes128_cbc(key, iv, _pad(body))).decode("ascii")


def unseal(value: str, household_id: str) -> str:
    """The plain text behind a ``2:`` value, or ``ValueError``.

    The household's own ``ThirdPartyMediaServersX`` is sealed this way, and so
    are the arguments the apps send to the ``X`` actions. The four-byte digest
    on the end is checked: a wrong household gives plausible-looking bytes,
    and the checksum is what tells that apart from a real answer.
    """
    if not value.startswith("2:"):
        raise ValueError("not a sealed value")
    raw = base64.b64decode(value[2:], validate=True)
    if len(raw) < 32:
        raise ValueError("sealed value is too short to hold an IV and a block")
    iv, body = raw[:16], raw[16:]
    key = hashlib.md5(iv + secret(household_id)).digest()
    plain = aes128_cbc_decrypt(key, iv, body)
    fill = plain[-1]
    if not 1 <= fill <= 16 or plain[-fill:] != bytes([fill]) * fill:
        raise ValueError("padding does not open; wrong household?")
    plain = plain[:-fill]
    if len(plain) < 4:
        raise ValueError("nothing left after the checksum")
    plain, tag = plain[:-4], plain[-4:]
    if hashlib.md5(plain).digest()[:4] != tag:
        raise ValueError("checksum does not match; wrong household?")
    return plain.decode("utf-8")
