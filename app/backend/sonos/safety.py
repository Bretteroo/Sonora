"""Classification of SOAP actions by how disruptive they are.

Three tiers:

``READ``
    Pure queries.
``WRITE``
    Changes device state without producing sound: volume, mute, EQ, status
    light, room name, play mode, alarm *removal*.
``AUDIO``
    Can cause a speaker to emit sound now or later. Grouping belongs here even
    though nothing in the call looks like a transport command: adding a player
    to a group that is playing starts audio on the player just added.

Nothing is refused on this basis -- Sonora is a controller, and a controller
that will not control is no use. The tier decides how loudly an action is
logged, and names the calls to be careful with when reading the code.
"""

from __future__ import annotations

import enum


class Tier(enum.StrEnum):
    READ = "read"
    WRITE = "write"
    AUDIO = "audio"


#: Actions that can produce sound, keyed by service name.
AUDIO_ACTIONS: dict[str, frozenset[str]] = {
    "AVTransport": frozenset({
        "Play",
        "Next",
        "Previous",
        "NextSection",
        "PreviousSection",
        "NextProgrammedRadioTrack",
        "SetAVTransportURI",
        "SetNextAVTransportURI",
        "AddURIToQueue",
        "AddMultipleURIsToQueue",
        "AddURIToSavedQueue",
        "ReorderTracksInQueue",
        "SaveQueue",
        "ChangeTransportSettings",
        "RunAlarm",
        "StartAutoplay",
        "SnoozeAlarm",
        "SetCrossfadeMode",
    }),
    # Joining a group that is playing starts audio on the joined player.
    "GroupManagement": frozenset({"AddMember", "ReportTrackBufferingResult"}),
    "Queue": frozenset({
        "AddURI",
        "AddMultipleURIs",
        "ReplaceAllTracks",
        "ReorderTracks",
        "Backup",
    }),
    # Enabling an alarm schedules future playback.
    "AlarmClock": frozenset({"CreateAlarm", "UpdateAlarm"}),
    "VirtualLineIn": frozenset({"StartTransmission", "Play", "SetVolume"}),
    "AudioIn": frozenset({"StartTransmissionToGroup", "SelectAudio"}),
    "HTControl": frozenset({"SetLEDFeedbackState"}),
    # Room detection emits an audible chirp from the speaker.
    "DeviceProperties": frozenset({
        "RoomDetectionStartChirping",
        "RoomDetectionStopChirping",
    }),
}

#: Actions that change state but cannot make sound.
WRITE_ACTIONS: dict[str, frozenset[str]] = {
    "AVTransport": frozenset({
        "Pause",
        "Stop",
        "Seek",
        "SetPlayMode",
        "RemoveTrackFromQueue",
        "RemoveTrackRangeFromQueue",
        "RemoveAllTracksFromQueue",
        "ConfigureSleepTimer",
        "BecomeCoordinatorOfStandaloneGroup",
        "DelegateGroupCoordinationTo",
        "EndDirectControlSession",
    }),
    "RenderingControl": frozenset({
        "SetVolume",
        "SetRelativeVolume",
        "SetMute",
        "SetBass",
        "SetTreble",
        "SetLoudness",
        "SetBalance",
        "SetEQ",
        "SetOutputFixed",
        "SetChannelMap",
        "SetRoomCalibrationX",
        "RampToVolume",
        "RestoreVolumePriorToRamp",
        "ResetBasicEQ",
        "ResetExtEQ",
    }),
    "GroupRenderingControl": frozenset({
        "SetGroupVolume",
        "SetRelativeGroupVolume",
        "SetGroupMute",
        "SnapshotGroupVolume",
    }),
    "DeviceProperties": frozenset({
        "SetLEDState",
        "SetZoneAttributes",
        "SetButtonLockState",
        "SetAutoplayLinkedZones",
        "SetAutoplayRoomUUID",
        "SetAutoplayVolume",
        "SetUseAutoplayVolume",
        "AddBondedZones",
        "RemoveBondedZones",
        "AddHTSatellite",
        "RemoveHTSatellite",
        "CreateStereoPair",
        "SeparateStereoPair",
        "SetZoneName",
        "EnterConfigMode",
        "ExitConfigMode",
    }),
    "AlarmClock": frozenset({
        "DestroyAlarm",
        "SetFormat",
        "SetTimeZone",
        "SetTimeServer",
        "SetTimeNow",
        "SetDailyIndexRefreshTime",
    }),
    "SystemProperties": frozenset({
        "SetString",
        "Remove",
        "SetAccountCredentials",
        "SetAccountNickname",
        "SetAccountNicknameX",
        # Linking a music service account. Neither starts audio; both change
        # the household, and both complete only after a person has authorized
        # the account on the provider's own site.
        "AddAccountX",
        "AddOAuthAccountX",
        "RemoveAccount",
        "DoPostUpdateTasks",
    }),
    "ZoneGroupTopology": frozenset({"BeginSoftwareUpdate", "SubmitDiagnostics"}),
    "ContentDirectory": frozenset({
        "RefreshShareIndex",
        "DestroyObject",
        "CreateObject",
        "UpdateObject",
    }),
}


def classify(service: str, action: str) -> Tier:
    """Return the disruption tier of ``service#action``.

    Unknown actions that look like queries are treated as reads; anything else
    unrecognized is treated as ``AUDIO``, so a new or misspelled action reads
    as the most disruptive it could be rather than the least.
    """
    if action in AUDIO_ACTIONS.get(service, ()):
        return Tier.AUDIO
    if action in WRITE_ACTIONS.get(service, ()):
        return Tier.WRITE
    if action.startswith(("Get", "Browse", "Search", "List", "Lookup", "Is")):
        return Tier.READ
    return Tier.AUDIO
