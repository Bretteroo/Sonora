"""A product sold under one name in two generations says which one it is."""

from backend.sonos.products import model_label


def test_generations_sharing_a_name_are_labeled():
    assert model_label("Sonos One", "S13") == "Sonos One (Gen 1)"
    assert model_label("Sonos One", "S18") == "Sonos One (Gen 2)"
    assert model_label("Beam", "S31") == "Beam (Gen 2)"
    assert model_label("Sonos Play:5", "S5") == "Sonos Play:5 (Gen 1)"


def test_single_generation_and_unknown_products_are_left_alone():
    assert model_label("Sonos Era 100", "S39") == "Sonos Era 100"
    assert model_label("Sonos Sub", "Sub") == "Sonos Sub"
    assert model_label("", "S18") == ""


def test_a_name_that_already_says_is_not_labeled_twice():
    assert model_label("Sonos Beam (Gen 2)", "S31") == "Sonos Beam (Gen 2)"
