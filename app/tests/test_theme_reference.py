"""What Sonora publishes to someone writing a theme.

A theme author has a Sonora, a browser and THEMES.md. They do not have this
source tree, and whatever they use to write the theme may not have a browser
either. So the rules are published in a form a tool can read -- a JSON Schema
for ``theme.json`` and the class names a stylesheet is written against -- and
these tests are what keep the published copy honest.

The schema is generated from the same constants the install gate enforces, so
it cannot drift by being forgotten; these tests are for the ways it could
still drift, which are all of them being generated wrongly.
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

import jsonschema
import pytest

from backend import themes

ROOT = pathlib.Path(__file__).resolve().parent.parent
GUIDE = ROOT.parent / "THEMES.md"


# -- the schema --------------------------------------------------------------

def test_the_schema_is_a_schema():
    jsonschema.Draft202012Validator.check_schema(themes.schema())


def _validator():
    return jsonschema.Draft202012Validator(themes.schema())


def _guide_manifest() -> dict:
    block = re.findall(r"```json\n(.*?)```", GUIDE.read_text(encoding="utf-8"), re.S)[0]
    return json.loads(block)


def test_the_guides_own_theme_passes_the_schema():
    """The example a theme author starts from has to validate against the
    thing they would validate it with."""
    assert not list(_validator().iter_errors(_guide_manifest()))


@pytest.mark.parametrize("label,root", [
    ("an unknown part", {"part": "stage"}),
    ("an unknown region", {"region": "grid", "children": [{"part": "browse"}]}),
    ("both at once", {"region": "column", "part": "browse",
                      "children": [{"part": "browse"}]}),
    ("neither", {"grow": True}),
    ("a region with no children", {"region": "column", "children": []}),
    ("another part's prop", {"part": "rooms", "props": {"expanded": True}}),
    ("a condition that does not exist", {"part": "browse", "when": {"weather": True}}),
    ("a condition that is not a fact", {"part": "browse", "when": {"narrow": "yes"}}),
    ("a stray key", {"part": "browse", "wobble": 3}),
])
def test_the_schema_catches_what_the_gate_catches(label, root):
    manifest = {**_guide_manifest(), "layout": {"root": root}}
    assert list(_validator().iter_errors(manifest)), f"the schema missed {label}"
    # And the gate agrees, which is the point of generating one from the other.
    assert themes.validate_layout({"root": root}), f"the gate missed {label}"


def test_the_schema_names_what_the_gate_names():
    """Generated from the constants, so this is really a test that the
    generation reads the right ones."""
    schema = themes.schema()
    node = schema["$defs"]["node"]["properties"]
    assert set(node["part"]["enum"]) == set(themes.LAYOUT_PARTS)
    assert set(node["region"]["enum"]) == set(themes.LAYOUT_REGIONS)
    assert set(node["when"]["properties"]) == set(themes.LAYOUT_CONDITIONS)
    for size in themes.LAYOUT_SIZES:
        assert size in node, f"the schema does not allow {size}"
    # Any minor of this major is read, so the schema says a pattern, not a const.
    import re
    engine = schema["properties"]["themeEngine"]
    assert re.match(engine["pattern"], themes.ENGINE)
    assert re.match(engine["pattern"], f"{themes.ENGINE_MAJOR}.4")
    assert not re.match(engine["pattern"], f"{themes.ENGINE_MAJOR + 1}.0")


def test_the_schema_says_what_is_in_the_archive():
    """The one thing a schema for theme.json cannot express is that the
    stylesheet and the screenshot are files beside it."""
    archive = themes.schema()["x-sonora-archive"]
    assert archive["manifest"] == themes.MANIFEST
    assert archive["stylesheet"] == themes.STYLESHEET
    assert ".webp" in archive["pictureTypes"]


# -- the class reference -----------------------------------------------------

def test_the_reference_is_current():
    """It is generated from the parts, so a renamed class has to be
    regenerated rather than silently published as a name nothing renders."""
    done = subprocess.run(
        [sys.executable, str(ROOT / "tests/theme_reference_build.py"), "--check"],
        capture_output=True, text=True, cwd=ROOT)
    assert done.returncode == 0, done.stdout + done.stderr


def test_every_name_in_the_reference_is_really_rendered():
    parts = ROOT / "frontend/src/parts"
    rendered = set()
    for path in parts.glob("*.jsx"):
        rendered.update(re.findall(r"\bdk-[a-z0-9-]+", path.read_text(encoding="utf-8")))
    published = {name for names in themes.reference()["classes"].values()
                 for name in names}
    assert published <= rendered, sorted(published - rendered)
    assert published, "the reference is empty"


def test_the_reference_groups_by_part():
    groups = themes.reference()["classes"]
    for part in ("rooms", "browse", "transport"):
        assert part in groups, f"no class names published for {part}"
