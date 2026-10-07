"""The share-credential cipher: the published AES vectors, then the shape."""

import base64

from backend.sonos.credentials import (SALT, _encrypt_block, _expand, aes128_cbc,
                                       seal, secret)


def test_the_block_cipher_matches_fips_197():
    # FIPS-197 appendix C.1, the AES-128 known answer.
    key = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
    plain = bytes.fromhex("00112233445566778899aabbccddeeff")
    assert _encrypt_block(_expand(key), plain).hex() == "69c4e0d86a7b0430d8cdb78070b4c55a"


def test_cbc_matches_nist_sp_800_38a():
    # SP 800-38A F.2.1, the first two blocks of CBC-AES128.Encrypt.
    key = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
    iv = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
    plain = bytes.fromhex("6bc1bee22e409f96e93d7e117393172a"
                          "ae2d8a571e03ac9c9eb76fac45af8e51")
    assert aes128_cbc(key, iv, plain).hex() == ("7649abac8119b246cee98e9b12e9197d"
                                                "5086cb9b507219ee95db113a917678b2")


def test_a_short_key_or_iv_is_refused():
    for key, iv in ((b"short", bytes(16)), (bytes(16), b"short")):
        try:
            aes128_cbc(key, iv, bytes(16))
        except ValueError:
            continue
        raise AssertionError("a wrong-sized key or IV should not be accepted")


def test_the_secret_is_the_household_and_the_apps_salt():
    import hashlib
    household = "Sonos_Xq7ExampleHousehold0000Zz0"
    assert secret(household) == hashlib.md5(household.encode() + SALT).digest()
    # A controller with no household hashes the salt on its own.
    assert secret("") == hashlib.md5(SALT).digest()


def test_the_sealed_value_carries_its_iv_in_front():
    sealed = seal("read", "Sonos_x", iv=bytes(range(16)))
    assert sealed.startswith("2:")
    raw = base64.b64decode(sealed[2:])
    assert raw[:16] == bytes(range(16))
    # value + four bytes of digest, padded to the block size: 4 + 4 -> 16.
    assert len(raw) == 16 + 16


def test_it_is_pinned_so_a_change_to_the_cipher_shows_up():
    # Fixed IV, so the answer is deterministic. This is our own output, not a
    # capture of the app's -- the app's goes out over TLS and cannot be read.
    # Only a player accepting a share sealed this way proves it right.
    assert seal("read", "Sonos_x", iv=bytes(range(16))) == (
        "2:AAECAwQFBgcICQoLDA0OD/cby0uxZFblZPniEy8gw40=")


def test_every_call_looks_different():
    first, second = seal("read", "Sonos_x"), seal("read", "Sonos_x")
    assert first != second, "the IV is supposed to be fresh on every call"
