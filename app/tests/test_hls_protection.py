"""Which HLS streams a browser cannot open.

A stream locked to the service's own players plays as silence in the page, so
the browser room says it cannot play it instead. Mixcloud hides its AES key
behind a path (measured 2026-09-10); Apple Music's live radio is FairPlay
(2026-11-02), and its key sits in the variant playlist, not the master.
"""

from backend.sonos.localplay import hls_first_variant, hls_is_protected

FAIRPLAY = (
    "#EXTM3U\n#EXT-X-VERSION:5\n"
    '#EXT-X-KEY:KEYFORMATVERSIONS="1",METHOD=SAMPLE-AES,URI="skd://linear/F8C8?e=radioEvent",'
    'IV=0x07375c8244adcb275ee947a1bf925dc4,KEYFORMAT="com.apple.streamingkeydelivery"\n'
    "#EXTINF:15.99998,\nsegment_1_2820086.aac\n"
)
MASTER = (
    "#EXTM3U\n#EXT-X-VERSION:6\n"
    '#EXT-X-STREAM-INF:CODECS="mp4a.40.2",BANDWIDTH=281600\n'
    "https://liveradio.example.invalid/ts/index_1.m3u8\n"
    '#EXT-X-STREAM-INF:CODECS="mp4a.40.5",BANDWIDTH=70400\n'
    "index_2.m3u8\n"
)


def test_a_fairplay_key_is_locked():
    assert hls_is_protected(FAIRPLAY)


def test_any_drm_key_format_is_locked():
    widevine = ('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,AAAA",'
                'KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"\n')
    assert hls_is_protected(widevine)


def test_a_key_a_browser_can_fetch_is_not_locked():
    plain = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://keys.example.invalid/k1"\n'
    assert not hls_is_protected(plain)
    named = ('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://keys.example.invalid/k1",'
             'KEYFORMAT="identity"\n')
    assert not hls_is_protected(named)


def test_mixclouds_path_for_a_key_is_still_locked():
    assert hls_is_protected('#EXT-X-KEY:METHOD=AES-128,URI="data:text/plain,/secure/hls_aes128/abc"\n')


def test_no_key_is_not_locked():
    assert not hls_is_protected("#EXTM3U\n#EXTINF:10,\nseg1.aac\n")
    assert not hls_is_protected(MASTER)


def test_the_first_variant_of_a_master():
    assert hls_first_variant(MASTER, "https://x.invalid/gl/1/index.m3u8") == \
        "https://liveradio.example.invalid/ts/index_1.m3u8"
    relative = MASTER.replace("https://liveradio.example.invalid/ts/index_1.m3u8", "ts/a.m3u8")
    assert hls_first_variant(relative, "https://x.invalid/gl/1/index.m3u8") == "https://x.invalid/gl/1/ts/a.m3u8"
    assert hls_first_variant(FAIRPLAY, "https://x.invalid/") == ""
