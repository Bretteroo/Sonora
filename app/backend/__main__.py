"""``python -m backend``: serve Sonora on the configured host and port.

The port defaults to 50205 (``SONORA_WEB_PORT``), the host to every interface
(``SONORA_WEB_HOST``); see ``backend/config.py`` for the rest.
"""

from __future__ import annotations

import ctypes
import ctypes.util
import sys

import uvicorn

from .config import settings

#: prctl's option for the calling thread's name, the one `ps` and GNOME's
#: System Monitor show (15 bytes at most).
PR_SET_NAME = 15


def name_process(name: str = "sonora") -> None:
    """Show the server as ``sonora`` rather than ``python`` in process lists.

    Linux only, and only the short name: the command line still reads
    ``python -m backend``. Set before the server starts, so the threads it
    starts later carry the name too. Anywhere else, or if the call fails, the
    name stays as it was.
    """
    if not sys.platform.startswith("linux"):
        return
    try:
        libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)
        libc.prctl(PR_SET_NAME, name.encode()[:15], 0, 0, 0)
    except (OSError, AttributeError):
        pass


def main() -> None:
    name_process()
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port,
                log_level=settings.log_level.lower())


if __name__ == "__main__":
    main()
