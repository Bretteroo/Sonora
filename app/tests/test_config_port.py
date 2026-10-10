"""Sonora's own port: 50205 unless SONORA_WEB_PORT says otherwise."""

import importlib
import os
import sys


def _fresh_settings(monkeypatch, **env):
    for name in ("SONORA_WEB_PORT", "SONORA_WEB_HOST"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    sys.modules.pop("backend.config", None)
    return importlib.import_module("backend.config").settings


def test_default_port_is_50205(monkeypatch):
    settings = _fresh_settings(monkeypatch)
    assert settings.port == 50205
    assert settings.host == "0.0.0.0"


def test_port_follows_the_environment(monkeypatch):
    assert _fresh_settings(monkeypatch, SONORA_WEB_PORT="8099").port == 8099


def test_the_page_is_never_served_stale():
    """index.html names the current bundle, so a stale copy loads nothing.

    Every build writes new content-hashed assets and deletes the old ones, so
    a browser holding yesterday's index.html asks for a script that is gone
    and the interface never mounts. It was served with no cache headers at
    all, which leaves a browser free to keep it as long as it likes -- and one
    did, after a day of rebuilds.

    Called directly rather than over HTTP: this checkout has no httpx, so
    starlette's test client cannot run.
    """
    import asyncio

    from starlette.requests import Request

    from backend import main

    if not hasattr(main, "index"):
        return  # no bundle built in this checkout
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [],
                       "client": ("127.0.0.1", 40000), "query_string": b""})
    response = asyncio.run(main.index(request))
    assert response.headers.get("cache-control") == "no-cache"
    assert response.headers.get("etag"), "and an ETag, so revalidating is cheap"


def test_the_hashed_bundle_may_be_kept_forever():
    """Its URL carries a content hash, so it never means anything else."""
    from backend import main

    assert "immutable" in main._IMMUTABLE
    assert "max-age=31536000" in main._IMMUTABLE
    assert main._NEVER_STALE == "no-cache"
