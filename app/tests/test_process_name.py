"""The server names itself ``sonora`` in process lists, on Linux, and never fails to start over it."""

import sys
import threading

import pytest

from backend.__main__ import name_process


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="the short name is Linux's")
def test_the_thread_is_named_sonora():
    seen = {}

    def run():
        name_process()
        with open(f"/proc/self/task/{threading.get_native_id()}/comm") as comm:
            seen["name"] = comm.read().strip()

    # A thread of its own, so the test runner's own name is left alone.
    worker = threading.Thread(target=run)
    worker.start()
    worker.join()
    assert seen["name"] == "sonora"


def test_a_long_name_is_cut_rather_than_refused():
    worker = threading.Thread(target=name_process, args=("a-name-longer-than-fifteen-bytes",))
    worker.start()
    worker.join()
