"""``python -m backend``: serve Sonora on the configured host and port.

The port defaults to 50205 (``SONORA_WEB_PORT``), the host to every interface
(``SONORA_WEB_HOST``); see ``backend/config.py`` for the rest. In Home
Assistant the ports come from the app's options (``backend/haoptions.py``),
and the same page is also served on the port the Supervisor sends the
sidebar's requests to.
"""

from __future__ import annotations

import asyncio
import contextlib
import ctypes
import ctypes.util
import sys

import uvicorn

from . import haoptions

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


class _Alongside(uvicorn.Server):
    """A second listener for the same app: it leaves the signals to the main
    server, which stops it when it stops itself."""

    @contextlib.contextmanager
    def capture_signals(self):
        yield


async def _serve(main: uvicorn.Server, extra: list[uvicorn.Server]) -> None:
    others = [asyncio.create_task(server.serve()) for server in extra]
    try:
        await main.serve()
    finally:
        for server in extra:
            server.should_exit = True
        await asyncio.gather(*others, return_exceptions=True)


def main() -> None:
    name_process()
    # The app's options set the ports before the settings are read.
    haoptions.apply()
    from .config import settings
    level = settings.log_level.lower()
    ingress = haoptions.ingress_port()
    if not ingress or ingress == settings.port:
        uvicorn.run("backend.main:app", host=settings.host, port=settings.port, log_level=level)
        return
    # The sidebar's port serves the same app; only the web port's server runs
    # its startup and shutdown, so there is one Sonora behind both.
    web = uvicorn.Server(uvicorn.Config("backend.main:app", host=settings.host, port=settings.port, log_level=level))
    sidebar = _Alongside(uvicorn.Config("backend.main:app", host=settings.host, port=ingress, log_level=level, lifespan="off"))
    asyncio.run(_serve(web, [sidebar]))


if __name__ == "__main__":
    main()
