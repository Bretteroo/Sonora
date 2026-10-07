"""A refusal says what the code means, even when the speaker does not.

Sonos answers most faults with the code alone: a faultstring of the literal
"UPnPError", an errorCode, and no errorDescription. The log line ended in that
word, which describes nothing.
"""

from backend.sonos.soap import SoapClient, FAULT_MEANINGS

BARE = """<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>UPnPError</faultstring>
<detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>701</errorCode>
</UPnPError></detail></s:Fault></s:Body></s:Envelope>"""

TOLD = """<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>UPnPError</faultstring>
<detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>800</errorCode>
<errorDescription>Command not supported by this device</errorDescription>
</UPnPError></detail></s:Fault></s:Body></s:Envelope>"""


def test_a_bare_code_carries_no_description():
    fault = SoapClient._parse_fault(BARE, "ContentDirectory", "Browse")
    assert fault.code == "701"
    assert fault.description == ""
    assert FAULT_MEANINGS["701"] == "no such object"


def test_the_speakers_own_words_are_kept_when_it_has_any():
    fault = SoapClient._parse_fault(TOLD, "SystemProperties", "GetString")
    assert fault.code == "800"
    assert fault.description == "Command not supported by this device"


def test_every_meaning_is_a_code_a_speaker_could_send():
    assert all(code.isdigit() for code in FAULT_MEANINGS)
