"""Every language carries every key, with the same placeholders.

The three files drift apart silently: a key added to English alone falls
back to English at runtime and nothing fails, which is how fifteen strings
(the room card menu, the playlist toasts, recent searches) sat untranslated
for a while. A placeholder that differs is worse than a missing key:
``{title}`` spelt ``{titulo}`` reaches the reader verbatim, braces and all.

docs/i18n.md documents the same check as a node one-liner for someone adding
a language; this is the one that runs in CI.
"""

import pathlib
import re

I18N = pathlib.Path(__file__).resolve().parent.parent / "frontend/src/i18n"
#: Locales, not languages: the catalogs are named for BCP 47 tags, and the
#: reference one is the only catalog guaranteed complete. Which catalogs
#: exist is read off the directory rather than listed here, so a locale added
#: to the interface is checked from the moment its file lands.
BASE = "en-US"
SKIP = {"index.jsx", "locales.js"}
OTHERS = tuple(sorted(
    path.stem for path in I18N.glob("*.js")
    if path.name not in SKIP and path.stem != BASE))

#: A line that opens an entry. Values may run over several lines -- string
#: concatenation, or a long value that begins on the line below its key -- so
#: an entry owns every line up to the next one. Continuations are indented
#: four spaces, which is why two is enough to tell an entry from its own body.
ENTRY = re.compile(r"^  '([^']+)':", re.M)


def _entries(lang: str) -> dict[str, str]:
    text = (I18N / f"{lang}.js").read_text(encoding="utf-8")
    starts = [(m.group(1), m.start()) for m in ENTRY.finditer(text)]
    out: dict[str, str] = {}
    for i, (key, start) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(text)
        out[key] = text[start:end]
    return out


def _placeholders(value: str) -> set[str]:
    return set(re.findall(r"\{(\w+)\}", value))


def test_the_base_language_has_entries():
    # A parse that silently found nothing would pass every test below. The
    # count fell by 220 when the strings only one theme says
    # moved into that theme's own file.
    assert len(_entries(BASE)) > 800


def test_every_language_carries_every_key():
    base = _entries(BASE)
    for lang in OTHERS:
        other = _entries(lang)
        assert sorted(base) == sorted(other), (
            f"{lang}.js: missing {sorted(set(base) - set(other))}, "
            f"extra {sorted(set(other) - set(base))}"
        )


def test_placeholders_survive_translation():
    base = _entries(BASE)
    for lang in OTHERS:
        other = _entries(lang)
        for key, value in base.items():
            assert _placeholders(value) == _placeholders(other[key]), (
                f"{lang}.js {key}: {sorted(_placeholders(other[key]))} "
                f"for {sorted(_placeholders(value))}"
            )


# -- a theme's own catalog -----------------------------------------------------
#
# A theme carries its own words in ``themes/<id>/strings.js``: three blocks in
# one file, keyed identically, laid over the core catalog while that theme is
# the chosen one. They drift apart exactly as the three core files do, so the
# same two checks run over them.

THEMES = pathlib.Path(__file__).resolve().parent.parent / "themes"
BLOCK = re.compile(r"^const (\w+) = \{$(.*?)^\}$", re.M | re.S)
#: `export default { 'en-US': enUS, ... }` -- the tag each block answers for.
EXPORTED = re.compile(r"'([A-Za-z-]+)':\s*(\w+)")


def _theme_catalogs() -> dict[str, dict[str, dict[str, str]]]:
    out: dict[str, dict[str, dict[str, str]]] = {}
    for path in sorted(THEMES.glob("*/strings.js")):
        text = path.read_text(encoding="utf-8")
        exported = text.rsplit("export default", 1)[-1]
        tag_of = {const: tag for tag, const in EXPORTED.findall(exported)}
        langs: dict[str, dict[str, str]] = {}
        for const, body in BLOCK.findall(text):
            starts = [(m.group(1), m.start()) for m in ENTRY.finditer(body)]
            entries = {}
            for i, (key, start) in enumerate(starts):
                end = starts[i + 1][1] if i + 1 < len(starts) else len(body)
                entries[key] = body[start:end]
            langs[tag_of.get(const, const)] = entries
        out[path.parent.name] = langs
    return out


def test_the_themes_that_carry_words_were_found():
    catalogs = _theme_catalogs()
    assert catalogs, "no theme strings.js parsed; the block shape changed"
    for theme, langs in catalogs.items():
        assert sorted(langs) == sorted((BASE, *OTHERS)), f"{theme}: {sorted(langs)}"
        assert langs[BASE], f"{theme}: no reference entries parsed"


def test_a_themes_languages_carry_the_same_keys():
    for theme, langs in _theme_catalogs().items():
        base = langs[BASE]
        for lang in OTHERS:
            assert sorted(base) == sorted(langs[lang]), (
                f"{theme}/strings.js {lang}: missing "
                f"{sorted(set(base) - set(langs[lang]))}, extra "
                f"{sorted(set(langs[lang]) - set(base))}"
            )


def test_a_themes_placeholders_survive_translation():
    for theme, langs in _theme_catalogs().items():
        base = langs[BASE]
        for lang in OTHERS:
            for key, value in base.items():
                assert _placeholders(value) == _placeholders(langs[lang][key]), (
                    f"{theme}/strings.js {lang} {key}: "
                    f"{sorted(_placeholders(langs[lang][key]))} "
                    f"for {sorted(_placeholders(value))}"
                )


def test_no_catalog_names_a_key_twice():
    """A key written twice is not an error to JavaScript: the later entry
    quietly wins. The About rewording left the old About strings
    below the new ones in thirteen catalogs, and those languages went on
    showing the old tagline with every test passing."""
    for lang in (BASE, *OTHERS):
        text = (I18N / f"{lang}.js").read_text(encoding="utf-8")
        keys = ENTRY.findall(text)
        twice = sorted({k for k in keys if keys.count(k) > 1})
        assert not twice, f"{lang}.js names these keys more than once: {twice}"


def test_no_theme_rewords_the_about_view():
    """A theme designs and lays out About Sonora; the words are Sonora's.
    The i18n layer drops a theme's about.* strings, and
    no built-in theme carries any."""
    themes = pathlib.Path(__file__).resolve().parent.parent / "themes"
    for strings in themes.glob("*/strings.js"):
        text = strings.read_text(encoding="utf-8")
        assert not re.search(r"^\s*'about\.", text, re.M), f"{strings.parent.name} rewords About"
    index = (I18N / "index.jsx").read_text(encoding="utf-8")
    assert "PROTECTED_PREFIXES = ['about.']" in index
