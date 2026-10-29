"""A row's artwork stays inside its tile, in every theme that draws tiles.

The 9.1 theme draws 30px tiles over styles written for 40px ones, and each
kind of placeholder sized its own contents for 40px. Each was caught by eye
one at a time: the folder and stack icons first, then the station and
playlist glyphs, which sat 9px off their tiles' bottom-right corner. This
walks real lists in Firefox and measures every tile instead.

It needs Sonora running with a household (SONORA_URL, default
http://localhost:50205/), Node, playwright-core and Playwright's Firefox; it
skips when any is missing. Only GET requests leave the page, so walking the
lists plays nothing.
"""

import os
import pathlib
import shutil
import subprocess
import urllib.request

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "tests" / "browser" / "art_inside_tiles.mjs"
HOME = pathlib.Path.home()
NODE = shutil.which("node") or next((str(p) for p in HOME.glob(".local/opt/node-*/bin/node")), None)
PLAYWRIGHT = os.environ.get("PLAYWRIGHT_CORE") or next(
    (str(p) for p in sorted(HOME.glob(".npm/_npx/*/node_modules/playwright-core/index.mjs"))), None)
FIREFOX = os.environ.get("PLAYWRIGHT_FIREFOX") or next(
    (str(p) for p in sorted(HOME.glob(".cache/ms-playwright/firefox-*/firefox/firefox"), reverse=True)), None)
BASE = os.environ.get("SONORA_URL", "http://localhost:50205/")
# Every theme whose browse lists draw .dk-browse-art tiles.
THEMES = sorted({p.parent.name for p in (ROOT / "themes").glob("*/*.jsx")
                 if "dk-browse-art" in p.read_text(encoding="utf-8")})


def _sonora_up() -> bool:
    try:
        with urllib.request.urlopen(BASE, timeout=3):
            return True
    except OSError:
        return False


@pytest.mark.skipif(not (NODE and PLAYWRIGHT and FIREFOX), reason="Node, playwright-core or Firefox is missing")
def test_art_stays_inside_its_tile():
    if not _sonora_up():
        pytest.skip(f"Sonora is not running at {BASE}")
    result = subprocess.run([NODE, str(SCRIPT), PLAYWRIGHT, FIREFOX, BASE, *THEMES],
                            capture_output=True, text=True, timeout=600)
    assert result.returncode == 0, result.stdout[-4000:] + result.stderr[-2000:]
