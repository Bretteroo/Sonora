"""A theme restyles About Sonora but cannot change what it says."""

from backend.themes import rewords_about


def test_words_written_into_about_are_refused():
    assert rewords_about(".about-note::after { content: 'Made by us'; }")
    assert rewords_about(":root[data-theme='x'] .about-tagline::before{content:attr(title)}")
    assert rewords_about('@media (min-width: 1px) { .about-card h1::after { content: "X" } }')


def test_design_is_allowed():
    assert not rewords_about(".about-card { border-radius: 20px; content: ''; }")
    assert not rewords_about('.about-rule::before { content: ""; display: block; }')
    assert not rewords_about(".dk-tile::after { content: 'x'; }")
    assert not rewords_about(".about-card { background: red } /* content: 'x' */")


def test_every_line_of_about_is_guarded():
    """Each piece of About's text carries data-about-text, which the guard in
    lib/aboutGuard.js keeps visible whatever a stylesheet does."""
    import pathlib, re
    src = (pathlib.Path(__file__).resolve().parent.parent / "frontend/src/components/AboutSonora.jsx").read_text()
    assert "guardAboutText(" in src
    for key in ("about.tagline", "about.pointLocal", "about.pointMore", "about.supportNote", "about.support'",
                "about.trademark", "about.license", "about.github", "about.thirdParty"):
        line = next(l for l in src.splitlines() if key in l)
        assert "data-about-text" in line, f"{key} is not guarded"
