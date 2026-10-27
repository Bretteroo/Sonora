"""A folder being added is kept until the players list it, across a restart:
a large library indexes for many minutes before it is listed, and a restart in
that window used to forget it, leaving the page indexing with no row for it.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from backend.sonos.controller import SonosController


def controller(data: Path):
    # Only what the pending-share calls use: a household lookup, the file,
    # and the record kept in memory.
    ctl = SimpleNamespace(household_of=lambda _zone: SimpleNamespace(id="H"),
                          _pending_file=data / "pending_shares.json",
                          _share_key=SonosController._share_key,
                          PENDING_SHARE_LIMIT=SonosController.PENDING_SHARE_LIMIT)
    for name in ("_load_pending_shares", "_save_pending_shares", "note_pending_share",
                 "note_pending_share_hint", "clear_pending_share", "settle_pending_shares"):
        setattr(ctl, name, getattr(SonosController, name).__get__(ctl))
    ctl._pending_shares = ctl._load_pending_shares()
    return ctl


def test_a_folder_being_added_survives_a_restart(tmp_path):
    first = controller(tmp_path)
    first.note_pending_share("Z", "//nas/Music/Big", took="RINCON_1")
    again = controller(tmp_path)
    [row] = again.settle_pending_shares("Z", listed=[], indexing=True)
    assert row["path"] == "//nas/Music/Big" and row["state"] == "indexing"


def test_a_listed_folder_is_forgotten_on_disk_too(tmp_path):
    first = controller(tmp_path)
    first.note_pending_share("Z", "//nas/Music/Big", took="RINCON_1")
    assert first.settle_pending_shares("Z", listed=["//nas/Music/Big/"]) == []
    assert controller(tmp_path).settle_pending_shares("Z", listed=[]) == []
