# Parts

The pieces a shell is arranged from.

A **shell** is a theme's layout: what is on the screen and where. A **part** is
one of the large things it places — the room list, the queue, the browse
column. Parts own their own behavior and reach the system store themselves;
a shell passes them what it has chosen (which room is active, which pane is
showing) and places them.

These lived in `app/themes/desktop/` until 2026-09-18, which made the Mac replica
both a theme and the library every Windows-family skin was built from, and put
the vocabulary a shell needs inside one theme where nobody could see it. Moving
them here changes no behavior; it makes the vocabulary a thing with a name.

**No built-in theme draws with these files.** Since 2026-10-03 each desktop
theme (Coromar, Windows, Mac, Outrun, Hot Dog Stand, Sedona, Solarized) carries
its own copy of every part and of the sheets that lay them out (`desktop.css`,
`window-chrome.css`, `responsive.css`), scoped to that theme, and Sonofuture
and Liquid Glass each carry their own `rail-shell.css`. A fix made here reaches
no theme; make it in the theme, and in each theme that should have it.
`tests/test_theme_layout.py` fails if a theme imports from this folder.

What stays here is the layout renderer's: the parts an installed package's
`layout` is drawn with, and their sheets, which apply only while
`:root[data-layout]` is set. The rules every theme's shared components need
(the busy spinner, the theme chooser, the time field) moved to
`components/shared.css`.

## The parts

| part | what it is |
| --- | --- |
| `Rooms` | The room list: every group in the household, what each is playing, transport on each row, grouping and EQ from the row, Pause All at the foot. |
| `Center` | Two exports. `NowPlaying` is the art, the track and its metadata for one room. `Queue` is that room's queue, with save, clear, and reordering. |
| `Browse` | The music column: services, favorites, playlists, the library, search results, and everything a service's own browse tree contains. The largest part by far. |
| `Transport` | The strip: volume for the active room or group, the transport buttons, progress, and the search field with its scope. |
| `PaneSwitch` | The three-tab row a narrow screen uses to show one pane at a time, with `PANES`, `isNarrowShell()` and `usePaneDirection()` beside it. |
| `Slider` | A commit-on-release slider, used for volume and for the tone controls. |

`responsive.css` is here too: it reflows a package layout below 937px, one pane
at a time behind `PaneSwitch`, keyed on the class names `dk-root`, `dk-panes`,
`dk-pane` and `dk-center`. Each desktop theme has its own copy.

## What a shell still has to do itself

Shrinking, one piece at a time. `lib/shellSelection.js` now holds the first:
which room is in view and which system the shell is filtered to, with the two
localStorage keys that used to be declared in five files and the group filter
that used to be written out verbatim in two.

`lib/transport.js` holds the second: what the play button does, which four
shells answered four ways and one of them got wrong. `lib/groups.js` holds the
third, the "<room> + 2" label. `lib/rooms.js` holds the fourth and the one the
Rooms part will be built on: which rooms exist, what a group's member zones
are, and how they fall into systems with the browser room last.

Two things deliberately did *not* converge, and the reason matters more than
the saving would have. `describeNowPlaying` and Sonofuture's `nowSummary`
compose the same fields differently -- one shows the track on a broadcast
station, the other the station over the show; one joins artist and album with
an em dash, the other with a middle dot. The Windows and Mac themes replicate
the S1 app, the web theme replicates play.sonos.com, and Sonofuture is
Sonora's own. Flattening them would be flattening three products into one.
What *is* shared underneath them -- `streamText` for the speaker's
`ZPSTR_BUFFERING` tokens, `streamFileName` for a file URI -- already was.

So the rule for this work: facts converge, compositions do not.

What a shell still carries itself:

- the dialog router — a dozen `kind === '…'` branches in the desktop shells,
  seventeen separate booleans in Sonofuture
- keyboard shortcuts, fullscreen, the Mini Controller, and its BroadcastChannel
- the narrow-viewport pane state and its slide direction
- Sonofuture's section, stage, queue drawer, and command palette

Overlays are deliberately not on that list. The two shells do not agree on
what a dialog *is* -- one has a single discriminated state, the other a flag
per overlay, and some of Sonofuture's coexist rather than replacing one
another -- and a layout does not describe them anyway. They stay with the
shell, which is what `useShellContext`'s `onOpen` is for.

## Writing a layout instead

`vocabulary.js` names the parts; `arrangement.js` is the format and its
validator; `Arrangement.jsx` draws one; `LayoutShell.jsx` is the shell an
installed theme gets when its package carries a layout. THEMES.md is the guide
for someone writing one.

Nothing that ships with Sonora draws through that path, so nothing here is
exercised by a person using a built-in theme. A maintainer's script outside the repository
keeps it honest: it builds a theme as a .zip, installs it through the
real gate, checks in Firefox that every part it placed was drawn and that its
stylesheet was applied, and removes it.

## Dialogs

`Dialogs.jsx` here is the layout renderer's copy (it draws `Confirm`,
`GroupRooms` and `TrackInfo` for a package), with `dialogs.css` under
`:root[data-layout]`. Until 2026-10-04 it lived in `components/` and every
desktop theme drew its windows from it, the Mac theme's Preferences window
included. Each desktop theme now has its own `Dialogs.jsx` and `dialogs.css`.
`useLibrarySettings`, which draws nothing and which Hi-Fi, Material Girl,
Sonofuture and Liquid Glass also use, moved to `lib/useLibrarySettings.js`.
