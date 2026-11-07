# Changelog

## 1.2.1

This release fixes several S2 services, gets rooms back up a little more smoothly after a network outage, and lets a sleep timer turn off your TV.

### What's new

* When a soundbar is playing from TV input, a sleep timer now also turns off the TV. This needs an HDMI soundbar, HDMI-CEC enabled on the TV, and for now it only works on S2 soundbars.  S1 CEC control isn't documented anywhere and I don't have an S1 soundbar to test with.
* Lyrics now show for stations that put the song on the Information line as "Artist - Title" instead of sending separate tags. Sonora also tries "Title - Artist", since some stations send it that way.
* Sonora checks in with your speakers less frequently: every half hour instead of every nine minutes, for less chatter on your network.
* Sonora now plays HLS stations more closely to the official apps, so other Sonos apps now show the station by name, not as an unnamed web stream.
* In Sonofuture and Liquid Glass, a row's "..." menu opens beside the button instead of way on the other side of the row. Clicking a song row no longer opens its menu: click its art or double-click the row to play it, and use "..." or a right-click for the menu.
* Every page in Sonofuture, Liquid Glass, and Material Girl now has consistently-styled headers.
* Scenes are now listed in every theme's keyboard shortcuts.
* The 'No speakers found' page now shows Sonora's version number.

### Fixes

* It worked in S1, and now Apple Music correctly browses and searches on S2 (#32). Thanks to @jgorhan for reporting it.
* Sonos Radio on S2 no longer shows "No selections are available."
* An S2 service whose login has lapsed in the Sonos app now shows the caution badge instead of failing.
* After a network outage, every room picks up again within seconds of the network coming back. Before, some rooms stayed frozen until Sonora was restarted.
* Slow stations (like CBC Radio) now get more time to start playing instead of ending in an error.
* A station's art and name no longer flicker as it starts (Planet Radio), and slow station art shows right away (NTS Radio).
* A queued station that can't be reached now shows an error instead of silently skipping to the next song.
* Stations listed as collections, like Radio France's, open as folders instead of failing to play.
* Shelves and album lists show a folder in Liquid Glass, Sonofuture, Hi-Fi, Severed, and Material Girl, instead of the stack icon.
* Opening a service that can't be searched no longer takes over the search box.
* Letters like g and y are no longer cut off under "Next" in some themes.
* Hi-Fi's Tuner tile names sit centered on their icons.
* Severed's date and time fields, placeholder covers, and choice boxes are drawn in the phosphor instead of browser colors.
* The Sonos sign-in now stays alive perpetually instead of lapsing after a day.
* If one speaker doesn't answer a household browse, Sonora asks another.
* Sonora's update notice now requires a single button press to dismiss.  An accidental unfocused errant click at just the wrong time could mean you'd be running an old version of Sonora for months without ever knowing about the better life that awaited you.

## 1.2.0

### Added support for Scenes

Scenes are a way of setting a variety of content, volume levels, and tone settings in several different rooms with just one click.  Once you’ve created a few scenes, interacting with your Sonos system can become a single-button endeavor, not a drillfest through menus.  I built support for scenes over the course of a week based on my best guesses as to how they should work, so its implementation may not be ideal for your particular use case.  Please let me know if you’ve got any feedback on scenes over in the Discussions!

### Music service improvements

Many more music services can now be searched, browsed, and played with this release (Apple Music and SoundCloud work now), but some (YouTube Music, maybe others) can never fully work with Sonora due to their required use of Sonos’ own private keys.  Requiring Sonos’ own signing key is a design decision Sonos has made and Sonora is bound to respect it.  Sonora does not (and cannot) contain these keys.

### What’s new

* Scenes. One tap sets up a whole listening session: which rooms are grouped, each room’s volume and tone, and what plays where, for as long as you like or on a timer. Every theme supports scenes, and each has its own themed editor. Check the readme to learn more about how scenes work. Thanks to reddit user larryboy44 for the suggestion to add scenes to Sonora!
* Alarms can now activate scenes.  The Sonora server must be running for scene alarms to fire, so installing it on a laptop or a PC that you regularly power down is not recommended.
* Apple Music, SoundCloud, and other services that can only be linked in a Sonos app now browse, search, and play in Sonora, using the login your speakers already hold. These services also no longer need to be linked a second time in Sonora. Thanks to BookCatKid’s SoCo music-services fork for showing how this is possible.
* A service that only works with Sonos’ own apps (like YouTube Music) now says so instead of showing an error.
* Apple Music radio and other HLS stations now show what’s on, with the artist and album.
* Service rows have better placeholder art in many spots.
* The “This browser” room now takes Add to Queue, Play Next, and Sonos playlists.
* In the “This browser” room, a stream locked with DRM (like Apple Music radio) now shows the appropriate error message instead of playing silence.
* Severed: The Apply button lights up when you change the phosphor, key sounds, or color art.
* Mobile users can now access the easter egg.

### Fixes

* Rooms no longer disappear after Sonora sits idle and the network stops answering discovery (#24). Thanks to @hasifantasy for reporting it.
* S2 speakers on the “legacy device” firmware branch are no longer offered S2.1 updates that they can’t take (#23). Thanks to @Fabri1960 for reporting it.
* A factory-reset speaker no longer shows up as a second system.
* One slow service on S1 (frequently the CBC) no longer empties the whole list of music services.
* A room no longer appears twice for a moment while its group changes hands on S1.
* A station whose first item fails while the next one loads is no longer reported as failed.
* Group volume popovers, confirmation dialogs, and the Add Music Services icon match their theme in more of the desktop themes.
* Hi-Fi’s mute keys stay down the moment they’re pressed instead of double-pressing.
* Severed’s keyboard deck stays whole in narrow windows.
* Alarm times follow your system’s 12- or 24-hour setting in every theme.
* Severed’s alarm list keeps its columns lined up from row to row.
* A music library password can no longer end up in Sonora’s log.

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
