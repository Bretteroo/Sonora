"""A product goes by the name Sonos gives it, and a product sold under one
name in two generations says which one it is."""

from backend.sonos.products import model_label


def test_generations_sharing_a_name_are_labeled():
    assert model_label("Sonos One", "S13") == "One (Gen 1)"
    assert model_label("Sonos One", "S18") == "One (Gen 2)"
    assert model_label("Beam", "S31") == "Beam (Gen 2)"
    assert model_label("Sonos Play:5", "S5") == "Play:5 (Gen 1)"


def test_single_generation_and_unknown_products_are_left_alone():
    assert model_label("Sonos Era 100", "S39") == "Era 100"
    assert model_label("Sonos Sub", "Sub") == "Sub"
    assert model_label("", "S18") == ""


def test_a_name_that_already_says_is_not_labeled_twice():
    assert model_label("Sonos Beam (Gen 2)", "S31") == "Beam (Gen 2)"


def test_players_go_by_their_names_alone_as_sonos_lists_them():
    # A player calls itself "Sonos Play:1"; the product is the Play:1, and
    # the Arc Ultra, the Ray, the Roam 2, and the Sub are as bare.
    assert model_label("Sonos Play:1", "S1") == "Play:1"
    assert model_label("Sonos Connect", "S15") == "Connect (Gen 2)"
    assert model_label("Sonos Arc Ultra", "S45") == "Arc Ultra"
    assert model_label("Sonos Ray", "S36") == "Ray"
    assert model_label("Sonos Roam 2", "S54") == "Roam 2"
    assert model_label("Sonos Sub", "S26") == "Sub (Gen 3)"
    assert model_label("Sonos SYMFONISK", "S21") == "SYMFONISK (Gen 1)"


def test_the_three_named_with_sonos_keep_it():
    assert model_label("Sonos Ace", "") == "Sonos Ace"
    assert model_label("Ace Ultra", "") == "Sonos Ace Ultra"
    assert model_label("Sonos Play", "") == "Sonos Play"


def test_the_connect_amps_are_told_apart_by_their_series():
    # Both answer ZP120; the series id in the description says which is which.
    assert model_label("Sonos Connect:Amp", "ZP120", "P100") == "Connect:Amp (Gen 1)"
    assert model_label("Sonos Connect:Amp", "ZP120", "C100") == "Connect:Amp (Gen 2)"
    assert model_label("Sonos Connect:Amp", "ZP120") == "Connect:Amp"
