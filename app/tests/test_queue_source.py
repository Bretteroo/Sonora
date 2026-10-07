"""Save Queue's suggested name: the one album or playlist the queue holds.

The Windows app offers "Hamilton (Original Broadway Cast Recording)" for a
queue made of that album, "Chill Tracks" for that playlist alone, and
"Tuesday Night Mix" once a second source is added (2026-09-29). The speaker
goes on naming the first container after an add, so Sonora keeps the queue's
length from when the container arrived and compares.
"""

from types import SimpleNamespace

from backend.sonos.controller import note_queue_source


def _room():
    state = SimpleNamespace(enqueued_uri="", enqueued_length=-1, enqueued_seen=False, queue_emptied=False)
    transport = SimpleNamespace(queue_length=0, container_title="", queue_source="")
    return state, transport


def _event(state, transport, *, uri=None, length=None, title=None):
    if length is not None:
        transport.queue_length = length
    if title is not None:
        transport.container_title = title
    props = {} if uri is None else {"EnqueuedTransportURI": uri}
    note_queue_source(state, transport, props)
    return transport.queue_source


def test_an_album_queued_alone_is_offered_by_name():
    state, tr = _room()
    _event(state, tr, uri="", length=0)                       # start-up: empty queue
    assert _event(state, tr, uri="x-rincon-cpcontainer:hamilton", length=46,
                  title="Hamilton (Original Broadway Cast Recording)") == "Hamilton (Original Broadway Cast Recording)"


def test_a_second_source_makes_it_a_mix():
    state, tr = _room()
    _event(state, tr, uri="", length=0)
    _event(state, tr, uri="x-rincon-cpcontainer:chill", length=100, title="Chill Tracks")
    # Adding to a queue that is not empty leaves the enqueued URI as it was.
    assert _event(state, tr, length=146) == ""


def test_the_first_report_after_start_up_proves_nothing():
    state, tr = _room()
    assert _event(state, tr, uri="x-rincon-cpcontainer:chill", length=146, title="Chill Tracks") == ""


def test_the_same_container_after_a_clear_counts_again():
    state, tr = _room()
    _event(state, tr, uri="x-rincon-cpcontainer:chill", length=146, title="Chill Tracks")
    _event(state, tr, length=0)                               # Clear Queue
    assert _event(state, tr, uri="x-rincon-cpcontainer:chill", length=100) == "Chill Tracks"


def test_the_queue_names_the_library_list_it_came_from():
    state, tr = _room()
    _event(state, tr, uri="x-rincon-playlist:RINCON_38420B0000F601400#A:TRACKS", length=50)
    assert tr.queue_container == "A:TRACKS"
    _event(state, tr, uri="x-rincon-cpcontainer:1006206cplaylist%3a123", length=12)
    assert tr.queue_container == ""


def test_a_service_playlist_is_named_with_its_service():
    from backend.sonos.controller import _enqueued_container
    meta = ('&lt;DIDL-Lite&gt;&lt;item id="1006206cspotify%3aplaylist%3a7mSU4UjDYfRfK5IkSO4ZzE" '
            'parentID="x"&gt;&lt;dc:title&gt;90s TRIP HOP&lt;/dc:title&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;')
    uri = "x-rincon-cpcontainer:1006206cspotify%3aplaylist%3a7mSU4UjDYfRfK5IkSO4ZzE?sid=12&flags=8300&sn=4"
    assert _enqueued_container(uri, meta) == ("spotify:playlist:7mSU4UjDYfRfK5IkSO4ZzE", 12)
    assert _enqueued_container("x-rincon-playlist:RINCON_1#A:TRACKS", "") == ("A:TRACKS", None)
    assert _enqueued_container("x-sonosapi-stream:s34635?sid=254", "") == ("", None)
