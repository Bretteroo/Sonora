"""The Home Assistant app's options: the ports Sonora listens on.

Home Assistant writes what was entered on the app's Configuration tab to
``/data/options.json`` before it starts the container. Sonora reads its two
ports from there and puts them where every other install sets them, the
environment (``SONORA_WEB_PORT``, ``SONORA_EVENT_PORT``), so the rest of
Sonora sees no difference. Outside Home Assistant nothing here does anything.

The page in Home Assistant's sidebar comes through ingress, on a port of the
Supervisor's choosing (the app's ``ingress_port: 0``): with a fixed one, moving
the web port would have broken the sidebar. Sonora asks the Supervisor which
port that is and serves the same page there as well (``__main__``).
"""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

#: Where Home Assistant leaves the options entered for the app.
OPTIONS = Path("/data/options.json")
#: The Supervisor's own API, reachable from an app that asks for it
#: (``hassio_api: true``) with the token it is given.
SUPERVISOR_INFO = "http://supervisor/addons/self/info"

#: Each option and the variable it sets.
PORTS = {"web_port": "SONORA_WEB_PORT", "event_port": "SONORA_EVENT_PORT"}


def in_home_assistant() -> bool:
    return os.environ.get("SONORA_HA_INGRESS", "").strip().lower() in {"1", "true", "yes"}


def apply(path: Path = OPTIONS) -> dict:
    """Set the ports from the app's options, before Sonora's settings are read.

    Returns the options found, empty outside Home Assistant or when the file
    is missing or unreadable, in which case the defaults stand.
    """
    if not in_home_assistant():
        return {}
    try:
        options = json.loads(path.read_text())
    except (OSError, ValueError):
        return {}
    if not isinstance(options, dict):
        return {}
    for option, variable in PORTS.items():
        value = options.get(option)
        if isinstance(value, int) and not isinstance(value, bool) and 0 < value < 65536:
            os.environ[variable] = str(value)
    return options


def ingress_port(timeout: float = 5.0) -> int | None:
    """The port the Supervisor sends the sidebar's page to, or None.

    None outside Home Assistant, and whenever the Supervisor cannot be asked;
    the page then still serves on the web port.
    """
    token = os.environ.get("SUPERVISOR_TOKEN", "")
    if not in_home_assistant() or not token:
        return None
    request = urllib.request.Request(SUPERVISOR_INFO, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as answer:
            info = json.load(answer)
    except (OSError, ValueError):
        return None
    port = (info.get("data") or {}).get("ingress_port") if isinstance(info, dict) else None
    return port if isinstance(port, int) and not isinstance(port, bool) and 0 < port < 65536 else None
