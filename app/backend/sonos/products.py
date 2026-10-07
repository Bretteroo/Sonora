"""Product pictures, fetched from Sonos once and kept for good.

play.sonos.com draws every product in View System Details from one set of
renders at media.sonos.com (``product_pictures.py`` lists them and says where
the list came from). Each file's name carries its own hash, and the server
sends it ``immutable`` for a year, so a picture that is on disk is never
fetched again: it lives under the data directory's ``products`` folder beside
the service logos. A picture is only fetched once a player of that model is
shown, and one that fails is not asked for again for ten minutes.

The pictures are Sonos' own and are not part of Sonora's source. The list of
names is.

A player that does not say what color it is can be told: the choice is kept
in ``product_colors.json`` beside the other state, by player, and draws its
picture and its line in View System Details until the player says otherwise.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from pathlib import Path

import aiohttp

from .product_colors import FINISHES, finish, finishes_for
from .product_pictures import PICTURES

log = logging.getLogger(__name__)

#: Where every picture in the list is published, public and without a token.
MEDIA = "https://media.sonos.com/images/znqtjj88/int/"

#: How soon a picture that could not be fetched is asked for again.
RETRY = 10 * 60.0

#: The colors to fall back on, in order, when a player names none or one
#: the list lacks. Whether /info carries a color goes with the board, not
#: the generation: on 2026-09-24 every player whose hwVersion ended -1.1 or
#: -1.2 named one (the S2 players, and the S1 system's S12 Play:1 and S15
#: Connect, both "White"), and every -1.0 board (the S1 Play:1s, Play:5,
#: SYMFONISKs and Connect:Amp) named none. The same boards' device
#: descriptions carry the color as ``<variant>``: 1 on the white ones, 2 on
#: the black, 0 on every one that names none, so the color was never
#: recorded on those and nothing local can recover it. The Connect:Amp was
#: only ever made in white, so it comes out right either way.
FALLBACK_COLORS = ("black", "white")

#: How a color reads where its key alone would not. The S1 app's own list
#: of colors (in its sclib) names "Limited Edition", "Shadow" and "Lunar
#: White"; the rest read as their keys do, capitalised.
COLOR_NAMES = {"lunar": "Lunar White", "limited": "Limited Edition"}

_FILES = frozenset(PICTURES.values())


def _color_key(color: str) -> str:
    return re.sub(r"[^a-z]", "", (color or "").lower())


def _index() -> dict[str, dict[str, str]]:
    """model number -> color -> file name. "S31-S32_black" is the file for
    both the S31 and the S32 in black."""
    index: dict[str, dict[str, str]] = {}
    for title, name in PICTURES.items():
        models, _, color = title.rpartition("_")
        for model in models.split("-"):
            index.setdefault(model.upper(), {})[_color_key(color)] = name
    return index


_INDEX = _index()


#: What each model number is called, as a speaker's own /info names it
#: (modelDisplayName). A speaker the household has lost is known by its
#: number alone (its VanishedDevices entry says ModelInfo="S54"), so this
#: names it. Numbers not listed here go by what was last seen of them.
MODEL_NAMES = {
    "ZP80": "ZP80", "ZP100": "ZP100", "ZB100": "Bridge", "BR200": "Boost",
    "ZP90": "Connect", "S15": "Connect", "ZP120": "Connect:Amp", "S16": "Amp",
    "S1": "Play:1", "S12": "Play:1", "S3": "Play:3", "S5": "Play:5", "S6": "Play:5",
    "S9": "Playbar", "S11": "Playbase", "SUB": "Sub", "S26": "Sub", "S37": "Sub Mini",
    "S55": "Sub 4", "S13": "One", "S18": "One", "S22": "One SL", "S38": "One SL",
    "S43": "One SL", "S14": "Beam", "S31": "Beam", "S36": "Ray", "S19": "Arc",
    "S34": "Arc SL", "S45": "Arc Ultra", "S23": "Port", "S24": "Five",
    "S17": "Move", "S44": "Move 2", "S27": "Roam", "S35": "Roam SL", "S54": "Roam 2",
    "S39": "Era 100", "S41": "Era 300",
    "S20": "SYMFONISK Table Lamp", "S30": "SYMFONISK Table Lamp",
    "S21": "SYMFONISK Bookshelf", "S33": "SYMFONISK Bookshelf",
    "S29": "SYMFONISK Picture Frame",
}


#: The products Sonos sold under one name in more than one generation, by the
#: model number each generation answers. A name the generations share cannot
#: tell them apart, so the label says which one it is. The Sub's first two
#: and both Connect:Amps answer the same number and stay unlabeled; products
#: whose later generation carries a new name (Move 2, Roam 2, Sub 4) need no
#: label either.
GENERATIONS = {
    "S5": 1, "S6": 2,        # Play:5
    "S13": 1, "S18": 2,      # One
    "S14": 1, "S31": 2,      # Beam
    "ZP90": 1, "S15": 2,     # Connect
    "S26": 3,                # Sub
    "S20": 1, "S30": 2,      # SYMFONISK table lamp
    "S21": 1, "S33": 2,      # SYMFONISK bookshelf
}


def model_label(model: str, model_number: str) -> str:
    """The model's name, with "(Gen 2)" and the like where it needs one."""
    gen = GENERATIONS.get((model_number or "").upper())
    if not gen or not model or re.search(r"\bgen\b", model, re.I):
        return model
    return f"{model} (Gen {gen})"


def picture_for(model_number: str, color: str = "", *, chosen: str = "") -> str | None:
    """The file that shows this model in this color, or ``None`` when Sonos
    has no picture of the model.

    ``color`` is what the player reports, matched on its letters, so
    "Black" finds "black" and a color of several words the longest listed
    color among them. ``chosen`` is a finish key from ``colors_for``,
    drawn by the render its finish names. With no match, black and then
    white stand in, and then whatever color there is.
    """
    options = _INDEX.get((model_number or "").upper())
    if not options:
        return None
    if chosen:
        picked = finish(model_number, chosen)
        color = picked.render if picked is not None else chosen
    want = _color_key(color)
    if want in options:
        return options[want]
    within = [key for key in options if key and key in want]
    if within:
        return options[max(within, key=len)]
    for key in FALLBACK_COLORS:
        if key in options:
            return options[key]
    return next(iter(options.values()))


def colors_for(model_number: str) -> list[str]:
    """The keys of every finish the model was sold in, oldest first, from
    ``product_colors.FINISHES``. A model missing there offers the colors
    Sonos has renders of, black and white first. Empty for a model with
    neither."""
    number = (model_number or "").upper()
    if number in FINISHES:
        return [f.key for f in finishes_for(number)]
    options = _INDEX.get(number) or {}
    first = list(FALLBACK_COLORS)
    return sorted(options, key=lambda k: (first.index(k) if k in first else len(first), k))


def sole_color(model_number: str) -> str:
    """The key of the one finish a model was ever sold in, or "" when it
    came in more than one or its finishes are not on record. A model's
    renders alone do not count: the store's are not every color sold."""
    found = finishes_for(model_number)
    return found[0].key if len(found) == 1 else ""


def color_name(key: str, model_number: str = "") -> str:
    """How a finish reads: "bluenote" on a Play:1 is "Blue Note Limited
    Edition", "shadow" on a Roam "Shadow Black". A key the model's list does
    not hold reads as a render color: "lunar" is "Lunar White", "black"
    "Black"."""
    picked = finish(model_number, key) if model_number else None
    if picked is not None:
        return picked.name
    return COLOR_NAMES.get(key) or key.capitalize()


class ColorChoices:
    """The color someone chose for each player that does not name its own,
    by player id, kept on disk."""

    def __init__(self, data_dir: Path) -> None:
        self._path = Path(data_dir) / "product_colors.json"
        # The file used to be product_colours.json; one kept under
        # the old name is moved rather than forgotten.
        old = Path(data_dir) / "product_colours.json"
        if old.is_file() and not self._path.exists():
            try:
                old.rename(self._path)
            except OSError:
                self._path = old

    def _read(self) -> dict[str, str]:
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        if not isinstance(data, dict):
            return {}
        return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)}

    def get(self, player: str) -> str:
        return self._read().get(player, "")

    def set(self, player: str, color: str) -> None:
        """Keep ``color`` for ``player``; an empty one goes back to Unknown."""
        choices = self._read()
        if color:
            choices[player] = color
        else:
            choices.pop(player, None)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Written beside and renamed, so a half-written file is never read.
        temp = self._path.with_suffix(".part")
        temp.write_text(json.dumps(choices, indent=1, sort_keys=True), encoding="utf-8")
        temp.replace(self._path)


class ProductPictures:
    """The pictures on disk, and the one fetch each takes to put it there."""

    def __init__(self, session: aiohttp.ClientSession, data_dir: Path) -> None:
        self._session = session
        self._dir = Path(data_dir) / "products"
        self._fetches: dict[str, asyncio.Task] = {}
        self._failed: dict[str, float] = {}
        self._timeout = aiohttp.ClientTimeout(total=20)

    @staticmethod
    def knows(name: str) -> bool:
        return name in _FILES

    async def picture(self, name: str) -> bytes | None:
        """The picture's bytes, from disk when it is there and from Sonos
        the first time. ``None`` for a name not in the list, or when the
        fetch failed."""
        if name not in _FILES:
            return None
        path = self._dir / name
        try:
            return path.read_bytes()
        except FileNotFoundError:
            pass
        except OSError as exc:
            log.info("product picture %s unreadable: %s", name, exc)
        failed = self._failed.get(name)
        if failed is not None and time.monotonic() - failed < RETRY:
            return None
        # Rows that show the same model at once share one fetch.
        task = self._fetches.get(name)
        if task is None:
            task = asyncio.create_task(self._fetch(name), name=f"product-picture:{name}")
            self._fetches[name] = task
            task.add_done_callback(lambda _t: self._fetches.pop(name, None))
        return await asyncio.shield(task)

    async def _fetch(self, name: str) -> bytes | None:
        body = None
        try:
            async with self._session.get(MEDIA + name, timeout=self._timeout) as resp:
                if resp.status == 200:
                    body = await resp.read()
                else:
                    log.info("product picture %s answered %s", name, resp.status)
        except Exception as exc:
            log.info("product picture %s failed: %s", name, exc)
        if not body or not body.startswith(b"\x89PNG"):
            self._failed[name] = time.monotonic()
            return None
        self._failed.pop(name, None)
        try:
            self._dir.mkdir(parents=True, exist_ok=True)
            # Written beside and renamed, so a half-written file is never read.
            temp = (self._dir / name).with_suffix(".part")
            temp.write_bytes(body)
            temp.replace(self._dir / name)
        except OSError as exc:
            log.info("could not keep product picture %s: %s", name, exc)
        return body
