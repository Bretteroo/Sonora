"""The About card's note of a newer release (backend/release.py): one look
at GitHub 90 seconds after start-up and then daily, read by the card."""

import asyncio

import pytest

from backend import release


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    monkeypatch.setattr(release, "_state", {"latest": None, "checked_at": 0.0})
    monkeypatch.setattr(release, "app_version", lambda: "1.0.9")


def test_versions_compare_by_number():
    assert release.version_key("1.0.10") > release.version_key("1.0.9")
    assert release.version_key("1.1.0-rc1") == (1, 1, 0)


def test_the_running_version_is_known():
    # Read from the installed package, or pyproject.toml when run from source.
    import importlib
    assert importlib.reload(release).app_version() != "dev"


def test_the_page_names_the_version_serving_it():
    # About reads this before the version the bundle was built with.
    page = b"<!doctype html><html><head><title>Sonora</title></head></html>"
    assert b'<head>\n    <meta name="sonora-version" content="1.0.9" />' in release.tag_page(page)


def test_every_copy_of_the_version_agrees():
    # A release bumps four files; one left behind ships a mismatched build or
    # leaves Home Assistant users on the old image.
    import json
    import pathlib
    import re
    root = pathlib.Path(__file__).resolve().parent.parent
    lock = json.loads((root / "frontend/package-lock.json").read_text())
    versions = {
        "pyproject.toml": re.search(r'^version\s*=\s*"([^"]+)"', (root / "pyproject.toml").read_text(), re.M)[1],
        "package.json": json.loads((root / "frontend/package.json").read_text())["version"],
        "package-lock.json": lock["version"],
        "package-lock.json packages": lock["packages"][""]["version"],
        "config.yaml": re.search(r'^version:\s*"([^"]+)"',
                                 (root.parent / "homeassistant/sonora/config.yaml").read_text(), re.M)[1],
    }
    assert len(set(versions.values())) == 1, versions


class Response:
    def __init__(self, status, data):
        self.status, self.data = status, data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def json(self, content_type=None):
        return self.data


def github(monkeypatch, status, data):
    asked = []

    class Session:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        def get(self, url, **kwargs):
            asked.append(url)
            return Response(status, data)

    monkeypatch.setattr(release.aiohttp, "ClientSession", Session)
    return asked


def test_a_newer_release_is_reported(monkeypatch):
    asked = github(monkeypatch, 200, {"tag_name": "v1.0.10",
                                      "html_url": "https://github.com/Bretteroo/Sonora/releases/tag/v1.0.10"})
    asyncio.run(release.check_once())
    status = release.status()
    assert asked == [release.LATEST_URL]
    # The link is to the release notes as a whole, not the one version's.
    assert (status["available"], status["latest"], status["url"]) == (
        True, "1.0.10", "https://github.com/Bretteroo/Sonora/releases")


def test_the_same_version_is_not_news(monkeypatch):
    github(monkeypatch, 200, {"tag_name": "v1.0.9", "html_url": "u"})
    asyncio.run(release.check_once())
    assert release.status()["available"] is False


def test_drafts_prereleases_and_failures_say_nothing(monkeypatch):
    github(monkeypatch, 200, {"tag_name": "v2.0.0", "prerelease": True, "html_url": "u"})
    asyncio.run(release.check_once())
    github(monkeypatch, 404, {})
    asyncio.run(release.check_once())
    assert release.status()["available"] is False


def test_reading_the_status_never_asks_github(monkeypatch):
    asked = github(monkeypatch, 200, {"tag_name": "v1.0.10", "html_url": "u"})
    release.status()
    assert asked == []


def test_the_first_look_waits_90_seconds_then_daily(monkeypatch):
    waits, checks = [], []

    async def sleep(seconds):
        waits.append(seconds)
        if len(waits) == 3:
            raise asyncio.CancelledError

    async def check():
        checks.append(1)
        raise OSError("GitHub did not answer")  # only logged; tried again next day

    monkeypatch.setattr(release.asyncio, "sleep", sleep)
    monkeypatch.setattr(release, "check_once", check)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(release._loop())
    assert waits == [90, 24 * 3600, 24 * 3600]
    assert len(checks) == 2
