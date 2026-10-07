"""What a radio stream says is playing, from its own ICY metadata.

A speaker prints a station's current track on the Information line, and for
most internet radio it reads that from the stream itself: asked with
``Icy-MetaData: 1``, the server interleaves a small block every
``icy-metaint`` bytes of audio, ``StreamTitle='Artist - Title';``. A
browser's media element cannot ask for those blocks or read them, so the
"This browser" room had nothing for the line (80s80s).

The first block is often the station's own name rather than the track --
80s80s Reggae opens with "80s80s Reggae" and names the song only after its
opening burst, some 480KB in -- so a short separate look at the stream would
cost half a megabyte each time. Sonora passes such a stream on to the page
instead and reads the blocks as they go by (Demux), keeping the last few
titles so the station's name can be passed over.
"""

from __future__ import annotations

import re

_TITLE = re.compile(r"StreamTitle='(.*?)';", re.S)


def pick(found: list[str], station: str = "") -> str:
    """The latest title that is not just the station naming itself."""
    name = re.sub(r"\W+", "", station).casefold()
    for title in reversed(found):
        if title and re.sub(r"\W+", "", title).casefold() != name:
            return title
    return ""


class Demux:
    """Takes an ICY stream apart as it passes: audio out, titles noted.

    Fed the upstream's chunks in order, `feed` returns the audio bytes alone,
    ready for a media element, and `title` holds the latest StreamTitle seen.
    Carries its place across chunks, since a block can straddle two.
    """

    def __init__(self, metaint: int) -> None:
        self.metaint = metaint
        self.left = metaint      # audio bytes still due before the next block
        self.meta = bytearray()  # the block being read
        self.meta_left = -1      # its bytes still due; -1 while at a length byte
        self.title = ""
        self.audio_only = metaint <= 0

    def feed(self, chunk: bytes) -> bytes:
        if self.audio_only:
            return chunk
        out = bytearray()
        at = 0
        while at < len(chunk):
            if self.left > 0:
                take = min(self.left, len(chunk) - at)
                out += chunk[at:at + take]
                at += take
                self.left -= take
            elif self.meta_left < 0:
                self.meta_left = chunk[at] * 16
                at += 1
                self.meta = bytearray()
                if self.meta_left == 0:
                    self.meta_left = -1
                    self.left = self.metaint
            else:
                take = min(self.meta_left, len(chunk) - at)
                self.meta += chunk[at:at + take]
                at += take
                self.meta_left -= take
                if self.meta_left == 0:
                    found = _TITLE.search(bytes(self.meta).rstrip(b"\0").decode("utf-8", "replace"))
                    if found:
                        self.title = found.group(1).strip()
                    self.meta_left = -1
                    self.left = self.metaint
        return bytes(out)
