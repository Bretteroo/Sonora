"""The container's health check: is Sonora answering on its web port?

Run by the image's HEALTHCHECK as ``python -m backend.healthcheck``. It reads
the port the way Sonora does, Home Assistant's app options included, so a
port moved there is the one asked.
"""

from __future__ import annotations

import os
import sys
import urllib.request

from . import haoptions


def main() -> int:
    haoptions.apply()
    host = os.environ.get("SONORA_WEB_HOST", "") or "127.0.0.1"
    host = {"0.0.0.0": "127.0.0.1", "::": "::1"}.get(host, host)
    host = f"[{host}]" if ":" in host else host
    port = os.environ.get("SONORA_WEB_PORT", "50205")
    try:
        with urllib.request.urlopen(f"http://{host}:{port}/api/health", timeout=4) as answer:
            return 0 if answer.status == 200 else 1
    except OSError:
        return 1


if __name__ == "__main__":
    sys.exit(main())
