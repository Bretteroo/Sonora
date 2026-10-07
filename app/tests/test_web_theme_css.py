"""The web theme's stylesheet must keep its load-bearing rules.

A regex cleanup once removed the rule that anchors the profile disc to a
service icon, and nothing failed: the build passed and the disc simply fell
below the icon as plain text. This guards the selectors the theme cannot do
without, so deleting one fails loudly instead of quietly.
"""

import pathlib
import re

CSS = pathlib.Path(__file__).resolve().parent.parent / "themes/web/web.css"

REQUIRED = (
    ".wb-header", ".wb-search-pill", ".wb-nav-btn",
    ".wb-room", ".wb-room[data-active='true']", ".wb-room-art", ".wb-room-play",
    ".wb-room-vol", ".wb-slider-rail", ".wb-slider-fill",
    ".wb-services", ".wb-service", ".wb-service-badge", ".wb-service-profile",
    ".wb-service-page", ".wb-services-page", ".wb-rows", ".wb-row",
    ".wb-transport", ".wb-play", ".wb-progress",
    ".wb-settings", ".wb-settings-head", ".wb-settings-row", ".wb-settings-group",
    ".wb-toggle", ".wb-toggle-knob",
    ".wb-overlay", ".wb-panel", ".wb-toasts",
)


def _selectors(text: str) -> set[str]:
    """Every selector that opens a rule, with comments stripped first.

    The comments matter: a rule directly preceded by a comment otherwise reads
    as ``*/ .wb-x`` and matches nothing, which is how the first version of
    this test reported five present rules as missing.
    """
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    found: set[str] = set()
    for block in re.findall(r"([^{}]+)\{", text):
        for part in block.split(","):
            part = part.strip()
            if part and not part.startswith("@"):
                found.add(part)
    return found


def _has_rule(selectors: set[str], sel: str) -> bool:
    """A required class may appear compounded, e.g. ``.wb-icon-btn.wb-room-play``."""
    # No lookbehind: a class may be glued to another in a compound selector
    # (``.wb-icon-btn.wb-room-play``), and the leading dot already marks the
    # token start. The lookahead keeps ``.wb-room`` from matching ``.wb-room-play``.
    token = re.compile(rf"{re.escape(sel)}(?![\w-])")
    return any(token.search(s) for s in selectors)


def test_required_selectors_present():
    selectors = _selectors(CSS.read_text())
    missing = [sel for sel in REQUIRED if not _has_rule(selectors, sel)]
    assert not missing, f"web.css lost rules for: {missing}"


def test_profile_disc_is_anchored():
    """The disc only works if its parent is positioned."""
    text = CSS.read_text()
    service = re.search(r"\.wb-service \{([^}]*)\}", text)
    assert service and "position: relative" in service.group(1)
    disc = re.search(r"\.wb-service-profile \{([^}]*)\}", text)
    assert disc and "position: absolute" in disc.group(1)
    assert "border-radius: 9999px" in disc.group(1)


def test_the_big_player_keeps_its_room_pill_and_options_at_every_width():
    """The foot under the volume row -- room pill, "..." disc, queue -- is the
    product's at every width, below the fold on a short window. It was hidden
    on wide windows once, on a measurement that never scrolled the card."""
    text = CSS.read_text()
    base = re.search(r"\n\.wb-np-foot\s*\{([^}]*)\}", text)
    assert base and "display: grid" in base.group(1)
    assert not re.search(r"\.wb-np-foot\s*\{[^}]*display:\s*none", text)


def test_the_phone_rules_are_there():
    """What keeps the theme usable on a phone, where the product refuses.

    play.sonos.com answers a phone with "screen size unsupported", so none of
    this is a replica and none of it is measurable against the product: it is
    Sonora's own, and a stray cleanup could take it out without anything else
    failing. Three things have to survive.
    """
    text = CSS.read_text()

    # The cover shrinks to what is left rather than holding 342 and pushing
    # the play button off the bottom of the screen.
    assert "@container (max-width: 560px)" in text
    art = re.search(r"@container \(max-width: 560px\) \{.*?\.wb-np-art \{([^}]*)\}",
                    text, flags=re.S)
    assert art, "the narrow rules lost the cover"
    assert "aspect-ratio: 1" in art.group(1)
    assert "max-height: 342px" in art.group(1)
    assert "min-height" in art.group(1)

    # An album's fixed columns do not fit a phone, so the artist's goes.
    assert ".wb-tracks[data-numbered] .wb-tracks-artist { display: none; }" in text

    # Touch targets are 44px of hit area around controls that paint smaller.
    assert "@media (pointer: coarse)" in text
    coarse = text.split("@media (pointer: coarse)", 1)[1]
    assert "width: max(100%, 44px)" in coarse
    assert "height: max(100%, 44px)" in coarse


# --- theme packages -----------------------------------------------------------

#: A 1x1 WebP, so the picture in a test archive is a real one.
PIXEL = bytes.fromhex(
    "524946461200000057454250565038" "4c06000000" "2f00000000" "07d0fffef7bfff"
    "8188e87f0000")


def _archive(package: dict, *, css: str | None = None,
             thumbnail: bytes | None = PIXEL) -> bytes:
    """A theme the way one is actually distributed: a zip of three files.

    The stylesheet and the picture are files in the archive, so the manifest
    written here drops them; anything a test sets on `css` or `thumbnail`
    inline is moved out to where a real theme would keep it.
    """
    import io
    import json as _json
    import zipfile
    manifest = dict(package)
    css = manifest.pop("css", None) if css is None else css
    inline = manifest.pop("thumbnail", None)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("theme.json", _json.dumps(manifest))
        if css is not None:
            archive.writestr("theme.css", css)
        if thumbnail is not None:
            archive.writestr("thumbnail.webp", thumbnail)
        elif isinstance(inline, str) and inline.startswith("data:"):
            pass  # a test asking for no picture at all
    return buffer.getvalue()

def test_a_theme_package_is_validated_before_it_is_installed(tmp_path, monkeypatch):
    """A package is data: identity, version, tokens, a stylesheet, a layout."""
    import json
    from backend import themes

    # Patch the directory itself rather than the setting it is derived
    # from: a developer with a theme installed was failing these.
    monkeypatch.setattr(themes, "directory", lambda: tmp_path / "themes")
    good = {
        "themeEngine": "1.0", "id": "midnight", "name": "Midnight",
        "version": "1.2.3", "colorScheme": "dark",
        "thumbnail": "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=",
        "layout": {"root": {"region": "column", "children": [
            {"part": "transport"}, {"part": "browse", "grow": True}]}},
        "tokens": {"fg": "#fff", "bg": "#000"},
        "css": ":root[data-theme='midnight'] .dk-root { color: #fff }",
    }
    theme = themes.install(_archive(good))
    assert theme["id"] == "midnight" and theme["version"] == "1.2.3"
    assert [t["id"] for t in themes.installed()] == ["midnight"]
    assert themes.remove("midnight") is True
    assert themes.installed() == []


def test_bad_packages_are_refused_with_a_reason(tmp_path, monkeypatch):
    import json
    import pytest
    from backend import themes

    # Patch the directory itself rather than the setting it is derived
    # from: a developer with a theme installed was failing these.
    monkeypatch.setattr(themes, "directory", lambda: tmp_path / "themes")
    base = {"themeEngine": "1.0", "id": "ok-theme", "name": "Ok",
            "version": "1.0", "tokens": {},
            "layout": {"root": {"region": "column", "children": [
                {"part": "transport"}, {"part": "browse", "grow": True}]}}}
    for field, value in (("themeEngine", "something-else"), ("id", "Nope!"),
                         ("version", "banana"),
                         ("themeEngine", "2.0"),
                         ("layout", {"root": {"part": "stage"}}),
                         ("tokens", ["not", "a", "map"])):
        with pytest.raises(themes.ThemeError):
            themes.install(_archive({**base, field: value}))

    # An archive with no picture in it, which is the shape the requirement
    # actually takes now that the screenshot is a file rather than a field.
    with pytest.raises(themes.ThemeError) as raised:
        themes.install(_archive(base, thumbnail=None))
    assert "thumbnail" in str(raised.value)

    # And things that are wrong about the archive rather than the theme.
    import io
    import zipfile
    with pytest.raises(themes.ThemeError) as raised:
        themes.install(b"{\"themeEngine\": \"1.0\"}")
    assert ".zip" in str(raised.value)

    empty = io.BytesIO()
    with zipfile.ZipFile(empty, "w") as archive:
        archive.writestr("readme.txt", "nothing to see")
    with pytest.raises(themes.ThemeError) as raised:
        themes.install(empty.getvalue())
    assert "theme.json" in str(raised.value)

    # And nothing was written by any of them.
    assert themes.installed() == []


def test_a_theme_id_cannot_escape_the_theme_directory(tmp_path, monkeypatch):
    from backend import themes

    # Patch the directory itself rather than the setting it is derived
    # from: a developer with a theme installed was failing these.
    monkeypatch.setattr(themes, "directory", lambda: tmp_path / "themes")
    assert themes.remove("../../../etc/passwd") is False
    assert themes.remove("..") is False
