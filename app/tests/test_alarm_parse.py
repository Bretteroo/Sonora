"""Alarm lists go through the hardened parser.

ListAlarms is a document a speaker hands over, so Sonora must not honor
entity or DTD declarations in it. This one call was still on the standard
library's parser until it was fixed.
"""

import asyncio

from backend.sonos.controller import Commands


class _Stub(Commands):
    def __init__(self, raw):
        self._raw = raw

    async def _list_alarms_settled(self, zone_uuid):  # noqa: D102
        return self._raw


GOOD = ('<Alarms><Alarm ID="7" StartTime="07:00:00" Duration="02:00:00" '
        'Recurrence="DAILY" Enabled="1" RoomUUID="RINCON_1" ProgramURI="x-rincon-buzzer:0" '
        'ProgramMetaData="" PlayMode="NORMAL" Volume="12" IncludeLinkedZones="0"/></Alarms>')

# An external entity pointed at a local file: the hardened parser refuses the
# declaration instead of reading it.
XXE = ('<?xml version="1.0"?><!DOCTYPE Alarms [<!ENTITY x SYSTEM "file:///etc/passwd">]>'
       '<Alarms><Alarm ID="&x;"/></Alarms>')


def test_a_normal_list_still_reads():
    alarms = asyncio.run(_Stub(GOOD).alarms("RINCON_1"))
    assert [a["ID"] for a in alarms] == ["7"]
    assert alarms[0]["StartTime"] == "07:00:00"
    assert alarms[0]["Volume"] == "12"


def test_an_entity_declaration_is_refused_not_resolved():
    assert asyncio.run(_Stub(XXE).alarms("RINCON_1")) == []


def test_junk_is_no_alarms():
    assert asyncio.run(_Stub("not xml at all").alarms("RINCON_1")) == []
