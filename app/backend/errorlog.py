"""The Error Log window's entries, kept across restarts.

The S1 Windows app keeps its own error log on disk and reads it back at
start: at most 100 entries, none older than seven days, trimmed on load and
on every new entry (Listener.cs: maxErrorLogEntries = 100, maxErrorLogAge =
7 days, LoadErrorLog / CleanErrorLog / SaveErrorLog). Sonora's had lived in
memory only, so its window was empty after every restart. This keeps the
same rule: Sonora's warnings and errors, newest last, in ``error_log.json``
beside its other state.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path

MAX_ENTRIES = 100
MAX_AGE = 7 * 24 * 60 * 60  # seconds
#: A burst of warnings is written once, this long after the first of it.
SAVE_DELAY = 2.0


class ErrorLog(logging.Handler):
    """Warnings and errors for the Error Log window, persisted to ``path``."""

    def __init__(self, path: Path | None = None, *, max_entries: int = MAX_ENTRIES,
                 max_age: float = MAX_AGE, save_delay: float = SAVE_DELAY) -> None:
        super().__init__(level=logging.WARNING)
        self.path = path
        self.max_entries = max_entries
        self.max_age = max_age
        self.save_delay = save_delay
        self.records: list[dict] = []
        self._lock = threading.Lock()
        self._timer: threading.Timer | None = None

    # -- the rule ---------------------------------------------------------------

    def _trim(self, now: float | None = None) -> None:
        """Drop what is older than the age limit, then all but the newest."""
        cutoff = (time.time() if now is None else now) - self.max_age
        self.records = [r for r in self.records if float(r.get("time") or 0) >= cutoff]
        del self.records[:-self.max_entries]

    def entries(self) -> list[dict]:
        with self._lock:
            self._trim()
            return list(self.records)

    # -- logging ----------------------------------------------------------------

    def emit(self, record: logging.LogRecord) -> None:
        try:
            with self._lock:
                self.records.append({"time": record.created, "level": record.levelname,
                                     "source": record.name, "message": record.getMessage()})
                self._trim(record.created)
            self._schedule_save()
        except Exception:  # never let logging break the app
            pass

    # -- the file ---------------------------------------------------------------

    def load(self, path: Path | None = None) -> None:
        """Read the file back, trimmed by the same rule. A missing or damaged
        file leaves the log as it is."""
        if path is not None:
            self.path = path
        if self.path is None:
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        saved = [r for r in (data.get("entries") if isinstance(data, dict) else data) or []
                 if isinstance(r, dict) and isinstance(r.get("time"), (int, float))
                 and isinstance(r.get("message"), str)]
        with self._lock:
            # Anything logged before the file was read (start-up) follows the
            # saved entries, which are older.
            merged = {(r["time"], r["message"]): r for r in saved + self.records}
            self.records = sorted(merged.values(), key=lambda r: r["time"])
            self._trim()

    def _schedule_save(self) -> None:
        if self.path is None or self.save_delay < 0:
            return
        with self._lock:
            if self._timer is not None:
                return
            self._timer = threading.Timer(self.save_delay, self.save)
            self._timer.daemon = True
            self._timer.start()

    def save(self) -> None:
        """Write the log out whole, replacing the file in one step."""
        with self._lock:
            self._timer = None
            if self.path is None:
                return
            self._trim()
            payload = json.dumps({"entries": self.records}, ensure_ascii=False)
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(payload, encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError:
            pass

    def close(self) -> None:
        with self._lock:
            timer, self._timer = self._timer, None
        if timer is not None:
            timer.cancel()
        self.save()
        super().close()
