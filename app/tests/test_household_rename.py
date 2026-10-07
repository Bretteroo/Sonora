"""An S2 system is renamed the way the web player renames it.

play.sonos.com sends ``households`` / ``setName`` over the cloud websocket
with the cloud's household id and ``{"name": ...}``, and the speakers' own
``museHHName`` follows at once (2026-09-28).
"""

import asyncio
import json

from backend.sonos.muse import MuseFeed


class _Socket:
    closed = False

    def __init__(self):
        self.sent = []

    async def send_str(self, text):
        self.sent.append(json.loads(text))


def test_the_frame_is_the_web_players():
    feed = MuseFeed(cloud=None, on_status=None)
    feed._ws = _Socket()

    async def run():
        task = asyncio.create_task(feed.set_household_name("Sonos_x.cloud", "Your Systemz"))
        await asyncio.sleep(0)
        header, body = feed._ws.sent[0]
        # The reply the cloud sends back, matched on corrId.
        await feed._dispatch({"corrId": header["corrId"], "response": "setName", "success": True}, {})
        await task
        return header, body

    header, body = asyncio.run(run())
    assert header["namespace"] == "households"
    assert header["command"] == "setName"
    assert header["householdId"] == "Sonos_x.cloud"
    assert body == {"name": "Your Systemz"}
