"""Sonora keeps its data in ~/.config/sonora, and brings an old folder along.

The default used to be ~/.local/share/sonora. A copy that has
data there has it moved on first start, so no sign-in is lost.
"""

import importlib
from pathlib import Path

import backend.config as config


def _resolve(monkeypatch, home: Path, env=None):
    monkeypatch.setattr(config, "_OLD_DATA_DIR", home / ".local" / "share" / "sonora")
    monkeypatch.setattr(config, "_DATA_DIR", home / ".config" / "sonora")
    if env is None:
        monkeypatch.delenv("SONORA_DATA_DIR", raising=False)
    else:
        monkeypatch.setenv("SONORA_DATA_DIR", env)
    return config._data_dir()


def test_a_new_install_uses_config(tmp_path, monkeypatch):
    assert _resolve(monkeypatch, tmp_path) == tmp_path / ".config" / "sonora"


def test_an_old_folder_is_moved_with_everything_in_it(tmp_path, monkeypatch):
    old = tmp_path / ".local" / "share" / "sonora"
    old.mkdir(parents=True)
    (old / "service_tokens.json").write_text("{}")
    found = _resolve(monkeypatch, tmp_path)
    assert found == tmp_path / ".config" / "sonora"
    assert (found / "service_tokens.json").read_text() == "{}"
    assert not old.exists()


def test_an_old_folder_moves_into_a_new_one_holding_only_a_cache(tmp_path, monkeypatch):
    old = tmp_path / ".local" / "share" / "sonora"
    (old / "logocache").mkdir(parents=True)
    (old / "logocache" / "old.png").write_text("x")
    (old / "service_tokens.json").write_text("{}")
    new = tmp_path / ".config" / "sonora"
    (new / "logocache").mkdir(parents=True)
    (new / "logocache" / "mslogo.xml").write_text("y")
    assert _resolve(monkeypatch, tmp_path) == new
    assert (new / "service_tokens.json").read_text() == "{}"
    assert (new / "logocache" / "old.png").exists()
    assert not old.exists()


def test_a_new_folder_with_data_is_left_as_it_is(tmp_path, monkeypatch):
    old = tmp_path / ".local" / "share" / "sonora"
    old.mkdir(parents=True)
    (old / "recent.json").write_text("old")
    new = tmp_path / ".config" / "sonora"
    new.mkdir(parents=True)
    (new / "recent.json").write_text("new")
    assert _resolve(monkeypatch, tmp_path) == new
    assert (new / "recent.json").read_text() == "new"
    assert (old / "recent.json").read_text() == "old"


def test_the_setting_wins(tmp_path, monkeypatch):
    assert _resolve(monkeypatch, tmp_path, env=str(tmp_path / "elsewhere")) == tmp_path / "elsewhere"
