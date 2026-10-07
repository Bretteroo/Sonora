"""Runtime configuration, read from the environment."""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path


#: Where the data folder used to be, and where it is now.
_OLD_DATA_DIR = Path.home() / ".local" / "share" / "sonora"
_DATA_DIR = Path.home() / ".config" / "sonora"
#: What Sonora writes that it can fetch again, so a new folder holding only
#: these has nothing in it worth keeping over the old one.
_CACHES = {"logocache", "products"}


def _data_dir() -> Path:
    """``SONORA_DATA_DIR``, or ``~/.config/sonora``.

    A copy that kept its data in the old ``~/.local/share/sonora`` has it
    moved on first start, so no one signs in again because the default
    moved. The new folder may be there already, empty or holding a cache
    written before the move; the old folder's contents go into it then. If
    the move cannot be made, the old folder goes on being used.
    """
    configured = os.environ.get("SONORA_DATA_DIR")
    if configured:
        return Path(configured)
    if not _OLD_DATA_DIR.is_dir():
        return _DATA_DIR
    try:
        if not _DATA_DIR.exists():
            _DATA_DIR.parent.mkdir(parents=True, exist_ok=True)
            _OLD_DATA_DIR.rename(_DATA_DIR)
        elif {p.name for p in _DATA_DIR.iterdir()} <= _CACHES:
            for entry in _OLD_DATA_DIR.iterdir():
                target = _DATA_DIR / entry.name
                if target.is_dir():
                    shutil.rmtree(target)
                entry.rename(target)
            _OLD_DATA_DIR.rmdir()
        else:
            # Both hold data: the new one is in use, and the old one is left
            # for its owner to look at.
            return _DATA_DIR
    except OSError:
        return _OLD_DATA_DIR if any(_OLD_DATA_DIR.iterdir()) else _DATA_DIR
    return _DATA_DIR


@dataclass(slots=True)
class Settings:
    host: str = os.environ.get("SONORA_WEB_HOST", "0.0.0.0")
    port: int = int(os.environ.get("SONORA_WEB_PORT", "50205"))
    #: Port the UPnP event callback server binds: the speakers connect to it
    #: to report every change. Fixed, so a firewall rule can name it; a free
    #: one is taken if it is in use, and zero always takes a free one.
    event_port: int = int(os.environ.get("SONORA_EVENT_PORT", "50206"))
    log_level: str = os.environ.get("SONORA_LOG_LEVEL", "INFO")
    #: Where runtime state that must survive a restart is kept, outside the
    #: repository. Music-service login tokens live here (see the controller).
    data_dir: Path = field(default_factory=lambda: _data_dir())


settings = Settings()
