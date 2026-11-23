"""A theme's own settings, kept on the machine and not in one browser."""

import json

import pytest

from backend import themes
from backend.config import settings


@pytest.fixture(autouse=True)
def _folder(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)


def test_a_theme_keeps_what_it_is_given_and_reads_it_back():
    assert themes.kept("karaoke") == {}
    assert themes.keep("karaoke", {"videos": "a\nb"}) == {"videos": "a\nb"}
    assert themes.kept("karaoke") == {"videos": "a\nb"}


def test_changes_lie_over_what_is_kept_and_none_drops_a_name():
    themes.keep("karaoke", {"videos": "a", "loud": True})
    assert themes.keep("karaoke", {"videos": ""}) == {"videos": "", "loud": True}
    assert themes.keep("karaoke", {"loud": None}) == {"videos": ""}


def test_one_theme_does_not_see_another_themes_settings():
    themes.keep("karaoke", {"videos": "a"})
    themes.keep("other-theme", {"videos": "b"})
    assert themes.kept("karaoke") == {"videos": "a"}
    assert themes.kept("other-theme") == {"videos": "b"}


def test_a_theme_that_drops_everything_leaves_the_file():
    themes.keep("karaoke", {"videos": "a"})
    themes.keep("karaoke", {"videos": None})
    assert json.loads((settings.data_dir / "theme-settings.json").read_text()) == {}


@pytest.mark.parametrize("theme_id", ["", "..", "../x", "A", "a/b"])
def test_only_a_theme_id_names_a_theme(theme_id):
    with pytest.raises(themes.ThemeError):
        themes.kept(theme_id)
    with pytest.raises(themes.ThemeError):
        themes.keep(theme_id, {"videos": "a"})


@pytest.mark.parametrize("changes", [
    [], {"": "a"}, {"1a": "a"}, {"a-b": "a"}, {"a": {}}, {"a": []},
    {"a": "x" * (themes.KEPT_BYTES + 1)},
    {f"n{i}": 1 for i in range(themes.KEPT_NAMES + 1)},
])
def test_what_cannot_be_kept_is_refused_and_nothing_is_written(changes):
    with pytest.raises(themes.ThemeError):
        themes.keep("karaoke", changes)
    assert themes.kept("karaoke") == {}


def test_a_file_that_is_not_settings_reads_as_nothing():
    (settings.data_dir / "theme-settings.json").write_text("[1, 2")
    assert themes.kept("karaoke") == {}
    assert themes.keep("karaoke", {"videos": "a"}) == {"videos": "a"}
