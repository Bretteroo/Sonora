"""Service definitions and endpoint paths for Sonos ZonePlayers.

Every constant here was read off the devices themselves, from each
service's SCPD document at the address its device description gives. Both the
S1 (57.x) and S2 (80.x and later) firmware trains publish the same core set;
differences are noted inline.
"""

from __future__ import annotations

from dataclasses import dataclass

#: Every ZonePlayer serves its control endpoints and diagnostic pages here.
SONOS_PORT = 1400
#: The same control endpoints over TLS. The desktop app puts a request
#: carrying a share's password here rather than on 1400.
SONOS_TLS_PORT = 1443

#: Sonora's own key for the api-key header the apps send on every control
#: call. Not an app's key: the question is whether the firmware wants the
#: header, not whose it is. It is shaped as a UUID because the apps' keys
#: are, and a firmware that validates the shape would refuse a plain word
#: (the first attempt, "sonora-web-controller", was refused along with
#: everything else, which proves nothing either way). The household
#: settings route (see hhsettings.py) accepts it as-is.
SONORA_API_KEY = "b0f0b2a4-6a8f-4a4e-9c1e-3d5a7c2f91d3"  # gitleaks:allow (a made-up public value, see above)

SSDP_ADDR = "239.255.255.250"
SSDP_PORT = 1900
SSDP_TARGET = "urn:schemas-upnp-org:device:ZonePlayer:1"

SOAP_ENVELOPE = (
    '<?xml version="1.0"?>'
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"'
    ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
    "<s:Body>{body}</s:Body></s:Envelope>"
)

NS = {
    "s": "http://schemas.xmlsoap.org/soap/envelope/",
    "didl": "urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "upnp": "urn:schemas-upnp-org:metadata-1-0/upnp/",
    "r": "urn:schemas-rinconnetworks-com:metadata-1-0/",
    "e": "urn:schemas-upnp-org:event-1-0",
    "device": "urn:schemas-upnp-org:device-1-0",
    "scpd": "urn:schemas-upnp-org:service-1-0",
}


@dataclass(frozen=True)
class Service:
    """A UPnP service as advertised in the device description."""

    name: str
    type: str
    control: str
    event: str
    scpd: str

    def soap_action(self, action: str) -> str:
        return f'"{self.type}#{action}"'


def _upnp(name: str, base: str, version: int = 1) -> Service:
    return Service(
        name=name,
        type=f"urn:schemas-upnp-org:service:{name}:{version}",
        control=f"{base}/Control",
        event=f"{base}/Event",
        scpd=f"{base}/Scpd.xml",
    )


# --- Device-scoped services (root device, port 1400) --------------------------

ALARM_CLOCK = _upnp("AlarmClock", "/AlarmClock")
DEVICE_PROPERTIES = _upnp("DeviceProperties", "/DeviceProperties")
GROUP_MANAGEMENT = _upnp("GroupManagement", "/GroupManagement")
MUSIC_SERVICES = _upnp("MusicServices", "/MusicServices")
SYSTEM_PROPERTIES = _upnp("SystemProperties", "/SystemProperties")
ZONE_GROUP_TOPOLOGY = _upnp("ZoneGroupTopology", "/ZoneGroupTopology")

#: S1-only. Line-in capable units (Connect, Connect:Amp, Play:5, Five).
AUDIO_IN = _upnp("AudioIn", "/AudioIn")

#: S2-only. Soundbar HDMI/CEC and remote control handling.
HT_CONTROL = _upnp("HTControl", "/HTControl")

# --- MediaRenderer services --------------------------------------------------

AV_TRANSPORT = _upnp("AVTransport", "/MediaRenderer/AVTransport")
RENDERING_CONTROL = _upnp("RenderingControl", "/MediaRenderer/RenderingControl")
GROUP_RENDERING_CONTROL = _upnp(
    "GroupRenderingControl", "/MediaRenderer/GroupRenderingControl"
)
CONNECTION_MANAGER = _upnp("ConnectionManager", "/MediaRenderer/ConnectionManager")
VIRTUAL_LINE_IN = _upnp("VirtualLineIn", "/MediaRenderer/VirtualLineIn")

# --- MediaServer services ----------------------------------------------------

CONTENT_DIRECTORY = _upnp("ContentDirectory", "/MediaServer/ContentDirectory")

#: Sonos' own queue service, not a standard UPnP one.
QUEUE = Service(
    name="Queue",
    type="urn:schemas-sonos-com:service:Queue:1",
    control="/MediaRenderer/Queue/Control",
    event="/MediaRenderer/Queue/Event",
    scpd="/MediaRenderer/Queue/Scpd.xml",
)

ALL_SERVICES: tuple[Service, ...] = (
    ALARM_CLOCK,
    AUDIO_IN,
    AV_TRANSPORT,
    CONNECTION_MANAGER,
    CONTENT_DIRECTORY,
    DEVICE_PROPERTIES,
    GROUP_MANAGEMENT,
    GROUP_RENDERING_CONTROL,
    HT_CONTROL,
    MUSIC_SERVICES,
    QUEUE,
    RENDERING_CONTROL,
    SYSTEM_PROPERTIES,
    VIRTUAL_LINE_IN,
    ZONE_GROUP_TOPOLOGY,
)

SERVICES_BY_NAME = {s.name: s for s in ALL_SERVICES}

# --- Well-known ContentDirectory object IDs ----------------------------------
#
# Sonos overlays its own hierarchy on the standard UPnP browse tree. These
# prefixes were confirmed against a live household.

BROWSE_ROOTS = {
    "artists": "A:ARTIST",
    "album_artists": "A:ALBUMARTIST",
    "albums": "A:ALBUM",
    "genres": "A:GENRE",
    "composers": "A:COMPOSER",
    "tracks": "A:TRACKS",
    "playlists": "A:PLAYLISTS",
    "imported_playlists": "A:PLAYLISTS",
    "library_root": "A:",
    "shares": "S:",
    "sonos_playlists": "SQ:",
    "sonos_favorites": "FV:2",
    "radio_stations": "R:0/0",
    "radio_shows": "R:0/1",
    "queue": "Q:0",
    "line_in": "AI:",
    "music_services": "SA:",
}

# --- Rendering control ranges ------------------------------------------------

VOLUME_RANGE = (0, 100)
BASS_RANGE = (-10, 10)
TREBLE_RANGE = (-10, 10)
BALANCE_RANGE = (-100, 100)

PLAY_MODES = (
    "NORMAL",
    "REPEAT_ALL",
    "REPEAT_ONE",
    "SHUFFLE_NOREPEAT",
    "SHUFFLE",
    "SHUFFLE_REPEAT_ONE",
)

TRANSPORT_STATES = (
    "STOPPED",
    "PLAYING",
    "PAUSED_PLAYBACK",
    "TRANSITIONING",
)

# --- Source URI schemes ------------------------------------------------------
#
# The transport URI tells you what a speaker is actually doing. Observed on a
# live system: x-sonos-vli marks a Spotify Connect or AirPlay session pushed to
# the speaker by an external app, which a controller can steer but not start.

URI_SCHEMES = {
    "x-rincon-queue": "queue",
    "x-rincon": "grouped",  # slave following a coordinator
    "x-rincon-stream": "line_in",
    "x-rincon-mp3radio": "radio",
    "x-sonosapi-stream": "service_stream",
    "x-sonosapi-radio": "service_radio",
    "x-sonosapi-hls": "service_hls",
    "x-sonosapi-hls-static": "service_hls",
    "x-sonos-http": "service_track",
    "x-file-cifs": "library_track",
    "x-sonos-vli": "external_session",  # Spotify Connect / AirPlay
    "x-sonos-htastream": "tv",
    "x-sonos-spotify": "service_track",
    "x-sonosprog-http": "service_track",
    # A track of a Spotify station (Start Radio's trackRadio, 2026-09-24),
    # the Spotify spelling of the x-sonosprog-http above.
    "x-sonosprog-spotify": "service_track",
    "x-rincon-cpcontainer": "service_container",
    "x-rincon-playlist": "playlist",
    "aac": "radio",
    "hls-radio": "radio",
    # A bare HTTP URI is how third-party servers on the LAN feed a speaker.
    # Music Assistant and Home Theater bridges both do this, as does Home
    # Assistant's text-to-speech, so it is a common source in practice even
    # though no Sonos software produces it.
    "http": "http_stream",
    "https": "http_stream",
}
