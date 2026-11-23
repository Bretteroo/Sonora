import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import * as G from './glyphs.jsx'
import * as L from './legends.jsx'
import { cx, idle } from './kit.jsx'
import { loadBookImages } from './images.js'
import { pad } from './songbook.jsx'
import { readPrefs } from './prefs.js'
import { pageFlaps } from './sound.js'

// The songbook: a white ring binder that comes down over the machine, opens,
// and lies across it a little askew. Its dividers are the music sources that
// list their artists; behind a divider the artists run from A, and behind an
// artist are the songs, each beside the number that asks for it. A source that
// can be searched has a ruled line on the first page behind its divider: a name
// written there is looked up, and the artist picked is filed in the binder.
//
// Everything is measured in the binder's own centimeters. One of them is
// --km-u pixels, the open binder is 57.4 by 32 of them, and a point is given
// from the middle of the spine: x to the right, z up.

const TILT = 4
const RAD = (TILT * Math.PI) / 180
const COS = Math.cos(RAD)
const SIN = Math.sin(RAD)
const HALF_W = 28.7
// Where a leaf's left edge lies on each side, as the stylesheet places it.
const LEAF_R = 29.6
const LEAF_L = 3.75
const HALF_H = 16

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']
const STEP = 75          // between one riffled leaf and the next
const LEAF = 380         // one riffled leaf, edge to edge
const TURN = 520         // one page turned by hand

const clamp = (n, low, high) => Math.min(high, Math.max(low, n))
const chunk = (list, size) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out }

// Where the binder rests at each step, for a window of this size. `limit` is
// the line it may not cross while open: below it are the number window and
// the number keys.
// A page's markup with the names on its lines swapped for ones drawn at random
// from the given pages, kind for kind. Null for a page with no lines of names.
const NAMED = ['.km-bk-artist', '.km-bk-name']
// A line too long for its column tells its whole name to the pointer resting on it; one that
// fits says nothing twice.
const whole = (e) => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth) el.title = el.textContent; else el.removeAttribute('title') }
function dealt(print, pool) {
  if (!print) return ''
  const read = (html) => { const el = document.createElement('template'); el.innerHTML = html || ''; return el.content }
  const page = read(print)
  const others = pool.map(read)
  let changed = false
  for (const kind of NAMED) {
    const names = others.flatMap((o) => [...o.querySelectorAll(kind)].map((el) => el.innerHTML))
    if (names.length < 2) continue
    for (let n = names.length - 1; n > 0; n -= 1) { const k = Math.floor(Math.random() * (n + 1)); [names[n], names[k]] = [names[k], names[n]] }
    page.querySelectorAll(kind).forEach((el, n) => { el.innerHTML = names[n % names.length]; el.removeAttribute('title'); changed = true })
  }
  if (!changed) return null
  const box = document.createElement('div')
  box.append(page)
  return box.innerHTML
}

// A page of artists as markup, its lines drawn at random from the names given.
function listed(names, rows, cols) {
  const safe = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  let body = ''
  for (let c = 0; c < cols; c += 1) {
    body += '<div class="km-bk-col">'
    for (let i = 0; i < rows; i += 1) body += `<button type="button" class="km-bk-artist" tabindex="-1" style="--n:${c * rows + i}">${safe(names[Math.floor(Math.random() * names.length)])}</button>`
    body += '</div>'
  }
  return `<div class="km-bk-page" data-kind="artists"><header class="km-bk-head"></header><div class="km-bk-body"><div class="km-bk-cols" style="--cols:${cols}">${body}</div></div><footer class="km-bk-foot"></footer></div>`
}

const SNUG = 1.08

function measure(size, W, H, faceTop) {
  const compact = size === 'compact'
  const top = 4
  const limit = Math.max(top + 120, faceTop - 5)
  const avail = limit - top
  // Laid flat the binder is turned by TILT, so its outline is taller and wider than its pages:
  // it is sized by that outline, which keeps every corner above the faceplate. The outline
  // allows more than the covers take, so the height's share is let out by SNUG, which brings
  // the low corner down near the plate.
  const u = compact
    ? Math.min((W - 6) / 25.85, (avail - 12) / (33.7 * COS + 25.85 * SIN))
    : Math.min(SNUG * (avail - 8) / (34.6 * COS + 60 * SIN), (W - 16) / (59.5 * COS + 34.6 * SIN))
  const middle = top + avail / 2
  // On a narrow window only the right-hand page is in view, the spine at the left edge. Where
  // such a window is wide enough for both covers, the open binder lies in the middle of it.
  const whole = compact && (59.5 * COS + 34.6 * SIN) * u <= W - 16
  const flat = compact && !whole ? { x: W / 2 - 13.9 * u, y: middle + 0.9 * u, r: -TILT, s: 1 } : { x: W / 2, y: middle, r: -TILT, s: 1 }
  const sc = Math.min(1, (W - 24) / (26.9 * u), (avail - 8) / (32.2 * u))
  const closed = { x: W / 2 - 15.475 * u * sc, y: middle, r: 0, s: sc }
  const away = 16.5 * u * sc + 30
  // The point p of the binder brought to the point q of the window, at scale s.
  const place = (p, q, s) => {
    const px = p.x * u * s
    const py = -p.z * u * s
    return { x: q.x - (px * COS + py * SIN), y: q.y - (-px * SIN + py * COS), r: -TILT, s }
  }
  // Close on the dividers, so that every name on them can be read.
  const zoom = (tabs) => {
    const span = tabs.count > 1 ? (tabs.count - 1) * tabs.pitch + tabs.width : tabs.width
    const s = compact ? clamp(W / ((span + 2.4) * u), 1, 1.6) : clamp(Math.min(W / (34 * u), avail / (21.8 * u)), 1.2, 1.9)
    const x = compact ? tabs.first + span / 2 : 12.6
    // On a narrow window the dividers stop short of the way out, which is at the window's corner.
    const clear = compact ? 72 : 0
    return place({ x, z: 16.9 - (avail / 2 - clear) / (u * s) }, { x: W / 2, y: middle }, s)
  }
  return { compact, u, W, limit, flat, closed, above: { ...closed, y: -away }, below: { ...closed, y: H + away }, zoom }
}

// How much a page holds. A row is never smaller than a finger or an eye can
// manage, so a small binder gets fewer rows, and a narrow page one column.
function density(u, compact) {
  const body = 21.9 * u
  const rows = Math.max(5, Math.floor(body / (compact ? Math.max(1.95 * u, 28) : Math.max(1.15 * u, 21))))
  const width = 19.45 * u
  return { rows, row: body / rows, cols: !compact && width >= 270 ? 2 : 1, tables: !compact && width >= 380 ? 2 : 1, per: compact ? 1 : 2 }
}

// The dividers along the top of the pages share the width there is.
function dividers(count) {
  const first = 2.9
  const last = 24.2
  const width = Math.min(4.2, Math.max(2.2, (last - first) / Math.max(1, count) - 0.12))
  const pitch = count > 1 ? Math.min(4.7, (last - first - width) / (count - 1)) : 0
  return { count, first, width, pitch }
}

// Signs standing alone need no more of a divider than a sign and a margin around it, and the
// dividers stand side by side.
function signDividers(count, sign) {
  const first = 2.9
  const last = 24.2
  const width = sign + 0.7
  const pitch = count > 1 ? Math.min(width + 0.25, (last - first - width) / (count - 1)) : 0
  return { count, first, width, pitch }
}

const fold = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const sortName = (title) => String(title || '').replace(/^the\s+/i, '').trim() || String(title || '')
const letterOf = (title) => { const c = fold(sortName(title)).charAt(0).toUpperCase(); return c >= 'A' && c <= 'Z' ? c : '#' }
const sameName = (title) => fold(String(title || '')).trim().toLowerCase()

const WAIT = 450         // after the last letter written, before it is looked up
const BLANK = { text: '', term: '', state: 'idle', artists: [], songs: [], note: '' }

// Which artists may go on the pages while the rest are still arriving. A service lists its
// artists in order of name, so once the unbroken run from the start of its list reaches a
// later letter, every letter before that one is complete: nothing still to come can join it,
// and as each letter starts a page of its own, the letters after it can be added without
// moving it. Names and numbers may come first or last, so they rank before A here. When the
// list turns out not to be in order (a service may file a few names otherwise), the letters
// already shown stay, and no more are added until all of it is in.
function settle(entry) {
  const rank = (letter) => (letter === '#' ? -1 : LETTERS.indexOf(letter))
  let n = entry.run
  while (n < entry.slots.length && entry.slots[n] !== undefined) {
    const item = entry.slots[n]
    if (item) {
      const r = rank(letterOf(item.title))
      if (r < entry.lastRank) entry.inOrder = false
      entry.lastRank = Math.max(entry.lastRank, r)
    }
    n += 1
  }
  if (n === entry.run) return
  entry.run = n
  if (!entry.inOrder) return
  const complete = entry.slots.slice(0, n).filter((item) => item && rank(letterOf(item.title)) < entry.lastRank)
  if (complete.length !== (entry.shown?.length || 0)) entry.shown = complete
}

// What the ruled line found, laid onto pages in one column: the artists, and under them the
// songs. The first page has the rows the line leaves it, the ones after it are whole, and
// there are as many as it takes. Each kind has a heading wherever a page takes it up, and the
// songs start on a page only where a heading and one of them fit.
function layoutFound(artists, songs, first, full) {
  const pages = []
  let a = 0
  let b = 0
  do {
    let room = pages.length ? full : first
    let na = 0
    let nb = 0
    if (a < artists.length) {
      na = Math.min(artists.length - a, room - 1)
      room -= na + 1
    }
    if (a + na >= artists.length && b < songs.length && room >= 2) nb = Math.min(songs.length - b, room - 1)
    // A whole page that takes nothing would never end the run.
    if (pages.length && !na && !nb) break
    pages.push({ artists: artists.slice(a, a + na), songs: songs.slice(b, b + nb), from: a + b })
    a += na
    b += nb
  } while (a < artists.length || b < songs.length)
  return pages
}

// The artists as lines down the columns. Each letter begins on a page of its
// own, its heading at the top, and runs on to as many pages as it needs.
function layoutArtists(sorted, rows, cols) {
  const pages = []
  const letterPage = {}
  const size = rows * cols
  let group = []
  const flush = () => {
    if (!group.length) return
    letterPage[group[0].letter] = pages.length
    const lines = [{ kind: 'head', letter: group[0].letter }, ...group.map((a) => ({ kind: 'artist', id: a.id, title: a.title, letter: a.letter }))]
    for (const page of chunk(lines, size)) pages.push(chunk(page, rows))
    group = []
  }
  for (const artist of sorted) {
    if (group.length && artist.letter !== group[0].letter) flush()
    group.push(artist)
  }
  flush()
  return { pages, letterPage }
}

function Logo({ tab, size }) {
  if (tab.kind === 'library' || !tab.icon) return <L.Folder size={size} className="km-bk-logo" />
  return <img className="km-bk-logo" src={tab.icon} alt="" style={{ width: size, height: size }} />
}

// A divider with no room for its name shows its sign alone. A service that
// gives no sign of its own is known by the start of its name.
function Sign({ tab, name, size }) {
  if (tab.kind === 'library' || tab.icon) return <Logo tab={tab} size={size} />
  return <span className="km-bk-initials">{Array.from(name).slice(0, 2).join('')}</span>
}

const Binder = forwardRef(function Binder({ zone, size, full = false, onPick, onClosed, alert = null }, ref) {
  const { t, language } = useI18n()
  const calm = useMemo(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  const touch = useMemo(() => !!window.matchMedia?.('(pointer: coarse)').matches, [])
  const layer = useRef(null)
  const bookEl = useRef(null)
  const [geo, setGeo] = useState(null)
  const [pose, setPose] = useState({ at: 'above', ms: 0, ease: 'linear' })
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [view, setView] = useState('tabs')
  const [tabs, setTabs] = useState([])
  const [pending, setPending] = useState(true)
  const [tab, setTab] = useState(null)
  const [artist, setArtist] = useState(null)
  const [spread, setSpread] = useState(0)
  const [turn, setTurn] = useState(null)
  const [riffle, setRiffle] = useState(null)
  const restedUpTo = useRef(-1)
  const [leftStack, setLeftStack] = useState(false)
  const [ink, setInk] = useState(true)
  const [picked, setPicked] = useState(0)
  const [cut, setCut] = useState('')
  const [chosen, setChosen] = useState(null)
  const [asked, setAsked] = useState(null)
  const [write, setWrite] = useState(BLANK)
  const [got, setGot] = useState({})
  const [filing, setFiling] = useState('')
  const writeSeq = useRef(0)
  const writeTimer = useRef(0)
  const measured = useRef(0)
  const remeasure = useRef(null)
  const gauge = useRef(null)
  const letterGo = useRef(null)
  const [, setTick] = useState(0)
  const store = useRef({ artists: new Map(), songs: new Map() })
  const artistsSpread = useRef(0)
  const seq = useRef(0)
  const live = useRef(true)
  const swiped = useRef(0)
  const wheeled = useRef(0)
  const now = useRef({})
  const timers = useRef(new Set())

  const bump = useCallback(() => { if (live.current) setTick((n) => n + 1) }, [])
  // A wait that belongs to the motion: next to nothing when motion is turned down.
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => { timers.current.delete(id); fn() }, calm ? Math.round(ms / 50) : ms)
    timers.current.add(id)
    return id
  }, [calm])
  useEffect(() => {
    live.current = true
    const held = timers.current
    return () => { live.current = false; for (const id of held) clearTimeout(id); held.clear(); clearTimeout(writeTimer.current) }
  }, [])

  // --- where it lies ------------------------------------------------------------------
  useLayoutEffect(() => {
    const read = () => {
      const root = layer.current?.closest('.km-root')
      if (!root) return
      // The binder lies in its own layer, which is the whole window except where the faceplate
      // stands beside the screen: there it is the part of the window the plate leaves.
      const box = layer.current.getBoundingClientRect()
      // A phone's keyboard coming up makes the window shorter and no narrower. The binder is
      // left as it lies while its line is being written on: laid out again for the shorter
      // window it would shrink under the hand.
      if (touch && document.activeElement?.classList?.contains('km-bk-line-in') && Math.abs(box.width - measured.current) < 1) return
      measured.current = box.width
      // Full screen has no faceplate: the number window stands alone at the foot, and the binder keeps above it.
      const face = (root.querySelector('.km-face')?.getBoundingClientRect().height ? root.querySelector('.km-face') : root.querySelector('.km-full-number'))?.getBoundingClientRect()
      setGeo(measure(size, box.width, box.height, face?.height && face.left < box.right - 1 ? face.top - box.top : box.height))
    }
    read()
    remeasure.current = read
    window.addEventListener('resize', read)
    // The faceplate can settle after this first reading (the shell sizes itself once this is
    // already laid out), with no window resize to say so: its own size changing says it.
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(read) : null
    const root = layer.current?.closest('.km-root')
    for (const el of [layer.current, root, root?.querySelector('.km-face'), root?.querySelector('.km-full-number')]) if (el) watch?.observe(el)
    document.fonts?.ready?.then(() => { if (live.current) read() })
    return () => { window.removeEventListener('resize', read); watch?.disconnect() }
  }, [size, touch, full])

  const go = useCallback((at, ms, ease = 'cubic-bezier(0.45, 0, 0.2, 1)') => setPose({ at, ms, ease }), [])

  // In from above shut, a breath, then open and flat, then close on the dividers.
  useEffect(() => {
    let mine = true
    Promise.race([loadBookImages(), new Promise((done) => setTimeout(done, 1200))]).then(() => {
      if (!mine) return
      later(() => go('closed', 750, 'cubic-bezier(0.2, 0.8, 0.3, 1)'), 40)
      later(() => { if (now.current.closing) return; setOpen(true); go('flat', 1100) }, 1340)
      later(() => { if (!now.current.closing && now.current.view === 'tabs') go('zoom', 700) }, 2600)
    })
    bookEl.current?.focus?.({ preventScroll: true })
    return () => { mine = false }
  }, [later, go])

  // --- what is in it ------------------------------------------------------------------
  // The dividers. A source is looked through the first time it is asked about,
  // which takes a while, so the list is read again until none is still waiting.
  useEffect(() => {
    let mine = true
    let timer = 0
    let misses = 0
    const read = async () => {
      let more = false
      try {
        const got = await api.songbookTabs(zone)
        if (!mine) return
        setTabs(got.tabs || [])
        more = !!got.pending
        misses = 0
      } catch {
        misses += 1
        more = misses < 3
      }
      if (!mine) return
      setPending(more)
      if (more) timer = setTimeout(read, 2000)
    }
    read()
    return () => { mine = false; clearTimeout(timer) }
  }, [zone])

  const loadArtists = useCallback((source) => {
    const held = store.current.artists
    if (held.has(source.id)) return
    // `slots` keeps each artist at its place in the source's own list, so the run of it with
    // nothing missing can be told; `shown` is what of that run may go on the pages.
    // `extra` is what the binder holds beside that list: artists found among what the account
    // has saved, and artists written in and filed.
    const entry = { raw: [], seen: new Set(), slots: [], run: 0, lastRank: -2, inOrder: true, shown: null, extra: [], done: false, failed: false }
    held.set(source.id, entry)
    const add = (items, start = 0) => {
      ;(items || []).forEach((item, i) => {
        const fresh = item?.id && !entry.seen.has(item.id)
        if (fresh) { entry.seen.add(item.id); entry.raw.push(item) }
        entry.slots[start + i] = fresh ? item : null
      })
      entry.raw = [...entry.raw]
      settle(entry)
      bump()
    }
    // A local library answers at once and can be read in long pages, several
    // at a time; a service is asked for less at once and by fewer hands.
    const page = source.kind === 'library' ? 500 : 100
    const hands = source.kind === 'library' ? 4 : 2
    ;(async () => {
      try {
        const head = await api.songbookArtists(source.id, zone, 0, page)
        entry.extra = head.extra || []
        add(head.items, 0)
        const total = head.total || 0
        const read = head.read ?? (head.items || []).length
        if (total > read && read > 0) {
          const ranges = []
          for (let start = read; start < total; start += page) ranges.push([start, Math.min(page, total - start)])
          const work = async () => {
            while (ranges.length && live.current) {
              const [start, count] = ranges.shift()
              const got = await api.songbookArtists(source.id, zone, start, count)
              add(got.items, start)
              const n = got.read ?? (got.items || []).length
              if (n > 0 && n < count && start + n < total) ranges.unshift([start + n, count - n])
            }
          }
          await Promise.all(Array.from({ length: hands }, work))
        } else if (!total && read >= page) {
          for (let start = read; live.current; ) {
            const got = await api.songbookArtists(source.id, zone, start, page)
            const n = got.read ?? (got.items || []).length
            if (!n) break
            add(got.items, start)
            start += n
          }
        }
      } catch {
        if (!entry.raw.length) entry.failed = true
      }
      entry.done = true
      if (entry.failed) held.delete(source.id)
      bump()
    })()
    return entry
  }, [zone, bump])

  // An artist just filed goes on the pages without the list being read again.
  const fileLocally = useCallback((sourceId, who) => {
    const entry = store.current.artists.get(sourceId)
    if (!entry || !who?.id) return
    entry.extra = [...entry.extra.filter((item) => item.id !== who.id), { id: who.id, title: who.title || '', filed: true }]
    bump()
  }, [bump])

  const songsKey = (source, who) => `${source.id}|${who.id}`
  const loadSongs = useCallback((source, who) => {
    const held = store.current.songs
    const key = songsKey(source, who)
    if (held.has(key)) return
    const entry = { items: [], done: false, failed: false }
    held.set(key, entry)
    api.songbookSongs(source.id, who.id, who.title, zone)
      .then((got) => { entry.items = (got.items || []).filter((song) => song?.number) })
      .catch(() => { entry.failed = true; held.delete(key) })
      .finally(() => { entry.done = true; bump() })
  }, [zone, bump])

  const collator = useMemo(() => {
    try { return new Intl.Collator(language, { sensitivity: 'base', numeric: true }) } catch { return new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }) }
  }, [language])
  const count = useMemo(() => { try { return new Intl.NumberFormat(language) } catch { return new Intl.NumberFormat() } }, [language])

  const D = useMemo(() => density(geo?.u || 16, !!geo?.compact), [geo])
  const artistsEntry = useRef(null)
  if (tab) artistsEntry.current = store.current.artists.get(tab.id) || artistsEntry.current
  const artistsOf = tab ? store.current.artists.get(tab.id) || (artistsEntry.current?.failed ? artistsEntry.current : null) : null
  // What goes on the pages: every artist once all are in; before that, the letters already
  // complete (see settle()), which nothing still to come can move.
  const listedArtists = artistsOf?.done ? artistsOf.raw : artistsOf?.shown?.length ? artistsOf.shown : null
  const filling = Boolean(artistsOf && !artistsOf.done)
  const extraArtists = artistsOf?.extra
  // The source's own list with what the binder adds to it. An artist filed stands in for one
  // of the same name on the list, and one from the list for one found among what is saved:
  // the filed page is the one with all of the artist's songs. While the list is still
  // arriving an added artist joins only a letter that is already on the pages.
  const rawArtists = useMemo(() => {
    if (!listedArtists || !extraArtists?.length) return listedArtists
    const letters = filling ? new Set(listedArtists.map((item) => letterOf(item.title))) : null
    const fits = (item) => item?.id && (!letters || letters.has(letterOf(item.title)))
    const ids = new Set()
    const names = new Set()
    const out = []
    for (const item of extraArtists) {
      if (!item.filed || !fits(item) || ids.has(item.id)) continue
      ids.add(item.id)
      names.add(sameName(item.title))
      out.push(item)
    }
    for (const item of listedArtists) {
      if (ids.has(item.id) || names.has(sameName(item.title))) continue
      out.push(item)
    }
    for (const item of listedArtists) { ids.add(item.id); names.add(sameName(item.title)) }
    for (const item of extraArtists) {
      if (item.filed || !fits(item) || ids.has(item.id) || names.has(sameName(item.title))) continue
      ids.add(item.id)
      out.push(item)
    }
    return out
  }, [listedArtists, extraArtists, filling])
  const writes = !!tab?.search
  const found = useMemo(
    () => layoutFound(write.artists, write.songs, Math.max(2, Math.floor(D.rows - (D.per === 2 ? 3 : 2.5))), D.rows),
    [write.artists, write.songs, D.rows, D.per],
  )
  const arrived = (letter) => !filling || artistLayout.letterPage[letter] != null
  const artistLayout = useMemo(() => {
    let laid = { pages: [], letterPage: {} }
    if (rawArtists) {
      const rank = (letter) => LETTERS.indexOf(letter)
      const sorted = rawArtists.map((item) => ({ id: item.id, title: item.title || '', name: sortName(item.title), letter: letterOf(item.title) }))
        .sort((a, b) => rank(a.letter) - rank(b.letter) || collator.compare(a.name, b.name))
      laid = layoutArtists(sorted, D.rows, D.cols)
    }
    if (!writes) return laid
    // The page with the ruled line is the first behind the divider, before the letters, and
    // what the line found that it has no room for runs on behind it.
    const letterPage = {}
    for (const [letter, at] of Object.entries(laid.letterPage)) letterPage[letter] = at + found.length
    return { pages: [[[{ kind: 'write' }]], ...found.slice(1).map((part) => [[{ kind: 'found', part }]]), ...laid.pages], letterPage }
  }, [rawArtists, writes, found, D.rows, D.cols, collator])

  const songsEntry = useRef(null)
  if (tab && artist) songsEntry.current = store.current.songs.get(songsKey(tab, artist)) || songsEntry.current
  const songsOf = tab && artist ? store.current.songs.get(songsKey(tab, artist)) || (songsEntry.current?.failed ? songsEntry.current : null) : null
  const rawSongs = songsOf?.items
  const songLayout = useMemo(() => {
    if (!rawSongs) return { pages: [] }
    const sorted = [...rawSongs].sort((a, b) => collator.compare(a.title || '', b.title || '') || a.number - b.number)
    return { pages: chunk(chunk(sorted, D.rows - 1), D.tables) }
  }, [rawSongs, D.rows, D.tables, collator])

  // An artist's pages are numbered under the page that lists the artist: 14-1, 14-2, and on.
  // An artist the list does not hold (one a search found) has pages numbered on their own.
  const artistPage = useMemo(() => {
    if (!artist) return 0
    return artistLayout.pages.findIndex((page) => page.some((column) => column.some((line) => line.kind === 'artist' && line.id === artist.id))) + 1
  }, [artist, artistLayout])
  const pageNo = (v, index) => (v === 'songs' && artistPage ? `${artistPage}-${index + 1}` : String(index + 1))

  const pagesOf = (v) => (v === 'artists' ? artistLayout.pages : v === 'songs' ? songLayout.pages : [])
  const spreads = Math.max(1, Math.ceil(pagesOf(view).length / D.per))
  const shown = Math.min(spread, spreads - 1)
  const busy = !!(turn || riffle)
  const usable = open && !closing
  now.current = { view, closing, shown, spreads, busy, usable, tab: tab?.id }

  // --- turning pages ------------------------------------------------------------------
  // What a page shows at this moment, as markup: the leaves of a run take
  // it along, so real pages are seen to go by.
  const printOf = (side) => {
    const paper = bookEl.current?.querySelector(`.km-bk-sheet-${side} > .km-bk-paper`)
    if (!paper?.firstChild) return ''
    const copy = paper.cloneNode(true)
    copy.querySelectorAll('[data-ink]').forEach((el) => el.removeAttribute('data-ink'))
    copy.querySelectorAll('button').forEach((el) => { el.tabIndex = -1 })
    const fields = paper.querySelectorAll('input')
    copy.querySelectorAll('input').forEach((el, i) => { el.setAttribute('value', fields[i]?.value || ''); el.setAttribute('readonly', ''); el.tabIndex = -1 })
    return copy.innerHTML
  }

  const startRiffle = useCallback((dir, leaves = 7, step = STEP) => {
    setInk(false)
    if (calm) return 0
    const id = ++seq.current
    setTurn(null)
    const was = { r: printOf('r'), l: printOf('l') }
    // The first leaf up is the page that was open. Every face after it is that
    // page's layout with the names of both open pages dealt out afresh, so no
    // two leaves going by read the same.
    // A page with no lines of names on it (the list of sources, the page that
    // is written on) is not seen again and again: the leaves after it are
    // pages of artists already read from any source, or lines of print when
    // none has been read yet.
    const pool = [was.r, was.l]
    const known = []
    for (const entry of store.current.artists.values()) for (const item of entry.raw?.length ? entry.raw : entry.shown || []) if (item?.title) known.push(item.title)
    const faces = (print) => Array.from({ length: leaves }, () => dealt(print, pool) ?? (known.length >= D.rows ? listed(known, D.rows, D.cols) : ''))
    const out = dir > 0 ? 'r' : 'l'
    const under = dir > 0 ? 'l' : 'r'
    const rising = faces(was[out])
    rising[0] = was[out]
    setRiffle({ dir, leaves, step, id, was, rising, landing: faces(was[under] || was[out]) })
    // Pages flying by are heard, under the same switch as the keys.
    if (readPrefs().keySound) pageFlaps(leaves, step, LEAF)
    const ms = (leaves - 1) * step + LEAF
    // The first leaf is down a moment before it is taken away: what it carried
    // across is then drawn where it landed.
    later(() => setRiffle((cur) => (cur?.id === id ? { ...cur, landed: true } : cur)), LEAF - 40)
    later(() => setRiffle((cur) => (cur?.id === id ? null : cur)), ms)
    return ms
  }, [calm, later, D])

  // Pages that are already in are printed on the paper the run arrives at,
  // there under the leaves as they go by. Only a page still being read from
  // its source is inked in, when its names come.
  const waiting = view === 'artists' ? !artistsOf || (!artistsOf.done && !artistsOf.shown?.length) : view === 'songs' ? !songsOf || !songsOf.done : false
  useEffect(() => { if (waiting) setInk(true) }, [waiting, riffle?.id])
  // The last leaf to come down is the page the run arrives at, so nothing
  // changes on it when the leaves are taken away.
  useLayoutEffect(() => {
    if (!riffle || riffle.last != null) return
    const id = riffle.id
    const last = printOf(riffle.dir > 0 ? 'l' : 'r')
    setRiffle((cur) => (cur?.id === id ? { ...cur, last } : cur))
  }, [riffle])

  const goSpread = useCallback((to, quick = false) => {
    const state = now.current
    const target = clamp(to, 0, state.spreads - 1)
    if (target === state.shown || state.busy || !state.usable) return
    if (calm || quick) { setInk(false); setSpread(target); return }
    if (Math.abs(target - state.shown) === 1) {
      const id = ++seq.current
      setInk(false)
      setTurn({ dir: target > state.shown ? 1 : -1, from: state.shown, to: target, id })
      later(() => { setTurn((cur) => (cur?.id === id ? null : cur)); setSpread(target) }, TURN)
    } else {
      startRiffle(target > state.shown ? 1 : -1, 4)
      setSpread(target)
    }
  }, [calm, later, startRiffle])

  // --- the ruled line ------------------------------------------------------------------
  const clearWrite = () => {
    clearTimeout(writeTimer.current)
    writeSeq.current += 1
    setWrite(BLANK)
    setGot({})
    setFiling('')
  }

  const lookUp = (source, term) => {
    clearTimeout(writeTimer.current)
    const id = ++writeSeq.current
    setWrite((cur) => ({ ...cur, state: 'busy' }))
    const answer = (found) => { if (live.current && writeSeq.current === id) setWrite((cur) => ({ ...cur, ...found, term })) }
    const rows = (res) => ({ artists: (res.artists || []).filter((item) => item?.id), songs: (res.songs || []).filter((item) => item?.id) })
    // Asked twice: first for what the service answers outright, which is shown at once, then
    // for the songs and artists it keeps in folders, which take it far longer to hand over.
    api.songbookSearch(source.id, term, zone, true).then(
      (res) => {
        answer({ state: res.more ? 'more' : 'done', ...rows(res) })
        if (!res.more || !live.current || writeSeq.current !== id) return
        api.songbookSearch(source.id, term, zone).then(
          (all) => answer({ state: 'done', ...rows(all) }),
          () => answer({ state: 'done' }),
        )
      },
      () => answer({ state: 'failed', artists: [], songs: [] }),
    )
  }

  // What is written is looked up a moment after the last letter, so a name is asked for once
  // and not letter by letter.
  const onWrite = (event) => {
    if (!tab) return
    const text = event.target.value
    const term = text.trim()
    clearTimeout(writeTimer.current)
    if (term.length < 2) { writeSeq.current += 1; setWrite({ ...BLANK, text }); return }
    if (term === write.term && write.state === 'done') { writeSeq.current += 1; setWrite((cur) => ({ ...cur, text, note: '' })); return }
    const source = tab
    setWrite((cur) => ({ ...cur, text, state: 'busy', note: '' }))
    writeTimer.current = setTimeout(() => lookUp(source, term), WAIT)
  }

  // Keys pressed on the line are the line's: Enter looks the name up at once and lets go of
  // the line, Escape rubs out what is written, and from an empty line lets go of it.
  const onWriteKey = (event) => {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      const term = write.text.trim()
      if (tab && term.length >= 2 && !(term === write.term && write.state === 'done')) lookUp(tab, term)
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (write.text) { clearTimeout(writeTimer.current); writeSeq.current += 1; setWrite(BLANK) }
      else event.currentTarget.blur()
    }
  }

  const openTab = (source) => {
    if (!usable || busy || performance.now() - swiped.current < 350) return
    if (tab?.id === source.id && view === 'artists') return
    const from = tab ? tabs.findIndex((item) => item.id === tab.id) : -1
    const to = tabs.findIndex((item) => item.id === source.id)
    if (tab?.id !== source.id) clearWrite()
    setTab(source)
    setArtist(null)
    setView('artists')
    setSpread(0)
    artistsSpread.current = 0
    loadArtists(source)
    setLeftStack(true)
    if (pose.at !== 'flat') go('flat', 650)
    startRiffle(view === 'tabs' || to >= from ? 1 : -1)
  }

  const openArtist = (who) => {
    if (!usable || busy || !tab || performance.now() - swiped.current < 350) return
    artistsSpread.current = shown
    setArtist({ id: who.id, title: who.title })
    setView('songs')
    setSpread(0)
    loadSongs(tab, who)
    startRiffle(1)
  }

  // An artist picked from what the line found: the page opens as any artist's does, and once
  // the songs are in, it is filed behind this divider. One with no songs is not filed.
  const fileArtist = (who) => {
    if (!usable || busy || !tab || performance.now() - swiped.current < 350) return
    const source = tab
    const held = store.current.songs
    const key = songsKey(source, who)
    artistsSpread.current = shown
    setArtist({ id: who.id, title: who.title })
    setView('songs')
    setSpread(0)
    startRiffle(1)
    if (held.has(key)) return
    const entry = { items: [], done: false, failed: false }
    held.set(key, entry)
    api.songbookFile(source.id, who.id, who.title, zone)
      .then((res) => {
        entry.items = (res.items || []).filter((song) => song?.number)
        if (entry.items.length) fileLocally(source.id, res.artist || who)
      })
      .catch((err) => { if (err?.status !== 409) { entry.failed = true; held.delete(key) } })
      .finally(() => { entry.done = true; bump() })
  }

  const toArtists = (at = artistsSpread.current, dir = -1) => {
    setView('artists')
    setArtist(null)
    setSpread(at)
    startRiffle(dir, 5)
  }

  const back = () => {
    if (!usable || busy) return false
    if (view === 'songs') { toArtists(); return true }
    if (view === 'artists') {
      setView('tabs')
      setTab(null)
      setSpread(0)
      const ms = startRiffle(-1)
      later(() => setLeftStack(false), Math.max(0, ms - 200))
      go('zoom', 700)
      return true
    }
    return false
  }

  // Shut, then off the bottom. From deep in the book the pages run back to
  // the front first.
  const close = useCallback(() => {
    if (now.current.closing) return
    now.current.closing = true
    setClosing(true)
    const shut = () => {
      setOpen(false)
      go('closed', 1000)
      later(() => { go('below', 600, 'cubic-bezier(0.5, 0, 0.9, 0.5)'); later(() => onClosed?.(), 620) }, 1050)
    }
    if (!open) { later(() => { go('below', 600, 'cubic-bezier(0.5, 0, 0.9, 0.5)'); later(() => onClosed?.(), 620) }, 60); return }
    if (now.current.view !== 'tabs') {
      setView('tabs')
      setLeftStack(false)
      const ms = startRiffle(-1, 5, 60)
      later(shut, ms ? ms - 120 : 0)
    } else shut()
  }, [open, go, later, startRiffle, onClosed])

  // A press anywhere outside the binder puts it away, as the close key does. The
  // number window and its keys are left out: a song is keyed in with the binder
  // open, and the Full Screen key only changes what the binder lies on. The Mute key is left out too: the
  // sound is silenced or brought back without the book being put down. A press on any other key of the machine puts the binder away and does what
  // that key does; a press anywhere else goes no further.
  const closeNow = useRef(close)
  closeNow.current = close
  useEffect(() => {
    const KEEP = '.km-bk, .km-bk-close, .km-face-number, .km-face-pad, .km-cap-cancel, .km-led-key, .km-cap-full, .km-keypad, .km-osd-pad, .km-cap-mute'
    let lift = 0
    const swallow = (event) => { event.stopPropagation(); event.preventDefault() }
    const onDown = (event) => {
      if (!event.isPrimary || event.button > 0 || now.current.closing) return
      if (event.target instanceof Element && event.target.closest(KEEP)) return
      closeNow.current()
      // A key on the machine does its own work as well; a press anywhere else only puts the binder away.
      if (event.target instanceof Element && event.target.closest('.km-face')) return
      document.addEventListener('click', swallow, { capture: true, once: true })
      clearTimeout(lift)
      lift = setTimeout(() => document.removeEventListener('click', swallow, true), 700)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('click', swallow, true); clearTimeout(lift) }
  }, [])

  const letterTarget = (letter) => {
    const pages = artistLayout.letterPage
    if (pages[letter] != null) return letter
    const at = LETTERS.indexOf(letter)
    for (let i = at - 1; i >= 0; i -= 1) if (pages[LETTERS[i]] != null) return LETTERS[i]
    for (let i = at + 1; i < LETTERS.length; i += 1) if (pages[LETTERS[i]] != null) return LETTERS[i]
    return null
  }
  const toLetter = (letter, quick = false) => {
    // A letter whose artists are still arriving is gone to once they are in, and one asked
    // for while the pages are still going over, once they are down.
    if (usable && (busy || !arrived(letter))) { setAsked(letter); return }
    const target = letterTarget(letter)
    if (target == null || !usable) return
    const at = Math.floor(artistLayout.letterPage[target] / D.per)
    setChosen({ letter: target, at, tab: tab?.id })
    if (view === 'songs') toArtists(at, at >= artistsSpread.current ? 1 : -1)
    else if (view === 'artists') goSpread(at, quick)
  }

  letterGo.current = toLetter
  useEffect(() => {
    if (busy || !asked || !arrived(asked)) return
    setAsked(null)
    letterGo.current(asked)
  }, [busy, asked, artistLayout, filling])

  // A finger run down the letters goes through them as it passes.
  // A press that only trembles on its letter is a click, and is left to the click.
  const scrub = useRef(null)
  const scrubAt = (event) => {
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-letter]')
    if (hit && now.current.view === 'artists') toLetter(hit.dataset.letter, true)
  }
  const letterEvents = {
    onPointerDown: (event) => { if (event.button > 0) return; scrub.current = { letter: event.currentTarget.dataset.letter, x: event.clientX, y: event.clientY, off: false }; try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* the pointer has already gone */ } },
    onPointerMove: (event) => {
      const held = scrub.current
      if (!held || !event.buttons) return
      if (!held.off) {
        const over = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-letter]')?.dataset.letter
        if ((!over || over === held.letter) && Math.hypot(event.clientX - held.x, event.clientY - held.y) < 8) return
        held.off = true
      }
      swiped.current = performance.now()
      scrubAt(event)
    },
    onPointerUp: () => { scrub.current = null },
    onPointerCancel: () => { scrub.current = null },
  }

  const pick = (song) => {
    if (!usable || busy || performance.now() - swiped.current < 350) return
    setPicked(song.number)
    later(() => setPicked((cur) => (cur === song.number ? 0 : cur)), 2000)
    onPick?.(song)
  }

  // A song the line found came with its number. Picking it asks for what plays it, and files
  // its artist with it.
  const pickFound = (song) => {
    if (!usable || busy || !tab || filing || performance.now() - swiped.current < 350) return
    if (got[song.id]) { pick(got[song.id]); return }
    const source = tab
    setFiling(song.id)
    setWrite((cur) => (cur.note ? { ...cur, note: '' } : cur))
    api.songbookReserve(source.id, song.id, zone)
      .then((res) => {
        if (!live.current) return
        if (res.artist) fileLocally(source.id, res.artist)
        if (!res.song?.number) throw new Error('no number')
        if (now.current.tab !== source.id || now.current.closing) return
        setGot((cur) => ({ ...cur, [song.id]: res.song }))
        setPicked(res.song.number)
        later(() => setPicked((cur) => (cur === res.song.number ? 0 : cur)), 2000)
        onPick?.(res.song)
      })
      .catch(() => { if (live.current && now.current.tab === source.id) setWrite((cur) => ({ ...cur, note: 'failed' })) })
      .finally(() => { if (live.current) setFiling('') })
  }

  // --- keys, wheel, and swipes --------------------------------------------------------
  const key = (event) => {
    if (!open || closing) return event.key === 'Escape'
    if (event.key === 'Escape') { if (!back()) close(); return true }
    if (view === 'tabs') return false
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { goSpread(shown + 1); return true }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { goSpread(shown - 1); return true }
    if (event.key === 'Home') { goSpread(0); return true }
    if (event.key === 'End') { goSpread(spreads - 1); return true }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[a-z#]$/i.test(event.key)) { toLetter(event.key.toUpperCase()); return true }
    return false
  }
  useImperativeHandle(ref, () => ({ close, key }))

  const onWheel = (event) => {
    if (view === 'tabs' || Math.abs(event.deltaY) + Math.abs(event.deltaX) < 8) return
    const stamp = performance.now()
    if (stamp - wheeled.current < 350) return
    wheeled.current = stamp
    goSpread(shown + ((Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX) > 0 ? 1 : -1))
  }
  const drag = useRef(null)
  const onPointerDown = (event) => { drag.current = event.button > 0 || scrub.current ? null : { x: event.clientX, y: event.clientY } }
  const onPointerUp = (event) => {
    const from = drag.current
    drag.current = null
    if (!from || view === 'tabs' || scrub.current) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    swiped.current = performance.now()
    goSpread(shown + (dx < 0 ? 1 : -1))
  }

  // --- what is drawn ------------------------------------------------------------------
  const strip = useMemo(() => dividers(tabs.length), [tabs.length])
  const doubles = useMemo(() => {
    const seen = new Map()
    for (const item of tabs) if (item.kind === 'service') seen.set(item.sid, (seen.get(item.sid) || 0) + 1)
    return seen
  }, [tabs])
  const nameOf = (item) => (item.kind === 'library' ? t('desk.browse.library') : doubles.get(item.sid) > 1 && item.nickname ? `${item.name} (${item.nickname})` : item.name || '')

  // The dividers all read the same way: a sign with its name beside it on every
  // one, or the sign alone on every one. Every name is set out of sight at the
  // size it is read at, and if any of them does not fit, none is printed.
  useLayoutEffect(() => {
    let mine = true
    const read = () => {
      if (!mine) return
      const out = []
      gauge.current?.querySelectorAll('.km-bk-tab-name').forEach((el, i) => {
        const style = getComputedStyle(el)
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.1
        if (el.offsetHeight > 2 * line + 1 || el.scrollWidth > el.clientWidth + 1) out.push(i)
      })
      setCut(out.join(','))
    }
    read()
    document.fonts?.ready.then(read, () => {})
    return () => { mine = false }
  }, [tabs, geo, language])

  // The letters slide in along the edge once, when they first appear. A letter that
  // moves from one edge to the other as the pages turn is drawn anew there, and
  // sliding in again it looked like a tab left standing out.
  const lettersShow = view !== 'tabs' && !closing
  const [lettersIn, setLettersIn] = useState(false)
  useEffect(() => {
    if (!lettersShow) { setLettersIn(false); return undefined }
    const timer = setTimeout(() => setLettersIn(true), 240 + LETTERS.length * 14 + 60)
    return () => clearTimeout(timer)
  }, [lettersShow])

  if (!geo) return <div className="km-bk-layer" ref={layer} />

  const u = geo.u
  // Close on the dividers a name is never smaller than the eye can manage.
  const floor = `${(8.5 / geo.zoom(strip).s).toFixed(2)}px`
  const signsOnly = cut !== ''
  // A sign keeps to the part of its divider that stands above the pages, which has a least height.
  const sign = Math.max(13, Math.round(u * 0.68))
  const signAlone = Math.max(15, Math.round(u * 0.76))
  // Names are fitted to the dividers at their full width; where the signs stand alone, the
  // dividers drawn are the narrow ones.
  const drawn = signsOnly ? signDividers(tabs.length, signAlone / u) : strip
  const near = geo.zoom(drawn)
  // How much of the first page's right-hand side is past the window's edge
  // with the view drawn in: what is printed there stops short of it.
  const reach = (dy) => ((geo.W - 8 - near.x) / near.s - dy * SIN) / COS
  const low = Math.min(13.95 * u, ((geo.limit - near.y) / near.s + reach(13.95 * u) * SIN) / COS)
  const edge = Math.max(0, 24.25 * u - reach(low))
  const at = pose.at === 'zoom' ? near : geo[pose.at]
  const W = HALF_W * 2 * u
  const H = HALF_H * 2 * u
  const transform = `translate(${(at.x - W / 2).toFixed(2)}px, ${(at.y - H / 2).toFixed(2)}px) rotate(${at.r}deg) scale(${at.s.toFixed(4)})`
  const icon = Math.round(u * 1.05)
  const current = tab ? tabs.findIndex((item) => item.id === tab.id) : -1
  const wide = D.per === 2
  const pageIndex = (s, side) => (wide ? s * 2 + (side === 'r' ? 1 : 0) : s)

  // A source whose list is only what its account has saved says so: the rest of what it has
  // is found by writing a name.
  const own = !!tab?.own
  const artistsTitle = t(own ? 'km.book.yourArtists' : 'desk.library.artists')

  const message = (v) => {
    if (v === 'artists') {
      // The artists are printed only once all of them are in. A service answers in pages
      // that do not arrive in order, and each one sorted in would move the names already
      // shown, under a finger about to tap one.
      if (!artistsOf || (!artistsOf.done && !artistsOf.raw.length)) return { text: t('desk.browse.loading'), busy: true }
      if (!artistsOf.done && !artistsOf.shown?.length) return { text: t('km.book.filling', { n: count.format(artistsOf.raw.length) }), busy: true }
      if (artistsOf.failed) return { text: t('km.book.failed') }
      if (artistsOf.done && !rawArtists?.length) return { text: t(writes ? 'km.book.noFiled' : 'km.book.noArtists') }
    } else if (v === 'songs') {
      if (!songsOf || !songsOf.done) return { text: t('km.book.loading'), busy: true }
      if (songsOf.failed) return { text: t('km.book.failed') }
      if (!songsOf.items.length) return { text: t('km.book.noSongs') }
    }
    return null
  }

  const range = (page) => {
    const names = (page || []).flat().filter((line) => line.kind === 'artist')
    if (!names.length) return ''
    const a = names[0].letter
    const b = names[names.length - 1].letter
    return a === b ? a : `${a}-${b}`
  }

  const contents = () => (
    <div className="km-bk-page km-bk-contents" data-many={tabs.length > 6 || undefined}>
      <h2 className="km-bk-title">{t('km.book')}</h2>
      <p className="km-bk-lead">{tabs.length || pending ? t('km.book.pick') : t('km.book.noTabs')}</p>
      <div className="km-bk-entries">
        {tabs.map((item, i) => (
          <button type="button" key={item.id} className="km-bk-entry" style={{ '--c': i % 5 }} onClick={() => openTab(item)}>
            <span className="km-bk-chip" aria-hidden="true" />
            <Logo tab={item} size={Math.round(u * 1.15)} />
            <span className="km-bk-entry-name">{nameOf(item)}</span>
          </button>
        ))}
      </div>
      {pending && <p className="km-bk-busy" role="status">{t('km.book.looking')}</p>}
      <p className="km-bk-note">{t('km.book.how')}</p>
      <p className="km-bk-note">{t('km.book.reserve')}</p>
    </div>
  )

  // What the line found, as one page's share of it: the first page's under the line, the
  // rest on pages of their own.
  const foundBlock = (part, inert) => {
    const off = inert ? -1 : undefined
    const artistsCol = (items, head, key) => (
      <div className="km-bk-col km-bk-found-artists" key={key}>
        {head && <div className="km-bk-th"><span>{t('desk.library.artists')}</span></div>}
        {items.map((item, i) => (
          <button type="button" key={`${item.id}-${i}`} className="km-bk-artist" tabIndex={off} style={{ '--n': i + 1 }} onMouseEnter={whole} onClick={() => fileArtist(item)}>{item.title}</button>
        ))}
      </div>
    )
    const songsCol = (items, head, lead, key) => (
      <div className="km-bk-table km-bk-found-songs" key={key}>
        {head && <div className="km-bk-th"><span>{t('km.book.songNo')}</span><span>{t('desk.library.songs')}</span></div>}
        {items.map((song, i) => {
          const number = (got[song.id] || song).number
          return (
            <button type="button" key={`${song.id}-${i}`} className="km-bk-song" tabIndex={off} data-picked={(number && picked === number) || undefined} data-waiting={filing === song.id || undefined}
              style={{ '--n': lead + i + 1 }} onClick={() => pickFound(song)}>
              <span className="km-bk-no" data-blank={!number || undefined}>{number ? pad(number) : ''}</span>
              <span className="km-bk-name km-bk-name-by" title={[song.title, song.artist, song.album].filter(Boolean).join(' / ')}>
                <span className="km-bk-tune">{song.title}</span>{song.artist ? <span className="km-bk-by">{song.artist}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    )
    return (
      <div className="km-bk-found" data-busy={write.state === 'busy' || undefined}>
        {part.artists.length > 0 && artistsCol(part.artists, true, 'a')}
        {part.songs.length > 0 && songsCol(part.songs, true, part.artists.length ? part.artists.length + 1 : 0, 'b')}
      </div>
    )
  }

  // The first page behind the divider of a source that can be searched: the line, and under it
  // what was found for what is written there.
  const writing = (inert, note) => {
    const off = inert ? -1 : undefined
    const typed = write.text.trim().length >= 2
    const none = !write.artists.length && !write.songs.length
    const said = (text, waiting) => <p className="km-bk-status" data-busy={waiting || undefined} role="status">{text}</p>
    let body
    if (!typed) body = <>{own && <>{t('km.book.yourArtistsNote', { service: tab.name || nameOf(tab) }).split('\n').map((line) => <p key={line} className="km-bk-write-how">{line}</p>)}</>}{note && said(note.text, note.busy)}</>
    else if (write.state === 'failed') body = said(t('km.book.writeFailed'))
    else if (none) body = write.state === 'busy' || write.state === 'more' ? said(t('km.book.searching'), true) : said(t('km.book.noMatches'))
    else body = foundBlock(found[0], inert)
    return (
      <div className="km-bk-write">
        <p className="km-bk-write-label" data-note={write.note || undefined} data-busy={(!write.note && typed && !none && write.state === 'more') || undefined} role={write.note || write.state === 'more' ? 'status' : undefined}>{write.note ? t('km.book.writeFailed') : typed && !none && write.state === 'more' ? t('km.book.searching') : t('km.book.write')}</p>
        <div className="km-bk-line">
          <input type="text" className="km-bk-line-in" value={write.text} aria-label={t('km.book.write')} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            enterKeyHint="search" maxLength={80} readOnly={inert || undefined} tabIndex={off}
            onChange={inert ? undefined : onWrite} onKeyDown={inert ? undefined : onWriteKey} onPointerDown={(event) => event.stopPropagation()}
            onBlur={inert ? undefined : () => requestAnimationFrame(() => remeasure.current?.())} />
          {write.text && (
            <button type="button" className="km-bk-line-clear" aria-label={t('desk.search.clear')} tabIndex={off} onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => { event.currentTarget.parentNode.querySelector('input')?.focus(); clearTimeout(writeTimer.current); writeSeq.current += 1; setWrite(BLANK) }}><G.Close size={Math.round(Math.max(14, u * 0.8))} /></button>
          )}
        </div>
        <div className="km-bk-write-found">{body}</div>
      </div>
    )
  }

  // One page of the binder. `inert` is a page on a turning leaf: it shows what
  // the page holds and answers nothing.
  const page = (v, s, side, inert = false) => {
    if (v === 'tabs') return side === 'r' ? contents() : null
    const index = pageIndex(s, side)
    const lines = pagesOf(v)[index]
    const lead = !wide || side === 'l'
    const lined = lines?.[0]?.[0]?.kind === 'write'
    const part = lines?.[0]?.[0]?.kind === 'found' ? lines[0][0].part : null
    // Across two pages the ruled line has the left-hand one, and what there is to say about
    // the artists is said on the right; on a single page it is said under the line.
    const note = s === 0 && (v === 'artists' && writes && wide ? side === 'r' : lead) ? message(v) : null
    const source = tab ? <span className="km-bk-source"><Logo tab={tab} size={icon} /><span>{nameOf(tab)}</span></span> : null
    const backKey = (label) => (
      <button type="button" className="km-bk-back" tabIndex={inert ? -1 : undefined} onClick={back}><L.Left size={icon} /><span>{label}</span></button>
    )
    let start
    let end
    if (v === 'artists') {
      start = lead ? backKey(t('km.sources')) : <span className="km-bk-headline">{part ? write.term : artistsTitle}</span>
      end = lead ? source : <span className="km-bk-range">{range(lines)}</span>
    } else {
      start = lead ? backKey(artistsTitle) : <span className="km-bk-headline">{artist?.title}</span>
      end = lead ? <span className="km-bk-headline">{wide ? '' : artist?.title}</span> : source
      if (lead && wide) end = <span className="km-bk-headline km-bk-who">{artist?.title}</span>
    }
    const offset = side === 'r' && wide ? D.rows * D.cols : 0
    let body = null
    if (lined) body = writing(inert, note)
    else if (part) body = foundBlock(part, inert)
    else if (note) body = <p className="km-bk-status" data-busy={note.busy || undefined} role="status">{note.text}</p>
    else if (lines && v === 'artists') {
      body = (
        <div className="km-bk-cols" style={{ '--cols': D.cols }}>
          {lines.map((col, c) => (
            <div className="km-bk-col" key={c}>
              {col.map((line, i) => (line.kind === 'artist'
                ? <button type="button" key={line.id} className="km-bk-artist" tabIndex={inert ? -1 : undefined} style={{ '--n': offset + c * D.rows + i }} onMouseEnter={whole} onClick={() => openArtist(line)}>{line.title}</button>
                : <div key={`head-${line.letter}`} className="km-bk-letterhead" style={{ '--n': offset + c * D.rows + i }}>{line.letter}</div>))}
            </div>
          ))}
        </div>
      )
    } else if (lines) {
      body = (
        <div className="km-bk-cols" style={{ '--cols': D.tables }}>
          {lines.map((table, c) => (
            <div className="km-bk-table" key={c}>
              <div className="km-bk-th"><span>{t('km.book.songNo')}</span><span>{t('km.book.title')}</span></div>
              {table.map((song, i) => (
                <button type="button" key={song.number} className="km-bk-song" tabIndex={inert ? -1 : undefined} data-picked={picked === song.number || undefined}
                  style={{ '--n': offset + c * D.rows + i }} onClick={() => pick(song)}>
                  <span className="km-bk-no">{pad(song.number)}</span>
                  <span className="km-bk-name" title={song.album ? `${song.title} (${song.album})` : song.title}>{song.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="km-bk-page" data-side={side} data-kind={v}>
        <header className="km-bk-head">{start}{end}</header>
        <div className="km-bk-body" data-ink={(ink && !inert) || undefined}>{body}</div>
        <footer className="km-bk-foot">
          {lead && <button type="button" className="km-bk-turn" aria-label={t('common.previous')} tabIndex={inert || shown <= 0 ? -1 : undefined} data-none={shown <= 0 || undefined} aria-hidden={shown <= 0 || undefined} {...idle(shown <= 0, () => goSpread(shown - 1))}><L.Left size={icon} /></button>}
          <span className="km-bk-pageno">{wide ? pageNo(v, index) : `${pageNo(v, index)} / ${Math.max(1, pagesOf(v).length)}`}</span>
          {(!wide || side === 'r') && <button type="button" className="km-bk-turn" aria-label={t('common.next')} tabIndex={inert || shown >= spreads - 1 ? -1 : undefined} data-none={shown >= spreads - 1 || undefined} aria-hidden={shown >= spreads - 1 || undefined} {...idle(shown >= spreads - 1, () => goSpread(shown + 1))}><L.Right size={icon} /></button>}
        </footer>
      </div>
    )
  }

  // While a page turns, the side it leaves already shows what was under it,
  // and the side it lands on still shows what it will cover.
  let baseL = shown
  let baseR = shown
  if (turn) {
    baseL = turn.dir > 0 ? turn.from : turn.to
    baseR = turn.dir > 0 ? turn.to : turn.from
  }

  // The dividers that change sides in a run go over on its first leaf, as the
  // ones on a real page do, and are drawn on the other stack once it is down.
  const upTo = wide && leftStack && view !== 'tabs' ? current : -1
  if (!riffle) restedUpTo.current = upTo
  const carry = riffle && !riffle.landed && upTo !== restedUpTo.current && (upTo > restedUpTo.current) === (riffle.dir > 0)
    ? { from: Math.min(upTo, restedUpTo.current) + 1, to: Math.max(upTo, restedUpTo.current) } : null
  const carried = (i) => !!carry && i >= carry.from && i <= carry.to
  const riders = (side) => carry && tabs.map((item, i) => {
    if (!carried(i)) return null
    const x = drawn.first + i * drawn.pitch
    const left = side === 'r' ? HALF_W + x - LEAF_R : HALF_W - x - drawn.width - LEAF_L
    return (
      <span key={`ride-${item.id}`} className="km-bk-tab km-bk-tab-ride" data-current={i === current || undefined} data-signs={signsOnly || undefined}
        style={{ '--x': left.toFixed(3), '--w': drawn.width.toFixed(3), '--c': i % 5 }}>
        <span className="km-bk-tab-label">
          {signsOnly
            ? <Sign tab={item} name={nameOf(item)} size={signAlone} />
            : <><Logo tab={item} size={sign} /><span className="km-bk-tab-name">{nameOf(item)}</span></>}
        </span>
      </span>
    )
  })

  const leaf = (side, motion, i, inside, id, print) => (
    <span key={`${id}-${motion}-${i}`} className={cx('km-bk-leaf', `km-bk-leaf-${side}`)} data-motion={motion} data-turn={inside ? '' : undefined} data-bare={inside || print ? undefined : ''} style={{ '--i': i }} aria-hidden="true">
      {i === 0 && !inside && riders(side)}
      {print ? <span className="km-bk-paper" dangerouslySetInnerHTML={{ __html: print }} /> : <span className="km-bk-paper">{inside}</span>}
      <span className="km-bk-shade" />
    </span>
  )
  const leaves = []
  // Every leaf in a run is printed like the pages that were open: the first to
  // rise is the page it leaves, and the faces after it are laid out the same
  // with other names on their lines. Only a run from blank pages goes by as lines of print. The page
  // on the other side stays as it was until a leaf comes down on it.
  let ghost = null
  if (riffle) {
    const out = riffle.dir > 0 ? 'r' : 'l'
    const under = riffle.dir > 0 ? 'l' : 'r'
    if (riffle.was?.[under] && (wide || under === 'r')) ghost = { side: under, print: riffle.was[under] }
    // The leaves still waiting lie on their stack, so the first to rise is
    // drawn last, on top of the ones that follow it; the first to come down is
    // drawn first, under the ones that land on it.
    const rising = []
    const landing = []
    for (let i = 0; i < riffle.leaves; i += 1) {
      const print = riffle.rising?.[i] || ''
      const back = (i === riffle.leaves - 1 && riffle.last) || riffle.landing?.[i] || print
      if (riffle.dir > 0) { rising.unshift(leaf('r', 'r-out', i, null, riffle.id, print)); if (wide) landing.push(leaf('l', 'l-in', i, null, riffle.id, back)) }
      else { if (wide) rising.unshift(leaf('l', 'l-out', i, null, riffle.id, print)); landing.push(leaf('r', 'r-in', i, null, riffle.id, back)) }
    }
    leaves.push(...rising, ...landing)
  } else if (turn) {
    if (turn.dir > 0) {
      leaves.push(leaf('r', 'r-out', 0, page(view, turn.from, 'r', true), turn.id))
      if (wide) leaves.push(leaf('l', 'l-in', 0, page(view, turn.to, 'l', true), turn.id))
    } else {
      if (wide) leaves.push(leaf('l', 'l-out', 0, page(view, turn.from, 'l', true), turn.id))
      leaves.push(leaf('r', 'r-in', 0, page(view, turn.to, 'r', true), turn.id))
    }
  }

  // A divider stays with its leaf: the ones already turned stand along the
  // left-hand pages. On a narrow window there is no left-hand page in view.
  const ghostOn = (side) => (ghost?.side === side
    ? <div className="km-bk-paper km-bk-ghost" key={`ghost-${riffle.id}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ghost.print }} />
    : null)

  const turned = (i) => wide && leftStack && view !== 'tabs' && i <= current
  const divider = (item, i, side) => {
    const x = drawn.first + i * drawn.pitch
    const left = side === 'r' ? HALF_W + x : HALF_W - x - drawn.width
    return (
      <button type="button" key={item.id} className="km-bk-tab" data-current={i === current || undefined} data-signs={signsOnly || undefined}
        aria-label={nameOf(item)} title={nameOf(item)} style={{ '--x': left.toFixed(3), '--w': drawn.width.toFixed(3), '--c': i % 5 }} onClick={() => openTab(item)}>
        <span className="km-bk-tab-label">
          {signsOnly
            ? <Sign tab={item} name={nameOf(item)} size={signAlone} />
            : <><Logo tab={item} size={sign} /><span className="km-bk-tab-name">{nameOf(item)}</span></>}
        </span>
      </button>
    )
  }

  const firstPage = pageIndex(view === 'songs' ? artistsSpread.current : shown, 'l')
  // One letter stands out: the one asked for, or else the last to begin on the
  // pages that are open or about to be.
  const landing = view === 'songs' ? artistsSpread.current : turn ? turn.to : shown
  const lastPage = pageIndex(landing, 'l') + (wide ? 1 : 0)
  let here = null
  for (const letter of LETTERS) if (artistLayout.letterPage[letter] != null && artistLayout.letterPage[letter] <= lastPage) here = letter
  if (asked) here = letterTarget(asked) || here
  else if (chosen && chosen.tab === tab?.id && chosen.at === landing && artistLayout.letterPage[chosen.letter] != null) here = chosen.letter
  const passed = (letter) => {
    if (!wide || !leftStack) return false
    const target = letterTarget(letter)
    return target != null && artistLayout.letterPage[target] <= firstPage
  }
  const letterKey = (letter, i, side) => (
    <button type="button" key={letter} className="km-bk-letter" data-letter={letter} data-side={side} data-here={letter === here || undefined} data-wait={(letter === asked && !arrived(letter)) || undefined}
      data-none={(!filling && artistLayout.letterPage[letter] == null) || undefined} aria-disabled={(!filling && artistLayout.letterPage[letter] == null) || undefined}
      style={{ '--i': i, '--c': i % 5 }} onClick={() => { if (performance.now() - swiped.current > 350) toLetter(letter) }} {...letterEvents}>
      <span>{letter}</span>
    </button>
  )
  const lettersOn = view !== 'tabs' && !closing

  return (
    <div className="km-bk-layer" ref={layer} role="dialog" aria-label={t('km.book')} data-at={pose.at} data-view={view}
      style={{ '--km-u': `${u.toFixed(3)}px`, '--km-bk-row': `${D.row.toFixed(2)}px`, '--km-bk-floor': pose.at === 'zoom' ? floor : '0px', '--km-bk-z': near.s.toFixed(3), '--km-bk-edge': `${edge.toFixed(2)}px` }}>
      {/* The binder lies over the machine: laid flat it is sized to stay above the faceplate,
          so the number window and keys stay in reach, and its shadow falls across the plate. */}
      <div className="km-bk-clip">
        <div className="km-bk" ref={bookEl} tabIndex={-1} data-open={open || undefined} data-left={leftStack || undefined} data-narrow={!wide || undefined} data-letters-in={lettersIn || undefined}
          style={{ '--km-bk-step': `${riffle?.step || STEP}ms`, transform, transition: `transform ${pose.ms}ms ${pose.ease}` }}
          onWheel={onWheel} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <span className="km-bk-shadow km-bk-shadow-r" aria-hidden="true" />
          <span className="km-bk-shadow km-bk-shadow-l" aria-hidden="true" />
          <div className="km-bk-inside" aria-hidden="true"><span className="km-bk-dim" /></div>
          <div className="km-bk-board" aria-hidden="true" />
          <div className="km-bk-spine" aria-hidden="true" />
          <div className="km-bk-side km-bk-right">
            {tabs.map((item, i) => (turned(i) || carried(i) ? null : divider(item, i, 'r')))}
            {lettersOn && LETTERS.map((letter, i) => (passed(letter) ? null : letterKey(letter, i, 'r')))}
            <div className="km-bk-sheet km-bk-sheet-r"><div className="km-bk-paper">{page(view, baseR, 'r')}</div>{ghostOn('r')}</div>
          </div>
          <div className="km-bk-side km-bk-left">
            {tabs.map((item, i) => (turned(i) && !carried(i) ? divider(item, i, 'l') : null))}
            {lettersOn && LETTERS.map((letter, i) => (passed(letter) ? letterKey(letter, i, 'l') : null))}
            <div className="km-bk-sheet km-bk-sheet-l"><div className="km-bk-paper">{wide ? page(view, baseL, 'l') : null}</div>{ghostOn('l')}</div>
          </div>
          {leaves}
          <div className="km-bk-rings" aria-hidden="true" />
          <div className="km-bk-front" aria-hidden="true"><span className="km-bk-dim" /></div>
          <div className="km-bk-gauge" ref={gauge} aria-hidden="true" style={{ '--km-bk-floor': floor }}>
            {tabs.map((item) => (
              <span key={item.id} style={{ '--w': strip.width.toFixed(3) }}>
                <span className="km-bk-tab-label"><span className="km-bk-logo" style={{ width: sign, height: sign }} /><span className="km-bk-tab-name">{nameOf(item)}</span></span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <button type="button" className="km-bk-close" aria-label={t('common.close')} onClick={close}><G.Close size={20} /></button>
      {/* What the machine has to say while the binder covers its screen: a song added, or why not. */}
      {alert && open && !closing && (
        <p className="km-bk-toast" role="status" key={alert.id}>
          {alert.title && <strong>{alert.title}</strong>}
          {alert.text && <span>{alert.text}</span>}
        </p>
      )}
    </div>
  )
})

export default Binder
