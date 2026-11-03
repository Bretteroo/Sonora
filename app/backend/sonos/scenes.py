"""Scenes: a saved arrangement of rooms, levels and sources, set in one go.

A scene is one or more groups. Each group names the rooms that play
together, how loud each is, and what they play: a Sonos Favorite or
playlist, the television, a line-in, or whatever they already have on. So
one scene can put cocktail music in the dining room, jazz in the living
room and something louder outside, with every other room silent. A group
can go on to set a room's bass, treble and loudness and a soundbar's Night
Mode and Speech Enhancement, and shuffle and repeat; the scene as a whole
can pause every room outside it. Each group names
the system (S1 or S2) its rooms are on, so one scene can span both. Scenes
are Sonora's own, kept on disk; the speakers know nothing of them.

Before a scene is set, what it is about to change is written down: each
room's levels, who it was grouped with, what its group was playing and
where in it, and a queue the scene is about to replace. Ending the scene
puts all of that back.

Applying or ending one never fails as a whole. A room that is not on the
network is skipped and named in the report, and a step a speaker refuses is
reported with the rest carried out.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from . import const
from .playback import station_didl
from .smapi import smapi_account_serial, smapi_sid
from .soap import SoapFault

log = logging.getLogger(__name__)

#: What a group can start. ``item`` is anything with a URI and DIDL (a
#: favorite, a Sonos playlist, a captured station); ``tv`` is the soundbar
#: named in ``source``, which then leads the group; ``line_in`` is the socket
#: of the room named in ``source``, heard by the whole group; ``silence``
#: stops whatever the group has on.
PLAY_KINDS = ("item", "tv", "line_in", "silence")
NAME_LIMIT = 60
SLEEP_LIMIT = 24 * 60
#: How many queue entries an End will put back; a queue longer than this is
#: restored up to here.
QUEUE_LIMIT = 1000
#: A record of what the rooms were is kept this long after a scene is set.
ACTIVE_FOR = 24 * 60 * 60
#: How long a regrouping is given to be heard back from the speakers before
#: the transport commands that follow it go out.
GROUP_SETTLE = 4.0

_DIDL_HEAD = ('<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
              'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
              'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
              'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">')
_ITEM_RE = re.compile(r"<item\b.*?</item>", re.DOTALL)
_RES_RE = re.compile(r"<res\b[^>]*>(.*?)</res>", re.DOTALL)


def _clamp(value: Any, bounds: tuple[int, int]) -> int:
    low, high = bounds
    return max(low, min(high, int(value)))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _play(raw: Any) -> dict | None:
    if not isinstance(raw, dict) or raw.get("kind") not in PLAY_KINDS:
        return None
    play = {"kind": raw["kind"],
            "uri": str(raw.get("uri") or ""),
            "metadata": str(raw.get("metadata") or ""),
            "title": str(raw.get("title") or "")[:200],
            "art": str(raw.get("art") or ""),
            "item_kind": str(raw.get("item_kind") or ""),
            "service": str(raw.get("service") or "")[:120],
            "source": str(raw.get("source") or "")}
    if play["kind"] == "item" and not play["uri"]:
        return None
    return play


def normalize(body: dict, household: str = "") -> dict:
    """A scene as the store keeps it, from whatever a client sent.

    Unknown keys are dropped, levels are clamped, a room named in two
    groups stays in the first, and a group with no rooms is dropped. Each
    group carries the household its rooms are on; ``household`` (or the
    body's own) stands in for a group that names none. A body in the
    earlier one-group shape (``rooms`` and ``play`` at the top) is read as
    one group. Raises ``ValueError`` with a short reason when the scene has
    no name or no rooms.
    """
    if not isinstance(body, dict):
        raise ValueError("not a scene")
    name = str(body.get("name") or "").strip()[:NAME_LIMIT]
    if not name:
        raise ValueError("a name is needed")
    raw_groups = body.get("groups")
    if raw_groups is None and body.get("rooms") is not None:
        raw_groups = [{"rooms": body.get("rooms"), "play": body.get("play"),
                       "play_mode": body.get("play_mode")}]
    groups: list[dict] = []
    seen: set[str] = set()
    for raw_group in raw_groups or []:
        if not isinstance(raw_group, dict):
            continue
        rooms: list[dict] = []
        for raw in raw_group.get("rooms") or []:
            if not isinstance(raw, dict) or not raw.get("uuid") or raw["uuid"] in seen:
                continue
            seen.add(raw["uuid"])
            room = {"uuid": str(raw["uuid"]), "name": str(raw.get("name") or "")[:NAME_LIMIT],
                    "volume": None, "tone": None, "soundbar": None}
            if raw.get("volume") is not None:
                room["volume"] = _clamp(raw["volume"], const.VOLUME_RANGE)
            tone = raw.get("tone")
            if isinstance(tone, dict):
                room["tone"] = {"bass": _clamp(tone.get("bass") or 0, const.BASS_RANGE),
                                "treble": _clamp(tone.get("treble") or 0, const.TREBLE_RANGE),
                                "loudness": bool(tone.get("loudness"))}
            soundbar = raw.get("soundbar")
            if isinstance(soundbar, dict):
                room["soundbar"] = {"night_mode": bool(soundbar.get("night_mode")),
                                    "speech": bool(soundbar.get("speech"))}
            rooms.append(room)
        if not rooms:
            continue
        mode = raw_group.get("play_mode")
        groups.append({"household": str(raw_group.get("household") or household or body.get("household") or ""),
                       "rooms": rooms, "play": _play(raw_group.get("play")),
                       "play_mode": mode if mode in const.PLAY_MODES else None,
                       # On, the rooms keep the volume and tone they have when the scene is set.
                       "keep_levels": bool(raw_group.get("keep_levels")),
                       # How long the group plays, in minutes; a scene saved with one timer for
                       # the whole of it hands that timer to each group.
                       "sleep": _minutes(raw_group.get("sleep", body.get("sleep"))),
                       # How long after the scene is set the group starts, in minutes; each
                       # group's delay runs from that moment, on its own.
                       "delay": _minutes(raw_group.get("delay"))})
    if not groups:
        raise ValueError("at least one room is needed")
    return {
        "id": str(body.get("id") or ""),
        "name": name,
        "groups": groups,
        "pause_others": bool(body.get("pause_others")),
    }


def _minutes(value) -> int | None:
    return _clamp(value, (1, SLEEP_LIMIT)) if isinstance(value, (int, float)) and value else None


def rooms_of(scene: dict) -> list[dict]:
    """Every room of the scene, group by group."""
    return [room for group in scene.get("groups", []) for room in group["rooms"]]


class Scenes:
    """The saved scenes, in one JSON file."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._items: list[dict] = []
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            data = None
        # The file holds {"scenes": [...]}; an earlier one kept a list per
        # household, whose key then names each group's system.
        raw: list[tuple[dict, str]] = []
        if isinstance(data, dict) and isinstance(data.get("scenes"), list):
            raw = [(scene, "") for scene in data["scenes"]]
        elif isinstance(data, dict):
            raw = [(scene, household) for household, scenes in data.items()
                   if isinstance(scenes, list) for scene in scenes]
        for scene, household in raw:
            try:
                self._items.append({**normalize(scene, household), "id": scene["id"],
                                    "created": scene.get("created") or _now(),
                                    "updated": scene.get("updated") or _now()})
            except (ValueError, KeyError, TypeError):
                continue

    def items(self) -> list[dict]:
        return [dict(s) for s in self._items]

    def get(self, scene_id: str) -> dict | None:
        for scene in self._items:
            if scene["id"] == scene_id:
                return dict(scene)
        return None

    def add(self, body: dict) -> dict:
        scene = normalize(body)
        scene["id"] = "sc_" + secrets.token_hex(6)
        scene["created"] = scene["updated"] = _now()
        self._items.append(scene)
        self._save()
        return dict(scene)

    def update(self, scene_id: str, body: dict) -> dict | None:
        for i, old in enumerate(self._items):
            if old["id"] == scene_id:
                scene = normalize(body)
                scene["id"] = scene_id
                scene["created"] = old["created"]
                scene["updated"] = _now()
                self._items[i] = scene
                self._save()
                return dict(scene)
        return None

    def remove(self, scene_id: str) -> dict | None:
        for i, scene in enumerate(self._items):
            if scene["id"] == scene_id:
                del self._items[i]
                self._save()
                return dict(scene)
        return None

    def _save(self) -> None:
        _write_json(self._path, {"scenes": self._items})


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    os.replace(tmp, path)


class Active:
    """What the rooms were before each scene now on, keyed by the scene (a
    saved scene's id, or ``try`` for one tried from the editor), so an End
    can put them back. Kept on disk, so a restart of Sonora does not lose
    the way back."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._items: dict[str, dict] = {}
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                self._items = {k: v for k, v in data.items()
                               if isinstance(v, dict) and isinstance(v.get("rooms"), dict)}
        except (OSError, ValueError):
            pass
        self._expire()

    def _expire(self) -> None:
        # A scene that ends on its own is kept until then, however long that is.
        now = time.time()
        stale = [k for k, v in self._items.items()
                 if (v.get("at") or 0) < now - ACTIVE_FOR and (v.get("ends") or 0) < now]
        for key in stale:
            del self._items[key]
        if stale:
            _write_json(self._path, self._items)

    def get(self, key: str) -> dict | None:
        self._expire()
        before = self._items.get(key)
        return dict(before) if before else None

    def set(self, key: str, before: dict) -> None:
        self._items[key] = before
        _write_json(self._path, self._items)

    def set_end(self, key: str, ends: float | None, started: float | None = None) -> None:
        """Note when the scene under ``key`` ends on its own, or that it does
        not, and when it was last set: its delayed groups count from then."""
        held = self._items.get(key)
        if held is None or (held.get("ends"), held.get("started")) == (ends, started or held.get("started")):
            return
        if ends is None:
            held.pop("ends", None)
        else:
            held["ends"] = ends
        if started:
            held["started"] = started
        _write_json(self._path, self._items)

    def describe(self, key: str, name: str, groups: list[dict], page: str = "") -> None:
        """Keep the scene's name and groups with its record, for a scene
        that is not saved, and the page that set it: a test from the
        editor, which ends when that page goes."""
        held = self._items.get(key)
        if held is None or (held.get("name"), held.get("groups"), held.get("page")) == (name, groups, page):
            return
        held.update(name=name, groups=groups, page=page)
        _write_json(self._path, self._items)

    def ending(self) -> dict[str, float]:
        """``{key: ends}`` for the scenes now on that end on their own."""
        self._expire()
        return {k: v["ends"] for k, v in self._items.items() if v.get("ends")}

    def set_later(self, key: str, later: list[dict]) -> None:
        """Keep the scene's groups still waiting on their delay, each as
        ``{"id", "due", "group"}``, so a restart of Sonora sets them when
        their time comes instead of losing them. The group itself is kept,
        not a pointer into the saved scene: a test has no saved scene, and an
        edit made while a group waits must not change what was set going."""
        held = self._items.get(key)
        if held is None:
            return
        if later:
            held["later"] = later
        elif held.pop("later", None) is None:
            return
        _write_json(self._path, self._items)

    def drop_later(self, key: str, entry_id: int) -> None:
        """Forget one waiting group, once it has been set (or given up on)."""
        held = self._items.get(key)
        if held is None or not held.get("later"):
            return
        held["later"] = [e for e in held["later"] if e.get("id") != entry_id]
        if not held["later"]:
            del held["later"]
        _write_json(self._path, self._items)

    def waiting(self) -> dict[str, tuple[str, list[dict]]]:
        """``{key: (name, later)}`` for the scenes now on with groups still
        waiting on their delay."""
        self._expire()
        return {k: (v.get("name", ""), list(v["later"])) for k, v in self._items.items() if v.get("later")}

    def remove(self, key: str) -> None:
        if self._items.pop(key, None) is not None:
            _write_json(self._path, self._items)

    def merge(self, key: str, before: dict) -> None:
        """Add what a group set later found, for rooms the record does not
        hold yet: the earlier record of a room stands."""
        held = self._items.get(key)
        if held is None:
            return
        for uuid, room in (before.get("rooms") or {}).items():
            held["rooms"].setdefault(uuid, room)
        _write_json(self._path, self._items)

    def release(self, key: str) -> dict | None:
        """Forget ``key`` and return what to put back for it: its record,
        less any room a scene set later still holds. That room stays as the
        later scene has it, and the later scene takes this record of the
        room over its own (which is the room under this scene), so when the
        last scene on a room ends, the room goes back to before any of
        them."""
        self._expire()
        before = self._items.pop(key, None)
        if before is None:
            return None
        later = sorted((v for v in self._items.values() if (v.get("at") or 0) >= (before.get("at") or 0)),
                       key=lambda v: v.get("at") or 0)
        kept: dict[str, dict] = {}
        for uuid, room in before.get("rooms", {}).items():
            holder = next((v for v in later if uuid in v.get("rooms", {})), None)
            if holder is None:
                kept[uuid] = room
            else:
                holder["rooms"][uuid] = room
        _write_json(self._path, self._items)
        return {**before, "rooms": kept}

    def listing(self) -> dict[str, dict]:
        """``{key: {name, at}}`` for the scenes now on, with ``started``, when
        it was last set, and ``ends`` for one that ends on its own."""
        self._expire()
        return {k: {"name": v.get("name", ""), "at": v.get("at", 0),
                    **{field: v[field] for field in ("ends", "started") if v.get(field)}}
                for k, v in self._items.items()}


def ends_after(scene: dict) -> int | None:
    """How many seconds after it is set a scene ends on its own: when every
    one of its groups has a play duration, the last of them to run out,
    each counted from its delay. None for a scene that plays until ended."""
    groups = scene.get("groups") or []
    if not groups or not all(g.get("sleep") for g in groups):
        return None
    return max((g.get("delay") or 0) + g["sleep"] for g in groups) * 60


def _group(rooms: list[dict], play: dict | None = None, play_mode: str | None = None) -> dict:
    return {"rooms": rooms, "play": play, "play_mode": play_mode}


def _tv(room: dict) -> dict:
    return {"kind": "tv", "uri": "", "metadata": "", "title": "", "art": "",
            "item_kind": "", "service": "", "source": room["uuid"]}


# -- capture ------------------------------------------------------------------


def _playing_now(state) -> tuple[dict | None, str | None]:
    """What a coordinator has on, as a group's ``play`` and ``play_mode``,
    when it is something a scene can start again (a station, the
    television, a line-in). A queue cannot be started again from here."""
    transport = state.transport
    play = None
    if transport.is_home_theater:
        play = _tv({"uuid": state.uuid})
    elif transport.media_uri.startswith("x-rincon-stream:"):
        play = {"kind": "line_in", "uri": "", "metadata": "", "title": "", "art": "",
                "item_kind": "", "service": "", "source": transport.media_uri.split(":", 1)[1]}
    elif transport.source not in ("queue", "grouped", "unknown", "") and transport.media_uri:
        play = {"kind": "item", "uri": transport.media_uri,
                "metadata": state.media_metadata or "",
                "title": transport.container_title or transport.title or "",
                "art": transport.album_art_uri or "", "item_kind": "station",
                "service": "", "source": ""}
    mode = transport.play_mode if transport.play_mode in const.PLAY_MODES else None
    return play, mode


def capture(controller, groups: list[list[str]]) -> dict:
    """A scene body drawn from how the named rooms stand now, group by
    group: each room's volume and tone, and what the group is listening to
    when that is something a scene can start again. The group's music is
    read from the first of its rooms that leads a group now, else from
    whoever the first room follows."""
    out_groups = []
    for uuids in groups:
        rooms = []
        for uuid in uuids:
            try:
                state = controller.zone(uuid)
            except KeyError:
                continue
            rooms.append({"uuid": uuid, "name": state.name, "volume": state.volume,
                          "tone": {"bass": state.bass, "treble": state.treble, "loudness": state.loudness},
                          "soundbar": None})
        if not rooms:
            continue
        group = _group(rooms)
        home = controller.household_of(rooms[0]["uuid"])
        group["household"] = home.id if home is not None else ""
        lead = None
        for room in rooms:
            try:
                if controller.coordinator_of(room["uuid"]).uuid == room["uuid"]:
                    lead = controller.zone(room["uuid"])
                    break
            except KeyError:
                continue
        if lead is None:
            try:
                lead = controller.coordinator_of(rooms[0]["uuid"])
            except KeyError:
                lead = None
        if lead is not None:
            group["play"], group["play_mode"] = _playing_now(lead)
        out_groups.append(group)
    return {"name": "", "groups": out_groups, "pause_others": False}


# -- apply --------------------------------------------------------------------


async def _settle_groups(controller, expected: dict[str, str]) -> None:
    """Wait, briefly, for the speakers' word on a regrouping just sent.

    A transport command goes to the room's group lead as Sonora last heard
    it, so one sent before the topology event arrives lands on the old
    lead: a room put back on its own queue was telling the lead it had
    just left to play that queue. ``expected`` maps each room moved to the
    lead it should now have."""
    deadline = time.monotonic() + GROUP_SETTLE
    while True:
        settled = True
        for uuid, lead in expected.items():
            try:
                settled &= controller.coordinator_of(uuid).uuid == lead
            except KeyError:
                continue
        if settled or time.monotonic() >= deadline:
            return
        await asyncio.sleep(0.1)


def duration(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d}:00"


def _clock(seconds: int) -> str:
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def _seconds(clock: str) -> int:
    """``H:MM:SS`` as seconds; 0 for anything else."""
    try:
        h, m, s = (int(p) for p in clock.split(":"))
    except (ValueError, AttributeError):
        return 0
    return h * 3600 + m * 60 + s


def _lead(controller, uuids: list[str], play: dict | None) -> str:
    """Which of a group's present rooms leads it. The television's soundbar
    when the group watches it; with nothing to start, a room already leading
    and playing, so the group keeps that music; otherwise the first room."""
    if play and play["kind"] == "tv" and play.get("source") in uuids:
        return play["source"]
    if play is None:
        for want_playing in (True, False):
            for uuid in uuids:
                try:
                    lead = controller.coordinator_of(uuid)
                except KeyError:
                    continue
                if lead.uuid == uuid and (not want_playing
                                          or lead.transport.state in ("PLAYING", "TRANSITIONING")):
                    return uuid
    return uuids[0]


async def _queue_items(commands, host: str) -> list[dict]:
    """The queue on ``host`` as ``{uri, metadata}`` pairs, each item's own
    DIDL kept whole so it can be queued again as it was."""
    items: list[dict] = []
    start = 0
    while start < QUEUE_LIMIT:
        result = await commands.soap.call(host, const.CONTENT_DIRECTORY, "Browse", {
            "ObjectID": "Q:0", "BrowseFlag": "BrowseDirectChildren", "Filter": "*",
            "StartingIndex": start, "RequestedCount": min(200, QUEUE_LIMIT - start),
            "SortCriteria": ""})
        xml = result.get("Result", "") or ""
        page = _ITEM_RE.findall(xml)
        for item in page:
            res = _RES_RE.search(item)
            if res is None:
                continue
            items.append({"uri": html.unescape(res.group(1).strip()),
                          "metadata": _DIDL_HEAD + item + "</DIDL-Lite>"})
        total = int(result.get("TotalMatches", "0") or 0)
        start += len(page)
        if not page or start >= total:
            break
    return items


async def _snapshot(controller, commands, scene: dict, uuids: list[str],
                    queues: set[str], eqs: set[str]) -> dict:
    """What the named rooms are now, enough to put them back: levels, the
    group each is in, what each group leader has on and where in it, the
    sleep timer, a soundbar's modes for rooms in ``eqs``, and the whole
    queue of rooms in ``queues`` (the leads whose queue the scene replaces)."""
    before: dict = {"name": scene.get("name", ""), "at": time.time(), "rooms": {}}

    async def one(uuid: str) -> None:
        state = controller.zone(uuid)
        try:
            coordinator = controller.coordinator_of(uuid).uuid
        except KeyError:
            coordinator = uuid
        room: dict = {"name": state.name, "coordinator": coordinator,
                      "volume": state.volume, "muted": state.muted,
                      "bass": state.bass, "treble": state.treble, "loudness": state.loudness,
                      "eq": None, "transport": None, "queue": None}
        if coordinator == uuid:
            transport = state.transport
            room["transport"] = {"state": transport.state, "media_uri": transport.media_uri,
                                 "media_metadata": state.media_metadata or "",
                                 "title": transport.container_title or transport.title or "",
                                 "play_mode": transport.play_mode,
                                 "track_number": transport.track_number,
                                 "rel_time": transport.rel_time, "sleep": ""}
            try:
                room["transport"]["sleep"] = await commands.sleep_timer_remaining(uuid)
            except Exception:                         # noqa: BLE001 - then none is put back
                pass
        if uuid in eqs:
            eq: dict = {}
            speech = "SpeechEnhanceEnabled" if commands._has_speech_switch(state) else "DialogLevel"
            for eq_type in ("NightMode", speech):
                try:
                    result = await commands.soap.call(state.host, const.RENDERING_CONTROL, "GetEQ",
                                                      {"InstanceID": 0, "EQType": eq_type},
                                                      quiet_codes=frozenset({"402"}))
                    eq[eq_type] = int(result.get("CurrentValue", "0") or 0)
                except Exception:                     # noqa: BLE001
                    continue
            room["eq"] = eq or None
        if uuid in queues:
            try:
                room["queue"] = await _queue_items(commands, state.host)
            except Exception as exc:                  # noqa: BLE001 - the queue is not put back
                log.info("scene %r: the queue of %s could not be read: %s", scene.get("name"), state.name, exc)
        before["rooms"][uuid] = room

    await asyncio.gather(*(one(u) for u in uuids))
    return before


async def apply(controller, commands, scene: dict,
                metadata_for: Callable[[str, str, str], Awaitable[str]] | None = None) -> dict:
    """Set the scene on the speakers and say how it went.

    Levels and tone go out to every room at once, then each group is
    gathered under its lead, each group's source is started, and whatever
    else the scene names follows. The report lists the rooms set, those not
    found, and each step a speaker refused, as ``{room, step}`` pairs; its
    ``before`` is what the rooms were, for ``revert``.
    """
    report: dict = {"name": scene.get("name", ""), "set": [], "missing": [], "failed": [], "before": None}

    # A group with a delay is not set now: it is handed back under ``later``
    # for the caller to set when its time comes, and the report names it.
    later = [g for g in scene["groups"] if g.get("delay")]
    if later:
        report["later"] = [{"minutes": g["delay"], "rooms": [r["name"] or r["uuid"] for r in g["rooms"]]} for g in later]
        report["later_groups"] = later
        scene = {**scene, "groups": [g for g in scene["groups"] if not g.get("delay")]}
        if not scene["groups"]:
            return report

    def present(uuid: str):
        try:
            state = controller.zone(uuid)
        except KeyError:
            return None
        return state if state.online else None

    groups: list[dict] = []
    for group in scene["groups"]:
        rooms = [r for r in group["rooms"] if present(r["uuid"]) is not None]
        if group.get("keep_levels"):
            # The rooms' own levels stand: nothing of theirs is sent, only the grouping and the music.
            rooms = [{**r, "volume": None, "tone": None, "soundbar": None} for r in rooms]
        report["missing"] += [r["name"] or r["uuid"] for r in group["rooms"] if present(r["uuid"]) is None]
        if not rooms:
            continue
        uuids = [r["uuid"] for r in rooms]
        groups.append({"rooms": rooms, "uuids": uuids, "play": group["play"], "sleep": group.get("sleep"),
                       "play_mode": group["play_mode"], "lead": _lead(controller, uuids, group["play"])})
    if not groups:
        return report
    rooms = [r for g in groups for r in g["rooms"]]
    wanted = {r["uuid"] for r in rooms}
    names = {u: controller.zone(u).name for u in wanted}

    def fail(room: str, step: str, exc: Exception) -> None:
        report["failed"].append({"room": names.get(room, room), "step": step})
        log.info("scene %r: %s on %s failed: %s", scene.get("name"), step, names.get(room, room), exc)

    # Rooms that follow a scene room now and are not in the scene step out,
    # so each group is the scene's and nothing more: a room that joins its
    # lead would otherwise bring its own followers along.
    extras: set[str] = set()
    for uuid in wanted:
        household = controller.household_of(uuid)
        current = household.group_for_zone(uuid) if household is not None else None
        if current is not None and current.coordinator_uuid == uuid:
            extras |= {u for u in current.zone_uuids if u not in wanted and u in controller.zones}
    # Every room outside the scene, on every system Sonora can see.
    others: list[str] = []
    if scene.get("pause_others"):
        others = [g.coordinator_uuid for household in controller.households.values() for g in household.groups.values()
                  if g.coordinator_uuid not in wanted and g.coordinator_uuid in controller.zones]

    queues = {g["lead"] for g in groups
              if g["play"] and g["play"]["kind"] == "item" and commands._queueable(g["play"]["uri"])
              and g["play"].get("item_kind") != "audiobook"}
    eqs = {r["uuid"] for r in rooms if r.get("soundbar")}
    try:
        report["before"] = await _snapshot(controller, commands, scene,
                                           [*wanted, *(u for u in extras if u not in wanted), *others],
                                           queues, eqs)
    except Exception as exc:                          # noqa: BLE001 - the scene is set all the same
        log.info("scene %r: the rooms could not be written down first: %s", scene.get("name"), exc)

    async def level(room: dict) -> None:
        uuid = room["uuid"]
        if room.get("volume") is not None:
            try:
                await commands.set_volume(uuid, room["volume"])
                if controller.zone(uuid).muted:
                    await commands.set_mute(uuid, False)
            except Exception as exc:                  # noqa: BLE001 - reported, not raised
                fail(uuid, "volume", exc)
        tone = room.get("tone")
        if tone:
            try:
                await commands.set_bass(uuid, tone["bass"])
                await commands.set_treble(uuid, tone["treble"])
                await commands.set_loudness(uuid, tone["loudness"])
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "tone", exc)
        soundbar = room.get("soundbar")
        if soundbar:
            try:
                await commands.set_eq(uuid, "NightMode", 1 if soundbar["night_mode"] else 0)
                await commands.set_eq(uuid, "DialogLevel", 1 if soundbar["speech"] else 0)
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "soundbar", exc)

    await asyncio.gather(*(level(r) for r in rooms))

    # Every lead that follows another room steps out first, then every
    # other room joins its lead and the extras leave, all at once.
    async def step_out(uuid: str) -> None:
        try:
            if controller.coordinator_of(uuid).uuid != uuid:
                await commands.unjoin(uuid)
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "group", exc)

    await asyncio.gather(*(step_out(g["lead"]) for g in groups))

    async def join(uuid: str, leader: str) -> None:
        try:
            if controller.coordinator_of(uuid).uuid != leader:
                await commands.join(uuid, leader)
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "group", exc)

    async def leave(uuid: str) -> None:
        try:
            await commands.unjoin(uuid)
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "group", exc)

    await asyncio.gather(*(join(u, g["lead"]) for g in groups for u in g["uuids"] if u != g["lead"]),
                         *(leave(u) for u in extras))
    await _settle_groups(controller, {**{u: g["lead"] for g in groups for u in g["uuids"]}, **{u: u for u in extras}})

    async def start(group: dict) -> None:
        leader = group["lead"]
        play = group["play"]
        if play:
            try:
                if play["kind"] == "tv":
                    await commands.play_tv(leader)
                    await commands.play(leader)
                elif play["kind"] == "line_in":
                    await commands.play_line_in(leader, play.get("source") or None)
                    await commands.play(leader)
                elif play["kind"] == "silence":
                    # Paused where the source allows it, so a queue keeps its
                    # place; a stream refuses Pause and is stopped instead.
                    if controller.zone(leader).transport.state in ("PLAYING", "TRANSITIONING"):
                        try:
                            await commands.pause(leader)
                        except SoapFault:
                            await commands.stop(leader)
                else:
                    metadata = play.get("metadata") or ""
                    if not metadata and metadata_for is not None:
                        metadata = await metadata_for(leader, play["uri"], play.get("title", ""))
                    if leader in queues:
                        await commands.replace_queue(leader, play["uri"], metadata)
                    else:
                        await commands.play_now(leader, play["uri"], metadata, kind=play.get("item_kind", ""))
            except Exception as exc:                  # noqa: BLE001
                fail(leader, "play", exc)
        if group.get("play_mode"):
            try:
                await commands.set_play_mode(leader, group["play_mode"])
            except SoapFault as exc:
                # A station or a service that has no shuffle or repeat refuses
                # the mode (712). The music plays all the same, so this is
                # nothing to tell the person about.
                log.info("scene %r: %s takes no play mode: %s", scene.get("name"), names.get(leader, leader), exc)
            except Exception as exc:                  # noqa: BLE001
                fail(leader, "play_mode", exc)
        if group.get("sleep"):
            try:
                await commands.set_sleep_timer(leader, duration(int(group["sleep"])))
            except Exception as exc:                  # noqa: BLE001
                fail(leader, "sleep", exc)

    await asyncio.gather(*(start(g) for g in groups))

    if others:
        async def quiet(coordinator: str) -> None:
            state = controller.zone(coordinator)
            if state.transport.is_home_theater or state.transport.state not in ("PLAYING", "TRANSITIONING"):
                return
            try:
                await commands.pause(coordinator)
            except SoapFault:
                try:
                    await commands.stop(coordinator)
                except Exception as exc:              # noqa: BLE001
                    fail(coordinator, "pause", exc)
            except Exception as exc:                  # noqa: BLE001
                fail(coordinator, "pause", exc)
        await asyncio.gather(*(quiet(u) for u in others))

    report["set"] = [names[r["uuid"]] for r in rooms]
    return report


# -- end ----------------------------------------------------------------------


def _source_metadata(controller, uuid: str, was: dict) -> str:
    """The metadata a room's old source goes back with: what the speaker
    had for it, or, for a service station it had none for (a station played
    from the speakers' own radio list carries none, and a service URI sent
    bare is refused with 402), one composed from the URI and the title. A
    queue, a line-in or a TV goes back bare: a station's metadata on a
    queue URI is refused as an illegal MIME type."""
    if was.get("media_metadata"):
        return was["media_metadata"]
    uri = was.get("media_uri") or ""
    sid = smapi_sid(uri)
    if not sid:
        return ""
    household = controller.household_of(uuid)
    udn = controller.account_udn(household.id, sid, smapi_account_serial(uri)) if household is not None else ""
    return station_didl(uri, was.get("title") or "", udn)


async def revert(controller, commands, before: dict) -> dict:
    """Put the rooms back as ``apply`` found them: the groups they were in,
    what each group had on and where in it, a replaced queue, the sleep
    timer, and every room's levels. The report reads as ``apply``'s."""
    report: dict = {"name": before.get("name", ""), "set": [], "missing": [], "failed": []}
    rooms: dict[str, dict] = {}
    for uuid, room in before.get("rooms", {}).items():
        try:
            state = controller.zone(uuid)
        except KeyError:
            state = None
        if state is None or not state.online:
            report["missing"].append(room.get("name") or uuid)
        else:
            rooms[uuid] = room
    if not rooms:
        return report

    def fail(uuid: str, step: str, exc: Exception) -> None:
        report["failed"].append({"room": rooms[uuid].get("name") or uuid, "step": step})
        log.info("scene %r end: %s on %s failed: %s", before.get("name"), step, rooms[uuid].get("name"), exc)

    # Groups first: whoever led steps out of any group it is in now, then
    # whoever followed goes back to its lead, and a room that led on its
    # own stands alone again.
    async def step_out(uuid: str) -> None:
        try:
            if controller.coordinator_of(uuid).uuid != uuid:
                await commands.unjoin(uuid)
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "group", exc)

    leads = [u for u, r in rooms.items() if r["coordinator"] == u]
    await asyncio.gather(*(step_out(u) for u in leads))

    async def rejoin(uuid: str) -> None:
        leader = rooms[uuid]["coordinator"]
        if leader not in controller.zones:
            return
        try:
            if controller.coordinator_of(uuid).uuid != leader:
                await commands.join(uuid, leader)
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "group", exc)

    await asyncio.gather(*(rejoin(u) for u, r in rooms.items() if r["coordinator"] != u))
    await _settle_groups(controller, {u: r["coordinator"] for u, r in rooms.items()
                                      if r["coordinator"] == u or r["coordinator"] in controller.zones})

    async def restore_transport(uuid: str) -> None:
        room = rooms[uuid]
        was = room.get("transport")
        if not was:
            return
        state = controller.zone(uuid)
        now = state.transport
        queue = room.get("queue")
        playing_now = now.state in ("PLAYING", "TRANSITIONING")
        resume = was["state"] in ("PLAYING", "TRANSITIONING")
        source_changed = queue is not None or now.media_uri != was["media_uri"]
        # A room that was quiet is quieted before anything of its own goes
        # back: a player that is playing takes up whatever source it is
        # handed and carries on with it. Paused on the same source, it is
        # paused where it stands; otherwise it is stopped.
        if not resume and playing_now:
            try:
                if was["state"] == "PAUSED_PLAYBACK" and not source_changed:
                    try:
                        await commands.pause(uuid)
                    except SoapFault:
                        await commands.stop(uuid)
                else:
                    await commands.stop(uuid)
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "play", exc)
        if queue is not None:
            try:
                await commands.clear_queue(uuid)
                for i in range(0, len(queue), 16):
                    batch = queue[i:i + 16]
                    try:
                        await commands.soap.call(state.host, const.AV_TRANSPORT, "AddMultipleURIsToQueue", {
                            "InstanceID": 0, "UpdateID": 0, "NumberOfURIs": len(batch),
                            "EnqueuedURIs": " ".join(q["uri"] for q in batch),
                            "EnqueuedURIsMetaData": " ".join(q["metadata"] for q in batch),
                            "ContainerURI": "", "ContainerMetaData": "",
                            "DesiredFirstTrackNumberEnqueued": 0, "EnqueueAsNext": 0}, timeout=20.0)
                    except SoapFault:
                        for q in batch:
                            await commands.add_to_queue(uuid, q["uri"], q["metadata"])
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "queue", exc)
        is_queue = was["media_uri"].startswith("x-rincon-queue:")
        if was["media_uri"]:
            try:
                if source_changed:
                    await commands.set_source(uuid, was["media_uri"], _source_metadata(controller, uuid, was))
                    if is_queue and was.get("track_number"):
                        # A bare seek: the transport was just pointed at the
                        # queue, and the seek command would read the room's
                        # last known state, still the scene's, and press Play.
                        await commands.soap.call(state.host, const.AV_TRANSPORT, "Seek",
                                                 {"InstanceID": 0, "Unit": "TRACK_NR", "Target": int(was["track_number"])})
                        if _seconds(was.get("rel_time", "")):
                            await commands.seek_time(uuid, was["rel_time"])
                elif is_queue and was.get("track_number") and now.track_number != was["track_number"]:
                    await commands.seek_track(uuid, int(was["track_number"]))
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "play", exc)
        if was.get("play_mode") and now.play_mode != was["play_mode"]:
            try:
                await commands.set_play_mode(uuid, was["play_mode"])
            except SoapFault as exc:
                # 712: the source has no play mode (an empty queue, a
                # station), so there is none to put back.
                if exc.code != "712":
                    fail(uuid, "play_mode", exc)
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "play_mode", exc)
        if resume and (source_changed or not playing_now):
            try:
                await commands.play(uuid)
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "play", exc)
        try:
            # The timer that was running, less the time the scene was on.
            left = _seconds(was.get("sleep", "")) - int(time.time() - (before.get("at") or time.time()))
            if _seconds(was.get("sleep", "")):
                await commands.set_sleep_timer(uuid, _clock(left) if left > 0 else None)
            elif await commands.sleep_timer_remaining(uuid):
                await commands.set_sleep_timer(uuid, None)
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "sleep", exc)

    await asyncio.gather(*(restore_transport(u) for u in leads))

    async def level(uuid: str) -> None:
        room = rooms[uuid]
        state = controller.zone(uuid)
        try:
            if state.volume != room["volume"]:
                await commands.set_volume(uuid, room["volume"])
            if state.muted != room["muted"]:
                await commands.set_mute(uuid, room["muted"])
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "volume", exc)
        try:
            if state.bass != room["bass"]:
                await commands.set_bass(uuid, room["bass"])
            if state.treble != room["treble"]:
                await commands.set_treble(uuid, room["treble"])
            if state.loudness != room["loudness"]:
                await commands.set_loudness(uuid, room["loudness"])
        except Exception as exc:                      # noqa: BLE001
            fail(uuid, "tone", exc)
        if room.get("eq"):
            try:
                for eq_type, value in room["eq"].items():
                    await commands.set_eq(uuid, "DialogLevel" if eq_type == "SpeechEnhanceEnabled" else eq_type, value)
            except Exception as exc:                  # noqa: BLE001
                fail(uuid, "soundbar", exc)

    await asyncio.gather(*(level(u) for u in rooms))
    report["set"] = [r.get("name") or u for u, r in rooms.items()]
    return report
