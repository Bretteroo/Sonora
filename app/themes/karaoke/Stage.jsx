import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useLyrics } from '../../frontend/src/lib/lyrics.js'
import { positionNow, parseDuration, isLiveStream } from '../../frontend/src/lib/format.js'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import { nowSummary, isLoaded } from './house.js'
import Backdrop from './Backdrop.jsx'
import { useBand, WORDS_IDS } from './curve.jsx'
import { cx } from './kit.jsx'

// The machine's reason for being: the words of the song over the picture,
// two lines at a time, each letter changing color as it is sung.
//
// The lyrics come timed by the line, not by the word, so the color is run
// across a line at an even pace for its letters, weighted by how long a
// letter of its script takes to sing, and is held at the line's end until the
// next line starts.

const GAP = 6        // seconds of quiet that make a break between two lines
const LEAD = 5       // how far ahead of its first word a line appears after a break
const DOTS = 4       // the count-in over a line that follows a break
const LINGER = 2     // how long a sung line stays up when a break follows it
const INTERLUDE = 8  // a break this long is announced as one
const CARD = 8       // how long a song's card stays up when the song starts

const WIDE = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힣豈-﫿]/
const MARK = /^[\p{P}\p{S}]+$/u
// Scripts whose letters join or stack: the color moves a word at a time there.
const JOINED = /[֐-ࣿऀ-෿฀-࿿က-႟ក-៿יִ-﷿ﹰ-﻿]/
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/
// What the karaoke face can draw: Latin without accents, and Hangul. A line
// with anything else is set whole in the system's heavy face, so no line is
// drawn half in one face and half in another.
const OWN_FACE = /^[ -~‘’“”㄰-㆏가-힣]*$/

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
const letters = (text) => (segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text))
const weigh = (letter) => (WIDE.test(letter) ? 2.6 : MARK.test(letter) ? 0.3 : 1)

function build(text) {
  const whole = JOINED.test(text)
  const words = []
  const flat = []
  let total = 0
  text.split(/\s+/).forEach((word) => {
    if (!word) return
    if (words.length) total += 0.5
    const units = (whole ? [word] : letters(word)).map((part) => {
      const weight = whole ? Math.max(1, letters(part).length) : weigh(part)
      const unit = { text: part, from: total, to: total + weight }
      total += weight
      return unit
    })
    words.push(units)
    flat.push(...units)
  })
  flat.forEach((unit) => { unit.from /= total; unit.to /= total })
  return { words, flat, weight: total, rtl: RTL.test(text), system: !OWN_FACE.test(text) }
}

// The lines that are sung, each with how long its color takes to cross it.
// An empty line in the timings marks where the line before it ends.
function prepare(lines) {
  const out = []
  for (let i = 0; i < (lines?.length || 0); i += 1) {
    const [at, raw] = lines[i]
    const text = (raw || '').trim()
    if (!text) continue
    let next = Infinity
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j][0] > at) { next = lines[j][0]; break }
    }
    const built = build(text)
    if (!built.flat.length) continue
    const guess = built.weight * 0.09 + 0.5
    const room = (next - at) * 0.92
    const dur = Math.max(Math.min(room, guess * 1.8), Math.min(1.2, room))
    out.push({ at, dur, end: at + dur, ...built })
  }
  return out
}

// What is on the screen at `pos` seconds: which line is in which of the two
// places, which one is being sung, and the count-in. Line n always takes
// place n mod 2, so the eye goes down and back up like a page being read.
function frameOf(sung, pos) {
  const slots = [null, null]
  let dots = 0
  let dotsSlot = -1
  let mode = 'lyrics'
  const put = (i, state) => { slots[i % 2] = { i, state } }
  let k = -1
  for (let i = 0; i < sung.length; i += 1) {
    if (sung[i].at <= pos) k = i
    else break
  }
  const next = sung[k + 1]
  const after = sung[k + 2]
  const wait = next ? next.at - pos : Infinity
  if (k < 0) {
    if (!next || wait > LEAD) mode = 'card'
    else {
      put(0, 'next')
      if (after && after.at - next.end < GAP) put(1, 'next')
      if (wait <= DOTS && next.at >= 2) { dots = Math.ceil(wait); dotsSlot = 0 }
    }
  } else {
    const cur = sung[k]
    const prev = sung[k - 1]
    const broken = !next || next.at - cur.end >= GAP
    const gone = broken && pos > cur.end + LINGER
    if (!gone) put(k, pos < cur.end ? 'active' : 'done')
    const swap = cur.at + Math.min(0.7, cur.dur * 0.25)
    if (prev && pos < swap && cur.at - prev.end < GAP) put(k - 1, 'done')
    else if (next && (!broken || wait <= LEAD)) {
      put(k + 1, 'next')
      if (broken && wait <= DOTS) { dots = Math.ceil(wait); dotsSlot = (k + 1) % 2 }
      if (gone && after && after.at - next.end < GAP) put(k + 2, 'next')
    }
    // After the last line the card comes back for as long as it stood at the
    // start, and no longer: words that end early do not leave it up for the
    // rest of the song.
    if (!slots[0] && !slots[1]) {
      mode = next ? (next.at - cur.end >= INTERLUDE ? 'interlude' : 'rest')
        : pos > cur.end + LINGER + CARD ? 'rest' : 'card'
    }
  }
  // The song's first CARD seconds, on the clock the words keep.
  const early = pos < CARD
  const key = `${mode}|${early ? 'e' : 'o'}|${slots.map((slot) => (slot ? `${slot.i}${slot.state}` : '-')).join('|')}|${dots}|${dotsSlot}`
  return { mode, opening: k < 0, early, slots, dots, dotsSlot, key }
}

const isPlaying = (tr) => tr?.state === 'PLAYING' || tr?.state === 'TRANSITIONING'

// The speaker reports where it is in whole seconds, now and then; between
// reports the place is counted forward here. A new report that differs a
// little is eased toward, so a letter never jumps back; one that differs a lot
// (a seek, another song) is taken at once. A paused song stays where the
// count stopped: the speaker's whole second is behind it, and taking that
// would walk the color back over letters already sung. The count never runs
// more than AHEAD past the last report: when the music stops moving without
// saying so (a stream that has stopped arriving), the words wait there.
// Counting on would put them far enough ahead to be taken for a seek and
// thrown back, over and over. While the speaker says it is buffering the
// count holds: the music has not started, and the words wait for it.
const AHEAD = 1
function useKaraoke(lines, transport, sync) {
  const sung = useMemo(() => prepare(lines), [lines])
  const latest = useRef(transport)
  latest.current = transport
  // The lyric sync wheel's figure, in seconds: the words are read this far ahead of the music.
  const shift = (sync || 0) / 1000
  const clock = useRef({ at: 0, pos: 0, ran: false, uri: '' })
  const shown = useRef('')
  const els = useRef([null, null])
  const marks = useRef(new WeakMap())
  const [view, setView] = useState(() => frameOf(sung, positionNow(transport, { exact: true }) + shift))
  const tr = transport || {}
  const playing = isPlaying(tr)

  useEffect(() => {
    let raf = 0
    let wrote = 0
    const read = (now) => {
      const song = latest.current
      const raw = positionNow(song, { exact: true, buffering: false })
      const c = clock.current
      const running = song?.state === 'PLAYING'
      const uri = song?.track_uri || ''
      if (!c.at || c.uri !== uri) c.pos = raw
      else if (song?.state === 'TRANSITIONING') { /* held where it is */ }
      else if (Math.abs(raw - c.pos) > 1.2) c.pos = raw
      else if (running) {
        // Time is counted only from one running frame to the next, so the
        // first frame after a pause adds nothing for the pause.
        const dt = c.ran ? Math.min(1, (now - c.at) / 1000) : 0
        const to = c.pos + dt
        c.pos = Math.max(c.pos, Math.min(to + (raw - to) * Math.min(1, dt * 0.6), raw + AHEAD))
      }
      c.at = now
      c.ran = running
      c.uri = uri
      return c.pos
    }
    const paint = (frame, pos) => {
      for (let s = 0; s < 2; s += 1) {
        const slot = frame.slots[s]
        const el = els.current[s]
        if (!slot || !el || slot.state !== 'active' || Number(el.dataset.line) !== slot.i) continue
        const line = sung[slot.i]
        let mark = marks.current.get(el)
        if (!mark) {
          mark = { nodes: el.querySelectorAll('.km-ly-ch'), states: [] }
          marks.current.set(el, mark)
        }
        const f = Math.min(1, Math.max(0, (pos - line.at) / line.dur))
        for (let i = 0; i < mark.nodes.length; i += 1) {
          const unit = line.flat[i]
          const node = mark.nodes[i]
          const state = f >= unit.to ? 2 : f > unit.from ? 1 : 0
          if (state !== mark.states[i]) {
            mark.states[i] = state
            node.toggleAttribute('data-sung', state === 2)
            node.toggleAttribute('data-wipe', state === 1)
          }
          if (state === 1) node.style.setProperty('--p', ((f - unit.from) / (unit.to - unit.from)).toFixed(3))
        }
      }
    }
    const step = (now) => {
      const pos = read(now) + shift
      const frame = frameOf(sung, pos)
      if (frame.key !== shown.current) {
        shown.current = frame.key
        setView(frame)
      }
      // The color moves about thirty times a second: the eye asks no more of
      // it, and the whole screen is redrawn each time it does.
      if (now - wrote >= 30) {
        wrote = now
        paint(frame, pos)
      }
      if (isPlaying(latest.current)) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [sung, playing, tr.rel_time, tr.received_at, tr.track_uri, shift])

  return { sung, view, els }
}

function Line({ line, index, state, place }) {
  return (
    <p className={cx('km-ly-line', line.system && 'km-ly-sys')} data-state={state} data-line={index} dir={line.rtl ? 'rtl' : undefined} ref={place}>
      {line.words.map((units, w) => (
        <React.Fragment key={w}>
          {w > 0 && ' '}
          <span className="km-ly-word">
            {units.map((unit, i) => <span className="km-ly-ch" data-ch={unit.text} key={i}>{unit.text}</span>)}
          </span>
        </React.Fragment>
      ))}
    </p>
  )
}

function Dots({ count }) {
  return (
    <span className="km-ly-dots" aria-hidden="true">
      {Array.from({ length: DOTS }, (_, i) => <i key={i} data-on={i < count ? '' : undefined} />)}
    </span>
  )
}

function Timed({ lines, transport, card, stay, interlude, sync, lift }) {
  const { sung, view, els } = useKaraoke(lines, transport, sync)
  const place = (s) => (el) => { els.current[s] = el }
  // The words change many times a second, and a bent screen is bent again, all of it, for each
  // change under it. So they are set in a box that can be moved, as it stands, between the
  // stage and a layer over the screen where they are bent alone. Moved rather than drawn
  // again, so a letter half sung stays half sung.
  const [box] = useState(() => {
    const el = document.createElement('div')
    el.style.display = 'contents'
    return el
  })
  const anchor = useRef(null)
  const words = useRef(null)
  useLayoutEffect(() => {
    const over = lift ? document.getElementById('km-lift') : null
    if (over) over.append(box)
    else anchor.current?.after(box)
    return () => box.remove()
  }, [lift, box])
  useBand(words, WORDS_IDS, lift)
  const early = useLate(view.early)
  const spent = useCardSpent(early, isPlaying(transport))
  const fresh = early && !spent
  return (
    <>
      {/* Before the first line the card is up only while the song is starting, by the same clock
          that brings the words on; after the last, it is back for as long. */}
      <Fade show={view.mode === 'card' && (fresh || stay || !view.opening)}>{card}</Fade>
      {/* Words that come in before the card has had its time do not send it away: it draws up
          into a band along the top of the picture and sees its time out there. */}
      <Fade show={view.mode !== 'card' && fresh && !stay}>{React.cloneElement(card, { 'data-band': '' })}</Fade>
      {view.mode === 'interlude' && <div className="km-interlude">{interlude}</div>}
      <span ref={anchor} hidden />
      {createPortal(
        <div className="km-ly" data-mode={view.mode} ref={words} style={lift ? { filter: `url(#${WORDS_IDS.filter})` } : undefined}>
          {[0, 1].map((s) => {
            const slot = view.slots[s]
            return (
              <div className="km-ly-slot" data-slot={s} key={s}>
                {view.dotsSlot === s && view.dots > 0 && <Dots count={view.dots} />}
                {slot && <Line key={slot.i} line={sung[slot.i]} index={slot.i} state={slot.state} place={place(s)} />}
              </div>
            )
          })}
        </div>, box)}
    </>
  )
}

// Whether a song is still starting: its first CARD seconds, by the song's own
// clock where it has one, so a song paused at its start keeps its card. A song
// with no length (a station's) is given the same time from when it came on.
function useOpening(transport, song) {
  const began = useRef({ song: null, at: 0 })
  if (began.current.song !== song) began.current = { song, at: performance.now() }
  const [opening, setOpening] = useState(true)
  const state = transport?.state
  const length = parseDuration(transport?.track_duration)
  useEffect(() => {
    const gone = length ? positionNow(transport, { exact: true }) : (performance.now() - began.current.at) / 1000
    const left = CARD - gone
    setOpening(left > 0)
    if (left <= 0 || (length && !isPlaying(transport))) return undefined
    const timer = setTimeout(() => setOpening(false), left * 1000)
    return () => clearTimeout(timer)
  }, [song, state, length, transport?.rel_time, transport?.received_at])
  return opening
}

// The card's longest stay at a song's start, by the wall clock: where the song's own clock
// does not move (a room that plays and reports no place in the song), the card still goes.
function useCardSpent(up, playing, song = '') {
  const [spent, setSpent] = useState(false)
  useEffect(() => {
    setSpent(false)
    if (!up || !playing) return undefined
    const timer = setTimeout(() => setSpent(true), CARD * 1000)
    return () => clearTimeout(timer)
  }, [up, playing, song])
  return up && spent
}

// A song that was under way and is suddenly back at its start is, as often as not, a song being
// left: a speaker told to skip reports the old song at 0:00 before it names the new one, and
// the old song's card came up for that moment. So a card that comes back waits LATE_MS, and a
// new song's card, which has not been away, does not wait at all.
const LATE_MS = 700
function useLate(up, song = '') {
  const st = useRef({ song, down: false, up: false, wait: false })
  if (st.current.song !== song) st.current = { song, down: false, up: false, wait: false }
  if (up && !st.current.up && st.current.down) st.current.wait = true
  if (!up) { st.current.down = true; st.current.wait = false }
  st.current.up = up
  const [, bump] = useState(0)
  useEffect(() => {
    if (!up || !st.current.wait) return undefined
    const timer = setTimeout(() => { st.current.wait = false; bump((n) => n + 1) }, LATE_MS)
    return () => clearTimeout(timer)
  }, [up, song])
  return up && !st.current.wait
}

// The bent screen is drawn through a filter, and a browser may keep the picture it filtered
// last when a thing only leaves it: the card stood there, gone from the page, until something
// else made the screen draw (Firefox). So the card's coming and going each ask for the screen
// to be filtered afresh, by a filter that draws the same.
function redraw(tube) {
  const was = tube?.style.filter
  if (!was || was.includes('opacity(')) return
  tube.style.filter = `${was} opacity(1)`
  const set = tube.style.filter
  requestAnimationFrame(() => requestAnimationFrame(() => { if (tube.style.filter === set) tube.style.filter = was }))
}

function Redraw() {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const tube = ref.current?.closest('.km-crt')
    redraw(tube)
    return () => redraw(tube)
  }, [])
  return <i hidden ref={ref} />
}

const FADE_MS = 450

// The card does not snap on and off the screen: it comes up marked as entering and fades in,
// and it stays FADE_MS longer, marked as leaving, and fades. A card handed from one holder to
// another in the same moment (the words arriving under it) has not been away and does not
// fade in again.
let cardGone = -1e9
function Fade({ show, children }) {
  const last = useRef(children)
  if (show) last.current = children
  const [held, setHeld] = useState(show)
  if (show && !held) setHeld(true)
  const [entering, setEntering] = useState(false)
  useLayoutEffect(() => {
    if (!show) return undefined
    const fresh = performance.now() - cardGone > 200
    if (fresh) setEntering(true)
    const timer = fresh ? setTimeout(() => setEntering(false), FADE_MS) : 0
    return () => { clearTimeout(timer); setEntering(false); cardGone = performance.now() }
  }, [show])
  useEffect(() => {
    if (show || !held) return undefined
    const timer = setTimeout(() => setHeld(false), FADE_MS)
    return () => clearTimeout(timer)
  }, [show, held])
  if (show) return entering ? React.cloneElement(children, { 'data-entering': '' }) : children
  return held && last.current ? React.cloneElement(last.current, { 'data-leaving': '' }) : null
}

const HOLD_MS = 4000

// Words with no timings: the whole song on a sheet that rolls up as the song
// goes by, and waits a moment where the reader has moved it themselves. At its
// own pace it reaches its foot as the song ends; `rate` makes it roll that many
// times as fast from then on.
function Sheet({ text, transport, note, rate }) {
  const ref = useRef(null)
  const touched = useRef(0)
  const latest = useRef(transport)
  latest.current = transport
  const pace = rate || 1
  // Where the sheet stood (as a share of its length) and where the song was when the pace last changed.
  const mark = useRef({ pos: 0, at: 0, pace })
  const playing = isPlaying(transport)
  useEffect(() => {
    const roll = () => {
      const el = ref.current
      const tr = latest.current
      const length = parseDuration(tr?.track_duration)
      if (!el || !length || performance.now() - touched.current < HOLD_MS) return
      const room = el.scrollHeight - el.clientHeight
      const pos = positionNow(tr, { exact: true })
      const from = mark.current
      const reach = (rate) => Math.max(0, Math.min(1, from.at + ((pos - from.pos) / length) * rate))
      // A new pace takes over from where the sheet stands: it rolls on faster or slower, and does not jump.
      if (from.pace !== pace) mark.current = { pos, at: reach(from.pace), pace }
      el.scrollTop = reach(pace) * room
    }
    roll()
    if (!playing) return undefined
    const timer = setInterval(roll, 1000)
    return () => clearInterval(timer)
  }, [playing, text, pace, transport?.rel_time, transport?.track_uri])
  const hold = () => { touched.current = performance.now() }
  return (
    <div className="km-sheet">
      <p className="km-sheet-note">{note}</p>
      <div className={cx('km-sheet-text', !OWN_FACE.test(text.replace(/\s+/g, ' ')) && 'km-ly-sys')} ref={ref} onWheel={hold} onTouchMove={hold} onPointerDown={hold} tabIndex={0}>
        {text}
      </div>
    </div>
  )
}

function Credit({ text }) {
  const at = text.indexOf('LRCLIB')
  if (at < 0) return text
  return <>{text.slice(0, at)}<a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a>{text.slice(at + 6)}</>
}

// Whether the reader has said "not now" to the notice, until the page is loaded again.
let declined = false

/** The words for what a room plays, and whether the reader has put the lookup
 * off: { lyrics, later, decline, ask }. Held by the machine and not by the
 * screen, since the face's sync wheel goes by what kind of words came. */
export function useStageLyrics(transport) {
  const [later, setLater] = useState(declined)
  // A stopped room has no song on the screen: no words and no card for it.
  const lyrics = useLyrics(transport?.state === 'STOPPED' ? null : transport, !later)
  const decline = () => { declined = true; setLater(true) }
  const ask = () => { declined = false; setLater(false) }
  return { lyrics, later, decline, ask }
}

export default function Stage({ zone, songNumber, sync, rate, words, lift = false, away = false }) {
  const { t } = useI18n()
  const tr = zone?.transport || null
  const { lyrics, later, decline, ask } = words
  const stopped = tr?.state === 'STOPPED'
  const loaded = Boolean(zone) && isLoaded(tr) && !stopped
  const now = loaded ? nowSummary(tr, t) : { title: '', sub: '' }
  const art = zone && loaded && tr?.source !== 'tv' ? nowPlayingArt(zone.host, tr, { best: true, zone: zone.uuid }) : ''
  const song = tr?.title ? `${tr.track_uri || ''}|${tr.title}` : ''
  // How far into the song the room is, for the video to keep step with. A broadcast does not say.
  const inSong = () => (tr && !isLiveStream(tr.track_duration, tr.media_uri) ? positionNow(tr, { exact: true }) : null)
  const starting = useLate(useOpening(tr, song), song)
  const spent = useCardSpent(starting, isPlaying(tr), song)
  const opening = starting && !spent
  // A television or a line-in is no song: what it is stays on the screen.
  const held = tr?.source === 'tv' || tr?.source === 'line_in'

  const card = loaded ? (
    <div className="km-card">
      <Redraw />
      <span className="km-card-art"><Art src={art} size={360} fallback="note" brokenFallback="note" /></span>
      <div className="km-card-words">
        {songNumber && <span className="km-card-no">{songNumber}</span>}
        <strong className={cx('km-card-title', !OWN_FACE.test(now.title) && 'km-ly-sys')}>{now.title}</strong>
        {now.sub && <span className="km-card-sub">{now.sub}</span>}
      </div>
    </div>
  ) : (
    <div className="km-card km-card-idle"><strong className="km-card-idle-words">{t('km.pickSong')}</strong></div>
  )

  const state = lyrics.state
  const line = state === 'loading' ? t('lyrics.loading')
    : state === 'none' ? t('lyrics.none')
      : state === 'error' ? t('lyrics.error')
        : state === 'instrumental' ? t('lyrics.instrumental') : ''

  return (
    <section className="km-stage" data-state={state} data-away={away || undefined} aria-label={t('lyrics.show')}>
      {/* The video moves only once the speaker is playing, not while it fills its buffer. While
          another page has the screen it holds its frame, and goes on from there afterwards. */}
      <Backdrop playing={!away && tr?.state === 'PLAYING'} stopped={stopped} song={song} room={zone?.uuid || ''} where={inSong} off={tr?.source === 'tv'} />
      <div className="km-stage-shade" aria-hidden="true" />
      {state === 'timed'
        ? <Timed key={tr?.track_uri || ''} lines={lyrics.lines} transport={tr} card={card} stay={held || !loaded} interlude={t('km.interlude')} sync={sync} lift={lift && !line} />
        : state === 'plain'
          ? <Sheet key={tr?.track_uri || ''} text={lyrics.text} transport={tr} note={t('lyrics.untimed')} rate={rate} />
          : <Fade show={opening || held || !loaded}>{card}</Fade>}
      {state === 'notice' && (
        <div className="km-notice" role="group" aria-label={t('lyrics.show')}>
          <div className="km-notice-body">
            <p>{t('lyrics.notice')}</p>
            <div className="km-notice-keys">
              <button type="button" className="km-osd-key" data-primary="" onClick={lyrics.agree}>{t('lyrics.agree')}</button>
              <button type="button" className="km-osd-key" onClick={decline}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {later && loaded && tr?.source !== 'tv' && tr?.source !== 'line_in' && (
        <button type="button" className="km-osd-key km-stage-ask" onClick={ask}>{t('lyrics.show')}</button>
      )}
      {line && <p className="km-stage-line" role="status">{line}</p>}
      {(state === 'timed' || state === 'plain') && <p className="km-stage-credit"><Credit text={t('lyrics.credit')} /></p>}
    </section>
  )
}
