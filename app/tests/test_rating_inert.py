"""A lit rating button that cannot take its rating away is drawn as doing nothing.

AccuRadio's map draws a loved track's star lit, but the button is "VoteUp"
with the success message of the star that gave the love, and pressing it
left the track loved (2026-10-01). Most services' lit buttons remove the
rating; the test tells the two apart from the map alone.
"""

from backend.main import rating_is_inert


def _b(icon, string_id, on_success, state=""):
    return {"icon": f"https://example/{icon}-pcdcr.png", "string_id": string_id,
            "on_success": on_success, "rating_state": state}


ACCURADIO = {"matches": {
    "0": [_b("STAR_UNSELECTED", "VoteUp", "VoteUpSuccess"), _b("PROHIBITED_UNSELECTED", "VoteDown", "VoteDownSuccess")],
    "1": [_b("STAR_SELECTED", "VoteUp", "VoteUpSuccess"), _b("PROHIBITED_UNSELECTED", "VoteDown", "VoteDownSuccess")],
    "2": [_b("STAR_UNSELECTED", "VoteUp", "VoteUpSuccess"), _b("PROHIBITED_SELECTED", "VoteDown", "VoteDownSuccess")],
}}
SPOTIFY = {"matches": {
    "0": [_b("HEART_UNSELECTED", "ADD_TRACK_TO_YOUR_MUSIC", "SUCCESS_ADD_TRACK")],
    "1": [_b("HEART_SELECTED", "REMOVE_TRACK_FROM_YOUR_MUSIC", "SUCCESS_REMOVE_TRACK")],
}}
PANDORA = {"matches": {
    "0": [_b("THUMBSUP_UNSELECTED", "THUMBS_UP", "ON_SUCCESS_THUMBS_UP", "UNRATED")],
    "1": [_b("THUMBSUP_SELECTED", "REMOVE_THUMBS_UP", "ON_SUCCESS_REMOVE_THUMBS_UP", "RATED")],
}}


def test_accuradio_lit_star_and_ban_are_inert():
    assert rating_is_inert(ACCURADIO["matches"]["1"][0], ACCURADIO) is True
    assert rating_is_inert(ACCURADIO["matches"]["2"][1], ACCURADIO) is True


def test_unlit_buttons_are_never_inert():
    assert rating_is_inert(ACCURADIO["matches"]["0"][0], ACCURADIO) is False
    assert rating_is_inert(ACCURADIO["matches"]["1"][1], ACCURADIO) is False


def test_a_lit_button_that_removes_the_rating_is_live():
    assert rating_is_inert(SPOTIFY["matches"]["1"][0], SPOTIFY) is False
    assert rating_is_inert(PANDORA["matches"]["1"][0], PANDORA) is False


def test_a_toggle_names_its_other_picture():
    from backend.main import rating_toggled_icon
    spotify_unlit = dict(SPOTIFY["matches"]["0"][0], auto_skip="NEVER")
    assert rating_toggled_icon(spotify_unlit, SPOTIFY).endswith("HEART_SELECTED-pcdcr.png")
    pandora_lit = dict(PANDORA["matches"]["1"][0], auto_skip="NEVER")
    assert rating_toggled_icon(pandora_lit, PANDORA).endswith("THUMBSUP_UNSELECTED-pcdcr.png")


def test_a_skip_or_an_inert_button_is_no_toggle():
    from backend.main import rating_toggled_icon
    ban = dict(ACCURADIO["matches"]["0"][1], auto_skip="ALWAYS")
    assert rating_toggled_icon(ban, ACCURADIO) == ""
    lit_star = dict(ACCURADIO["matches"]["1"][0], auto_skip="NEVER")
    assert rating_toggled_icon(lit_star, ACCURADIO) == ""
    unlit_star = dict(ACCURADIO["matches"]["0"][0], auto_skip="NEVER")
    assert rating_toggled_icon(unlit_star, ACCURADIO).endswith("STAR_SELECTED-pcdcr.png")
