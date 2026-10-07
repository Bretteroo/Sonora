"""The share diagnosis: what the file server's answers mean."""

from backend.sonos.smb import explain, share_host


def test_share_host_reads_every_form_a_path_arrives_in():
    assert share_host("//192.168.0.102/music/Alex/music1") == "192.168.0.102"
    assert share_host("\\\\nas\\Music") == "nas"
    assert share_host("smb://nas.local/Music") == "nas.local"
    assert share_host("x-file-cifs://nas/Music") == "nas"
    # credentials ride in the authority when a share needs them
    assert share_host("x-file-cifs://brett:secret@nas/Music") == "nas"
    assert share_host("") == ""


def test_nothing_listening_names_the_host_and_the_ports():
    facts = {"host": "nas", "port": None, "smb1": None, "smb2": "", "anonymous": None}
    said = explain("//nas/Music", facts, generation="S2")
    assert "Nothing answered at nas" in said
    assert "445" in said and "139" in said


def test_s1_household_against_a_server_that_dropped_smb1():
    facts = {"host": "nas", "port": 445, "smb1": False, "smb2": "SMB 3.0", "anonymous": False}
    said = explain("//nas/Music", facts, generation="S1")
    assert "SMBv1" in said
    assert "SMB 3.0" in said
    # the way out, both of them
    assert "enable SMBv1" in said and "S2 system" in said


def test_s2_household_and_a_server_that_refuses_guests():
    facts = {"host": "nas", "port": 445, "smb1": False, "smb2": "SMB 3.0", "anonymous": False}
    said = explain("//nas/Music", facts, generation="S2", credentials=False)
    assert "no credentials" in said
    assert "username and password" in said


def test_credentials_were_given_and_still_refused():
    facts = {"host": "nas", "port": 445, "smb1": False, "smb2": "SMB 3.0", "anonymous": False}
    said = explain("//nas/Music/Sub", facts, generation="S2", credentials=True)
    # Sonora seals the login the way the apps do, so what is left to say is
    # about the account and the folder, not about Sonora.
    assert "could not mount" in said
    assert "read that exact folder" in said
    assert "//nas/Music/Sub" in said


def test_a_server_that_would_let_anyone_in_points_at_the_path():
    facts = {"host": "nas", "port": 445, "smb1": True, "smb2": "SMB 2.1", "anonymous": True}
    said = explain("//nas/Typo", facts, generation="S1")
    assert "share name and path" in said
    assert "//nas/Typo" in said


def test_share_didl_is_the_one_the_apps_build():
    """The share's path is the title, and there is no res and no class.

    Read out of the apps' own native library (see share_elements). Sonora
    sent a res-based container with an upnp:class for weeks: the players
    created the object from it and then would never mount the share.
    """
    from backend.sonos.controller import Commands

    plain = Commands.share_elements("x-file-cifs://nas/Music")
    assert '<container id="" restricted="false">' in plain
    assert "<dc:title>//nas/Music</dc:title>" in plain
    assert "<res" not in plain and "upnp:class" not in plain
    assert "usernameX" not in plain and "@" not in plain
    # The app writes the path with forward slashes, whatever was typed.
    assert "<dc:title>//nas/Music</dc:title>" in Commands.share_elements("x-file-cifs://nas\\Music")


def test_share_uri_never_carries_an_account():
    from backend.sonos.controller import Commands

    assert Commands.share_uri("//nas/Music") == "x-file-cifs://nas/Music"
    assert Commands.share_uri("\\\\nas\\Music\\Rock") == "x-file-cifs://nas/Music/Rock"
    assert Commands.share_uri("smb://nas/Music") == "x-file-cifs://nas/Music"


def test_share_credentials_are_sealed_the_way_the_apps_seal_them():
    """The X on usernameX/passwordX means encrypted, not merely encoded.

    Sonora sent base64 of the plain text for weeks. The players take that
    object, throw both fields away, mount the share anonymously and answer
    `1,<path>`: measured with an SMB server of our own on 2026-09-11, where
    Sonora's add made a player log in as "guest" and a Sonos app's made it
    log in as "read" with the right password. See backend/sonos/credentials.py.
    """
    import base64

    from backend.sonos.controller import Commands

    didl = Commands.share_elements(
        "x-file-cifs://192.168.0.102/music/Alex/music2", "alex", "hunter2",
        household_id="Sonos_x")
    for tag in ("usernameX", "passwordX"):
        value = didl.split(f"<r:{tag}>")[1].split(f"</r:{tag}>")[0]
        assert value.startswith("2:"), f"{tag} is not in the apps' format"
        # IV in front, then whole AES blocks.
        raw = base64.b64decode(value[2:])
        assert len(raw) >= 32 and len(raw) % 16 == 0
    # Neither value is the plain text, nor base64 of it.
    assert "brett" not in didl and "YnJldHQ=" not in didl
    assert "hunter2" not in didl and "aHVudGVyMg==" not in didl
    # A share with no login carries neither element.
    plain = Commands.share_elements("x-file-cifs://nas/Music")
    assert "usernameX" not in plain and "passwordX" not in plain
    # The path itself is not encoded: it is the title.
    assert "<dc:title>//nas/Music</dc:title>" in plain
