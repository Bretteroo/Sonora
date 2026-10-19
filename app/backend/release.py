"""Whether a newer Sonora has been released, looked up once a day.

The first look is 90 seconds after start-up, then one every 24 hours, in the
background whether or not anyone has a page open; the About card only reads
the stored answer. It is one anonymous request for the repository's latest
release on GitHub, compared with the version running. Drafts and
pre-releases are ignored, and nothing is downloaded: the card says a new
version is out and links to the release notes, and updating stays the
person's to do.

The answer lives in memory, so a restart (an update included) looks again
90 seconds later. Quiet on failure: no answer leaves things as they were, is
only logged, and is tried again the next day.
"""

from __future__ import annotations

import asyncio
import functools
import html
import importlib.metadata
import logging
import pathlib
import re
import subprocess
import time

import aiohttp

log = logging.getLogger(__name__)

REPOSITORY = "Bretteroo/Sonora"
LATEST_URL = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
#: Where About sends people: every release's notes, newest first.
RELEASES_PAGE = f"https://github.com/{REPOSITORY}/releases"
INTERVAL_S = 24 * 3600
FIRST_S = 90

_state: dict[str, object] = {"latest": None, "checked_at": 0.0}
_task: asyncio.Task | None = None


def from_describe(described: str) -> str | None:
    """A version from `git describe --long`: the release itself on its tag
    (v1.0.3-0-g1a2b3c4 is 1.0.3), and past it the next patch release as a
    development build, with the commit (v1.0.3-10-g25ffe45 is
    1.0.4-dev+25ffe45), so a copy run from source never names a release it
    has moved on from. Releases go up by a patch at a time."""
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)", described.strip())
    if not match:
        return None
    major, minor, patch, ahead, commit = match.groups()
    if ahead == "0":
        return f"{major}.{minor}.{patch}"
    return f"{major}.{minor}.{int(patch) + 1}-dev+{commit}"


@functools.lru_cache(maxsize=1)
def _checkout_version() -> str | None:
    """The version of a git checkout, from its newest release tag; None when
    the code is not in one (the Docker image and the Home Assistant app are
    built without the repository's history) or git cannot say. Read once, so
    a new release shows after a restart."""
    root = pathlib.Path(__file__).resolve().parent.parent.parent
    if not (root / ".git").exists():
        return None
    try:
        out = subprocess.run(["git", "-C", str(root), "describe", "--tags", "--long", "--match", "v[0-9]*"],
                             capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None
    return from_describe(out.stdout) if out.returncode == 0 else None


def app_version() -> str:
    """The version running: the installed package's (the Docker image and
    the Home Assistant app), else a git checkout's, from its release tags,
    else pyproject.toml beside the code, else "dev"."""
    try:
        return importlib.metadata.version("sonora")
    except importlib.metadata.PackageNotFoundError:
        pass
    checkout = _checkout_version()
    if checkout:
        return checkout
    try:
        text = (pathlib.Path(__file__).resolve().parent.parent / "pyproject.toml").read_text()
        match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.M)
        if match:
            return match.group(1)
    except OSError:
        pass
    return "dev"


def tag_page(body: bytes) -> bytes:
    """index.html with the running version in it, for About to show.

    The bundle carries package.json's version from when it was built, which a
    version bump leaves behind until the next build; the page reads this one
    first, so About always names the Sonora that is serving it.
    """
    tag = f'<meta name="sonora-version" content="{html.escape(app_version(), quote=True)}" />'
    return body.replace(b"<head>", b"<head>\n    " + tag.encode(), 1)


def version_key(version: str) -> tuple[int, ...]:
    """1.0.10 above 1.0.9, and a build of a release still to come (1.0.5-dev,
    1.0.5-rc1) just below that release, so a copy run from source past 1.0.4
    is told when 1.0.5 is out. What follows the hyphen is otherwise ignored."""
    numbers, _, suffix = version.partition("-")
    key = tuple(int(n) for n in re.findall(r"\d+", numbers)[:3]) or (0,)
    return key + ((0,) if suffix else (1,))


def status() -> dict[str, object]:
    current = app_version()
    latest = _state["latest"]
    newer = bool(latest) and current != "dev" and version_key(str(latest)) > version_key(current)
    return {"current": current, "latest": latest, "url": RELEASES_PAGE,
            "available": newer, "checked_at": _state["checked_at"]}


async def check_once() -> None:
    async with aiohttp.ClientSession(headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": f"Sonora/{app_version()}"}) as session:
        async with session.get(LATEST_URL, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            _state["checked_at"] = time.time()
            if resp.status != 200:
                log.info("release check: GitHub answered %s", resp.status)
                return
            data = await resp.json(content_type=None)
    tag = str(data.get("tag_name") or "").lstrip("vV")
    if tag and not data.get("draft") and not data.get("prerelease"):
        _state["latest"] = tag


async def _loop() -> None:
    await asyncio.sleep(FIRST_S)
    while True:
        try:
            await check_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.info("release check failed: %s", exc)
        await asyncio.sleep(INTERVAL_S)


def start() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop(), name="release-watch")


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
        _task = None
