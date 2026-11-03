"""One slow provider must not empty the household's service catalog.

An S1 player asks an anonymous service's own server before it answers the
GetSessionId probe, so a provider that takes 12s (CBC did) times out on every
player alike. The read used to treat that as the player failing, try the next
one, and end with no catalog at all.
"""

import asyncio

import pytest

from backend.sonos.services import ServiceReader
from backend.sonos.soap import SoapFault

LIST = (
    '&lt;Services&gt;'
    '&lt;Service Id="256" Name="CBC Radio" Version="1.1" Uri="https://a.invalid/s"&gt;'
    '&lt;Policy Auth="Anonymous" PollInterval="300"/&gt;&lt;/Service&gt;'
    '&lt;Service Id="254" Name="TuneIn" Version="1.1" Uri="https://b.invalid/s"&gt;'
    '&lt;Policy Auth="Anonymous" PollInterval="300"/&gt;&lt;/Service&gt;'
    '&lt;Service Id="12" Name="Spotify" Version="1.1" Uri="https://c.invalid/s"&gt;'
    '&lt;Policy Auth="AppLink" PollInterval="30"/&gt;&lt;/Service&gt;'
    '&lt;/Services&gt;'
)


class _Soap:
    """TuneIn is on the household; CBC is too, but its server is slow."""

    def __init__(self, cbc_answers_patient_call=True, silent=False):
        self.patient = cbc_answers_patient_call
        self.silent = silent

    async def call(self, host, service, action, args=None, **kw):
        if action == "ListAvailableServices":
            return {"AvailableServiceDescriptorList": LIST}
        if action == "GetSessionId":
            if self.silent:
                raise TimeoutError()
            if args["ServiceId"] == 256:
                if kw.get("timeout") == ServiceReader.SLOW_PROBE_TIMEOUT and self.patient:
                    raise SoapFault("1000", "", "MusicServices", action)
                raise TimeoutError()
            raise SoapFault("1000", "", "MusicServices", action)
        raise AssertionError(action)


async def _none(*args, **kw):
    return set()


def _reader(soap):
    reader = ServiceReader(soap)
    reader._service_ids_in_use = _none
    return reader


def test_a_slow_provider_leaves_the_catalog_standing():
    reader = _reader(_Soap())

    async def run():
        directory = await reader.read("10.0.0.1", configured={12}, timeout=4.0,
                                      retries=0, strict=True)
        await asyncio.gather(*reader._settling)
        return directory
    directory = asyncio.run(run())
    assert sorted(s.name for s in directory.in_use) == ["Spotify", "TuneIn"]
    # The patient second ask found CBC, and the next read has it.
    assert 256 in reader._anonymous["10.0.0.1"][1]


def test_a_slow_provider_keeps_what_was_known_about_it():
    reader = _reader(_Soap(cbc_answers_patient_call=False))
    reader._anonymous["10.0.0.2"] = (0.0, {256})

    async def run():
        directory = await reader.read("10.0.0.1", strict=True)
        await asyncio.gather(*reader._settling)
        return directory
    directory = asyncio.run(run())
    assert "CBC Radio" in [s.name for s in directory.in_use]


def test_a_player_that_answers_nothing_still_fails_a_strict_read():
    reader = _reader(_Soap(silent=True))
    with pytest.raises(TimeoutError):
        asyncio.run(reader.read("10.0.0.1", strict=True))
