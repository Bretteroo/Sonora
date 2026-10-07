"""A theme's words live in the theme, and nowhere else.

Sonora's catalog under ``frontend/src/i18n`` is what the shared components and
the shared browse parts render, in every theme. Anything only one theme says
belongs to that theme, in its own ``strings.js``, which the i18n layer lays
over the core catalog while that theme is the chosen one.

Reported by the user, looking at ``en.js``: "I see many strings
that are specific to individual themes. Specifically, Outrun and Sedona...
all themes should be entirely self-contained, so this content that exists
outside of the theme's directory is not acceptable." Sonofuture's ninety
strings and the troubleshooting page's sixteen were in there too, and
Sonofuture, Liquid Glass and the web theme were reading keys that belonged to
other themes' namespaces.
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend/src"
THEMES = ROOT / "themes"

ENTRY = re.compile(r"^  '([^']+)':", re.M)
#: A key as it is written at a use site: 't(' or a bare quoted key.
USED = re.compile(r"""['"]([a-z][a-z0-9]*(?:\.[A-Za-z0-9_]+)+)['"]""")
#: A key built at runtime -- `sf.settings.${id}` -- which names a namespace
#: but not a key, so only its namespace can be checked.
BUILT = re.compile(r"""`([a-z][a-z0-9]*)\.[A-Za-z0-9_.]*\$\{""")


def _keys(text: str) -> set[str]:
    """Every key declared, plus the base of each counted pair.

    ``t.plural('common.rooms', n)`` looks up ``common.rooms.one`` or
    ``.other``; the base is what the call site names, so it counts as
    declared.
    """
    found = {m.group(1) for m in ENTRY.finditer(text)}
    return found | {k.rsplit(".", 1)[0] for k in found
                    if k.rsplit(".", 1)[-1] in ("one", "other")}


def _core() -> set[str]:
    return _keys((SRC / "i18n/en-US.js").read_text(encoding="utf-8"))


#: `export default { 'en-US': enUS, ... }` -- which block answers for a tag.
EXPORTED = re.compile(r"'([A-Za-z-]+)':\s*(\w+)")
REFERENCE = "en-US"


def _theme_own(theme: pathlib.Path) -> set[str]:
    """The keys a theme carries, read off its reference block.

    Every block holds the same keys -- the parity test is what says so -- so
    the reference one is enough to answer "can this theme reach that key".
    """
    path = theme / "strings.js"
    if not path.exists():
        return set()
    text = path.read_text(encoding="utf-8")
    exported = text.rsplit("export default", 1)[-1]
    const = dict(EXPORTED.findall(exported)).get(REFERENCE)
    if not const:
        return set()
    block = re.search(rf"^const {const} = \{{$(.*?)^\}}$", text, re.M | re.S)
    return _keys(block.group(1)) if block else set()


def _theme_dirs() -> list[pathlib.Path]:
    return sorted(p for p in THEMES.iterdir() if p.is_dir())


def _uses(path: pathlib.Path) -> set[str]:
    """Every key a file names outright. Files are read whole, including the
    comments, which is deliberate: a key named in a comment that no longer
    exists is worth catching too."""
    return {m.group(1) for m in USED.finditer(path.read_text(encoding="utf-8"))}


def test_every_key_a_theme_names_is_one_it_can_reach():
    """Core, or its own -- never another theme's.

    Only the chosen theme's strings are merged, so a key from a theme that is
    not running resolves to nothing and the interface prints the key itself.
    """
    core = _core()
    offenders = []
    for theme in _theme_dirs():
        mine = core | _theme_own(theme)
        for path in theme.rglob("*.js*"):
            if path.name == "strings.js":
                continue
            for key in _uses(path) - mine:
                # "episode.podcast" is a semanticType the speakers report, not a key.
                if key.split(".")[0] in {"sonora", "api", "window", "document", "episode"}:
                    continue
                offenders.append(f"{path.relative_to(ROOT)}: {key}")
    assert not offenders, offenders


def test_a_namespace_built_at_runtime_belongs_to_the_theme_or_to_core():
    """`sf.settings.${id}` cannot be checked key by key, so the namespace is.

    A namespace that lives only in another theme's file would resolve to
    nothing here however the key ends up spelled.
    """
    core_spaces = {k.split(".")[0] for k in _core()}
    offenders = []
    for theme in _theme_dirs():
        spaces = core_spaces | {k.split(".")[0] for k in _theme_own(theme)}
        for path in theme.rglob("*.js*"):
            if path.name == "strings.js":
                continue
            text = path.read_text(encoding="utf-8")
            for space in {m.group(1) for m in BUILT.finditer(text)}:
                if space not in spaces:
                    offenders.append(f"{path.relative_to(ROOT)}: {space}.*")
    assert not offenders, offenders


def test_the_core_catalog_holds_nothing_only_one_theme_says():
    """The thing the user asked for, kept honest.

    A key whose only reader is inside a single theme's folder is that theme's
    to carry. Keys that shared code renders, or that several themes render,
    stay where they are.
    """
    core = _core()
    shared_dirs = [SRC / "components", SRC / "parts", SRC / "lib", SRC / "App.jsx",
                   SRC / "main.jsx"]
    shared_text = ""
    for place in shared_dirs:
        paths = place.rglob("*.js*") if place.is_dir() else [place]
        for path in paths:
            shared_text += path.read_text(encoding="utf-8")
    shared_spaces = {m.group(1) for m in BUILT.finditer(shared_text)}
    shared_keys = {m.group(1) for m in USED.finditer(shared_text)}

    readers: dict[str, set[str]] = {}
    built_by: dict[str, set[str]] = {}
    for theme in _theme_dirs():
        for path in theme.rglob("*.js*"):
            if path.name == "strings.js":
                continue
            text = path.read_text(encoding="utf-8")
            for key in {m.group(1) for m in USED.finditer(text)}:
                readers.setdefault(key, set()).add(theme.name)
            for space in {m.group(1) for m in BUILT.finditer(text)}:
                built_by.setdefault(space, set()).add(theme.name)

    offenders = []
    for key in sorted(core):
        space = key.split(".")[0]
        if key in shared_keys or space in shared_spaces:
            continue
        who = readers.get(key, set()) | built_by.get(space, set())
        if len(who) == 1:
            offenders.append(f"{key}: only {next(iter(who))} says it")
    assert not offenders, offenders


def test_a_theme_that_carries_words_declares_them():
    """A strings.js nobody imports is a file that does nothing."""
    for theme in _theme_dirs():
        if not (theme / "strings.js").exists():
            continue
        manifest = (theme / "index.jsx").read_text(encoding="utf-8")
        assert "from './strings.js'" in manifest and "\n  strings," in manifest, (
            f"{theme.name}: strings.js is not declared in the manifest")
