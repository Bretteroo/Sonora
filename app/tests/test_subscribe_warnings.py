"""A speaker that keeps failing its subscriptions is one warning, not a
flood (sonos/events.py): the first failure warns, the rest are notes until
every subscription to it succeeds again or an hour has passed."""

import asyncio
import logging

from backend.sonos import events
from backend.sonos.const import AV_TRANSPORT, RENDERING_CONTROL
from backend.sonos.events import EventListener

SERVICES = (AV_TRANSPORT, RENDERING_CONTROL)


class Response:
    def __init__(self, status):
        self.status, self.headers = status, {"SID": "uuid:1", "TIMEOUT": "Second-3600"}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class Session:
    """Fails with whichever error is next, or answers 200 once told to."""

    def __init__(self):
        self.errors = [TimeoutError(), OSError("Cannot connect to host")]
        self.ok = False
        self.calls = 0

    def request(self, method, url, **kwargs):
        self.calls += 1
        if self.ok:
            return Response(200)
        raise self.errors[self.calls % len(self.errors)]


def listener(session):
    ears = EventListener.__new__(EventListener)
    ears._session = session
    ears._failing = {}
    ears._subs = {}
    ears.bound_port = 1
    ears._callback_ip = "192.168.0.2"
    return ears


def warnings(caplog):
    return [r for r in caplog.records if r.levelno >= logging.WARNING]


def test_a_failing_speaker_warns_once_whatever_the_reason(caplog):
    caplog.set_level(logging.INFO, logger=events.__name__)
    ears = listener(Session())

    async def go():
        await ears.subscribe_many("h", SERVICES)
        await ears.subscribe("h", SERVICES[0])     # a renewal's lone retry
        await ears.subscribe_many("h", SERVICES)   # another reason this time
    asyncio.run(go())
    assert len(warnings(caplog)) == 1
    assert sum(r.levelno == logging.INFO for r in caplog.records) == 2


def test_it_warns_again_after_recovering(caplog):
    caplog.set_level(logging.INFO, logger=events.__name__)
    session = Session()
    ears = listener(session)

    async def go():
        await ears.subscribe_many("h", SERVICES)
        session.ok = True
        await ears.subscribe_many("h", SERVICES)
        for sub in ears._subs.values():
            sub.task.cancel()
        session.ok = False
        await ears.subscribe_many("h", SERVICES)
    asyncio.run(go())
    assert len(warnings(caplog)) == 2


def test_an_hour_of_failing_is_a_warning_again(caplog, monkeypatch):
    caplog.set_level(logging.INFO, logger=events.__name__)
    clock = [1000.0]
    monkeypatch.setattr(events, "monotonic", lambda: clock[0])
    ears = listener(Session())
    asyncio.run(ears.subscribe("h", SERVICES[0]))
    clock[0] += 1800
    asyncio.run(ears.subscribe("h", SERVICES[0]))
    clock[0] += 1801
    asyncio.run(ears.subscribe("h", SERVICES[0]))
    assert len(warnings(caplog)) == 2
