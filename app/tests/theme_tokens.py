"""The design tokens a theme can rely on, and how widely each is used.

THEMES.md documents a core set rather than all 123 names: most of the rest
are one theme's private palette (`sand-light`, `rock-red`, `base03`) and mean
nothing anywhere else. "Core" is defined here rather than by hand, so the
guide's table cannot drift from the code:

    a token is core when at least half the built-in themes define it.

Run it to see the set, or with --table to print the guide's table.
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend/src"
#: The themes live at the repository's own ``themes/``, beside the frontend
#: rather than inside it: a theme is Sonora's, not the build's.
THEME_DIR = ROOT / "themes"
THEMES = sorted(p.parent.name for p in THEME_DIR.glob("*/tokens.js"))
KEY = re.compile(r"^\s{2}'?([a-z0-9][a-z0-9-]*)'?:", re.M)


def declared(theme: str, seen: frozenset = frozenset()) -> set[str]:
    """Every token a theme sets, including any it spreads from another."""
    if theme in seen:
        return set()
    text = (THEME_DIR / theme / "tokens.js").read_text(encoding="utf-8")
    keys = set(KEY.findall(text))
    for base in re.findall(r"\.\.\.(\w+)", text):
        found = re.search(rf"import .*\b{base}\b.* from '\.\./(\w+)/tokens\.js'", text)
        if found:
            keys |= declared(found.group(1), seen | {theme})
    return keys


def uses() -> dict[str, int]:
    """How many times each token is read across the stylesheets."""
    out: dict[str, int] = {}
    found = subprocess.run(["grep", "-rhoE", r"var\(--t-[a-z0-9-]+", str(SRC)],
                           capture_output=True, text=True).stdout.split()
    for line in found:
        name = line[len("var(--t-"):]
        out[name] = out.get(name, 0) + 1
    return out


def core() -> list[tuple[str, int, int]]:
    by_theme = {t: declared(t) for t in THEMES}
    read = uses()
    rows = []
    for token in sorted(set().union(*by_theme.values()) | set(read)):
        have = sum(token in by_theme[t] for t in THEMES)
        if have * 2 >= len(THEMES):
            rows.append((token, have, read.get(token, 0)))
    return sorted(rows, key=lambda r: (-r[2], r[0]))


if __name__ == "__main__":
    rows = core()
    if "--table" in sys.argv:
        print("| token | set by | used |")
        print("| --- | --- | --- |")
        for token, have, read in rows:
            print(f"| `--t-{token}` | {have}/{len(THEMES)} | {read} |")
    else:
        print(f"{len(rows)} core tokens of "
              f"{len(set().union(*(declared(t) for t in THEMES)))} in all\n")
        for token, have, read in rows:
            print(f"  --t-{token:<22} set by {have:>2}/{len(THEMES)}  read {read:>3}x")
