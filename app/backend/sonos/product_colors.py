"""Every color and finish Sonos sold each model in.

``product_pictures.py`` holds a render of a model in each color Sonos' own
content store keeps, and that is mostly black and white: it has no Blue Note
Play:1, for one. The color picker in View System Details offers every
finish a model was sold in, so they are listed here by the model number the
player reports, each with where it was read (researched 2026-09-24, most of
sonos.com through web.archive.org since it refuses a fetch).

Only what went on sale is here. One-off art pieces that were given away or
auctioned (the Play:3s of 2011-12, John Varvatos' Play:5) are not, nor is
anything the sources left in doubt: a Beam (gen 2) Shadow Edition, a Roam SL
in Olive, Wave or Sunset, and the Sonos Play in Blush have renders in the
content store but no sale anyone recorded.

``render`` is the color of the model's render that draws a finish: its own
where the content store has one (the One's "limited" is the HAY Light Grey),
the plain color it looks most like, or "" for the model's usual picture.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Finish:
    #: What a choice is kept as; unique within the model.
    key: str
    #: The name Sonos or its partner gave it.
    name: str
    render: str
    #: Year and month first on sale, or the year alone where no source gave
    #: the month; it orders the picker.
    released: str
    source: str


def _f(key: str, name: str, render: str, released: str, source: str) -> Finish:
    return Finish(key, name, render, released, source)


_WB = "https://web.archive.org/web/"

_PLAY1 = (
    _f("black", "Black", "black", "2013-10", _WB + "20131028214726/http://www.sonos.com/shop/products/play1"),
    _f("white", "White", "white", "2013-10", _WB + "20131028214726/http://www.sonos.com/shop/products/play1"),
    # About 4,100 made: a vertical fade from dark navy to cerulean blue.
    _f("bluenote", "Blue Note Limited Edition", "", "2015-03",
       "https://www.bluenote.com/announcing-the-sonos-blue-note-limited-editio/"),
    # About 5,000 of each, tone on tone in a soft matte.
    _f("tone-black", "Tone Limited Edition, Absolute Black", "black", "2015-07",
       _WB + "2016/http://blog.sonos.com/news/introducing-the-play1-tone-limited-edition/"),
    _f("tone-white", "Tone Limited Edition, Pristine White", "white", "2015-07",
       _WB + "2016/http://blog.sonos.com/news/introducing-the-play1-tone-limited-edition/"),
)

_HAY = _WB + "2019/https://www.sonos.com/en-gb/shop/hay-sonos-one-limited-edition-red.html"
_ONE_GEN1 = (
    _f("black", "Black", "black", "2017-10", _WB + "20171102034434/http://www.sonos.com/en-us/shop/one.html"),
    _f("white", "White", "white", "2017-10", _WB + "20171102034434/http://www.sonos.com/en-us/shop/one.html"),
    _f("hay-forest-green", "HAY Limited Edition, Forest Green", "", "2018-11", _HAY),
    _f("hay-pale-yellow", "HAY Limited Edition, Pale Yellow", "", "2018-11", _HAY),
    _f("hay-soft-pink", "HAY Limited Edition, Soft Pink", "", "2018-11", _HAY),
    # "Light Grey" is HAY's own name for it, and stays as they spelled it.
    _f("hay-light-grey", "HAY Limited Edition, Light Grey", "limited", "2018-11", _HAY),
    _f("hay-vibrant-red", "HAY Limited Edition, Vibrant Red", "", "2018-11", _HAY),
)

_ONE_SL = (
    _f("black", "Black", "black", "2019-09", _WB + "20191023044309/https://www.sonos.com/en-us/shop/one-sl.html"),
    _f("white", "White", "white", "2019-09", _WB + "20191023044309/https://www.sonos.com/en-us/shop/one-sl.html"),
    # Costco's two-pack.
    _f("shadow", "Shadow Edition", "shadow", "2019-12",
       "https://slickdeals.net/f/13672502-sonos-one-sl-wi-fi-speaker-shadow-edition-2-pack-250"),
    # Sheila Bridges' Harlem Toile in blue on white; again in 2020.
    _f("union-la", "Union LA Edition", "white", "2019-12",
       _WB + "2021/https://www.sonos.com/en-us/blog/union-la-sonos-collaboration"),
)

_SUB_EARLY = (
    _f("black", "Premium Black Gloss", "black", "2012-06", _WB + "20131202131717/http://www.sonos.com/shop/products/sub"),
    # A very limited run in March 2013, then sold until late 2014.
    _f("matte-black", "Black Matte", "black", "2013-03",
       "https://www.slashgear.com/sonos-offers-matte-sub-in-stock-limited-599-sale-19274600/"),
    # Gen 2 only.
    _f("white", "Premium White Gloss", "white", "2016-10", "https://9to5mac.com/2016/10/11/sonos-white-sub/"),
)

_ROAM = (
    _f("shadow", "Shadow Black", "shadow", "2021-04", _WB + "20220601134316/https://www.sonos.com/en-us/shop/roam"),
    _f("lunar", "Lunar White", "lunar", "2021-04", _WB + "20220601134316/https://www.sonos.com/en-us/shop/roam"),
    _f("olive", "Olive", "olive", "2022-05",
       "https://newsroom.sonos.com/254700-upgrade-your-sound-with-sonos-ray-and-new-colors-for-sonos-roam/"),
    _f("wave", "Wave", "wave", "2022-05",
       "https://newsroom.sonos.com/254700-upgrade-your-sound-with-sonos-ray-and-new-colors-for-sonos-roam/"),
    _f("sunset", "Sunset", "sunset", "2022-05",
       "https://newsroom.sonos.com/254700-upgrade-your-sound-with-sonos-ray-and-new-colors-for-sonos-roam/"),
)

def _light_gray_then_white(first: str, light_gray: str, white: str) -> tuple[Finish, ...]:
    """Sold in light gray at first and in white from 2010."""
    return (_f("light-gray", "Light Gray", "white", first, light_gray),
            _f("white", "White", "white", "2010", white))


def _black_white(released: str, source: str) -> tuple[Finish, ...]:
    return (_f("black", "Black", "black", released, source), _f("white", "White", "white", released, source))


#: model number -> every finish it was sold in. S1 and S12 are both the
#: Play:1, as its renders have it ("S1-S12_black"), and S22, S38 and S43
#: are the One SL's three boards.
FINISHES: dict[str, tuple[Finish, ...]] = {
    "ZP100": (_f("aluminum", "Aluminum", "white", "2005-01",
                 _WB + "20060503160423/http://www.sonos.com/products/zoneplayers/zp100/specs.htm"),),
    "ZP80": (_f("light-gray", "Light Gray", "white", "2006-01",
                _WB + "20080312090540/http://www.sonos.com/news_and_reviews/press_releases/2006/pr_010406_zp80.htm"),),
    "ZB100": _light_gray_then_white(
        "2007-10", _WB + "20080612194821/http://www.sonos.com/products/zonebridges/br100/specs.htm",
        _WB + "20131129065012/http://www.sonos.com/shop/products/bridge"),
    "ZP90": _light_gray_then_white(
        "2008-08", _WB + "20100520044220/http://www.sonos.com/products/zoneplayers/zp90/default.aspx?rdr=true&LangType=1033",
        _WB + "20100520044220/http://www.sonos.com/products/zoneplayers/zp90/default.aspx?rdr=true&LangType=1033"),
    # The Connect's 2017 board; white as the first was.
    "S15": (_f("white", "White", "white", "2017", _WB + "20190202174338/https://www.sonos.com/en-us/shop/connect.html"),),
    # Anodized aluminium; Sonos' own page gives its color as white.
    "ZP120": (_f("white", "White", "white", "2008-08", _WB + "20170604132221/http://www.sonos.com/en-us/shop/connectamp.html"),),
    "BR200": (_f("white", "White", "white", "2014-10", _WB + "20190223055159/https://www.sonos.com/en-us/shop/boost.html"),),
    "S5": (
        _f("white", "White", "white", "2009-11",
           _WB + "20101229214847/http://www.sonos.com/products/zoneplayers/s5/default.aspx?rdr=true&LangType=1033"),
        _f("black", "Black", "black", "2010-06", "https://techcrunch.com/2010/06/02/the-sonos-s5-is-now-available-in-black/"),
        # Four Creative Growth artists' images printed on the grille, sold
        # at the Miami art fair only.
        _f("creative-growth", "Creative Growth Special Edition", "", "2011-12",
           _WB + "2017/http://blog.sonos.com:80/products/special-edition-play5s-to-debut-at-miami-art-fair/"),
    ),
    "S3": _black_white("2011-07", _WB + "20110818062913/http://sonos.com:80/shop/products/play3"),
    "SUB": _SUB_EARLY,
    "S9": (_f("black", "Black", "black", "2013-03", _WB + "20180524175150/https://www.sonos.com/en-us/shop/playbar.html"),),
    "S1": _PLAY1,
    "S12": _PLAY1,
    "S6": _black_white("2015-11", "https://newsroom.sonos.com/254813-x/") + (
        # Barry McGee's red lettering on a white Play:5, for charity.
        _f("beastie-boys", "Beastie Boys Edition", "white", "2018-12",
           _WB + "2019/https://www.sonos.com/en-us/limited-edition/beastie-boys-play-5"),
    ),
    "S11": _black_white("2017-04", _WB + "20170531070229/http://www.sonos.com/en-us/shop/playbase.html"),
    "S13": _ONE_GEN1,
    "S18": _black_white("2019-03", _WB + "20190308172403/https://www.sonos.com/en-us/shop/one.html"),
    "S14": _black_white("2018-07", _WB + "20180913052457/https://www.sonos.com/en-us/shop/beam.html") + (
        # Costco's, a charcoal a little lighter than the black.
        _f("shadow", "Shadow Edition", "shadow", "2019-11",
           "https://slickdeals.net/f/13643164-costco-members-sonos-beam-shadow-edition-sound-bar-180-free-shipping"),
    ),
    "S16": (_f("black", "Black", "black", "2019-02", _WB + "20220522025235/https://www.sonos.com/en-us/shop/amp"),),
    "S22": _ONE_SL,
    "S38": _ONE_SL,
    "S43": _ONE_SL,
    "S23": (_f("black", "Black", "black", "2019-09", _WB + "20191112082736/https://www.sonos.com/en-us/shop/port.html"),),
    "S17": (
        _f("shadow", "Shadow Black", "black", "2019-09", _WB + "20211026173007/https://www.sonos.com/en-us/shop/move"),
        _f("lunar", "Lunar White", "lunar", "2020-06",
           "https://www.techhive.com/article/578625/sonos-unveils-a-lunar-white-version-of-the-portable-sonos-move-speaker.html"),
    ),
    "S20": _black_white("2019-08", "https://www.engadget.com/2019/08/01/ikea-sonos-speakers-available/"),
    "S21": _black_white("2019-08", "https://www.engadget.com/2019/08/01/ikea-sonos-speakers-available/"),
    "S19": _black_white("2020-06", "https://newsroom.sonos.com/254729-introducing-sonos-arc-the-premium-smart-soundbar/"),
    # Costco's Arc SL came only as the Shadow Edition.
    "S34": (_f("shadow", "Shadow Edition", "shadow", "2020-12",
               "https://www.androidcentral.com/sonos-arc-sl-shadow-edition-leaks-costco-ahead-imminent-unveiling"),),
    "S24": _black_white("2020-06", _WB + "20211018101052/https://www.sonos.com/en-us/shop/five"),
    "S26": _black_white("2020-06", _WB + "20200804150432/https://www.sonos.com/en-us/shop/sub.html"),
    "S27": _ROAM,
    "S29": _black_white("2021-07", "https://www.ikea.com/global/en/newsroom/innovation/"
                                   "ikea-introduces-new-symfonisk-picture-frame-wifi-speaker-210615/"),
    "S31": _black_white("2021-10", _WB + "20211007144918/https://www.sonos.com/en-us/shop/beam"),
    "S30": _black_white("2021-10", "https://www.ikea.com/global/en/newsroom/collaborations/"
                                   "ikea-and-sonos-introduce-a-new-symfonisk-table-lamp-speaker-210928/"),
    "S33": _black_white("2022-01", "https://www.whathifi.com/news/sonos-and-ikeas-symfonisk-bookshelf-speaker-gets-an-update"),
    "S35": _ROAM[:2],
    "S36": _black_white("2022-06", _WB + "20220601134321/https://www.sonos.com/en-us/shop/ray"),
    "S37": _black_white("2022-10", "https://newsroom.sonos.com/254701-introducing-sub-mini-the-curvy-subwoofer-that-drops-big-beats/"),
    "S39": _black_white("2023-03", "https://newsroom.sonos.com/254695-sonos-unveils-era-300-and-era-100-the-next-"
                                   "generation-of-smart-speakers-built-for-the-future-of-immersive-listening/"),
    "S57": _black_white("2023-03", "https://newsroom.sonos.com/254695-sonos-unveils-era-300-and-era-100-the-next-"
                                   "generation-of-smart-speakers-built-for-the-future-of-immersive-listening/"),
    "S41": _black_white("2023-03", "https://newsroom.sonos.com/254695-sonos-unveils-era-300-and-era-100-the-next-"
                                   "generation-of-smart-speakers-built-for-the-future-of-immersive-listening/"),
    "S44": _black_white("2023-09", "https://newsroom.sonos.com/254663-sonos-introduces-move-2-revamped-inside-and-"
                                   "out-to-deliver-heart-pumping-stereo-sound/") + (
        _f("olive", "Olive", "olive", "2023-09", "https://newsroom.sonos.com/254663-sonos-introduces-move-2-revamped-"
                                                  "inside-and-out-to-deliver-heart-pumping-stereo-sound/"),
    ),
    "S54": _black_white("2024-05", _WB + "20240602054510/https://www.sonos.com/en-us/shop/roam-2") + _ROAM[2:],
    "S45": _black_white("2024-10", "https://newsroom.sonos.com/254655-sonos-reveals-arc-ultra-its-new-soundbar-featuring-sound-motion/"),
    "S55": _black_white("2024-10", _WB + "20250522003633/https://www.sonos.com/en-us/shop/sub-4-black"),
    "S58": _black_white("2026-03", "https://en.community.sonos.com/product-updates/coming-soon-sonos-play-6933344") + (
        _f("sand", "Sand", "sand", "2026-09", "https://www.gearpatrol.com/audio/sonos-play-speaker-sand/"),
    ),
}


def finishes_for(model_number: str) -> tuple[Finish, ...]:
    """The model's finishes, oldest first; ties keep the order above."""
    found = FINISHES.get((model_number or "").upper(), ())
    return tuple(sorted(found, key=lambda f: f.released))


def finish(model_number: str, key: str) -> Finish | None:
    return next((f for f in finishes_for(model_number) if f.key == key), None)
