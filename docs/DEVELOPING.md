# Developing Sonora

How Sonora is built, run from source and tested. The README is for the people
who use it; this is for the people who change it.

## S1, S2 and S2.1

Sonos has released three hardware platforms over the years (S1, S2, S2.1) and
maintains two software platforms (S1, S2) to control them. Some S1 hardware can
be software-updated to S2, and the rest of it cannot move at all.

    S1 Controller                S2 Controller
          |                            |
          |                   +--------+--------+
     S1 Speaker          S2 Speaker       S2.1 Speaker

Sonora can control all Sonos speakers released to date in a single app, with the
same underlying limitations as Sonos' own apps.

                      Sonora Controller
                              |
          +-------------------+-----------------+
     S1 Speaker          S2 Speaker       S2.1 Speaker

Settings has an upgrade advisor that reads the house, says which speakers could
make each jump, and prices the ones that would have to be replaced.

## Design principles

**Local first.** Control, browsing, state, and diagnostics all happen by talking
to speakers directly on the LAN, and so, it turned out, does almost everything
else. Two things are still not answerable there, and an optional sign-in
exists for them: the name of the input (HDMI or SPDIF) a soundbar's television
audio arrives on, and the list of Sonos Labs services. Both are isolated in
`app/backend/sonos/cloud.py` and `app/backend/sonos/muse.py` so the boundary stays
visible, both degrade to silence rather than breakage when signed out, and
nothing else depends on an internet connection.

Two things that used to need it no longer do. Which services a household has
configured comes from the speakers' own account list; their logos come from
the public manifest the desktop controller reads, cached on disk, so they
survive a sign-out and a restart.

**The speakers are the source of truth.** Every service definition in this
project was read from the devices themselves rather than guessed. Each
ZonePlayer publishes an SCPD document per service enumerating every action, its
arguments, their types and their permitted values, at the address the
device description gives; `app/backend/sonos/const.py` is built from them.

**Topology over discovery.** SSDP multicast is treated as an unreliable hint,
useful only for finding a first speaker to talk to. Replies genuinely do get
dropped: during development a sweep of a 13-speaker system routinely missed one
or two healthy units. `ZoneGroupTopology` is authoritative, and it reports
zones that are currently unreachable as well.

**Events, not polling.** Speakers push state changes to subscribers over UPnP
eventing. The controller subscribes and renews rather than asking repeatedly.

**Measure the path that carries the audio.** Speakers report their own radio
conditions but never their signal to the access point, which on a system of
ordinary WiFi stations is the only link that matters. The controller measures
it directly, and reports the tail of the distribution rather than the average,
because intermittent stalls are what produce dropouts.

**Know which calls make sound.** Every SOAP action is classified in
`app/backend/sonos/safety.py` as a read, a silent write, or one that can make a
speaker emit sound, now or later. Nothing is refused on that basis, since a
controller that will not control is no use; the tier sets how loudly a call is
logged, and marks the ones to be careful with in tests and when reading the
code. The dangerous cases are not obvious: adding a player to a group that is
playing starts audio on the player you just added, and S2 room detection
chirps.

## Music services

Playing a music service on a speaker involves two separate credentials, and for
an account-based service such as Spotify you need both. This is the same on S1
and S2; only which official app you use differs.

Sonora's own link to a service is what lets you browse it. Sonora calls the
provider directly with that sign-in to list folders, search and fetch track ids.
It is held per household, so a service linked for S1 is not linked for S2; using
it on both systems means linking it twice, once from each system's tab in Add
Music Services.

The account on the Sonos system is what lets a speaker play. Sonora never
streams the audio. When you play a track it hands the speaker a URI naming the
service and the account's serial number on that system, and the speaker fetches
the audio from the provider itself, authenticating with the account it already
holds. If the service is not on that Sonos system there is no account for the
speaker to use, so its items appear when you browse but cannot be played.

So for Sonora to play an account-based service on a device, the service has to
be added and signed in on both sides: in the official Sonos app for that system
(the Sonos S1 Controller for S1, the current Sonos app for S2), which puts the
account on the speakers, and in Sonora's services for that same system, which
lets Sonora browse it. Sonora cannot do the first half for you. Adding a
login-based account to a Sonos system requires a device certificate that only
Sonos' own apps carry, and the speakers of both generations refuse the attempt
from anything else. Sonora tells you this after a link completes.

Account-less services such as internet radio need no sign-in to browse, and
adding one in Sonora also registers it on the household, so those end up in the
working state on their own.

One dependency to know about: Sonora reads the account serial numbers from the
household's registration list, which comes from the optional Sonos cloud
sign-in. While signed out, a service that is on the system still browses but
its items are returned without playback URIs.

## Testing

Interface changes are verified in a real browser with Playwright rather than by
inspection. Firefox is the target:

    .venv/bin/playwright install firefox

Layout regressions here are easy to miss and expensive: a media query that hid
the room sidebar on narrower screens removed the only way to reach a speaker
and looked fine at the one width it had been checked at. Anything touching
layout gets swept across viewport widths.

## Requirements

- Python 3.11 or newer
- Node 20.19 or newer (or 22.12 or newer), for building the frontend
- Speakers reachable on the same layer 2 network, since discovery uses multicast
- Or Docker on a Linux host, for the container below

## Running

    python -m venv .venv && .venv/bin/pip install -e app
    (cd app/frontend && npm install && npm run build)
    (cd app && ../.venv/bin/python -m backend)

`app/pyproject.toml` names lower bounds, so a fresh install takes whatever
version of each dependency is current that day, and no two installs need
agree. The lock file pins one resolved set and the hash of every file in
it, so a tampered or substituted release fails the install rather than
running:

    .venv/bin/pip install --require-hashes -r app/requirements.lock
    .venv/bin/pip install -e app --no-deps

`app/requirements-dev.lock` is the same set plus what the tests need; the
suite passes against it. Regenerate both with
`uv pip compile app/pyproject.toml --generate-hashes -o app/requirements.lock`
(add `--extra dev` for the second).

Sonora then listens on port 50205 on every interface, so it is at
`http://localhost:50205/` on the machine running it and at
`http://<that machine's address>:50205/` from anything else on the network.
`/api/health` answers as soon as it is up. The backend serves the built
frontend from `app/frontend/dist`; during frontend work `npm run dev` in
`app/frontend/` proxies API calls to that same port.

### In a container

The published image, for x64 and arm64:

    docker compose up -d

`.github/workflows/docker.yml` builds it on GitHub for both platforms and
pushes it to `ghcr.io/bretteroo/sonora`: `:edge` and `:sha-<short>` from
every push to main; `:1.2.3`, `:1.2` and `:latest` from a `v1.2.3` tag.
`docker-compose.yml` pulls `:latest`, so users move only on a release. To make
one, tag main and push the tag:

    git tag v1.2.3 && git push github v1.2.3 A pull request
builds both without publishing. To run a copy built from this checkout
instead, tag it with the same name and compose uses it:

    docker build -t ghcr.io/bretteroo/sonora:latest . && docker compose up -d

Same address, same port. The compose file runs with `network_mode: host`,
which is a requirement rather than a convenience: Sonora finds speakers by
SSDP multicast and keeps up with them through UPnP eventing, where each
speaker opens a connection back to an address Sonora hands it. Behind a
bridge that address is the container's, which no speaker can reach, so
discovery goes quiet and nothing updates -- with nothing in the log to say
why. There is no port mapping for the same reason: the server binds the
host's port directly.

That confines it to a Linux host. Docker Desktop on macOS and Windows runs
containers inside a VM, where "host" is the VM's network rather than the one
the speakers are on.

State that has to survive a restart -- the optional Sonos session, music
service tokens, uploaded themes, the logo cache -- lives in the `sonora-data`
volume. Nothing else has to be configured.

### As a Home Assistant app

`repository.yaml` at the root makes this repository a Home Assistant app
repository, and `homeassistant/sonora/` is the app. It runs the published
image, so its `config.yaml` names a release: bump its `version` with every
release, to the tag the release publishes. The Dockerfile's last stages add
the `io.hass.*` labels Home Assistant's Supervisor reads.

Home Assistant shows the page through its ingress proxy, under
`/api/hassio_ingress/<token>/` on Home Assistant's own address.
`backend/ingress.py` tells the page that prefix, and
`frontend/src/lib/base.js` puts it in front of every root-relative URL the
page uses, so themes keep writing `/api/...` as before. The app sets
`SONORA_HA_INGRESS`; without it the ingress headers are ignored.

## The README's screenshots

`docs/screenshots/<theme>/` holds three screens of each theme (Home, Now
Playing, a music service being browsed) and a spread of the three. Retake them
after a theme changes. The maintainer takes them with scripts kept outside
the repository, which capture a running Sonora in Firefox at 1440x900 and
rename every room and service account on the way into the page so no one's
names are published. They write nothing to the speakers.

## Layout

    app/backend/sonos/  protocol layer: discovery, SOAP, events, diagnostics
    app/backend/        HTTP API and WebSocket push
    app/frontend/       web interface and the parts themes are built from
    app/themes/         coromar (default), outrun, sedona, hotdog, solarized,
                        web and desktop (replications of Sonos' own clients)
    app/tests/          the test suite; run it from app/
    docs/               contributor guides and the README's images
    homeassistant/      the Home Assistant app (repository.yaml beside it)

A theme can also arrive as a file rather than in the bundle: one JSON document
with its own version, thumbnail, layout, tokens, and stylesheet, installed and
removed from Settings. It carries no code. `THEMES.md` is the guide to writing
one.

## Settings

Read from the environment at startup.

    SONORA_WEB_HOST      interface to listen on (default 0.0.0.0, all of them)
    SONORA_WEB_PORT      port to listen on (default 50205)
    SONORA_DATA_DIR      where tokens and saved state live
                         (default ~/.config/sonora)
    SONORA_EVENT_PORT    port the speakers send UPnP events to (default 50206;
                         a free one if that is taken, any free one if 0)
    SONORA_ALLOWED_HOSTS extra Host names to answer to, comma-separated; a
                         leading dot allows every name under it (addresses,
                         localhost, single-label and .local names, and the
                         machine's own name are always allowed)
    SONORA_LOG_LEVEL     logging threshold (default INFO)
    SONORA_HA_INGRESS    set by the Home Assistant app: trust Home
                         Assistant's ingress headers from its Supervisor
    SONORA_SMAPI_DUMP    a directory to keep every music-service answer in,
                         for debugging a service's browse tree
