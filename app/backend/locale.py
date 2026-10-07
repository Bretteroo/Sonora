"""The reader's locale, as a BCP 47 language tag.

A music service answers in whatever language it is asked for. Its presentation
map carries one strings table per language, `getExtendedMetadata` returns the
message a rating button shows in that language, and SMAPI takes the language
from the `Accept-Language` header of the SOAP call. Sonora asked every service
for `en-US` no matter who was reading, so a Spanish reader browsing Deezer got
English section headings inside a Spanish interface.

The tag the browser sends with its request is the one passed on. It is
canonicalised first -- `pt_br` and `PT-BR` and `pt-BR` are one locale, and the
subtag casing is what tells a script (`Hant`) from a region (`TW`) apart when
reading a tag by eye.

The tag is kept in a context variable rather than threaded through forty call
sites: it belongs to the request the way the request's own headers do, and a
ContextVar is per-task, so two readers browsing at once do not see each
other's.
"""
from __future__ import annotations

import re
from contextvars import ContextVar

#: What the interface ships catalogs for. Sonora asks a service for a locale
#: it can read; a service that has no Portuguese answers in its own default,
#: which is its business and not something to guess around.
SUPPORTED = (
    "en-US", "cs-CZ", "da-DK", "de-DE", "es-ES", "fr-FR", "it-IT", "hu-HU",
    "nl-NL", "nb-NO", "pl-PL", "pt-BR", "pt-PT", "fi-FI", "sv-SE", "uk-UA",
    "ja-JP", "ko-KR", "zh-CN", "zh-TW",
)

#: The one that is always complete.
REFERENCE = "en-US"

#: Where a locale looks when it has no answer of its own, before the
#: reference. Brazilian Portuguese reads European Portuguese before English;
#: nothing else here has a nearer relative than English.
FALLBACKS = {"pt-BR": ("pt-PT",)}

_TAG = re.compile(r"^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$")

_current: ContextVar[str] = ContextVar("locale", default=REFERENCE)


def canonical(tag: str) -> str:
    """A tag in its conventional shape, or "" if it is not a tag at all.

    ``zh-hant-tw`` -> ``zh-Hant-TW``: language lowercase, a four-letter script
    subtag in title case, a two- or three-character region upper case. This is
    presentation only -- tags compare case-insensitively -- but it is what
    makes a log line or a cache key readable.
    """
    raw = (tag or "").strip().replace("_", "-")
    if not raw or not _TAG.match(raw):
        return ""
    parts = raw.split("-")
    out = [parts[0].lower()]
    for part in parts[1:]:
        if len(part) == 4 and part.isalpha():
            out.append(part.title())
        elif len(part) in (2, 3):
            out.append(part.upper())
        else:
            out.append(part.lower())
    return "-".join(out)


def negotiate(header: str) -> str:
    """The best supported locale for an ``Accept-Language`` header.

    Quality values are honored, an exact tag beats a language match, and a
    language match never crosses a script: ``zh`` on its own says nothing
    about Simplified or Traditional, so it is left to the reference rather
    than guessed. ``*`` means "anything", which is the reference.
    """
    ranked: list[tuple[float, str]] = []
    for piece in (header or "").split(","):
        piece = piece.strip()
        if not piece:
            continue
        tag, _, params = piece.partition(";")
        weight = 1.0
        for param in params.split(";"):
            name, _, value = param.partition("=")
            if name.strip() == "q":
                try:
                    weight = float(value)
                except ValueError:
                    weight = 0.0
        tag = canonical(tag.strip())
        if tag and weight > 0:
            ranked.append((weight, tag))
    ranked.sort(key=lambda pair: -pair[0])

    lowered = {code.lower(): code for code in SUPPORTED}
    for _, tag in ranked:
        if tag.lower() in lowered:
            return lowered[tag.lower()]
    for _, tag in ranked:
        parts = tag.split("-")
        language = parts[0].lower()
        # Norwegian is also sent as the macrolanguage "no", and Nynorsk
        # ("nn") reads Bokmal more easily than English.
        if language in ("no", "nn"):
            language = "nb"
        # Portuguese outside Brazil follows the European norm (Portugal,
        # Angola, Mozambique ...); Brazil has its own catalog.
        if language == "pt":
            return "pt-BR" if "br" in {p.lower() for p in parts[1:]} else "pt-PT"
        if language == "zh":
            rest = {p.lower() for p in parts[1:]}
            if rest & {"hant", "tw", "hk", "mo"}:
                return "zh-TW"
            if rest & {"hans", "cn", "sg"}:
                return "zh-CN"
            continue
        for code in SUPPORTED:
            if code.split("-")[0].lower() == language:
                return code
    return REFERENCE


def chain(tag: str) -> tuple[str, ...]:
    """A locale and what it reads when it has no answer, ending at the
    reference."""
    code = canonical(tag) or REFERENCE
    steps = [code, *FALLBACKS.get(code, ())]
    if REFERENCE not in steps:
        steps.append(REFERENCE)
    return tuple(steps)


def current() -> str:
    """The locale of the request being served."""
    return _current.get()


def use(tag: str):
    """Serve the rest of this task in ``tag``. Returns the token to reset
    with, which the middleware does when the request is done."""
    return _current.set(canonical(tag) or REFERENCE)


def reset(token) -> None:
    _current.reset(token)
