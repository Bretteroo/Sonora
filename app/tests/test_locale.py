"""Locales, not languages.

en-US and en-GB are different catalogs, so are pt-BR and pt-PT, and so are
zh-CN and zh-TW. The tag is BCP 47 and it is the same spelling everywhere: in
the interface's store, in the request's `Accept-Language`, and in the SOAP
call that asks a music service for its own labels.

Asked for: "I'd like you to treat languages as locales, not just
languages... ideally using BCP 47 language tags on the backend to keep them
straight."
"""

from backend.locale import REFERENCE, SUPPORTED, canonical, chain, negotiate


def test_a_tag_is_tidied_rather_than_reinvented():
    assert canonical("zh_hant_tw") == "zh-Hant-TW"
    assert canonical("PT-br") == "pt-BR"
    assert canonical("EN") == "en"
    # Not a tag at all: the caller gets nothing rather than a guess.
    assert canonical("") == ""
    assert canonical("not a tag") == ""
    assert canonical("../etc/passwd") == ""


def test_the_offered_locales_are_all_well_formed():
    for code in SUPPORTED:
        assert canonical(code) == code, code


def test_an_exact_tag_wins():
    assert negotiate("pt-BR") == "pt-BR"
    assert negotiate("de-DE,de;q=0.9") == "de-DE"


def test_quality_values_are_honored():
    # The reader would rather have German, and says so.
    assert negotiate("en-US;q=0.2, de-DE;q=0.9") == "de-DE"
    # q=0 means "not this one".
    assert negotiate("de-DE;q=0, fr-FR;q=0.4") == "fr-FR"


def test_a_language_match_is_better_than_english():
    # No Austrian catalog: German is nearer than English.
    assert negotiate("de-AT") == "de-DE"
    # Portuguese outside Brazil reads the European catalog; bare "no" and
    # Nynorsk read Bokmal.
    assert negotiate("pt-AO") == "pt-PT"
    assert negotiate("pt") == "pt-PT"
    assert negotiate("pt-BR") == "pt-BR"
    assert negotiate("no") == "nb-NO"
    assert negotiate("nn-NO") == "nb-NO"
    assert negotiate("fr-CH, fr;q=0.9") == "fr-FR"
    assert negotiate("ko") == "ko-KR"


def test_chinese_is_never_guessed_across_scripts():
    """Simplified and Traditional are not variants of one another.

    A bare `zh` says nothing about the script, so it is left to the reference
    rather than answered with the wrong one.
    """
    assert negotiate("zh-Hant") == "zh-TW"
    assert negotiate("zh-TW") == "zh-TW"
    assert negotiate("zh-HK") == "zh-TW"
    assert negotiate("zh-Hans") == "zh-CN"
    assert negotiate("zh-CN") == "zh-CN"
    assert negotiate("zh-SG") == "zh-CN"
    assert negotiate("zh") == REFERENCE


def test_nothing_recognizable_falls_back():
    assert negotiate("") == REFERENCE
    assert negotiate("*") == REFERENCE
    assert negotiate("is-IS, fo-FO") == REFERENCE


def test_a_locale_reads_its_nearest_relative_before_english():
    assert chain("pt-BR") == ("pt-BR", "pt-PT", "en-US")
    assert chain("fr-FR") == ("fr-FR", "en-US")
    assert chain("en-US") == ("en-US",)


def test_the_interface_and_the_backend_offer_the_same_locales():
    """One list, not two: the registry the chooser reads and the set the
    backend negotiates against have to agree, or a reader picks a locale the
    services are never asked for."""
    import pathlib
    import re
    text = (pathlib.Path(__file__).resolve().parent.parent
            / "frontend/src/i18n/locales.js").read_text(encoding="utf-8")
    tags = re.findall(r"\{ tag: '([^']+)'", text)
    assert tuple(sorted(tags)) == tuple(sorted(SUPPORTED)), (
        f"locales.js has {sorted(tags)}, backend/locale.py has {sorted(SUPPORTED)}")
