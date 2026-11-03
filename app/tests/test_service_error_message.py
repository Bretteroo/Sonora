"""A service's own words for its fault.

A service's strings table may carry ``Error<N>Message`` for the SonosError
codes it sends, and the Sonos apps show that text instead of the fault. Apple
Music answers "For You" with SonosError 10 until the account has picked some
genres; its Error10Message says how to do that.
"""

import asyncio

from backend.sonos.presentation import Presentation

APPLE = "https://example.invalid/manifest"


def _reader(strings, fails=False):
    reader = Presentation.__new__(Presentation)

    async def info_view(manifest_uri, language=""):
        if fails:
            raise OSError("no network")
        return {"menu": [], "strings": strings}
    reader.info_view = info_view
    return reader


def _ask(reader, code, manifest=APPLE):
    return asyncio.run(reader.error_message(manifest, code))


def test_the_services_message_for_its_code():
    reader = _reader({"Error10Message": "Open Apple Music and tap For You."})
    assert _ask(reader, 10) == "Open Apple Music and tap For You."


def test_a_code_the_service_has_no_words_for():
    assert _ask(_reader({"Error10Message": "x"}), 12) == ""


def test_no_code_no_words():
    assert _ask(_reader({"Error10Message": "x"}), None) == ""


def test_no_manifest_no_words():
    assert _ask(_reader({"Error10Message": "x"}), 10, manifest="") == ""


def test_an_unreadable_strings_table_is_no_words_not_an_error():
    assert _ask(_reader({}, fails=True), 10) == ""
