"""Each built-in theme's description reads the same in the theme chooser (its
manifest) and in the README. The website keeps a third copy, outside this
repository, which has to be brought into line by hand. A hidden theme keeps
its description to the chooser and stays out of the README.
"""

from __future__ import annotations

import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
README = (ROOT.parent / "README.md").read_text()
DESCRIPTION = re.compile(r"""^  description: ('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"),$""", re.M)


def manifests():
    for index in sorted((ROOT / "themes").glob("*/index.jsx")):
        src = index.read_text()
        found = DESCRIPTION.search(src)
        assert found, f"{index.parent.name}: description must be one string literal on one line"
        text = found.group(1)[1:-1].replace("\\'", "'").replace('\\"', '"')
        yield index.parent.name, text, re.search(r"^  hidden: true,", src, re.M) is not None


def readme_blurbs():
    blocks = re.findall(r"<summary><b>.*?</b></summary>\n<br>\n(.*?)\n", README)
    return {html.unescape(re.sub(r"<[^>]+>", "", b)) for b in blocks}


def test_every_shown_theme_has_its_description_in_the_readme():
    blurbs = readme_blurbs()
    missing = [name for name, text, hidden in manifests() if not hidden and text not in blurbs]
    assert not missing, f"README description differs from the manifest for: {missing}"


def test_a_hidden_theme_stays_out_of_the_readme():
    for name, text, hidden in manifests():
        if hidden:
            assert text not in README, name
