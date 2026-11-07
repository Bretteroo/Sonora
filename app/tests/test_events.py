"""Event parsing, including the malformed XML speakers really send."""

from backend.sonos.events import parse_notify

RCS = (
    '<?xml version="1.0"?>'
    '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0"><e:property>'
    "<LastChange>"
    '&lt;Event xmlns="urn:schemas-upnp-org:metadata-1-0/RCS/"&gt;'
    '&lt;InstanceID val="0"&gt;'
    '&lt;Volume channel="Master" val="38"/&gt;'
    '&lt;Volume channel="LF" val="100"/&gt;'
    '&lt;Mute channel="Master" val="0"/&gt;'
    '&lt;Bass val="3"/&gt;'
    "&lt;/InstanceID&gt;&lt;/Event&gt;"
    "</LastChange></e:property></e:propertyset>"
)


def test_channel_values_are_split_out_and_master_promoted():
    event = parse_notify("10.0.0.1", "RenderingControl", RCS, seq=7)
    assert event.seq == 7
    assert event.properties["Volume"] == "38"
    assert event.properties["Bass"] == "3"
    assert event.channels["LF"]["Volume"] == "100"
    assert event.channels["Master"]["Mute"] == "0"


def test_direct_properties_without_lastchange():
    body = (
        '<?xml version="1.0"?>'
        '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">'
        "<e:property><UpdateID>12</UpdateID></e:property>"
        "<e:property><Curated>0</Curated></e:property>"
        "</e:propertyset>"
    )
    event = parse_notify("10.0.0.1", "Queue", body)
    assert event.properties == {"UpdateID": "12", "Curated": "0"}


def test_bare_ampersand_in_a_track_title_is_repaired():
    body = (
        '<?xml version="1.0"?>'
        '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0"><e:property>'
        "<LastChange>"
        '&lt;Event xmlns="urn:schemas-upnp-org:metadata-1-0/AVT/"&gt;'
        '&lt;InstanceID val="0"&gt;'
        '&lt;CurrentTrackURI val="x-sonos-http:t?sid=12&amp;sn=9"/&gt;'
        "&lt;/InstanceID&gt;&lt;/Event&gt;"
        "</LastChange></e:property></e:propertyset>"
    )
    event = parse_notify("10.0.0.1", "AVTransport", body)
    assert event.properties["CurrentTrackURI"] == "x-sonos-http:t?sid=12&sn=9"


def test_lastchange_never_leaks_as_an_empty_property():
    event = parse_notify("10.0.0.1", "AVTransport", RCS)
    assert "LastChange" not in event.properties


def test_filename_titles_are_cleaned_and_identifiers_dropped():
    from backend.sonos.didl import clean_title

    assert clean_title("Voices Carry") == "Voices Carry"
    assert clean_title("RINCON_542A1B0000B201400.mp3") == ""
    assert clean_title("6d92e3c132f50077da22052fcb324767.mp3?authSig=abc") == ""
    assert clean_title("Sealed%20With%20A%20Kiss.flac") == "Sealed With A Kiss"
    # A real title containing a question mark must survive untouched.
    assert clean_title("Where Did You Sleep Last Night?") == (
        "Where Did You Sleep Last Night?")


def test_uri_schemes_cover_third_party_lan_servers():
    from backend.sonos.models import TransportState

    cases = {
        "http://192.168.0.101:8097/x.flac": "http_stream",
        "x-sonos-spotify:spotify:track:abc?sid=12": "service_track",
        "x-rincon-mp3radio://http://host/stream": "radio",
        "x-sonos-vli:RINCON_1:2,spotify:xyz": "external_session",
        "x-rincon-queue:RINCON_1#0": "queue",
        "": "idle",
    }
    for uri, expected in cases.items():
        assert TransportState(track_uri=uri).source == expected, uri


def test_home_theater_is_detected_but_input_not_guessed():
    from backend.sonos.models import TransportState

    tv = TransportState(track_uri="x-sonos-htastream:RINCON_1:spdif")
    assert tv.is_home_theater and tv.source == "tv"
    # The :spdif URI token is fixed and must never become a displayed label:
    # an HDMI bar reports the same token, so a guess would be wrong.
    assert not hasattr(tv, "tv_input")
    assert not TransportState(track_uri="x-rincon-queue:RINCON_1#0").is_home_theater


GOOLARRI_TRACK = (
    '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
    'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
    'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
    '<item id="-1" parentID="-1" restricted="true">'
    '<res protocolInfo="x-rincon-mp3radio:*:*:*">'
    "x-rincon-mp3radio://https://firstnationsmedia.stream/8012/stream</res>"
    "<r:streamContent></r:streamContent><dc:title>stream</dc:title>"
    "<upnp:class>object.item</upnp:class></item></DIDL-Lite>"
)


def test_a_broadcast_titled_from_its_own_url_keeps_no_title():
    """Radio Goolarri (Community Radio Plus) as the speaker really reports it.

    The player names the track after the stream URL's last segment, so the
    DIDL reads <dc:title>stream</dc:title>. The room card must go on reading
    "Radio - Radio Goolarri" from the container, as the app's does.
    """
    from backend.sonos.controller import SonosController
    from backend.sonos.models import TransportState

    transport = TransportState(
        media_uri="x-sonosapi-stream:cbaa_svc_6GME?sid=330&flags=40&sn=10",
        track_uri="x-rincon-mp3radio://https://firstnationsmedia.stream/8012/stream",
        container_title="Radio Goolarri",
    )
    SonosController._apply_track_metadata(transport, GOOLARRI_TRACK)
    # The station's own name, which is what an event brings too.
    assert transport.title == "Radio Goolarri"


def test_a_stream_id_is_no_title():
    """Sonos Radio's BBC Radio 1 titles its track "bbc_radio_one", and the
    room's title flipped between that and the station's name."""
    from backend.sonos.controller import SonosController
    from backend.sonos.models import TransportState

    didl = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="-1"><dc:title>bbc_radio_one</dc:title></item></DIDL-Lite>'
    )
    transport = TransportState(
        media_uri="x-sonosapi-stream:tunein%3A9496?sid=303&flags=8224&sn=16",
        track_uri="x-sonosapi-hls:bbc_radio_one?sid=303",
        container_title="BBC Radio 1",
    )
    SonosController._apply_track_metadata(transport, didl)
    assert transport.title == "BBC Radio 1"


def test_a_real_song_on_a_station_survives():
    """The same scrub must not touch a station that names its track."""
    from backend.sonos.controller import SonosController
    from backend.sonos.models import TransportState

    didl = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="-1"><dc:title>Unitary</dc:title></item></DIDL-Lite>'
    )
    transport = TransportState(
        media_uri="x-sonosapi-stream:synphaera?sid=516&flags=8232&sn=5",
        track_uri="x-rincon-mp3radio://https://ice.somafm.com/synphaera",
        container_title="Synphaera Radio",
    )
    SonosController._apply_track_metadata(transport, didl)
    assert transport.title == "Unitary"


def test_a_position_carries_how_old_it_is():
    """RelTime is not evented, so a client has to know how stale it is.

    Without the age, a browser rendering a minute after the last reading
    starts its own clock from that reading and stays behind for the rest of
    the track (measured at a constant 29 seconds on 2026-09-14).
    """
    from time import monotonic

    from backend.sonos.controller import ZoneState
    from backend.sonos.models import TransportState

    state = ZoneState(uuid="RINCON_1", name="Spare Room", host="10.0.0.1")
    state.transport = TransportState(
        state="PLAYING", rel_time="0:00:30",
        position_read_at=monotonic() - 12.0)
    age = state.as_dict()["transport"]["position_age"]
    assert 11.5 <= age <= 12.5

    # A position never read reports no age rather than the whole uptime.
    state.transport.position_read_at = 0.0
    assert state.as_dict()["transport"]["position_age"] == 0.0


# -- the callback address -----------------------------------------------------

ROUTES = (
    "Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT\n"
    "eth0\t00000000\t0141A8C0\t0003\t0\t0\t0\t00000000\t0\t0\t0\n"   # default via 192.168.65.1
    "eth0\t0041A8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0\n"   # 192.168.65.0/24
)


def test_a_speaker_reached_only_through_a_gateway_is_off_link(tmp_path):
    from backend.sonos.events import on_own_link
    table = tmp_path / "route"
    table.write_text(ROUTES)
    assert not on_own_link("192.168.1.138", table)
    assert on_own_link("192.168.65.20", table)
    # No table to read (not Linux): keep the plain choice.
    assert on_own_link("192.168.1.138", tmp_path / "missing")


async def test_the_sweep_finds_the_address_that_reaches_this_listener():
    import aiohttp
    from backend.sonos.events import EventListener
    async with aiohttp.ClientSession() as session:
        listener = EventListener(session, port=0)
        await listener.start()
        try:
            # Every 127.0.0.x reaches a listener on all interfaces.
            found = await listener._find_own_address("127.0.0.9")
        finally:
            await listener.stop()
    assert found is not None and found.startswith("127.0.0.")


# -- an address that stops reaching Sonora ------------------------------------

DEAD = "192.0.2.1"  # TEST-NET-1: never answers


async def listener_with_subscriptions(monkeypatch, callback, found):
    """A started listener whose speakers were given ``callback``, with three
    subscriptions on two speakers, and whose search for its address finds
    ``found``. Subscribing records what was asked instead of reaching out."""
    import aiohttp
    from backend.sonos import events
    from backend.sonos.const import AV_TRANSPORT, RENDERING_CONTROL
    session = aiohttp.ClientSession()
    listener = events.EventListener(session, port=0)
    await listener.start()
    listener.CALLBACK_ANSWER_S = 0.3
    listener._callback_ip = callback
    for host, service in (("127.0.0.3", AV_TRANSPORT), ("127.0.0.3", RENDERING_CONTROL), ("127.0.0.4", AV_TRANSPORT)):
        listener._subs[(host, service.name)] = events._Subscription(host=host, service=service, sid="uuid:old", timeout=600)
    asked = []

    async def subscribe(host, service, *, why=None):
        asked.append((host, service.name, listener._callback_ip))
        listener._subs[(host, service.name)] = events._Subscription(host=host, service=service, sid="uuid:new", timeout=600)
        return True

    async def search(host):
        return found

    monkeypatch.setattr(listener, "subscribe", subscribe)
    monkeypatch.setattr(listener, "_callback_address", search)
    return listener, session, asked


async def test_a_changed_address_moves_every_subscription(monkeypatch):
    # The speakers were given an address that no longer answers; the one that
    # does now is found and every subscription is taken out again naming it.
    listener, session, asked = await listener_with_subscriptions(monkeypatch, DEAD, "127.0.0.1")
    try:
        assert await listener._check_callback("127.0.0.3") is True
    finally:
        await listener.stop()
        await session.close()
    assert listener._callback_ip == "127.0.0.1"
    assert sorted(asked) == [("127.0.0.3", "AVTransport", "127.0.0.1"), ("127.0.0.3", "RenderingControl", "127.0.0.1"),
                             ("127.0.0.4", "AVTransport", "127.0.0.1")]


async def test_an_address_that_still_answers_moves_nothing(monkeypatch):
    listener, session, asked = await listener_with_subscriptions(monkeypatch, "127.0.0.1", "127.0.0.2")
    try:
        assert await listener._check_callback("127.0.0.3") is False
    finally:
        await listener.stop()
        await session.close()
    assert listener._callback_ip == "127.0.0.1" and asked == []


async def test_no_move_to_an_address_that_does_not_answer_either(monkeypatch):
    listener, session, asked = await listener_with_subscriptions(monkeypatch, DEAD, "192.0.2.2")
    try:
        assert await listener._check_callback("127.0.0.3") is False
    finally:
        await listener.stop()
        await session.close()
    assert listener._callback_ip == DEAD and asked == []


async def test_a_refused_renewal_after_the_address_moved_subscribes_once(monkeypatch):
    # Every speaker refuses its renewals at about the same time; the first
    # refusal moves them all, and the rest find theirs already taken out again.
    listener, session, asked = await listener_with_subscriptions(monkeypatch, DEAD, "127.0.0.1")
    refused = list(listener._subs.values())
    try:
        import asyncio
        await asyncio.gather(*(listener._resubscribe(sub) for sub in refused))
    finally:
        await listener.stop()
        await session.close()
    assert len(asked) == 3 and {ip for *_, ip in asked} == {"127.0.0.1"}


async def test_a_refused_renewal_with_a_good_address_subscribes_again(monkeypatch):
    # A speaker that rebooted forgot us; the address is fine, so only that
    # subscription is taken out again.
    listener, session, asked = await listener_with_subscriptions(monkeypatch, "127.0.0.1", "127.0.0.2")
    sub = listener._subs[("127.0.0.4", "AVTransport")]
    try:
        await listener._resubscribe(sub)
    finally:
        await listener.stop()
        await session.close()
    assert asked == [("127.0.0.4", "AVTransport", "127.0.0.1")]


# -- a subscription that lapses while the network is down ---------------------

async def test_a_resubscribe_that_fails_is_left_for_the_sweep(monkeypatch):
    # The renewal failed and so did the try after it (a router updating):
    # the subscription is dropped from the live ones, still wanted, and the
    # sweep takes it out again once the speaker answers.
    listener, session, asked = await listener_with_subscriptions(monkeypatch, "127.0.0.1", "127.0.0.2")
    sub = listener._subs[("127.0.0.4", "AVTransport")]
    listener._wanted[("127.0.0.4", "AVTransport")] = sub.service
    down = True

    async def subscribe(host, service, *, why=None):
        asked.append((host, service.name))
        if down:
            return False
        listener._subs[(host, service.name)] = sub
        return True

    async def subscribe_many(host, services):
        return {s.name: await subscribe(host, s) for s in services}

    monkeypatch.setattr(listener, "subscribe", subscribe)
    monkeypatch.setattr(listener, "subscribe_many", subscribe_many)
    try:
        await listener._resubscribe(sub)
        assert ("127.0.0.4", "AVTransport") not in listener._subs
        down = False
        await listener._restore_missing()
    finally:
        await listener.stop()
        await session.close()
    assert asked == [("127.0.0.4", "AVTransport"), ("127.0.0.4", "AVTransport")]


async def test_a_failed_address_check_does_not_stop_the_resubscribe(monkeypatch):
    # With the network down the address check itself raises; that once ended
    # the retry before it subscribed at all.
    listener, session, asked = await listener_with_subscriptions(monkeypatch, "127.0.0.1", "127.0.0.2")

    async def unreachable(host):
        raise OSError(101, "Network is unreachable")

    monkeypatch.setattr(listener, "_check_callback", unreachable)
    try:
        await listener._resubscribe(listener._subs[("127.0.0.4", "AVTransport")])
    finally:
        await listener.stop()
        await session.close()
    assert asked == [("127.0.0.4", "AVTransport", "127.0.0.1")]


async def test_the_sweep_leaves_live_subscriptions_and_players_given_up():
    import aiohttp
    from backend.sonos import events
    from backend.sonos.const import AV_TRANSPORT
    session = aiohttp.ClientSession()
    listener = events.EventListener(session, port=0)
    asked = []

    async def subscribe_many(host, services):
        asked.append(host)
        return {}

    listener.subscribe_many = subscribe_many
    for host in ("127.0.0.3", "127.0.0.4", "127.0.0.5"):
        listener._wanted[(host, AV_TRANSPORT.name)] = AV_TRANSPORT
    listener._subs[("127.0.0.3", AV_TRANSPORT.name)] = events._Subscription(
        host="127.0.0.3", service=AV_TRANSPORT, sid="uuid:live", timeout=600)
    listener.retain({"127.0.0.3", "127.0.0.4"})
    try:
        await listener._restore_missing()
    finally:
        await session.close()
    assert asked == ["127.0.0.4"]


def test_the_network_coming_back_is_a_change(monkeypatch):
    # A router restarting for an update: no route, then the same one back.
    from backend.sonos import events
    listener = events.EventListener.__new__(events.EventListener)
    listener._route = events._UNCHECKED
    routes = iter(["192.168.1.20", OSError(101, "Network is unreachable"), "192.168.1.20",
                   "192.168.1.20", "10.0.0.5"])

    def route(host):
        value = next(routes)
        if isinstance(value, Exception):
            raise value
        return value

    monkeypatch.setattr(events, "local_ip_for", route)
    seen = [listener._network_changed("192.168.1.165") for _ in range(5)]
    # First check, outage, back, unchanged, another network.
    assert seen == [False, False, True, False, True]


async def test_a_gone_renewal_is_left_for_the_sweep(monkeypatch):
    listener, session, asked = await listener_with_subscriptions(monkeypatch, "127.0.0.1", "127.0.0.2")
    sub = listener._subs[("127.0.0.4", "AVTransport")]
    sub.timeout = 0

    class Gone:
        status, headers = 410, {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

    from backend.sonos import events
    monkeypatch.setattr(listener._session, "request", lambda *a, **k: Gone())

    async def no_wait(_):
        return None

    monkeypatch.setattr(events.asyncio, "sleep", no_wait)
    try:
        await listener._renew_loop(sub)
    finally:
        monkeypatch.undo()
        await listener.stop()
        await session.close()
    assert ("127.0.0.4", "AVTransport") not in listener._subs and asked == []


async def test_a_network_change_takes_out_every_subscription_again(monkeypatch):
    import asyncio
    listener, session, asked = await listener_with_subscriptions(monkeypatch, "127.0.0.1", "127.0.0.2")
    listener.NETWORK_CHECK_S = 0.01
    changes = iter([True])
    monkeypatch.setattr(listener, "_network_changed", lambda host: next(changes, False))

    async def still_reaches(host):
        return False

    monkeypatch.setattr(listener, "_check_callback", still_reaches)
    try:
        watch = asyncio.create_task(listener._watch_network())
        await asyncio.sleep(0.2)
        watch.cancel()
    finally:
        await listener.stop()
        await session.close()
    assert sorted(asked) == [("127.0.0.3", "AVTransport", "127.0.0.1"), ("127.0.0.3", "RenderingControl", "127.0.0.1"),
                             ("127.0.0.4", "AVTransport", "127.0.0.1")]


def test_a_subscription_is_asked_for_an_hour_and_renewed_at_the_half():
    # As the S1 Windows app keeps its own.
    from backend.sonos import events
    assert events.SUBSCRIPTION_SECONDS == 3600
    assert max(30, 3600 * events.RENEW_AT) == 1800
