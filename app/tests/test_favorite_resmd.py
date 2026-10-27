"""A favorite saved from what a room is playing keeps the source's DIDL, and a
station Sonos' cloud started reports its item as id "-1". Saved that way, the
favorite plays but drops out of every cloud-backed favorites list, so the id
is rebuilt from the URI before the favorite is written.
"""

from __future__ import annotations

from backend.sonos.playback import favorite_resmd

NS = ('xmlns:dc="http://purl.org/dc/elements/1.1/" '
      'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
      'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"')


def didl(item: str, tag: str = "item") -> str:
    return (f'<DIDL-Lite {NS}>{item}<dc:title>Groove Salad FLAC</dc:title>'
            f'<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>'
            f'<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">'
            f'SA_RINCON132103_X_#Svc132103-2b23145d-Token</desc></{tag}></DIDL-Lite>')


def test_a_cloud_started_station_gets_its_object_id_back():
    uri = "x-sonosapi-stream:experimental%3agroovesalad%3aflac?sid=516&flags=8232&sn=5"
    fixed = favorite_resmd(uri, didl('<item id="-1" parentID="-1" restricted="true">'))
    assert '<item id="F00092020experimental%3agroovesalad%3aflac" parentID="0" restricted="true">' in fixed
    assert "SA_RINCON132103_X_#Svc132103-2b23145d-Token" in fixed


def test_a_radio_station_and_a_container_are_rebuilt_the_same_way():
    radio = "x-sonosapi-radio:user_channel%3a6ab80a30?sid=188&flags=8300&sn=8"
    assert 'id="000c206cuser_channel%3a6ab80a30"' in favorite_resmd(radio, didl('<item id="-1" parentID="-1" restricted="true">'))
    album = "x-rincon-cpcontainer:1004206calbum%3a123?sid=204&flags=8300&sn=1"
    out = favorite_resmd(album, didl('<container id="-1" parentID="-1" restricted="true">', "container"))
    assert '<container id="1004206calbum%3a123" parentID="0"' in out


def test_a_record_that_already_names_its_object_is_left_alone():
    uri = "x-sonosapi-stream:doomed?sid=516&flags=8224&sn=5"
    good = didl('<item id="F00092020doomed" parentID="0" restricted="true">')
    assert favorite_resmd(uri, good) == good


def test_a_uri_without_an_object_id_keeps_the_metadata_as_it_is():
    broken = didl('<item id="-1" parentID="-1" restricted="true">')
    assert favorite_resmd("x-rincon-mp3radio://ice1.somafm.com/groovesalad-256-mp3", broken) == broken
