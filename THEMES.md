# Making a theme for Sonora

A theme is a **.zip**. Install it from Sonora's settings, under **Manage
Themes** → *Install theme…*, and remove it there with *Delete theme*. Where the
settings are depends on the theme being worn:

| theme | where the theme chooser is |
| --- | --- |
| Coromar, Windows, Outrun, Sedona, Hot Dog Stand, Solarized | Manage → Settings… → the Sonora page |
| macOS | the application menu (named for the controller) → Settings… → the Sonora page |
| Sonofuture, Liquid Glass, Material Girl | Settings → Appearance |
| Hi-Fi | the Function knob turned to Setup → Appearance |
| Sonos Web | Settings |
| a theme installed from a file | its `settings` part, or the Settings button Sonora adds (see *Your layout must be escapable*) |

The same thing over HTTP, for a build script:

    GET    /api/themes          the installed themes (the built-in ones are not listed)
    POST   /api/themes          install: the .zip as the raw request body
    DELETE /api/themes/<id>     remove one (a built-in theme cannot be removed)

Installing does not put the theme on. Which theme is worn is each browser's
own choice, kept in that browser: choosing one in the settings and pressing
*Apply* changes that browser only, and a browser whose chosen theme is later
deleted falls back to the default. *Apply* opens the new theme on its own theme
chooser, wherever that theme keeps it, so the next choice is one step away. Installing again with the same `id`
replaces the theme in place.

Three files, at the root of the archive:

    midnight.zip
    ├── theme.json       what is on screen, and what color
    ├── theme.css        how it is drawn, where color is not enough
    └── thumbnail.webp   a screenshot of it, 640×400

`theme.json` and the screenshot are both required. `theme.css` is optional. Put
all three at the root: nothing is read from a folder inside the archive, and
anything else in there is ignored.

**The two files divide the work.** `theme.json` sets the *structure* — which
parts are on screen, where, and how big — and the *palette*, as tokens the
interface already reads. Between them those decide most of what a theme looks
like, and a theme of only those two things is a complete theme.

`theme.css` is for what a palette cannot say: corner radius, borders, spacing,
type, shadows, and showing or hiding something the layout put there. It is ordinary
CSS against the running interface, and you write it only when you want
something the tokens do not offer.

A theme with a light and a dark way up may add `thumbnail-light.webp` and
`thumbnail-dark.webp` beside the first. Pictures may be `.webp`, `.png`,
`.jpg`, `.gif` or `.avif`.

The **layout** in `theme.json` is what makes this a theme rather than a
repaint — Sonora has no layout of its own to fall back on.

Three limits before you start.

**A theme is data, never code.** No JavaScript is read, loaded or run.

**A theme loads nothing from elsewhere.** Every `url()` in the stylesheet and
the tokens has to be a `data:` URL, and `@import` is refused, as is an
`image-set()` naming a file. Put a picture or a font inside the stylesheet as
a `data:` URL. A stylesheet that could fetch could also report what someone
types into a field, one character at a time, so Sonora refuses one that tries.

**A theme changes appearance, never wording.** There is no way for a file to
relabel a control, so an installed theme cannot make a button claim to do
something it does not do. The About Sonora view is the plainest case: style
and arrange it however you like, but a stylesheet that writes its own words
into it (`content:` with text, on a selector naming an `about-` class) is
refused at install.

**Behavior comes with the parts.** Restyling a part keeps what it does: every
slider, for example, follows the mouse wheel whatever it looks like (volume by
2 a notch, as in the Sonos desktop app). Covering a slider's range input with
another element, or `pointer-events: none` on it, takes that away.

## theme.json

| field | |
| --- | --- |
| `themeEngine` | `1.0` — which theme engine you wrote against. Any `1.x` is accepted. See below. |
| `id` | 3–32 characters of lowercase letters, digits, and hyphens, starting and ending with a letter or digit. Names the file on disk and keys your CSS. |
| `name` | What the chooser lists, up to 60 characters. |
| `version` | `1`, `1.2` or `1.2.3`. Shown beside the theme. Ship an update as the same `id` with a higher version. |
| `layout` | **Required.** Where the parts go. See below. |
| `tokens` | A flat map of name to value. Each becomes `--t-<name>` on the document. |
| `description` | Optional, a line or two under the name, up to 400 characters. |
| `colorScheme` | `light`, `dark`, or `light dark` to follow the system. |
| `variants` | Optional light and dark token sets. See *Light and dark*. |

The stylesheet and the screenshot are not fields: they are `theme.css` and
`thumbnail.webp` beside this file.

The archive must be under 2 MB, which is generous for a stylesheet and a
picture. Everything is checked when you install it, and a theme that is
refused is refused with the reason — read it, fix that one thing, install
again. The messages name the field and, for a layout, the exact node.

`theme.json` is strict JSON: double quotes, no trailing commas, and no
comments.

### Checking a theme before you install it

Your Sonora publishes the rules, so a theme can be checked without uploading
it and reading the refusal:

    GET /api/themes/schema      a JSON Schema for theme.json
    GET /api/themes/reference   the class names your stylesheet can use

The schema is generated from the same rules that accept or refuse an archive,
so a manifest that passes it will install. It also carries an
`x-sonora-archive` block naming the files that go in the .zip, since that is
the one thing a schema for `theme.json` cannot say.

The reference carries three things: every class name the parts render, grouped
by the part that renders it; every token name, with the core set marked; and a
placeholder picture to install with before you have a screenshot.

**The screenshot is yours to take.** Sonora cannot do it for you — it has no
way to run a theme it has not installed — so an archive without one is
refused, and the chooser would otherwise offer a blank card and a name. It
must be a real picture: a fabricated `data:` URL is refused, so this is the
one part of a theme that cannot be written, only taken.

If you have no screenshot yet, `GET /api/themes/reference` carries a real
640×400 placeholder as a data URL. Decode it into `thumbnail.webp`, install,
look at what you made, then screenshot it and install again over the same id —
the second install replaces the first. A made-up data URL will not do: the
first bytes are checked against the type it claims.

### `themeEngine`

Your theme says which engine it was written against, and this Sonora has
**1.1**. The point of the stamp is that your file outlives the version of
Sonora you wrote it on.

The major number is the compatibility line. It changes only when a theme
written against an earlier engine would no longer draw correctly, and a file
naming a different major is refused outright rather than drawn wrong — so an
old theme on a new Sonora tells its owner to fetch an update, instead of
rendering a mess. The minor number rises when something is added that existing
themes do not use, and any minor of the right major is read: a theme declaring
`1.0` keeps working on 1.4. Reading is not the same as accepting, though. A
Sonora checks every part, condition and prop against its own list, so a theme
that uses something added after that Sonora's version is refused there, and
the refusal names the thing it does not know.

| engine | added |
| --- | --- |
| 1.0 | everything in this guide not listed below |
| 1.1 | the `bestArt` prop on `nowPlaying` |

Write `1.0` unless you use something the table says needs a later one, so that
the theme installs on as many Sonoras as it can.

## A complete theme

`theme.json`:

```json
{
  "themeEngine": "1.0",
  "id": "midnight",
  "name": "Midnight",
  "version": "1",
  "description": "Blue-black, shown under the name in the chooser.",
  "colorScheme": "dark",
  "layout": {
    "root": {
      "region": "column",
      "children": [
        { "part": "transport" },
        { "part": "paneSwitch", "when": { "narrow": true } },
        { "region": "row", "grow": true, "children": [
            { "part": "rooms", "width": 280, "when": { "paneRooms": true } },
            { "region": "column", "grow": true, "when": { "paneNow": true }, "children": [
                { "part": "nowPlaying" },
                { "part": "queue", "grow": true, "scroll": true }
            ] },
            { "part": "browse", "width": 400, "when": { "paneMusic": true } }
        ] }
      ]
    }
  },
  "tokens": {
    "bg": "#0b1120",
    "surface": "#111a2e",
    "surface-hover": "#1b2740",
    "surface-active": "#16203a",
    "fg": "#dbe6ff",
    "fg-muted": "#8ea2c8",
    "fg-dim": "#5f7098",
    "border": "#1e2b47",
    "accent": "#4f8dff",
    "accent-fg": "#ffffff",
    "tile-selected": "#1d3157",
    "tile-selected-edge": "#24406f",
    "tile-selected-fg": "#dbe6ff"
  }
}
```

`theme.css`:

```css
:root[data-theme='midnight'] .dk-tile { border-radius: 10px; }
```

Zip those two together with a screenshot and that is a theme:

    zip midnight.zip theme.json theme.css thumbnail.webp

Everything below is about doing more than that.

## The layout

A tree of **regions** holding **parts**.

### Parts

| part | |
| --- | --- |
| `rooms` | The rooms, and which one is in view. |
| `nowPlaying` | What that room is playing: art, title, metadata. |
| `queue` | Its queue, with save, clear, and reordering. |
| `browse` | Music: services, favorites, playlists, the library, search. |
| `transport` | Volume, the transport buttons, progress, and search. |
| `paneSwitch` | The tab row a narrow window uses to show one pane at a time: Rooms, Now Playing, Music. It answers the `pane…` conditions below. |
| `settings` | Sonora's settings, including the theme chooser. |

Each part is given what it needs — the room in view, the search, the callbacks
that open dialogs. A layout cannot reach into any of that. It says where things
go; Sonora says what they are looking at.

### Regions and sizing

**Regions** are `column`, `row` or `stack`. Stack puts children on top of one
another, the last in front.

**Sizing** is `width`, `height`, `grow` and `scroll`, on any node. A node with
none takes the space it needs; `grow: true` shares out what is left;
`scroll: true` gives that node its own scrollbar. The root fills the window
whether you say so or not. Nesting stops at twelve deep.

A node may also carry a `key`, which matters only if you reorder siblings
between conditions and want a part to keep its state across the move.

### Conditions

Any node may carry a `when`, and is drawn only if every fact in it matches.

| fact | true when |
| --- | --- |
| `narrow` | the window is under 937px, too narrow for more than one pane. Re-read as the window is resized. |
| `paneRooms` | the window is wide, or it is narrow and the `paneSwitch` tabs chose Rooms |
| `paneNow` | the window is wide, or it is narrow and the tabs chose Now Playing (the first choice) |
| `paneMusic` | the window is wide, or it is narrow and the tabs chose Music |
| `roomSelected` | a room is in view |
| `grouped` | that room is playing with others |
| `queued` | that room has a queue |
| `signedIn` | a Sonos account is signed in |
| `manySystems` | both an S1 and an S2 system were found |

Every fact is `true` or `false`. The three `pane…` facts are what make one
layout serve both widths: put each pane's node under its own one, as the
example above does, and at full width all three show while a narrow window
shows the one its tabs chose.

They are facts, not expressions. A layout is checked and then drawn, and
something that can compute is neither checkable nor data.

### Props

A node may set a part's props under `props`. There are five:

| part | prop | |
| --- | --- | --- |
| `rooms` | `plainNames` | `true` or `false`. Room names undecorated. |
| `nowPlaying` | `bestArt` | `true` or `false`. Ask for the largest copy of the cover the source has. Engine 1.1. |
| `queue` | `expanded` | `true` or `false`. Open the queue rather than collapsing it. |
| `transport` | `remainingTime` | `true` or `false`. Count down to the end of the track instead of up from its start. |
| `settings` | `variant` | `"panel"` or `"page"`. |

Anything else, or a value of the wrong kind, is refused by name.

**`bestArt`** is for a theme that draws the cover large. Without it, Sonora
fetches the picture the speaker or the service names, which is often far
smaller than what the service holds: a Plex cover named at 300px from a
1500px original, a Sonos Radio cover at 200px. With it, Sonora asks for a
copy as large as the art is drawn, in three ways and in this order: the size
table a music service may publish for its art, then the size the picture's
URL asks for (`w=`, `width=`, `height=` and the like) raised, then the
picture as named. None of it is written for one service, and nothing is
enlarged by Sonora itself, so a cover that only exists small stays small
(Libby's, for one). Leave it off for art drawn at its usual size: the
larger copy costs more to fetch and decode and shows nothing more there.

### Mistakes

A layout is checked when you install it, which refuses the file with the
reason, and again before it is drawn, which shows the problems in place of the
interface rather than an empty window. Every problem names its path:

    root.children[1].props: "rooms" takes no "color" (it takes plainNames)

That path and the `data-path` a node carries in the page (see *The
stylesheet*) name the same node two ways: `root.children[1].children[0]` is
`root.1.0`.

### Your layout must be escapable

A layout decides what is on the screen, so one that offers no way out would
strand whoever installed it. Place the `settings` part wherever suits you. If
you place none, Sonora draws a small **Settings** button in the bottom corner
over your layout. It is not an error — it is there so that choosing a theme is
never a one-way door. It sits over whatever your layout has in that corner, so
a layout with no `settings` part should leave the bottom right clear.

When someone chooses your theme and presses *Apply*, it opens on the theme
chooser: a `settings` part you placed is scrolled into view, and without one
the Settings button opens with its chooser showing.

### Overlays are not yours

Dialogs, sheets, transient messages, and the Mini Controller are not part of a
layout. A file carries no code, so it cannot bring them; when a part asks to
open one, Sonora answers.

## Tokens

A token is a named value, almost always a color. Set them in `tokens`, and
each is published as a CSS custom property that the interface reads:

```json
"tokens": { "bg": "#0b1120", "fg": "#dbe6ff" }
```

```css
.dk-pane { background: var(--t-bg); color: var(--t-fg); }
```

Most of a theme is choosing values. These are the ones that carry the
interface; set these before anything else.

| token | paints |
| --- | --- |
| `--t-fg` | text |
| `--t-fg-muted` | second lines, labels, anything deliberately quieter |
| `--t-fg-dim` | quieter still: hints, disabled text |
| `--t-bg` | the window behind everything |
| `--t-surface` | panels, cards, rows |
| `--t-surface-hover` | a surface under the pointer |
| `--t-surface-active` | a surface being pressed or currently chosen |
| `--t-border` | ordinary rules and edges |
| `--t-border-strong` | edges that need to be seen: inputs, focused boxes |
| `--t-accent` | the color the theme is *about*: selection, links, the play button |
| `--t-accent-fg` | text drawn on the accent |
| `--t-focus` | the keyboard focus ring |
| `--t-font` | the interface font stack |
| `--t-mono` | the monospaced stack, for addresses and versions |

Rows and tiles take `--t-tile`, `--t-tile-edge`, `--t-tile-hover`,
`--t-tile-selected`, `--t-tile-selected-edge`, `--t-tile-selected-fg`,
`--t-row-hover`, `--t-row-selected` and `--t-row-playing`. A room's tile is
filled with `--t-tile` under a 25px fade from its `-edge` color at the top,
so an edge is a highlight across the tile's head rather than a border; give
it the same value as the fill for a flat tile. `--t-tile-hover` and its
`-hover-edge`, and `--t-tile-selected` and its `-selected-edge`, do the same
for the tile under the pointer and the room in view. Sliders take
`--t-slider-track`, `--t-slider-fill` and `--t-thumb`. Diagnostics take
`--t-good`, `--t-fair`, `--t-poor`, `--t-critical` and `--t-info`, which should
stay distinguishable from each other and from `--t-fg`.

`--t-tile-selected-fg` is the one to watch: it is the text of the room in
view, and without it that text is `--t-fg`. A theme whose selected tile is the
opposite of its surfaces, dark on a light theme or light on a dark one, must
set it or the room's name disappears into its tile. In a stylesheet the room in
view is `.dk-tile[aria-pressed='true']`.

The table above is the core of it, and `GET /api/themes/reference` lists the
whole core set under `tokens.core` — the header, strip, menu and menu-bar
tokens among them — as well as every token any part reads under
`tokens.all`.

Any token you set is published whether or not the interface reads it, so you
can use `var(--t-whatever)` in your own stylesheet for values of your own.

## The stylesheet

You may not need one. Between the layout and the tokens, `theme.json` has
already said what is on screen and what color it is; `theme.css` is for the
rest — radius, borders, spacing, type, shadows, and hiding or reshaping
something the tokens have no word for.

It is plain CSS, applied to the whole document while your theme is worn. There
is no build step, no preprocessor and no scoping done for you.

Scope every rule to your own theme, by the attribute on the root element:

```css
:root[data-theme='midnight'] .dk-tile { border-radius: 10px; }
```

Scope it that way rather than by a class inside the page. Menus, sheets,
dialogs and the Mini Controller are drawn outside your layout, and only an
attribute on the root reaches them.

The renderer gives you stable hooks. The root is `.pt-root`; every region is
`.pt-region` plus `.pt-column`, `.pt-row` or `.pt-stack`; every part is
`.pt-part` plus `.pt-part-rooms`, `.pt-part-queue` and so on.

Each node also carries a `data-path` naming its position in your layout: the
root is `root`, its children are `root.0`, `root.1` and so on, and a child of
`root.2` is `root.2.0`. The number is the node's place in the `children` array
you wrote, so a sibling hidden by a `when` leaves its number unused rather than
shifting the others. A rule can therefore reach one node without treating every
part alike:

```css
:root[data-theme='midnight'] [data-path='root.2.0'] { border-right: 2px solid var(--t-accent); }
```

Inside a part, the class names are Sonora's own, prefixed `dk-`. There are
several hundred; these are the ones worth knowing, by the part they are in.

| part | class | |
| --- | --- | --- |
| any | `.dk-pane` | a pane's whole column |
| any | `.dk-header` | the bar at the top of a pane |
| any | `.dk-header-title` | its title |
| any | `.dk-footer` | the bar at the bottom of a pane |
| any | `.dk-scroll` | the scrolling area inside a pane |
| any | `.dk-empty` | the "nothing here" message |
| any | `.dk-popover` | a menu opened from a control |
| any | `.dk-menu-item` | a row in one |
| `rooms` | `.dk-tile` | one room |
| `rooms` | `.dk-tile-group` | a room playing with others |
| `rooms` | `.dk-tile-indicator` | its playing/paused mark |
| `rooms` | `.dk-tile-battery` | a portable room's battery: a `.sn-battery-glyph` and `.sn-battery-text`, with `data-low` at 10% or less and `data-charging` on wall power |
| `rooms` | `.dk-rooms-list` | the list of them |
| `nowPlaying` | `.dk-now` | the whole pane |
| `nowPlaying` | `.dk-now-art` | the artwork |
| `nowPlaying` | `.dk-now-info` | title, artist, album |
| `nowPlaying` | `.dk-now-line` | one line of that |
| `queue` | `.dk-row` | one track |
| `browse` | `.dk-browse-row` | one row of music |
| `browse` | `.dk-browse-art` | its picture |
| `browse` | `.dk-browse-section` | a group of rows under a heading |
| `transport` | `.dk-strip-controls` | the transport buttons |
| `transport` | `.dk-btn-play` | the play button, and `-prev`, `-next` beside it |
| `transport` | `.dk-strip-progress` | the progress rail |
| `transport` | `.dk-strip-search` | the search field |
| `transport` | `.dk-slider` | a volume slider |
| `transport` | `.dk-mode` | shuffle, repeat, crossfade, and EQ |
| `paneSwitch` | `.dk-pane-switch` | the tab row |

That table is the part you are likely to want. `GET /api/themes/reference` on
your own Sonora has every one of them under `classes`, grouped the same way,
and under `styled` the ones Sonora's own stylesheet paints, which are the ones
worth reaching for first; the browser's inspector on your running theme is the
other way to find one.

Prefer a token to a rule wherever one exists. A color written into CSS is a
color that will not follow your light and dark variants, and will not be
there for the next thing Sonora draws with it.

## Light and dark

Settings offers Light, Dark or System. A theme takes part by declaring
`variants`: a light and a dark set of tokens laid over its base.

```json
"variants": {
  "light": { "tokens": { "bg": "#fdf6e3", "fg": "#657b83" }, "colorScheme": "light" },
  "dark":  { "tokens": {}, "colorScheme": "dark" }
}
```

Only the tokens that differ need listing. Add `thumbnail-light.webp` and
`thumbnail-dark.webp` to the archive and the chooser shows what each button
means. While a variant is
worn, `data-variant="light"` or `"dark"` is set on the root, so your stylesheet
can key rules on it:

```css
:root[data-variant='light'] .dk-pane { background: #eee8d5; }
```

`data-appearance` carries what the setting asked for whether or not your theme
answers to it. A theme with no `variants` has one look and keeps it.

## Before you publish it

- **Read every pane at every size.** Your layout reflows however you wrote it,
  and the parts inside it reflow below 937px on their own. Check at about 400px
  wide as well as full screen.
- **Check contrast with a measurement, not a look.** Anything you color with
  `--t-accent-fg`, `--t-tile-selected` or a `selected` rule deserves a number.
- **Hover, select and press every kind of row.** Rooms, browse rows, queue rows
  and menu items each have their own states, and a palette that works at rest
  can vanish under the pointer.
- **Take the screenshot last,** once the theme looks the way you want it.
