import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useCloudAccount } from '../../frontend/src/lib/useCloudAccount.js'
import ThemeChooser from '../../frontend/src/components/ThemeChooser.jsx'
import { fadeThemeChange } from '../../frontend/src/lib/theme.jsx'
import * as G from './glyphs.jsx'
import { Window, WindowBar, Btn, Toggle, Select, Field, Kbd } from './kit.jsx'
import { usePrefs, useSaved, writePref, writeText } from './prefs.js'
import { readList, readLink, fullLink, withoutRepeats, countVideos, onPlaylistRead } from './Backdrop.jsx'

// The Setup program: every setting on one page that has the whole screen, a pane for how
// the machine looks and one for the Sonos account, and the keys for the shortcuts and
// About at the foot. Every pane reads and writes through the
// calls the other themes use.

export const PAGES = ['appearance', 'account']

export default function SetupProgram({ page, onAbout, onShortcuts, compact }) {
  const { t } = useI18n()
  const root = useRef(null)
  // Arriving for one pane (a theme just chosen lands on Appearance) brings it into sight.
  useEffect(() => {
    if (page) root.current?.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: 'start' })
  }, [page])
  return (
    <div className="km-setup km-setup-open" ref={root}>
      {PAGES.map((id) => (
        <section className="km-setup-page km-pane" key={id} data-page={id} aria-label={t(`km.setup.${id}`)}>
          <h1 className="km-pane-title">{t(`km.setup.${id}`)}</h1>
          <div className="km-pane-body">
            <p className="km-dim km-setup-blurb">{t(`km.setup.${id}.blurb`)}</p>
            {id === 'account' && <AccountPage />}
            {id === 'appearance' && <AppearancePage />}
          </div>
        </section>
      ))}
      <div className="km-setup-extra">
        {!compact && <Btn size="s" icon={<G.Keyboard size={14} />} onClick={onShortcuts}>{t('desk.shortcuts.title')}</Btn>}
        <Btn size="s" icon={<G.Info size={14} />} onClick={onAbout}>{t('about.menu')}</Btn>
      </div>
    </div>
  )
}

// --- Sonos account ----------------------------------------------------------------------

function AccountPage() {
  const { t } = useI18n()
  const account = useCloudAccount()
  const [creds, setCreds] = useState({ email: '', password: '' })
  const { busy, error } = account
  const signIn = async (event) => {
    event.preventDefault()
    if (await account.signIn(creds.email, creds.password)) setCreds({ email: '', password: '' })
    else setCreds((prev) => ({ ...prev, password: '' }))
  }
  return (
    <div className="km-stack">
      {account.known && <><p className="km-dim">{t('account.blurb')}</p><p className="km-dim">{t('account.optional')}</p></>}
      {!account.known ? null : account.signedIn ? (
        <div className="km-box km-toolrow">
          <G.Person size={24} />
          <span>{t('account.signedInAs', { email: account.email })}</span>
          <span className="km-grow" />
          <Btn size="s" disabled={busy} onClick={account.signOut}>{t('account.signOut')}</Btn>
        </div>
      ) : (
        <form className="km-stack km-signin" onSubmit={signIn}>
          <Field label={t('account.email')} type="email" value={creds.email} onChange={(v) => setCreds({ ...creds, email: v })} autoComplete="username" />
          <Field label={t('account.password')} type="password" value={creds.password} onChange={(v) => setCreds({ ...creds, password: v })} autoComplete="current-password" />
          <div><Btn variant="solid" type="submit" disabled={busy || !creds.email || !creds.password}>{busy ? t('account.signingIn') : t('account.signIn')}</Btn></div>
        </form>
      )}
      {error && <p className="km-error">{error}</p>}
    </div>
  )
}

// --- appearance ------------------------------------------------------------------------------

function Field2({ label, children, hint = '' }) {
  return (
    <div className="km-setting">
      <span className="km-setting-label">{label}</span>
      <div className="km-setting-value">{children}</div>
      {hint && <p className="km-dim">{hint}</p>}
    </div>
  )
}

// The videos to play behind the words: a switch for them, and links to YouTube, one to a
// line. The box is empty as the machine ships, and an empty box leaves the words on a flat
// blue screen, as the switch turned off does. The switch does not touch the box: the links
// stay in it, to be edited or not, for when the videos are turned on again.
// What is typed is kept as typed; a line that is not a link is pointed out, not removed.
function VideoList() {
  const { t } = useI18n()
  const prefs = usePrefs()
  const saved = useSaved()
  const [text, setText] = useState(prefs.videos)
  // The list as Sonora holds it may arrive after the box is drawn, or be changed from another
  // browser's copy of this page; the box takes it unless it is being typed in.
  const boxRef = useRef(null)
  useEffect(() => { if (document.activeElement !== boxRef.current) setText(prefs.videos) }, [prefs.videos])
  const lines = text.split(/\r?\n/)
  // The numbers beside the lines move with the box as it is scrolled.
  const numbersRef = useRef(null)
  const follow = (event) => { if (numbersRef.current) numbersRef.current.style.transform = `translateY(${-event.target.scrollTop}px)` }
  const { bad } = readList(text)
  const badLine = bad ? lines.findIndex((line) => line.trim() === bad) + 1 : 0
  // A list with a line that is no link stays in the box and goes no further: what plays, and what
  // Sonora keeps, is the last list that was good all the way down.
  const keep = (value) => { setText(value); if (!readList(value).bad) writeText('videos', withoutRepeats(value)) }
  // A link given twice is kept once, and the box shows the list as it was kept once it is saved.
  useEffect(() => {
    if (!saved || text === prefs.videos || readList(text).bad || withoutRepeats(text) !== prefs.videos) return
    const box = boxRef.current
    const at = box && document.activeElement === box ? Math.min(box.selectionStart, prefs.videos.length) : -1
    setText(prefs.videos)
    if (at >= 0) requestAnimationFrame(() => box.setSelectionRange(at, at))
  }, [saved])
  // A pasted short link, or one that names a playlist, goes in written out in full. Nothing else
  // pasted is changed.
  const paste = (event) => {
    const pasted = event.clipboardData?.getData('text') || ''
    const full = pasted.split(/\r?\n/).map(fullLink).join('\n')
    if (full === pasted) return
    event.preventDefault()
    const box = event.target
    const at = box.selectionStart + full.length
    keep(box.value.slice(0, box.selectionStart) + full + box.value.slice(box.selectionEnd))
    requestAnimationFrame(() => box.setSelectionRange(at, at))
  }
  return (
    <div className="km-videos" data-off={!prefs.videosOn || undefined}>
      <Toggle checked={prefs.videosOn} label={t('km.videos')} onChange={(on) => writePref('videosOn', on)} />
      <span className="km-dim km-hint">{t('km.videosBody')} {t('km.videosTip')}</span>
      <div className="km-lined" data-bad={badLine > 0 || undefined}>
        <div className="km-lines" aria-hidden="true" style={{ width: `calc(${String(lines.length).length}ch + 17px)` }}>
          <div ref={numbersRef}>{lines.map((_, i) => <span key={i} data-bad={i + 1 === badLine || undefined}>{i + 1}</span>)}</div>
        </div>
        <textarea ref={boxRef} className="km-textarea" rows={5} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off"
                  value={text} aria-label={t('km.videosLinks')} aria-invalid={badLine > 0 || undefined}
                  onChange={(event) => keep(event.target.value)} onPaste={paste} onScroll={follow} />
      </div>
      <GaugeSlot shown={prefs.videosOn}><VideoGauge text={prefs.videos} /></GaugeSlot>
      <div className="km-videos-foot">
        <span className="km-error" role="status">{badLine > 0 && t('km.videosBad', { line: badLine })}</span>
        {badLine > 0
          ? <span className="km-saved km-dim" role="status" data-bad><G.Close size={12} aria-hidden="true" />{t('km.videosNotSaved')}</span>
          : <span className="km-saved km-dim" role="status" data-on={saved || undefined}>{saved && <><G.Check size={12} aria-hidden="true" />{t('km.videosSaved')}</>}</span>}
      </div>
      {/* A picture shot for an older, squarer set leaves the sides of a wide screen empty; zoomed,
          it fills them, and its top and bottom go past the glass. */}
      <Toggle checked={prefs.zoomVideo} label={t('km.zoomVideo')} onChange={(on) => writePref('zoomVideo', on)} />
      <span className="km-dim km-hint">{t('km.zoomVideoBody')}</span>
    </div>
  )
}

// Where the thermometer stands, under the box of links: shown only while the videos are on. Turned
// on, it slides down from behind the box; turned off, it slides back up under it and is gone. It is
// cut off at the slot's edges only while it moves, so the fireworks can reach past them once it is out.
const SLIDE_MS = 340
function GaugeSlot({ shown, children }) {
  const [out, setOut] = useState(shown)
  useEffect(() => {
    if (!shown) { setOut(false); return undefined }
    const timer = setTimeout(() => setOut(true), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [shown])
  return (
    <div className="km-gauge-slot" data-shown={shown || undefined} data-out={(shown && out) || undefined} aria-hidden={!shown || undefined}>
      <div className="km-gauge-slot-inner">{children}</div>
    </div>
  )
}

// How many videos the box comes to, as a thermometer: thirty fills it, red at first, yellow on
// the way, green when full; from fifty it shimmers purple with stars, and from a hundred fireworks go
// off round it while it heaps compliments on whoever got it there. Its words cheer all the while. The
// movement lasts a few seconds each time, so the page is not kept redrawing.
const GAUGE_FULL = 30
const GAUGE_STARS = 50
const GAUGE_FIREWORKS = 100
const FIREWORKS_MS = 5000       // how long they go off each time the page opens
const FIREWORKS_FADE_MS = 600   // the last of that, fading
const REST_MS = 1500          // how long the shimmer and the stars take to slow to a stop
const GAUGE_WOW = 5
const GAUGE_PRAISE = 7
const PRAISE_MS = 2800
function VideoGauge({ text }) {
  const { t, language } = useI18n()
  const [tally, setTally] = useState(() => countVideos(text))
  useEffect(() => {
    setTally(countVideos(text))
    return onPlaylistRead(() => setTally(countVideos(text)))
  }, [text])
  const { count, unread, failed } = tally
  // The lines of the box naming a playlist that could not be read, as the box numbers them, grouped
  // by why: one sentence for each reason the player gave.
  const whyOf = new Map(failed.map((f) => [f.list, f.why]))
  const failedLines = { embed: [], gone: [], quiet: [] }
  if (failed.length) {
    String(text || '').split(/\r?\n/).forEach((line, n) => {
      const why = whyOf.get(readLink(line)?.list)
      if (why) failedLines[why].push(n + 1)
    })
  }
  const listed = (nums) => new Intl.ListFormat(language, { type: 'conjunction' }).format(nums.map(String))
  // In the order of the lines they name.
  const unreadNote = ['embed', 'gone', 'quiet'].filter((why) => failedLines[why].length)
    .sort((a, b) => failedLines[a][0] - failedLines[b][0])
    .map((why) => t.plural(`km.gaugeUnread.${why}`, failedLines[why].length, { lines: listed(failedLines[why]) })).join(' ')
  const party = count >= GAUGE_FIREWORKS
  // The fireworks go off for a few seconds each time the page is opened, then fade and stop.
  const [show, setShow] = useState('on')
  useEffect(() => {
    const fading = setTimeout(() => setShow('ending'), FIREWORKS_MS - FIREWORKS_FADE_MS)
    const gone = setTimeout(() => setShow('off'), FIREWORKS_MS)
    return () => { clearTimeout(fading); clearTimeout(gone) }
  }, [])
  const level = count === 0 ? 'empty' : count < 15 ? 'red' : count < GAUGE_FULL ? 'yellow' : count < GAUGE_STARS ? 'green' : 'wow'
  // The shimmer, the stars, and the compliments move for as long as the fireworks go off, each time
  // the page opens or the count changes, and then hold still.
  // Coming to rest, they slow over a second and a half and stop where they are, rather than
  // jumping back to where they began: the screen's curve is redrawn whole for every frame that
  // anything on it moves, so a still page is a fast one.
  const [lively, setLively] = useState(true)
  const gauge = useRef(null)
  useEffect(() => {
    setLively(true)
    const timer = setTimeout(() => setLively(false), FIREWORKS_MS)
    return () => clearTimeout(timer)
  }, [count])
  useEffect(() => {
    const el = gauge.current
    if (!el?.getAnimations) return undefined
    const moving = () => el.getAnimations({ subtree: true }).filter((a) => !a.effect?.target?.closest?.('.km-gauge-fireworks'))
    if (lively) {
      for (const a of moving()) { a.playbackRate = 1; a.play() }
      return undefined
    }
    let raf = 0
    const from = performance.now()
    const slow = (now) => {
      const left = 1 - Math.min(1, (now - from) / REST_MS)
      // Easing out: quickly at first, gently at the end.
      const rate = left * left
      for (const a of moving()) { if (rate > 0) a.playbackRate = rate; else a.pause() }
      if (rate > 0) raf = requestAnimationFrame(slow)
    }
    raf = requestAnimationFrame(slow)
    return () => cancelAnimationFrame(raf)
  }, [lively])
  // At a hundred and more, a new compliment every few seconds, never the same twice running.
  const [praise, setPraise] = useState(1)
  useEffect(() => {
    if (!party || !lively) return undefined
    const timer = setInterval(() => setPraise((was) => 1 + ((was + Math.floor(Math.random() * (GAUGE_PRAISE - 1))) % GAUGE_PRAISE)), PRAISE_MS)
    return () => clearInterval(timer)
  }, [party, lively])
  const empty = t('km.gaugeEmpty', { least: '\u0000' }).split('\u0000')
  const words = count === 0 ? <>{empty[0]}<em>{t('km.gaugeAtLeast')}</em>{empty[1]}</>
    : count < GAUGE_FULL / 2 ? t('km.gaugeStart')
      : count < GAUGE_FULL - 5 ? t('km.gaugeHalf')
        : count < GAUGE_FULL ? t('km.gaugeNear')
          : count === GAUGE_FULL ? t('km.gaugeFull')
            : party ? <span key={praise} className="km-gauge-praise">{t(`km.gaugeHundred${praise}`)}</span>
              : t(`km.gaugeWow${(count % GAUGE_WOW) + 1}`)
  const spoken = count === 0 ? t('km.gaugeEmpty', { least: t('km.gaugeAtLeast') }) : party ? t(`km.gaugeHundred${praise}`) : words
  return (
    <div ref={gauge} className="km-gauge" data-level={level} data-party={party || undefined} data-lively={lively || undefined} role="meter" aria-valuemin={0} aria-valuemax={GAUGE_FULL} aria-valuenow={Math.min(count, GAUGE_FULL)}
         aria-valuetext={`${t('km.gaugeCount', { count })}. ${spoken}`}>
      {party && show !== 'off' && (
        <span className="km-gauge-fireworks" data-ending={show === 'ending' || undefined} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--km-fw': i }} />)}
        </span>
      )}
      <div className="km-gauge-tube" aria-hidden="true">
        <i className="km-gauge-fill" style={{ '--km-gauge': Math.min(count, GAUGE_FULL) / GAUGE_FULL }} />
        <i className="km-gauge-bulb" />
        {level === 'wow' && <span className="km-gauge-stars">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--km-star': i }}>{'\u2726'}</i>)}</span>}
      </div>
      <p className="km-gauge-words" aria-hidden="true">
        <strong>{t('km.gaugeCount', { count })}</strong> {words}{unread > 0 ? <span className="km-dim"> {t('km.gaugeReading')}</span> : unreadNote && <span className="km-dim"> {unreadNote}</span>}
      </p>
    </div>
  )
}

// The other cabinet goes in with a cross-fade, as a theme does, so the machine does not jump from one
// to the other. Where the browser cannot cross-fade, the cabinet fades out, is changed, and fades in.
const SWAP_MS = 220
function swapCabinet(change) {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (still) { change(); return }
  if (document.startViewTransition) { fadeThemeChange(change); return }
  const root = document.documentElement
  root.setAttribute('data-km-swapping', '')
  setTimeout(() => {
    change()
    requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute('data-km-swapping')))
  }, SWAP_MS)
}

// How the machine's picture is drawn (bent with the glass, worn like tape) and what plays
// behind the words, then the chooser every theme carries.
function AppearancePage() {
  const { t } = useI18n()
  const prefs = usePrefs()
  const [changed, setChanged] = useState(false)
  const write = (key, value) => { writePref(key, value); setChanged(true) }
  return (
    <div className="km-stack">
      <Toggle checked={prefs.bend} label={t('km.bend')} onChange={(on) => write('bend', on)} />
      <p className="km-dim km-hint">{t('km.bendBody')}</p>
      <Toggle checked={prefs.keySound} label={t('km.keySound')} onChange={(on) => write('keySound', on)} />
      <p className="km-dim km-hint">{t('km.keySoundBody')}</p>
      <VideoList />
      <Toggle checked={prefs.altDesign} label={t('km.altDesign')} onChange={(on) => swapCabinet(() => write('altDesign', on))} />
      <p className="km-dim km-hint">{t('km.altDesignBody')}</p>
      <ThemeChooser Field={Field2} Select={Select} changed={changed} onApply={() => setChanged(false)} classes={{
        select: 'km-select', button: 'km-btn km-btn-line km-btn-s', primary: 'km-btn km-btn-solid km-btn-s',
        preview: 'km-theme-preview', version: 'km-theme-version', blurb: 'km-dim',
        noshot: 'km-theme-noshot', actions: 'km-inline', error: 'km-error', manage: 'km-theme-manage',
      }} />
    </div>
  )
}

export function ShortcutsWindow({ onClose }) {
  const { t } = useI18n()
  const rows = [
    [t('desk.shortcuts.playPause'), 'Space'], [t('common.next'), 'Ctrl →'], [t('common.previous'), 'Ctrl ←'],
    [t('desk.shortcuts.volUp'), 'Ctrl ↑'], [t('desk.shortcuts.volDown'), 'Ctrl ↓'], [t('desk.shortcuts.mute'), 'Ctrl M'], [t('win.shortcuts.muteAll'), 'Ctrl ⇧ M'],
    [t('win.shortcuts.toggleShuffle'), 'Ctrl E'], [t('win.shortcuts.toggleCrossfade'), 'Ctrl ⇧ X'],
    [t('desk.shortcuts.nextZone'), 'Ctrl .'], [t('desk.shortcuts.prevZone'), 'Ctrl ,'], [t('common.themeSwitch'), 'Ctrl Y'],
    [t('km.songNumber'), '0-9 ↵'], [t('km.prog.queue'), 'Ctrl G'],
    [t('desk.shortcuts.title'), '?'], [t('win.shortcuts.closeWindow'), 'Esc'],
  ]
  return (
    <Window kind="dialog" title={t('desk.shortcuts.title')} onClose={onClose}>
      <WindowBar title={t('desk.shortcuts.title')} onClose={onClose} />
      <div className="km-window-body">
        <dl className="km-shortcuts">
          {rows.map(([label, key]) => <React.Fragment key={key}><dt>{label}</dt><dd><Kbd>{key}</Kbd></dd></React.Fragment>)}
        </dl>
      </div>
      <footer className="km-window-actions"><Btn variant="solid" onClick={onClose}>{t('common.done')}</Btn></footer>
    </Window>
  )
}
