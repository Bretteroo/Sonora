"""Regenerate the class-name reference Sonora serves to theme authors.

    .venv/bin/python tests/theme_reference_build.py          # write it
    .venv/bin/python tests/theme_reference_build.py --check   # is it current?

A theme's stylesheet is written against class names the parts render, and an
author has none of this source tree: they have a Sonora, a browser and
THEMES.md. The inspector is the accurate answer for a person and no answer at
all for anything working from the document, which will invent selectors.

So the names are read out of the parts and their stylesheet here and written
to ``backend/theme_reference.json``, which Sonora serves at
``/api/themes/reference``. Generated rather than maintained, because a list
kept by hand is a list that will be wrong.

``tests/test_theme_reference.py`` runs this with --check, so a part that
renames a class fails the suite rather than quietly making the reference a
lie.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / "frontend/src/parts"
OUT = ROOT / "backend/theme_reference.json"

#: Which file draws which parts, mirroring parts/registry.js. Grouped by file
#: rather than by part because one file draws two of them, and counting its
#: names twice would make every one of them look shared.
SOURCES = {
    "rooms": "Rooms.jsx",
    "nowPlaying and queue": "Center.jsx",
    "browse": "Browse.jsx",
    "transport": "Transport.jsx",
    "paneSwitch": "PaneSwitch.jsx",
    # The theme chooser is most of the settings part, and it is a shared
    # component, so its names are read from where it is written.
    "settings": ("Settings.jsx", "../components/ThemeChooser.jsx"),
    "sliders": "Slider.jsx",
}

#: Names that appear in more than one part are not that part's; they are the
#: furniture every pane is built from, and an author wants them under one
#: heading rather than repeated five times.
SHARED = "any pane"

#: The parts' names are all `dk-`. The settings part and the Settings button
#: are the renderer's and the chooser's own, and carry `pt-` and `theme-`
#: names as well: with only `dk-` read, the reference had no settings group at
#: all (found by the theme-guide test).
CLASS = re.compile(r"(?<![\w-])(?:dk|pt|theme)-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w-]*\$\{)")


def _names(filenames) -> set[str]:
    if isinstance(filenames, str):
        filenames = (filenames,)
    found: set[str] = set()
    for filename in filenames:
        found |= set(CLASS.findall((PARTS / filename).read_text(encoding="utf-8")))
    return found


def _read_by_the_parts() -> list[str]:
    """Every token the layout renderer's own sheets read.

    This is the list a theme installed from a file is painted from. The core
    set is a different thing, the tokens most built-in themes define, and a
    token can be read here without being in it (`tile-selected-fg` is).
    window-chrome.css is left out: its rules are for a shell class the layout
    renderer never sets.
    """
    names: set[str] = set()
    for path in (PARTS / "desktop.css", PARTS / "dialogs.css", PARTS / "responsive.css",
                 PARTS / "arrangement.css", PARTS.parent / "components/shared.css"):
        names |= set(re.findall(r"var\(--t-([a-z0-9-]+)", path.read_text(encoding="utf-8")))
    return sorted(names)


def _tokens() -> dict:
    """Every token name the interface reads, and how many themes set it.

    An author writing against the guide gets the core table; an author writing
    against this gets all of them, which is the difference between choosing a
    palette and guessing at one.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import theme_tokens

    counts = theme_tokens.uses()
    core = {name for name, _, _ in theme_tokens.core()}
    return {
        "core": sorted(core),
        "read": _read_by_the_parts(),
        # Core names are in the full list too: fg-faint was core and absent
        # from it (found by the theme-guide test).
        "all": sorted(set(counts) | core),
        "note": "Each becomes --t-<name>. `read` is every token the parts "
                "read when they draw a theme installed from a file: set "
                "those. `core` is the set most of Sonora's own themes define, "
                "and `all` is every name any of them reads; a name in "
                "neither `read` nor `core` is one theme's own and may change.",
    }


def _placeholder() -> str:
    """A real 640x400 picture that is obviously not a screenshot.

    The screenshot is the one part of a theme that cannot be written, only
    taken, and the gate refuses a fabricated one -- which leaves anything
    building a theme without a browser unable to install it at all, even to
    look at what it made. This is the way round: install with this, look at
    the theme, then screenshot it and install again over the same id.
    """
    from PIL import Image, ImageDraw
    import base64
    import io

    image = Image.new("RGB", (640, 400), "#1b1f24")
    draw = ImageDraw.Draw(image)
    for x in range(0, 640, 40):
        draw.line([(x, 0), (x, 400)], fill="#242a31")
    for y in range(0, 400, 40):
        draw.line([(0, y), (640, y)], fill="#242a31")
    draw.rectangle([180, 170, 460, 230], outline="#3d4650", width=2)
    buffer = io.BytesIO()
    image.save(buffer, "WEBP", quality=60, method=6)
    return "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode()


def build() -> dict:
    by_part = {part: _names(filename) for part, filename in SOURCES.items()}

    # A name drawn by more than one of them belongs to none of them.
    seen: dict[str, int] = {}
    for names in by_part.values():
        for name in names:
            seen[name] = seen.get(name, 0) + 1
    shared = {name for name, count in seen.items() if count > 1}

    #: Which of these the stylesheet actually paints. A class the parts render
    #: and nothing styles is still a hook an author may use, so both are kept,
    #: but the styled ones are the ones worth reaching for first.
    # A package is drawn with the layout renderer's sheets, scoped to
    # :root[data-layout], over the shared components' sheet; read them all,
    # scope removed.
    sheet = "\n".join(
        path.read_text(encoding="utf-8").replace(":where(:root[data-layout]) ", "")
        for path in (PARTS / "desktop.css", PARTS / "dialogs.css",
                     PARTS.parent / "components/shared.css"))
    sheet += "\n" + (PARTS / "arrangement.css").read_text(encoding="utf-8")
    styled = set(re.findall(r"^\.((?:dk|pt|theme)-[a-z0-9-]+)", sheet, re.M))

    groups = {SHARED: sorted(shared)}
    for part, names in by_part.items():
        rest = sorted(names - shared)
        if rest:
            groups[part] = rest

    return {
        "what": "Class names the parts render, for a theme's stylesheet, "
                "grouped by the part that renders them. `any pane` holds the "
                "names more than one part renders, `settings` covers the "
                "settings part and the Settings button Sonora adds when a "
                "layout places none, and `sliders` is every slider, wherever "
                "it is. `styled` lists the ones Sonora's own stylesheet "
                "paints, the ones worth reaching for first. Scope every rule "
                "to :root[data-theme='<your id>'].",
        "classes": groups,
        "styled": sorted(styled),
        "tokens": _tokens(),
        "placeholder": {
            "what": "A real picture to install with while you have no "
                    "screenshot yet. Save it as thumbnail.webp in the "
                    "archive, then replace it with a screenshot of the theme "
                    "and install again over the same id.",
            "dataUrl": _placeholder(),
        },
        "renderer": {
            "root": "pt-root",
            "region": ["pt-region", "pt-column", "pt-row", "pt-stack"],
            "part": "pt-part, plus pt-part-<name>",
            "path": "data-path names a node's place: root, root.0, root.2.1",
        },
    }


def main() -> int:
    current = build()
    text = json.dumps(current, indent=1, sort_keys=True) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists():
            print(f"{OUT.relative_to(ROOT)} has not been generated")
            return 1
        if OUT.read_text(encoding="utf-8") != text:
            print(f"{OUT.relative_to(ROOT)} is out of date; run this without "
                  "--check")
            return 1
        print(f"{OUT.relative_to(ROOT)} is current")
        return 0
    OUT.write_text(text, encoding="utf-8")
    total = sum(len(names) for names in current["classes"].values())
    print(f"wrote {OUT.relative_to(ROOT)}: {total} names in "
          f"{len(current['classes'])} groups")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
