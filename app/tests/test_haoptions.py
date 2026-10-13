"""The Home Assistant app's port options, and the sidebar's port beside them.

Home Assistant leaves what was entered on the app's Configuration tab in
/data/options.json; Sonora turns the two ports there into the environment its
settings read. The sidebar's requests arrive on a port the Supervisor picks,
which Sonora serves as well, one app behind both.
"""

from __future__ import annotations

import asyncio
import io
import json
import socket
import urllib.request

import pytest
import uvicorn

from backend import haoptions
from backend.__main__ import _Alongside, _serve


@pytest.fixture
def ha(monkeypatch):
    monkeypatch.setenv("SONORA_HA_INGRESS", "1")
    monkeypatch.delenv("SONORA_WEB_PORT", raising=False)
    monkeypatch.delenv("SONORA_EVENT_PORT", raising=False)
    return monkeypatch


def test_the_options_set_both_ports(ha, tmp_path):
    options = tmp_path / "options.json"
    options.write_text(json.dumps({"web_port": 51005, "event_port": 51006}))
    assert haoptions.apply(options) == {"web_port": 51005, "event_port": 51006}
    import os
    assert os.environ["SONORA_WEB_PORT"] == "51005"
    assert os.environ["SONORA_EVENT_PORT"] == "51006"


def test_a_bad_value_leaves_the_default(ha, tmp_path):
    options = tmp_path / "options.json"
    options.write_text(json.dumps({"web_port": 70000, "event_port": "x"}))
    haoptions.apply(options)
    import os
    assert "SONORA_WEB_PORT" not in os.environ and "SONORA_EVENT_PORT" not in os.environ


def test_outside_home_assistant_nothing_is_read(monkeypatch, tmp_path):
    monkeypatch.delenv("SONORA_HA_INGRESS", raising=False)
    options = tmp_path / "options.json"
    options.write_text(json.dumps({"web_port": 51005}))
    assert haoptions.apply(options) == {}


def test_a_missing_file_is_no_options(ha, tmp_path):
    assert haoptions.apply(tmp_path / "nothing.json") == {}


def test_the_supervisor_names_the_sidebar_port(ha, monkeypatch):
    monkeypatch.setenv("SUPERVISOR_TOKEN", "t")
    seen = {}

    def answer(request, timeout):
        seen["auth"] = request.get_header("Authorization")
        return io.BytesIO(json.dumps({"result": "ok", "data": {"ingress_port": 62100}}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", answer)
    assert haoptions.ingress_port() == 62100
    assert seen["auth"] == "Bearer t"


def test_no_supervisor_no_sidebar_port(ha, monkeypatch):
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    assert haoptions.ingress_port() is None


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_one_app_answers_on_both_ports_and_starts_once():
    started = []

    async def app(scope, receive, send):
        if scope["type"] == "lifespan":
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    started.append(1)
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": str(scope["server"][1]).encode()})

    web_port, side_port = _free_port(), _free_port()
    web = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=web_port, log_level="warning"))
    side = _Alongside(uvicorn.Config(app, host="127.0.0.1", port=side_port, log_level="warning", lifespan="off"))

    async def run():
        serving = asyncio.create_task(_serve(web, [side]))
        while not (web.started and side.started):
            await asyncio.sleep(0.02)
        bodies = []
        for port in (web_port, side_port):
            body = await asyncio.to_thread(lambda p=port: urllib.request.urlopen(f"http://127.0.0.1:{p}/", timeout=5).read())
            bodies.append(int(body))
        web.should_exit = True
        await asyncio.wait_for(serving, 10)
        return bodies

    assert asyncio.run(run()) == [web_port, side_port]
    assert started == [1]
    assert side.should_exit
