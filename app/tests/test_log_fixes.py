"""Fixes from an error log.

* A room played a Spotify Connect session's cloud queue
  (``x-rincon-queue:...#vli``); every theme offered Crossfade because the
  source reads as a queue, and the speaker refused SetCrossfadeMode with UPnP
  712, three times in a morning.
* A phone that left before ``/api/services`` answered traced a whole
  middleware stack as a 500.
* A room played a Sonos Radio station whose tracks carry one-off ids, and the
  art lookup faulted at Sonos on every track change.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from backend import origin
from backend.sonos.models import TransportState
from backend.sonos.smapi import SmapiError


def test_a_connect_queue_takes_no_crossfade():
    queue = TransportState(media_uri="x-rincon-queue:RINCON_X#0",
                           track_uri="x-file-cifs://nas/a.mp3")
    connect = TransportState(media_uri="x-rincon-queue:RINCON_X#vli",
                             track_uri="x-sonos-spotify:spotify:track:1?sid=12")
    airplay = TransportState(track_uri="x-sonos-vli:RINCON_X:1,airplay:1")
    assert queue.can_crossfade is True
    assert connect.source == "queue" and connect.can_crossfade is False
    assert airplay.can_crossfade is False


def test_the_speaker_says_where_crossfade_goes():
    """Measured 2026-10-02 by changing crossfade on every room and putting it
    back: what each speaker announced, and what it then did."""
    def playing(modes, media="x-sonosapi-stream:s1?sid=254", track="hls-radio://x"):
        return TransportState(media_uri=media, track_uri=track, valid_play_modes=modes)
    assert playing("SHUFFLE,REPEAT,REPEATONE,CROSSFADE", "x-rincon-queue:R#0").can_crossfade   # Mixcloud
    assert playing("CROSSFADE", "x-sonosapi-radio:channel%3a5a?sid=192", "").can_crossfade      # AccuRadio
    assert not playing("").can_crossfade                                                       # TuneIn
    # A Libby audiobook reads as a service's track, which the old list offered.
    assert not playing("", "x-rincon-cpcontainer:1013606caudiobook", "x-sonos-http:part%3a1").can_crossfade


def test_a_refusal_stands_until_the_source_changes():
    station = "x-sonosapi-radio:sonos%3A3009?sid=303&flags=8300&sn=16"   # Sonos Radio
    tr = TransportState(media_uri=station, valid_play_modes="CROSSFADE",
                        crossfade_refused_uri=station)
    assert tr.can_crossfade is False
    tr.media_uri = "x-sonosapi-radio:channel%3a5a?sid=192"
    assert tr.can_crossfade is True


def test_a_reader_who_left_gets_no_500():
    class Request:
        headers = {"host": "127.0.0.1:50205"}
        method = "GET"

        async def is_disconnected(self):
            return True

    async def gone(_request):
        raise RuntimeError("No response returned.")

    response = asyncio.run(origin.guard(Request(), gone))
    assert response.status_code == 499


def test_a_station_that_faulted_is_not_asked_again(monkeypatch):
    from backend.sonos import controller as module

    calls = []

    async def fault(**_kw):
        calls.append(1)
        raise SmapiError("Sonos Radio", "InternalServerError", "partnerId is null")

    service = SimpleNamespace(auth="Anonymous", endpoint="https://x", name="Sonos Radio")
    station = "x-sonosapi-radio:sonos%3A3009?sid=303&flags=8300&sn=16"
    ctl = module.SonosController.__new__(module.SonosController)
    ctl._art_faults = {}
    ctl.household_of = lambda _uuid: SimpleNamespace(id="H")
    ctl.credentials_for = lambda *a, **k: {}
    ctl.smapi = SimpleNamespace(get_media_metadata=fault)

    async def by_id(_h, _sid):
        return service

    async def serial(_h):
        return "S"
    ctl._service_by_id = by_id
    ctl.device_serial = serial

    def play(n):
        uri = f"x-sonos-http:sonos%3atrack{n}%3adzrs.trk.{n}%3aSD.mp4?sid=303"
        state = SimpleNamespace(uuid="Z", name="Workshop", transport=SimpleNamespace(
            service_id=303, media_uri=station, track_uri=uri))
        asyncio.run(ctl._resolve_provider_art(state, uri))

    play(1)
    play(2)
    play(3)
    assert len(calls) == 1


def test_shuffle_and_repeat_go_where_the_speaker_says():
    """Measured the same day: only a queue (Plex, Mixcloud) took shuffle,
    repeat or repeat-one, and only a queue announced them."""
    plex = TransportState(media_uri="x-rincon-queue:R#0", track_uri="x-sonos-http:library%2fparts%2f1.mp3?sid=212",
                          valid_play_modes="SHUFFLE,REPEAT,REPEATONE,CROSSFADE")
    accuradio = TransportState(media_uri="x-sonosapi-radio:channel%3a5a?sid=192", valid_play_modes="CROSSFADE")
    assert (plex.can_shuffle, plex.can_repeat, plex.can_repeat_one) == (True, True, True)
    assert (accuradio.can_shuffle, accuradio.can_repeat, accuradio.can_repeat_one) == (False, False, False)
    # Before the speaker has said: a queue, and nothing else.
    assert TransportState(media_uri="x-rincon-queue:R#0").can_shuffle is True
    assert TransportState(media_uri="x-sonosapi-stream:s1?sid=254").can_repeat is False


def test_a_grouped_room_answers_with_its_coordinators_word():
    """The phone pressed Crossfade on a room grouped under one playing a
    Sonos Radio station; the member's own event said CROSSFADE, the
    coordinator refused it."""
    from backend.sonos import controller as module

    station = "x-sonosapi-radio:sonos%3A3009?sid=303&flags=8300&sn=16"
    lead = SimpleNamespace(uuid="OFFICE", is_coordinator=True, transport=TransportState(
        media_uri=station, valid_play_modes="CROSSFADE", crossfade_refused_uri=station))
    member = SimpleNamespace(uuid="TESTING", is_coordinator=False, transport=TransportState(
        media_uri="x-rincon:OFFICE", valid_play_modes="CROSSFADE"))
    member.as_dict = lambda _names=None: {"transport": {"can_crossfade": member.transport.can_crossfade,
                                                         "can_shuffle": True, "can_repeat": True,
                                                         "can_repeat_one": True}}
    ctl = module.SonosController.__new__(module.SonosController)
    ctl._service_names = {}
    ctl.coordinator_of = lambda uuid: lead
    out = ctl._zone_payload(member)["transport"]
    assert out == {"can_crossfade": False, "can_shuffle": False, "can_repeat": False, "can_repeat_one": False}


def test_balance_is_offered_where_the_apps_offer_it():
    """Measured in the Mac app: a pair, a Play:5, a Connect and a
    Connect:Amp show Balance; a single Play:1 does not."""
    from backend.sonos.controller import has_balance
    assert has_balance(True, "S1")
    assert has_balance(False, "S5") and has_balance(False, "S15") and has_balance(False, "ZP120")
    assert not has_balance(False, "S1") and not has_balance(False, "S12")
