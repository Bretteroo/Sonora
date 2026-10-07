"""The largest copy of a picture, for a page that draws it large.

A provider often names a picture smaller than it holds: a Plex cover at
300px from a 1500px original, a Sonos Radio cover at 200px on an image host
that makes any size (measured 2026-10-05). ``upsized`` raises the size a
URL's query asks for. It keys on the parameter's name, never on a host, so
one rule serves every service that sizes its pictures this way.
"""

from __future__ import annotations

from backend.sonos.artcache import upsized


def test_a_width_parameter_is_raised_to_the_size_drawn():
    assert upsized("https://img.example/a.png?w=200&auto=format", 1024) == \
        "https://img.example/a.png?w=1024&auto=format"


def test_width_and_height_keep_their_proportion():
    assert upsized("https://cdn.example/x.jpg?width=200&height=300&crop=pad", 900) == \
        "https://cdn.example/x.jpg?width=600&height=900&crop=pad"


def test_a_url_wrapped_in_another_is_raised_inside():
    wrapped = ("https://wrap.example/img?height=1&minSize=1&upscale=1"
               "&url=https%3A%2F%2Fserver%2Fthumb%3Ftoken%3Dabc%26width%3D300")
    out = upsized(wrapped, 1200)
    assert out.endswith("%26width%3D1200")
    # A value too small to be a size is a flag, and is left as it is.
    assert "height=1&minSize=1&upscale=1" in out


def test_a_url_with_no_size_is_left_alone():
    for url in ("https://i.example/image/ab67616d0000b273975a",
                "http://192.168.1.2:1400/getaa?s=1&u=x-sonos-http%3aabc"):
        assert upsized(url, 1024) == url


def test_a_url_already_large_enough_is_left_alone():
    assert upsized("https://e.example/a.jpg?width=2000", 1024) == "https://e.example/a.jpg?width=2000"


def test_a_name_that_only_ends_in_w_is_not_a_size():
    assert upsized("https://e.example/a.jpg?view=200", 1024) == "https://e.example/a.jpg?view=200"
