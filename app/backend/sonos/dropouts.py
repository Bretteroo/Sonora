"""Playback dropouts: the moments a room stopped making sound it should have.

Two kinds are told apart, both from what the speakers say themselves.

* ``buffering``: a room that was PLAYING goes TRANSITIONING and comes back to
  PLAYING on the same track. The speaker ran out of audio and waited for more,
  which is what a listener hears as the music cutting out. A track change goes
  through TRANSITIONING too, so one that ends on another track is not counted,
  and neither is a seek: the position is read when the pause starts and again
  when it ends, and a pause that lands far from where it began was a jump, not
  a stall.
* ``skipped`` and ``failed``: the speaker could not play a source and said so
  in its TransportStatus (see SonosController._note_playback_error). It either
  carried on with the next track or stopped.

Entries are kept for seven days across restarts, like the Error Log, but in a
file of their own so a bad evening on one room cannot push every warning out
of that window.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from typing import Awaitable, Callable

log = logging.getLogger(__name__)

MAX_ENTRIES = 500
MAX_AGE = 7 * 24 * 60 * 60  # seconds
#: A pause shorter than this is the speaker's own hand-off, not a dropout.
MIN_STALL_S = 1.0
#: How far the position may move across a pause before it counts as a seek.
SEEK_SLACK_S = 5.0


@dataclass
class _Stall:
    began: float           # monotonic
    wall: float            # time.time(), for the entry
    track_uri: str
    track_number: int
    position: float | None


class DropoutLog:
    """The entries, newest last, persisted to ``path``."""

    def __init__(self, path: Path | None = None, *, max_entries: int = MAX_ENTRIES,
                 max_age: float = MAX_AGE) -> None:
        self.path = path
        self.max_entries = max_entries
        self.max_age = max_age
        self.entries: list[dict] = []

    def _trim(self, now: float | None = None) -> None:
        cutoff = (time.time() if now is None else now) - self.max_age
        self.entries = [e for e in self.entries if float(e.get("time") or 0) >= cutoff]
        del self.entries[:-self.max_entries]

    def load(self) -> None:
        if self.path is None:
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        self.entries = [e for e in (data.get("entries") if isinstance(data, dict) else []) or []
                        if isinstance(e, dict) and isinstance(e.get("time"), (int, float))]
        self._trim()

    def add(self, entry: dict) -> None:
        self.entries.append(entry)
        self._trim(entry.get("time"))
        if self.path is None:
            return
        try:
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps({"entries": self.entries}), encoding="utf-8")
            tmp.replace(self.path)
        except OSError as exc:
            log.debug("could not save the dropout log: %s", exc)

    def recent(self) -> list[dict]:
        self._trim()
        return list(self.entries)


class DropoutWatch:
    """Turns transport changes into dropout entries.

    ``read_position(state)`` answers the group's position in seconds, or None
    when it cannot be read; ``on_entry(entry)`` hears each new entry.
    """

    def __init__(self, log_: DropoutLog,
                 read_position: Callable[[object], Awaitable[float | None]],
                 on_entry: Callable[[dict], Awaitable[None] | None] | None = None) -> None:
        self.log = log_
        self.read_position = read_position
        self.on_entry = on_entry
        self._stalls: dict[str, _Stall] = {}

    async def transport(self, state, before: str, after: str) -> None:
        """A coordinator's TransportState went from ``before`` to ``after``."""
        tr = state.transport
        if before == "PLAYING" and after == "TRANSITIONING":
            self._stalls[state.uuid] = _Stall(monotonic(), time.time(), tr.track_uri,
                                              tr.track_number, None)
            stall = self._stalls[state.uuid]
            stall.position = await self.read_position(state)
            return
        stall = self._stalls.pop(state.uuid, None) if after != "TRANSITIONING" else None
        if stall is None or after != "PLAYING":
            return
        seconds = monotonic() - stall.began
        if seconds < MIN_STALL_S:
            return
        if tr.track_uri != stall.track_uri or tr.track_number != stall.track_number:
            return  # a track change
        if stall.position is not None:
            now_at = await self.read_position(state)
            if now_at is not None and abs(now_at - stall.position) > SEEK_SLACK_S:
                return  # a seek
        await self._add(state, "buffering", seconds=round(seconds, 1), when=stall.wall)

    def forget(self, uuid: str) -> None:
        """A room stopped coordinating (grouped, gone): drop its open pause."""
        self._stalls.pop(uuid, None)

    async def failed(self, state, *, carried_on: bool, item: str, service: str, reason: str) -> None:
        await self._add(state, "skipped" if carried_on else "failed",
                        title=item, service=service, detail=reason)

    async def _add(self, state, kind: str, *, seconds: float | None = None,
                   when: float | None = None, title: str | None = None,
                   service: str | None = None, detail: str = "") -> None:
        tr = state.transport
        entry = {
            "time": when or time.time(),
            "zone": state.uuid,
            "room": state.name,
            "kind": kind,
            "seconds": seconds,
            "title": title if title is not None else (tr.title or tr.container_title or ""),
            "source": tr.container_title or "",
            "service": service if service is not None else (tr.service_name or ""),
            "detail": detail,
        }
        self.log.add(entry)
        if self.on_entry is not None:
            result = self.on_entry(entry)
            if result is not None:
                await result
