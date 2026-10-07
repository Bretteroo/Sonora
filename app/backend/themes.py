"""Themes installed at runtime, from an archive, as single files on disk.

A theme is distributed as a zip: ``theme.json`` describing it, ``theme.css``
holding its stylesheet, and a ``thumbnail`` picture showing what it looks
like. It is unpacked on the way in and kept as one JSON document under the
data directory. It carries its own identity, version and
thumbnail, the design tokens the engine publishes as CSS custom properties, and
a stylesheet; and, because Sonora has no shell of its own, its own `layout`:
an arrangement of the parts Sonora publishes, which is what gives it a shape.

**A package stands alone.** The shape comes in the file or it does not come at
all: no theme may be made to lend its own to another, because a theme that
stops working when some other theme is removed is not one you can install.

**A package is data, never code.** No JavaScript is accepted, loaded or run: a
theme can restyle the interface and nothing else.

**A package fetches nothing.** A stylesheet can still reach out: a `url()`,
an `@import` or an `image-set()` loads from wherever it names, and paired
with an attribute selector (`input[value^="a"]`) it reports what is typed into
a field one character at a time, passwords included (found in review). So
the stylesheet and every token may name only `data:` URLs. A picture a theme
wants goes inside it.
"""
from __future__ import annotations

import base64
import json
import logging
import re
import zipfile
from io import BytesIO
from pathlib import Path

from .config import settings

log = logging.getLogger(__name__)

#: Which theme engine a file is written for. A theme declares it as
#: ``themeEngine``; this is the version Sonora has.
#:
#: The major number is the compatibility line: it changes when a theme
#: written against an older one would no longer draw, so a file naming a
#: different major is refused rather than half-drawn. The minor number rises
#: when something is added that older themes do not use, and a file naming
#: any minor of the right major is read.
#: 1.1 added the ``bestArt`` prop on ``nowPlaying``.
ENGINE = "1.1"
ENGINE_MAJOR = 1
ENGINE_VERSION = re.compile(r"^(\d{1,3})\.(\d{1,3})$")
ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")
VERSION = re.compile(r"^\d{1,4}(\.\d{1,4}){0,2}$")
#: A CSS escape: a backslash and up to six hex digits (and the one space that
#: may end them), or a backslash and any other character.
_CSS_ESCAPE = re.compile(r"\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?|\\(.)", re.S)


def _unescaped(text: str) -> str:
    """CSS with its escapes undone and lowercased, as the browser matches
    names. An escaped quote, slash or parenthesis stays inert."""
    def undo(match):
        if match.group(1):
            try:
                char = chr(int(match.group(1), 16))
            except (ValueError, OverflowError):
                char = "\ufffd"
        else:
            char = match.group(2)
        # An escaped quote, slash, star or parenthesis is a character, not
        # the end of a string, a comment or a function, so it must not read
        # as one to the scan below.
        return "_" if char in "'\"\\/*()" else char
    return _CSS_ESCAPE.sub(undo, text).lower()


def reaches_out(text: str) -> bool:
    """Whether CSS would load anything that is not a data: URL.

    Read as a scan rather than a pattern, so a data: URL is skipped whole: an
    SVG inside one names its own ``url(#id)`` and namespaces, and loads
    nothing.
    """
    plain = _unescaped(text)
    i, n = 0, len(plain)
    image_set = 0          # how deep inside image-set( the scan is
    while i < n:
        if plain.startswith("/*", i):
            close = plain.find("*/", i + 2)
            i = n if close < 0 else close + 2
            continue
        if plain.startswith("@import", i):
            return True
        if plain.startswith("url(", i):
            j = i + 4
            while j < n and plain[j] in " \t\r\n\f":
                j += 1
            quote = plain[j] if j < n and plain[j] in "'\"" else ""
            if quote:
                j += 1
            if not plain.startswith("data:", j):
                return True
            close = plain.find(quote, j) if quote else plain.find(")", j)
            i = n if close < 0 else close + 1
            continue
        if plain.startswith("image-set(", i):
            image_set += 1
            i += len("image-set(")
            continue
        char = plain[i]
        if char in "'\"":
            close = plain.find(char, i + 1)
            literal = plain[i + 1:] if close < 0 else plain[i + 1:close]
            if image_set and not literal.strip().startswith("data:"):
                return True
            i = n if close < 0 else close + 1
            continue
        if char == "(" and image_set:
            image_set += 1
        elif char == ")" and image_set:
            image_set -= 1
        i += 1
    return False


_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}")
_CONTENT = re.compile(r"(?:^|;)\s*content\s*:\s*([^;]*)")


def rewords_about(text: str) -> bool:
    """Whether CSS writes words of its own into the About Sonora view.

    A theme designs and lays out About; what it says is Sonora's.
    A rule whose selector reaches the About card and whose
    ``content`` is anything but nothing could put any words there, so it is
    refused. An empty ``content``, the usual way to draw a shape, is fine.
    """
    plain = re.sub(r"/\*.*?\*/", "", _unescaped(text), flags=re.S)
    for selector, body in _RULE.findall(plain):
        if "about" not in selector:
            continue
        for value in _CONTENT.findall(body):
            value = value.replace("!important", "").strip()
            if value not in ("''", '""', "none", "normal", ""):
                return True
    return False


#: Generous for a stylesheet and a screenshot, mean enough to bound a bad file.
MAX_BYTES = 2 * 1024 * 1024
#: And what it may come to once unpacked, so a small archive cannot ask for a
#: large amount of memory.
MAX_UNPACKED = 8 * 1024 * 1024
#: How many members are worth looking at. A theme has three or four.
MAX_MEMBERS = 16

#: The first bytes of the picture types a screenshot may be, so a thumbnail
#: that is not a picture at all is caught here rather than rendering as a
#: broken card. `data:image/webp;base64,bm90YXBpY3R1cmU=` passed before this,
#: and an author who cannot take a screenshot -- anything generating a theme
#: rather than using one -- will reach for exactly that.
SIGNATURES = {
    "image/webp": [b"RIFF"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/avif": [b"\x00\x00\x00"],
}

#: What a theme archive holds. The manifest is the only one that must be
#: there; the stylesheet is optional, and the screenshot is required but may
#: be any of the picture types below.
MANIFEST = "theme.json"
STYLESHEET = "theme.css"
THUMBNAILS = {"": "thumbnail", "light": "thumbnail-light", "dark": "thumbnail-dark"}
PICTURES = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg", ".gif": "image/gif", ".avif": "image/avif"}


# -- layouts -----------------------------------------------------------------
#
# A package's arrangement of Sonora's parts is what gives it a shape. The
# rules are the same ones
# ``frontend/src/parts/arrangement.js`` enforces for the theme's author; they
# are repeated here because this is the gate an installed file passes through,
# and ``tests/test_theme_layout.py`` fails if the two lists ever disagree.

#: Every part a layout may place. Mirrors parts/vocabulary.js.
LAYOUT_PARTS = ("rooms", "nowPlaying", "queue", "browse", "transport",
                "paneSwitch", "settings")
#: How a region lays its children out.
LAYOUT_REGIONS = ("column", "row", "stack")
#: The facts a `when` may test.
LAYOUT_CONDITIONS = ("narrow", "paneRooms", "paneNow", "paneMusic", "roomSelected", "grouped", "queued",
                     "signedIn", "manySystems")
#: What a layout may set on a part, by part.
LAYOUT_PROPS = {
    "rooms": ("plainNames",),
    "nowPlaying": ("bestArt",),
    "queue": ("expanded",),
    "browse": (),
    "transport": ("remainingTime",),
    "paneSwitch": (),
    "settings": ("variant",),
}
#: The type of each of those props, which the gate and the schema both hold
#: a layout to. They had no stated type and the schema took anything (found
#: by the theme-guide test).
LAYOUT_PROP_TYPES = {
    "plainNames": {"type": "boolean"},
    "expanded": {"type": "boolean"},
    "remainingTime": {"type": "boolean"},
    "bestArt": {"type": "boolean"},
    "variant": {"enum": ["panel", "page"]},
}
#: Sizing a layout may ask for, on any node.
LAYOUT_SIZES = ("width", "height", "grow", "scroll")
_LAYOUT_KEYS = ("region", "part", "children", "when", "props", "key")
#: Deep enough for any arrangement, shallow enough to bound a hostile one.
LAYOUT_MAX_DEPTH = 12


def validate_layout(layout) -> list[str]:
    """Every problem with an arrangement, each naming where it is."""
    if not isinstance(layout, dict) or not isinstance(layout.get("root"), dict):
        return ["the layout needs a root node"]
    problems: list[str] = []
    _walk_layout(layout["root"], "root", problems, 0)
    return problems


def _walk_layout(node, path: str, problems: list[str], depth: int) -> None:
    if depth > LAYOUT_MAX_DEPTH:
        problems.append(f"{path}: nested too deeply")
        return
    if not isinstance(node, dict):
        problems.append(f"{path}: not a node")
        return
    is_region = isinstance(node.get("region"), str)
    is_leaf = isinstance(node.get("part"), str)
    if is_region == is_leaf:
        problems.append(f"{path}: a node is either a region or a part, "
                        "not both or neither")
        return

    when = node.get("when")
    if when is not None:
        if not isinstance(when, dict):
            problems.append(f"{path}.when: a condition is an object of name to value")
        else:
            for key, value in when.items():
                if key not in LAYOUT_CONDITIONS:
                    problems.append(f'{path}.when: no such condition "{key}"')
                elif not isinstance(value, bool):
                    problems.append(f"{path}.when.{key}: conditions are true or false")

    for key in node:
        if key in _LAYOUT_KEYS or key in LAYOUT_SIZES:
            continue
        problems.append(f'{path}: "{key}" means nothing here')

    if is_region:
        if node["region"] not in LAYOUT_REGIONS:
            problems.append(f'{path}: no such region "{node["region"]}"')
        children = node.get("children")
        if not isinstance(children, list) or not children:
            problems.append(f"{path}: a region needs children")
            return
        for i, child in enumerate(children):
            _walk_layout(child, f"{path}.children[{i}]", problems, depth + 1)
        return

    if node["part"] not in LAYOUT_PARTS:
        problems.append(f'{path}: no such part "{node["part"]}"')
        return
    if node.get("children"):
        problems.append(f"{path}: a part holds nothing")
    props = node.get("props")
    if props is not None:
        if not isinstance(props, dict):
            problems.append(f"{path}.props: props are an object")
            return
        allowed = LAYOUT_PROPS[node["part"]]
        for key, value in props.items():
            if key not in allowed:
                extra = f" (it takes {', '.join(allowed)})" if allowed else ""
                problems.append(f'{path}.props: "{node["part"]}" takes no "{key}"{extra}')
                continue
            rule = LAYOUT_PROP_TYPES.get(key, {})
            if rule.get("type") == "boolean" and not isinstance(value, bool):
                problems.append(f"{path}.props.{key}: true or false")
            elif "enum" in rule and value not in rule["enum"]:
                problems.append(f"{path}.props.{key}: one of {', '.join(rule['enum'])}")


class ThemeError(ValueError):
    """A package that cannot be installed, with a reason worth showing."""


def directory() -> Path:
    return settings.data_dir / "themes"


def _is_a_picture(url: str) -> bool:
    """Whether a data URL really holds the picture it claims to."""
    head, _, body = url.partition(",")
    media = head[len("data:"):].split(";", 1)[0]
    starts = SIGNATURES.get(media)
    if not starts:
        return False
    try:
        first = base64.b64decode(body[:64] + "==", validate=False)[:16]
    except Exception:
        return False
    return any(first.startswith(start) for start in starts)


def _clean(package: dict) -> dict:
    """Validate a package and return only the fields Sonora will serve."""
    if not isinstance(package, dict):
        raise ThemeError("a theme file holds one JSON object")
    engine = package.get("themeEngine")
    if engine is None and package.get("format") is not None:
        raise ThemeError('a theme declares `themeEngine`, not `format`: '
                         f'"themeEngine": "{ENGINE}". See THEMES.md.')
    declared = ENGINE_VERSION.match(str(engine or ""))
    if not declared:
        raise ThemeError(f'themeEngine must look like "{ENGINE}"')
    if int(declared.group(1)) != ENGINE_MAJOR:
        raise ThemeError(f"this theme is written for theme engine {engine}; "
                         f"this Sonora has {ENGINE}")
    theme_id = str(package.get("id", ""))
    if not ID.match(theme_id):
        raise ThemeError("id must be 3-32 characters of lowercase letters, "
                         "digits and hyphens")
    version = str(package.get("version", ""))
    if not VERSION.match(version):
        raise ThemeError("version must look like 1, 1.2 or 1.2.3")
    # The layout is what gives a package a shape, and there is no other way
    # to get one: Sonora has no shell to lend and no theme may be made to
    # lend its own.
    layout = package.get("layout")
    if layout is None:
        raise ThemeError("a theme needs a layout of its own; see THEMES.md")
    problems = validate_layout(layout)
    if problems:
        raise ThemeError("this layout cannot be drawn: " + "; ".join(problems[:4]))
    tokens = package.get("tokens") or {}
    if not isinstance(tokens, dict) or not all(
            isinstance(k, str) and isinstance(v, (str, int, float))
            for k, v in tokens.items()):
        raise ThemeError("tokens must be a flat object of names to values")
    css = package.get("css", "")
    if not isinstance(css, str):
        raise ThemeError("css must be a string")
    if reaches_out(css):
        raise ThemeError("the stylesheet loads from somewhere else (a url(), "
                         "@import or image-set() naming more than a data: URL); "
                         "a theme carries its pictures and fonts inside it")
    if rewords_about(css):
        raise ThemeError("the stylesheet writes its own words into About Sonora "
                         "(content: on an about- selector); a theme may restyle "
                         "the About view but not change what it says")
    if any(reaches_out(str(v)) for v in tokens.values()):
        raise ThemeError("a token loads from somewhere else; a theme names only "
                         "data: URLs")
    # A theme has to show what it looks like. Sonora does not draw this for
    # an installed theme -- it has no way to, since the theme is not running
    # when the chooser lists it -- so without one the chooser offers a blank
    # card and a name.
    thumbnail = package.get("thumbnail", "")
    if not thumbnail:
        raise ThemeError("a theme needs a screenshot of itself: put "
                         "thumbnail.webp (or .png, .jpg, .gif, .avif) at the "
                         "archive's root")
    if not (isinstance(thumbnail, str) and thumbnail.startswith("data:image/")):
        raise ThemeError("the thumbnail is not a picture Sonora can read")
    if not _is_a_picture(thumbnail):
        raise ThemeError("the thumbnail is not a picture: it has to be a real "
                         "screenshot of the theme, which someone has to take")
    # A theme may offer a light and a dark way up. Each variant is the same
    # shape as the theme itself, less the parts that cannot differ: its own
    # tokens over the base, its own color scheme, and its own still so the
    # chooser can show what the light and dark buttons mean. It used to be
    # dropped on the way in, which left an installed theme unable to
    # declare one at all.
    variants_in = package.get("variants") or {}
    if not isinstance(variants_in, dict):
        raise ThemeError("variants must be an object of light and dark")
    variants: dict[str, dict] = {}
    for key, variant in variants_in.items():
        if key not in ("light", "dark"):
            raise ThemeError("a variant is named light or dark")
        if not isinstance(variant, dict):
            raise ThemeError(f"the {key} variant must be an object")
        vtokens = variant.get("tokens") or {}
        if not isinstance(vtokens, dict) or not all(
                isinstance(k, str) and isinstance(v, (str, int, float))
                for k, v in vtokens.items()):
            raise ThemeError(f"the {key} variant's tokens must be a flat object")
        if any(reaches_out(str(v)) for v in vtokens.values()):
            raise ThemeError(f"a token in the {key} variant loads from somewhere else")
        vscheme = str(variant.get("colorScheme", key))
        if vscheme not in ("light", "dark"):
            raise ThemeError(f"the {key} variant's colorScheme must be light or dark")
        vthumb = variant.get("thumbnail", "")
        if vthumb and not (isinstance(vthumb, str) and vthumb.startswith("data:image/")):
            raise ThemeError(f"the {key} variant's thumbnail must be a data:image/... URL")
        variants[key] = {"tokens": {str(k): str(v) for k, v in vtokens.items()},
                         "colorScheme": vscheme, "thumbnail": vthumb}
    name = str(package.get("name", "")).strip() or theme_id
    scheme = str(package.get("colorScheme", "light dark"))
    if scheme not in ("light", "dark", "light dark"):
        raise ThemeError("colorScheme must be light, dark or 'light dark'")
    return {
        "themeEngine": str(engine),
        "id": theme_id,
        "name": name[:60],
        "version": version,
        "description": str(package.get("description", ""))[:400],
        "colorScheme": scheme,
        "layout": layout,
        "tokens": {str(k): str(v) for k, v in tokens.items()},
        "css": css,
        "thumbnail": thumbnail,
        "variants": variants,
    }


def installed() -> list[dict]:
    """Every installed package, by name. A file that will not parse is skipped
    rather than breaking the list for the rest."""
    out = []
    folder = directory()
    if not folder.is_dir():
        return out
    for path in sorted(folder.glob("*.json")):
        try:
            out.append(_clean(json.loads(path.read_text(encoding="utf-8"))))
        except Exception as exc:
            log.warning("ignoring theme %s: %s", path.name, exc)
    out.sort(key=lambda theme: theme["name"].casefold())
    return out


def _unpack(raw: bytes) -> dict:
    """The package a theme archive describes.

    A theme is distributed as a zip so its stylesheet and its screenshot can
    be the files they are, rather than a stylesheet folded into a JSON string
    and a picture turned into a hundred kilobytes of base64. They are read out
    of the archive here and handed on as though they had been written inline,
    so everything past this point sees one package either way.
    """
    try:
        archive = zipfile.ZipFile(BytesIO(raw))
    except Exception as exc:
        raise ThemeError(f"not a readable theme archive: {exc}") from exc

    # Members are taken by exact name. Nothing is joined onto a path, so a
    # name like ../../etc/passwd simply does not match anything.
    members = {}
    for info in archive.infolist():
        if info.is_dir():
            continue
        if len(members) >= MAX_MEMBERS:
            raise ThemeError("that archive holds more files than a theme needs")
        members[info.filename] = info

    total = sum(info.file_size for info in members.values())
    if total > MAX_UNPACKED:
        raise ThemeError("that archive unpacks to more than a theme should")

    if MANIFEST not in members:
        raise ThemeError(f"a theme archive needs a {MANIFEST} at its root")
    try:
        package = json.loads(archive.read(MANIFEST).decode("utf-8"))
    except Exception as exc:
        raise ThemeError(f"{MANIFEST} is not readable JSON: {exc}") from exc
    if not isinstance(package, dict):
        raise ThemeError(f"{MANIFEST} holds one JSON object")

    if STYLESHEET in members:
        try:
            package["css"] = archive.read(STYLESHEET).decode("utf-8")
        except Exception as exc:
            raise ThemeError(f"{STYLESHEET} is not readable text: {exc}") from exc

    # thumbnail.webp becomes the `thumbnail` field, and the two variant
    # pictures become each variant's own, so the rest of validation is the
    # same whichever way a theme was written.
    for variant, stem in THUMBNAILS.items():
        found = next(((name, ext) for name, ext in
                      ((f"{stem}{ext}", ext) for ext in PICTURES)
                      if name in members), None)
        if not found:
            continue
        name, ext = found
        data = archive.read(name)
        url = f"data:{PICTURES[ext]};base64," + base64.b64encode(data).decode("ascii")
        if not variant:
            package["thumbnail"] = url
        elif isinstance(package.get("variants"), dict) and variant in package["variants"]:
            package["variants"][variant]["thumbnail"] = url
    return package


def install(raw: bytes) -> dict:
    """Validate and store a theme archive, replacing any earlier copy of its id."""
    if len(raw) > MAX_BYTES:
        raise ThemeError("that file is too large to be a theme")
    if not raw[:2] == b"PK":
        raise ThemeError("a theme is a .zip holding theme.json, theme.css and "
                         "a thumbnail; see THEMES.md")
    theme = _clean(_unpack(raw))
    folder = directory()
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{theme['id']}.json").write_text(
        json.dumps(theme, indent=1), encoding="utf-8")
    log.info("installed theme %s %s", theme["id"], theme["version"])
    return theme


def remove(theme_id: str) -> bool:
    """Delete an installed package. Built-ins live in the bundle and are not
    reachable from here, so they cannot be deleted by accident."""
    if not ID.match(theme_id or ""):
        return False
    path = directory() / f"{theme_id}.json"
    if not path.is_file():
        return False
    path.unlink()
    log.info("removed theme %s", theme_id)
    return True


# -- what a theme author can ask for ----------------------------------------
#
# A theme is written against this file's rules by someone who has none of it:
# they have a Sonora, a browser and THEMES.md. So the rules are also published
# in a form a tool can read, generated from the constants above rather than
# written out beside them, because a schema that has to be kept in step by
# hand is a schema that will disagree with the gate.

def reference() -> dict:
    """The class names a stylesheet is written against.

    Generated by ``tests/theme_reference_build.py`` from the parts themselves and
    committed beside this module, so it is the same list however Sonora was
    installed, and ``tests/test_theme_reference.py`` fails when a part renames
    something and it is not regenerated.
    """
    path = Path(__file__).resolve().parent / "theme_reference.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("no theme reference: %s", exc)
        return {"classes": {}, "error": "this Sonora has no class reference"}


def schema() -> dict:
    """A JSON Schema for ``theme.json``, built from what the gate enforces."""
    node = {
        "type": "object",
        "properties": {
            "region": {"enum": list(LAYOUT_REGIONS)},
            "part": {"enum": list(LAYOUT_PARTS)},
            "children": {"type": "array", "minItems": 1,
                         "items": {"$ref": "#/$defs/node"}},
            "key": {"type": "string"},
            "when": {
                "type": "object", "additionalProperties": False,
                "properties": {c: {"type": "boolean"} for c in LAYOUT_CONDITIONS},
            },
            "props": {"type": "object"},
            "width": {"type": ["number", "string"]},
            "height": {"type": ["number", "string"]},
            "grow": {"type": "boolean"},
            "scroll": {"type": "boolean"},
        },
        "additionalProperties": False,
        "oneOf": [
            {"required": ["region", "children"], "not": {"required": ["part"]}},
            {"required": ["part"], "not": {"required": ["region"]}},
        ],
        # A part takes only its own props, so each one gets its own clause.
        "allOf": [
            {"if": {"properties": {"part": {"const": part}}, "required": ["part"]},
             "then": {"properties": {"props": {
                 "type": "object", "additionalProperties": False,
                 "properties": {name: LAYOUT_PROP_TYPES.get(name, {}) for name in props}}}}}
            for part, props in LAYOUT_PROPS.items()
        ],
    }
    variant = {
        "type": "object",
        "properties": {
            "tokens": {"type": "object",
                       "additionalProperties": {"type": ["string", "number"]}},
            "colorScheme": {"enum": ["light", "dark"]},
        },
        "additionalProperties": False,
    }
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": f"Sonora theme.json (theme engine {ENGINE})",
        "description": "The manifest inside a Sonora theme .zip. The "
                       "stylesheet and the screenshot are theme.css and "
                       "thumbnail.webp beside it, not fields here.",
        "type": "object",
        "required": ["themeEngine", "id", "name", "version", "layout"],
        "additionalProperties": False,
        "properties": {
            # Any minor of this major is read, which a const said otherwise
            # (found by the theme-guide test).
            "themeEngine": {"type": "string", "pattern": rf"^{ENGINE_MAJOR}\.\d{{1,3}}$",
                            "description": f"The engine this theme is written "
                                           f"for. Any {ENGINE_MAJOR}.x is read; "
                                           f"this Sonora has {ENGINE}."},
            "id": {"type": "string", "pattern": ID.pattern},
            "name": {"type": "string", "minLength": 1, "maxLength": 60},
            "version": {"type": "string", "pattern": VERSION.pattern},
            "description": {"type": "string", "maxLength": 400},
            "colorScheme": {"enum": ["light", "dark", "light dark"]},
            "layout": {
                "type": "object", "required": ["root"],
                "additionalProperties": False,
                "properties": {"root": {"$ref": "#/$defs/node"}},
            },
            "tokens": {"type": "object",
                       "additionalProperties": {"type": ["string", "number"]}},
            "variants": {
                "type": "object", "additionalProperties": False,
                "properties": {"light": variant, "dark": variant},
            },
        },
        "$defs": {"node": node},
        # Not part of the schema's vocabulary, but the thing an author most
        # needs to know and cannot see from the shape alone.
        "x-sonora-archive": {
            "manifest": MANIFEST,
            "stylesheet": STYLESHEET,
            "thumbnails": {k or "base": f"{v}.webp" for k, v in THUMBNAILS.items()},
            "pictureTypes": sorted(PICTURES),
            "maxBytes": MAX_BYTES,
            "maxDepth": LAYOUT_MAX_DEPTH,
        },
    }
