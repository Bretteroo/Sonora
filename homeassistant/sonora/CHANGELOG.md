# Changelog

## 1.0.4

The big changes for 1.0.4:

* A new theme, Severed.
* The Home Assistant app's port settings now take effect.

### What's new

* Severed: A desk terminal for doing mysterious and important work. Soothing scanlines and a phosphor glow pour over your music library. Uniquely suited for macrodata refinement.
* Hi-Fi: lyrics without timings open whole in a panel from the display, and a long lyric line runs on to a second line.
* Material Girl: a group's Sound and settings now step through every speaker in the group.
* Settings in Material Girl, Sonofuture, Liquid Glass, and Hi-Fi: the list of pages and the page beside it now scroll independently.

### Fixes

* Home Assistant: changing the web port or the speaker callback port on the Configuration tab now takes effect. 1.0.3 ignored them.
* Sonora keeps up with your speakers when the computer running it gets a new network address. Previously if an IP changed, it would only show old data.
* The search service you picked from the menu stays picked while the room plays from that service, instead of switching back whenever the list of services reloads.
* The Network check no longer counts a speaker connected over the household's Wi-Fi as part of SonosNet.
* About shows the version of the Sonora serving the page.
* Installs run from a git clone show a development version (such as 1.0.5-dev) when they're ahead of the latest release, and are still told when the next release is out.

## 1.0.3

The big changes for 1.0.3:

* Sonora now shows lyrics!  Big thanks to the [LRCLIB](https://lrclib.net/) project for existing.
* Speaker discovery now works for Docker Desktop installs on macOS.
* “About Sonora” now reports when new versions are available.

### What’s new

* Lyrics: follow along with the words to whatever’s playing, timed to the music where possible. They come directly from LRCLIB to your browser, bypassing the Sonora server entirely.
* Sonora now works properly in Docker Desktop on macOS. Turn on host networking in Docker Desktop’s settings, then install as the README describes.
* Home Assistant users can now change the ports that Sonora uses on the Configuration tab.
* The About card says when a newer Sonora is available.
* You can now “Add to Home Screen” from mobile browsers.
* Coromar, Hot Dog Stand, and Solarized have a Troubleshooting page. The Network check shows only the system you picked, and its mesh advice is a short list.
* Players are named the way Sonos names them (without the “Sonos” prefix, in most cases), and the two generations of Connect:Amps are now properly identified.

### Fixes

* In Firefox, clicking the position bar seeks to where you clicked in all cases.
* Search matches are more legible, the search menu shows service icons, and the results header is fixed in Solarized, Outrun, Sedona, and Hot Dog Stand.
* Pictures for Recently Played and for service items no longer go missing.
* A favorite whose item the service has removed now says so.
* Lyrics wait their turn with LRCLIB instead of failing when it’s busy.
* A speaker stays online while its household lists it, a household no longer shows up twice when speakers have a less than ideal connection, and a speaker that stops taking subscriptions is reported once instead of again and again.
* General polish across all themes.

## 1.0.2

Sonora can now run inside Home Assistant.

* Sonora can be installed as a Home Assistant app and opened from Home Assistant's sidebar. Phones and other computers can still reach it directly on port 50205.
