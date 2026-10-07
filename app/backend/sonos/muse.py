"""Live home-theater facts from Sonos' cloud websocket.

The web app keeps one websocket open to ``wss://api.ws.sonos.com/websocket``,
authorized by a short-lived ticket it fetches from ``/api/mfe`` on its
signed-in session. Frames are JSON pairs, ``[header, body]``: a request carries
``namespace``, ``command`` and a ``corrId`` in the header, the matching reply
echoes the ``corrId`` with ``response`` and ``success``, and subscriptions
produce unsolicited frames whose header has a ``type``. This is the same
"Muse" API the mobile apps speak to speakers directly, which on the LAN
requires a device certificate this project does not have.

Only one fact is taken from it. When a soundbar plays its television input,
``playbackExtended`` reports ``metadata.container.type`` as
``linein.homeTheater.<input>`` (``spdif`` or ``hdmi``) and an
``htInputFormat.streamDescription`` such as "No Signal" or a codec name. The
speaker's own transport URI ends ``:spdif`` regardless of the input in use, so
this is the only source for the label the official card shows under "TV".

The feed is optional and only runs while signed in; everything degrades to the
local reading when it is absent.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable

import aiohttp

from .cloud import CloudError, NotSignedIn, SonosCloud

log = logging.getLogger(__name__)

RECONNECT_MIN = 5.0
RECONNECT_MAX = 300.0
REPLY_TIMEOUT = 20.0

HOME_THEATER_PREFIX = "linein.homeTheater"


@dataclass(slots=True, frozen=True)
class HomeTheaterStatus:
    """What a coordinator's television input is doing, per the cloud."""

    #: "SPDIF", "HDMI", or "" when the group is not on its television input.
    input: str
    #: ``streamDescription``: "No Signal", a codec name, or None when unknown.
    signal: str | None


CLEARED = HomeTheaterStatus("", None)

StatusCallback = Callable[[str, HomeTheaterStatus], Awaitable[None]]


def home_theater_status(body: dict) -> HomeTheaterStatus:
    """Read the television input out of an ``extendedPlaybackStatus`` body."""
    container = ((body.get("metadata") or {}).get("container") or {})
    kind = container.get("type") or ""
    if not kind.startswith(HOME_THEATER_PREFIX):
        return CLEARED
    rest = kind[len(HOME_THEATER_PREFIX):]
    name = rest[1:] if rest.startswith(".") else ""
    fmt = container.get("htInputFormat") or {}
    signal = fmt.get("streamDescription")
    return HomeTheaterStatus(name.upper(), signal if isinstance(signal, str) else None)


class MuseFeed:
    """One websocket, resubscribed to every group's playback while signed in."""

    def __init__(self, cloud: SonosCloud, on_status: StatusCallback) -> None:
        self._cloud = cloud
        self._on_status = on_status
        self._task: asyncio.Task | None = None
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._pending: dict[str, asyncio.Future] = {}
        self._groups: set[str] = set()
        self.connected = False
        self.last_error = ""

    def status(self) -> dict:
        return {
            "running": self._task is not None and not self._task.done(),
            "connected": self.connected,
            "groups": len(self._groups),
            "error": self.last_error,
        }

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="muse-feed")

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        self.connected = False

    # -- connection loop -----------------------------------------------------

    async def _run(self) -> None:
        delay = RECONNECT_MIN
        while True:
            try:
                await self._session()
                delay = RECONNECT_MIN
            except NotSignedIn:
                self.last_error = "signed out"
                log.info("muse feed stopped: signed out")
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - keep the feed alive
                self.last_error = str(exc) or exc.__class__.__name__
                log.warning("muse feed: %s; retrying in %.0fs", self.last_error, delay)
            self.connected = False
            await asyncio.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX)

    async def _session(self) -> None:
        ws = await self._cloud.muse_connect()
        self._ws = ws
        self.connected = True
        self.last_error = ""
        log.info("muse feed connected")
        reader = asyncio.create_task(self._read(ws), name="muse-read")
        try:
            await self._subscribe_all()
            await reader
        finally:
            reader.cancel()
            self._ws = None
            self._groups.clear()
            for fut in self._pending.values():
                fut.cancel()
            self._pending.clear()
            self.connected = False
            await ws.close()

    async def _read(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    header, body = json.loads(msg.data)
                except (ValueError, TypeError):
                    continue
                if isinstance(header, dict) and isinstance(body, dict):
                    await self._dispatch(header, body)
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                break
        raise CloudError("Sonos closed the websocket")

    async def _send(self, header: dict, body: dict | None = None,
                    wait: bool = True) -> tuple[dict, dict] | None:
        ws = self._ws
        if ws is None or ws.closed:
            raise CloudError("websocket is not open")
        corr = str(uuid.uuid4())
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        if wait:
            self._pending[corr] = fut
        await ws.send_str(json.dumps([{**header, "corrId": corr}, body or {}]))
        if not wait:
            return None
        try:
            return await asyncio.wait_for(fut, REPLY_TIMEOUT)
        except asyncio.TimeoutError as exc:
            raise CloudError(f"no reply to {header.get('command')}") from exc
        finally:
            self._pending.pop(corr, None)

    # -- commands ------------------------------------------------------------

    async def set_household_name(self, household_id: str, name: str) -> None:
        """Rename a household, as the web player's System Name does.

        ``households`` / ``setName`` with the cloud's household id and
        ``{"name": ...}``, read off play.sonos.com's websocket on 2026-09-28.
        The speakers take the new name at once: their own ``museHHName``
        read "Your System 2" straight after. Raises CloudError when the
        socket is not open or the cloud refuses.
        """
        await self._send({"namespace": "households", "command": "setName",
                          "householdId": household_id}, {"name": name})

    # -- subscriptions -------------------------------------------------------

    async def _subscribe_all(self) -> None:
        _, body = await self._send(
            {"namespace": "households", "command": "getHouseholds"},
            {"connectedOnly": "false"})
        for household in body.get("households", []):
            hid = household.get("id")
            if not hid:
                continue
            # An S1 household is listed too, and answers getGroups, but its
            # groups never reply to a playback subscription; each would cost
            # a full reply timeout. Its firmware line is 57.x, a number S2
            # passed long ago.
            if str(household.get("swVersion", "")).startswith("57."):
                log.info("muse: skipping S1 household %s", hid[:22])
                continue
            try:
                _, groups = await self._send(
                    {"namespace": "groups", "command": "getGroups",
                     "householdId": hid},
                    {"includeDeviceInfo": "false"})
            except CloudError as exc:
                # An S1 household is listed but does not speak this API.
                log.info("muse: no groups for household %s (%s)", hid[:22], exc)
                continue
            try:
                await self._send({"namespace": "groups", "command": "subscribe",
                                  "householdId": hid})
            except CloudError as exc:
                log.info("muse: group changes unavailable for %s (%s)", hid[:22], exc)
            await self._subscribe_groups(groups.get("groups", []))

    async def _subscribe_groups(self, groups: list[dict]) -> None:
        fresh = [g.get("id") for g in groups
                 if g.get("id") and g.get("id") not in self._groups]
        self._groups.update(fresh)
        # In parallel, so one silent group delays the others by nothing.
        await asyncio.gather(*(self._subscribe_group(gid) for gid in fresh))

    async def _subscribe_group(self, gid: str) -> None:
        try:
            await self._send({"namespace": "playbackExtended",
                              "command": "subscribe", "groupId": gid})
        except CloudError as exc:
            self._groups.discard(gid)
            log.info("muse: playback unavailable for %s (%s)", gid, exc)

    async def _dispatch(self, header: dict, body: dict) -> None:
        corr = header.get("corrId")
        if corr in self._pending and "response" in header:
            fut = self._pending[corr]
            if not fut.done():
                if header.get("success", True):
                    fut.set_result((header, body))
                else:
                    fut.set_exception(CloudError(
                        body.get("errorCode") or header.get("response") or "refused"))
            return
        kind = header.get("type") or header.get("name")
        if kind == "extendedPlaybackStatus":
            group_id = header.get("groupId") or ""
            coordinator = group_id.split(":", 1)[0]
            if coordinator:
                # Off the reader: the callback ends in a broadcast to browser
                # sockets, and one slow browser must not hold up the replies
                # this socket is waiting for.
                self._spawn(self._on_status(coordinator, home_theater_status(body)))
        elif kind == "groups":
            self._spawn(self._subscribe_groups(body.get("groups", [])))

    @staticmethod
    def _spawn(coro) -> None:
        task = asyncio.create_task(coro)

        def _done(t: asyncio.Task) -> None:
            if not t.cancelled() and t.exception() is not None:
                log.warning("muse feed handler failed: %r", t.exception())
        task.add_done_callback(_done)
