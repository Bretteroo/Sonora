<div align="center">
<img src="docs/sonora-wordmark.png" alt="Sonora" width="75%">

**A self-hosted web controller for Sonos systems**

<p>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0--only-1e5aa8?style=flat-square" alt="license: AGPL-3.0-only"></a>
<img src="https://img.shields.io/badge/Sonos-S1%20%7C%20S2-000000?logo=sonos&logoColor=white&style=flat-square" alt="Sonos: S1 and S2">
<img src="https://img.shields.io/badge/Python-%E2%89%A5%203.11-3776AB?logo=python&logoColor=white&style=flat-square" alt="Python 3.11 or newer">
<img src="https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white&style=flat-square" alt="FastAPI: backend">
<img src="https://img.shields.io/badge/React-19-1f6f8b?logo=react&logoColor=white&style=flat-square" alt="React: 19">
<img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white&style=flat-square" alt="Vite: 8">
</p>

<p>
<a href="https://ko-fi.com/bretteroo"><img src="https://img.shields.io/badge/-Support%20Sonora-13C3FF?style=flat-square&labelColor=555555&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZmZmZiIgZD0iTTEyIDIxcy03LjQtNC41LTkuNC05LjFDMS4xIDguMyAzLjMgNC42IDcgNC42YzIgMCAzLjYgMS4xIDUgMi45IDEuNC0xLjggMy0yLjkgNS0yLjkgMy43IDAgNS45IDMuNyA0LjQgNy4zQzE5LjQgMTYuNSAxMiAyMSAxMiAyMXoiLz48L3N2Zz4=" alt="Support Sonora"></a>
</p>

---

_Sonora gives you more ways to play._

[📚 Features](#-features) | [🎨 Themes](#-themes) | [🚀 Get Started](#-get-started) | [💙 Contributions](#-contributions) | [👏🏻 Credits](#-credits) | [🔒 License](#-license)

</div>

---

#  <img src="app/frontend/src/assets/sonora.png" style="height: 1.5em;"> Sonora

Sonora is the Sonos controller you've always wanted.

<img src="docs/screenshots/liquidglass/spread.webp" alt="Liquid Glass theme: Home, Now Playing and a music service">

Sonora's browser-based approach _finally_ brings desktop control to Linux users and web control to _all_ Sonos devices.

Most features included in Sonos' desktop and web apps are included in Sonora...plus some new ones!

A human designed Sonora and Claude Code built it.

Sonora is not affiliated with Sonos, Inc. and was created by an enthusiastic end user.

---

## 📚 Features

- 🔊 **S1 and S2 in one controller**
  - Control every Sonos speaker ever made from a single app.  (Room groupings and music services remain separate.)
- 🖥️ **Any browser, any screen**
  - Responsive design. No client to install. Linux users finally have a way to play!
- 🎨 **Theme engine**
  - Sonora comes with several themes, including three relatively close recreations of Sonos' own Windows, Mac, and web apps.
- 🎵 **All your music**
  - Enjoy streamed music services, local libraries, Sonos Favorites, and all your old playlists.
- 🏠 **Every room**
  - Grouping, volume, EQ, sleep timers, and alarms are all included.
- 📱 **A new virtual speaker: "This browser"**
  - Play audio through your browser as if it were one more room.
- 🧭 **S2 upgrade advisor**
  - Find out what it would take to upgrade your system to S2 or S2.1.
- 🌐 **VPN-Friendly**
  - Control speakers when you're away from home over your existing VPN connection
- 🩺 **Diagnostics**
  - View response times and radio conditions for every room to troubleshoot connection issues.
- 🏡 **Local first**
  - Talks to your speakers on your own network. Signing in to Sonos is optional, as it is on their apps.
- 🗣️ **Multilingual**
  - Twenty languages.
- ⚖️ **AGPL-3.0-only**
  - Because free software should stay that way.
- 🤖 **Guaranteed Non-Slop**
  - I built this because I wanted it for myself.  I use it daily, and it is good.

## 🚀 Get Started

Sonora needs to be installed on your home network on any machine that has access to your Sonos devices. Sonora is lightweight and runs well on even an older Raspberry Pi.

Docker is the recommended way to run Sonora: one command to install, one to update, and nothing else to set up on the machine.

If you run Home Assistant, Sonora can also be installed as a Home Assistant app.

Images are provided for `linux/amd64` and `linux/arm64`. Sonora is lightweight enough to run on an older Raspberry Pi.

<details>
<summary><strong>Install With Docker (recommended)</strong></summary>

### Install Sonora
* Install [Docker Engine](https://docs.docker.com/engine/install/) with [Docker Compose](https://docs.docker.com/compose/install)
* Download [`docker-compose.yml`](docker-compose.yml) into a folder of its own.
* Edit it, replacing </path/to/data> with the directory you'd like to hold Sonora's data.<br />`/home/<username>/.config/sonora` is recommended, but you do you, Boo.
* Then, from the folder holding `docker-compose.yml`:

```
docker compose up -d
```

Find it at <http://localhost:50205>.  (Get it?)

If you cloned this repository instead, `docker compose up -d --build` from its root builds the image on your machine.

### Future Updates

From the same folder:

```
docker compose pull && docker compose up -d
```
</details>

<details>
<summary><strong>Install in Home Assistant</strong></summary>

You'll need Home Assistant OS or a Supervised install. Container and Core installs can't run apps, so use Docker there instead.

### Install Sonora
* In Home Assistant, go to **Settings > Apps** and choose **Install App**.
* Open the ⋮ menu at the top right, choose **Repositories**, and add `https://github.com/Bretteroo/Sonora`.
* Find **Sonora** in the store, then install and start it.
* Turn on **Show in sidebar**.

Sonora then appears in Home Assistant's sidebar for every user. Phones and other computers can also open it directly at <http://homeassistant.local:50205>, without signing in to Home Assistant.

### Future Updates

Home Assistant offers each new Sonora release as an app update, alongside its own updates.
</details>

<details>
<summary><strong>Install Without Docker</strong></summary>

You'll need:
* Python 3.11 or newer, with its `venv` module. On Debian, Ubuntu and Raspberry
  Pi OS that's a separate package: `sudo apt install python3-venv`.
* Node.js 20.19 or newer (or 22.12 or newer), to build the interface.
* git.

### Install Sonora

```
sudo mkdir /opt/sonora
sudo chown $USER: /opt/sonora
git clone https://github.com/Bretteroo/Sonora.git /opt/sonora
cd /opt/sonora/app/frontend
npm ci
npm run build
cd /opt/sonora
python3 -m venv .venv
.venv/bin/pip install --require-hashes -r app/requirements.lock
```

### Future Updates

```
cd /opt/sonora && git pull
cd app/frontend && npm ci && npm run build
cd /opt/sonora && .venv/bin/pip install --require-hashes -r app/requirements.lock
sudo systemctl restart sonora
```

### Test it

```
cd /opt/sonora/app && /opt/sonora/.venv/bin/python -m backend
```

Find it at <http://localhost:50205> (Get it?).

This keeps its data (sign-ins, themes) in `~/.config/sonora`. The systemd service below keeps its own in `/var/lib/sonora`, so you'll sign in once more after switching to it.


### Make it persistent with systemd

Here's how to start Sonora when the machine boots (and keep it running) with systemd. 

If your OS doesn't use systemd, ask a robot how to do this.

Save this as `/etc/systemd/system/sonora.service`:

```
[Unit]
Description=Sonora
After=network-online.target
Wants=network-online.target

[Service]
DynamicUser=yes
StateDirectory=sonora
Environment=SONORA_DATA_DIR=/var/lib/sonora
WorkingDirectory=/opt/sonora/app
ExecStart=/opt/sonora/.venv/bin/python -m backend
Restart=on-failure
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl daemon-reload && sudo systemctl enable --now sonora`.

Find it at <http://localhost:50205>

To use a different port, add `Environment=SONORA_WEB_PORT=<port>` to the `[Service]` section.
</details>

<details>
<summary><strong>Settings and Firewalls</strong></summary>

Sonora reads these from the environment when it starts. In `docker-compose.yml` they go under `environment:`, where `SONORA_WEB_PORT` is already set; in the systemd unit, as `Environment=` lines.

You shouldn't have to set any of these, ever, unless you've got some really unique shenanigans goin' on.

| Variable | Default | What it does |
| --- | --- | --- |
| `SONORA_WEB_PORT` | `50205` | The port the page is served on. |
| `SONORA_WEB_HOST` | `0.0.0.0` | The address to listen on. The default is every one. |
| `SONORA_EVENT_PORT` | `50206` | The port the speakers connect to with live updates. `0` picks any free port. |
| `SONORA_DATA_DIR` | `~/.config/sonora` | Where sign-ins, installed themes and caches are kept. `/data` in Docker. |
| `SONORA_ALLOWED_HOSTS` | | Extra names Sonora answers to, comma-separated, such as a reverse proxy's or a tunnel's (`sonora.example.net`, or `.example.net` for every name under it). Addresses, `localhost`, `.local` names and the machine's own name already work. |
| `SONORA_LOG_LEVEL` | `INFO` | How much goes in the log. |

If the machine running Sonora has a firewall, it needs to let in:

* TCP `50205` (or your `SONORA_WEB_PORT`) from the devices you control it from.
* TCP `50206` (or your `SONORA_EVENT_PORT`) from the speakers. Without it Sonora still works, but it won't see changes made elsewhere until you reload.
* UDP from the speakers, which is how they answer when Sonora looks for them.

Docker's `network_mode: host` is required for the same reason: the speakers have to be able to reach Sonora, not just the other way round.
</details>

## 🎨 Themes

Sonora ships several themes. Five of them, Hi-Fi, Liquid Glass, Material Girl, Solarized and Sonofuture, come in both light and dark.

You can make your own themes, too! [THEMES.md](THEMES.md) shows how.

<details open>
<summary><b>Coromar</b></summary>
<br>
Sonora's own default: light concrete and navy glass, inspired by the seaside office building Sonos calls home.
<br>
<br>
<img src="docs/screenshots/coromar/spread.webp" alt="Coromar theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/coromar/spread-mobile.webp" width="45%" alt="Coromar theme on a phone: Home and the full-screen player">
</details>

<details>
<summary><b>Sedona</b></summary>
<br>
Red rocks and desert sky.
<br>
<br>
<img src="docs/screenshots/sedona/spread.webp" alt="Sedona theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/sedona/spread-mobile.webp" width="45%" alt="Sedona theme on a phone: Home and the full-screen player">
</details>

<details>
<summary><b>Outrun</b></summary>
<br>
Neon, lasers, and a setting sun.  Quintessential Outrun.
<br>
<br>
<img src="docs/screenshots/outrun/spread.webp" alt="Outrun theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/outrun/spread-mobile.webp" width="45%" alt="Outrun theme on a phone: Home and the full-screen player">
</details>

<details>
<summary><b>Solarized</b></summary>
<br>
<a href="https://ethanschoonover.com/solarized/">Ethan Schoonover</a>'s famous palette for nerds.
<br>
<br>
<img src="docs/screenshots/solarized/spread.webp" alt="Solarized theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/solarized/spread-dark.webp" alt="Solarized theme in dark: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/solarized/spread-mobile.webp" width="70%" alt="Solarized theme on a phone: Home and the full-screen player, light and dark">
</details>

<details>
<summary><b>Hot Dog Stand</b></summary>
<br>
For the OGs.
<br>
<br>
<img src="docs/screenshots/hotdog/spread.webp" alt="Hot Dog Stand theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/hotdog/spread-mobile.webp" width="45%" alt="Hot Dog Stand theme on a phone: Home and the full-screen player">
</details>

<details>
<summary><b>Liquid Glass</b></summary>
<br>
The visual design language made popular by the fruit company.
<br>
<br>
<img src="docs/screenshots/liquidglass/spread.webp" alt="Liquid Glass theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/liquidglass/spread-dark.webp" alt="Liquid Glass theme in dark: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/liquidglass/spread-mobile.webp" width="70%" alt="Liquid Glass theme on a phone: Home and the full-screen player, light and dark">
</details>

<details>
<summary><b>Sonofuture</b></summary>
<br>
The controller thought out again: every room at a glance, drag one onto another to group them. Dark or light, or following your system.
<br>
<br>
<img src="docs/screenshots/sonofuture/spread.webp" alt="Sonofuture theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/sonofuture/spread-dark.webp" alt="Sonofuture theme in dark: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/sonofuture/spread-mobile.webp" width="70%" alt="Sonofuture theme on a phone: Home and the full-screen player, light and dark">
</details>

<details>
<summary><b>Hi-Fi</b></summary>
<br>
Your house as a rack of high-end audio components: a turning record, a glowing display, knobs, and a cassette deck for the queue. Black anodized or brushed silver.
<br>
<br>
<img src="docs/screenshots/hifi/spread.webp" alt="Hi-Fi theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/hifi/spread-dark.webp" alt="Hi-Fi theme in dark: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/hifi/spread-mobile.webp" width="70%" alt="Hi-Fi theme on a phone: Home and the full-screen player, light and dark">
</details>

<details>
<summary><b>Material Girl</b></summary>
<br>
The controller rebuilt on Google's Material 3 Expressive: shape-shifting covers, a floating player tinted by what's playing, and a FAB menu for the whole house.
<br>
<br>
<img src="docs/screenshots/materialgirl/spread.webp" alt="Material Girl theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/materialgirl/spread-dark.webp" alt="Material Girl theme in dark: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/materialgirl/spread-mobile.webp" width="70%" alt="Material Girl theme on a phone: Home and the full-screen player, light and dark">
</details>

<details>
<summary><b>Sonos Web</b></summary>
<br>
A recreation of Sonos' own web player, brought into the future (or is it the past?) with support for S1.
<br>
<br>
<img src="docs/screenshots/web/spread.webp" alt="Sonos Web theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/web/spread-mobile.webp" width="45%" alt="Sonos Web theme on a phone: Home and the full-screen player">
</details>

<details>
<summary><b>Sonos macOS Desktop</b></summary>
<br>
A recreation of the Sonos desktop controller for macOS.
<br>
<br>
<img src="docs/screenshots/macos/spread.webp" alt="Sonos macOS Desktop theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/macos/spread-mobile.webp" width="45%" alt="Sonos macOS Desktop theme on a phone: Home and the full-screen player">
</details>

<details>
<summary><b>Sonos Windows Desktop</b></summary>
<br>
The Sonos desktop controller from Windows, rebuilt for the web.
<br>
<br>
<img src="docs/screenshots/windows/spread.webp" alt="Sonos Windows Desktop theme: Home, Now Playing and a music service">
<br>
<br>
<img src="docs/screenshots/windows/spread-mobile.webp" width="45%" alt="Sonos Windows Desktop theme on a phone: Home and the full-screen player">
</details>


## Three generations of hardware

Sonos launched its first devices in 2005. They were, and still are, awesome.

In 2020 Sonos <a href="https://en.community.sonos.com/product-updates/introducing-s2-new-app-and-os-for-sonos-6841762">announced the move</a> to "S2", a minimum hardware spec paired with a new, separate control app.

In August 2025 there was another split, marked by a new <a href="https://support.sonos.com/en-us/article/legacy-product-update">"S2.1" (my term)</a> hardware tier.  As of August 2025, only S2.1 devices receive new features.

Sonora controls speakers from all three generations.  A wall still exists between S1 and S2 speakers, though. (You can't group rooms across systems and streaming service links remain independent across systems.)

### Sonos Platforms Through The Years
Some S1 speakers can be software-upgraded to S2.  You'll need to use an official Sonos S1 controller to do so.  <a href="https://support.sonos.com/en-us/article/update-to-the-latest-sonos-app-using-the-s1-controller">Here's how</a>.
<img src="docs/sonos-hardware-generations-2026.svg" width="100%">

### 🪄 Sonos Upgrade Advisor

Sonora includes an upgrade advisor that will help you understand:
 - Which S1 devices can be upgraded to S2 via software
 - Which devices would need to be replaced for S2 support
 - How to go all-in on S2.1 if you'd like to _try_ to future-proof your system.

Make sure you're sitting down - it'll show the MSRP cost estimates to do so. 🫠

## 🧐 Why Sonora exists

When I switched from Windows to Linux years ago, I lost a native desktop Sonos controller.  Without realizing it, I mostly stopped using my Sonos devices as a result.

I sit in front of a computer for several hours a day, and context-switching to jump on my phone and drill through menus to play music was _just_ annoying enough that I eventually stopped bothering.

I waited patiently for over a decade for Sonos to release a Linux desktop controller, scouring GitHub for any mature open source options every few months, finding none.

Then Claude Code came along and changed everything.  Claude helped me build the Sonos controller I'd always wanted in about two months.

Sonora is platform agnostic and controls both S1 and S2 devices from any OS with a browser.  I've been meticulous in working to recreate as much of Sonos' smooth interface as possible, and have included a theming engine so you can make Sonora look (and behave) however you'd like.

Sonos has built something wonderful, and Sonora helps even more of the world experience it.  I'm really proud of it!  I hope you like it.

## Using Sonora

It's really not that hard. You'll figure it out!

### Music services

To play a service that needs an account login, like AccuRadio or Spotify:

1. Add the service in Sonos' own app in the Sonos S1 or S2 controller (or both).
2. Add the service a second time, this time in Sonora using the same credentials. (Sonora will prompt you to do this for each unlinked account.)

Anonymous services that don't require logins (like Audacy) only need step 2.

> [!NOTE]
> A notable few music services will not allow themselves to be used with apps like Sonora.  **SoundCloud** is one example. For services like these, you can navigate their menus and initiate playback with an official Sonos controller, but will have only basic playback controls with Sonora.

### Virtual Room

You'll see a room called "This browser".  That's just what it sounds like - a virtual speaker for streaming audio to your browser.

This is experimental; many services will only permit streaming to a Sonos device.

## 💙 Contributions

Issue reports are welcome. If you find a bug, <a href="../../issues/new">open an issue</a> and say which theme you were using, which system (S1 or S2), which music service, what you did, and what you saw.  Screenshots help!

My goal for Sonora is for it to feel every bit as polished as an official Sonos product.

There are many streaming services, each sending out a variety of content types (live streams, playlists, individual tracks, albums, podcasts, audiobooks, etc) and testing across all of them has taken up the bulk of development time.  I'm sure there are still some lingering display issues or bugs out there, but with over 100 streaming services supported by Sonos, I can't subscribe to everything.  Your reports help!

## 👏🏻 Credits

> “I love that people are experimenting enough to build third-party solutions when we haven’t shipped something ourselves yet.”<br/>- Sonos CEO Tom Conrad, <a href="https://www.reddit.com/r/sonos/comments/1qofc3w/comment/o29qixo/">Jan 28, 2026</a>

- Sonora stands on the shoulders of giants.  It is a functional synthesis of Sonos research from others that have come before.  These projects documented how the speakers worked long before Sonora existed.

  - <b>Sources of Information:</b>
    - <a href="https://github.com/svrooij/sonos-api-docs">Unofficial Sonos docs</a>
    - <a href="https://github.com/svrooij/sonos-net">sonos-net</a>
    - <a href="https://github.com/SoCo/SoCo">SoCo</a>
    - <a href="https://github.com/svrooij/node-sonos-ts">node-sonos-ts</a>

  - <b>Sources of Inspiration:</b>
    - <a href="https://github.com/sonos-web/sonos-web">Sonos Web</a>
    - <a href="https://github.com/janbar/noson-app">Noson</a>
    - <a href="https://github.com/pascalopitz/unoffical-sonos-controller-for-linux">Unofficial Sonos Controller for Linux</a>

- Sonos has been working tirelessly to create hardware and the software that drives it for over 20 years.  Their early decision to create a (relatively) open platform with a local-first design allows Sonora, and tools like it, to exist and function.
- The themes that follow Sonos' apps were made by using and measuring them. They contain none of Sonos' code, artwork, or translations.
- Service logos, product pictures, and cover art are fetched while Sonora runs and belong to their owners.

## 🔒 License

This project is licensed under AGPL-3.0-only: the GNU Affero General Public License, version 3, and no later version. The full text is in
[LICENSE](LICENSE).

Sonora is not affiliated with, endorsed by, or supported by Sonos, Inc. "Sonos" is a trademark of Sonos, Inc.
