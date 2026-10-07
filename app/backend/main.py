"""HTTP and WebSocket interface over the Sonos controller.

State reaches the browser two ways. A client fetches one snapshot on connect,
then receives incremental zone updates over a WebSocket as speakers report
changes. Nothing polls.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from contextvars import ContextVar
from urllib.parse import quote, unquote
import html
import re
import secrets
import io
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

import aiohttp
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import themes as theme_store
from .config import settings
from .sonos.controller import Commands, SonosController
from .sonos.hhsettings import SettingsError, SettingsUnauthorized
from .sonos.logos import LogoCache
from .sonos.products import (ColorChoices, ProductPictures, color_name, colors_for,
                             picture_for, sole_color)
from .sonos.network import RadioFacts
from .sonos.accounts import account_udn
from .sonos.soundcloud_art import soundcloud_ref
from .sonos.artcache import upsized
from .sonos import const
from .sonos import smb
from . import origin
from . import locale as locales
from .errorlog import ErrorLog
from .sonos import fetchguard, localplay
from .sonos.network import room_health
from .sonos import icy
from .sonos import hhsettings
from .sonos.cloud import CloudError, NotSignedIn
from .sonos.smapi import SmapiError
from .sonos.smapi import smapi_item_id as _smapi_item_id
from .sonos.smapi import (smapi_account_serial, smapi_container_ref,
                          smapi_media_ref, smapi_sid)
from .sonos.playback import playable, station_didl
from .sonos.soap import SoapFault
from .sonos.didl import parse_didl

log = logging.getLogger(__name__)

state: dict[str, object] = {}


# The Error Log window's entries: warnings and errors, newest last, kept on
# disk as the Windows app keeps its own -- 100 of them, none past seven days
# (errorlog.py). Read back at start, written shortly after each new one.
recent_log = ErrorLog()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger().addHandler(recent_log)
    recent_log.load(settings.data_dir / "error_log.json")
    session = aiohttp.ClientSession()
    # Streams and pictures, the fetches a caller can aim, go out through a
    # session that will not reach this machine however it is redirected.
    outward = fetchguard.outward_session()
    controller = SonosController(
        session,
        event_port=settings.event_port,
        outward=outward,
    )

    controller.dropouts.log.path = settings.data_dir / "dropouts.json"
    controller.dropouts.log.load()
    state["session"] = session
    state["outward"] = outward
    state["controller"] = controller
    state["commands"] = Commands(controller)
    state["clients"] = set()
    # Service logos come from the public manifest the desktop client reads and
    # live on disk, so they survive a sign-out and a restart alike.
    state["logos"] = LogoCache(session, settings.data_dir)
    # Read its index now, off the start-up path: until it is read no service
    # can be matched to a logo, and the list fell back to the cloud's.
    state["logos_primed"] = asyncio.create_task(state["logos"].prime())
    # Product pictures come from Sonos once each and stay on disk after.
    state["products"] = ProductPictures(session, settings.data_dir)
    state["colors"] = ColorChoices(settings.data_dir)

    controller.on_state(_fan_out)
    try:
        await controller.start()
    except Exception:
        log.exception("controller failed to start; serving with empty state")
    # Bring back a Sonos sign-in from a previous run so a restart does not drop
    # it. The television feed only runs while signed in, so start it too.
    try:
        if await controller.cloud.restore():
            await controller.muse.start()
    except Exception:
        log.exception("could not restore Sonos session")
    # Build the service list once, behind start-up, so the first window to
    # ask finds every part of it held -- the speakers' directory, the
    # household's registrations and Sonos' catalog, the pairability audit --
    # rather than waiting three seconds on their first fetches.
    async def warm_services() -> None:
        try:
            await services()
        except Exception as exc:
            log.info("service list warm-up failed: %s", exc)
    warming = asyncio.create_task(warm_services())
    try:
        yield
    finally:
        warming.cancel()
        await controller.stop()
        await session.close()
        await outward.close()
        recent_log.save()


app = FastAPI(title="Sonora", lifespan=lifespan)
# Sonora has no login: anyone who can reach it on the network may drive it.
# That is deliberate (SECURITY.md). It does not extend to a website
# driving it through a visitor's browser, which this refuses.
app.middleware("http")(origin.guard)


#: Routes that pass on what someone else's server sent. A picture can be an
#: SVG and a stream's type is whatever the station said, so either could be a
#: page with script in it, on Sonora's own origin, if a browser were sent to
#: it directly (found in review). It is served as inert content instead.
_PASSED_ON = ("/api/art", "/api/stream/audio/")


#: The page's own policy. Script comes only from Sonora, which keeps an
#: installed theme to the data it is promised to be, and fonts and
#: stylesheets only from Sonora or data: URLs, behind the install check in
#: themes.py. Pictures and media stay open: stations, favorites and services
#: show and play art and streams from their own hosts.
PAGE_POLICY = ("script-src 'self'; worker-src 'self' blob:; object-src 'none'; "
               "base-uri 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'")


@app.middleware("http")
async def inert_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    if request.url.path.startswith(_PASSED_ON):
        response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    elif response.headers.get("content-type", "").startswith("text/html"):
        response.headers.setdefault("Content-Security-Policy", PAGE_POLICY)
    return response


#: The reader's own default account per service, as their browser keeps it
#: ("<household>:<sid>" -> account serial): the choice made on a service
#: row's account caret, sent with every request in X-Sonora-Accounts.
_ACCOUNT_CHOICE: ContextVar[dict[str, str]] = ContextVar("account_choice", default={})


@app.middleware("http")
async def carry_the_readers_accounts(request: Request, call_next):
    """Keep the reader's default accounts for the request being served."""
    choice: dict[str, str] = {}
    raw = request.headers.get("x-sonora-accounts", "")
    if raw and len(raw) < 4096:
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                choice = {str(k): str(v) for k, v in list(data.items())[:64]
                          if isinstance(v, (str, int))}
        except ValueError:
            pass
    token = _ACCOUNT_CHOICE.set(choice)
    try:
        return await call_next(request)
    finally:
        _ACCOUNT_CHOICE.reset(token)


@app.middleware("http")
async def speak_the_readers_language(request: Request, call_next):
    """Serve each request in the locale its `Accept-Language` asks for.

    The interface sends the BCP 47 tag the reader chose. What it is for is the
    music services: their labels, their strings tables and their messages all
    come back in the language the SOAP call asks for, so a reader in French
    should be reading a service's own French rather than its English inside a
    French interface.
    """
    token = locales.use(locales.negotiate(request.headers.get("accept-language", "")))
    try:
        return await call_next(request)
    finally:
        locales.reset(token)


def controller() -> SonosController:
    instance = state.get("controller")
    if instance is None:
        raise HTTPException(503, "controller not ready")
    return instance  # type: ignore[return-value]


def commands() -> Commands:
    instance = state.get("commands")
    if instance is None:
        raise HTTPException(503, "controller not ready")
    return instance  # type: ignore[return-value]


async def _fan_out(message: dict) -> None:
    """Push a state message to every connected browser."""
    clients = state.get("clients") or set()
    if not clients:
        return
    dead = []
    for websocket in list(clients):  # type: ignore[arg-type]
        try:
            await websocket.send_json(message)
        except Exception:
            dead.append(websocket)
    for websocket in dead:
        clients.discard(websocket)  # type: ignore[union-attr]


# -- error translation --------------------------------------------------------


@app.exception_handler(SoapFault)
async def _soap_fault(request, exc: SoapFault):
    """Separate "you cannot do that now" from "the speaker is broken"."""
    return JSONResponse(
        status_code=409 if exc.is_conflict else 502,
        content={
            "error": "conflict" if exc.is_conflict else "speaker_refused",
            "message": str(exc),
            "code": exc.code,
            "service": exc.service,
            "action": exc.action,
        },
    )


@app.exception_handler(ConnectionError)
async def _speaker_silent(request, exc: ConnectionError):
    """A player that stopped answering is not a bug in Sonora.

    An older speaker busy resolving a service stream can go quiet for half a
    minute: on 2026-09-12 a Play:1 asked to play Mixcloud tracks in quick
    succession left AddURIToQueue, GetPositionInfo and Play unanswered and
    then came back on its own. That reached the pane as a 500 and read as
    Sonora breaking. It is a 504 with something a person can act on.
    """
    log.info("speaker did not answer: %s", exc)
    return JSONResponse(
        status_code=504,
        content={"error": "speaker_silent", "message": str(exc)},
    )


@app.exception_handler(KeyError)
async def _not_found(request, exc: KeyError):
    return JSONResponse(status_code=404,
                        content={"error": "not_found", "message": str(exc)})


# -- state --------------------------------------------------------------------


@app.get("/api/state")
async def get_state() -> dict:
    return controller().snapshot()


@app.post("/api/refresh")
async def refresh() -> dict:
    """Rediscover the network. Answers only once the new picture is complete,
    which is what lets a client show a scan as running and then report what
    it found."""
    await controller().refresh()
    return {"ok": True, "zones": len(controller().zones),
            "households": len(controller().households)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    # A socket is not subject to the same-origin policy, so this is the only
    # thing standing between a page on the internet and the household snapshot
    # sent on connect. See backend/origin.py.
    if not origin.websocket_allowed(websocket):
        log.warning("refused a socket from origin %s",
                    websocket.headers.get("origin", "")[:60])
        await websocket.close(code=1008)
        return
    await websocket.accept()
    clients = state.setdefault("clients", set())
    clients.add(websocket)  # type: ignore[union-attr]
    try:
        await websocket.send_json({"type": "snapshot",
                                   "data": controller().snapshot()})
        while True:
            # The protocol is server to client only; reading keeps the socket
            # alive and detects a disconnect promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        log.debug("websocket closed", exc_info=True)
    finally:
        clients.discard(websocket)  # type: ignore[union-attr]


# -- zone control -------------------------------------------------------------


class VolumeBody(BaseModel):
    level: int | None = Field(default=None, ge=0, le=100)
    delta: int | None = Field(default=None, ge=-100, le=100)
    group: bool = False


@app.post("/api/zones/{uuid}/volume")
async def set_volume(uuid: str, body: VolumeBody) -> dict:
    cmd = commands()
    if body.delta is not None:
        await cmd.adjust_volume(uuid, body.delta)
    elif body.level is not None:
        if body.group:
            await cmd.set_group_volume(uuid, body.level)
        else:
            await cmd.set_volume(uuid, body.level)
    else:
        raise HTTPException(400, "provide level or delta")
    return {"ok": True}


class MuteBody(BaseModel):
    muted: bool
    group: bool = False


@app.post("/api/zones/{uuid}/mute")
async def set_mute(uuid: str, body: MuteBody) -> dict:
    cmd = commands()
    if body.group:
        await cmd.set_group_mute(uuid, body.muted)
    else:
        await cmd.set_mute(uuid, body.muted)
    return {"ok": True}


TRANSPORT_ACTIONS = {
    "play": "play",
    "pause": "pause",
    "stop": "stop",
    "next": "next_track",
    "previous": "previous_track",
}


@app.post("/api/zones/{uuid}/transport/{action}")
async def transport(uuid: str, action: str) -> dict:
    method = TRANSPORT_ACTIONS.get(action)
    if method is None:
        raise HTTPException(404, f"unknown transport action {action!r}")
    await getattr(commands(), method)(uuid)
    return {"ok": True}


# A Play that does not start is reported by the speaker itself: it raises an
# AVTransport event naming the status and the failing URI, which the
# controller turns into a playbackError broadcast and the interface into a
# notice. This endpoint used to watch the transport for seven seconds after
# every Play and return a verdict as well, which no caller has read since the
# broadcast took over -- it only held the answer back by up to that long --
# so it was removed.


class PairBody(BaseModel):
    right_uuid: str


@app.post("/api/zones/{uuid}/stereo-pair")
async def create_stereo_pair(uuid: str, body: PairBody) -> dict:
    """Bond two identical players into a stereo pair; the addressed room is
    the left channel. The pair keeps the left room's name."""
    try:
        await commands().create_stereo_pair(uuid, body.right_uuid)
    except KeyError as exc:
        raise HTTPException(404, f"unknown zone {exc}") from None
    return {"ok": True}


@app.post("/api/zones/{uuid}/separate")
async def separate_stereo_pair(uuid: str) -> dict:
    try:
        await commands().separate_stereo_pair(uuid)
    except KeyError:
        raise HTTPException(404, f"unknown zone {uuid}") from None
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"ok": True}


@app.get("/api/players/{uuid}/details")
async def player_details(uuid: str) -> dict:
    """One product's lines for View System Details: model, color, serial,
    Max Volume and version, read from the player itself."""
    found = await controller().player_details(uuid)
    if found is None:
        raise HTTPException(404, f"unknown player {uuid}")
    return _with_color(found)


def _with_color(found: dict) -> dict:
    """The details with the product's picture, and for a player that names
    no color, the colors its model came in and the one chosen for it.

    ``color_source`` says where ``color`` came from: "player" when it named
    its own, "model" when the model was only ever sold in one, "chosen"
    when someone picked it, and "" for Unknown. Only a player that names
    none, of a model sold in several, gets ``colors`` for the dialog's
    picker, with ``color_choice`` the key picked, empty for Unknown. Unknown
    draws the black picture where there is one."""
    reported = found.get("color") or ""
    model = found.get("model_number") or ""
    only = "" if reported else sole_color(model)
    colors = [] if reported or only else colors_for(model)
    choices: ColorChoices | None = state.get("colors")
    choice = ""
    if colors and choices is not None:
        choice = choices.get(found["uuid"])
        if choice not in colors:
            choice = ""
    found["color_reported"] = bool(reported)
    found["color_source"] = ("player" if reported else "model" if only
                             else "chosen" if choice else "")
    found["colors"] = [{"key": k, "name": color_name(k, model)} for k in colors]
    found["color_choice"] = choice
    if only or choice:
        found["color"] = color_name(only or choice, model)
    name = (picture_for(model, reported) if reported
            else picture_for(model, chosen=only or choice))
    found["picture"] = f"/api/products/{name}" if name else ""
    return found


class PlayerColorBody(BaseModel):
    #: A key from the details' ``colors``; empty goes back to Unknown.
    color: str = ""


@app.post("/api/players/{uuid}/color")
async def set_player_color(uuid: str, body: PlayerColorBody) -> dict:
    """Say what color a player is, for one that does not say so itself.
    Kept by Sonora alone; nothing is written to the player."""
    ctl = controller()
    _, player = ctl.player_record(uuid)
    if player is None:
        raise HTTPException(404, f"unknown player {uuid}")
    color = body.color.strip().lower()
    if color and color not in colors_for(player.model_number):
        raise HTTPException(422, f"{player.model_number} has no color {body.color!r}")
    choices: ColorChoices = state["colors"]
    choices.set(uuid, color)
    return await player_details(uuid)


@app.get("/api/products/{name}")
async def product_picture(name: str) -> Response:
    """A product's render as play.sonos.com draws it, kept on disk after
    its first fetch. The name carries the picture's hash, so a copy never
    goes stale and the browser may keep it as long as it likes."""
    pictures: ProductPictures | None = state.get("products")
    if pictures is None or not pictures.knows(name):
        raise HTTPException(404, "no such picture")
    body = await pictures.picture(name)
    if body is None:
        raise HTTPException(502, "picture unavailable")
    return Response(body, media_type="image/png",
                    headers={"cache-control": "public, max-age=31536000, immutable"})


#: Each model's own product icon, by model number, once fetched. The players
#: serve it at /img/icon-<model>.png (48px, the device description's iconList).
_PLAYER_ICONS: dict[str, bytes] = {}


@app.get("/api/players/{uuid}/icon")
async def player_icon(uuid: str) -> Response:
    """The picture the player serves of itself, through Sonora, as every
    picture the page shows comes."""
    ctl = controller()
    _, player = ctl.player_record(uuid)
    if player is None or not player.model_number:
        raise HTTPException(404, "no icon")
    body = _PLAYER_ICONS.get(player.model_number)
    if body is None:
        try:
            async with ctl.session.get(
                    f"http://{player.host}:1400/img/icon-{player.model_number}.png",
                    timeout=aiohttp.ClientTimeout(total=4)) as resp:
                if resp.status != 200:
                    raise HTTPException(404, "no icon")
                body = await resp.read()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(502, f"icon unavailable: {exc}") from exc
        _PLAYER_ICONS[player.model_number] = body
    return Response(body, media_type="image/png",
                    headers={"cache-control": "public, max-age=86400"})


@app.get("/api/zones/{uuid}/settings")
async def room_settings(uuid: str) -> dict:
    """A room's extra settings: home-theater EQ types, line-in, autoplay."""
    try:
        return await commands().room_settings(uuid)
    except KeyError:
        raise HTTPException(404, f"unknown zone {uuid}") from None


class RoomSettingsBody(BaseModel):
    eq: dict[str, int] | None = None
    #: The line-in source level, 1 to 10 as the apps offer it; the speaker
    #: refuses anything past 10 with UPnP 402 (a Connect:Amp, measured
    #: 2026-09-30).
    line_in_level: int | None = Field(default=None, ge=1, le=10)
    line_in_name: str | None = None
    autoplay_room: str | None = None
    autoplay_linked: bool | None = None
    autoplay_use_volume: bool | None = None
    autoplay_volume: int | None = Field(default=None, ge=0, le=100)
    #: The room's name, its status light and its button lock, which a
    #: second handler on this same path had carried: the first one
    #: registered answers every POST, so those three had been dropped
    #: without a word (found on the test list).
    name: str | None = None
    status_light: bool | None = None
    button_lock: bool | None = None


@app.post("/api/zones/{uuid}/settings")
async def set_room_settings(uuid: str, body: RoomSettingsBody) -> dict:
    cmd = commands()
    try:
        for eq_type, value in (body.eq or {}).items():
            await cmd.set_eq(uuid, eq_type, value)
        if body.line_in_level is not None or body.line_in_name is not None:
            await cmd.set_line_in(uuid, body.line_in_level, body.line_in_name)
        if any(v is not None for v in (body.autoplay_room, body.autoplay_linked, body.autoplay_use_volume, body.autoplay_volume)):
            await cmd.set_autoplay(uuid, body.autoplay_room, body.autoplay_linked, body.autoplay_use_volume, body.autoplay_volume)
        if body.name:
            await cmd.rename_zone(uuid, body.name)
        if body.status_light is not None:
            await cmd.set_status_light(uuid, body.status_light)
        if body.button_lock is not None:
            await cmd.set_button_lock(uuid, body.button_lock)
    except KeyError:
        raise HTTPException(404, f"unknown zone {uuid}") from None
    except ValueError as exc:
        raise HTTPException(400, f"unknown setting {exc}") from exc
    return await cmd.room_settings(uuid)


class SeekBody(BaseModel):
    position: str | None = None
    track: int | None = None


@app.post("/api/zones/{uuid}/seek")
async def seek(uuid: str, body: SeekBody) -> dict:
    cmd = commands()
    if body.track is not None:
        await cmd.seek_track(uuid, body.track)
    elif body.position:
        await cmd.seek_time(uuid, body.position)
    else:
        raise HTTPException(400, "provide position or track")
    return {"ok": True}


class PlayModeBody(BaseModel):
    mode: str


@app.post("/api/zones/{uuid}/playmode")
async def set_play_mode(uuid: str, body: PlayModeBody) -> dict:
    try:
        await commands().set_play_mode(uuid, body.mode)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True}


class ToneBody(BaseModel):
    bass: int | None = Field(default=None, ge=-10, le=10)
    treble: int | None = Field(default=None, ge=-10, le=10)
    loudness: bool | None = None
    balance: int | None = Field(default=None, ge=-100, le=100)


@app.post("/api/zones/{uuid}/tone")
async def set_tone(uuid: str, body: ToneBody) -> dict:
    cmd = commands()
    if body.bass is not None:
        await cmd.set_bass(uuid, body.bass)
    if body.treble is not None:
        await cmd.set_treble(uuid, body.treble)
    if body.loudness is not None:
        await cmd.set_loudness(uuid, body.loudness)
    if body.balance is not None:
        await cmd.set_balance(uuid, body.balance)
    return {"ok": True}


class GroupBody(BaseModel):
    coordinator: str


@app.post("/api/zones/{uuid}/group")
async def join_group(uuid: str, body: GroupBody) -> dict:
    await commands().join(uuid, body.coordinator)
    return {"ok": True}


class DelegateBody(BaseModel):
    heir: str


@app.post("/api/zones/{uuid}/delegate")
async def delegate_group(uuid: str, body: DelegateBody) -> dict:
    """Pass the group's lead to ``heir``; the room leaves with nothing."""
    await commands().delegate(uuid, body.heir)
    return {"ok": True}


@app.delete("/api/zones/{uuid}/group")
async def leave_group(uuid: str) -> dict:
    await commands().unjoin(uuid)
    return {"ok": True}


# -- content ------------------------------------------------------------------


def _host_for(uuid: str | None) -> str:
    """Pick a speaker to answer a household-wide content query."""
    ctl = controller()
    if uuid:
        # The zone's own player, unless it has just gone quiet: see
        # SonosController.household_host.
        return ctl.household_host(uuid)
    for household in ctl.households.values():
        host = controller().any_host(household)
        if host:
            return host
    raise HTTPException(503, "no speaker available")


@app.get("/api/browse")
async def browse(
    object_id: str = Query(default="A:"),
    zone: str | None = None,
    start: int = 0,
    count: int = Query(default=100, le=500),
    sort: str = "",
) -> dict:
    host = _host_for(zone)
    result = await controller().content.browse(
        host, object_id, start=start, count=count, sort=sort)
    payload = result.as_dict(host)
    if object_id == "FV:2":
        # The Sonos Favorites page: each row carries what the apps derive
        # (its service, whether that is still on the system, its browse id).
        in_use, names, labels = await _favorite_context(zone)
        for raw in payload.get("items", []):
            _favorite_facts(raw, in_use, names, labels)
    return payload


@app.get("/api/queue/{uuid}")
async def queue(uuid: str, start: int = 0,
                count: int = Query(default=200, le=500)) -> dict:
    ctl = controller()
    target = ctl.coordinator_of(uuid)
    result = await ctl.content.queue(target.host, start=start, count=count)
    return result.as_dict(target.host)


def _favorite_facts(raw: dict, in_use: set[int], names: dict[int, str],
                    labels: dict[tuple[int, str], str] | None = None) -> None:
    """Add what the apps derive for a Sonos Favorite: the service it came
    from (the ``sid`` in its URI, else the ``SA_RINCON<n>`` in its DIDL where
    the service id is ``n >> 8``), whether that service is still on the
    system, and for a container its provider id and account so it can be
    browsed into. TuneIn (254) and the queue/library need no account."""
    uri = raw.get("uri") or ""
    meta = raw.get("metadata") or ""
    sid = None
    m = re.search(r"[?&]sid=(\d+)", uri)
    if m:
        sid = int(m.group(1))
    else:
        m = re.search(r"SA_RINCON(\d+)", meta)
        if m:
            sid = int(m.group(1)) >> 8
    m = re.search(r"[?&]sn=(\d+)", uri)
    raw["service_id"] = sid
    raw["service_name"] = names.get(sid, "") if sid is not None else ""
    raw["account"] = m.group(1) if m else ""
    # The app names the account in "Add to Spotify (Sam's Spotify) Playlist".
    raw["service_label"] = (labels or {}).get((sid, raw["account"]), (labels or {}).get((sid, ""), raw["service_name"]))
    # TuneIn plays without an account, so its favorites stay playable when it
    # is not in the service list -- except one saved under a signed-in
    # account, whose DIDL names that account's token (SA_RINCON65031_
    # X_#Svc65031-0-Token). The apps gray that one out when no such account
    # is on the system (102.7 KIIS FM beside plain TuneIn stations, in the
    # S1 Mac app, 2026-09-23); the same holds for any service.
    token_bound = re.search(r"X_#Svc\d+-\d+-Token", meta) is not None
    raw["available"] = sid is None or sid in in_use or (sid == 254 and not token_bound)
    raw["opens"] = _opens_at(uri, meta)
    raw["browse_id"] = ""
    if uri.startswith("x-rincon-cpcontainer:"):
        ident = uri[len("x-rincon-cpcontainer:"):].split("?", 1)[0]
        from urllib.parse import unquote
        raw["browse_id"] = unquote(ident[8:]) if len(ident) > 8 else ""


def _opens_at(uri: str, metadata: str = "") -> dict:
    """Where a home tile leads when it is opened rather than played.

    The web client opens what a tile names instead of starting it: clicking a
    Recently Played album took the page to that album, with nothing playing
    (measured on play.sonos.com 2026-09-19). To follow it a tile needs the
    page behind its URI, which the URI itself carries -- a container id for an
    album or playlist, a media id for a station or a track, a share path for
    something on the music library.

    ``{"kind": "", ...}`` for a URI none of that fits (a line-in, a raw
    stream, the queue), and the caller falls back to playing it, which is
    better than a tile that does nothing.
    """
    uri = uri or ""

    def service(found: int) -> int:
        """The sid, from the URI or -- Spotify's containers name none there --
        from the ``SA_RINCON<type>`` its DIDL carries, whose high bits are it."""
        if found:
            return found
        match = re.search(r"SA_RINCON(\d+)", metadata or "")
        return int(match.group(1)) >> 8 if match else 0

    sid, container = smapi_container_ref(uri)
    if container:
        return {"kind": "service-list", "sid": service(sid), "item": container,
                "account": smapi_account_serial(uri)}
    sid, media = smapi_media_ref(uri)
    if media:
        return {"kind": "service-leaf", "sid": service(sid), "item": media,
                "account": smapi_account_serial(uri)}
    # The household's own music share: x-rincon-playlist names a browse path
    # on the speakers (A:ALBUM/..., A:ARTIST/...), which is what the library
    # page walks.
    if uri.startswith("x-rincon-playlist:"):
        _, _, rest = uri.partition("#")
        if rest:
            return {"kind": "library", "sid": 0, "item": unquote(rest), "account": ""}
    return {"kind": "", "sid": smapi_sid(uri), "item": "", "account": ""}


async def _favorite_context(zone: str | None) -> tuple[set[int], dict[int, str], dict[tuple[int, str], str]]:
    """Which services the household has, and their names, for favorites.

    Presence comes from the same answer the Services page shows (cloud
    registrations when signed in, else the speakers' inference), so a
    favorite grays out exactly when its service is missing from that list.
    The local inference alone would count every favorite's own service as
    present, since it reads the favorites to infer usage.
    """
    ctl = controller()
    household = ctl.household_of(zone) if zone else next(iter(ctl.ordered_households()), None)
    in_use: set[int] = set()
    names: dict[int, str] = {}
    labels: dict[tuple[int, str], str] = {}
    if household is None:
        return in_use, names, labels
    try:
        # The cached catalog: this runs for every read of the favorites, and
        # the list it wants is the same one a browse reads.
        directory = await ctl.service_directory(household)
        names = {svc.id: svc.name for svc in directory.services}
        listed = await services(zone)
        entry = next((h for h in listed["households"] if h["household"] == household.id), None)
        # The app writes the account into "Add to Spotify (Sam's Spotify)
        # Playlist". A favorite names its account only by the speaker's
        # serial (``sn``), which the registration list does not carry, so the
        # nickname is used when the service has a single account and the
        # plain service name when it has several.
        per_sid: dict[int, list[dict]] = {}
        for e in (entry or {}).get("in_use", []):
            if e.get("id") is None:
                continue
            in_use.add(e["id"])
            per_sid.setdefault(e["id"], []).append(e)
        for sid, entries in per_sid.items():
            name = entries[0].get("name") or names.get(sid, "")
            nick = entries[0].get("nickname") or "" if len(entries) == 1 else ""
            label = f"{name} ({nick})" if nick else name
            for e in entries:
                labels[(sid, str(e.get("account_id") or ""))] = label
            labels[(sid, "")] = label
    except Exception as exc:
        log.info("service directory unavailable for favorites: %s", exc)
    return in_use, names, labels


# Account serials for services the registration list does not carry.
#
# A playback URI names the account by its serial number on the speakers
# (``sn=``). For an account service that number comes from the household's
# registration list. An account-less service -- 80s80s, SomaFM, Audacy, Sonos
# Radio -- has no registration, yet the speakers still hold a serial for it,
# and without one its items browse but cannot be played (every
# 80s80s station came back with no URI, so no play actions and no
# double-click). The number is not readable anywhere directly: /status/accounts
# is empty on both firmware trains. It is however written into every URI the
# household already holds, so it is read back out of the household's own Sonos
# Favorites, and TuneIn's own "0" stands in when nothing names the service.
_HOUSEHOLD_SERIALS: dict[str, tuple[float, dict[int, str]]] = {}
_SERIALS_TTL = 300.0


async def _household_serials(zone: str | None) -> dict[int, str]:
    """``sid`` to ``sn`` as the household's saved content spells them."""
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None:
        return {}
    cached = _HOUSEHOLD_SERIALS.get(household.id)
    if cached is not None and (time.monotonic() - cached[0]) < _SERIALS_TTL:
        return cached[1]
    found: dict[int, str] = {}
    try:
        host = controller().any_host(household)
        if host is not None:
            saved = list(await ctl.content.favorites(host))
            try:
                saved += list(await ctl.content.radio_favorites(host))
            except Exception:
                pass
            for item in saved:
                uri = getattr(item, "uri", "") or ""
                sid = re.search(r"[?&]sid=(\d+)", uri)
                sn = re.search(r"[?&]sn=(\d+)", uri)
                if sid and sn:
                    found.setdefault(int(sid.group(1)), sn.group(1))
    except Exception as exc:
        log.info("could not read account serials from saved content: %s", exc)
    _HOUSEHOLD_SERIALS[household.id] = (time.monotonic(), found)
    return found


#: Services whose rating property is not in getExtendedMetadata either
#: (Pandora's comes from the speakers' r:rating); see playing_item_metadata.
_RATING_NOT_EXTENDED: set[int] = set()


@app.get("/api/zones/{uuid}/item-metadata")
async def playing_item_metadata(uuid: str) -> dict:
    """What the service says about the item a room is playing.

    The apps' Now Playing labels come from the provider, not from the DIDL
    the speaker holds: a Pocket Casts episode's queue entry carries an empty
    artist and album while the app prints "Podcast" and "Release Date"
    (measured 2026-09-06). Asking the service for the item is the only way to
    get those, so this returns the provider's own view of it.
    """
    ctl = controller()
    try:
        zone = ctl.coordinator_of(uuid)
    except KeyError:
        raise HTTPException(404, f"unknown zone {uuid}") from None
    transport = zone.transport
    empty = {"item_type": "", "semantic_type": "", "title": "", "artist": "",
             "album": "", "podcast": "", "release_date": "", "summary": ""}
    sid = transport.service_id
    item_id = _smapi_item_id(transport.track_uri or "")
    if not sid or not item_id:
        log.info("item-metadata: no sid/item (%s, %r)", sid, item_id)
        return empty
    household = ctl.household_of(zone.uuid)
    if household is None:
        log.info("item-metadata: no household for %s", zone.uuid)
        return empty
    service = await _cached_service(ctl, household, sid)
    if service is None:
        log.info("item-metadata: sid %s not in catalog", sid)
        return empty
    account = smapi_account_serial(transport.track_uri or "")
    creds, borrowed = _reading_creds(ctl, household, sid, account)
    if service.auth != "Anonymous" and not creds.get("token"):
        log.info("item-metadata: no token for %s (auth %s)", service.name, service.auth)
        return empty
    try:
        item = await ctl.smapi.get_media_metadata(
            endpoint=service.endpoint, service_name=service.name,
            item_id=item_id, household_id=household.id,
            token=creds.get("token", ""), key=creds.get("key", ""),
            device_id=await ctl.device_serial(household))
    except Exception as exc:
        log.info("no provider metadata for %s: %s", service.name, exc)
        return empty
    if item is None:
        return empty
    out = {"item_type": item.item_type, "semantic_type": item.semantic_type,
           "title": item.title, "artist": item.artist, "album": item.album,
           "podcast": item.podcast, "release_date": item.release_date,
           "summary": item.summary, "art": item.art, "author": item.author,
           "narrator": item.narrator, "book": item.book, "menu": [], "related": [], "text": "",
           "text_label": "", "item_id": item_id, "ratings": [],
           "properties": dict(item.properties or {})}
    # The rating buttons Now Playing draws, which are the service's own: its
    # NowPlayingRatings map matches a property of the playing item and names
    # the buttons for that value, each with the icon to draw, the rating id to
    # send and the message to show afterwards. Amazon Music's heart is this
    # (2026-09-07); Pandora's thumbs are the same mechanism.
    try:
        rating_map = await ctl.presentation.ratings(service.manifest_uri)
        prop = rating_map.get("propname") or ""
        value = (item.properties or {}).get(prop, "")
        if prop and value == "" and sid not in _RATING_NOT_EXTENDED:
            # Spotify's isHearted comes only with getExtendedMetadata: its
            # getMediaMetadata answer has no <dynamic> block at all, and the
            # extended one carries isHearted 0 or 1 (measured 2026-09-23, the
            # heart play.sonos.com draws in its bar). A service that gives it
            # neither way is not asked twice.
            try:
                richer = await ctl.smapi.get_extended_metadata_item(
                    endpoint=service.endpoint, service_name=service.name,
                    item_id=item_id, household_id=household.id,
                    token=creds.get("token", ""), key=creds.get("key", ""),
                    device_id=await ctl.device_serial(household))
            except Exception:
                richer = None
            value = ((richer.properties if richer else None) or {}).get(prop, "")
            if value != "":
                out["properties"].update(richer.properties)
            else:
                _RATING_NOT_EXTENDED.add(sid)
        if value == "":
            # A service need not return the property with the item: Pandora
            # does not, and its map instead names each set of buttons by the
            # rating word the speakers themselves publish for the playing
            # track (NONE, THUMBSUP, THUMBSDOWN in r:rating). Where the map
            # gives those words, the speaker's own report picks the set.
            reported = ctl.zones[uuid].transport.rating if uuid in ctl.zones else 0
            word = {1: "THUMBSUP", 2: "THUMBSDOWN"}.get(reported, "NONE")
            value = (rating_map.get("kinds") or {}).get(word, "")
        if prop and value != "":
            out["ratings"] = [
                {"id": b["id"], "icon": b["icon"], "label": b["label"],
                 "message": b["message"], "skip": b.get("auto_skip", ""),
                 # Lit, and pressing it would only give the rating again: the
                 # service has no way to undo it (see rating_is_inert).
                 "inert": rating_is_inert(b, rating_map),
                 # What a toggle looks like once pressed, drawn at the press.
                 "toggled_icon": rating_toggled_icon(b, rating_map)}
                for b in (rating_map.get("matches") or {}).get(value, [])
                if b.get("icon")
            ]
            # The page draws these through /api/art like every other picture,
            # and nothing else vouches for them: they are Sonos-hosted files
            # named by the service's own map, not art any zone reports. Said
            # here rather than per service, since every rating map works this
            # way.
            icons = [u for b in out["ratings"] for u in (b["icon"], b["toggled_icon"]) if u]
            for url in icons:
                ctl.remember_picture(url)
            # Fetched into the art cache before the buttons go out, so the
            # page's first request for an icon is answered from memory. Left to
            # the page, the first fetch from Sonos' server took long enough to
            # show an empty button (a black square in Hot Dog Stand) until the
            # picture arrived. Bounded: a slow server costs a second at most.
            try:
                # Shielded, so a fetch still running at the deadline finishes
                # into the cache rather than being cancelled.
                await asyncio.wait_for(asyncio.shield(
                    asyncio.gather(*(ctl.art_cache.get(u) for u in icons), return_exceptions=True)), 1.5)
            except asyncio.TimeoutError:
                pass
    except Exception as exc:
        log.info("no rating map for %s: %s", service.name, exc)
    # A heart or thumbs says, and changes, what one account holds: read with
    # another account's login it would show that account's answer and write
    # into its library. Borrowed, the item gets its details and no buttons.
    if borrowed:
        out["ratings"] = []
    out["borrowed"] = borrowed
    # The service's own Info & Options rows, in the same answer so the pane
    # needs one call. Offered only when the provider actually returned
    # extended metadata for this item: Mixcloud returns a related list and a
    # description and the app shows its four rows, while Plex returns neither
    # and the app shows none of its own -- even though Plex's InfoView does
    # declare a "Start Plex Mix" item (inferred from three services,
    # 2026-09-06; Pocket Casts returns nothing either).
    try:
        extended = await service_extended(sid, item_id, zone=uuid, account=account)
    except Exception:
        extended = None
    if extended and (extended.get("related") or extended.get("text") or extended.get("related_play")):
        out.update({k: extended.get(k) for k in
                    ("menu", "related", "text", "text_type", "text_label", "related_play")})
    return out


#: One service's endpoint and auth per household, so asking the provider about
#: the playing item does not re-read the whole catalog every time the track
#: changes. ListAvailableServices plus its in-use probes is an expensive call
#: against a speaker, and doing it per track pushed a player into timing out
#: (2026-09-06).
_SERVICE_CACHE: dict[tuple[str, int], tuple[float, object]] = {}
_SERVICE_TTL = 600.0


async def _cached_service(ctl, household, sid: int):
    key = (household.id, sid)
    hit = _SERVICE_CACHE.get(key)
    if hit is not None and (time.monotonic() - hit[0]) < _SERVICE_TTL:
        return hit[1]
    directory = await ctl.service_directory(household)
    for svc in directory.services:
        _SERVICE_CACHE[(household.id, svc.id)] = (time.monotonic(), svc)
    return directory.by_id(sid)


class FavoriteBody(BaseModel):
    item: str
    favorite: bool = True
    zone: str | None = None
    #: The account the item came from (its URI's sn=); with two of the
    #: service on the system the first one answered otherwise.
    account: str = ""


@app.post("/api/services/{sid}/favorite")
async def service_favorite(sid: int, body: FavoriteBody) -> dict:
    """The service's own Favorite / Unfavorite, as its Info & Options row."""
    ctl = controller()
    household = (ctl.household_of(body.zone) if body.zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None or not body.item:
        raise HTTPException(404, "unknown household or item")
    service = await _cached_service(ctl, household, sid)
    if service is None:
        raise HTTPException(404, f"service {sid} not in this household")
    # A write, so the named account's own login or none: saving to "Your
    # Music" with another account's login would save it to theirs.
    account = _item_account(ctl, household, sid, body.account)
    creds = ((ctl.credentials_for(household.id, sid, account) or {}) if account
             else _account_creds(ctl, household, sid, ""))
    if service.auth != "Anonymous" and not creds.get("token"):
        raise HTTPException(409, f"{service.name} is not linked in Sonora.")
    try:
        await ctl.smapi.set_favorite(
            endpoint=service.endpoint, service_name=service.name,
            item_id=body.item, favorite=body.favorite,
            household_id=household.id, token=creds.get("token", ""),
            key=creds.get("key", ""),
            device_id=await ctl.device_serial(household))
    except Exception as exc:
        raise HTTPException(502, f"{service.name} refused: {exc}") from None
    return {"ok": True, "favorite": body.favorite}


def _account_creds(ctl, household, sid: int, account: str = "") -> dict:
    """The login for one of the service's accounts, else its only one."""
    return ((ctl.credentials_for(household.id, sid, account) if account else None)
            or ctl.credentials_for(household.id, sid, "", single_account=True) or {})


def _item_account(ctl, household, sid: int, account: str) -> str:
    """The household account an item's ``sn=`` stands for.

    Usually the number itself. A Spotify Connect session's track carries a
    serial that is none of the household's accounts -- sn=51 in one room,
    where the speakers list only 22 and 43 (2026-09-29) -- and the
    apps then treat it as the controller's default account for the service:
    the S1 Mac app offered "Add Song to Spotify (Sam's Spotify) Playlist"
    there, and its core keeps a default account per service. Sonora's is the
    reader's choice on the service row's caret, else the first account it
    holds a login for, in the speakers' order, else the first account.
    """
    listed = [serial for serial, _user, _type in _service_accounts(ctl, household, sid)]
    if not account or not listed or account in listed:
        return account
    chosen = _ACCOUNT_CHOICE.get().get(f"{household.id}:{sid}", "")
    if chosen in listed:
        return chosen
    held = ctl.tokens_for_service(household.id, sid)
    for serial in listed:
        if serial in held:
            return serial
    return listed[0]


def _reading_creds(ctl, household, sid: int, account: str = "") -> tuple[dict, bool]:
    """A login to READ what a service says about an item, and whether it is
    another account's.

    The item's own account first (its URI's sn=), then the service's only
    login, then any login the household holds for the service. Reading a
    track's details, its album or its artist does not depend on whose
    account asks: a room played a Spotify Connect track from
    account 51 ("Sam's Spotify"), which Sonora holds no login for, while it
    holds two others of the same household, and Info & Options came up empty.
    A borrowed login is only ever read with -- rating, saving
    and playlist writes go out as the item's own account or not at all.
    """
    account = _item_account(ctl, household, sid, account)
    own = ctl.credentials_for(household.id, sid, account) if account else None
    if own:
        return own, False
    only = ctl.credentials_for(household.id, sid, "", single_account=True)
    if only:
        return only, bool(account)
    held = ctl.tokens_for_service(household.id, sid)
    if held:
        return held[sorted(held)[0]], True
    return {}, False


async def _service_login(sid: int, zone: str | None, account: str, exact: bool = False):
    """The household, the service and the login a service call goes out with.

    ``exact`` for a write: the named account's own login or none. Falling
    back to the service's only login would add a song to someone else's
    playlist when the account asked for is not linked in Sonora.
    """
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None:
        raise HTTPException(404, "unknown household")
    service = await _cached_service(ctl, household, sid)
    if service is None:
        raise HTTPException(404, f"service {sid} not in this household")
    account = _item_account(ctl, household, sid, account)
    creds = ((ctl.credentials_for(household.id, sid, account) or {}) if exact and account
             else _account_creds(ctl, household, sid, account))
    if service.auth != "Anonymous" and not creds.get("token"):
        raise HTTPException(409, f"{service.name} is not linked in Sonora.")
    return ctl, household, service, creds


#: The service's user-playlists container, the one the apps' "Add Song to
#: <service> Playlist" lists (Spotify: Your Library > Playlists, whose id is
#: "playlists"). Found by asking for it; a service without one answers with
#: a fault or with nothing that says readOnly, and gets no row.
_USER_PLAYLISTS = "playlists"
#: Per household, service and account: whether that container is there, so
#: an Info & Options page does not ask the service again each time it opens.
_USER_PLAYLISTS_KNOWN: dict[tuple[str, int, str], tuple[float, bool]] = {}


@app.get("/api/services/{sid}/user-playlists")
async def service_user_playlists(sid: int, zone: str | None = None, account: str = "",
                                 probe: bool = False) -> dict:
    """The account's own playlists on the service, editable ones marked.

    ``probe`` only says whether there are any, and remembers the answer for
    ten minutes.
    """
    ctl, household, service, creds = await _service_login(sid, zone, account)
    known = _USER_PLAYLISTS_KNOWN.get((household.id, sid, account))
    if probe and known is not None and time.monotonic() - known[0] < 600:
        return {"available": known[1], "items": []}
    items: list[dict] = []
    try:
        index = 0
        while True:
            page = await ctl.smapi.get_metadata(
                endpoint=service.endpoint, service_name=service.name,
                item_id=_USER_PLAYLISTS, index=index, count=100,
                household_id=household.id, token=creds.get("token", ""),
                key=creds.get("key", ""), device_id=await ctl.device_serial(household))
            for item in page.items:
                if item.editable is None:
                    continue
                items.append({"id": item.id, "title": item.title, "owner": item.artist,
                              "art": item.art, "editable": bool(item.editable)})
            index += len(page.items)
            if probe or not page.items or index >= (page.total or 0) or index >= 1000:
                break
    except Exception as exc:
        log.info("no user playlists from %s: %s", service.name, exc)
        items = []
    available = bool(items)
    _USER_PLAYLISTS_KNOWN[(household.id, sid, account)] = (time.monotonic(), available)
    return {"available": available, "items": [] if probe else items}


class UserPlaylistBody(BaseModel):
    zone: str | None = None
    account: str = ""
    #: The track to add (the service's own id).
    item: str
    #: The playlist to add it to; empty with ``title`` makes a new one.
    playlist: str = ""
    title: str = ""


@app.post("/api/services/{sid}/user-playlists/add")
async def service_user_playlist_add(sid: int, body: UserPlaylistBody) -> dict:
    """Add a song to one of the account's playlists, or to a new one.

    addToContainer at the end of the playlist, or createContainer seeded
    with the song for the picker's New Playlist. Both change the account's
    library on the service itself.
    """
    if not body.item or not (body.playlist or body.title.strip()):
        raise HTTPException(400, "a song and a playlist or a name are required")
    ctl, household, service, creds = await _service_login(sid, body.zone, body.account, exact=True)
    login = dict(household_id=household.id, token=creds.get("token", ""),
                 key=creds.get("key", ""), device_id=await ctl.device_serial(household))
    try:
        if body.playlist:
            await ctl.smapi.add_to_container(
                endpoint=service.endpoint, service_name=service.name,
                item_id=body.item, parent_id=body.playlist, **login)
            return {"ok": True, "playlist": body.playlist}
        made = await ctl.smapi.create_container(
            endpoint=service.endpoint, service_name=service.name,
            title=body.title.strip(), seed_id=body.item, **login)
        _USER_PLAYLISTS_KNOWN.pop((household.id, sid, body.account), None)
        return {"ok": True, "playlist": made, "created": True}
    except SmapiError as exc:
        raise HTTPException(502, f"{service.name} refused: {exc}") from None


class UserPlaylistRemoveBody(BaseModel):
    zone: str | None = None
    account: str = ""
    playlist: str
    #: The rows to take out, by their place in the playlist.
    indices: list[int]


@app.post("/api/services/{sid}/user-playlists/remove")
async def service_user_playlist_remove(sid: int, body: UserPlaylistRemoveBody) -> dict:
    """Take songs out of one of the account's playlists (removeFromContainer)."""
    if not body.indices:
        raise HTTPException(400, "no rows named")
    ctl, household, service, creds = await _service_login(sid, body.zone, body.account, exact=True)
    try:
        await ctl.smapi.remove_from_container(
            endpoint=service.endpoint, service_name=service.name,
            container_id=body.playlist, indices=body.indices,
            household_id=household.id, token=creds.get("token", ""),
            key=creds.get("key", ""), device_id=await ctl.device_serial(household))
    except SmapiError as exc:
        raise HTTPException(502, f"{service.name} refused: {exc}") from None
    return {"ok": True}


#: Streams the page may fetch through Sonora, keyed by a random name. Only
#: for services that answer getMediaURI with headers a browser cannot send;
#: everything else is played from the service's own URL, direct.
_STREAM_TICKETS: dict[str, dict] = {}
#: Long enough for a listening session, including the reconnects a live
#: stream makes when it stalls.
_STREAM_TICKET_LIFE = 6 * 3600
_STREAM_TICKET_MAX = 64


def _issue_stream_ticket(url: str, headers: dict) -> str:
    now = time.time()
    for key, ticket in list(_STREAM_TICKETS.items()):
        if now - ticket["at"] > _STREAM_TICKET_LIFE:
            del _STREAM_TICKETS[key]
    while len(_STREAM_TICKETS) >= _STREAM_TICKET_MAX:
        del _STREAM_TICKETS[min(_STREAM_TICKETS, key=lambda k: _STREAM_TICKETS[k]["at"])]
    key = secrets.token_urlsafe(18)
    _STREAM_TICKETS[key] = {"url": url, "headers": headers, "at": now}
    return key


#: Radio sessions the page is listening to: a station serves one track at a
#: time, so Sonora keeps the place. Keyed by a random name, dropped when they
#: go quiet.
_RADIO_SESSIONS: dict[str, dict] = {}
_RADIO_SESSION_LIFE = 4 * 3600


async def _service_context(household, service, ctl) -> dict:
    """The SMAPI arguments for one service of one household."""
    creds = ctl.credentials_for(household.id, service.id, "", single_account=True) or {}
    return {"endpoint": service.endpoint, "service_name": service.name,
            "household_id": household.id, "token": creds.get("token", ""),
            "key": creds.get("key", ""), "device_id": await ctl.device_serial(household)}


def _page_playable(url: str) -> str:
    """A service's answer, if it is something a browser could fetch.

    Not every service hands back a stream: Spotify answers getMediaURI with
    ``x-spotify://spotify:track:…``, its own scheme, which only a player with
    Spotify built in can follow (measured 2026-09-10). Taking that for a URL
    left the room showing a track and playing silence.
    """
    url = (url or "").strip()
    return url if url.lower().startswith(("http://", "https://")) else ""


def _track_facts(item) -> dict:
    """What the room shows for the track or station a service is serving."""
    if item.art:
        controller().remember_picture(item.art)
    return {"title": item.title, "artist": item.artist, "album": item.album,
            "art": item.art, "duration": item.duration, "id": item.id,
            # A live station has no artist or album; what a speaker prints on
            # its second line is the show on air, when the service says.
            "show": getattr(item, "stream_show", "") or ""}


async def _radio_track(session: dict) -> dict | None:
    """The next track of a station, resolved to a URL the page can play.

    A station of the ``x-sonosapi-radio:`` kind is not one stream: it hands
    out tracks, and a speaker asks for the next one as each ends. Pandora's
    and AccuRadio's ``getMediaURI`` refuse the station id outright for that
    reason. This walks the station the same way -- ``getMetadata`` for the
    next few tracks, then ``getMediaURI`` on the one at the front.
    """
    ctl = controller()
    if session.get("tracks") is not None:
        return await _album_track(session)
    for _ in range(3):
        if not session["queue"]:
            try:
                page = await ctl.smapi.get_metadata(
                    item_id=session["station"], index=session["index"], count=4,
                    **session["smapi"])
            except Exception as exc:
                log.info("station %s gave no tracks: %s", session["station"], exc)
                return None
            tracks = [i for i in page.items if not i.is_container and i.id]
            if not tracks:
                return None
            session["queue"] = tracks
            # Some services page a station, others hand out a fresh set each
            # time and ignore the index; moving it on suits both.
            session["index"] += len(tracks)
        item = session["queue"].pop(0)
        try:
            answer = await ctl.smapi.get_media_uri(item_id=item.id, **session["smapi"])
        except Exception as exc:
            log.info("no URL for %s: %s", item.id, exc)
            continue
        url = _page_playable(answer.get("url"))
        if not url:
            continue
        session["at"] = time.time()
        headers = answer.get("headers") or {}
        if headers:
            key = _issue_stream_ticket(url, headers)
            return {"url": f"/api/stream/audio/{key}", "upstream": url, "track": _track_facts(item)}
        return {"url": url, "track": _track_facts(item)}
    return None


#: The most tracks of one album or playlist the browser room lists.
_ALBUM_LIMIT = 2000


def _queue_entry(item, position: int) -> dict:
    """A track of the browser room's list, shaped like a speaker's queue item."""
    seconds = int(item.duration or 0)
    # The art goes through Sonora's cache, as a speaker queue's does, so the
    # page never fetches from the service itself.
    art = ""
    if item.art:
        controller().remember_picture(item.art)
        art = "/api/art?u=" + quote(item.art, safe="")
    return {"id": f"BQ:{position}", "title": item.title, "artist": item.artist,
            "album": item.album, "art": art, "kind": "track", "is_container": False,
            "uri": item.id, "track_number": position,
            "duration": f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}" if seconds else ""}


async def _album_track(session: dict) -> dict | None:
    """The next track of an album or playlist, or the one asked for.

    A container is a fixed, ordered list, unlike a station: it is read whole
    when the session opens (``tracks``), so the room can show it as its queue,
    and ``pos`` keeps the place. A track the service will not serve is passed
    over, as a speaker skips one it cannot play.
    """
    ctl = controller()
    while session["pos"] + 1 < len(session["tracks"]):
        session["pos"] += 1
        item = session["tracks"][session["pos"]]
        try:
            answer = await ctl.smapi.get_media_uri(item_id=item.id, **session["smapi"])
        except Exception as exc:
            log.info("no URL for %s: %s", item.id, exc)
            continue
        url = _page_playable(answer.get("url"))
        if not url:
            continue
        session["at"] = time.time()
        session["playing"] = True
        headers = answer.get("headers") or {}
        found = {"track": _track_facts(item), "index": session["pos"]}
        if headers:
            key = _issue_stream_ticket(url, headers)
            return {"url": f"/api/stream/audio/{key}", "upstream": url, **found}
        return {"url": url, **found}
    return None


async def _album_tracks(session: dict) -> list:
    """Every track of a container, read a page at a time."""
    ctl = controller()
    tracks, index = [], 0
    while len(tracks) < _ALBUM_LIMIT:
        page = await ctl.smapi.get_metadata(item_id=session["station"], index=index,
                                            count=100, **session["smapi"])
        if not page.items:
            break
        tracks += [i for i in page.items if not i.is_container and i.id]
        index += len(page.items)
        if page.total and index >= page.total:
            break
    return tracks


async def _radio_session(uri: str, household, service, context: dict, station: str,
                         container: bool = False, start: str = "") -> dict | None:
    """Open a listening session on a station and resolve its first track.

    An album or a playlist (``container``) is read whole first, and the answer
    carries its list as ``queue``: the browser room shows it as a speaker
    shows its queue, where a station, which never ends, has none (Plex's
    Guardians of the Zone played a track at a time under an empty queue).
    """
    _sweep_radio_sessions()
    session = {"station": station, "smapi": context, "queue": [], "index": 0,
               "service": service.name, "household": household.id,
               "uri": uri, "at": time.time()}
    if container:
        try:
            session["tracks"], session["pos"] = await _album_tracks(session), -1
        except Exception as exc:
            log.info("could not list %s: %s", station, exc)
            session.pop("tracks", None)
        if session.get("tracks") == []:
            session.pop("tracks")
        elif start and session.get("tracks"):
            at = next((n for n, t in enumerate(session["tracks"]) if t.id == start), None)
            if at is not None:
                session["pos"] = at - 1
    first = await _radio_track(session)
    if first is None:
        return None
    key = secrets.token_urlsafe(18)
    _RADIO_SESSIONS[key] = session
    listing = ({"queue": [_queue_entry(t, n + 1) for n, t in enumerate(session["tracks"])]}
               if session.get("tracks") is not None else {})
    return {**first, **listing, "reason": "", "service": service.name, "session": key}


def _sweep_radio_sessions() -> None:
    now = time.time()
    for key, session in list(_RADIO_SESSIONS.items()):
        if now - session["at"] > _RADIO_SESSION_LIFE:
            del _RADIO_SESSIONS[key]


async def _service_stream(uri: str, zone: str | None, start: str = "") -> dict | None:
    """Ask the service itself for a URL the page can play.

    A speaker handed ``x-sonosapi-stream:s34635?sid=254`` calls the service's
    ``getMediaURI`` with the household's own credentials and plays what comes
    back. Sonora makes the same call, with the same credentials it browses
    with, so the browser room can play a station or a track and not only a
    plain radio URL.
    """
    ctl = controller()
    sid, item = smapi_media_ref(uri)
    # An album, a playlist or an audiobook: one item to the speakers, an
    # ordered list of tracks to the service. It is walked like a station.
    container, (csid, cid) = False, smapi_container_ref(uri)
    if not sid and csid:
        sid, item, container = csid, cid, True
    if not sid or not item:
        # Nothing here to ask the service for -- Spotify's own scheme, say,
        # which only a player with Spotify inside it can follow. Name the
        # service anyway: the refusal is the service's, not Sonora's.
        named = smapi_sid(uri)
        if named and zone:
            household = ctl.household_of(zone)
            service = await _cached_service(ctl, household, named) if household else None
            if service is not None:
                return {"url": "", "reason": "service-refused", "service": service.name}
        return None
    household = (ctl.household_of(zone) if zone else None)
    if household is None:
        household = next(iter(ctl.ordered_households()), None)
    if household is None:
        return None
    service = await _cached_service(ctl, household, sid)
    if service is None:
        return None
    creds = ctl.credentials_for(household.id, sid, "", single_account=True) or {}
    if service.auth != "Anonymous" and not creds.get("token"):
        # Sonora browses this service through the speakers' own login; without
        # a token of its own it cannot ask the service directly.
        return {"url": "", "reason": "needs-link", "service": service.name}
    context = await _service_context(household, service, ctl)
    if container:
        walked = await _radio_session(uri, household, service, context, item, container=True, start=start)
        return walked if walked is not None else {
            "url": "", "reason": "service-refused", "service": service.name}
    try:
        answer = await ctl.smapi.get_media_uri(item_id=item, **context)
    except Exception as exc:
        # A station of the track-serving kind refuses its own id here
        # (Pandora: "reading 'isRadio'"; AccuRadio: a TypeError of its own),
        # because there is no single stream to hand over. Walk it instead.
        log.info("no stream URL from %s for %s: %s", service.name, item, exc)
        answer = {"url": "", "headers": {}}
    url = _page_playable(answer.get("url"))
    if not url:
        walked = await _radio_session(uri, household, service, context, item)
        if walked is not None:
            return walked
        # The service was asked and would not answer. Sonos Radio's own
        # stations do this: an empty getMediaURIResponse and a nil
        # getMetadata, no fault, nothing to work with (2026-09-10).
        return {"url": "", "reason": "service-refused", "service": service.name}
    # What the station is, as well as where it plays from. Without this the
    # browser room had nothing to show: no art at all, and the stream's
    # hostname standing in for the second line, where a speaker shows the
    # station's name and its logo. The speakers get this
    # from the same call.
    facts = await _stream_facts(item, service, context)
    headers = answer.get("headers") or {}
    if headers:
        # The page cannot send an Authorization header on a media element, so
        # Sonora fetches it and passes the bytes through.
        key = _issue_stream_ticket(url, headers)
        return {"url": f"/api/stream/audio/{key}", "reason": "", "upstream": url,
                "service": service.name, **facts}
    return {"url": url, "reason": "", "service": service.name, **facts}


async def _stream_facts(item: str, service, context: dict) -> dict:
    """The service's own word on a station: its name, its logo, its show.

    Best effort. A station that will not describe itself still plays; the room
    then shows what it always did, which is the little the URI carries.
    """
    try:
        found = await controller().smapi.get_media_metadata(item_id=item, **context)
    except Exception as exc:
        log.info("no metadata from %s for %s: %s", service.name, item, exc)
        return {}
    return {"track": _track_facts(found)} if found is not None else {}


async def _followed(url: str, depth: int = 2) -> dict:
    """The URL the page should actually load.

    A station is often published as a playlist -- TuneIn's getMediaURI answers
    with an M3U of the station's streams -- and a media element will not
    follow one, so Sonora reads it and takes the first stream. Everything else
    is handed back untouched, the connection dropped as soon as the headers
    have been read.
    """
    session = state["outward"]
    seen = url
    for _ in range(depth):
        # Checked every time round: a redirect is a second URL, chosen by
        # whoever answered the first one.
        if not fetchguard.safe_to_fetch(seen):
            fetchguard.refuse(seen, "not a place Sonora fetches from")
            return {"url": "", "reason": "unknown"}
        try:
            async with session.get(seen, headers={"Range": "bytes=0-8191", "Icy-MetaData": "1"},
                                   timeout=aiohttp.ClientTimeout(total=20)) as answer:
                kind = answer.headers.get("Content-Type", "")
                if not localplay.looks_like_playlist(kind, str(answer.url)):
                    # A stream that carries its own titles says so here; the
                    # page cannot read them, so Sonora will (see stream_audio).
                    icy_on = bool(answer.headers.get("icy-metaint"))
                    return {"url": seen, "reason": "", **({"icy": True} if icy_on else {})}
                body = (await answer.content.read(8192)).decode("utf-8", "replace")
        except Exception as exc:
            log.info("could not read %s as a playlist: %s", seen, exc)
            return {"url": seen, "reason": ""}
        found = localplay.playlist_streams(body)
        if found["hls"] and localplay.hls_is_protected(body):
            return {"url": "", "reason": "protected"}
        if found["hls"]:
            # A manifest, not a list of streams: the page plays it with hls.js
            # (Firefox has no HLS of its own), so it goes back as it is.
            return {"url": seen, "reason": "", "hls": True}
        if not found["urls"]:
            return {"url": seen, "reason": ""}
        if len(found["urls"]) > 1:
            # A pre-roll and then the station, or several mirrors of it: the
            # page plays them in turn, as a speaker does. The first is looked
            # at first, though: Sonos Radio's BBC stations list four mirrors,
            # each a redirect to an HLS manifest, and handed over as plain
            # audio they played nothing at all.
            if depth > 1:
                head = await _followed(found["urls"][0], depth - 1)
                if head.get("hls") or head.get("reason") == "protected":
                    return head
            return {"url": found["urls"][0], "urls": found["urls"], "reason": ""}
        seen = found["urls"][0]
    return {"url": seen, "reason": ""}


@app.get("/api/stream")
async def stream_for_browser(uri: str, zone: str | None = None, start: str = "") -> dict:
    """A URL the page can play for a Sonos URI, or why there is not one.

    This is what the "This browser" room plays from. Internet radio is a plain
    URL behind a scheme prefix and needs nothing else; a service's station or
    track is resolved with the household's own credentials through the
    service's ``getMediaURI``, the same call a speaker makes. What is left --
    a music library file, a whole album or playlist, a queue, line-in, TV --
    needs the speaker itself, and says so.

    ``zone`` names the room the listing was browsed through, which is how the
    household (and so the service login) is known. ``start`` names a track of
    an album or playlist to begin at (by its service id, which survives the
    list being edited): the page's way back to where it was after a reload.
    """
    answer = localplay.browser_url(uri)
    # A container gets the same chance as a track: the service can list what
    # is inside it, even though the speakers treat it as one thing.
    if not answer["url"] and answer["reason"] in ("needs-speaker", "needs-queue"):
        resolved = await _service_stream(uri, zone, start)
        if resolved is not None:
            answer = resolved
    # Whatever the source, what goes to the page has to be audio and not a
    # list of places to find it. A proxied stream is followed at the proxy.
    if answer["url"] and not answer.get("upstream"):
        answer = {**answer, **await _followed(answer["url"])}
    answer = _through_sonora_if_titled(answer)
    host = localplay.stream_host(answer.get("upstream") or answer["url"])
    return {**answer, "host": host}


@app.get("/api/stream/next")
async def stream_next(session: str) -> dict:
    """The next track of a station the browser room is listening to.

    A speaker asks the service for the next track as each one ends; the page
    does the same through this, so a station keeps playing rather than
    stopping after one song.
    """
    held = _RADIO_SESSIONS.get(session)
    if held is None:
        raise HTTPException(404, "that station is no longer playing here")
    answer = await _radio_track(held)
    if answer is None:
        return {"url": "", "reason": "ended", "session": session}
    if answer["url"] and not answer.get("upstream"):
        answer = {**answer, **await _followed(answer["url"])}
    answer = _through_sonora_if_titled(answer)
    return {**answer, "reason": "", "session": session,
            "host": localplay.stream_host(answer.get("upstream") or answer["url"])}


@app.get("/api/stream/jump")
async def stream_jump(session: str, index: int) -> dict:
    """Play one track of the album or playlist the browser room is playing.

    ``index`` counts from 0 in the list the session answered with. What a
    speaker's queue does on a double-click, and what Previous does here.
    """
    held = _RADIO_SESSIONS.get(session)
    if held is None or held.get("tracks") is None:
        raise HTTPException(404, "that album is no longer playing here")
    if not 0 <= index < len(held["tracks"]):
        raise HTTPException(400, "no such track")
    held["pos"] = index - 1
    answer = await _album_track(held)
    if answer is None:
        return {"url": "", "reason": "ended", "session": session}
    if answer["url"] and not answer.get("upstream"):
        answer = {**answer, **await _followed(answer["url"])}
    answer = _through_sonora_if_titled(answer)
    return {**answer, "reason": "", "session": session,
            "host": localplay.stream_host(answer.get("upstream") or answer["url"])}


class BrowserQueueEdit(BaseModel):
    #: remove | move | clear
    action: str
    #: remove: the track's place, from 0.
    index: int = 0
    #: move: the first track's place and how many, and the place they go
    #: before, all from 0 and counted in the list as it was.
    start: int = 0
    count: int = 1
    insert_before: int = 0


def _album_listing(session: dict) -> dict:
    """The session's list as the page holds it, and where the room is in it.

    ``playing`` is False once the track playing has been taken out of the
    list: it plays on, nothing is marked, and Next goes to what followed it.
    """
    return {"queue": [_queue_entry(t, n + 1) for n, t in enumerate(session["tracks"])],
            "index": session["pos"], "playing": session.get("playing", True)}


@app.post("/api/stream/{session}/queue")
async def stream_queue_edit(session: str, body: BrowserQueueEdit) -> dict:
    """Remove, move, or clear tracks of the album the browser room plays.

    The same edits a speaker's queue takes, applied to the session's own list
    so that Next and a double-click go where the list now says. The place of
    the playing track moves with it.
    """
    held = _RADIO_SESSIONS.get(session)
    if held is None or held.get("tracks") is None:
        raise HTTPException(404, "that album is no longer playing here")
    tracks, pos = held["tracks"], held["pos"]
    playing = held.get("playing", True)
    if body.action == "clear":
        held["tracks"], held["pos"], held["playing"] = [], -1, False
    elif body.action == "remove":
        if not 0 <= body.index < len(tracks):
            raise HTTPException(400, "no such track")
        del tracks[body.index]
        if body.index < pos:
            pos -= 1
        elif body.index == pos and playing:
            # The playing track leaves the list but keeps playing; Next
            # goes on to what followed it, now at this same place.
            pos, playing = body.index - 1, False
        held["pos"], held["playing"] = pos, playing
    elif body.action == "move":
        start, count = body.start, max(1, body.count)
        if not (0 <= start < len(tracks) and 0 <= body.insert_before <= len(tracks)):
            raise HTTPException(400, "no such track")
        moving = tracks[start:start + count]
        playing_track = tracks[pos] if 0 <= pos < len(tracks) else None
        rest = tracks[:start] + tracks[start + count:]
        at = body.insert_before - (count if body.insert_before > start else 0)
        at = max(0, min(len(rest), at))
        held["tracks"] = tracks = rest[:at] + moving + rest[at:]
        if playing_track is not None:
            held["pos"] = next(n for n, t in enumerate(tracks) if t is playing_track)
    else:
        raise HTTPException(400, "unknown edit")
    held["at"] = time.time()
    return _album_listing(held)


class BrowserQueueSave(BaseModel):
    title: str
    #: A room of the household the album belongs to, through which the
    #: playlist is written.
    zone: str = ""


@app.post("/api/stream/{session}/save")
async def stream_queue_save(session: str, body: BrowserQueueSave) -> dict:
    """Save the browser room's album or playlist as a Sonos playlist.

    The room has no speaker of its own, so the playlist is written through a
    speaker of the household the album was browsed on: a new, empty playlist
    (CreateSavedQueue), then each track in the list's current order, with
    the address and description a speaker plays that service track by.
    """
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "a name is needed")
    held = _RADIO_SESSIONS.get(session)
    if held is None or held.get("tracks") is None:
        raise HTTPException(404, "that album is no longer playing here")
    ctl = controller()
    household = ctl.households.get(held.get("household", ""))
    zone = body.zone if body.zone and ctl.household_of(body.zone) is household else ""
    if not zone and household is not None:
        zone = next((u for u in household.zones if ctl.zones.get(u) and ctl.zones[u].online), "")
    if not zone:
        raise HTTPException(409, "no speaker of that system is reachable to save on")
    sid = smapi_container_ref(held["uri"])[0]
    sn = (await _household_serials(zone)).get(sid) or "0"
    udn = ctl.account_udn(household.id, sid, sn)
    entries = [built for built in (playable(t, sid, sn, udn=udn) for t in held["tracks"]) if built]
    if not entries:
        raise HTTPException(409, "the speakers cannot be told to play these tracks")
    new_id = await commands().create_playlist(zone, title)
    added = 0
    for uri, metadata in entries:
        added += await commands().add_to_playlist(zone, new_id, uri, metadata)
    return {"id": new_id, "title": title, "added": added}


def _through_sonora_if_titled(answer: dict) -> dict:
    """Route a stream that names its tracks through Sonora.

    A speaker prints a station's current track on the Information line,
    reading it from the stream's own ICY metadata; a page's media element can
    neither ask for that nor read it, so the "This browser" room had nothing
    for the line (80s80s). Such a stream is handed to the page
    through /api/stream/audio instead, which takes the blocks out as the audio
    passes and keeps the latest title. It is still one connection to the
    station. A stream without titles still goes to the page directly.
    """
    if not answer.get("icy") or answer.get("upstream") or not answer.get("url"):
        return answer
    url = answer["url"]
    key = _issue_stream_ticket(url, {"Icy-MetaData": "1"})
    _STREAM_TICKETS[key]["icy"] = True
    rest = {k: v for k, v in answer.items() if k not in ("icy", "urls")}
    return {**rest, "url": f"/api/stream/audio/{key}", "upstream": url}


@app.get("/api/stream/title")
async def stream_title(url: str, station: str = "") -> dict:
    """What a stream passing through Sonora last said was on.

    Read from the titles /api/stream/audio notes as it passes the stream on;
    nothing is fetched here. The station's own name, which many streams send
    first, is passed over.
    """
    if not url.startswith("/api/stream/audio/"):
        return {"title": ""}
    ticket = _STREAM_TICKETS.get(url.rsplit("/", 1)[-1])
    if ticket is None:
        return {"title": ""}
    return {"title": icy.pick(ticket.get("titles", []), station)}


@app.get("/api/stream/audio/{key}")
async def stream_audio(key: str, request: Request) -> StreamingResponse:
    """Pass a service's stream through, for the ones that demand headers."""
    ticket = _STREAM_TICKETS.get(key)
    if ticket is None or time.time() - ticket["at"] > _STREAM_TICKET_LIFE:
        raise HTTPException(404, "no such stream")
    # A ticket is issued by Sonora, but the URL inside it came from a service
    # or from the caller, so it is checked here as well as where it was made.
    if not fetchguard.safe_to_fetch(ticket["url"]):
        fetchguard.refuse(ticket["url"], "ticketed stream")
        raise HTTPException(404, "no such stream")
    headers = dict(ticket["headers"])
    # Seeking a track means a range request, and the browser makes one; a
    # live stream never does.
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]
    try:
        upstream = await state["outward"].get(
            ticket["url"], headers=headers,
            timeout=aiohttp.ClientTimeout(total=None, sock_connect=15))
    except fetchguard.Refused:
        raise HTTPException(404, "no such stream")
    if upstream.status >= 400:
        upstream.release()
        raise HTTPException(502, f"the service answered {upstream.status}")

    # A titled stream arrives with its ICY blocks in it; the page gets the
    # audio alone and the latest title is kept on the ticket.
    demux = icy.Demux(int(upstream.headers.get("icy-metaint", "0") or 0)) if ticket.get("icy") else None

    async def body():
        try:
            async for chunk in upstream.content.iter_chunked(64 * 1024):
                if demux is not None:
                    chunk = demux.feed(chunk)
                    seen = ticket.setdefault("titles", [])
                    if demux.title and (not seen or seen[-1] != demux.title):
                        seen.append(demux.title)
                        del seen[:-4]
                if chunk:
                    yield chunk
        finally:
            upstream.release()

    passed = {name: upstream.headers[name] for name in
              ("Content-Length", "Content-Range", "Accept-Ranges", "icy-name", "icy-br")
              if name in upstream.headers}
    return StreamingResponse(body(), status_code=upstream.status,
                             media_type=_media_type(upstream.headers.get("Content-Type", "")),
                             headers=passed)


#: What a stream may be passed on as. Anything else goes out as bytes.
_MEDIA_TYPES = ("audio/", "video/", "application/vnd.apple.mpegurl",
                "application/x-mpegurl", "application/ogg", "application/dash+xml")


def _media_type(declared: str) -> str:
    kind = (declared or "").split(";", 1)[0].strip().lower()
    if not kind:
        return "audio/mpeg"
    return declared if kind.startswith(_MEDIA_TYPES) else "application/octet-stream"


#: A picture that is not there yet may be there in a few seconds (a speaker
#: fetching a new track's art), so a browser must not keep the refusal.
_NO_STORE = {"Cache-Control": "no-store"}


@app.get("/api/art")
async def art(u: str, s: int = Query(default=0, ge=0, le=4096),
              best: int = Query(default=0, ge=0, le=4096), sid: int = 0,
              zone: str = "") -> Response:
    """A picture, fetched once and kept: the speaker's /getaa copy of the
    playing track's art, or a provider URL Sonora recorded for it.

    The speakers proxy art from the service on every request with no cache
    headers, and for some services that takes seconds each time (Libby by
    OverDrive, 2026-09-07), so a second window sat gray while the first had
    the picture. Only URLs Sonora itself knows are fetched -- this is not a
    general proxy.
    """
    ctl = controller()
    # A SoundCloud item's cover comes from oEmbed, not the speaker: SoundCloud
    # is a device-certificate service Sonora cannot sign in to, and the S1
    # speakers' getaa answers 404 for its art (soundcloud_art.py). The track's
    # id is already in this art URL, so it is read out and the cover fetched
    # from SoundCloud's public endpoint. The generation does not matter --
    # oEmbed serves the same cover for S1 and S2.
    ref = soundcloud_ref(u)
    if ref is not None:
        cover = await ctl.soundcloud_art.cover_url(*ref)
        if cover:
            picture = await (ctl.art_cache.sized(cover, s) if s else ctl.art_cache.get(cover))
            if picture is not None:
                return Response(content=picture.body, media_type=picture.content_type,
                                headers={"Cache-Control": "public, max-age=1800"})
        # oEmbed had nothing; an S2 speaker may still serve the getaa below.
    if not ctl.art_url_allowed(u):
        raise HTTPException(404, "not a known picture", headers=_NO_STORE)
    # ``best``: the size the page draws it at, asking for the largest copy the
    # source will give up to that rather than the one the URL names. Only a
    # page that asks gets this (Material Girl's Listen hero).
    if best:
        picture = await _best_art(ctl, u, best, sid, zone)
        if picture is not None:
            return Response(content=picture.body, media_type=picture.content_type,
                            headers={"Cache-Control": "public, max-age=1800"})
    # ``s``: the size the page draws it at, in device pixels. The picture
    # comes back no larger than the next of the cache's sizes above that.
    picture = await (ctl.art_cache.sized(u, s) if s else ctl.art_cache.get(u))
    if picture is None:
        raise HTTPException(404, "no picture there", headers=_NO_STORE)
    return Response(content=picture.body, media_type=picture.content_type,
                    headers={"Cache-Control": "public, max-age=1800"})


async def _best_art(ctl, url: str, want: int, sid: int, zone: str):
    """The largest copy of a known picture its source offers, up to ``want``.

    Two ways to ask, tried in turn, each falling back to the next and the
    last to the URL as given. First the service's own word: an
    ``ArtWorkSizeMap`` in its presentation map names the suffix each size
    carries, and is how a controller is meant to ask (Pandora's
    ``_500W_500H.jpg``). Then the URL's own size parameters, raised
    (artcache.upsized). Neither is written for any one service.
    """
    tries: list[str] = []
    if sid:
        household = (ctl.household_of(zone) if zone
                     else next(iter(ctl.ordered_households()), None))
        service = await _cached_service(ctl, household, sid) if household is not None else None
        if service is not None and service.manifest_uri:
            try:
                tries.append(await ctl.presentation.sized(service.manifest_uri, url, want))
            except Exception as exc:  # noqa: BLE001 - the URL as given still serves
                log.info("no art sizes for %s: %s", service.name, exc)
    for base in [*tries, url]:
        raised = upsized(base, want)
        if raised != base:
            tries.append(raised)
    for candidate in dict.fromkeys(t for t in tries if t and t != url):
        picture = await ctl.art_cache.get(candidate)
        if picture is not None:
            return picture
    return None


@app.get("/api/services/{sid}/text")
async def service_text(sid: int, item: str, type: str = "DESCRIPTION",
                       zone: str | None = None, account: str = "") -> dict:
    """The prose behind an item's Description row."""
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None or not item:
        return {"text": ""}
    service = await _cached_service(ctl, household, sid)
    if service is None:
        return {"text": ""}
    creds, _borrowed = _reading_creds(ctl, household, sid, account)
    if service.auth != "Anonymous" and not creds.get("token"):
        return {"text": ""}
    try:
        text = await ctl.smapi.get_extended_metadata_text(
            endpoint=service.endpoint, service_name=service.name,
            item_id=item, text_type=type, household_id=household.id,
            token=creds.get("token", ""), key=creds.get("key", ""),
            device_id=await ctl.device_serial(household))
    except Exception as exc:
        log.info("no %s text from %s: %s", type, service.name, exc)
        return {"text": ""}
    return {"text": _plain_text(text)}


def _plain_text(text: str) -> str:
    """Prose as the apps show it: entities decoded, breaks kept, tags gone.

    Providers hand the text back HTML-flavored -- Libby's book notes carry
    &bull; and &rsquo; (2026-09-07) and some services wrap paragraphs in
    tags -- and a text pane must not print the markup.
    """
    text = re.sub(r"(?i)<\s*br\s*/?>|</\s*(p|div|li|h[1-6])\s*>", "\n", text or "")
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


@app.get("/api/services/{sid}/extended")
async def service_extended(sid: int, item: str, zone: str | None = None,
                           language: str = "", account: str = "") -> dict:
    """What a service offers for one item, for the Info & Options rows.

    ``language`` overrides the locale the request arrived in, which is what
    the browser's own `Accept-Language` already carries; it is here for a
    caller that wants one service in one language.
    """
    language = language or locales.current()
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    empty = {"actions": [], "related": [], "text": "", "text_type": "", "menu": [],
             "text_label": "", "links": [], "related_play": None}
    if household is None or not item:
        return empty
    service = await _cached_service(ctl, household, sid)
    if service is None:
        return empty
    # The account the item was found under (a service URI's sn=), which
    # matters where the household holds two of the service: Spotify's pair
    # here answered for whichever came first.
    creds, _borrowed = _reading_creds(ctl, household, sid, account)
    if service.auth != "Anonymous" and not creds.get("token"):
        return empty
    try:
        found = await ctl.smapi.get_extended_metadata(
            endpoint=service.endpoint, service_name=service.name, item_id=item,
            household_id=household.id, token=creds.get("token", ""),
            key=creds.get("key", ""),
            device_id=await ctl.device_serial(household))
    except Exception as exc:
        log.info("no extended metadata from %s: %s", service.name, exc)
        return empty
    # The rows and their wording are the service's own: its InfoView
    # presentation map names the menu items it offers and its strings table
    # supplies every label, this one included (Mixcloud: "Favorite Show",
    # "Unfavorite Show", "Related shows", "Description" -- 2026-09-06).
    view = await ctl.presentation.info_view(service.manifest_uri, language)
    strings = view.get("strings") or {}
    found["menu"] = view.get("menu") or []
    for entry in found.get("related") or []:
        entry["label"] = strings.get(entry.get("type") or "", "")
    # A relatedActions title is a string id in the service's own table
    # (Amazon's openUrl action is titled GO_UNLIMITED).
    for entry in found.get("links") or []:
        sid_ = entry.get("string_id") or ""
        entry["label"] = strings.get(sid_, "")
        # Amazon names the failure string (ADD_PODCAST_EPISODE_FAILURE) and
        # keeps the matching success string under the same stem.
        entry["failure"] = strings.get(entry.get("failure_id") or "", "")
        entry["success"] = strings.get(f"{sid_}_SUCCESS", "")
    if found.get("text"):
        found["text_label"] = _related_text_label(found.get("text_type") or "", strings)
    # What the service just declared is what may later be carried out.
    _note_service_actions(household.id, sid, found.get("links"))
    return found


#: What the desktop apps call a relatedText row, by its type. The words are
#: the controller's own, not the service's: Libby by OverDrive's BOOK_NOTES
#: row reads "About this Book" in the Windows app (2026-09-07), first in the
#: list, above the Sonos favorites and playlist rows. sclib names the string
#: ids for the sibling types (aboutTheAlbum, aboutTheArtist, aboutThisRadio,
#: episodeDetails), from which the other rows are worded; only the book row
#: has been seen in the app.
RELATED_TEXT_LABELS = {
    "BOOK_NOTES": "About this Book",
    "ALBUM_NOTES": "About the Album",
    "ARTIST_BIO": "About the Artist",
    "RADIO_NOTES": "About this Radio",
    "EPISODE_NOTES": "Episode Details",
}


def _related_text_label(text_type: str, strings: dict) -> str:
    """The row label for a relatedText: the service's own string for the type
    when it has one, then the apps' wording for the type, then the service's
    generic DESCRIPTION string (Mixcloud's "Description", 2026-09-06)."""
    return (strings.get(text_type, "") if text_type else "") \
        or RELATED_TEXT_LABELS.get(text_type.upper(), "") \
        or strings.get("DESCRIPTION", "")


class ServiceActionBody(BaseModel):
    zone: str | None = None
    #: The action's URL exactly as the service gave it. It is a key into what
    #: the service declared, not a request to fetch whatever it names.
    url: str


#: The relatedActions a service has actually declared, per household and
#: service: the URL it named, with the method and headers it named with it.
#: Only these may be carried out.
#:
#: Without this the route would fetch any https URL a caller asked for, with
#: the household's own service token attached as a bearer -- a way to hand
#: somebody's music-service credentials to a server of the caller's choosing,
#: and a way to probe hosts this machine can reach. Found by the pre-launch
#: security audit.
_SERVICE_ACTIONS: dict[tuple[str, int], dict[str, dict]] = {}

#: Plenty for the handful of actions an item declares, and a bound on what a
#: service can make Sonora remember.
_ACTIONS_PER_SERVICE = 200


def _note_service_actions(household_id: str, sid: int, links) -> None:
    """Remember what a service just declared for an item."""
    known = _SERVICE_ACTIONS.setdefault((household_id, sid), {})
    for link in links or []:
        url = (link.get("url") or "").strip()
        if not url.startswith("https://"):
            continue
        known[url] = {"method": (link.get("method") or "GET").upper() or "GET",
                      "headers": dict(link.get("headers") or {})}
    while len(known) > _ACTIONS_PER_SERVICE:
        known.pop(next(iter(known)))


def _declared_action(household_id: str, sid: int, url: str) -> dict | None:
    return _SERVICE_ACTIONS.get((household_id, sid), {}).get(url)


@app.post("/api/services/{sid}/action")
async def service_action(sid: int, body: ServiceActionBody) -> dict:
    """Carry out a relatedActions simpleHttpRequest for a service.

    The service names the request outright -- Amazon Music's "Add to my
    Amazon Music Library" is a PUT to smapi-na.amazonmusic.com/api/favorites
    with an "Amazon Music: sonos-to-amazon-music" header -- and it is sent
    with the same credentials the service's browse endpoint takes: the
    household's token as a bearer and the device id (2026-09-07).
    """
    ctl = controller()
    household = (ctl.household_of(body.zone) if body.zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None:
        raise HTTPException(503, "no household available")
    declared = _declared_action(household.id, sid, body.url)
    if declared is None:
        # Not something this service offered. The token below would otherwise
        # go wherever the caller pointed.
        log.info("refused an action %s never declared for %s", sid, household.id[:22])
        raise HTTPException(403, "that service has not offered this action")
    creds = ctl.credentials_for(household.id, sid, "", single_account=True) or {}
    # The method and the headers are the service's own, not the caller's.
    headers = dict(declared["headers"])
    if creds.get("token"):
        headers["Authorization"] = f"Bearer {creds['token']}"
    headers["X-Sonos-Device-Id"] = await ctl.device_serial(household)
    headers["X-Sonos-Household-Id"] = household.id
    method = declared["method"]
    if method not in ("GET", "PUT", "POST", "DELETE"):
        raise HTTPException(400, f"unsupported method {method}")
    try:
        async with ctl.smapi._session.request(
                method, body.url, headers=headers,
                timeout=aiohttp.ClientTimeout(total=15)) as resp:
            text = (await resp.text())[:300]
            status = resp.status
    except Exception as exc:
        log.info("service action failed for %s: %s", sid, exc)
        return {"ok": False, "status": 0, "detail": str(exc)}
    if status >= 300:
        log.info("service action refused for %s (%s): %s", sid, status, text)
    return {"ok": status < 300, "status": status, "detail": "" if status < 300 else text}


@app.get("/api/services/{sid}/item")
async def service_item(sid: int, item: str, zone: str | None = None,
                       account: str = "") -> dict:
    """What a service says the item itself is.

    ``getExtendedMetadata`` answers with the item's own ``mediaCollection`` or
    ``mediaMetadata``, and that is where the apps' Info & Options gets the
    labels and the navigations: Plex returns itemType, artist and artistId for
    an album, and artistId with albumId for a track, which is how "Artist
    Info" and "View All Songs on Album" know where to go (2026-09-07).
    """
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None or not item:
        return {}
    service = await _cached_service(ctl, household, sid)
    if service is None:
        return {}
    # The account the item was found under, as for its extended metadata.
    creds, _borrowed = _reading_creds(ctl, household, sid, account)
    if service.auth != "Anonymous" and not creds.get("token"):
        return {}
    try:
        found = await ctl.smapi.get_extended_metadata_item(
            endpoint=service.endpoint, service_name=service.name, item_id=item,
            household_id=household.id, token=creds.get("token", ""),
            key=creds.get("key", ""),
            device_id=await ctl.device_serial(household))
    except Exception as exc:
        log.info("no item metadata from %s: %s", service.name, exc)
        return {}
    if found is None:
        return {}
    out = found.as_dict()
    # The URI a speaker plays this item with, and the DIDL that names it. The
    # Info & Options page needs them to favorite the thing it is describing:
    # a station playing a track the service can name offers "Add Song to Sonos
    # Favorites", and what lands in the household's favorites is the song
    # (measured against the app on 2026-09-14).
    regs = []
    if ctl.cloud.signed_in:
        try:
            regs = await ctl.cloud.registrations(household.cloud_id)
        except (CloudError, NotSignedIn):
            regs = []
    reg = next((r for r in regs if r.service_id == sid), None)
    # Named, the account is the serial the URI carries; otherwise the
    # service's first registration, as before.
    sn = account or (reg.account_id if reg is not None else None)
    if sn is None:
        sn = (await _household_serials(zone)).get(sid) or "0"
    udn = ctl.account_udn(household.id, sid, sn or "")
    built = playable(found, sid, sn, udn=udn)
    if built:
        out["uri"], out["metadata"] = built
    else:
        ref = playable(found, sid, sn, for_favorite=True, udn=udn)
        if ref:
            out["favorite_uri"], out["favorite_metadata"] = ref
    # The item's picture, read from the service here, may be drawn through /api/art (an album's
    # Info & Options header).
    if out.get("art"):
        ctl.remember_picture(out["art"])
    return out


@app.get("/api/households/{household_id}/software-update")
async def software_update(household_id: str) -> dict:
    """Whether this system's speakers have an update waiting (the source
    list's "Update Now" row). Never the Sonos app's own update."""
    ctl = controller()
    household = ctl.households.get(household_id)
    if household is None:
        raise HTTPException(404, f"unknown household {household_id}")
    status = await ctl.software_update(household)
    return {k: status.get(k) for k in ("pending", "version", "display")} | {
        "players": [p["name"] for p in status.get("players", [])]}


@app.post("/api/households/{household_id}/software-update")
async def start_software_update(household_id: str) -> dict:
    """Start the speaker update ("Update Now", once confirmed)."""
    ctl = controller()
    household = ctl.households.get(household_id)
    if household is None:
        raise HTTPException(404, f"unknown household {household_id}")
    return await ctl.begin_software_update(household)


@app.get("/api/radio-location")
async def radio_location(zone: str | None = None) -> dict:
    """TuneIn's local-radio node for the household, and the city to name it."""
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None:
        return {"node": "", "city": ""}
    return await ctl.radio_location(household)


class RadioLocationBody(BaseModel):
    zone: str
    #: TuneIn's node for the place ("z92808" for a postcode, "r100455" for
    #: one of its own location containers).
    node: str
    #: What to name it in the row, which the apps read straight back out.
    city: str = ""


@app.post("/api/radio-location")
async def set_radio_location(body: RadioLocationBody) -> dict:
    """Set the household's local-radio node (the apps' Change Location).

    The value is written back in the shape the speakers keep it in --
    ``F00080000z92808,Anaheim`` -- reusing whatever object-id prefix is
    already there so nothing else about it changes.
    """
    ctl = controller()
    household = ctl.household_of(body.zone) or next(
        iter(ctl.ordered_households()), None)
    if household is None:
        raise HTTPException(503, "no household available")
    node = body.node.strip()
    if not node:
        raise HTTPException(400, "a location node is needed")
    try:
        result = await ctl.set_radio_location(household, node, body.city.strip())
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc
    return result


@app.get("/api/favorites")
async def favorites(zone: str | None = None) -> dict:
    ctl = controller()
    host = _host_for(zone)
    items = await ctl.content.favorites(host)
    in_use, names, labels = await _favorite_context(zone)
    out = []
    for item in items:
        raw = item.as_dict(host)
        _favorite_facts(raw, in_use, names, labels)
        out.append(raw)
    return {"items": out}


class FavoriteBody(BaseModel):
    zone: str
    id: str
    title: str = ""
    current: str = ""


class FavoriteAddBody(BaseModel):
    zone: str
    uri: str
    metadata: str = ""
    title: str
    art: str = ""
    description: str = ""


@app.post("/api/favorites/add")
async def add_favorite(body: FavoriteAddBody) -> dict:
    """Add a browsed item (station, playlist, album, track) to Sonos Favorites."""
    title = body.title.strip()
    if not title or not body.uri:
        raise HTTPException(400, "a playable item with a name is needed")
    try:
        result = await commands().add_favorite(body.zone, title, body.uri, body.metadata,
                                               body.description, body.art)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    except SoapFault as exc:
        if exc.code == "803":
            return {"id": "", "title": title, "exists": True}
        raise
    return {"id": result.get("ObjectID", ""), "title": title, "exists": False}


@app.post("/api/favorites/rename")
async def rename_favorite(body: FavoriteBody) -> dict:
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "a name is needed")
    try:
        await commands().rename_favorite(body.zone, body.id, body.current, title)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    return {"ok": True, "title": title}


@app.post("/api/favorites/remove")
async def remove_favorite(body: FavoriteBody) -> dict:
    try:
        await commands().remove_favorite(body.zone, body.id)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    return {"ok": True}


@app.get("/api/playlists")
async def playlists(zone: str | None = None) -> dict:
    host = _host_for(zone)
    items = await controller().content.sonos_playlists(host)
    # A saved queue has no page of its own here, so `opens` comes back empty
    # and its tile plays as before; the field is present all the same, so a
    # caller reads one shape from every list on the home.
    return {"items": [{**item.as_dict(host),
                       "opens": _opens_at(item.as_dict(host).get("uri", ""))}
                      for item in items]}


class PlaylistBody(BaseModel):
    zone: str
    id: str = ""
    title: str = ""
    current: str = ""
    uri: str = ""
    metadata: str = ""
    #: The container the item was browsed in, so its own DIDL can be read
    #: back for a saved-queue write.
    source_id: str = ""


class PlaylistTrackBody(BaseModel):
    zone: str
    id: str
    #: The track's position in the playlist, counting from one.
    index: int = 0


@app.post("/api/playlists")
async def create_playlist(body: PlaylistBody) -> dict:
    """A new, empty Sonos playlist (the apps' New Playlist)."""
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "a name is needed")
    new_id = await commands().create_playlist(body.zone, title)
    return {"id": new_id, "title": title}


@app.post("/api/playlists/add")
async def add_to_playlist(body: PlaylistBody) -> dict:
    """Append an item to a Sonos playlist (the apps' Add to Sonos Playlist)."""
    if not body.id or not body.uri:
        raise HTTPException(400, "a playlist and an item are needed")
    added = await commands().add_to_playlist(body.zone, body.id, body.uri,
                                             body.metadata, body.title,
                                             body.source_id)
    return {"ok": True, "added": added}


@app.post("/api/playlists/remove-track")
async def remove_playlist_track(body: PlaylistTrackBody) -> dict:
    """Drop one track from a Sonos playlist (the apps' Remove Song)."""
    if not body.id or body.index < 1:
        raise HTTPException(400, "a playlist and a track position are needed")
    await commands().remove_from_playlist(body.zone, body.id, body.index)
    return {"ok": True}


class PlaylistMoveBody(BaseModel):
    zone: str
    id: str
    #: The track's position now and the one it is to take, counting from one.
    index: int = 0
    to: int = 0


@app.post("/api/playlists/move-track")
async def move_playlist_track(body: PlaylistMoveBody) -> dict:
    """Move one track within a Sonos playlist (a drag on its page)."""
    if not body.id or body.index < 1 or body.to < 1:
        raise HTTPException(400, "a playlist and two track positions are needed")
    await commands().move_in_playlist(body.zone, body.id, body.index, body.to)
    return {"ok": True}


@app.post("/api/playlists/rename")
async def rename_playlist(body: PlaylistBody) -> dict:
    title = body.title.strip()
    if not title or not body.id:
        raise HTTPException(400, "a playlist and a name are needed")
    await commands().rename_object(body.zone, body.id, body.current, title)
    return {"ok": True, "title": title}


@app.post("/api/playlists/remove")
async def remove_playlist(body: PlaylistBody) -> dict:
    if not body.id:
        raise HTTPException(400, "a playlist is needed")
    await commands().destroy_object(body.zone, body.id)
    return {"ok": True}


# -- optional Sonos sign-in ---------------------------------------------------
#
# Two things cannot be answered on the LAN: which services a household has
# configured, and what their logos look like. Both come from Sonos' web app
# behind a signed-in session. Everything else stays local, and the app works
# without ever signing in.


class SignIn(BaseModel):
    email: str
    password: str


@app.get("/api/cloud/status")
async def cloud_status() -> dict:
    return {**controller().cloud.status(), "feed": controller().muse.status()}


@app.post("/api/cloud/login")
async def cloud_login(body: SignIn) -> dict:
    """Sign in to Sonos.

    The password is used once to obtain a session and is not stored, logged or
    written to disk. The session lives in memory for the life of the process.
    """
    ctl = controller()
    try:
        status = await ctl.cloud.sign_in(body.email, body.password)
    except CloudError as exc:
        raise HTTPException(400, str(exc)) from exc
    # The live feed for television inputs runs only while signed in.
    await ctl.muse.start()
    return {**status, "feed": ctl.muse.status()}


@app.post("/api/cloud/logout")
async def cloud_logout() -> dict:
    await controller().muse.stop()
    await controller().cloud.sign_out()
    return controller().cloud.status()


@app.get("/api/cloud/icon/{integration_id}/{config_id}")
async def cloud_icon(integration_id: str, config_id: str,
                     size: int = Query(default=160, ge=32, le=512)) -> Response:
    """Proxy a service logo, cached in memory.

    Proxied rather than linked directly because the upstream image needs the
    signed-in session, which lives here and not in the browser.
    """
    try:
        body, content_type = await controller().cloud.icon(
            integration_id, config_id, size)
    except NotSignedIn as exc:
        raise HTTPException(401, "not signed in to Sonos") from exc
    except CloudError as exc:
        raise HTTPException(502, str(exc)) from exc
    key = (integration_id, config_id, size)
    trimmed = _TRIMMED_LOGOS.get(key)
    if trimmed is None:
        trimmed = _TRIMMED_LOGOS[key] = _fill_logo(body, content_type)
    return Response(trimmed[0], media_type=trimmed[1],
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/services/badge/{sid}")
async def service_badge(sid: int, zone: str | None = None,
                        size: int = Query(default=40, ge=14, le=160)) -> Response:
    """A service's attribution badge, by browse sid.

    The product prints one before the content type under a tile, before a
    room card's second line and before the bar's -- a Pandora flag, an Audacy
    triangle -- and nothing at all for a service that publishes none. Which is
    which comes from the catalog's brand assets, so the 404 here means
    "draw nothing" rather than "something went wrong".

    Served exactly as it arrives, padding and all. The padding is the point:
    Sonos pads each mark into a common frame so that a tall one and a wide
    one sit together, and the product draws that frame. Pandora's 14px badge
    is 14x14 carrying 12x14 of ink where Audacy's is 14x11 carrying 8x7, and
    those are the sizes the product paints (measured 2026-09-19). Trimming
    the margin -- which an earlier pass did -- blows the wide marks up to
    twice the size the product gives them.
    """
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None or not ctl.cloud.signed_in:
        raise HTTPException(404, "no badge for that service")
    try:
        catalog = await ctl.cloud.service_catalog(household.cloud_id)
        info = catalog.get(sid)
        if info is None:
            raise HTTPException(404, "no badge for that service")
        body, content_type = await ctl.cloud.badge(
            info["integration_id"], info["config_id"], size)
    except (CloudError, NotSignedIn):
        raise HTTPException(404, "no badge for that service") from None
    return Response(body, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/services/wordmark/{sid}")
async def service_wordmark(sid: int, zone: str | None = None) -> Response:
    """A service's wordmark, by browse sid.

    The product prints it under the artist in Now Playing -- "pandora" in
    Pandora's own type -- where the service publishes one, and nothing where
    it does not.
    """
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None or not ctl.cloud.signed_in:
        raise HTTPException(404, "no wordmark for that service")
    try:
        catalog = await ctl.cloud.service_catalog(household.cloud_id)
        info = catalog.get(sid)
        if info is None:
            raise HTTPException(404, "no wordmark for that service")
        body, content_type = await ctl.cloud.brand_image(
            info["integration_id"], info["config_id"], "logo", 200, 40)
    except (CloudError, NotSignedIn):
        raise HTTPException(404, "no wordmark for that service") from None
    return Response(body, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/services/logo/sid/{sid}")
async def service_logo_by_sid(sid: int,
                              size: int = Query(default=160, ge=20, le=512)) -> Response:
    """The same logo, asked for by browse sid.

    A room card knows which service is playing from the sid its speaker
    reports, and nothing else; the manifest keys its pictures by service
    *type*, whose low byte no sid carries. The product puts that mark under
    the title on every card, so this saves every caller having to fetch the
    whole service list to draw one 16px badge.
    """
    cache = state.get("logos")
    if cache is None:
        raise HTTPException(503, "controller not ready")
    service_type = cache.type_for_sid(sid)
    if service_type is None:
        raise HTTPException(404, "no logo for that service")
    return await service_logo(service_type, size)


@app.get("/api/services/logo/{service_type}")
async def service_logo(service_type: int,
                       size: int = Query(default=160, ge=20, le=512)) -> Response:
    """A service's logo, from the public manifest and the disk cache.

    No account is involved: the manifest and the pictures are public, which is
    why these survive a sign-out. Trimmed the same way the signed-in logos are
    so a row of marks reads at one size.
    """
    cache = state.get("logos")
    if cache is None:
        raise HTTPException(503, "controller not ready")
    got = await cache.logo(service_type, size)
    if got is None:
        raise HTTPException(404, "no logo for that service")
    body, content_type = got
    key = ("manifest", str(service_type), size)
    trimmed = _TRIMMED_LOGOS.get(key)
    if trimmed is None:
        trimmed = _TRIMMED_LOGOS[key] = _fill_logo(body, content_type)
    return Response(trimmed[0], media_type=trimmed[1],
                    headers={"Cache-Control": "public, max-age=86400"})


_TRIMMED_LOGOS: dict[tuple[str, str, int], tuple[bytes, str]] = {}


def _fill_logo(body: bytes, content_type: str) -> tuple[bytes, str]:
    """Trim a logo's plain border so its mark fills the frame.

    Providers pad their marks differently: Spotify's disc sits in a near-black
    square with a 15% margin all round, SoundCloud's cloud fills its orange
    square edge to edge. Shown at 30px in a row those read as different sizes,
    where the app shows every mark the same size. So a border is trimmed to
    the mark's bounding box (squared about its center) when it is plain
    padding: the corner color is transparent or a neutral dark or light, not
    a brand color, and the mark already spans most of the frame (60% or
    more), so a small glyph on a field, Plex's chevron say, is not blown up.
    Anything that fails to decode is passed through untouched.
    """
    try:
        from PIL import Image, ImageChops
        im = Image.open(io.BytesIO(body)).convert("RGBA")
    except Exception:
        return body, content_type
    w, h = im.size
    if w < 32 or h < 32:
        return body, content_type
    bg = im.getpixel((0, 0))
    r, g, b, a = bg
    neutral = (max(r, g, b) - min(r, g, b)) < 24 and (max(r, g, b) < 48 or min(r, g, b) > 208)
    if a > 16 and not neutral:
        return body, content_type
    color = ImageChops.difference(im.convert("RGB"), Image.new("RGB", im.size, (r, g, b)))
    mask = color.convert("L").point(lambda v: 255 if v > 28 else 0)
    alpha = im.getchannel("A")
    if a <= 16:
        # Transparent border: only opaque pixels are the mark.
        mask = ImageChops.multiply(mask, alpha.point(lambda v: 255 if v > 16 else 0))
    else:
        mask = ImageChops.lighter(mask, ImageChops.difference(
            alpha, Image.new("L", im.size, a)).point(lambda v: 255 if v > 16 else 0))
    box = mask.getbbox()
    if not box:
        return body, content_type
    left, top, right, bottom = box
    cw, ch = right - left, bottom - top
    if (cw >= 0.96 * w and ch >= 0.96 * h) or cw < 0.6 * w or ch < 0.6 * h:
        return body, content_type
    side = max(cw, ch)
    x0 = int(round((left + right) / 2 - side / 2))
    y0 = int(round((top + bottom) / 2 - side / 2))
    canvas = Image.new("RGBA", (side, side), bg)
    canvas.paste(im, (-x0, -y0), im)
    out = io.BytesIO()
    canvas.save(out, "PNG")
    return out.getvalue(), "image/png"


@app.get("/api/themes")
async def list_themes() -> dict:
    """Themes installed as files, beside the ones built into the bundle."""
    return {"items": theme_store.installed(),
            "themeEngine": theme_store.ENGINE}


@app.get("/api/themes/schema")
async def theme_schema() -> dict:
    """A JSON Schema for the theme.json inside a theme archive.

    Generated from the same constants the install gate enforces, so a theme
    checked against this is checked against what will actually accept it.
    Served because a theme author has Sonora and nothing else.
    """
    return theme_store.schema()


@app.get("/api/themes/reference")
async def theme_reference() -> dict:
    """The class names a theme's stylesheet is written against, by part."""
    return theme_store.reference()


@app.post("/api/themes")
async def install_theme(request: Request) -> dict:
    """Install one theme: the request body is the .zip itself.

    A theme is data -- identity, version, screenshot, tokens, a stylesheet and
    a layout of the parts Sonora publishes. Nothing in it executes.
    """
    # Read no further than the largest theme there can be, so a huge upload
    # is refused as it arrives rather than held in memory first.
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > theme_store.MAX_BYTES:
        raise HTTPException(413, "that file is too large to be a theme")
    raw = bytearray()
    async for chunk in request.stream():
        raw += chunk
        if len(raw) > theme_store.MAX_BYTES:
            raise HTTPException(413, "that file is too large to be a theme")
    try:
        theme = theme_store.install(bytes(raw))
    except theme_store.ThemeError as exc:
        raise HTTPException(400, str(exc)) from exc
    except OSError as exc:
        raise HTTPException(500, f"could not save the theme: {exc}") from exc
    return {"ok": True, "theme": theme}


@app.delete("/api/themes/{theme_id}")
async def delete_theme(theme_id: str) -> dict:
    """Remove an installed theme. Built-in themes are in the bundle, not on
    disk, so this can only ever reach an uploaded one."""
    if not theme_store.remove(theme_id):
        raise HTTPException(404, "no such installed theme")
    return {"ok": True}


@app.get("/api/services/labs")
async def labs_services(zone: str = "") -> dict:
    """The Sonos Labs services a household is offered.

    What the desktop app's "Sonos Labs" button lists. The list is Sonos' to
    give: a household that has not opted in to Labs is offered none, and the
    app then shows an empty well, so an empty ``items`` here is an answer
    rather than a failure. ``signed_in`` says whether the question could be
    asked at all, since the catalog needs the account session.
    """
    ctl = controller()
    household = None
    if zone and zone in ctl.zones:
        household = ctl.household_of(zone)
    if household is None:
        household = next(iter(ctl.ordered_households()), None)
    if household is None or not household.cloud_id:
        return {"items": [], "signed_in": ctl.cloud.signed_in, "household": ""}
    try:
        items = await ctl.cloud.labs_services(household.cloud_id)
    except NotSignedIn:
        return {"items": [], "signed_in": False, "household": household.id}
    except CloudError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"items": items, "signed_in": True, "household": household.id}


@app.get("/api/services")
async def services(zone: str | None = None) -> dict:
    """Music service catalogs, per household.

    The catalog comes from the speakers: ``MusicServices#ListAvailableServices``
    from any one player, with usage inferred from the ``sid`` carried by every
    favorite, playlist and saved station and a probe of the services that
    need no account. It is the controller's kept copy
    (``service_directory``), answered at once and refreshed behind the
    answer. Signed in to Sonos, the household's own registration list and
    Sonos' catalog order come from the cloud, both cached, and replace the
    inference; logos come from Sonos' public manifest, kept on disk.

    Reported per household rather than once, because each has its own
    catalog and its own content. Answering for whichever speaker happened to
    reply first reports the wrong household's services half the time.
    """
    ctl = controller()
    if zone:
        household = ctl.household_of(zone)
        if household is None:
            raise HTTPException(404, f"unknown zone {zone}")
        selected = [household]
    else:
        selected = ctl.ordered_households()

    out = []
    for household in selected:
        try:
            directory = await ctl.service_directory(household)
        except Exception as exc:
            # A whole household's speakers all unreachable: skip it rather than
            # failing the list for every other household too.
            log.info("service catalog unavailable for %s: %s",
                     household.id[:22], exc)
            continue

        # When signed in, the household's own registration list is
        # authoritative and carries a logo for each entry. Local inference
        # under-reports a household with little saved content, so the cloud
        # list replaces it rather than merging with it.
        source = "local"
        in_use = [s.as_dict() for s in directory.in_use]
        if ctl.cloud.signed_in:
            try:
                registrations = await ctl.cloud.registrations(
                    household.cloud_id)
            except (CloudError, NotSignedIn) as exc:
                log.info("cloud service list unavailable: %s", exc)
            else:
                if not registrations and in_use:
                    # An empty answer for a household whose speakers show
                    # services in use is an outage, not a list: on 2026-09-05
                    # the endpoint returned [] for both households at once.
                    # Taking it at face value would hide every service Sonora
                    # holds no record of and purge the records it does hold,
                    # so the speakers' own view stands instead.
                    log.info("cloud registration list empty for %s; keeping "
                             "the speakers' list", household.id[:22])
                else:
                    source = "cloud"
                    by_id = {s.id: s for s in directory.services}
                    in_use = []
                    for reg in registrations:
                        entry = reg.as_dict()
                        # The nickname is the one field the cloud is late
                        # with: a rename takes seconds to minutes to reach it,
                        # while the speakers publish their own account list at
                        # once. Where they hold the account, their name stands.
                        if reg.username:
                            theirs = ctl.account_nickname(
                                household.id, reg.service_type, reg.username)
                            if theirs is not None:
                                entry["nickname"] = theirs
                        local = by_id.get(reg.service_id)
                        if local is not None:
                            entry.setdefault("auth", local.auth)
                            entry["linkable_locally"] = local.linkable_locally
                            entry["initials"] = local.initials
                            # The SMAPI capability bitmask decides which rows
                            # the apps offer for a track (Info & Options).
                            entry["capabilities"] = local.capabilities
                        else:
                            entry["initials"] = "".join(
                                w[0] for w in reg.name.split()[:2]).upper() or "?"
                        in_use.append(entry)
                    # The registration list carries accounts only. An anonymous
                    # service added to an S1 household is held by the players
                    # alone, so the speakers' own probe supplies those rows.
                    present = {e.get("id") for e in in_use}
                    for local in directory.in_use:
                        if local.auth == "Anonymous" and local.id not in present:
                            entry = local.as_dict()
                            entry.update({"service_id": local.id, "nickname": "",
                                          "account_id": ""})
                            in_use.append(entry)

        if source == "local":
            # Signed out, the speakers' own account list gives each account a
            # row of its own, named as every app names it, as the cloud list
            # would (the S1 Mac app shows "Alex's Libby" there, 2026-09-28).
            held = ctl.household_accounts(household.id)
            rows = []
            for entry in in_use:
                mine = [a for a in held if a.service_id == entry.get("id") and a.username]
                if entry.get("auth") == "Anonymous" or not mine:
                    rows.append({**entry, "service_id": entry.get("id"),
                                 "nickname": "", "account_id": ""})
                    continue
                for account in mine:
                    rows.append({**entry, "service_id": entry.get("id"),
                                 "service_type": account.service_type,
                                 "nickname": account.nickname, "account_id": account.serial})
            in_use = rows

        # Everything in the base list is on the Sonos household itself. A
        # service removed from the household through Sonora moments ago is
        # dropped even if the list still carries it: the cloud trails the
        # speakers, and the person just watched it go.
        gone = ctl.recently_removed(household.id)
        in_use = [entry for entry in in_use
                  if (entry.get("id"), str(entry.get("account_id", "") or "")) not in gone]
        for entry in in_use:
            entry["on_system"] = True

        # Reconcile Sonora's own link records against the list. Each record's
        # `sonora_only` says whether the household ever had the service. When
        # the cloud list is authoritative, a record for a service the household
        # had but no longer lists means it was removed in another app, so it is
        # purged here rather than merged back; one Sonora only ever held itself
        # (never on the household, like iHeart) is kept and shown. A record seen
        # in the cloud list has its flag corrected, so it heals over time. With
        # no cloud list there is nothing to reconcile against, so every record
        # is shown as before.
        present = {entry.get("id") for entry in in_use}
        for sid, meta in list(ctl.linked_services.get(household.id, {}).items()):
            if sid in present:
                if source == "cloud" and meta.get("sonora_only"):
                    ctl.remember_linked_service(
                        household.id, sid, {**meta, "sonora_only": False})
                continue
            # A record made in the last couple of minutes is left alone: the
            # cloud takes a moment to list a service just added here, and
            # purging it in that window would make a fresh add vanish.
            young = (time.time() - float(meta.get("added_at", 0))) < 120
            if source == "cloud" and not meta.get("sonora_only") and not young:
                ctl.forget_linked_service(household.id, sid)
                ctl.forget_service_token(household.id, sid)
                log.info("service %s no longer on household %s; Sonora's "
                         "record dropped", sid, household.id[:22])
                continue
            # A record shown from Sonora's own store: on the household only if
            # it was not one Sonora alone holds.
            entry = dict(meta)
            entry["on_system"] = not meta.get("sonora_only")
            in_use.append(entry)

        # The full catalog carries a logo for every service, linked or not.
        # It is the only logo source for a service that has no account (an
        # anonymous one like Audacy) and for the whole "add a service" list,
        # where nothing is linked yet. Fetched once and used for both.
        catalog: dict = {}
        if ctl.cloud.signed_in:
            try:
                catalog = await ctl.cloud.service_catalog(household.cloud_id)
            except (CloudError, NotSignedIn) as exc:
                log.info("service catalog unavailable: %s", exc)

        # One order for the whole list, however each row was found: the one
        # Sonos' own catalog is in, which is what the web app follows. The
        # anonymous services only the speakers know about are appended above,
        # so without this they trailed the linked ones instead of sitting
        # where Sonos lists them. Anything the catalog does not name keeps
        # its place at the end (the sort is stable).
        if catalog:
            rank = {sid: info.get("rank", 0) for sid, info in catalog.items()}
            in_use.sort(key=lambda entry: rank.get(entry.get("id"), len(rank) + 1))

        # A logo from the public manifest first: it needs no account, so it
        # keeps working after a sign-out, and it is already on disk. The
        # signed-in endpoint answers for the services the manifest omits.
        logos = state.get("logos")
        primed = state.get("logos_primed")
        if primed is not None and not primed.done():
            await asyncio.wait({primed}, timeout=5)

        def catalog_site(sid: int | None) -> str:
            """The service's own front page, for the link the apps offer."""
            info = catalog.get(sid) if sid is not None else None
            return (info or {}).get("site", "")

        def catalog_icon(sid: int | None) -> str:
            if sid is not None and logos is not None:
                service_type = logos.type_for_sid(sid)
                if service_type is not None:
                    return f"/api/services/logo/{service_type}"
            info = catalog.get(sid) if sid is not None else None
            return (f"/api/cloud/icon/{info['integration_id']}/{info['config_id']}"
                    if info else "")

        # How many household accounts each service has: a login recorded
        # before accounts were tracked can be attributed when there is one.
        account_counts: dict = {}
        for entry in in_use:
            if entry.get("on_system"):
                account_counts[entry.get("id")] = account_counts.get(entry.get("id"), 0) + 1

        # Attribute account-less logins where the household now says whose they
        # are. Two signals, either sufficing: a household account carrying the
        # nickname the provider gave the login (the Sonos app often uses the
        # provider username as the nickname), or, for a standalone login, a
        # single account that appeared after the login was made. Ambiguity
        # leaves the login as it is.
        for (hid, s, account), creds in list(ctl.service_tokens.items()):
            if hid != household.id or account:
                continue
            record = ctl.linked_services.get(household.id, {}).get(s, {})
            nick = (record.get("nickname") or "").strip().casefold()
            held = set(ctl.tokens_for_service(household.id, s)) - {""}
            rows = [e for e in in_use
                    if e.get("on_system") and e.get("id") == s
                    and str(e.get("account_id") or "")
                    and str(e.get("account_id") or "") not in held]
            match = [e for e in rows
                     if nick and (e.get("nickname") or "").strip().casefold() == nick]
            if len(match) != 1 and creds.get("standalone"):
                seen = set(creds.get("seen_accounts") or [])
                match = [e for e in rows if str(e.get("account_id")) not in seen]
            if len(match) == 1:
                target = str(match[0].get("account_id"))
                ctl.remember_service_token(household.id, s, creds["token"], creds["key"], target)
                log.info("login for service %s on %s attributed to account %s (%s)",
                         s, household.id[:22], target, match[0].get("nickname", ""))

        for entry in in_use:
            # The manifest's logo wins over the signed-in one wherever it has
            # the service, so the same picture is shown whether or not anyone
            # is signed in and the row does not go blank on a sign-out.
            public = catalog_icon(entry.get("id"))
            if public or not entry.get("icon"):
                entry["icon"] = public or entry.get("icon", "")
            # Whether Sonora itself holds a login for this account. A service
            # the Sonos app configured has its token sealed in the speakers, so
            # it can be listed but not browsed here until linked in Sonora too.
            # Anonymous services need no login and are always usable.
            sid = entry.get("id")
            account = str(entry.get("account_id", "") or "")
            held = ctl.credentials_for(household.id, sid, account,
                                       single_account=account_counts.get(sid, 0) == 1)
            entry["site"] = catalog_site(sid)
            entry["sonora_token"] = entry.get("auth") == "Anonymous" or held is not None
            # A service whose home comes from a browse endpoint may need no
            # credentials at all: Sonos Radio answers anonymously, so marking
            # it "not linked in Sonora" put a caution on a service that opens
            # and browses perfectly well.
            local = directory.by_id(sid) if sid is not None else None
            entry["public_browse"] = bool(
                local is not None and local.manifest_uri
                and await ctl.presentation.public_home(local.manifest_uri))
            entry["accounts"] = account_counts.get(sid, 0)
            # Whether Sonora holds anything of its own for this entry (a
            # sign-in or a link record). Removing a service "from Sonora" only
            # means something when this is true; otherwise the only removal
            # that has any effect is from the Sonos system itself.
            entry["sonora_linked"] = (
                held is not None
                or (not entry.get("on_system")
                    and sid in ctl.linked_services.get(household.id, {})))

        # A login Sonora holds that belongs to no listed account is shown as
        # its own row, named by the provider's nickname. Two kinds: one made
        # before accounts were tracked for a service with several accounts
        # (it is one of them, which is unknowable, so it is shown as on the
        # system until the person links the right account and it retires), and
        # a standalone one added for a service already on the system under
        # someone else (Alex's Spotify beside Sam's), which is Sonora's
        # alone and not on the system.
        for (hid, sid, account), creds in list(ctl.service_tokens.items()):
            if hid != household.id or account:
                continue
            count = account_counts.get(sid, 0)
            standalone = bool(creds.get("standalone"))
            if count < (1 if standalone else 2):
                continue
            model = next((e for e in in_use if e.get("id") == sid), {})
            record = ctl.linked_services.get(household.id, {}).get(sid, {})
            in_use.append({
                "id": sid, "service_id": sid, "name": model.get("name", record.get("name", "")),
                "nickname": record.get("nickname", "") or "Sonora",
                "account_id": "", "initials": model.get("initials", record.get("initials", "")),
                "icon": model.get("icon", "") or catalog_icon(sid),
                "auth": model.get("auth", record.get("auth", "")),
                "on_system": not standalone, "sonora_token": True, "sonora_linked": True,
                "unattributed": not standalone, "accounts": count,
            })

        # Services a provider will not let Sonora link (SoundCloud and its kind)
        # are flagged so the "add a service" list can dim them.
        unpairable = await ctl.unpairable_service_ids(household)
        available = []
        for service in directory.services:
            entry = service.as_dict()
            entry["icon"] = catalog_icon(service.id)
            entry["site"] = catalog_site(service.id)
            entry["pairable"] = service.id not in unpairable
            available.append(entry)

        out.append({
            "household": household.id,
            "generation": household.generation,
            "count": len(directory.services),
            "source": source,
            "in_use": in_use,
            "available": available,
        })
    return {"households": out}


@app.get("/api/services/{sid}/browse")
async def browse_service(
    sid: int,
    zone: str | None = None,
    item: str = "root",
    index: int = 0,
    count: int = Query(default=100, le=200),
    account: str = "",
    art: int = Query(default=0, le=2048),
) -> dict:
    """Browse a music service, talking to the provider rather than to Sonos.

    ``account`` names which of the household's accounts for the service to
    browse as, when a service has several; each is linked in Sonora on its own.

    A service whose policy is ``Anonymous`` answers with no credentials. The
    rest need a token that lives on the household and that the firmware does
    not expose, so they are reported as needing linking rather than shown as
    mysteriously empty.
    """
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None:
        raise HTTPException(503, "no household available")
    host = controller().any_host(household)
    if host is None:
        raise HTTPException(503, "no speaker available")

    directory = await ctl.service_directory(household)
    service = directory.by_id(sid)
    if service is None:
        raise HTTPException(404, f"service {sid} not in this household")

    payload = {
        "service": service.as_dict(),
        "household": household.id,
        "generation": household.generation,
    }
    # The household's registrations, for the account's serial number below
    # and to tell whether the service has a single account.
    regs = []
    if ctl.cloud.signed_in:
        try:
            regs = await ctl.cloud.registrations(household.cloud_id)
        except (CloudError, NotSignedIn):
            regs = []
    same = [r for r in regs if r.service_id == sid]
    creds = ctl.credentials_for(household.id, sid, account,
                                single_account=len(same) == 1) or {}

    device_id = await ctl.device_serial(household)
    page = None
    # A service whose manifest declares a browse endpoint shows that document
    # as its root, which is what the apps open on; below the root it is SMAPI
    # again, keyed by the object ids the document gives. A token is sent when
    # the household has one and left out when it does not: Sonos Radio's
    # endpoint answers with no credentials at all, and its SMAPI root is
    # empty, so without this its page in Sonora was blank.
    retry_endpoint, stale_token = "", ""
    if item == "root":
        endpoint = await ctl.presentation.browse_endpoint(service.manifest_uri)
        if endpoint:
            try:
                page = await ctl.contentsvc.home(
                    endpoint=endpoint, service_name=service.name,
                    token=creds.get("token", ""), device_id=device_id,
                    household_id=household.id,
                    filtering=ctl.smapi.filters(household.id))
            except SmapiError as exc:
                log.info("browse endpoint for %s failed, using SMAPI: %s",
                         service.name, exc)
                # The endpoint takes the same bearer token SMAPI does, and
                # only SMAPI can rotate it -- the provider hands the new pair
                # back inside a fault. So when the call below refreshes the
                # token, the endpoint is worth one more try: without it a
                # rotation left the person looking at the service's plain
                # SMAPI root, which is not what the app opens on (Spotify,
                # 2026-09-14: seven personalised rows there, five generic
                # categories here).
                retry_endpoint, stale_token = endpoint, creds.get("token", "")
    # A service the household knows but Sonora has no token for cannot be
    # asked over SMAPI: its account lives encrypted on the speakers and is
    # never handed back. Report that plainly so the client can offer to link
    # it in Sonora, rather than calling with no credentials, which each
    # provider rejects with a different, unhelpful fault.
    #
    # The browse endpoint above is tried first, because some of them need no
    # credentials at all: Sonos Radio's answers twenty-six shelves to an
    # anonymous caller, and the household's own account is DeviceLink, so
    # this refusal used to hide a service the product browses freely
    # (measured 2026-09-20). What is behind each shelf is still SMAPI's, and
    # still refused without a token.
    if page is None and service.auth != "Anonymous" and not creds.get("token"):
        payload["error"] = {
            "message": f"{service.name} is not linked in Sonora.",
            "needs_auth": True,
        }
        return payload

    if page is None:
        try:
            page = await ctl.smapi.get_metadata(
                endpoint=service.endpoint, service_name=service.name,
                item_id=item, index=index, count=count,
                household_id=household.id, token=creds.get("token", ""),
                key=creds.get("key", ""), device_id=device_id)
        except SmapiError as exc:
            log.info("browse of %s (account %r, item %r) failed: %s "
                     "[needs_auth=%s]", service.name, account, item, exc,
                     exc.needs_auth)
            # Only a failure at the service's root means "sign in": a provider
            # that refuses to open one item (a Pandora station answers
            # getMetadata with LoginUnsupported, because a station is played,
            # not browsed) is not asking for a link, and offering one named
            # after the item was wrong.
            payload["error"] = {
                "message": str(exc),
                "needs_auth": exc.needs_auth and item == "root",
            }
            return payload

    if retry_endpoint and stale_token:
        fresh = (ctl.credentials_for(household.id, sid, account,
                                     single_account=len(same) == 1) or {}).get("token", "")
        if fresh and fresh != stale_token:
            try:
                page = await ctl.contentsvc.home(
                    endpoint=retry_endpoint, service_name=service.name,
                    token=fresh, device_id=device_id,
                    household_id=household.id,
                    filtering=ctl.smapi.filters(household.id)) or page
            except SmapiError as exc:
                log.info("browse endpoint for %s still refused after a token "
                         "refresh: %s", service.name, exc)

    payload.update(page.as_dict())
    # How the service wants its rows drawn: the DisplayType map its rows'
    # ``display_type`` ids point into, so the client shows the lines the
    # service names and no others.
    payload["display_types"] = await ctl.presentation.display_types(service.manifest_uri)

    # Art at the size the caller draws it, where the service publishes sizes.
    # Providers hand out one URL per item at their own default size --
    # Pandora's covers arrive 90px square -- and a presentation map saying
    # what to swap the suffix for to get another. A controller asking for
    # nothing keeps what the provider sent, which is what the desktop apps
    # want; the web theme, whose tiles are 156px, asks for 290.
    if art:
        for row in payload.get("items", []):
            if row.get("art"):
                row["art"] = await ctl.presentation.sized(
                    service.manifest_uri, row["art"], art)

    # Give each playable item the URI and metadata a speaker plays it with.
    # That needs the account's serial number on the speaker, which the
    # household's registration list carries; a service Sonora alone holds has
    # no account on the speaker, so its items browse but cannot be played this
    # way, and are left without a URI.
    reg = (next((r for r in same if r.account_id == account), None) if account
           else (same[0] if same else None))
    sn = (reg.account_id or "0") if reg is not None else None
    if sn is None and service.in_use:
        sn = (await _household_serials(zone)).get(sid) or "0"
    if sn is None and service.auth == "Anonymous":
        # A service that needs no account has no serial to name, and its
        # items play with sn=0 whether or not the household lists it among
        # the ones in use. TuneIn is the case in point: the S1 household
        # never added it -- it is the radio the firmware ships with -- and
        # the app plays and favorites its stations all the same, while
        # Sonora was handing back rows with no URI, so nothing in a TuneIn
        # pane could be played or saved.
        sn = "0"
    if sn is not None:
        # The descriptor the speakers know this account by. An anonymous
        # account has no logon string, and composing one had every station
        # refused with UPnP 402 (Community Radio Plus).
        udn = ctl.account_udn(household.id, sid, sn)

        def furnish(raw: dict, item) -> None:
            built = playable(item, sid, sn, udn=udn)
            if built:
                raw["uri"], raw["metadata"] = built
            elif item.is_container:
                # Unplayable containers can still be favorited, as the apps
                # allow: keep the reference apart from the playable one.
                ref = playable(item, sid, sn, for_favorite=True, udn=udn)
                if ref:
                    raw["favorite_uri"], raw["favorite_metadata"] = ref

        for raw, item in zip(payload.get("items", []), page.items):
            furnish(raw, item)
            # A shelf's own rows need the same: they are what the page shows,
            # and without a URI a tile is a picture that does nothing when it
            # is clicked (Spotify's albums and Sonos Radio's stations, both
            # dead until this).
            for child_raw, child in zip(raw.get("children") or [], item.children):
                furnish(child_raw, child)

    # An empty root from a service Sonora holds no account for asks for a
    # sign-in. With an account it means what it says, as the apps show it:
    # Libby with nothing on loan opens on "No selections are available." in
    # the Windows app (2026-09-29) while Sonora offered to link it again. A
    # token the provider rejects arrives as a fault, handled above. Below the
    # root an empty container is always just empty: Amazon Music's "Try
    # Amazon Music Unlimited" opens on the same line (2026-09-14).
    if not page.items and service.auth != "Anonymous" and item == "root" and not creds:
        payload["error"] = {
            "message": f"{service.name} returned nothing without an account.",
            "needs_auth": True,
        }
    return payload


@app.get("/api/services/{sid}/search")
async def search_service(
    sid: int,
    term: str,
    zone: str | None = None,
    account: str = "",
    category: str = "",
    count: int = Query(default=10, le=50),
    index: int = Query(default=0, ge=0),
) -> dict:
    """Search a music service, category by category, as the desktop apps do.

    The provider's own categories are asked for first; each is searched in
    turn (the empty ones are dropped), and playable results get the URI a
    speaker plays them with, as browse results do. Credentials follow the
    same rules as browsing: an anonymous service needs none, any other needs
    Sonora's own login for the chosen account.
    """
    ctl = controller()
    household = (ctl.household_of(zone) if zone
                 else next(iter(ctl.ordered_households()), None))
    if household is None:
        raise HTTPException(503, "no household available")
    host = controller().any_host(household)
    if host is None:
        raise HTTPException(503, "no speaker available")
    directory = await ctl.service_directory(household)
    service = directory.by_id(sid)
    if service is None:
        raise HTTPException(404, f"service {sid} not in this household")
    payload: dict = {"service": service.as_dict(), "household": household.id,
                     "generation": household.generation, "term": term,
                     # Every category the provider offers, for the scope bar's
                     # tabs, whether or not this call searched them.
                     "available": [], "categories": []}
    regs = []
    if ctl.cloud.signed_in:
        try:
            regs = await ctl.cloud.registrations(household.cloud_id)
        except (CloudError, NotSignedIn):
            regs = []
    same = [r for r in regs if r.service_id == sid]
    creds = ctl.credentials_for(household.id, sid, account,
                                single_account=len(same) == 1) or {}
    # A service Sonora holds no token for is normally refused here: its
    # account lives encrypted on the speakers and calling a provider with no
    # credentials earns a different unhelpful fault from each one.
    #
    # The exception is a service whose own browse endpoint answers an
    # anonymous caller, which is how its page is drawn here already. Sonos
    # Radio is the one: the household's account is DeviceLink, Sonora has no
    # token for it, and it answers a search with no credentials at all --
    # nine stations for "The Cure", where this refusal left the product
    # showing a section and Sonora showing none (measured 2026-09-20).
    public = bool(service.manifest_uri) and await ctl.presentation.public_home(
        service.manifest_uri)
    if service.auth != "Anonymous" and not creds.get("token") and not public:
        payload["error"] = {"message": f"{service.name} is not linked in Sonora.",
                            "needs_auth": True}
        return payload
    device_id = await ctl.device_serial(household)
    common = dict(endpoint=service.endpoint, service_name=service.name,
                  household_id=household.id, token=creds.get("token", ""),
                  key=creds.get("key", ""), device_id=device_id)
    reg = (next((r for r in same if r.account_id == account), None) if account
           else (same[0] if same else None))
    sn = (reg.account_id or "0") if reg is not None else None
    if sn is None and service.in_use:
        sn = (await _household_serials(zone)).get(sid) or "0"
    if sn is None and service.auth == "Anonymous":
        # A service that needs no account has no serial to name, and its
        # items play with sn=0 whether or not the household lists it among
        # the ones in use. TuneIn is the case in point: the S1 household
        # never added it -- it is the radio the firmware ships with -- and
        # the app plays and favorites its stations all the same, while
        # Sonora was handing back rows with no URI, so nothing in a TuneIn
        # pane could be played or saved.
        sn = "0"
    term = term.strip()
    if not term:
        return payload
    # The service's presentation map is the apps' source for the scope bar:
    # it names Sonos' own category ids (the controller labels those --
    # "podcasts" reads "Podcasts & Shows" even though TuneIn's SMAPI tree
    # calls the container "Shows") and gives the id to search for each. A
    # service without a Search map falls back to its own search tree.
    declared = await ctl.presentation.search_categories(service.manifest_uri)
    custom_ids: set[str] = set()
    if declared:
        # A category whose label the map's strings do not give takes the
        # title the service's own search tree gives the id it maps to: the
        # app's tabs over Mixcloud read Tags, Shows, Users, and two of those
        # have no string in its map (2026-09-23).
        if any(not cat["label"] for cat in declared):
            try:
                titles = {cid.lower(): title for cid, title
                          in await ctl.smapi.search_categories(**common)}
            except SmapiError:
                titles = {}
            for cat in declared:
                if not cat["label"]:
                    cat["label"] = titles.get((cat["mapped_id"] or "").lower(), "")
        categories = [(cat["id"], cat["label"], cat["mapped_id"]) for cat in declared]
        custom_ids = {cat["id"] for cat in declared if cat.get("custom")}
    else:
        categories = [(cat_id, title, cat_id)
                      for cat_id, title in await ctl.smapi.search_categories(**common)]
    payload["available"] = [{"id": cat_id, "title": title, "custom": cat_id in custom_ids}
                            for cat_id, title, _ in categories]
    # The apps search one category at a time: the scope bar names them all
    # and asks for the one whose tab is showing. Without a category named,
    # the service's own "all" answers if it has one, and every category is
    # searched if it has not.
    #
    # An all category has already done the mixing, so searching the others
    # beside it returns the same items over again: Pandora answered "The
    # Cure" three times, once from all, once from artists, and once from
    # stations, where the product shows its nine stations once each in the
    # order all gives them (measured 2026-09-20). The category's own id says
    # so, not what it maps to -- Amazon Music's all maps to
    # "catalog:universal:search", and searching its six others beside it put
    # a podcast episode at the head of a list the product opens with an
    # album.
    everything = [entry for entry in categories if entry[0] == "all"]
    wanted = ([entry for entry in categories if entry[0] == category]
              or categories[:1]) if category else (everything or categories[:6])

    async def one(cat_id: str):
        """One category's results, or None when it has none to give."""
        try:
            # index pages one category onward, as the product's View All
            # page does while it is scrolled (2026-09-22).
            return await ctl.smapi.search(category_id=cat_id, term=term,
                                          index=index, count=count, **common)
        except SmapiError as exc:
            log.info("search of %s in %s failed: %s", service.name, cat_id, exc)
            return None

    # Every category at once. Asked one after another, a search of a cloud
    # service took 18 seconds for six categories (measured 2026-09-06);
    # together it costs the slowest one. The order the provider listed them
    # in is kept, since that is the order the apps show them in.
    pages = await asyncio.gather(*(one(mapped) for _, _, mapped in wanted))
    for (cat_id, cat_title, _mapped), page in zip(wanted, pages):
        if page is None or not page.items:
            continue
        rows = page.as_dict().get("items", [])
        if sn is not None:
            udn = ctl.account_udn(household.id, sid, sn)
            for raw, item in zip(rows, page.items):
                built = playable(item, sid, sn, udn=udn)
                if built:
                    raw["uri"], raw["metadata"] = built
                elif item.is_container:
                    # Not playable, but the apps still let it be favorited.
                    ref = playable(item, sid, sn, for_favorite=True, udn=udn)
                    if ref:
                        raw["favorite_uri"], raw["favorite_metadata"] = ref
        payload["categories"].append({"id": cat_id, "title": cat_title, "items": rows,
                                      "total": page.total, "index": index})
    payload["categories"].sort(key=_search_rank)
    # Results are drawn from the same DisplayType map a browse page uses --
    # the app prints "Dr. Dre" and not "Dr. Dre - 2001" under a Spotify track
    # because Spotify's map gives itemType "track" the lines title, artist --
    # so the map has to reach the search view as well.
    payload["display_types"] = await ctl.presentation.display_types(service.manifest_uri)
    return payload


#: What a search category returns, in the order the product mixes them.
#: Its list is one row from each category in turn -- Mixcloud's artists,
#: shows and tags come out one per column -- and the turn is taken by the
#: kind of thing the category answers with, not by the order the service
#: declares them in: SoundCloud declares artists, albums, tracks, and the
#: product draws artists, tracks, albums; Community Radio Plus declares
#: stations first and the product puts its songs there (measured on
#: play.sonos.com 2026-09-20).
_SEARCH_KIND_ORDER = {
    "artist": 0,
    "track": 1, "song": 1,
    "album": 2,
    "playlist": 3,
    "stream": 4, "station": 4, "program": 4,
}


def _search_rank(category: dict) -> int:
    items = category.get("items") or []
    kind = (items[0].get("item_type") or "") if items else ""
    return _SEARCH_KIND_ORDER.get(kind, 5)


async def _rate_through_player(ctl, household, zone_uuid: str, item_id: str, button: dict):
    """Rate the playing item through the group coordinator's local API.

    Returns the resulting state (0 none, 1 up, 2 down) or None when the
    player did not take the request, in which case the caller rates the
    provider itself.

    Which rating to send comes from the service's own map: a button carries
    the word the players use for it (THUMBSUP, THUMBSDOWN) and whether the
    item already has it, so a press on a button whose state is RATED is the
    one that takes the rating away and sends NONE. That is what the S1 apps'
    toggle does. A service whose map names no such word -- AccuRadio's star
    and ban, Amazon Music's heart -- is rated with the provider instead.
    """
    kind = str(button.get("rating_type", "")).upper()
    if kind not in ("THUMBSUP", "THUMBSDOWN"):
        return None
    if str(button.get("rating_state", "")).upper() == "RATED":
        kind = "NONE"
    # The speakers want the api-key header present and do not look at its
    # value: a rating sent with Sonora's own key is taken exactly as one sent
    # with the S1 app's, and the speaker publishes the new rating either way
    # (measured 2026-09-18, thumbs up then off again).
    key = const.SONORA_API_KEY
    try:
        coordinator = ctl.coordinator_of(zone_uuid)
        group = household.group_for_zone(zone_uuid)
    except Exception:
        return None
    if group is None or not getattr(group, "id", ""):
        return None
    url = (f"http://{coordinator.host}:1400/api/v1/households/local/groups/"
           f"{quote(group.id, safe='')}/playbackMetadata/ratings")
    headers = {"Content-Type": "application/json", "X-Sonos-SWGen": "1",
               "X-Sonos-Api-Key": key}
    try:
        async with ctl.smapi._session.post(
                url, json={"itemId": item_id, "rating": {"type": kind}},
                headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            text = await resp.text()
            if resp.status != 200:
                log.info("player rating refused (%s): %s", resp.status, text[:200])
                return None
            try:
                data = json.loads(text)
            except ValueError:
                data = {}
    except Exception as exc:
        log.info("player rating failed: %s", exc)
        return None
    answered = ((data.get("rating") or {}).get("type") or kind).upper()
    return {"THUMBSUP": 1, "THUMBSDOWN": 2}.get(answered, 0)


class RateBody(BaseModel):
    zone: str
    item_id: str
    #: The rating id from the service's own map, and the item's rating state
    #: as the interface has it (0 none, 1 up, 2 down).
    rating: str | None = None
    current: int = 0
    account: str = ""


#: sid -> {rating id: the provider's confirmation text}, read once from the
#: provider's manifest (presentation map for the string ids, strings file for
#: the words). The desktop apps show exactly this text after a rating.
_RATING_TEXT: dict[int, dict[int, str]] = {}


async def _rating_texts(service) -> dict[int, str]:
    """rating id -> the provider's confirmation text, in the UI language.

    Read through the presentation-map reader, which picks the right
    stringtable; a raw scan of the strings file returned the first language
    listed (Chinese for AccuRadio).
    """
    if service.id in _RATING_TEXT:
        return _RATING_TEXT[service.id]
    texts: dict[int, str] = {}
    try:
        if service.manifest_uri:
            rating_map = await controller().presentation.ratings(service.manifest_uri)
            for buttons in (rating_map.get("matches") or {}).values():
                for button in buttons:
                    try:
                        texts[int(button.get("id"))] = button.get("message", "")
                    except (TypeError, ValueError):
                        continue
    except Exception as exc:  # the rating itself does not depend on this
        log.info("rating texts for %s unavailable: %s", service.name, exc)
    _RATING_TEXT[service.id] = texts
    return texts


def _family(icon: str) -> tuple[str, bool]:
    """A rating icon's family and whether it is the given (selected) one,
    from the name Sonos files it under (THUMBSUP_SELECTED-pcdcr.png)."""
    name = (icon or "").rsplit("/", 1)[-1].upper()
    family = name.split("_", 1)[0]
    return family, "_SELECTED" in name and "UNSELECTED" not in name


def rating_is_inert(button: dict, rating_map: dict) -> bool:
    """Whether pressing this button would only give the rating again.

    A given rating's button normally takes it away: Pandora's lit thumb says
    REMOVE_THUMBS_UP, Spotify's lit heart REMOVE_TRACK_FROM_YOUR_MUSIC. A few
    maps have no way back: AccuRadio's lit star is "VoteUp" with the success
    message of the star that gave it, and pressing it left the track loved
    (measured 2026-10-01; iHeartRadio's lit thumbs are drawn the same way).
    Such a button is lit and given in the same words as its unlit self, so
    that is the test: a selected icon whose string and success message are
    those of an unselected button of the same family. Read off the map, so it
    holds for any service drawn this way.
    """
    family, selected = _family(button.get("icon", ""))
    if not selected or not family:
        return False
    if str(button.get("rating_state", "")).upper() == "RATED":
        return False
    for buttons in (rating_map.get("matches") or {}).values():
        for other in buttons:
            ofamily, oselected = _family(other.get("icon", ""))
            if (ofamily == family and not oselected
                    and other.get("string_id") == button.get("string_id")
                    and other.get("on_success") == button.get("on_success")):
                return True
    return False


def rating_toggled_icon(button: dict, rating_map: dict) -> str:
    """The picture this button shows once pressed, when it is a toggle.

    A heart or a thumb that is given or not flips between its family's
    selected and unselected pictures, and the pages draw that flip the
    moment it is pressed rather than after the service answers. A button
    that skips the track (AutoSkip ALWAYS) or would only repeat its rating
    (rating_is_inert) is no toggle, and has none.
    """
    family, selected = _family(button.get("icon", ""))
    if not family or "SELECTED" not in (button.get("icon", "") or "").upper():
        return ""
    if str(button.get("auto_skip", "")).upper() == "ALWAYS" or rating_is_inert(button, rating_map):
        return ""
    for buttons in (rating_map.get("matches") or {}).values():
        for other in buttons:
            ofamily, oselected = _family(other.get("icon", ""))
            if ofamily == family and oselected != selected and other.get("icon"):
                return other["icon"]
    return ""


async def _rating_button(ctl, service, rating_id) -> dict:
    """The button a rating id belongs to, out of the service's own map."""
    try:
        rating_map = await ctl.presentation.ratings(service.manifest_uri)
    except Exception:
        return {}
    for buttons in (rating_map.get("matches") or {}).values():
        for button in buttons:
            if str(button.get("id")) == str(rating_id):
                return button
    return {}


@app.post("/api/services/{sid}/rate")
async def rate_item(sid: int, body: RateBody) -> dict:
    """Rate the item a room is playing, as the app's thumbs do."""
    ctl = controller()
    if body.rating is None:
        raise HTTPException(400, "name the rating the service's map gives")
    rating_id, next_state, skip = body.rating, body.current, False
    household = ctl.household_of(body.zone)
    if household is None:
        raise HTTPException(404, f"unknown zone {body.zone}")
    host = controller().any_host(household)
    if host is None:
        raise HTTPException(503, "no speaker available")
    directory = await ctl.service_directory(household)
    service = directory.by_id(sid)
    if service is None:
        raise HTTPException(404, f"service {sid} not in this household")
    regs = []
    if ctl.cloud.signed_in:
        try:
            regs = await ctl.cloud.registrations(household.cloud_id)
        except (CloudError, NotSignedIn):
            regs = []
    same = [r for r in regs if r.service_id == sid]
    # The item rated is the one the room plays, so the account is the one its
    # track names when the page names none: with two Spotify accounts on the
    # household the heart otherwise found no login and was refused.
    account = body.account
    if not account and body.zone in ctl.zones:
        account = smapi_account_serial(ctl.coordinator_of(body.zone).transport.track_uri or "")
    creds = ctl.credentials_for(household.id, sid, _item_account(ctl, household, sid, account),
                                single_account=len(same) == 1) or {}
    if service.auth != "Anonymous" and not creds.get("token"):
        raise HTTPException(409, f"{service.name} is not linked in Sonora.")
    # First choice: ask the player to rate, as the S1 apps do
    # (POST .../playbackMetadata/ratings on the group coordinator). The player
    # rates with the household's own account and updates the track's
    # r:rating at once, so every controller agrees. Sonora's own SMAPI call
    # is the fallback when the player will not.
    dynamic_message = ""
    button = await _rating_button(ctl, service, rating_id)
    # A lit button that would only give its rating again is not sent: the
    # pages draw it as doing nothing, and a request for it is answered alike.
    try:
        inert = bool(button) and rating_is_inert(button, await ctl.presentation.ratings(service.manifest_uri))
    except Exception:
        inert = False
    if inert:
        return {"ok": True, "skipped": False, "state": next_state, "message": "", "unchanged": True}
    # A rating the service's own map marks AutoSkip="ALWAYS" (AccuRadio's and
    # Deezer's, LiveOne's, Audible's, and Pandora's bans, surveyed 2026-09-07
    # -- the only values in use are ALWAYS and NEVER) moves the room on to the
    # next track, which is what the apps do. It applies whichever way the
    # rating reached the service.
    skip = str(button.get("auto_skip", "")).upper() == "ALWAYS"
    via_player = await _rate_through_player(ctl, household, body.zone,
                                            body.item_id, button)
    if via_player is not None:
        next_state = via_player
    else:
        device_id = await ctl.device_serial(household)
        try:
            answer = await ctl.smapi.rate_item(
                endpoint=service.endpoint, service_name=service.name, item_id=body.item_id,
                rating=int(rating_id), household_id=household.id, token=creds.get("token", ""),
                key=creds.get("key", ""), device_id=device_id)
        except SmapiError as exc:
            raise HTTPException(502, str(exc)) from exc
        # The provider may also answer shouldSkip for a rating its map does
        # not mark.
        skip = skip or answer.should_skip
        dynamic_message = answer.message_string_id
    skipped = False
    if skip:
        try:
            await commands().next_track(body.zone)
            skipped = True
        except Exception as exc:  # the rating stood; the skip is a courtesy
            log.info("skip after rating failed: %s", exc)
    texts = await _rating_texts(service)
    message = texts.get(int(rating_id), "")
    if dynamic_message:
        # The provider named a message of its own for this answer (why it
        # skipped, say); it takes precedence over the map's OnSuccess text.
        message = (await _rating_strings(ctl, service)).get(dynamic_message) or message
    return {"ok": True, "skipped": skipped, "state": next_state, "message": message}


async def _rating_strings(ctl, service) -> dict[str, str]:
    """The service's strings table (UI language), for dynamic message ids."""
    try:
        return (await ctl.presentation.ratings(service.manifest_uri)).get("strings") or {}
    except Exception:
        return {}


class LinkBody(BaseModel):
    zone: str
    link_code: str = ""
    device_id: str = ""
    #: The household account being linked, when the service is already on the
    #: system; empty for a service the household does not have.
    account_id: str = ""
    #: Reauthorize: a fresh sign-in whose login also replaces the household
    #: account's own, in place, so its Favorites keep playing.
    reauthorize: bool = False


async def _service_for(sid: int, zone: str):
    ctl = controller()
    household = ctl.household_of(zone)
    if household is None:
        raise HTTPException(404, f"unknown zone {zone}")
    host = controller().any_host(household)
    if host is None:
        raise HTTPException(503, "no speaker available")
    # Linking and unlinking need only the service's endpoint, which an account
    # change does not move. Waiting for a fresh catalog here held each sign-in
    # poll 9 to 18 s while a dozen players reported the change one by one,
    # and Libby's link took half a minute to confirm.
    directory = await ctl.service_directory(household, stale_ok=True)
    service = directory.by_id(sid)
    if service is None:
        raise HTTPException(404, f"service {sid} not in this household")
    return ctl, household, service


@app.post("/api/services/{sid}/link")
async def link_service(sid: int, body: LinkBody) -> dict:
    """Begin adding a music service to the household.

    An ``Anonymous`` service is added outright. Otherwise the provider is
    asked for a link code and a registration URL; the person signs in there
    and the caller then polls ``/link/complete``. Providers that only work
    through Sonos' app answer without a code, and that is reported as such.
    """
    ctl, household, service = await _service_for(sid, body.zone)
    if service.auth == "Anonymous":
        # No account is needed to browse or play an anonymous service, so the
        # speaker call is best-effort: it registers the service on the household
        # when it can, but even if the firmware refuses, the service is still
        # usable in Sonora. Recording it here is what makes it appear in
        # Sonora's list, the same as a linked account does.
        registered = True
        try:
            await commands().add_anonymous_account(body.zone, sid)
        except Exception as exc:
            registered = False
            log.info("anonymous add of %s not accepted by the household: %s",
                     service.name, exc)
        ctl.remember_linked_service(household.id, sid, {
            "id": sid, "service_id": sid, "name": service.name,
            "nickname": "", "account_id": "", "initials": service.initials,
            "icon": "", "auth": service.auth, "sonora_only": not registered})
        # As for a removal: the probe that says it is there is asked again.
        # Added again straight after a removal, it must not stay hidden as just removed.
        ctl.clear_removed_service(household.id, sid)
        ctl.services.forget_anonymous()
        ctl.forget_service_directory(household.id)
        ctl.cloud.forget_registrations(household.cloud_id)
        await _fan_out({"type": "services"})
        return {"linked": True, "registered": registered,
                "method": "anonymous", "service": service.name}
    # The same device id must identify the controller when the link is started
    # and when the token is polled for; a provider that ties the pending link
    # to the id it first saw (Plex does) otherwise never matches the poll and
    # stays "pending" forever. So both calls use the household's serial.
    device_id = await ctl.device_serial(household)
    try:
        if service.auth == "DeviceLink":
            details = await ctl.smapi.get_device_link_code(
                endpoint=service.endpoint, service_name=service.name,
                household_id=household.id, device_id=device_id)
        else:
            details = await ctl.smapi.get_app_link(
                endpoint=service.endpoint, service_name=service.name,
                household_id=household.id, device_id=device_id)
    except SmapiError as exc:
        # The provider would not even start a sign-in for a caller that is not
        # Sonos' own app (SoundCloud answers 403). Whether a provider allows
        # this is only learnt by asking: Plex, Spotify and Pandora are all
        # "AppLink" and do hand out a link. So this is reported as the
        # only-through-the-Sonos-app case, not as a server failure.
        log.info("%s refused to start a sign-in from Sonora: %s",
                 service.name, exc)
        return {"linked": False, "method": "app", "service": service.name,
                "detail": str(exc)}
    if not details.get("link_code") or not details.get("reg_url"):
        return {"linked": False, "method": "app", "service": service.name,
                "detail": "the provider offers no code-entry sign-in; "
                          "it can only be added with the Sonos app"}
    return {"linked": False, "method": "code", "service": service.name,
            **details}


#: Link codes that have finished, with the answer they finished with.
_LINKED_CODES: dict[tuple[str, int, str], dict] = {}


@app.post("/api/services/{sid}/link/complete")
async def complete_link(sid: int, body: LinkBody) -> dict:
    """One poll of the provider; stores the account once it answers.

    Idempotent: once a token is held for this service, the link is done, so a
    repeat poll returns success rather than asking the provider again. Polls
    can overlap, and the provider rejects a link code the moment it is consumed,
    which would otherwise turn the winning poll's own follow-up into a 502 even
    though the link succeeded.
    """
    ctl, household, service = await _service_for(sid, body.zone)
    device_id = await ctl.device_serial(household)
    # A poll for a code that already linked: two open dialogs, or one still
    # polling after the other won, asked again, and Mixcloud handed the same
    # login over a second time, which Sonora kept as a login of no account.
    # A finished code is done; say so and ask nobody.
    done = _LINKED_CODES.get((household.id, sid, body.link_code))
    if done is not None:
        return done
    if not body.reauthorize and (household.id, sid, body.account_id) in ctl.service_tokens:
        # Sonora holds this login already. If the household has since lost
        # the service (removed in a Sonos app), the login it holds goes back
        # on, rather than the link ending as Sonora's alone.
        on_household = bool(_service_accounts(ctl, household, sid))
        if not on_household:
            held = ctl.service_tokens[(household.id, sid, body.account_id)]
            try:
                await commands().add_oauth_account(body.zone, sid, held["token"], held["key"], device_id)
                on_household = True
                ctl.forget_service_directory(household.id)
                ctl.cloud.forget_registrations(household.cloud_id)
                await _fan_out({"type": "services"})
            except Exception as exc:
                log.info("%s: the speakers did not take the held login: %s", service.name, exc)
        return {"linked": True, "registered": on_household, "service": service.name,
                "nickname": ctl.linked_services.get(household.id, {})
                             .get(sid, {}).get("nickname", "")}
    try:
        auth = await ctl.smapi.get_device_auth_token(
            endpoint=service.endpoint, service_name=service.name,
            household_id=household.id, link_code=body.link_code,
            link_device_id=body.device_id, device_id=device_id)
    except SmapiError as exc:
        # A dropped connection between polls is the provider's network, not an
        # answer: Mixcloud reset one mid-link and the add ended there
        # (2026-09-28). The page polls again, as it does for "not yet".
        if exc.pending or exc.code == "Transport":
            return {"linked": False, "pending": True}
        raise HTTPException(502, str(exc)) from exc
    # Keep and persist the login token so Sonora can browse the service now and
    # after a restart. Getting it does not put the account on the Sonos system;
    # see below.
    known_now = ctl.cloud.last_registrations(household.cloud_id) or []
    ctl.remember_service_token(
        household.id, sid, auth["token"], auth["key"], body.account_id,
        standalone=not body.account_id,
        seen_accounts=[r.account_id for r in known_now
                       if r.service_id == sid and r.account_id])
    nickname = auth.get("nickname", "")

    # The account goes on the Sonos system too, so the speakers can play it
    # and every Sonos app lists it: SystemProperties#AddOAuthAccountX, its
    # token, key and device id sealed under the household cipher. Sent in the
    # clear it was always refused with 402, and for a long time that read as
    # Sonos having locked this down. Only when the household has
    # no account for the service already: linking again for one it has is
    # Sonora signing in to it, not a second account.
    on_household = bool(_service_accounts(ctl, household, sid))
    registered = False
    replaced = False
    if body.reauthorize and on_household:
        # The Sonos app's Reauthorize: the household's account takes the new
        # login in place (ReplaceAccountX), keeping its serial number, so what
        # was saved against it goes on playing. The account is the one named,
        # or the service's only one.
        accounts = [a for a in ctl.household_accounts(household.id) if a.service_id == sid]
        target = next((a for a in accounts if body.account_id and a.serial == body.account_id), None)
        if target is None and len(accounts) == 1:
            target = accounts[0]
        if target is not None:
            try:
                await commands().replace_oauth_account(body.zone, target.udn, auth["token"], auth["key"], device_id)
                registered = replaced = True
                # Sonora and the speakers now hold the same login; a rotation
                # Sonora receives is handed on (controller._refresh_service_token).
                ctl.remember_service_token(household.id, sid, auth["token"], auth["key"],
                                           body.account_id, system_udn=target.udn)
            except Exception as exc:
                log.info("%s: the speakers did not take the new login in place: %s",
                         service.name, exc)
    elif not on_household:
        try:
            await commands().add_oauth_account(body.zone, sid, auth["token"], auth["key"], device_id)
            registered = True
            on_household = True
        except Exception as exc:
            log.info("%s linked in Sonora; the speakers did not take the account: %s",
                     service.name, exc)
    # Whether the household has this service decides how the record is
    # treated later: one the household has is dropped if the household drops
    # it; one Sonora alone holds stays.
    ctl.remember_linked_service(household.id, sid, {
        "id": sid, "service_id": sid, "name": service.name,
        "nickname": nickname, "account_id": body.account_id, "initials": service.initials,
        "icon": "", "auth": service.auth, "sonora_only": not on_household})
    ctl.cloud.forget_registrations(household.cloud_id)
    ctl.forget_service_directory(household.id)
    await _fan_out({"type": "services"})
    answer = {"linked": True, "registered": registered or on_household,
              "service": service.name, "nickname": nickname}
    if body.reauthorize:
        # Whether the speakers took the new login; when they did not, Sonora
        # is signed in again but the household account is as it was.
        answer["replaced"] = replaced
    if body.link_code:
        _LINKED_CODES[(household.id, sid, body.link_code)] = answer
        while len(_LINKED_CODES) > 200:
            del _LINKED_CODES[next(iter(_LINKED_CODES))]
    return answer


class RemoveBody(BaseModel):
    zone: str
    account_id: str = ""
    #: Drop Sonora's own sign-in and listing for the service.
    from_sonora: bool = True
    #: Take the account off the Sonos system too, for every app.
    from_system: bool = False



def _service_accounts(ctl, household, sid: int) -> list[tuple[str, str, int]]:
    """A service's accounts on the household: (serial, logon string, type).

    The cloud's registration list when Sonora holds one, otherwise the
    speakers' own account list, which carries the same serial numbers and
    needs no sign-in.
    """
    known = ctl.cloud.last_registrations(household.cloud_id) or []
    same = [(r.account_id, r.username, r.service_type) for r in known if r.service_id == sid]
    if same:
        return same
    return [(a.serial, a.username, a.service_type) for a in ctl.household_accounts(household.id)
            if a.service_id == sid and a.username]

@app.delete("/api/services/{sid}")
async def remove_service(sid: int, body: RemoveBody) -> dict:
    """Remove a music service from Sonora, from the Sonos system, or both.

    The two sides are independent. ``from_sonora`` drops Sonora's own sign-in
    and link record. ``from_system`` takes the account off the household
    through the speakers (``SystemProperties#RemoveAccount``, what the desktop
    app's Service Settings "Remove" does), so every Sonos app sees it go. At
    least one must be set. A service that was never on the household has no
    account there to remove, which is not an error; a refusal for one that is
    on the household is reported rather than papered over.
    """
    if not body.from_sonora and not body.from_system:
        raise HTTPException(400, "nothing to remove: set from_sonora or from_system")
    ctl, household, service = await _service_for(sid, body.zone)
    same = _service_accounts(ctl, household, sid)
    on_household = bool(same)
    household_removed = False
    if body.from_system:
        # The speakers identify an account by its logon string, not by the
        # serial number the cloud list and playback URIs use: given the serial
        # (28) the firmware matched nothing and took off the oldest account of
        # that type (9). An account-less service has neither and is removed by
        # type alone.
        reg = next((r for r in same if r[0] == body.account_id), None)
        account_key = ""
        if body.account_id:
            if reg is None or not reg[1]:
                raise HTTPException(
                    409, f"{service.name}: the account's identifier on the speakers "
                         "is not known; remove it in the Sonos app.")
            account_key = reg[1]
        log.info("removing %s (sn %r, id %r) from household %s",
                 service.name, body.account_id, account_key, household.id[:22])
        try:
            await commands().remove_account(body.zone, sid, account_key)
            household_removed = True
        except Exception as exc:
            if on_household:
                raise HTTPException(502, f"{service.name}: {exc}") from exc
    # A service that needs no sign-in has no login for Sonora to keep, so taking it off
    # the system takes Sonora's record of it too; kept, it went on listing the service
    # as Sonora's own (CBC on S1).
    if household_removed and service.auth == "Anonymous":
        ctl.forget_linked_service(household.id, sid)
    if body.from_sonora:
        ctl.forget_service_token(household.id, sid, body.account_id)
        if not body.account_id:
            ctl.forget_service_token(household.id, sid, "")
        # The link record is per service; it goes once no account's login is left.
        if not ctl.tokens_for_service(household.id, sid):
            ctl.forget_linked_service(household.id, sid)
    elif household_removed and service.auth != "Anonymous" and (
            ctl.tokens_for_service(household.id, sid)
            or sid in ctl.linked_services.get(household.id, {})):
        # Removed from Sonos but kept in Sonora: it is now Sonora's alone, so
        # its record is marked Sonora-only and its token kept, otherwise the
        # reconcile would purge a record the household no longer lists.
        existing = ctl.linked_services.get(household.id, {}).get(sid, {})
        ctl.remember_linked_service(household.id, sid, {
            "id": sid, "service_id": sid, "name": service.name,
            "nickname": existing.get("nickname", ""), "account_id": "",
            "initials": service.initials, "icon": existing.get("icon", ""),
            "auth": service.auth, "sonora_only": True})
    # Noted after any re-record above, which would clear it. Hides the service
    # from the household list while the cloud catches up with the speakers.
    if household_removed:
        ctl.remember_removed_service(household.id, sid, body.account_id)
        # An anonymous service is known to be on the household only by probing the
        # speakers, and that answer is kept a quarter of an hour; the speakers send no
        # event for its removal, so the probe is asked again (CBC on S1, 2026-10-05).
        ctl.services.forget_anonymous()
        ctl.forget_service_directory(household.id)
    ctl.cloud.forget_registrations(household.cloud_id)
    await _fan_out({"type": "services"})
    return {"removed": True, "household_removed": household_removed,
            "from_sonora": body.from_sonora, "service": service.name}


class NicknameBody(BaseModel):
    zone: str
    #: The account's serial number, when a service holds more than one.
    account_id: str = ""
    nickname: str


@app.post("/api/services/{sid}/nickname")
async def rename_service_account(sid: int, body: NicknameBody) -> dict:
    """Rename a service account on the household.

    What Service Settings' "Edit" does: one ``SetAccountNicknameX`` naming the
    account by its UDN, ``SA_RINCON<type>_<logon string>``. Both arguments are
    sealed under the household cipher, which is what the ``X`` means; see
    ``rename_account``. The speakers apply it household-wide, so every Sonos
    app sees the new name.
    """
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(400, "a name is required")
    ctl, household, service = await _service_for(sid, body.zone)
    same = _service_accounts(ctl, household, sid)
    reg = next((r for r in same if r[0] == body.account_id), None)
    if reg is None and not body.account_id and len(same) == 1:
        reg = same[0]
    if reg is None or not reg[1]:
        # An anonymous service has no logon string and so no account to name;
        # the app leaves Edit disabled for those rows.
        raise HTTPException(
            409, f"{service.name}: this account cannot be renamed from here.")
    udn = account_udn(reg[2], reg[1])
    try:
        await commands().rename_account(body.zone, udn, nickname)
    except Exception as exc:
        raise HTTPException(502, f"{service.name}: {exc}") from exc
    # The speakers republish their account list a moment later; the client
    # refetches sooner than that, so the new name is recorded here as well.
    ctl.note_account_renamed(household.id, udn, nickname)
    ctl.cloud.forget_registrations(household.cloud_id)
    linked = ctl.linked_services.get(household.id, {}).get(sid)
    if linked is not None:
        ctl.remember_linked_service(household.id, sid,
                                    {**linked, "nickname": nickname})
    await _fan_out({"type": "services"})
    return {"renamed": True, "service": service.name, "nickname": nickname}


class TimeBody(BaseModel):
    zone: str
    index: int | None = None
    auto_dst: bool | None = None
    #: True selects Sonos' NTP pool; False leaves the clock to be set by hand.
    internet_time: bool | None = None
    time_format: str | None = None
    date_format: str | None = None
    #: ``YYYY-MM-DD HH:MM:SS`` local time, applied with the current zone.
    desired_time: str | None = None


#: Stations whose own picture was already asked for, so a list served again
#: does not ask again (the answer, even an empty one, is kept).
_STATION_ART: dict[tuple[str, str], str] = {}


async def _station_pictures(ctl, household, items: list[dict], host: str) -> None:
    """A station's own picture for each station on the list that has only
    a song's.

    A station entry was recorded with whatever art the room showed when it
    started, and with no picture in the station's own metadata that was the
    playing song's /getaa -- which the speakers stop serving once that song
    is long gone: Chill, Lovers Rock Reggae (AccuRadio) and 80s80s
    Alternative all drew the empty note on the home page, the
    speaker answering 404 for the station's URI as well. The service knows
    the station's picture, so it is asked, once per station, and the answer
    is kept on the list.
    """
    favorites: dict[str, str] | None = None

    async def favorite_art(uri: str) -> str:
        # AccuRadio answers getMediaMetadata for a station with a server
        # error; a Sonos Favorite of the same station carries its picture.
        nonlocal favorites
        if favorites is None:
            favorites = {}
            try:
                for fav in await ctl.content.favorites(host):
                    raw = fav.as_dict(host)
                    if raw.get("uri") and raw.get("art"):
                        favorites[unquote(raw["uri"]).split("?")[0]] = raw["art"]
            except Exception as exc:
                log.info("no favorites for station pictures: %s", exc)
        return favorites.get(unquote(uri).split("?")[0], "")

    async def one(entry: dict) -> None:
        uri, art = entry.get("uri", ""), entry.get("art", "")
        # Streams of every kind a service hands the speaker: radio, plain and HLS (Mixcloud's
        # shows are x-sonosapi-hls-static, and had been left without a picture).
        if not uri.startswith(("x-sonosapi-radio:", "x-sonosapi-stream:", "x-sonosapi-hls:", "x-sonosapi-hls-static:")):
            return
        # Only a speaker's picture is in doubt; a service's own URL stands.
        # One naming the station's own URI is asked about all the same: the
        # speaker answered 404 for 80s80s Alternative's.
        if art and not art.startswith("/getaa"):
            return
        key = (household.id, uri)
        if key in _STATION_ART:
            found = _STATION_ART[key]
        else:
            found = ""
            sid, item_id = smapi_media_ref(uri)
            service = await _cached_service(ctl, household, sid) if sid else None
            if service is not None and item_id:
                creds, _borrowed = _reading_creds(ctl, household, sid, smapi_account_serial(uri))
                if service.auth == "Anonymous" or creds.get("token"):
                    try:
                        item = await asyncio.wait_for(ctl.smapi.get_media_metadata(
                            endpoint=service.endpoint, service_name=service.name,
                            item_id=item_id, household_id=household.id,
                            token=creds.get("token", ""), key=creds.get("key", ""),
                            device_id=await ctl.device_serial(household)), timeout=5)
                        found = (item.art if item else "") or ""
                    except Exception as exc:
                        log.info("no station picture for %s: %s", entry.get("title"), exc)
            found = found or await favorite_art(uri)
            if not found and art:
                # Nothing better to be had: keep the song's picture while the
                # speaker still serves it, and drop it once it does not, so
                # the tile draws the station placeholder rather than a broken
                # picture.
                try:
                    async with ctl.session.get(f"http://{host}:1400{'' if art.startswith('/') else '/'}{art}",
                                               timeout=aiohttp.ClientTimeout(total=4)) as resp:
                        found = "" if resp.status == 200 else "-"
                except Exception:
                    found = "-"
            _STATION_ART[key] = found
        if found == "-":
            if art:
                entry["art"] = ""
                ctl.recent.set_art(household.id, uri, "")
            return
        if found and found != art:
            entry["art"] = found
            ctl.recent.set_art(household.id, uri, found)

    await asyncio.gather(*(one(e) for e in items[:12]))


@app.get("/api/recent")
async def recently_played(zone: str) -> dict:
    """What the zone's household has played lately, newest first.

    Sonora's own list (see backend/sonos/recent.py): the containers and
    streams rooms were seen to start, as tiles a home page can replay. A
    queue's container plays back with ``replace``; a stream is set directly.
    """
    ctl = controller()
    try:
        ctl.zone(zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {zone}") from None
    household = ctl.household_of(zone)
    items = ctl.recent.items(household.id) if household else []
    if household is not None:
        await _station_pictures(ctl, household, items, ctl.zone(zone).host)
    # The tiles draw their pictures through /api/art like everything else, and
    # these came from a service rather than from a speaker, so nothing else
    # vouches for them: a Spotify cover and a Pandora station logo both drew
    # gray until this was said here.
    for entry in items:
        if entry.get("art"):
            ctl.remember_picture(entry["art"])
    return {"items": [{"id": f"recent:{i}", **entry,
                       "opens": _opens_at(entry.get("uri", ""),
                                          entry.get("metadata", ""))}
                      for i, entry in enumerate(items)]}


# -- pinned collections -------------------------------------------------------
#
# The web app's home carries rows the user pinned from inside a service (a
# Plex hub, a playlist folder): the row names the collection, shows its first
# few children as tiles, and opens it on View All. Sonos keeps those pins in
# its cloud; these are Sonora's own, per household, saved beside the rest.

_PINS_FILE = settings.data_dir / "pins.json"


def _read_pins() -> dict[str, list[dict]]:
    try:
        data = json.loads(_PINS_FILE.read_text())
    except (OSError, ValueError):
        return {}
    return {k: [e for e in v if isinstance(e, dict) and e.get("item")]
            for k, v in data.items() if isinstance(v, list)}


def _write_pins(pins: dict[str, list[dict]]) -> None:
    _PINS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _PINS_FILE.write_text(json.dumps(pins, ensure_ascii=False, indent=1))


def _household_for_zone(zone: str):
    ctl = controller()
    try:
        ctl.zone(zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {zone}") from None
    household = ctl.household_of(zone)
    if household is None:
        raise HTTPException(404, f"{zone} is in no household")
    return household


class PinBody(BaseModel):
    zone: str
    sid: int
    item: str
    title: str
    #: The service's name and icon, for the row's head; the account the
    #: collection is browsed under, where the service has several.
    service: str = ""
    icon: str = ""
    account_id: str = ""


async def _cloud_pins(household) -> list[dict]:
    """The household's own pinned collections, as the web app draws them.

    Sonos keeps these: they are made in the Sonos app and live in the cloud
    under the person's account. What each one names, though, is an ordinary
    browse id, so only the list comes from the cloud and everything under it
    is read from the service itself. A household with none, an unreachable
    cloud, or no sign-in all come back the same way: no rows.
    """
    ctl = controller()
    try:
        found = await ctl.cloud.pinned(household.id)
    except (CloudError, NotSignedIn) as exc:
        log.info("no cloud pins for %s: %s", household.id[:22], exc)
        return []
    except Exception as exc:                      # noqa: BLE001 - never fatal
        log.info("cloud pins failed for %s: %s", household.id[:22], exc)
        return []
    out = []
    for pin in found:
        service = await ctl._service_by_id(household, pin["sid"])
        out.append({
            "sid": pin["sid"],
            "item": pin["item"],
            "title": pin["title"],
            "service": service.name if service is not None else "",
            "icon": f"/api/services/logo/{pin['service_type']}",
            "account_id": "",
            # Sonos holds this one; Sonora's own unpin does not apply to it.
            "source": "sonos",
        })
    return out


@app.get("/api/pins")
async def pins(zone: str) -> dict:
    """The collections pinned to the home for the zone's household.

    The household's own pins first, as the web app orders them, then the ones
    pinned here.
    """
    household = _household_for_zone(zone)
    mine = [{**entry, "source": entry.get("source") or "sonora"}
            for entry in _read_pins().get(household.id, [])]
    return {"items": [*await _cloud_pins(household), *mine]}


@app.post("/api/pins")
async def add_pin(body: PinBody) -> dict:
    household = _household_for_zone(body.zone)
    pins = _read_pins()
    entry = {"sid": body.sid, "item": body.item, "title": body.title[:120],
             "service": body.service, "icon": body.icon, "account_id": body.account_id}
    rows = [e for e in pins.get(household.id, [])
            if not (e.get("sid") == body.sid and e.get("item") == body.item)]
    pins[household.id] = [*rows, entry]
    _write_pins(pins)
    return {"items": pins[household.id]}


@app.delete("/api/pins")
async def remove_pin(zone: str, sid: int, item: str) -> dict:
    household = _household_for_zone(zone)
    pins = _read_pins()
    pins[household.id] = [e for e in pins.get(household.id, [])
                          if not (e.get("sid") == sid and e.get("item") == item)]
    _write_pins(pins)
    return {"items": pins[household.id]}


# -- system names ------------------------------------------------------------
#
# An S2 household's name is the speakers' own household setting museHHName,
# which is what the Sonos apps show ("Your System" until it is named); S1 has
# no such setting. Reading it needs nothing; writing it needs the speakers'
# own credential, which Sonora does not hold (hhsettings.CAN_WRITE, measured
# for the same domain on 2026-09-17). So a name set here is tried on the
# speakers first and, when they refuse it, kept as Sonora's own: a name per
# household beside the other saved state, shown as the heading over that
# system's rooms.

_SYSTEM_NAMES_FILE = settings.data_dir / "system_names.json"


def _read_system_names() -> dict[str, str]:
    try:
        data = json.loads(_SYSTEM_NAMES_FILE.read_text())
    except (OSError, ValueError):
        return {}
    return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)}


class SystemNameBody(BaseModel):
    household: str
    #: Empty clears the name and the heading goes back to the default.
    name: str = ""


async def _speaker_household_names() -> dict[str, str]:
    """Each S2 household's name as its speakers hold it, by household id."""
    ctl = controller()
    out: dict[str, str] = {}
    for household in ctl.households.values():
        if household.generation == "S1":
            continue
        hosts = [p.host for p in household.players.values() if p.online and p.host]
        if not hosts:
            continue
        try:
            text, _ = await ctl.read_household_setting(hosts, hhsettings.HOUSEHOLD_NAME)
        except SettingsError as exc:
            log.info("no household name from %s: %s", household.id[:22], exc)
            continue
        if text and text != "Key not found.":
            out[household.id] = text
    return out


@app.get("/api/system-names")
async def system_names() -> dict:
    """Each household's name, by household id: Sonora's own where one is
    set, and otherwise the name the speakers hold, which is the one the Sonos
    apps show."""
    return _merged_names(_read_system_names(), await _speaker_household_names())


def _merged_names(own: dict[str, str], speakers: dict[str, str]) -> dict[str, str]:
    """Sonora's own names under the speakers' ones.

    An S2 system's name is the speakers', which is what the Sonos apps and
    the web player show ("Your Systemz" there on 2026-09-28, where Sonora
    showed its own "Home"), so it wins. An S1 system has none, and Sonora's
    own name is the only one.
    """
    return {**own, **speakers}


@app.post("/api/system-names")
async def set_system_name(body: SystemNameBody) -> dict:
    if not any(h.id == body.household for h in controller().households.values()):
        raise HTTPException(404, f"unknown household {body.household}")
    name = " ".join(body.name.split())[:60]
    names = _read_system_names()
    household = controller().households[body.household]
    # Written to the speakers when Sonora can write their settings, so the
    # Sonos apps show it too. Today it cannot (hhsettings.CAN_WRITE: this
    # domain answers 401 without the speakers' own credential), so the name
    # is Sonora's alone and nothing is sent.
    on_speakers = False
    if name and household.generation != "S1" and hhsettings.CAN_WRITE:
        for player in household.players.values():
            if not (player.online and player.host):
                continue
            try:
                await controller().hhsettings.write(player.host, hhsettings.HOUSEHOLD_NAME, name)
                on_speakers = True
            except SettingsUnauthorized as exc:
                log.info("household name kept in Sonora: %s", exc)
            except SettingsError as exc:
                log.info("household name not written to %s: %s", player.host, exc)
                continue
            break
    renamed = ""
    if name and household.generation != "S1" and not on_speakers:
        # The web player's own route: the cloud's households/setName over its
        # websocket, which the speakers take at once. It needs Sonora signed
        # in to Sonos, since the socket only runs then (muse.py).
        ctl = controller()
        if not (ctl.cloud.signed_in and ctl.muse.connected):
            raise HTTPException(409, "Sign in to your Sonos account to rename an S2 system.")
        try:
            await ctl.muse.set_household_name(household.cloud_id, name)
        except CloudError as exc:
            raise HTTPException(502, f"Sonos did not rename the system: {exc}") from exc
        on_speakers = True
        renamed = name
    if name and not on_speakers:
        names[body.household] = name
    else:
        names.pop(body.household, None)
    _SYSTEM_NAMES_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SYSTEM_NAMES_FILE.write_text(json.dumps(names, ensure_ascii=False, indent=1))
    merged = _merged_names(names, await _speaker_household_names())
    # The speakers can take a moment to report the new name; the answer says
    # the name that was just set rather than the one being replaced.
    if renamed:
        merged[body.household] = renamed
    return merged


class ContentFilterBody(BaseModel):
    zone: str
    filtering: bool


@app.get("/api/content-filtering")
async def content_filtering(zone: str) -> dict:
    """Whether the household filters explicit content.

    The household's own setting, read off its speakers, which is the same
    value every Sonos controller shows.
    """
    cmd = commands()
    try:
        return await cmd.content_filtering(zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {zone}") from None
    except SettingsError as exc:
        raise HTTPException(502, str(exc)) from None


@app.post("/api/content-filtering")
async def set_content_filtering(body: ContentFilterBody) -> dict:
    """Turn the household's filter on or off, for every controller it has.

    Reading the setting is open to any controller on the network; changing it
    is not, and not only for Sonora. Every player answers 401 to the write and
    names a realm the Sonos account token is not of, and the cloud command for
    it -- setRestrictedAdminSettings, the vendor's own name -- answers
    ERROR_UNSUPPORTED_COMMAND on 57.23 and ERROR_NYI on 97.1 to the
    households' owner. The call is here because it
    is correct and will work the day that changes; until then it says so.
    """
    cmd = commands()
    try:
        return await cmd.set_content_filtering(body.zone, body.filtering)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    except SettingsUnauthorized as exc:
        raise HTTPException(403, str(exc)) from None
    except SettingsError as exc:
        raise HTTPException(502, str(exc)) from None


@app.get("/api/time")
async def time_settings(zone: str) -> dict:
    """The household's date and time settings, as the Date and Time pane shows."""
    cmd = commands()
    try:
        return await cmd.time_settings(zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {zone}") from None


@app.post("/api/time")
async def set_time_settings(body: TimeBody) -> dict:
    """Apply any of the Date and Time pane's fields; the rest are left alone."""
    cmd = commands()
    try:
        current = await cmd.time_settings(body.zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    if body.index is not None or body.auto_dst is not None:
        await cmd.set_time_zone(body.zone,
                                current["index"] if body.index is None else body.index,
                                current["auto_dst"] if body.auto_dst is None else body.auto_dst)
    if body.internet_time is not None:
        if not body.internet_time and current.get("server_fixed"):
            raise HTTPException(409, "This system always sets its clock from the Internet.")
        await cmd.set_time_server(body.zone, cmd.DEFAULT_TIME_SERVER if body.internet_time else "")
    if body.time_format is not None or body.date_format is not None:
        tf = body.time_format or (current["time_format"] if current["time_format"] != "INV" else "12H")
        df = body.date_format or (current["date_format"] if current["date_format"] != "INV" else "MDY")
        await cmd.set_time_format(body.zone, tf, df)
    if body.desired_time:
        try:
            await cmd.set_time_now(body.zone, body.desired_time,
                                   body.index if body.index is not None else current["index"])
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    return await cmd.time_settings(body.zone)


class LibraryBody(BaseModel):
    zone: str
    add_path: str | None = None
    add_username: str = ""
    add_password: str = ""
    #: Research only: which shape of share DIDL to
    #: send, so the variants can be told apart against a real household.
    #: Empty is the app's own shape, which is what Sonora sends.
    add_variant: str = ""
    remove_id: str | None = None
    refresh: bool = False
    album_artist_option: str | None = None
    #: ``HH:MM:SS`` for a nightly update, ``""`` for none; omitted leaves it.
    daily_refresh: str | None = None


@app.get("/api/library")
async def library_settings(zone: str) -> dict:
    """The household's music-library shares, index state and options."""
    try:
        return await commands().library_settings(zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {zone}") from None


@app.post("/api/library")
async def set_library_settings(body: LibraryBody) -> dict:
    cmd = commands()
    try:
        current = await cmd.library_settings(body.zone)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    if body.add_path:
        try:
            created = await cmd.add_share(
                body.zone, body.add_path, body.add_username, body.add_password,
                current["album_artist_option"] or "WMP", body.add_variant)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        # add_share has already offered the folder to the players and waited a
        # few seconds for a complaint, so the answer is known now. The desktop
        # app reports success at this point too -- it does not wait for the
        # index, which for a large folder runs for many minutes, and a share
        # is not listed under S: until that finishes.
        took, refused = created.get("took", ""), created.get("refused", "")
        # The record outlives this request, so the feedback survives a reload
        # and is there in every theme: the folder shows as added and indexing,
        # or as still being mounted, until it appears under S: for real.
        controller().note_pending_share(body.zone, body.add_path,
                                        created.get("ObjectID", ""), took)
        pending = not took
        if refused:
            # Nothing took it. Ask the file server the same questions the
            # players just asked it: the answers tell several
            # identical-looking failures apart.
            household = controller().household_of(body.zone)
            share_host = smb.share_host(body.add_path)
            # A share on this machine's own loopback is no share a speaker
            # can reach, and probing it would turn this into a port check.
            facts = (await smb.probe(share_host) if fetchguard.safe_host(share_host)
                     else {"host": share_host, "port": None, "smb1": None,
                           "smb2": "", "anonymous": None})
            log.info("share %s refused by every player (%s): %s",
                     smb.share_host(body.add_path), refused, facts)
            hint = smb.explain(body.add_path, facts,
                               generation=household.generation if household else "",
                               credentials=bool(body.add_username))
            controller().note_pending_share_hint(body.zone, body.add_path, hint, failed=True)
    if body.remove_id:
        listed = any(share["id"] == body.remove_id for share in current["shares"])
        try:
            await cmd.remove_share(body.zone, body.remove_id)
        except Exception:
            # A share that never landed is not there to destroy, and the
            # players answer UPnP 713. Removing it is still how a person
            # dismisses an add that went nowhere, so the local record goes
            # either way; only a share the players really do list is worth
            # failing the request over.
            controller().clear_pending_share(body.zone, body.remove_id.split(":", 1)[-1])
            if listed:
                raise
            log.info("remove share %s: nothing to destroy, dropped the record",
                     body.remove_id)
        else:
            controller().clear_pending_share(body.zone, body.remove_id.split(":", 1)[-1])
    if body.daily_refresh is not None:
        await cmd.set_daily_index_refresh(body.zone, body.daily_refresh)
    if body.refresh or body.album_artist_option:
        await cmd.refresh_share_index(
            body.zone, body.album_artist_option or current["album_artist_option"] or "WMP")
    settings = await cmd.library_settings(body.zone)
    if body.add_path:
        settings["add_pending"] = pending
        # Every player refused it: the caller must not report success. The
        # app's own wizard shows "Error adding music" with the reason here.
        settings["add_failed"] = bool(refused)
        if pending:
            settings["add_hint"] = hint
    return settings


@app.post("/api/zones/{uuid}/favorite")
async def add_station_favorite(uuid: str) -> dict:
    """Add what the room is playing (its station, playlist or album) to Sonos
    Favorites, as the apps' "Add Station to Sonos Favorites" does."""
    ctl = controller()
    try:
        zone = ctl.coordinator_of(uuid)
    except KeyError:
        raise HTTPException(404, f"unknown zone {uuid}") from None
    info = await commands().media_info(uuid)
    if not info["uri"] or info["uri"].startswith("x-rincon-queue:"):
        raise HTTPException(409, "Nothing is playing that can be saved as a favorite.")
    items = parse_didl(info["metadata"]) if info["metadata"] else []
    source = items[0] if items else None
    transport = zone.transport
    title = (source.title if source else "") or transport.container_title or transport.title
    art = (source.art_uri if source else "") or transport.album_art_uri
    service = transport.service_name
    description = (f"{service} Station" if service
                   else (source.description if source and source.description else "Radio Station"))
    try:
        result = await commands().add_favorite(uuid, title, info["uri"], info["metadata"], description, art)
    except SoapFault as exc:
        # 803 from CreateObject on FV:2 is "already a favorite" (measured
        # 2026-09-05: the same URI refused, a fresh one accepted).
        if exc.code == "803":
            return {"id": "", "title": title, "exists": True}
        raise
    return {"id": result.get("ObjectID", ""), "title": title, "exists": False}


class RadioStationBody(BaseModel):
    zone: str
    url: str
    title: str
    #: "shows" saves into My Radio Shows (R:0/1) instead of My Radio Stations.
    kind: str = "stations"


@app.post("/api/radio")
async def add_radio_station(body: RadioStationBody) -> dict:
    """Add a custom stream to TuneIn > My Radio Stations (the apps' Manage >
    Add Radio Station), or a show to My Radio Shows."""
    title, url = body.title.strip(), body.url.strip()
    if not title or not url:
        raise HTTPException(400, "a stream URL and a station name are needed")
    if not re.match(r"^(https?|x-rincon-mp3radio)://\S+$", url) and not re.match(
            r"^x-sonosapi-(stream|radio|hls):\S+$", url):
        raise HTTPException(400, "the streaming URL must start with http:// or https://")
    try:
        result = await commands().add_radio_station(
            body.zone, title, url,
            "R:0/1" if body.kind == "shows" else "R:0/0")
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    except SoapFault as exc:
        if exc.code == "803":
            return {"id": "", "title": title, "exists": True}
        raise
    return {"id": result.get("ObjectID", ""), "title": title, "exists": False}


class RadioRemoveBody(BaseModel):
    zone: str
    id: str


@app.post("/api/radio/remove")
async def remove_radio_station(body: RadioRemoveBody) -> dict:
    """Take a station out of My Radio Stations, or a show out of My Radio
    Shows (the app's "Remove from My Radio Stations", 2026-09-07). Only those
    two containers: this is a DestroyObject."""
    if not re.match(r"^R:0/[01]/\S+$", body.id):
        raise HTTPException(400, "not a saved radio station")
    try:
        await commands().destroy_object(body.zone, body.id)
    except KeyError:
        raise HTTPException(404, f"unknown zone {body.zone}") from None
    return {"ok": True}


@app.get("/api/radio")
async def radio(zone: str | None = None) -> dict:
    host = _host_for(zone)
    items = await controller().content.radio_favorites(host)
    return {"items": [item.as_dict(host) for item in items]}


class SourceBody(BaseModel):
    uri: str
    metadata: str = ""
    #: Used only to name a station whose metadata has to be composed here.
    title: str = ""
    enqueue: bool = False
    next: bool = False
    #: The apps' Replace Queue: empty the queue, add this, play it.
    replace: bool = False
    #: The item's SMAPI kind. An "audiobook" is never queued: the transport is
    #: pointed at the book itself, as the apps do.
    kind: str = ""
    #: Where an enqueued item should land, 1-based. 0 means the end, which is
    #: what "Add to End of Queue" asks for; a drop between two rows names the
    #: row it should take the place of.
    position: int = 0


@app.post("/api/zones/{uuid}/source")
async def set_source(uuid: str, body: SourceBody) -> dict:
    cmd = commands()
    if body.replace:
        await cmd.replace_queue(uuid, body.uri, body.metadata)
        return {"ok": True}
    if body.enqueue:
        result = await cmd.add_to_queue(uuid, body.uri, body.metadata,
                                        next_=body.next, position=body.position)
        return {"ok": True, **result}
    metadata = body.metadata
    if not metadata:
        # A station taken straight from the speakers' saved list carries no
        # r:resMD, and a service URI with no metadata is refused with 402.
        metadata = station_didl(
            body.uri, body.title or "",
            controller().account_udn(
                controller().household_of(uuid).id if controller().household_of(uuid) else "",
                smapi_sid(body.uri), smapi_account_serial(body.uri)))
    await cmd.play_now(uuid, body.uri, metadata, kind=body.kind)
    return {"ok": True}


@app.delete("/api/queue/{uuid}")
async def clear_queue(uuid: str) -> dict:
    await commands().clear_queue(uuid)
    return {"ok": True}


class SaveQueueBody(BaseModel):
    title: str
    #: An existing Sonos playlist (``SQ:n``) to replace instead of adding one.
    object_id: str = ""


class ReorderBody(BaseModel):
    #: 1-based position of the first track to move, how many, and the 1-based
    #: position (before the move) the run should land in front of.
    start: int
    count: int = 1
    insert_before: int


@app.post("/api/queue/{uuid}/reorder")
async def reorder_queue(uuid: str, body: ReorderBody) -> dict:
    if body.start < 1 or body.count < 1 or body.insert_before < 1:
        raise HTTPException(400, "track positions start at 1")
    await commands().reorder_queue(uuid, body.start, body.count, body.insert_before)
    return {"ok": True}


@app.delete("/api/queue/{uuid}/{index}")
async def remove_from_queue(uuid: str, index: int) -> dict:
    """Remove one track (1-based position) from the group's queue."""
    if index < 1:
        raise HTTPException(400, "track positions start at 1")
    await commands().remove_from_queue(uuid, index)
    return {"ok": True}


@app.post("/api/queue/{uuid}/save")
async def save_queue(uuid: str, body: SaveQueueBody) -> dict:
    """Save the group's queue as a Sonos playlist."""
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "a playlist name is needed")
    return {"ok": True, **await commands().save_queue(uuid, title, body.object_id)}


class CrossfadeBody(BaseModel):
    enabled: bool


@app.post("/api/zones/{uuid}/crossfade")
async def set_crossfade(uuid: str, body: CrossfadeBody) -> dict:
    await commands().set_crossfade(uuid, body.enabled)
    return {"ok": True}


class SleepBody(BaseModel):
    #: ``H:MM:SS`` to set, or null / empty to clear.
    duration: str | None = None


@app.get("/api/zones/{uuid}/sleep")
async def sleep_timer(uuid: str) -> dict:
    return {"remaining": await commands().sleep_timer_remaining(uuid)}


@app.get("/api/sleep")
async def sleep_timers() -> dict:
    """Every sleep timer running on the system: the group's coordinator and
    what remains, ``H:MM:SS``. A timer belongs to a group, so members are not
    asked; a player that does not answer is simply not listed."""
    ctl = controller()
    cmd = commands()
    leads = [z for z in ctl.zones.values() if z.is_coordinator and z.online]

    async def read(zone):
        try:
            return zone.uuid, await cmd.sleep_timer_remaining(zone.uuid)
        except Exception:
            return zone.uuid, ""

    rows = await asyncio.gather(*(read(z) for z in leads))
    return {"items": [{"zone": uuid, "remaining": remaining}
                      for uuid, remaining in rows if remaining and remaining != "0:00:00"]}


@app.post("/api/zones/{uuid}/sleep")
async def set_sleep_timer(uuid: str, body: SleepBody) -> dict:
    cmd = commands()
    await cmd.set_sleep_timer(uuid, body.duration or None)
    return {"remaining": await cmd.sleep_timer_remaining(uuid)}


class AlarmBody(BaseModel):
    zone: str
    enabled: bool


async def _named_alarms(zone: str) -> list[dict]:
    """The household's alarms with the room each one plays in named."""
    ctl = controller()
    items = await commands().alarms(zone)
    for alarm in items:
        room = ctl.zones.get(alarm.get("RoomUUID", ""))
        alarm["room"] = room.name if room else ""
    return items


@app.get("/api/alarms")
async def alarms(zone: str) -> dict:
    return {"alarms": await _named_alarms(zone)}


class AlarmDefinition(BaseModel):
    zone: str
    start_time: str            #: HH:MM:SS
    duration: str = "02:00:00" #: HH:MM:SS, "" for no limit
    recurrence: str = "ONCE"   #: ONCE, DAILY, WEEKDAYS, WEEKENDS, or ON_<days, 0 = Sunday>
    enabled: bool = True
    room_uuid: str
    program_uri: str = "x-rincon-buzzer:0"
    program_metadata: str = ""
    play_mode: str = "NORMAL"
    volume: int = 25
    include_linked_zones: bool = False


@app.post("/api/alarms")
async def create_alarm(body: AlarmDefinition) -> dict:
    """Create an alarm (the apps' Add Alarm)."""
    if not re.match(r"^\d{2}:\d{2}:\d{2}$", body.start_time):
        raise HTTPException(400, "start_time must be HH:MM:SS")
    new_id = await commands().create_alarm(body.zone, body.model_dump())
    return {"id": new_id, "alarms": await _named_alarms(body.zone)}


@app.put("/api/alarms/{alarm_id}")
async def update_alarm(alarm_id: str, body: AlarmDefinition) -> dict:
    """Replace an alarm's definition (the apps' Edit Alarm)."""
    if not re.match(r"^\d{2}:\d{2}:\d{2}$", body.start_time):
        raise HTTPException(400, "start_time must be HH:MM:SS")
    await commands().update_alarm(body.zone, alarm_id, body.model_dump())
    return {"alarms": await _named_alarms(body.zone)}


@app.post("/api/alarms/{alarm_id}")
async def set_alarm(alarm_id: str, body: AlarmBody) -> dict:
    try:
        await commands().set_alarm_enabled(body.zone, alarm_id, body.enabled)
    except KeyError:
        raise HTTPException(404, f"no alarm {alarm_id}") from None
    return {"alarms": await _named_alarms(body.zone)}


@app.delete("/api/alarms/{alarm_id}")
async def delete_alarm(alarm_id: str, zone: str) -> dict:
    await commands().destroy_alarm(zone, alarm_id)
    return {"alarms": await _named_alarms(zone)}


# -- diagnostics --------------------------------------------------------------


@app.get("/api/dropouts")
async def dropouts() -> dict:
    """The playback dropouts of the last seven days, newest last
    (sonos/dropouts.py): pauses to buffer mid-track and sources a speaker
    could not play."""
    return {"entries": controller().dropouts.log.recent()}


@app.get("/api/log")
async def error_log(limit: int = Query(default=100, ge=1, le=400)) -> dict:
    """Sonora's warnings and errors of the last seven days (speaker
    refusals, unreachable services), newest last and at most 100: what the
    apps' Error Log window shows, kept across restarts as theirs is."""
    return {"entries": recent_log.entries()[-limit:]}


@app.get("/api/diagnostics")
async def diagnostics(
    household: str | None = None,
    probe: bool = True,
    samples: int = Query(default=15, ge=3, le=60),
) -> dict:
    """Radio conditions, peer visibility and controller-to-speaker timing."""
    ctl = controller()
    if household:
        target = ctl.households.get(household)
        if target is None:
            raise HTTPException(404, f"unknown household {household}")
        selected = [target]
    else:
        selected = ctl.ordered_households()

    out = []
    for target in selected:
        hid = target.id
        facts = {
            uuid: zone.radio
            for uuid, zone in ctl.zones.items()
            if zone.radio is not None and uuid in target.zones
        }
        snapshot = await ctl.network.collect(
            target, facts, probe=probe, probe_samples=samples)
        out.append({
            "household": hid,
            "generation": target.generation,
            "peers_audible": snapshot.peers_audible,
            "channels": {str(k): v
                         for k, v in snapshot.channels_in_use.items()},
            "unreachable": snapshot.unreachable,
            "rooms": [
                {
                    # One entry per speaker: a stereo pair has two, sharing a
                    # room but not a radio.
                    "player": key,
                    "zone": radio.zone_uuid,
                    "name": radio.zone_name,
                    "role": radio.role,
                    "model": radio.model,
                    "channel": radio.channel,
                    "noise_floor": radio.wireless.active_noise_floor,
                    "phy_errors": radio.wireless.phy_errors,
                    "mode": radio.wireless.mode,
                    "wired": radio.wired,
                    # How well the unit hears the mesh. None off SonosNet,
                    # where the radio keeps no peer table to measure against.
                    "rssi": radio.wireless.best_rssi,
                    "margin": radio.wireless.best_margin,
                    "neighbors": len(radio.wireless.neighbors),
                    "sonosnet": radio.wireless.on_sonosnet,
                    # How fast errors grow, per minute, over this check: the
                    # readings every speaker gives, peers or none.
                    "phy_errors_per_min": radio.phy_errors_per_min,
                    "drops_per_min": radio.drops_per_min,
                    "latency": (snapshot.latency[key].as_dict()
                                if key in snapshot.latency else None),
                    # The room's one verdict and why (network.room_health):
                    # what every theme's network view leads with.
                    "health": (room_health(radio, snapshot.latency.get(key))
                               if probe else None),
                }
                for key, radio in snapshot.radios.items()
            ],
            "links": [
                {
                    "a": link.zone_a, "b": link.zone_b,
                    "name_a": link.name_a, "name_b": link.name_b,
                    "worst_margin": link.worst_margin,
                    "best_margin": link.best_margin,
                    "asymmetry": link.asymmetry,
                    "reciprocal": link.reciprocal,
                    "quality": link.quality,
                    "rssi": link.rssi,
                }
                for link in snapshot.weakest_links
            ],
            "findings": [
                {
                    "severity": f.severity, "code": f.code, "zone": f.zone,
                    "title": f.title, "detail": f.detail, "remedy": f.remedy,
                }
                for f in snapshot.findings
            ],
        })
    return {"households": out}


# -- static frontend ----------------------------------------------------------
#
# Mounted last so it cannot shadow an API route. In development Vite serves the
# interface on its own port and proxies the API here instead.

_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

#: Everything under /assets carries a content hash in its name, so a given URL
#: never changes what it holds and may be kept for a year. index.html is the
#: opposite: it is the one file that names the current hashes, so a browser
#: holding an old copy asks for a bundle the last build deleted and nothing
#: loads at all. It was served with no cache headers whatsoever -- no
#: Cache-Control, no ETag, no Last-Modified -- which leaves a browser free to
#: cache it heuristically, and one did (reported after a day of
#: rebuilds: "it won't load, the browser just spins").
_IMMUTABLE = "public, max-age=31536000, immutable"
_NEVER_STALE = "no-cache"


#: Text assets worth compressing, and each one compressed once: the bundle is
#: 3 MB as built and 0.8 MB gzipped, and it went out whole to every browser
#: that had not cached it yet (found in the resource sweep). Keyed by the
#: file's path and modification time, so a rebuild is compressed afresh.
_COMPRESSIBLE = {".js", ".css", ".svg", ".json", ".map", ".txt", ".html"}
_GZIPPED: dict[tuple[str, int], bytes] = {}


class _HashedAssets(StaticFiles):
    """The bundle's hashed files, which may be cached for as long as you like."""

    def file_response(self, *args, **kwargs):  # noqa: D102
        response = super().file_response(*args, **kwargs)
        response.headers["cache-control"] = _IMMUTABLE
        return response

    async def get_response(self, path: str, scope) -> Response:  # noqa: D102
        wants = b"gzip" in dict(scope.get("headers") or []).get(b"accept-encoding", b"")
        target = Path(self.directory) / path
        if not (wants and target.suffix in _COMPRESSIBLE and target.is_file()
                and target.resolve().is_relative_to(Path(self.directory).resolve())):
            return await super().get_response(path, scope)
        import gzip
        import mimetypes
        key = (str(target), target.stat().st_mtime_ns)
        body = _GZIPPED.get(key)
        if body is None:
            body = await asyncio.to_thread(gzip.compress, target.read_bytes(), 6)
            for old in [k for k in _GZIPPED if k[0] == key[0]]:
                del _GZIPPED[old]
            _GZIPPED[key] = body
        kind = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if kind.startswith("text/") or kind.endswith(("javascript", "json")):
            kind += "; charset=utf-8"
        return Response(body, media_type=kind, headers={
            "content-encoding": "gzip", "vary": "accept-encoding",
            "cache-control": _IMMUTABLE,
            "etag": f'"{key[1]:x}-gz"',
        })


#: Sonora's license and the notices of what it includes from others, served
#: as text so every About window can link to them from any copy. The Docker
#: image carries both files beside the backend; a checkout has them at the
#: repository's root, one level above app/.
_LEGAL_ROOTS = (Path(__file__).resolve().parent.parent,
                Path(__file__).resolve().parent.parent.parent)
_LEGAL_FILES = {"license": "LICENSE", "third-party-notices": "THIRD-PARTY-NOTICES.md"}


async def _legal_file(name: str) -> Response:
    target = next((root / _LEGAL_FILES[name] for root in _LEGAL_ROOTS
                   if (root / _LEGAL_FILES[name]).is_file()), None)
    if target is None:
        raise HTTPException(404, f"{_LEGAL_FILES[name]} is missing from this copy")
    return Response(target.read_bytes(), media_type="text/plain; charset=utf-8",
                    headers={"cache-control": _NEVER_STALE})


@app.get("/license")
async def license_text() -> Response:
    return await _legal_file("license")


@app.get("/third-party-notices")
async def third_party_notices() -> Response:
    return await _legal_file("third-party-notices")


if _DIST.is_dir():
    app.mount("/assets", _HashedAssets(directory=_DIST / "assets"),
              name="assets")

    @app.get("/")
    async def index() -> Response:
        # `no-cache` still lets the browser keep a copy; it just has to ask
        # whether it is current first, which is what the ETag answers cheaply.
        body = (_DIST / "index.html").read_bytes()
        return Response(body, media_type="text/html", headers={
            "cache-control": _NEVER_STALE,
            "etag": f'"{hashlib.md5(body).hexdigest()}"',
        })

    # Root-level static files the bundle ships (favicon and touch icon). The
    # SPA mounts hashed bundles under /assets, but these are referenced at the
    # site root, so they are served by name here.
    _ROOT_FILES = {
        "favicon.ico": "image/x-icon",
        "apple-touch-icon.png": "image/png",
    }

    @app.get("/{filename}")
    async def root_file(filename: str) -> Response:
        media = _ROOT_FILES.get(filename)
        target = _DIST / filename
        if media is None or not target.is_file():
            raise HTTPException(404, "not found")
        return Response(target.read_bytes(), media_type=media)
else:
    @app.get("/")
    async def index_missing() -> Response:
        return Response(
            "The interface has not been built. Run `npm run build` in "
            "frontend/, or use `npm run dev` for development.",
            media_type="text/plain", status_code=503)


@app.get("/api/health")
async def health() -> dict:
    ctl = state.get("controller")
    return {
        "ok": ctl is not None,
        "zones": len(ctl.zones) if ctl else 0,  # type: ignore[union-attr]
        "event_port": ctl.events.bound_port if ctl else None,  # type: ignore[union-attr]
    }
