"""A podcast episode's show, asked of the service once per track.

The speaker reports an episode with no artist; the apps' compact lines name
its show ("How surveillance crept up on us" over "Planet Money"). The show is
fetched once per track and kept, and every later reading of the track takes it.
"""

import asyncio
from types import SimpleNamespace

from backend.sonos import controller as module
from backend.sonos.controller import SonosController
from backend.sonos.models import TransportState

URI = "x-sonos-http:ep-1.mp3?sid=233&flags=8232&sn=1"
EPISODE = (
    '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
    'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
    '<item id="-1" parentID="-1" restricted="true">'
    "<dc:title>How surveillance crept up on us</dc:title>"
    "<upnp:class>object.item.audioItem.podcast</upnp:class></item></DIDL-Lite>"
)


def _controller(show):
    ctl = SonosController.__new__(SonosController)
    ctl.podcast_show = show
    ctl._podcast_asked = set()
    ctl.published = []

    async def publish(state):
        ctl.published.append(state.transport.artist)
    ctl._publish_zone = publish
    return ctl


def test_a_known_show_is_the_episodes_artist(monkeypatch):
    monkeypatch.setattr(module, "PODCAST_SHOWS", {URI: "Planet Money"})
    transport = TransportState(track_uri=URI)
    SonosController._apply_track_metadata(transport, EPISODE)
    assert transport.track_kind == "podcast"
    assert transport.artist == "Planet Money"


def test_the_show_is_asked_for_once_and_published(monkeypatch):
    monkeypatch.setattr(module, "PODCAST_SHOWS", {})
    asked = []

    async def show(uuid):
        asked.append(uuid)
        return "Planet Money"

    async def run():
        ctl = _controller(show)
        state = SimpleNamespace(uuid="RINCON_A", transport=TransportState(track_uri=URI, track_kind="podcast"))
        ctl._want_podcast_show(state)
        ctl._want_podcast_show(state)        # a second update before the answer asks nothing more
        await asyncio.sleep(0.01)
        ctl._want_podcast_show(state)        # nor one after it
        return ctl, state

    ctl, state = asyncio.run(run())
    assert asked == ["RINCON_A"]
    assert state.transport.artist == "Planet Money"
    assert ctl.published == ["Planet Money"]
    assert module.PODCAST_SHOWS[URI] == "Planet Money"


def test_only_an_episode_with_no_artist_is_asked_about(monkeypatch):
    monkeypatch.setattr(module, "PODCAST_SHOWS", {})
    asked = []

    async def show(uuid):
        asked.append(uuid)
        return "x"

    async def run():
        ctl = _controller(show)
        for tr in (TransportState(track_uri=URI, track_kind="podcast", artist="Someone"),
                   # a library song: no service
                   TransportState(track_uri="x-file-cifs://nas/song.mp3", media_uri="x-rincon-queue:RINCON_B#0", track_kind="item"),
                   # a station: not a track of a service's
                   TransportState(track_uri="x-sonosapi-stream:s1?sid=254", media_uri="x-sonosapi-stream:s1?sid=254", service_id=254),
                   TransportState(track_uri="", track_kind="podcast")):
            ctl._want_podcast_show(SimpleNamespace(uuid="RINCON_B", transport=tr))
        await asyncio.sleep(0.01)

    asyncio.run(run())
    assert asked == []


def test_an_episode_the_speaker_does_not_class_is_asked_about_too(monkeypatch):
    """While it plays, a Pocket Casts episode's class is plain object.item."""
    monkeypatch.setattr(module, "PODCAST_SHOWS", {})
    asked = []

    async def show(uuid):
        asked.append(uuid)
        return "Planet Money"

    async def run():
        ctl = _controller(show)
        state = SimpleNamespace(uuid="RINCON_D", transport=TransportState(
            track_uri=URI, track_kind="item", media_uri="x-rincon-queue:RINCON_D#0", service_id=233))
        ctl._want_podcast_show(state)
        await asyncio.sleep(0.01)
        return state

    state = asyncio.run(run())
    assert asked == ["RINCON_D"]
    assert state.transport.artist == "Planet Money"


def test_a_failed_ask_is_not_repeated(monkeypatch):
    monkeypatch.setattr(module, "PODCAST_SHOWS", {})
    asked = []

    async def show(uuid):
        asked.append(uuid)
        raise RuntimeError("service down")

    async def run():
        ctl = _controller(show)
        state = SimpleNamespace(uuid="RINCON_C", transport=TransportState(track_uri=URI, track_kind="podcast"))
        ctl._want_podcast_show(state)
        await asyncio.sleep(0.01)
        ctl._want_podcast_show(state)
        await asyncio.sleep(0.01)
        return state

    state = asyncio.run(run())
    assert asked == ["RINCON_C"]
    assert state.transport.artist == ""
