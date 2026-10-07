"""The cloud feed's reading of a playback frame."""

from backend.sonos.muse import CLEARED, HomeTheaterStatus, home_theater_status


def _frame(kind: str, description: str | None = "No Signal") -> dict:
    fmt = {} if description is None else {"streamDescription": description}
    return {
        "_objectType": "extendedPlaybackStatus",
        "playback": {"playbackState": "PLAYBACK_STATE_PLAYING"},
        "metadata": {"container": {
            "name": "TV Audio", "type": kind,
            "id": {"objectId": "homeTheater-input"},
            "htInputFormat": {"numGroundChannels": 0, **fmt},
        }},
    }


def test_spdif_without_signal_is_named_and_flagged():
    assert home_theater_status(_frame("linein.homeTheater.spdif")) == \
        HomeTheaterStatus("SPDIF", "No Signal")


def test_hdmi_with_a_codec_keeps_the_description():
    status = home_theater_status(_frame("linein.homeTheater.hdmi", "Dolby Digital 5.1"))
    assert status == HomeTheaterStatus("HDMI", "Dolby Digital 5.1")


def test_missing_description_is_unknown_not_empty():
    assert home_theater_status(_frame("linein.homeTheater.hdmi", None)) == \
        HomeTheaterStatus("HDMI", None)


def test_other_sources_clear_the_input():
    body = {"metadata": {"container": {"type": "playlist", "name": "Chill"}}}
    assert home_theater_status(body) is CLEARED
    assert home_theater_status({"metadata": {}}) is CLEARED
    assert home_theater_status({}) is CLEARED


def test_bare_home_theater_type_has_no_name():
    assert home_theater_status(_frame("linein.homeTheater")) == \
        HomeTheaterStatus("", "No Signal")
