"""A theme package may carry its own layout, and both sides must agree on it.

The author's copy of the rules is ``frontend/src/parts/`` -- it is what tells
someone writing a theme what is wrong with theirs. The copy in
``backend/themes.py`` is the gate an installed file passes through, and it is
the one that matters for trust, because a package that reached the data
directory has already got past the browser.

Two copies drift. These tests read the vocabulary out of the JavaScript and
fail when it no longer matches Python's, so adding a part in one place and
forgetting the other is caught here rather than by a theme that installs and
then cannot be drawn.
"""

from __future__ import annotations

import pathlib
import re

import pytest

from backend.themes import (LAYOUT_CONDITIONS, LAYOUT_PARTS, LAYOUT_PROPS,
                            LAYOUT_REGIONS, ThemeError, validate_layout)
from backend import themes

PARTS_DIR = pathlib.Path(__file__).resolve().parent.parent / "frontend/src/parts"


def _js(name: str) -> str:
    return (PARTS_DIR / name).read_text(encoding="utf-8")


def _names_in(block: str) -> list[str]:
    """The keys of a JavaScript object literal, in order."""
    return re.findall(r"^\s{2}(\w+):", block, re.M)


def _object_literal(source: str, const: str) -> str:
    start = source.index(f"export const {const} = {{")
    depth, i = 0, source.index("{", start)
    for j in range(i, len(source)):
        if source[j] == "{":
            depth += 1
        elif source[j] == "}":
            depth -= 1
            if depth == 0:
                return source[i:j + 1]
    raise AssertionError(f"{const} is not closed")


def test_the_two_vocabularies_name_the_same_parts():
    js = _names_in(_object_literal(_js("vocabulary.js"), "VOCABULARY"))
    assert sorted(js) == sorted(LAYOUT_PARTS), (
        "frontend/src/parts/vocabulary.js and backend/themes.py disagree "
        "about which parts a layout may place")


def test_the_two_agree_about_regions_and_conditions():
    arrangement = _js("arrangement.js")
    regions = _names_in(_object_literal(arrangement, "REGIONS"))
    conditions = _names_in(_object_literal(arrangement, "CONDITIONS"))
    assert sorted(regions) == sorted(LAYOUT_REGIONS)
    assert sorted(conditions) == sorted(LAYOUT_CONDITIONS)


def test_the_two_agree_about_each_parts_props():
    block = _object_literal(_js("vocabulary.js"), "VOCABULARY")
    for part, props in LAYOUT_PROPS.items():
        found = re.search(rf"{part}: \{{.*?layoutProps: \[(.*?)\]", block, re.S)
        assert found, f"{part} has no layoutProps in vocabulary.js"
        js_props = re.findall(r"'([^']+)'", found.group(1))
        assert sorted(js_props) == sorted(props), f"{part}'s props disagree"


# -- what the gate accepts and refuses ---------------------------------------

DESKTOP = {"root": {"region": "column", "children": [
    {"part": "transport"},
    {"part": "paneSwitch", "when": {"narrow": True}},
    {"region": "row", "grow": True, "children": [
        {"part": "rooms", "width": 260, "when": {"narrow": False}},
        {"region": "column", "grow": True, "children": [
            {"part": "nowPlaying"},
            {"part": "queue", "grow": True, "scroll": True},
        ]},
        {"part": "browse", "width": 380, "when": {"narrow": False}},
    ]},
]}}


def test_a_real_layout_passes():
    assert validate_layout(DESKTOP) == []


@pytest.mark.parametrize("layout,fragment", [
    ({}, "needs a root node"),
    ({"root": {"region": "grid", "children": [{"part": "rooms"}]}}, 'no such region "grid"'),
    ({"root": {"region": "column", "children": [{"part": "stage"}]}}, 'no such part "stage"'),
    ({"root": {"region": "column", "children": []}}, "needs children"),
    ({"root": {"part": "rooms", "region": "column"}}, "either a region or a part"),
    ({"root": {"part": "rooms", "props": {"color": "red"}}}, 'takes no "color"'),
    ({"root": {"part": "rooms", "when": {"weather": True}}}, 'no such condition "weather"'),
    ({"root": {"part": "rooms", "when": {"narrow": "yes"}}}, "true or false"),
    ({"root": {"part": "rooms", "wobble": 3}}, '"wobble" means nothing'),
    ({"root": {"part": "queue", "children": [{"part": "rooms"}]}}, "holds nothing"),
])
def test_what_the_gate_refuses(layout, fragment):
    problems = validate_layout(layout)
    assert problems, f"{layout} should not have been accepted"
    assert any(fragment in p for p in problems), problems


def test_a_layout_cannot_nest_forever():
    node = {"part": "rooms"}
    for _ in range(40):
        node = {"region": "column", "children": [node]}
    assert any("deeply" in p for p in validate_layout({"root": node}))


# -- the package ------------------------------------------------------------

#: Every theme has to show what it looks like, so every fixture carries one.
#: A real 1x1 WebP, in both the shapes a test needs it: the bytes that go into
#: an archive, and the data URL they become on the way in.
import base64 as _base64

THUMBNAIL_BYTES = _base64.b64decode(
    "UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=")
THUMBNAIL = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA="


def _package(**extra):
    package = {"themeEngine": "1.0", "id": "layout-test", "name": "Layout Test",
               "version": "1", "tokens": {}, "css": "", "layout": DESKTOP,
               "thumbnail": THUMBNAIL}
    package.update(extra)
    return package


def test_a_package_may_carry_a_layout():
    cleaned = themes._clean(_package(layout=DESKTOP))
    assert cleaned["layout"] == DESKTOP


def test_a_package_without_one_is_refused():
    """A layout is the only way a package gets a shape, so it is not optional.

    It used to be able to name a built-in theme and borrow that theme's shell
    instead, which meant an installed theme stopped working the moment the
    theme it had borrowed from was gone.
    """
    bare = _package()
    del bare["layout"]
    with pytest.raises(ThemeError) as raised:
        themes._clean(bare)
    assert "layout of its own" in str(raised.value)


def test_a_broken_layout_is_refused_at_the_gate():
    with pytest.raises(ThemeError) as raised:
        themes._clean(_package(layout={"root": {"part": "stage"}}))
    assert "cannot be drawn" in str(raised.value)


def test_a_theme_for_another_engine_is_refused_by_name():
    """The major number is the compatibility line, so a file written against a
    different one is refused rather than half-drawn, and the refusal says
    which engine this Sonora has."""
    for engine in ("0.9", "2.0", "13.4"):
        with pytest.raises(ThemeError) as raised:
            themes._clean(_package(themeEngine=engine))
        assert themes.ENGINE in str(raised.value)


def test_a_later_minor_of_the_same_engine_is_read():
    """Minor versions add; they do not break. A theme naming one Sonora has
    not heard of still draws, with whatever it declared that Sonora knows."""
    assert themes._clean(_package(themeEngine="1.7"))["themeEngine"] == "1.7"


def test_the_old_field_name_points_at_the_new_one():
    """A file carrying `format` was written against an earlier spelling of
    this field, and the refusal should say so rather than read as nonsense."""
    old = _package()
    old["format"] = old.pop("themeEngine")
    with pytest.raises(ThemeError) as raised:
        themes._clean(old)
    assert "themeEngine" in str(raised.value)


# -- the guide ---------------------------------------------------------------

GUIDE = pathlib.Path(__file__).resolve().parent.parent.parent / "THEMES.md"


def _json_blocks() -> list[dict]:
    """Every fenced JSON example in THEMES.md, parsed.

    A fragment shown without its surrounding braces (the tokens example, the
    variants example) is wrapped so it parses as the object it is part of.
    """
    import json
    out = []
    for block in re.findall(r"```json\n(.*?)```", GUIDE.read_text(encoding="utf-8"), re.S):
        text = block.strip()
        if not text.startswith("{"):
            text = "{" + text.rstrip(",") + "}"
        out.append(json.loads(text))
    return out


def test_the_guides_examples_are_valid_json():
    blocks = _json_blocks()
    assert len(blocks) >= 3, "the guide has lost its examples"


def test_the_guides_layout_example_would_install():
    layouts = [b["layout"] for b in _json_blocks() if "layout" in b]
    assert layouts, "the guide no longer shows a layout"
    for layout in layouts:
        assert validate_layout(layout) == [], "THEMES.md shows a layout Sonora would refuse"


def test_the_guides_starter_theme_would_install():
    """The guide offers its example as a complete theme, so it is packed the
    way the guide says to pack it and put through the real install."""
    import io
    import json as _json
    import zipfile

    text = GUIDE.read_text(encoding="utf-8")
    manifest = next(b for b in _json_blocks() if b.get("id"))
    css = re.search(r"```css\n(.*?)```", text, re.S).group(1)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("theme.json", _json.dumps(manifest))
        archive.writestr("theme.css", css)
        archive.writestr("thumbnail.webp", THUMBNAIL_BYTES)
    theme = themes._clean(themes._unpack(buffer.getvalue()))
    assert theme["id"] == manifest["id"]
    assert theme["css"].strip() == css.strip()
    assert theme["thumbnail"].startswith("data:image/webp;base64,")


def test_the_guide_lists_every_part():
    """A part missing from the guide is a part nobody can use."""
    text = GUIDE.read_text(encoding="utf-8")
    for part in LAYOUT_PARTS:
        assert f"`{part}`" in text, f"THEMES.md does not mention the {part} part"


def test_the_guide_lists_every_condition():
    text = GUIDE.read_text(encoding="utf-8")
    for condition in LAYOUT_CONDITIONS:
        assert f"`{condition}`" in text, f"THEMES.md does not mention the {condition} condition"


def test_a_layout_may_place_settings():
    """Somewhere to change theme from, for a layout that wants one of its own."""
    assert validate_layout({"root": {"region": "row", "children": [
        {"part": "browse", "grow": True},
        {"part": "settings", "width": 300},
    ]}}) == []


def test_the_guide_promises_the_way_out():
    """A layout with no settings part gets one anyway; say so where it is read."""
    text = GUIDE.read_text(encoding="utf-8")
    assert "escapable" in text.lower()


# -- a prop a layout may set has to reach something --------------------------

#: Which component each part name resolves to, mirroring parts/registry.js.
_IMPLEMENTATIONS = {
    "rooms": ("Rooms.jsx", "Rooms"),
    "nowPlaying": ("Center.jsx", "NowPlaying"),
    "queue": ("Center.jsx", "Queue"),
    "browse": ("Browse.jsx", "Browse"),
    "transport": ("Transport.jsx", "Transport"),
    "paneSwitch": ("PaneSwitch.jsx", "PaneSwitch"),
    "settings": ("Settings.jsx", "PartSettings"),
}


def _signature(filename: str, component: str) -> str:
    """The destructured props of a part, as written."""
    source = _js(filename)
    found = re.search(rf"export (?:default )?function {component}\(\{{(.*?)\}}\)",
                      source, re.S)
    assert found, f"{component} is not a component in {filename}"
    return found.group(1)


@pytest.mark.parametrize("part", sorted(LAYOUT_PROPS))
def test_every_advertised_prop_is_read_by_its_part(part):
    """A prop the gate accepts and the part ignores is a promise to a theme
    author that nothing keeps.

    Seven of eleven were exactly that once -- `variant` on five
    parts, plus `groupBy` and `compact` -- accepted by the validator, spread
    onto the component by Arranged, and read by nobody. A layout set one, the
    install succeeded, nothing changed and no error said why.
    """
    filename, component = _IMPLEMENTATIONS[part]
    signature = _signature(filename, component)
    for prop in LAYOUT_PROPS[part]:
        assert re.search(rf"\b{prop}\b", signature), (
            f"{part} advertises \"{prop}\" but {component} in {filename} "
            "does not take it")


def test_the_guide_lists_every_prop_and_no_others():
    """The props table is the one a theme author writes from.

    It once listed seven props that no part read, so it is now
    checked both ways: everything real is in the guide, and nothing in the
    guide is imaginary.
    """
    text = GUIDE.read_text(encoding="utf-8")
    # Found by its own header row, so moving the section does not break this.
    start = text.index("| part | prop | |")
    end = text.index("\n\n", start)
    listed = set(re.findall(r"^\| `\w+` \| `(\w+)` \|", text[start:end], re.M))
    real = {prop for props in LAYOUT_PROPS.values() for prop in props}
    assert listed == real, "THEMES.md and the vocabulary disagree about props"


# -- shells belong to themes, not to Sonora ----------------------------------

def test_sonora_keeps_no_list_of_shells():
    """A shell is the component a theme brought, so there is no registry of
    them to keep.

    Said twice by the user: shells are not part of Sonora core,
    they are a component of each theme, and a theme that reuses another's is
    one theme reaching for another. A `SHELLS` map in the theme registry or a
    `SHELLS` tuple at the gate is that idea leaking back in, so both are
    checked here rather than left to memory.
    """
    registry = (pathlib.Path(__file__).resolve().parent.parent
                / "themes/index.js").read_text(encoding="utf-8")
    assert "SHELLS" not in registry, (
        "themes/index.js is keeping a list of shells again; a "
        "package names the theme whose shell it borrows and shellOf() looks "
        "it up in THEMES")
    assert not hasattr(themes, "SHELLS"), (
        "backend/themes.py is keeping a list of shells again; the gate checks "
        "the shape of the name and the browser resolves it")


def test_a_package_cannot_name_a_shell_at_all():
    """`shell` is gone rather than ignored-and-tolerated: a file that still
    carries one was written against the borrowing format and its author
    should hear so."""
    assert "shell" not in themes._clean(_package())

def test_no_theme_imports_from_another_theme():
    """A theme has to work when it is the only one there.

    Said by the user, twice: shells belong to themes, and a
    theme may copy another's shell but not reach into it. Five skins were
    importing the Windows theme's shell and Liquid Glass Sonofuture's, so
    deleting any of the three broke the others; the Mac theme's folder was
    also holding the shared dialogs and stylesheet that Sonora's own parts
    used, which made it undeletable as well.

    Each theme now carries its own copy. What they may still reach for is
    Sonora's non-visual layer -- lib/, components/, i18n/, assets/ -- because
    that is not a theme and cannot be uninstalled. Not parts/: see the next
    test.
    """
    themes_dir = (pathlib.Path(__file__).resolve().parent.parent
                  / "themes")
    folders = {p.name for p in themes_dir.iterdir() if p.is_dir()}
    offenders = []
    for folder in sorted(folders):
        for path in (themes_dir / folder).rglob("*"):
            if path.suffix not in (".js", ".jsx", ".css"):
                continue
            for line, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                for other in folders - {folder}:
                    if f"'../{other}/" in text or f'"../{other}/' in text:
                        offenders.append(f"{folder}/{path.name}:{line} reaches into {other}")
    assert not offenders, offenders


def test_a_theme_carries_its_whole_shell():
    """No theme draws with Sonora's parts or their stylesheets.

    The user, after it had been said many times: "Every theme
    should be fully self-contained including its shell." Seven desktop skins
    were drawing their room list, center, browse column and transport strip
    from frontend/src/parts/, and loading its desktop sheets, so one edit there
    changed all seven. Each now holds its own copy; parts/ is left to the
    layout renderer an installed package is drawn with.
    """
    themes_dir = (pathlib.Path(__file__).resolve().parent.parent
                  / "themes")
    offenders = []
    for path in sorted(themes_dir.rglob("*")):
        if path.suffix not in (".js", ".jsx", ".css"):
            continue
        for line, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "frontend/src/parts/" in text and ("import" in text or "@import" in text or "from " in text):
                offenders.append(f"{path.relative_to(themes_dir)}:{line}")
    assert not offenders, offenders


def test_a_theme_has_to_show_what_it_looks_like():
    """Sonora cannot draw a still of a theme it is not running, so the chooser
    would offer a blank card and a name. The author takes the screenshot."""
    bare = _package()
    del bare["thumbnail"]
    with pytest.raises(ThemeError) as raised:
        themes._clean(bare)
    assert "thumbnail" in str(raised.value)

    # And the refusal names the file to add, since that is where a screenshot
    # lives -- it is not a field an author fills in.
    assert "thumbnail.webp" in str(raised.value)

    with pytest.raises(ThemeError) as raised:
        themes._clean(_package(thumbnail="https://elsewhere.example/shot.png"))
    assert "picture" in str(raised.value)


def test_a_thumbnail_has_to_be_a_real_picture():
    """The media type is the easy half to fake.

    A thumbnail is required, and the obvious way to satisfy a requirement you
    cannot meet -- which is anything generating a theme rather than taking a
    screenshot of one -- is to invent a plausible data URL.
    `data:image/webp;base64,bm90YXBpY3R1cmU=` installed cleanly and gave the
    chooser a broken card.
    """
    with pytest.raises(ThemeError) as raised:
        themes._clean(_package(thumbnail="data:image/webp;base64,bm90YXBpY3R1cmU="))
    assert "real screenshot" in str(raised.value)

    # And the types a real one may be, each by its own first bytes.
    for url in (THUMBNAIL,
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
                "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="):
        assert themes._clean(_package(thumbnail=url))["thumbnail"] == url
