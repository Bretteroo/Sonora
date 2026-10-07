"""Each product's render comes from Sonos once and is kept on disk.

View System Details draws every product from play.sonos.com's own set of
renders (2026-09-24). Sonora keeps the list of their names, picks one by the
player's model number and color, and fetches a picture only the first time
it is shown: a second request, a restart, or eight Play:1s at once cost
nothing more.
"""

import asyncio
import re
from pathlib import Path

from backend import main
from backend.sonos import products
from backend.sonos.product_colors import FINISHES
from backend.sonos.product_pictures import PICTURES
from backend.sonos.products import (ColorChoices, ProductPictures, color_name,
                                    colors_for, picture_for)

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 32


def test_a_model_is_found_under_every_number_its_picture_names():
    beam = picture_for("S31", "Black")
    assert beam == PICTURES["S31-S32_black"]
    assert picture_for("S32", "Black") == beam
    assert picture_for("S12", "White") == PICTURES["S1-S12_white"]


def test_a_player_that_names_no_color_is_drawn_in_black_then_white():
    assert picture_for("S1", "") == PICTURES["S1-S12_black"]
    # The Connect:Amp was only made in white.
    assert picture_for("ZP120", "") == PICTURES["ZP120_white"]


def test_a_color_the_list_lacks_falls_back_rather_than_failing():
    assert picture_for("S45", "Chartreuse") == PICTURES["S45_black"]


def test_a_model_with_no_render_has_no_picture():
    assert picture_for("ZP80", "Black") is None
    assert picture_for("", "") is None


class _Response:
    def __init__(self, status, body):
        self.status, self._body = status, body

    async def read(self):
        return self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session:
    def __init__(self, status=200, body=PNG):
        self.status, self.body, self.asked = status, body, []

    def get(self, url, **kwargs):
        self.asked.append(url)
        return _Response(self.status, self.body)


def test_a_picture_is_fetched_once_and_read_from_disk_after(tmp_path: Path):
    name = PICTURES["S1-S12_black"]
    session = _Session()

    async def go():
        first = ProductPictures(session, tmp_path)
        together = await asyncio.gather(*(first.picture(name) for _ in range(4)))
        # A new store, as after a restart, reads what the first one kept.
        again = await ProductPictures(session, tmp_path).picture(name)
        return together, again

    together, again = asyncio.run(go())
    assert together == [PNG] * 4
    assert again == PNG
    assert session.asked == [products.MEDIA + name]
    assert (tmp_path / "products" / name).read_bytes() == PNG


def test_a_name_not_in_the_list_is_never_fetched(tmp_path: Path):
    session = _Session()
    store = ProductPictures(session, tmp_path)
    assert asyncio.run(store.picture("../../etc/passwd")) is None
    assert session.asked == []


def test_a_failed_fetch_is_not_retried_at_once_and_nothing_is_kept(tmp_path: Path):
    name = PICTURES["S36_black"]
    session = _Session(status=503)

    async def go():
        store = ProductPictures(session, tmp_path)
        return await store.picture(name), await store.picture(name)

    assert asyncio.run(go()) == (None, None)
    assert len(session.asked) == 1
    assert not (tmp_path / "products" / name).exists()


def test_an_answer_that_is_not_a_png_is_not_kept(tmp_path: Path):
    name = PICTURES["S36_black"]
    store = ProductPictures(_Session(body=b"<html>blocked</html>"), tmp_path)
    assert asyncio.run(store.picture(name)) is None
    assert not (tmp_path / "products" / name).exists()


# -- a color for a player that names none -----------------------------------


def test_a_models_colors_are_black_and_white_first_then_the_rest():
    assert colors_for("S1")[:2] == ["black", "white"]
    assert colors_for("ZP120") == ["white"]
    assert colors_for("NOT-A-MODEL") == []


def test_every_finish_a_model_was_sold_in_is_offered_oldest_first():
    assert colors_for("S27") == ["shadow", "lunar", "olive", "wave", "sunset"]
    assert colors_for("SUB") == ["black", "matte-black", "white"]
    assert color_name("black", "SUB") == "Premium Black Gloss"
    assert colors_for("S13")[2:] == ["hay-forest-green", "hay-pale-yellow", "hay-soft-pink",
                                      "hay-light-grey", "hay-vibrant-red"]
    # The One (gen 2) came after HAY and never had it.
    assert colors_for("S18") == ["black", "white"]


def test_a_finish_sonos_has_a_render_of_draws_it():
    # The content store's "limited" One is the HAY Light Grey.
    assert picture_for("S13", chosen="hay-light-grey") == PICTURES["S13-S18_limited"]
    assert picture_for("S27", chosen="sunset") == PICTURES["S27_sunset"]


def test_every_finish_is_well_formed():
    for model, finishes in FINISHES.items():
        keys = [f.key for f in finishes]
        assert len(keys) == len(set(keys)), model
        pictured = products._INDEX.get(model, {})
        for f in finishes:
            assert f.name and f.source.startswith("https://"), (model, f.key)
            assert re.fullmatch(r"\d{4}(-\d{2})?", f.released), (model, f.key)
            # A render a finish names must exist for that model.
            assert f.render in ("", "black", "white") or f.render in pictured, (model, f.key)


def test_the_play1_offers_its_limited_editions_after_black_and_white():
    # Blue Note (March 2015) and Tone (July 2015) have no render of their own.
    assert colors_for("S1") == ["black", "white", "bluenote", "tone-black", "tone-white"]
    assert colors_for("S12") == colors_for("S1")
    assert color_name("bluenote", "S1") == "Blue Note Limited Edition"


def test_an_edition_with_no_render_is_drawn_as_the_color_it_looks_like():
    assert picture_for("S1", chosen="tone-white") == PICTURES["S1-S12_white"]
    assert picture_for("S1", chosen="tone-black") == PICTURES["S1-S12_black"]
    # Navy fading to cerulean looks like neither: the usual black picture.
    assert picture_for("S1", chosen="bluenote") == PICTURES["S1-S12_black"]


def test_a_color_reads_as_the_s1_app_names_it():
    assert color_name("lunar") == "Lunar White"
    assert color_name("limited") == "Limited Edition"
    assert color_name("shadow") == "Shadow"
    assert color_name("black") == "Black"


def test_a_choice_is_kept_on_disk_and_unknown_removes_it(tmp_path: Path):
    ColorChoices(tmp_path).set("RINCON_A", "white")
    assert ColorChoices(tmp_path).get("RINCON_A") == "white"
    ColorChoices(tmp_path).set("RINCON_A", "")
    assert ColorChoices(tmp_path).get("RINCON_A") == ""


def _details(color="", model_number="S1"):
    return {"uuid": "RINCON_A", "model_number": model_number, "color": color}


def test_a_player_that_names_no_color_is_unknown_and_drawn_black(tmp_path, monkeypatch):
    monkeypatch.setitem(main.state, "colors", ColorChoices(tmp_path))
    found = main._with_color(_details())
    assert found["color_reported"] is False
    assert [c["key"] for c in found["colors"]][:2] == ["black", "white"]
    assert found["color_choice"] == ""
    assert found["color"] == ""
    assert found["picture"].endswith(PICTURES["S1-S12_black"])


def test_a_chosen_color_draws_its_picture_and_reads_as_the_color(tmp_path, monkeypatch):
    choices = ColorChoices(tmp_path)
    choices.set("RINCON_A", "white")
    monkeypatch.setitem(main.state, "colors", choices)
    found = main._with_color(_details())
    assert found["color_choice"] == "white"
    assert found["color"] == "White"
    assert found["picture"].endswith(PICTURES["S1-S12_white"])


def test_a_color_the_player_names_wins_and_offers_no_picker(tmp_path, monkeypatch):
    choices = ColorChoices(tmp_path)
    choices.set("RINCON_A", "black")
    monkeypatch.setitem(main.state, "colors", choices)
    found = main._with_color(_details(color="White", model_number="S12"))
    assert found["color_reported"] is True
    assert found["colors"] == []
    assert found["color"] == "White"
    assert found["picture"].endswith(PICTURES["S1-S12_white"])


def test_a_model_sold_in_one_color_states_it_and_offers_no_picker(tmp_path, monkeypatch):
    choices = ColorChoices(tmp_path)
    choices.set("RINCON_A", "white")
    monkeypatch.setitem(main.state, "colors", choices)
    found = main._with_color(_details(model_number="ZP120"))
    assert found["colors"] == []
    assert found["color"] == "White"
    assert found["color_source"] == "model"
    assert found["color_choice"] == ""
    assert found["picture"].endswith(PICTURES["ZP120_white"])
    # The Playbar came in black only.
    assert main._with_color(_details(model_number="S9"))["color"] == "Black"


def test_one_render_alone_does_not_make_a_model_single_colored():
    # The store's renders are not every color sold; only the table says so.
    assert products.sole_color("S1") == ""
    assert products.sole_color("NOT-A-MODEL") == ""
    assert products.sole_color("ZP120") == "white"
