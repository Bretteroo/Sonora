"""A titled radio stream taken apart as it passes: audio out, titles kept.

The "This browser" room's Information line comes from the stream's own ICY
blocks, which a page's media element cannot read (80s80s).
"""

from backend.sonos.icy import Demux, pick


def _block(text: str) -> bytes:
    raw = f"StreamTitle='{text}';".encode()
    size = -(-len(raw) // 16)
    return bytes([size]) + raw.ljust(size * 16, b"\0")


STREAM = (b"A" * 8 + _block("80s80s Reggae") + b"B" * 8 + b"\x00"
          + b"C" * 8 + _block("Alpha Blondy - Brigadier Sabari") + b"D" * 3)


def test_audio_comes_out_alone_and_the_title_is_kept():
    demux = Demux(8)
    assert demux.feed(STREAM) == b"A" * 8 + b"B" * 8 + b"C" * 8 + b"D" * 3
    assert demux.title == "Alpha Blondy - Brigadier Sabari"


def test_a_block_split_across_chunks_is_still_read():
    for cut in range(1, len(STREAM)):
        demux = Demux(8)
        audio = demux.feed(STREAM[:cut]) + demux.feed(STREAM[cut:])
        assert audio == b"A" * 8 + b"B" * 8 + b"C" * 8 + b"D" * 3, cut
        assert demux.title == "Alpha Blondy - Brigadier Sabari", cut


def test_a_stream_without_blocks_passes_untouched():
    assert Demux(0).feed(b"raw audio") == b"raw audio"


def test_the_station_naming_itself_is_passed_over():
    assert pick(["80s80s Reggae"], "80s80s Reggae") == ""
    assert pick(["80s80s ALTERNATIVE", "Talk Talk - It's My Life"], "80s80s Alternative") == "Talk Talk - It's My Life"
    assert pick(["Talk Talk - It's My Life", "80s80s Alternative"], "80s80s Alternative") == "Talk Talk - It's My Life"
