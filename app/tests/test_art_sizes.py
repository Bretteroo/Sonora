"""Art at the size the caller draws it.

A service publishes one URL per item plus two substitution tables -- an
``ArtWorkSizeMap`` for cover art and a ``BrowseIconSizeMap`` for the glyphs on
browse rows -- each listing a size with the suffix a URL carries at that size.
Pandora's covers arrive at 90px and its stations icon as a 40px PNG with a
white ground; the web client draws both at 156px, which is why Sonora's tiles
were soft and that icon came out as a white box (measured against
play.sonos.com, 2026-09-19).

The rule is a suffix swap and nothing cleverer: a URL whose ending is in
neither table is left exactly as the provider sent it.
"""

from __future__ import annotations

from backend.sonos.presentation import _parse_sizes, _swap_size

PMAP = """
<Presentation>
  <PresentationMap type="ArtWorkSizeMap"><Match><imageSizeMap>
    <sizeEntry size="90" substitution="_90W_90H.jpg"/>
    <sizeEntry size="130" substitution="_130W_130H.jpg"/>
    <sizeEntry size="500" substitution="_500W_500H.jpg"/>
  </imageSizeMap></Match></PresentationMap>
  <PresentationMap type="BrowseIconSizeMap"><Match><browseIconSizeMap>
    <sizeEntry size="40" substitution="_40.svg"/>
    <sizeEntry size="290" substitution="_290.svg"/>
    <sizeEntry size="0" substitution="_40.png"/>
  </browseIconSizeMap></Match></PresentationMap>
</Presentation>
"""

ART = _parse_sizes(PMAP, "ArtWorkSizeMap", "imageSizeMap")
ICONS = _parse_sizes(PMAP, "BrowseIconSizeMap", "browseIconSizeMap")


def test_each_map_is_read_smallest_first():
    assert ART == [(90, "_90W_90H.jpg"), (130, "_130W_130H.jpg"),
                   (500, "_500W_500H.jpg")]
    assert ICONS == [(0, "_40.png"), (40, "_40.svg"), (290, "_290.svg")]


def test_a_service_without_the_map_offers_no_sizes():
    assert _parse_sizes("<Presentation/>", "ArtWorkSizeMap", "imageSizeMap") == []


def test_the_smallest_size_that_is_big_enough_wins():
    assert (_swap_size(ART, "https://art/xyz/_90W_90H.jpg", 290)
            == "https://art/xyz/_500W_500H.jpg")
    assert (_swap_size(ART, "https://art/xyz/_90W_90H.jpg", 100)
            == "https://art/xyz/_130W_130H.jpg")


def test_the_largest_stands_in_when_nothing_is_big_enough():
    assert (_swap_size(ART, "https://art/xyz/_90W_90H.jpg", 2000)
            == "https://art/xyz/_500W_500H.jpg")


def test_the_providers_default_suffix_matches_but_is_never_a_target():
    # Size 0 is the ending Pandora's icons already carry. It has to match for
    # the swap to find anything, and asking for 40 must not choose it back.
    assert (_swap_size(ICONS, "https://p/ic_SMAPI_root_stations_40.png", 290)
            == "https://p/ic_SMAPI_root_stations_290.svg")
    assert (_swap_size(ICONS, "https://p/ic_SMAPI_root_stations_40.png", 40)
            == "https://p/ic_SMAPI_root_stations_40.svg")


def test_a_url_the_map_does_not_describe_is_left_alone():
    # Pandora's Shuffle tile is a .png where the art map lists only .jpg
    # endings; swapping the suffix there would ask for a picture that is not
    # published.
    assert _swap_size(ART, "https://www.pandora.com/img/shuffle_art_90W_90H.png",
                      290) == ""
    assert _swap_size(ART, "https://art/cover.jpg", 290) == ""


def test_art_already_at_the_wanted_size_is_not_rewritten():
    assert _swap_size(ART, "https://art/xyz/_500W_500H.jpg", 290) == ""
