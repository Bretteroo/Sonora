"""Signed out of Sonos, a service's accounts come from the speakers' own list.

The S1 Mac app names every account in Service Settings ("Alex's Libby")
with no cloud involved; Sonora reads the same list, so rename and remove find
the account by its serial either way.
"""

from types import SimpleNamespace

from backend.main import _service_accounts
from backend.sonos.accounts import Account


def _ctl(registrations, held):
    return SimpleNamespace(
        cloud=SimpleNamespace(last_registrations=lambda cloud_id: registrations),
        household_accounts=lambda household_id: held,
    )


HOUSEHOLD = SimpleNamespace(id="Sonos_test", cloud_id="cloud")
LIBBY = Account(udn="SA_RINCON20231_x", service_type=20231, username="x",
                nickname="Alex's Libby", serial="3")
OTHER = Account(udn="SA_RINCON3079_y", service_type=3079, username="y",
                nickname="Spotify", serial="5")


def test_the_speakers_list_stands_in_for_the_cloud():
    found = _service_accounts(_ctl([], [LIBBY, OTHER]), HOUSEHOLD, 20231 >> 8)
    assert found == [("3", "x", 20231)]


def test_the_cloud_list_wins_when_held():
    reg = SimpleNamespace(service_id=20231 >> 8, account_id="9", username="z", service_type=20231)
    found = _service_accounts(_ctl([reg], [LIBBY]), HOUSEHOLD, 20231 >> 8)
    assert found == [("9", "z", 20231)]


def test_an_account_without_a_logon_string_is_not_one_to_act_on():
    blank = Account(udn="SA_RINCON20231_", service_type=20231, username="",
                    nickname="", serial="0")
    assert _service_accounts(_ctl([], [blank]), HOUSEHOLD, 20231 >> 8) == []
