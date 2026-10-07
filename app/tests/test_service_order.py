"""The order a household's services are listed in.

The web app puts them in the order Sonos' own integration catalog lists
them, not in the order the registration endpoint answers and not by name.
Read off play.sonos.com on 2026-09-19 against a household of seventeen: its
listing runs AccuRadio, SomaFM, Spotify, TuneIn, Community Radio Plus, Sonos
Radio, Plex, 80er-Radio harmony -- catalog positions 7, 44, 46, 53, 64, 72,
74, 80 -- and then a second run of the same ordering for the rest. What
separates the two runs is still unknown, so this pins the ordering itself.

An earlier pass sorted the reverse-DNS integration ids and claimed to match
the product exactly; it had been checked on a six-service household whose
catalog order and alphabet happened to agree.
"""

from __future__ import annotations

import asyncio

from backend.sonos.cloud import SonosCloud

#: The household's registrations, in the order Sonos' endpoint answers, which
#: is neither alphabetical nor the order anything displays them in.
SERVED = [
    {"service-id": "51463", "integration-id": "com.amazonmusic.sonos",
     "id": "cfg-amazon", "name": "Amazon Music", "account-id": "13"},
    {"service-id": "3079", "integration-id": "com.spotify.sonos.us",
     "id": "cfg-spotify", "name": "Spotify", "account-id": "4"},
    {"service-id": "48135", "integration-id": "com.accuradio.sonos",
     "id": "cfg-accuradio", "name": "AccuRadio", "account-id": "8"},
    {"service-id": "132103", "integration-id": "com.somafm",
     "id": "cfg-somafm", "name": "SomaFM Radio", "account-id": "5"},
]

#: The catalog, in its own order. AccuRadio comes before SomaFM there, and
#: Amazon Music comes last, which is what the listing follows.
CATALOG = [
    {"service-id": "48135", "integration-id": "com.accuradio.sonos",
     "id": "cfg-accuradio", "name": "AccuRadio"},
    {"service-id": "132103", "integration-id": "com.somafm",
     "id": "cfg-somafm", "name": "SomaFM Radio"},
    {"service-id": "3079", "integration-id": "com.spotify.sonos.us",
     "id": "cfg-spotify", "name": "Spotify"},
    {"service-id": "51463", "integration-id": "com.amazonmusic.sonos",
     "id": "cfg-amazon", "name": "Amazon Music"},
]


class _Response:
    def __init__(self, payload):
        self._payload = payload
        self.status = 200

    async def json(self, content_type=None):
        return self._payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session:
    """Answers the two endpoints the ordering needs and nothing else."""

    def get(self, url, headers=None):
        if url.endswith("/integrations/registrations"):
            return _Response(SERVED)
        if url.endswith("/integrations"):
            return _Response(CATALOG)
        raise AssertionError(f"unexpected request to {url}")


def _cloud():
    cloud = SonosCloud.__new__(SonosCloud)
    cloud._registrations = {}
    cloud._catalog = {}
    cloud._inflight = {}
    cloud._gen = {}
    cloud._session = _Session()
    cloud._require = lambda: cloud._session
    cloud._headers = lambda: {}
    return cloud


def test_services_are_listed_in_the_catalogs_order():
    cloud = _cloud()
    names = [r.name for r in asyncio.run(cloud.registrations("hh"))]
    assert names == ["AccuRadio", "SomaFM Radio", "Spotify", "Amazon Music"]


def test_a_service_missing_from_the_catalog_goes_last():
    cloud = _cloud()
    cloud._session.get = lambda url, headers=None: _Response(
        SERVED if url.endswith("/registrations") else CATALOG[:2])
    names = [r.name for r in asyncio.run(cloud.registrations("hh"))]
    assert names[:2] == ["AccuRadio", "SomaFM Radio"]
    # The two the catalog no longer lists keep a stable order of their own
    # rather than shuffling with every fetch.
    assert names[2:] == ["Amazon Music", "Spotify"]


def test_the_order_survives_the_cache():
    cloud = _cloud()
    first = [r.name for r in asyncio.run(cloud.registrations("hh"))]
    second = [r.name for r in asyncio.run(cloud.registrations("hh"))]
    assert first == second
