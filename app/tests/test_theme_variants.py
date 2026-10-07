"""An installed theme may offer a light and a dark way up.

The package format always described variants, but the validator dropped the
field on the way in, so a theme installed from a file could never declare one
(found by the security review of the theme loader, and wanted by
the chooser's light and dark buttons).
"""

import pytest

from backend.themes import ENGINE, ThemeError, _clean

#: Every package carries a layout of its own -- it is what gives it a shape,
#: now that a theme may not borrow another theme's shell.
LAYOUT = {"root": {"region": "column", "children": [
    {"part": "transport"},
    {"part": "browse", "grow": True},
]}}

BASE = {"themeEngine": ENGINE, "id": "demo", "version": "1.0", "layout": LAYOUT,
        "thumbnail": "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=",
        "tokens": {"bg": "#000000"}}


def test_a_theme_without_variants_says_so_plainly():
    assert _clean(dict(BASE))["variants"] == {}


def test_both_ways_up_survive_installation():
    out = _clean({**BASE, "variants": {
        "light": {"tokens": {"bg": "#ffffff"}, "colorScheme": "light",
                  "thumbnail": "data:image/webp;base64,AA"},
        "dark": {"tokens": {}, "colorScheme": "dark"},
    }})
    assert sorted(out["variants"]) == ["dark", "light"]
    assert out["variants"]["light"]["tokens"] == {"bg": "#ffffff"}
    assert out["variants"]["light"]["thumbnail"].startswith("data:image/")
    # A variant that names no scheme takes its own name.
    assert out["variants"]["dark"]["colorScheme"] == "dark"


@pytest.mark.parametrize("variants", [
    {"sepia": {"tokens": {}}},                      # only light and dark exist
    {"light": {"colorScheme": "blue"}},             # not a scheme
    {"light": {"tokens": {"bg": ["#fff"]}}},        # tokens are flat
    {"light": {"thumbnail": "https://example/x"}},  # a still is data, not a fetch
    "dark",                                          # not an object at all
])
def test_a_malformed_variant_is_refused(variants):
    with pytest.raises(ThemeError):
        _clean({**BASE, "variants": variants})
