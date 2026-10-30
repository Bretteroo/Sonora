# Changelog

## 1.1.0

### What’s new

* Sonora can be installed on Unraid from the Apps tab. Search for Sonora.
* Long lists now load 100 rows at a time as you scroll.
* Adds a vertical alphabet bar for long lists in ten themes, with magnification, instant jumps back to loaded sections, and a loading indicator. Hello, big local libraries!
* Sonora silently checks GitHub for a new release once a week, and every theme shows a simple notification when one is out with a link to the changelog.  If this is annoying, let me know.
* Now-playing text that’s too long to fit scrolls in every theme’s player, bar, and room cards.
* Podcast episodes name their show under them in every bar and card. Sonos Web and Hi-Fi also show a podcast’s release date, an audiobook’s narrator and book, and a broadcast’s show or what’s on air.
* Stations that announce the song on air in their stream text now show that song and artist (#19). Thanks to @v1nc3lx for reporting it.
* Modals fade in and out, and modals with a title bar can be dragged.
* TV rooms, Sonos Favorites, and Recently Played follow the official apps more closely. Recently Played fills in missing art from your Favorites and leaves out announcements, chimes, and alerts from things like Home Assistant.
* Sonos Web: Manage and “+” on Your Services open Content Services pages. Removing a service asks whether to remove it from Sonos, Sonora, or both.
* Liquid Glass and Sonofuture: a reworked big player. A group shows one volume slider, the whole player fits a phone screen, and the queue slides in from the right. Optimizations to Liquid Glass mean it now runs a full 60 frames a second instead of about 18.
* Material Girl: time and date pickers match Material Design 3.
* A user's Sonos account login has its own page in Settings.
* Removing a music folder shows it being removed, and a folder being added survives a Sonora restart.
* The upgrade advisor’s answer folds shut and open when you choose a different plan.
* When the “This browser” room is selected, the search box switches to whatever service it’s playing, and Alarms opens for it.
* Easter egg added

### Fixes

* A stereo pair no longer vanishes when both speakers report the channel map (#15). Thanks to @prasta1 for the fix.
* Group volume keeps up with the slider, and in Sonos Web the room sliders inside a group can be reached again.
* The seek bar no longer jumps back after a seek, and Sonos Web’s seek bar takes clicks reliably.
* Two rooms with the same name stay two rooms, and a room’s new icon arrives with its new name.
* Services found only on S2 (like TuneIn (New)) keep their icons, and Sonos Web shows each system’s own service icons.
* Station text with escaped commas reads cleanly. A stream station that names no song reads as On Now in the Windows theme.
* The sleep timer in the Windows and macOS themes behaves like the apps’, and its countdown shows in the header and the button row.
* The "Clear queue?" and "Save queue?" dialogs no longer appear layered behind the music sources.
* Phone tab bars stay tappable and visible when the page is slightly zoomed.  You're welcome, fellow fat finger fellows.
* Settings now fit short windows in Hi-Fi and Material Girl, and settings pages no longer cut off shadows and focus rings.
* Menus near the window’s right edge no longer squeeze, and dropdown arrows no longer jump on hover.
* The “lost its connection” screen is spaced out in the desktop themes, and its text is now legible in Hot Dog Stand.
* Severed’s dropdowns had missing scanlines, and Severed's text sizes match in the Upgrade Advisor and Network Check.
* Material Girl’s group and queue counts no longer look like warnings.

## 1.0.5

### What’s new

* More polish to theme switching.  Themes fade into each other and their preview screenshots do, too.
* The built-in themes' version numbers now match the version of Sonora they came with.
* Opening Music Library from the list of sources makes the search box switch to Music Library, just as opening a service already did.
* Rating buttons for services like Pandora and AccuRadio now appear in the "This browser" room.
* The upgrade advisor’s affiliate disclosure now says even more explicitly that its “Buy now” buttons are Amazon affiliate links.
* Toasts don't pile up any more - a new one replaces the old.  Errors and warnings are still kept in the Log.

### Fixes

* Home Assistant: opening Sonora from the sidebar no longer fails with “Sonora does not answer to the name…” when Home Assistant is reached via domain name (#14).
* Clicking a Music Library search result opens it, instead of returning to the list of sources (#16). Thanks to @prasta1 for reporting it and tracking down the cause.
* Sonos Web on a phone: the Language and Theme lists in Settings fit inside their rows.
* Sonofuture and Liquid Glass draw service rating icons at their proper shape.
* General cleanups to the Severed theme.

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
