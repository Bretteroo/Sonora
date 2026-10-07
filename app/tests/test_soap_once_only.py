"""An action that changes something is not sent twice after a timeout.

A timed-out AddURIToQueue the player had already acted on was retried
twice, which can add the same
items more than once. A connection that never opened delivered nothing,
so that is still retried.
"""

import asyncio

import aiohttp
import pytest

from backend.sonos import const
from backend.sonos.soap import SoapClient


class _Session:
    def __init__(self, exc):
        self.exc = exc
        self.posts = 0

    def post(self, *args, **kwargs):
        self.posts += 1
        raise self.exc


def _call(action, exc):
    session = _Session(exc)
    client = SoapClient(session, retries=2)
    with pytest.raises(ConnectionError):
        asyncio.run(client.call("192.168.0.110", const.AV_TRANSPORT, action, {"InstanceID": 0}))
    return session.posts


def test_a_queue_add_that_timed_out_is_sent_once():
    assert _call("AddURIToQueue", asyncio.TimeoutError()) == 1


def test_a_skip_that_timed_out_is_sent_once():
    assert _call("Next", asyncio.TimeoutError()) == 1


def test_a_read_that_timed_out_is_tried_again():
    assert _call("GetPositionInfo", asyncio.TimeoutError()) == 3


def test_a_connection_that_never_opened_is_tried_again_even_for_an_add():
    from types import SimpleNamespace
    key = SimpleNamespace(host="192.168.0.110", port=1400, ssl=None, is_ssl=False)
    refused = aiohttp.ClientConnectorError(connection_key=key, os_error=OSError(111, "refused"))
    assert _call("AddURIToQueue", refused) == 3
