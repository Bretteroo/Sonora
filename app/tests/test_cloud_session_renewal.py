"""The Sonos session is renewed before its access token runs out.

The token inside the web app's session cookie lasts a day and is renewed only
by asking for the session document, which Sonora did once at start-up and
never again: a day later the content API answered 401 and Sonora signed
itself out. Now it asks halfway through each token's life, asks before any
request made with under two minutes left, and on a 401 asks whether the
session still stands before giving it up.
"""

import asyncio
from time import time

import pytest

from backend.sonos import cloud as module
from backend.sonos.cloud import CloudError, NotSignedIn, SonosCloud


class _Response:
    def __init__(self, status, body):
        self.status = status
        self._body = body

    async def json(self, content_type=None):
        return self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Jar:
    def save(self, path):
        path.write_bytes(b"jar")


class _Session:
    """Answers the session document from ``documents`` in turn, and every
    other URL with ``status``."""

    def __init__(self, documents, status=200):
        self.documents = list(documents)
        self.status = status
        self.asked = []
        self.closed = False
        self.cookie_jar = _Jar()

    def get(self, url, **kwargs):
        self.asked.append(url)
        if url == module.SESSION:
            return _Response(200, self.documents.pop(0))
        return _Response(self.status, {"ticket": "t"})

    async def close(self):
        self.closed = True


def _document(expires_in):
    return {"user": {"sonosId": 7}, "accessTokenStatus": {"status": "present",
            "expiration": int((time() + expires_in) * 1000)}}


@pytest.fixture
def cloud(tmp_path, monkeypatch):
    monkeypatch.setattr(module.settings, "data_dir", tmp_path)
    return SonosCloud()


def test_a_request_near_the_token_end_renews_first(cloud):
    async def go():
        cloud._session = _Session([_document(86400)])
        cloud._token_expires = time() + 60
        await cloud.muse_ticket()
        return cloud._session.asked, cloud._token_expires

    asked, expires = asyncio.run(go())
    assert asked == [module.SESSION, module.MFE]
    assert expires > time() + 86000


def test_a_request_with_time_left_goes_straight_out(cloud):
    async def go():
        cloud._session = _Session([])
        cloud._token_expires = time() + 3600
        await cloud.muse_ticket()
        return cloud._session.asked

    assert asyncio.run(go()) == [module.MFE]


def test_the_keeper_waits_half_the_token_life(cloud):
    cloud._token_expires = time() + 86400
    assert 43000 < cloud._next_renewal() <= 43200
    cloud._token_expires = time() - 10
    assert cloud._next_renewal() == module.RENEW_RETRY
    cloud._token_expires = None
    assert cloud._next_renewal() == module.RENEW_FALLBACK


def test_a_401_on_a_session_that_stands_keeps_the_sign_in(cloud):
    async def go():
        cloud._session = _Session([_document(86400)], status=401)
        with pytest.raises(CloudError) as caught:
            await cloud.muse_ticket()
        return caught.value, cloud.signed_in

    error, signed_in = asyncio.run(go())
    assert not isinstance(error, NotSignedIn)
    assert signed_in


def test_a_session_sonos_has_ended_signs_out_and_is_forgotten(cloud):
    async def go():
        cloud._session = _Session([{}], status=401)
        cloud._persist()
        with pytest.raises(NotSignedIn):
            await cloud.muse_ticket()
        return cloud.signed_in

    assert asyncio.run(go()) is False
    assert not cloud._cookie_file.exists()


def test_callers_arriving_together_share_one_renewal(cloud):
    async def go():
        cloud._session = _Session([_document(86400)])
        await asyncio.gather(*(cloud._renew() for _ in range(4)))
        return cloud._session.asked

    assert asyncio.run(go()) == [module.SESSION]
