import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from './api.js'
import { findLyrics } from './lrclib.js'
import { positionNow } from './format.js'
import { readStored, writeStored } from './shellSelection.js'
import { lineAt, lyricsSong } from './lyricsSong.js'

export { lineAt, lyricsSong }

// Lyrics for the big players: what to look up, the lookup, the line the music
// is on, and keeping that line in view. Each theme draws its own lyrics pane
// from these (the markup and the look are the theme's). The lookup is the
// browser's own, straight to LRCLIB (lrclib.js), made only while a big player
// has its lyrics open and only once the reader has been told what it sends.

const songKey = (song) => (song ? [song.title, song.artist, song.album, Math.round(song.duration)].join('\u0001') : '')

// Who is asking, for LRCLIB's X-User-Agent header: Sonora and its version,
// read once from Sonora.
let client = null
function clientName() {
  client ||= api.appUpdate().then((r) => r?.current, () => '').then((version) =>
    `Sonora${version && version !== 'dev' ? `/${version}` : ''} (https://github.com/Bretteroo/Sonora)`)
  return client
}

// One answer per song for the life of the page, in its memory only and
// shared by every view that asks; a failed lookup is not kept, so the next
// opening tries again.
const answers = new Map()
// The same answers once they have arrived, so a pane opening on a song
// already looked up shows its lyrics on its first frame.
const settled = new Map()
// How many open lyrics panes want each song. A lookup still waiting its turn
// for a song no pane wants (the player skipped on, the pane closed) is
// dropped before it asks LRCLIB anything.
const demand = new Map()
const wanted = (key) => (demand.get(key) || 0) > 0
function lookUp(song) {
  const key = songKey(song)
  if (!answers.has(key)) {
    const pending = clientName().then((name) => findLyrics(song, { client: name, wanted: () => wanted(key) })).then((answer) => {
      if (answer?.unreachable) answers.delete(key)
      else settled.set(key, answer)
      // Dropped, then wanted again before the drop was noticed: ask afresh.
      if (answer?.gone && wanted(key)) return lookUp(song)
      return answer
    }, (error) => { answers.delete(key); throw error })
    answers.set(key, pending)
  }
  return answers.get(key)
}

/**
 * The lyrics of what `transport` plays, looked up while `open`.
 *
 * `state` is one of: 'off' (closed, or no song to look up), 'notice' (the
 * reader has not yet agreed to the lookup: `agree()` lets it go), 'loading',
 * 'timed' (`lines` follow the music), 'plain' (`text` alone: the song's
 * words with no timings, or none that fit this recording), 'instrumental',
 * 'none' (LRCLIB has nothing) and 'error' (LRCLIB could not be reached).
 */
function shown(key, song, answer) {
  if (answer?.unreachable) return { key, state: 'error' }
  if (!answer?.found) return { key, state: 'none' }
  if (answer.instrumental) return { key, state: 'instrumental' }
  if (answer.synced?.length && song.duration) return { key, state: 'timed', lines: answer.synced }
  if (answer.plain) return { key, state: 'plain', text: answer.plain }
  return { key, state: 'none' }
}

export function useLyrics(transport, open) {
  const song = lyricsSong(transport)
  const key = songKey(song)
  const [result, setResult] = useState({ key: '', state: 'off' })
  const [agreed, setAgreed] = useState(() => readStored(AGREED_KEY, '0') === '1')
  useEffect(() => {
    if (!open || !song || !agreed) return undefined
    let live = true
    demand.set(key, (demand.get(key) || 0) + 1)
    if (settled.has(key)) setResult(shown(key, song, settled.get(key)))
    else setResult({ key, state: 'loading' })
    lookUp(song).then((answer) => { if (live) setResult(shown(key, song, answer)) },
      () => { if (live) setResult({ key, state: 'error' }) })
    return () => {
      live = false
      if (demand.get(key) > 1) demand.set(key, demand.get(key) - 1)
      else demand.delete(key)
    }
  }, [open, key, agreed]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !song) return { state: 'off' }
  if (!agreed) return { state: 'notice', agree: () => { writeStored(AGREED_KEY, '1'); setAgreed(true) } }
  if (result.key === key) return result
  return settled.has(key) ? shown(key, song, settled.get(key)) : { state: 'loading' }
}

/** The line the music is on, kept up to date four times a second while it
 * plays. -1 before the first line, and whenever there are no timings. */
export function useLyricsLine(transport, lines) {
  const latest = useRef(transport)
  latest.current = transport
  const read = () => (lines?.length ? lineAt(lines, positionNow(latest.current, { exact: true })) : -1)
  const [index, setIndex] = useState(read)
  const tr = transport || {}
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  useEffect(() => { setIndex(read()) }, [lines, tr.rel_time, tr.received_at, tr.track_uri, playing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing || !lines?.length) return undefined
    const timer = setInterval(() => setIndex(read()), 250)
    return () => clearInterval(timer)
  }, [playing, lines]) // eslint-disable-line react-hooks/exhaustive-deps
  // A hidden window's timers are slowed to a tick a second or less, so the
  // line is read afresh the moment it shows again.
  useEffect(() => {
    const shown = () => { if (document.visibilityState === 'visible') setIndex(read()) }
    document.addEventListener('visibilitychange', shown)
    return () => document.removeEventListener('visibilitychange', shown)
  }, [lines]) // eslint-disable-line react-hooks/exhaustive-deps
  return index
}

//: How long a hand on the lyrics keeps them where it left them.
const HOLD_MS = 4000

/**
 * Keeps line `index` in the middle of the scrolling element `ref` names,
 * each line marked with `data-line`. Scrolling by hand (wheel, touch, keys,
 * the scrollbar) holds the lyrics where they were put for a few seconds,
 * then they return to the line being sung.
 *
 * With `lead`, the line is held that many lines below the top instead: the
 * line `lead` lines earlier sits at the top of the box's content.
 */
export function useFollowLine(ref, index, { lead } = {}) {
  const heldUntil = useRef(0)
  const first = useRef(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const box = ref.current
    if (!box) return undefined
    let timer = 0
    const hold = () => {
      heldUntil.current = Date.now() + HOLD_MS
      clearTimeout(timer)
      timer = setTimeout(() => setTick((n) => n + 1), HOLD_MS)
    }
    const keys = (event) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) hold() }
    // A press on the box itself rather than a line is the scrollbar.
    const press = (event) => { if (event.target === box) hold() }
    box.addEventListener('wheel', hold, { passive: true })
    box.addEventListener('touchmove', hold, { passive: true })
    box.addEventListener('keydown', keys)
    box.addEventListener('pointerdown', press)
    // Back in view: straight to the line being sung, without an animation.
    const shown = () => {
      if (document.visibilityState !== 'visible') return
      first.current = true
      setTick((n) => n + 1)
    }
    document.addEventListener('visibilitychange', shown)
    return () => {
      document.removeEventListener('visibilitychange', shown)
      clearTimeout(timer)
      box.removeEventListener('wheel', hold)
      box.removeEventListener('touchmove', hold)
      box.removeEventListener('keydown', keys)
      box.removeEventListener('pointerdown', press)
    }
  }, [ref])
  // Before the frame is drawn, so a pane that has just opened shows the line
  // being sung on its first frame rather than the top of the song.
  useLayoutEffect(() => {
    const box = ref.current
    if (!box || Date.now() < heldUntil.current) return
    const line = box.querySelector(`[data-line="${Math.max(0, lead == null ? index : index - lead)}"]`)
    if (!line) return
    // Measured against the box itself: a line's offsetTop counts from its
    // nearest positioned ancestor, which in some themes is not the box.
    const at = line.getBoundingClientRect()
    const from = box.scrollTop + at.top - box.getBoundingClientRect().top
    const top = lead == null ? from - box.clientHeight / 2 + at.height / 2
      : from - parseFloat(getComputedStyle(box).paddingTop)
    // A hidden window draws no frames, so a smooth scroll there would stall
    // and land all at once when the window shows again: there the lyrics
    // move straight to each line, and are already in place on its return.
    const still = first.current || document.visibilityState !== 'visible'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    box.scrollTo({ top: Math.max(0, top), behavior: still ? 'auto' : 'smooth' })
    first.current = false
  }, [ref, index, tick, lead])
}

const OPEN_KEY = 'sonora.lyrics'
//: Set once the reader has read what a lookup sends to LRCLIB and agreed to it.
const AGREED_KEY = 'sonora.lyrics.agreed'

/** Whether the big player shows lyrics in the art's place: off until the
 * reader turns them on, then remembered across songs and visits. Only this
 * choice is stored; the lyrics themselves never are. `transition: false`
 * leaves the swap to the theme's own animation (Hi-Fi fades its display's
 * lines itself, and a page-wide view transition on top of that flickered). */
export function useLyricsOpen({ transition = true } = {}) {
  const [open, setOpen] = useState(() => readStored(OPEN_KEY, '0') === '1')
  const toggle = () => {
    const next = !open
    writeStored(OPEN_KEY, next ? '1' : '0')
    if (transition) swapAnimated(() => setOpen(next))
    else setOpen(next)
  }
  return [open, toggle]
}

// Swaps the art and the lyrics as a view transition: the page as it was
// fades into the page as it becomes, and an element a theme names in its
// stylesheet (`view-transition-name`) moves and resizes between the two.
// The theme sets the timing on its ::view-transition-group. Without view
// transitions, or with reduced motion asked for, the swap is immediate.
// The page carries data-view-swap only while a swap runs, and themes name
// their element under it alone: a named element is a stacking context of its
// own, so a dialog opened inside it (Clear Queue in the queue pane) could
// never cover the panes beside it.
function swapAnimated(change) {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || still || document.visibilityState !== 'visible') { change(); return }
  const root = document.documentElement
  root.setAttribute('data-view-swap', '')
  const swap = document.startViewTransition(() => { flushSync(change) })
  swap.finished.finally(() => root.removeAttribute('data-view-swap'))
}
