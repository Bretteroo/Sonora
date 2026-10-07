"""Opening the household's own account list, and what is kept from it."""

from backend.sonos import accounts
from backend.sonos.credentials import seal, unseal

HOUSEHOLD = "Sonos_test"

LIST = (
    '<MediaServers>'
    '<Service UDN="SA_RINCON48135_X_#Svc48135-0-Token" NumAccounts="1" Md0=""'
    ' Username0="X_#Svc48135-0-Token" Nickname0="Alex" SerialNum0="48"'
    ' Flags0="0" Tier0="0" Token0="live-token" Key0="live-key"/>'
    '<Service UDN="SA_RINCON77575_" NumAccounts="1" Username0="" Nickname0=""'
    ' SerialNum0="16" Flags0="0" Tier0="0"/>'
    '<Service UDN="SA_RINCON3079_X_#Svc3079-a-Token" NumAccounts="2"'
    ' Username0="X_#Svc3079-a-Token" Nickname0="one" SerialNum0="22"'
    ' Username1="X_#Svc3079-b-Token" Nickname1="two" SerialNum1="43"/>'
    '</MediaServers>'
)


def test_the_cipher_opens_what_it_sealed():
    for value in ("read", "SA_RINCON48135_X_#Svc48135-0-Token", "", "ünïcode ☃"):
        assert unseal(seal(value, HOUSEHOLD), HOUSEHOLD) == value


def test_another_household_cannot_open_it():
    sealed = seal("read", HOUSEHOLD)
    try:
        unseal(sealed, "Sonos_someone_else")
    except ValueError:
        return
    raise AssertionError("the checksum is there to refuse a wrong household")


def test_the_accounts_come_out_with_their_names():
    found = accounts.parse(seal(LIST, HOUSEHOLD), HOUSEHOLD)
    by_udn = {a.udn: a for a in found}
    one = by_udn["SA_RINCON48135_X_#Svc48135-0-Token"]
    assert one.nickname == "Alex"
    assert one.serial == "48"
    assert one.service_type == 48135
    # The browse sid lives in the type's high bits.
    assert one.service_id == 48135 >> 8
    # An anonymous service has no logon string; its UDN ends at the underscore.
    assert by_udn["SA_RINCON77575_"].nickname == ""
    # Both of a service's accounts are read, each under its own UDN.
    assert by_udn["SA_RINCON3079_X_#Svc3079-a-Token"].nickname == "one"
    assert by_udn["SA_RINCON3079_X_#Svc3079-b-Token"].nickname == "two"


def test_no_credential_survives_the_parse():
    found = accounts.parse(seal(LIST, HOUSEHOLD), HOUSEHOLD)
    text = repr(found)
    assert "live-token" not in text and "live-key" not in text
    assert not any(field in accounts.Account.__slots__
                   for field in ("token", "key", "md"))


def test_an_unreadable_blob_is_no_accounts_rather_than_an_error():
    assert accounts.parse("", HOUSEHOLD) == []
    assert accounts.parse(seal(LIST, HOUSEHOLD), "Sonos_wrong") == []
    assert accounts.parse(seal("not xml at all", HOUSEHOLD), HOUSEHOLD) == []
