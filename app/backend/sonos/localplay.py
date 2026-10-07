"""A browser-playable URL for a Sonos URI, where one exists.

Sonora can play to the browser itself -- the "This browser" room -- but a
browser is not a speaker: it cannot join a household, and it cannot fetch what
a speaker fetches. A speaker is handed a Sonos-scheme URI and calls the
service's ``getMediaURI`` with the household's own token; the page has neither
the token nor the scheme handlers.

What is left is what a browser can already play: a plain HTTP stream. That
covers internet radio, which is most of what anyone would want out of a
laptop's speakers -- SomaFM, 80s80s, TuneIn stations, anything added through
Add Radio Station -- and it covers it exactly, because a Sonos radio URI is a
plain URL behind a scheme prefix.

Everything else says so rather than half-working: a service track
(``x-sonos-http:``), a service station (``x-sonosapi-stream:``), a queue
(``x-rincon-queue:``) and a library file (``x-file-cifs:``) all need either a
service token or an SMB client, and neither belongs in the page.
"""

from __future__ import annotations

import re
import urllib.parse

#: Scheme prefixes that are a plain URL underneath, with the scheme to assume
#: when the remainder carries none.
_PLAIN = {
    "x-rincon-mp3radio://": "http",
    "aac://": "http",
    "mms://": "http",
    "hls-radio://": "https",
    "x-rincon-mp3radio:": "http",
}

#: Schemes a speaker resolves with a token or a mount, which the page cannot.
#: Some of these do resolve, one call further on: the service ones are handed
#: to the provider's own getMediaURI in main.py before this answer stands.
_NEEDS_SPEAKER = (
    "x-sonos-http:", "x-sonosapi-stream:", "x-sonosapi-radio:", "x-sonosapi-hls:",
    "x-sonosapi-hls-static:", "x-sonos-spotify:", "x-sonosprog-http:",
    "x-file-cifs:", "x-rincon:", "x-rincon-stream:",
    "x-sonos-vli:", "x-sonos-htastream:",
)

#: A whole album, playlist or queue: not one stream but an ordered list, kept
#: by the speaker that plays it. The page has one output and no queue.
_NEEDS_QUEUE = ("x-rincon-cpcontainer:", "x-rincon-queue:")


def browser_url(uri: str) -> dict:
    """``{"url", "reason"}``: the URL to play, or why there is not one.

    ``reason`` is a key the interface turns into a sentence, so the wording
    stays with the rest of the strings: ``needs-speaker`` for a source only a
    speaker can fetch, ``needs-queue`` for an album or playlist, which is a
    list rather than a stream, ``unknown`` for a scheme this does not
    recognize, and ``""`` when there is a URL.
    """
    raw = (uri or "").strip()
    if not raw:
        return {"url": "", "reason": "unknown"}
    lowered = raw.lower()
    if lowered.startswith(("http://", "https://")):
        return {"url": raw, "reason": ""}
    for prefix, scheme in _PLAIN.items():
        if lowered.startswith(prefix):
            rest = raw[len(prefix):].lstrip("/")
            if not rest:
                break
            if "://" in rest:
                return {"url": rest, "reason": ""}
            return {"url": f"{scheme}://{rest}", "reason": ""}
    if lowered.startswith(_NEEDS_QUEUE):
        return {"url": "", "reason": "needs-queue"}
    if lowered.startswith(_NEEDS_SPEAKER):
        return {"url": "", "reason": "needs-speaker"}
    return {"url": "", "reason": "unknown"}


def stream_host(url: str) -> str:
    """The host a stream comes from, for a message about it."""
    try:
        return urllib.parse.urlsplit(url).hostname or ""
    except ValueError:
        return ""


#: Content types that name a list of streams rather than audio. A speaker
#: follows these itself; a browser's <audio> element will not.
_PLAYLIST_TYPES = (
    "audio/x-mpegurl", "audio/mpegurl", "application/x-mpegurl",
    "audio/x-scpls", "audio/scpls", "application/pls+xml",
    "text/uri-list", "application/xspf+xml",
    # An HLS manifest wears the same clothes; reading it is how the two are
    # told apart, since only one of them lists whole streams.
    "application/vnd.apple.mpegurl",
)


def looks_like_playlist(content_type: str, url: str) -> bool:
    """Whether what came back is a list of streams to pick from.

    TuneIn answers getMediaURI with ``Tune.ashx``, which serves an M3U of the
    station's stream URLs (measured 2026-09-10, ``audio/x-mpegurl``), and
    plenty of stations are published as .pls to begin with.
    """
    kind = (content_type or "").split(";")[0].strip().lower()
    if kind in _PLAYLIST_TYPES:
        return True
    path = urllib.parse.urlsplit(url or "").path.lower()
    return path.endswith((".m3u", ".m3u8", ".pls", ".xspf", ".asx"))


def hls_is_protected(body: str) -> bool:
    """Whether an HLS manifest is locked to something that can decode it.

    A manifest may name an AES-128 key by URL, which any player can fetch and
    use. Mixcloud instead writes ``URI="data:text/plain,/secure/hls_aes128/…"``
    -- a path where the sixteen key bytes should be (measured 2026-09-10), so
    only a player that knows how the service turns that into a key can decode
    the segments. Sonora does not, and will not work it out: that is the
    service's access control, not a bug.
    """
    for line in (body or "").splitlines():
        if not line.startswith(("#EXT-X-KEY", "#EXT-X-SESSION-KEY")):
            continue
        if "METHOD=NONE" in line:
            continue
        match = re.search(r'URI="([^"]*)"', line)
        if match is None:
            return True
        uri = match.group(1)
        if not uri.startswith("data:"):
            continue        # a real key URL: any player can fetch it
        payload = uri.split(",", 1)[1] if "," in uri else ""
        if len(payload.encode("utf-8", "replace")) != 16:
            return True
    return False


def playlist_streams(body: str) -> dict:
    """Every stream a playlist names, in order.

    ``{"urls", "hls"}``. Order matters: a station's list often opens with a
    pre-roll and puts the live stream after it (iHeartRadio, measured
    2026-09-10), and a speaker plays them in turn, so the page is given the
    same list rather than only its head.

    An HLS manifest is not a list of streams but one stream chopped into
    segments, so it is reported as itself and played with a library.
    """
    text = body or ""
    if "#EXT-X-" in text:
        return {"urls": [], "hls": True}
    found = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # PLS: File1=http://... ; XSPF and ASX carry theirs in attributes.
        if "=" in line and line.split("=", 1)[0].strip().lower().startswith("file"):
            line = line.split("=", 1)[1].strip()
        elif "<location>" in line.lower():
            line = re.sub(r"(?is).*<location>(.*?)</location>.*", r"\1", line).strip()
        elif line.lower().startswith("<ref "):
            match = re.search(r'(?i)href\s*=\s*"([^"]+)"', line)
            line = match.group(1).strip() if match else ""
        if line.lower().startswith(("http://", "https://")) and line not in found:
            found.append(line)
    return {"urls": found, "hls": False}
