"""Every frontend/src/lib/*.check.mjs passes.

Those checks ran only when someone ran them. groups.check.mjs had been
failing for a week, since the key it looked for was renamed, and
nobody knew. Now the suite runs each one.
"""

import os
import pathlib
import shutil
import subprocess

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHECKS = sorted((ROOT / "frontend" / "src" / "lib").glob("*.check.mjs"))
NODE = shutil.which("node") or next(
    (str(p) for p in pathlib.Path.home().glob(".local/opt/node-*/bin/node")), None)


@pytest.mark.skipif(NODE is None, reason="Node is not installed")
@pytest.mark.parametrize("check", CHECKS, ids=lambda p: p.name)
def test_check_passes(check):
    result = subprocess.run([NODE, str(check)], capture_output=True, text=True,
                            timeout=60, env={**os.environ})
    assert result.returncode == 0, result.stdout[-2000:] + result.stderr[-2000:]
