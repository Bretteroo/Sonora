"""Whether a Sonos Favorite can still play, as the apps judge it.

A favorite from a service that has left the system is grayed out. TuneIn is
the exception, since it plays without an account -- unless the favorite was
saved under a signed-in TuneIn account, which its DIDL says by naming that
account's token. The S1 Mac app grayed 102.7 KIIS FM, saved that way, while
plain TuneIn stations beside it stayed playable (2026-09-23).
"""

from backend.main import _favorite_facts


def _favorite(uri, desc):
    return {
        "uri": uri,
        "metadata": ('<DIDL-Lite><item><desc id="cdudn" '
                     f'nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">{desc}</desc></item></DIDL-Lite>'),
    }


def test_a_plain_tunein_station_plays_without_tunein_on_the_system():
    raw = _favorite("x-sonosapi-stream:s35431?sid=254&flags=8224&sn=0", "SA_RINCON65031_")
    _favorite_facts(raw, in_use=set(), names={})
    assert raw["available"] is True


def test_a_favorite_saved_under_an_account_needs_that_service_signed_in():
    raw = _favorite("x-sonosapi-stream:s33122?sid=254&flags=8224&sn=0", "SA_RINCON65031_X_#Svc65031-0-Token")
    _favorite_facts(raw, in_use=set(), names={})
    assert raw["available"] is False
    _favorite_facts(raw, in_use={254}, names={})
    assert raw["available"] is True


def test_a_service_that_left_the_system_grays_its_favorites():
    raw = _favorite("x-sonosapi-stream:live_stations.6605?sid=6&flags=8224&sn=15", "SA_RINCON1543_X_#Svc1543-0-Token")
    _favorite_facts(raw, in_use={254, 303}, names={})
    assert raw["available"] is False
