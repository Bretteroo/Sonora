"""The Error Log keeps what the Windows app keeps: 100 entries, seven days,
across restarts (Listener.cs: maxErrorLogEntries, maxErrorLogAge)."""

import json
import logging
import time

from backend.errorlog import ErrorLog, MAX_AGE, MAX_ENTRIES


def _record(message, created=None, level=logging.WARNING):
    record = logging.LogRecord("backend.test", level, __file__, 1, message, None, None)
    if created is not None:
        record.created = created
    return record


def test_the_limits_are_the_apps():
    assert MAX_ENTRIES == 100
    assert MAX_AGE == 7 * 24 * 60 * 60


def test_only_the_newest_hundred_are_kept():
    log = ErrorLog(save_delay=-1)
    for n in range(130):
        log.emit(_record(f"fault {n}"))
    entries = log.entries()
    assert len(entries) == 100
    assert entries[0]["message"] == "fault 30"
    assert entries[-1]["message"] == "fault 129"


def test_entries_older_than_a_week_go():
    log = ErrorLog(save_delay=-1)
    now = time.time()
    log.emit(_record("eight days ago", now - 8 * 86400))
    log.emit(_record("six days ago", now - 6 * 86400))
    assert [e["message"] for e in log.entries()] == ["six days ago"]


def test_the_log_survives_a_restart(tmp_path):
    path = tmp_path / "error_log.json"
    first = ErrorLog(path, save_delay=-1)
    first.emit(_record("unable to connect to Pandora"))
    first.save()

    second = ErrorLog(save_delay=-1)
    second.emit(_record("logged while starting"))
    second.load(path)
    assert [e["message"] for e in second.entries()] == [
        "unable to connect to Pandora", "logged while starting"]


def test_a_saved_file_is_trimmed_when_read(tmp_path):
    path = tmp_path / "error_log.json"
    now = time.time()
    old = [{"time": now - 10 * 86400, "level": "ERROR", "source": "x", "message": "stale"}]
    fresh = [{"time": now - n, "level": "WARNING", "source": "x", "message": f"m{n}"}
             for n in range(150, 0, -1)]
    path.write_text(json.dumps({"entries": old + fresh}))
    log = ErrorLog(save_delay=-1)
    log.load(path)
    entries = log.entries()
    assert len(entries) == 100
    assert "stale" not in [e["message"] for e in entries]
    assert entries[-1]["message"] == "m1"


def test_a_damaged_file_is_ignored(tmp_path):
    path = tmp_path / "error_log.json"
    path.write_text("{not json")
    log = ErrorLog(save_delay=-1)
    log.load(path)
    assert log.entries() == []


def test_info_lines_are_not_errors():
    log = ErrorLog(save_delay=-1)
    logging.getLogger("backend.test.info").addHandler(log)
    try:
        logging.getLogger("backend.test.info").info("just chatter")
    finally:
        logging.getLogger("backend.test.info").removeHandler(log)
    assert log.entries() == []
