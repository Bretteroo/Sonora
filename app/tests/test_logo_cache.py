"""Service logos come from the public manifest and live on disk.

They used to come from the signed-in endpoint and be held in memory, so a
sign-out emptied them and every logo in the interface broke. The desktop
client never did that: its RMSLogoMgr reads one public manifest, writes the
pictures into a logocache directory, and refetches one only when the
manifest's lastModified for it changes. Sonora now does the same.
"""

import asyncio
import pathlib

from backend.sonos import logos


MANIFEST = """<?xml version="1.0"?>
<images><sized>
<service id="48135">
  <image lastModified="17:51:6 13 Nov 2024" placement="square:small">https://x.invalid/a-40.png</image>
  <image lastModified="17:51:6 13 Nov 2024" placement="square:medium">https://x.invalid/a-80.png</image>
</service>
</sized>
<presentationmap>
<service id="48135">
  <image lastModified="1 Jan 2020" placement="BrandLogo-v2">https://x.invalid/brand.png</image>
</service>
</presentationmap>
</images>"""


class _Session:
    """Answers the manifest and the pictures, and counts what was asked for."""

    def __init__(self, manifest=MANIFEST):
        self.manifest = manifest
        self.asked: list[str] = []

    def get(self, url, **kw):
        self.asked.append(url)
        body = self.manifest if "mslogo" in url else "PNGDATA"
        return _Answer(body)


class _Answer:
    def __init__(self, body):
        self._body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    status = 200

    def raise_for_status(self):
        return None

    async def text(self):
        return self._body

    async def read(self):
        return self._body.encode()


def _cache(tmp_path, session):
    return logos.LogoCache(session, pathlib.Path(tmp_path))


def test_a_logo_is_fetched_once_and_then_read_from_disk(tmp_path):
    session = _Session()
    cache = _cache(tmp_path, session)
    first = asyncio.run(cache.logo(48135, 80))
    assert first is not None and first[0] == b"PNGDATA"
    pictures = [u for u in session.asked if "mslogo" not in u]
    assert pictures == ["https://x.invalid/a-80.png"]
    # The second ask touches the network for nothing at all.
    assert asyncio.run(cache.logo(48135, 80)) == first
    assert [u for u in session.asked if "mslogo" not in u] == pictures


def test_the_picture_survives_with_no_manifest_and_no_network(tmp_path):
    asyncio.run(_cache(tmp_path, _Session()).logo(48135, 80))

    class _Dead(_Session):
        def get(self, url, **kw):
            raise OSError("no network")

    cold = _cache(tmp_path, _Dead())
    assert asyncio.run(cold.logo(48135, 80))[0] == b"PNGDATA"


def test_a_changed_lastModified_is_what_refetches(tmp_path):
    asyncio.run(_cache(tmp_path, _Session()).logo(48135, 80))
    moved = _Session(MANIFEST.replace("17:51:6 13 Nov 2024", "09:00:0 1 Feb 2026"))
    asyncio.run(_cache(tmp_path, moved).logo(48135, 80))
    assert [u for u in moved.asked if "mslogo" not in u] == ["https://x.invalid/a-80.png"]


def test_both_blocks_of_a_repeated_service_are_kept(tmp_path):
    # A service is named twice, once per section. Replacing rather than
    # merging lost the square icons and left the service with no logo at all.
    cache = _cache(tmp_path, _Session())
    asyncio.run(cache.prime())
    assert set(cache._index[48135]) == {"square:small", "square:medium", "BrandLogo-v2"}


def test_the_browse_sid_finds_the_service_type(tmp_path):
    cache = _cache(tmp_path, _Session())
    asyncio.run(cache.prime())
    assert cache.type_for_sid(48135 >> 8) == 48135


def test_a_file_name_is_safe_on_any_filesystem(tmp_path):
    assert ":" not in logos._file_name(48135, "square:medium")


def test_a_restart_with_no_network_still_matches_services_to_logos(tmp_path):
    # The index was only ever held in memory, and nothing read it before a
    # logo was asked for by type, so every service fell back to the cloud's
    # picture. Kept on disk, it answers the next start even offline.
    asyncio.run(_cache(tmp_path, _Session()).prime())

    class _Dead(_Session):
        def get(self, url, **kw):
            raise OSError("no network")

    cold = _cache(tmp_path, _Dead())
    asyncio.run(cold.prime())
    assert cold.type_for_sid(48135 >> 8) == 48135


def test_an_unreadable_manifest_is_not_asked_for_on_every_call(tmp_path):
    class _Dead(_Session):
        def get(self, url, **kw):
            self.asked.append(url)
            raise OSError("no network")

    session = _Dead()
    cache = _cache(tmp_path, session)
    asyncio.run(cache.prime())
    asyncio.run(cache.prime())
    assert session.asked == [logos.MANIFEST]
