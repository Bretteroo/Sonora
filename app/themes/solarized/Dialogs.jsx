import './dialogs.css'
import { useLibrarySettings } from '../../frontend/src/lib/useLibrarySettings.js'
import { readLibraryPrefs, writeLibraryPrefs, FOLDER_SORTS } from '../../frontend/src/lib/libraryPrefs.js'
import ThemeChooser from '../../frontend/src/components/ThemeChooser.jsx'
import SonosAccount from '../../frontend/src/components/SonosAccount.jsx'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useTheme } from '../../frontend/src/lib/theme.jsx'
import { useI18n, LANGUAGES } from '../../frontend/src/i18n/index.jsx'
import { api, ApiError } from '../../frontend/src/lib/api.js'
import { useRemoveChoice } from '../../frontend/src/lib/useRemoveChoice.js'
import { serviceLinkedMessage, LinkedMessage } from '../../frontend/src/lib/serviceLinkedMessage.js'
import { zoneLabel } from '../../frontend/src/lib/timezones.js'
import { useSleepTimer, SLEEP_CHOICES, sleepLabel } from '../../frontend/src/lib/useSleepTimer.js'
import { useAlarms, recurrenceKey, recurrenceDays } from '../../frontend/src/lib/useAlarms.js'
import AlarmEditorPanel from '../../frontend/src/components/AlarmEditorPanel.jsx'
import TimeField from '../../frontend/src/components/TimeField.jsx'
import { orderedHouseholds, twoLineMetadata, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import ParentalControls from '../../frontend/src/components/ParentalControls.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import appIcon from '../../frontend/src/assets/sonora.png'
import { withoutBrowserRoom } from '../../frontend/src/lib/browserRoom.js'
import Swirl from '../../frontend/src/components/Swirl.jsx'
import { APP } from '../../frontend/src/lib/meta.js'
import { playersOf } from '../../frontend/src/lib/players.js'
import { proposedGroups, groupingPlan, runPlan } from '../../frontend/src/lib/grouping.js'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'
import { canStereoPair } from '../../frontend/src/lib/rooms.js'

// Secondary windows. On the Mac these are ordinary light windows floating
// over the dark application, so they are drawn as such: a 22px title bar with
// the three window controls (only close does anything here), then the content
// at the size the application gives it (Preferences 798x528 with a 178px
// table of contents; Group Rooms 480x372).

export function Window({ title, onClose, className, style, children }) {
  // The app icon in the title bar is a Windows convention; the Mac chrome
  // hides it (desktop.css) and the Windows theme shows it.
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  const { t } = useI18n()
  return (
    <div className="dk-modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`dk-window ${className || ''}`} role="dialog" aria-label={title} style={style}>
        <div className="dk-window-title">
          <img className="dk-window-icon" src={appIcon} alt="" />
          <div className="dk-lights">
            <button type="button" className="dk-light-close" title={t('common.close')} onClick={onClose} />
            <span className="dk-light-min" />
            <span className="dk-light-zoom" />
          </div>
          <span>{title}</span>
        </div>
        <div className="dk-window-body">{children}</div>
      </div>
    </div>
  )
}

// --- Preferences --------------------------------------------------------------

// The Mac app's Preferences window (S1 57.x on Tahoe, measured 2026-09-15):
// 798x528, a 178px table of contents with EQ Settings alone at the top and
// Music Library, Services and Additional Usage Data below it, a footer that
// points at the mobile app, and one page at a time on the right, each a bold
// title over a rounded gray group box. Sonora's own pages (a room's device
// settings, Parental Controls, Date and Time, the theme chooser) follow as a
// third group in the same dress: the Mac app leaves those to the mobile app,
// Sonora does not.
const MOBILE_APP_URL = 'https://support.sonos.com/en-us/downloads'
// The app's own third page, Additional Usage Data, is left out: the
// backlog asks for it to appear nowhere in Settings (2026-09-14), and the
// setting is a Sonos-account matter Sonora can neither read nor change.
const PREF_GROUPS = [['eq'], ['library', 'services'], ['room', 'parental', 'datetime', 'basic']]

export function Preferences({ initial, current = null, onClose, onAddService, onServicesChanged, onLinkService }) {
  const { zoneList, households } = useSystem()
  const { t } = useI18n()
  // Room settings are a speaker's, so the browser room is not one of these.
  const rooms = useMemo(() => withoutBrowserRoom(zoneList).sort((a, b) => a.name.localeCompare(b.name)), [zoneList])
  // A tile's EQ button opens the EQ page on its room; the menus name a page.
  const initialRoom = rooms.some((z) => z.uuid === initial) ? initial : null
  const [page, setPage] = useState(initialRoom ? 'eq' : (initial || 'eq'))
  const [room, setRoom] = useState(initialRoom)
  // Opened from the menu, the EQ page shows the first room of the system the
  // room in view is on: the S1 Mac app, with a room chosen, opened on
  // the first room of its system (2026-09-24). Sonora lists both systems,
  // and the first room of all was the S2 one.
  const home = households.find((h) => (h.zone_uuids || []).includes(current))
  const zone = rooms.find((z) => z.uuid === room)
    || (home && rooms.find((z) => (home.zone_uuids || []).includes(z.uuid))) || rooms[0] || null
  const labels = {
    eq: t('desk.prefs.eqSettings'), library: t('desk.prefs.musicLibraryShort'), services: t('desk.prefs.servicesShort'),
    room: t('desk.prefs.roomSettings'), parental: t('desk.prefs.parental'),
    datetime: t('desk.prefs.dateTimeShort'), basic: t('desk.prefs.sonora'),
  }
  const pageIds = PREF_GROUPS.flat()
  const tocRef = useRef(null)
  const onTocKey = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const at = pageIds.indexOf(page)
    const next = pageIds[Math.min(pageIds.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))]
    if (!next || next === page) return
    setPage(next)
    tocRef.current?.querySelector(`[data-page="${next}"]`)?.focus()
  }
  const item = (id) => (
    <button key={id} type="button" data-page={id} aria-selected={page === id} onClick={() => setPage(id)}>{labels[id]}</button>
  )

  return (
    <Window title={t('desk.prefs.title')} onClose={onClose} className="dk-prefs">
      <nav className="dk-prefs-toc" aria-label={t('desk.prefs.title')} ref={tocRef} onKeyDown={onTocKey}>
        {/* The narrow layout swaps the column of pages for this dropdown; the
            shared responsive sheet decides which is showing. */}
        <label className="dk-prefs-jump">
          <span className="dk-sr-only">{t('desk.prefs.title')}</span>
          <select value={page} onChange={(event) => setPage(event.target.value)}>
            {pageIds.map((id) => <option key={id} value={id}>{labels[id]}</option>)}
          </select>
        </label>
        {PREF_GROUPS.map((group, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className="dk-prefs-gap" />}
            {group.map(item)}
          </React.Fragment>
        ))}
        <div className="dk-prefs-foot">
          <p>{t('desk.prefs.mobileNote')}</p>
          <button type="button" className="dk-win-btn" onClick={() => window.open(MOBILE_APP_URL, '_blank', 'noopener')}>
            {t('desk.prefs.getMobileApp')}
          </button>
        </div>
      </nav>
      <div className="dk-prefs-page">
        {page === 'eq' && <EqPage rooms={rooms} households={households} zone={zone} onRoom={setRoom} />}
        {page === 'library' && <LibraryPage households={households} />}
        {page === 'services' && <ServicesPage households={households} onAdd={onAddService} onChanged={onServicesChanged} onLinkService={onLinkService} />}
        {page === 'room' && <RoomPage rooms={rooms} households={households} zone={zone} onRoom={setRoom} />}
        {page === 'parental' && <ParentalPage />}
        {page === 'datetime' && <DateTimePage households={households} />}
        {page === 'basic' && (
          <>
            <div className="dk-prefs-head"><h3>{t('desk.prefs.sonora')}</h3></div>
            <div className="dk-prefs-box dk-prefs-box-scroll"><BasicPage title={null} /></div>
          </>
        )}
      </div>
    </Window>
  )
}

// The room popup on the EQ and Room Settings pages, grouped by system when
// there is more than one.
function RoomPopup({ rooms, households, value, onChange }) {
  const options = (list) => list.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)
  return (
    <select className="dk-prefs-popup" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {systemChoiceMatters(households)
        ? orderedHouseholds(households).map((h) => {
          const mine = rooms.filter((z) => h.zone_uuids.includes(z.uuid))
          return mine.length ? <optgroup key={h.id} label={h.generation}>{options(mine)}</optgroup> : null
        })
        : options(rooms)}
    </select>
  )
}

// EQ Settings: "Music EQ Settings for [room]" over a group box holding the
// caption, Bass and Treble (and Balance for a stereo pair, the one room a
// balance means something for), Loudness and Reset, at the app's positions:
// rows 52px apart, Loudness one row below the last slider, Reset 42px under
// that.
const EQ_ROW_TOP = 65
const EQ_ROW_PITCH = 52
function EqPage({ rooms, households, zone, onRoom }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const rows = zone ? [
    { key: 'bass', label: t('desk.prefs.bass'), value: zone.bass, min: -10, max: 10, patch: (v) => ({ bass: v }) },
    { key: 'treble', label: t('desk.prefs.treble'), value: zone.treble, min: -10, max: 10, patch: (v) => ({ treble: v }) },
    ...((zone.has_balance ?? zone.paired) ? [{ key: 'balance', label: t('desk.prefs.balance'), value: zone.balance ?? 0, min: -100, max: 100,
                         // "L" and "R" at the ends, as the Mac app prints them (2026-10-02).
                         minLabel: t('desk.prefs.left').slice(0, 1), maxLabel: t('desk.prefs.right').slice(0, 1), patch: (v) => ({ balance: v }) }] : []),
  ] : []
  const below = EQ_ROW_TOP + EQ_ROW_PITCH * rows.length
  return (
    <>
      <div className="dk-prefs-head">
        <h3>{t('desk.prefs.eqFor')}</h3>
        {zone && <RoomPopup rooms={rooms} households={households} value={zone.uuid} onChange={onRoom} />}
      </div>
      <div className="dk-prefs-box">
        {!zone ? <p>{t('desk.prefs.noRooms')}</p> : zone.fixed_output ? <p className="dk-eq-caption">{t('desk.prefs.eqFixed')}</p> : (
          <div className="dk-eq">
            <p className="dk-eq-caption">{t('desk.prefs.eqCaption')}</p>
            {rows.map((row, i) => (
              <EqRow key={row.key} top={EQ_ROW_TOP + EQ_ROW_PITCH * i} label={row.label} value={row.value} min={row.min} max={row.max}
                     minLabel={row.minLabel} maxLabel={row.maxLabel} onChange={(v) => actions.setTone(zone.uuid, row.patch(v))} />
            ))}
            <label className="dk-eq-loudness" style={{ top: below + 2 }}>
              <input type="checkbox" checked={Boolean(zone.loudness)}
                     onChange={(e) => actions.setTone(zone.uuid, { loudness: e.target.checked })} />
              {t('desk.prefs.loudness')}
            </label>
            <button type="button" className="dk-win-btn dk-eq-reset" style={{ top: below + 42 }}
                    onClick={() => actions.setTone(zone.uuid, { bass: 0, treble: 0, balance: 0, loudness: true })}>
              {t('desk.prefs.reset')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// Parental Controls, as the application's pane is laid out: the state text, the
// toggle button and "More Information". Explicit filtering is a household
// setting the app reads and writes with a Sonos account token carrying the
// household-admin scope. Sonora obtains that token during sign-in (a PKCE
// login as a public client, the person's own account and approval), so the
// pane reflects whether that token is held: available, needs a fresh sign-in,
// or needs a Sonos sign-in at all.
// The Mac app is the Windows design under Mac chrome, so its Parental
// Controls page is the Windows tab's arrangement in this window's dress: the
// paragraph that changes with the state, the button whose label flips, and
// More Information under it.
//
// No sign-in state is read here. The setting is the household's and comes off
// the speakers, signed in or not; a note telling a signed-out person to sign
// in only sent them to do something that changed nothing.
const DK_PARENTAL = {
  section: 'dk-parental', body: 'dk-parental-body', note: 'dk-parental-note',
  button: 'dk-win-btn dk-parental-btn', error: 'dk-add-error',
  picker: 'dk-parental-picker',
}

export function ParentalPage() {
  const { t } = useI18n()
  return (
    <>
      <div className="dk-prefs-head"><h3>{t('desk.prefs.parental')}</h3></div>
      <div className="dk-prefs-box dk-prefs-box-scroll">
        <ParentalControls shape="button" showTitle={false} classes={DK_PARENTAL} />
      </div>
    </>
  )
}

// Date and Time Settings, per system: time zone, daylight saving, Internet
// time, the clock (set by hand when Internet time is off), and the two display
// formats. Every field is one of the AlarmClock actions the app itself uses.
const DATE_FORMATS = ['MDY', 'DMY', 'YMD']
const TIME_FORMATS = ['12H', '24H']

function formatClock(local, timeFormat, dateFormat) {
  // `local` is "YYYY-MM-DD HH:MM:SS" from the speaker.
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(local || '')
  if (!m) return { date: local || '', time: '' }
  const [, y, mo, d, hh, mi] = m
  const date = dateFormat === 'DMY' ? `${d}/${mo}/${y}` : dateFormat === 'YMD' ? `${y}/${mo}/${d}` : `${mo}/${d}/${y}`
  let time = `${hh}:${mi}`
  if (timeFormat !== '24H') {
    const h = Number(hh)
    time = `${((h + 11) % 12) + 1}:${mi} ${h < 12 ? 'AM' : 'PM'}`
  }
  return { date, time }
}

export function DateTimePage({ households }) {
  const { t } = useI18n()
  const ordered = orderedHouseholds(households)
  const [tab, setTab] = useState(null)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const zone = households.find((h) => h.id === activeTab)?.zone_uuids?.[0]
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({ date: '', time: '' })

  const load = useCallback(() => {
    if (!zone) return
    api.timeSettings(zone).then((r) => { setData(r); setError('') })
      .catch((exc) => setError(exc.message))
  }, [zone])
  useEffect(() => { setData(null); load() }, [load])
  // The clock on screen follows the speakers', not the browser's.
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])

  const apply = async (patch) => {
    setBusy(true); setError('')
    try { setData(await api.setTime({ zone, ...patch })) } catch (exc) { setError(exc.message) }
    setBusy(false)
  }

  // A system that keeps its time server (S2) always sets its clock from
  // the Internet, so it is offered no box for it, as the S2 apps offer none.
  const fixed = Boolean(data?.server_fixed)
  const internet = fixed || Boolean(data?.server)
  const clock = data ? formatClock(data.local, data.time_format, data.date_format) : null
  const zoneEntry = data?.zones.find((z) => z.index === data.index)
  const setNow = () => {
    if (!manual.date || !manual.time) return
    apply({ desired_time: `${manual.date} ${manual.time.length === 5 ? `${manual.time}:00` : manual.time}` })
  }

  return (
    <>
      <div className="dk-prefs-head">
        <h3>{t('desk.prefs.dateTime')}</h3>
        {systemChoiceMatters(households) && (
          <div className="dk-tabs" role="tablist">
            {ordered.map((h) => (
              <button key={h.id} type="button" role="tab" aria-selected={activeTab === h.id}
                      onClick={() => setTab(h.id)}>{h.generation}</button>
            ))}
          </div>
        )}
      </div>
      <div className="dk-prefs-box dk-prefs-box-scroll">
      {!data && !error && <p>{t('desk.time.loading')}</p>}
      {error && <p className="dk-add-error">{error}</p>}
      {data && (
        <fieldset className="dk-time" disabled={busy}>
          <div className="dk-field">
            <span>{t('desk.time.timeZone')}</span>
            <select value={data.index} onChange={(e) => apply({ index: Number(e.target.value) })}>
              {data.zones.map((z) => <option key={z.index} value={z.index}>{zoneLabel(z)}</option>)}
            </select>
          </div>
          <div className="dk-field">
            <span />
            <label className="dk-check" aria-disabled={!zoneEntry?.dst || undefined}>
              <input type="checkbox" checked={data.auto_dst} disabled={!zoneEntry?.dst}
                     onChange={(e) => apply({ auto_dst: e.target.checked })} />
              <span>{t('desk.time.autoDst')}</span>
            </label>
          </div>
          {!fixed && (
            <div className="dk-field">
              <span />
              <label className="dk-check">
                <input type="checkbox" checked={internet}
                       onChange={(e) => apply({ internet_time: e.target.checked })} />
                <span>{t('desk.time.internet')}</span>
              </label>
            </div>
          )}
          <div className="dk-field">
            <span>{t('desk.time.date')}</span>
            {internet ? <span>{clock.date}</span>
              : <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />}
          </div>
          <div className="dk-field">
            <span>{t('desk.time.time')}</span>
            {internet ? <span>{clock.time}</span>
              : (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="time" value={manual.time} onChange={(e) => setManual({ ...manual, time: e.target.value })} />
                  <button type="button" className="dk-win-btn" disabled={!manual.date || !manual.time} onClick={setNow}>
                    {t('desk.time.setNow')}
                  </button>
                  <small style={{ color: '#6d6d6d' }}>{clock.date} {clock.time}</small>
                </span>
              )}
          </div>
          <div className="dk-field">
            <span>{t('desk.time.dateFormat')}</span>
            <select value={DATE_FORMATS.includes(data.date_format) ? data.date_format : ''}
                    onChange={(e) => apply({ date_format: e.target.value })}>
              {!DATE_FORMATS.includes(data.date_format) && <option value="">{t('desk.time.notSet')}</option>}
              {DATE_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
            </select>
          </div>
          <div className="dk-field">
            <span>{t('desk.time.timeFormat')}</span>
            <select value={TIME_FORMATS.includes(data.time_format) ? data.time_format : ''}
                    onChange={(e) => apply({ time_format: e.target.value })}>
              {!TIME_FORMATS.includes(data.time_format) && <option value="">{t('desk.time.notSet')}</option>}
              {TIME_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
            </select>
          </div>
          {internet && <p>{t('desk.time.server', { server: data.server.split(',')[0] })}</p>}
        </fieldset>
      )}
      </div>
    </>
  )
}

// Music Library Settings, laid out as the application's pane: a Folders tab
// listing "My music folders on Sonos" with Add and Remove, and an Advanced tab
// for the index (nightly update, rebuild now) and how compilations are grouped.
// Sonora runs on a server, so Add takes a network path rather than opening a
// folder picker.
const ALBUM_ARTIST_OPTIONS = ['ITUNES', 'WMP', 'NONE']



// The Mac app's add-a-music-folder wizard (WizardController, 500x478): a
// white 460x389 page at 20,20 with Cancel at the bottom left and Back / Next
// at the bottom right, Next the default. Its first page asks where the music
// is; Sonora runs on a server and can only add a networked share, so the two
// choices for this computer's own folders stand grayed. Then the share's
// path, then its user name and password, then the players' answer.
// The wizard's first-page glyphs, drawn for Sonora: a blue folder with a
// note on it, and a gray drive.
const WizardFolderIcon = () => (
  <svg width="47" height="40" viewBox="0 0 47 40" aria-hidden="true">
    <path d="M2 6a3 3 0 0 1 3-3h12l4 4h21a3 3 0 0 1 3 3v25a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#5fb8f0" />
    <path d="M2 12a3 3 0 0 1 3-3h37a3 3 0 0 1 3 3v23a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#8fd0f7" />
    <path d="M20 31V18l10-2v12" fill="none" stroke="#3d93cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="17.5" cy="31" r="2.6" fill="#3d93cc" /><circle cx="27.5" cy="28" r="2.6" fill="#3d93cc" />
  </svg>
)
const WizardDriveIcon = () => (
  <svg width="47" height="44" viewBox="0 0 47 44" aria-hidden="true">
    <rect x="9" y="2" width="29" height="40" rx="3" fill="#c9c9c9" stroke="#9c9c9c" />
    <rect x="9" y="36" width="29" height="6" rx="2" fill="#7d7d7d" />
    <circle cx="23.5" cy="18" r="5" fill="none" stroke="#8c8c8c" strokeWidth="2" />
  </svg>
)

function ShareWizard({ pending, busy, onAdd, onClose }) {
  const { t } = useI18n()
  const [step, setStep] = useState('where')
  const [path, setPath] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [sent, setSent] = useState('')
  const norm = (p) => (p || '').trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const outcome = sent ? pending.find((p) => norm(p.path) === norm(sent)) : null
  // The players mount it, or refuse it, a while after the settings take it.
  const state = !sent ? '' : !outcome ? (busy ? 'adding' : 'done') : outcome.state === 'failed' ? 'failed'
    : outcome.state === 'indexing' ? 'done' : 'adding'
  const next = () => {
    if (step === 'where') setStep('path')
    else if (step === 'path' && path.trim()) setStep('login')
    else if (step === 'login') {
      setSent(path.trim()); setStep('result')
      onAdd({ path: path.trim(), user: user.trim(), pass })
    }
  }
  const back = () => setStep(step === 'login' ? 'path' : 'where')
  const onKey = (event) => { if (event.key === 'Enter') { event.preventDefault(); next() } }
  return (
    <Window title={t('desk.shareWizard.windowTitle')} onClose={onClose} className="dk-sharewiz">
      <div className="dk-sharewiz-page">
        {step === 'where' && (
          <>
            <h3>{t('desk.shareWizard.whereTitle')}</h3>
            <p>{t('desk.shareWizard.wherePrompt')}</p>
            {/* Three cards, as the app offers them on Tahoe (2026-09-28): a
                card is the choice and the step on at once. The two on this
                computer are out of reach of a server, so they are shown
                and refused, with the reason on them. */}
            <div className="dk-sharewiz-cards">
              <button type="button" className="dk-sharewiz-card" disabled title={t('desk.shareWizard.serverNote')}>
                <WizardFolderIcon /><span>{t('desk.shareWizard.myMusic')}</span>
              </button>
              <button type="button" className="dk-sharewiz-card" disabled title={t('desk.shareWizard.serverNote')}>
                <WizardDriveIcon /><span>{t('desk.shareWizard.otherFolder')}</span>
              </button>
              <button type="button" className="dk-sharewiz-card dk-sharewiz-card-plain" onClick={next}>
                <span>{t('desk.shareWizard.network')}</span>
              </button>
            </div>
          </>
        )}
        {step === 'path' && (
          <>
            <h3>{t('desk.shareWizard.pathTitle')}</h3>
            <p>{t('desk.shareWizard.pathPrompt')}</p>
            {/* The app marks an empty path with a blue "!" beside it. */}
            <div className="dk-sharewiz-pathrow">
              <input className="dk-win-input dk-sharewiz-path" type="text" value={path} autoFocus
                     aria-label={t('desk.shareWizard.pathPrompt')}
                     onChange={(e) => setPath(e.target.value)} onKeyDown={onKey} />
              <span className="dk-sharewiz-mark" aria-hidden="true">{path.trim() ? '' : '!'}</span>
            </div>
            <p className="dk-sharewiz-examples">{t('desk.shareWizard.pathExamples')}</p>
            <p className="dk-sharewiz-note">{t('desk.library.pathNote')}</p>
          </>
        )}
        {step === 'login' && (
          <>
            <h3>{t('desk.shareWizard.loginTitle')}</h3>
            <p>{t('desk.shareWizard.loginPrompt')}</p>
            <label className="dk-sharewiz-row">
              <span>{t('desk.shareWizard.fieldLabel', { label: t('desk.library.username') })}</span>
              <input className="dk-win-input" type="text" value={user} autoComplete="off" autoFocus
                     onChange={(e) => setUser(e.target.value)} onKeyDown={onKey} />
            </label>
            <label className="dk-sharewiz-row">
              <span>{t('desk.shareWizard.fieldLabel', { label: t('desk.library.password') })}</span>
              <input className="dk-win-input" type="password" value={pass} autoComplete="off"
                     onChange={(e) => setPass(e.target.value)} onKeyDown={onKey} />
            </label>
          </>
        )}
        {step === 'result' && (
          <>
            {state === 'adding' && (
              <p className="dk-sharewiz-progress"><Swirl size={16} className="dk-lib-swirl" /> {t('desk.shareWizard.adding')}</p>
            )}
            {state === 'done' && <p>{t('desk.shareWizard.done', { path: sent })}</p>}
            {state === 'failed' && (
              <>
                <h3>{t('desk.shareWizard.failedTitle')}</h3>
                <p>{outcome?.hint || t('desk.library.addFailedWhy')}</p>
              </>
            )}
          </>
        )}
      </div>
      <div className="dk-sharewiz-foot">
        <button type="button" className="dk-win-btn" onClick={onClose}
                disabled={step === 'result' && state !== 'adding'}>{t('common.cancel')}</button>
        <span className="dk-sharewiz-gap" />
        <button type="button" className="dk-win-btn" onClick={back}
                disabled={step === 'where' || step === 'path' || step === 'result'}>{t('common.back')}</button>
        {step === 'result'
          ? <button type="button" className="dk-win-btn" data-default="true" disabled={state === 'adding'}
                    onClick={onClose}>{t('common.done')}</button>
          : <button type="button" className="dk-win-btn" data-default="true"
                    disabled={step === 'where' || (step === 'path' && !path.trim())} onClick={next}>{t('common.next')}</button>}
      </div>
    </Window>
  )
}

function shareName(share) {
  const title = share.title || share.path || ''
  if (title !== share.path && !/^\/\/|^\\\\/.test(title)) return title
  const parts = title.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] || title
}

export function LibraryPage({ households }) {
  const [prefs, setPrefs] = useState(readLibraryPrefs)
  const { t } = useI18n()
  const [section, setSection] = useState('folders')
  const { ordered, activeTab, setTab, data, error, busy, selected, setSelected, apply, highlighted, scheduled, scheduleTime, pending } = useLibrarySettings(households, { section })
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState(null)

  return (
    <>
      <div className="dk-prefs-head">
        <h3>{t('desk.prefs.musicLibrary')}</h3>
        {systemChoiceMatters(households) && (
          <div className="dk-tabs" role="tablist">
            {ordered.map((h) => (
              <button key={h.id} type="button" role="tab" aria-selected={activeTab === h.id}
                      onClick={() => setTab(h.id)}>{h.generation}</button>
            ))}
          </div>
        )}
      </div>
      <div className="dk-prefs-box">
        {/* Folders / Advanced sits on the group box's top edge, as the app's does. */}
        <div className="dk-tabs dk-prefs-straddle" role="tablist">
          <button type="button" role="tab" aria-selected={section === 'folders'} onClick={() => setSection('folders')}>{t('desk.library.folders')}</button>
          <button type="button" role="tab" aria-selected={section === 'advanced'} onClick={() => setSection('advanced')}>{t('desk.library.advanced')}</button>
        </div>
        {!data && !error && <p>{t('desk.browse.loading')}</p>}
        {error && <p className="dk-add-error">{error}</p>}
        {data && section === 'folders' && (
          <>
            <h4 className="dk-prefs-boxtitle">{t('desk.library.mine')}</h4>
            <div className="dk-table dk-lib-table" role="listbox" aria-label={t('desk.library.mine')}>
              <div className="dk-table-head" aria-hidden="true">
                <span /><span>{t('desk.prefs.folderCol')}</span><span>{t('desk.prefs.pathCol')}</span>
              </div>
              <div className="dk-table-body">
                {data.shares.length === 0 && <p className="dk-table-empty">{t('desk.library.none')}</p>}
                {data.shares.map((s) => (
                  <div key={s.id} role="option" aria-selected={selected === s.id} onClick={() => setSelected(s.id)}>
                    <Icon.NetworkShare width={14} height={14} />
                    {/* The share's own folder name, as the Mac app lists it
                        ("music3" beside //192.168.0.102/music/Alex/music3,
                        S2 Mac app 2026-09-29): the speaker titles a share with
                        its whole path. */}
                    <span>{shareName(s)}</span>
                    <span>{s.path || s.uri}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Taken by the players, not yet mounted: the app holds its add
                wizard on a spinner for this window, so the pane says so too. */}
            {pending.map((p) => (
              <p key={p.path} className="dk-prefs-note" style={{ color: p.state === 'failed' ? 'var(--t-critical, #c0392b)' : undefined }}
                 role="status">
                {p.state === 'failed'
                  ? <>{t('desk.library.addFailed', { path: p.path })} {p.hint || t('desk.library.addFailedWhy')}</>
                  : p.state === 'indexing'
                  ? <><Swirl size={12} className="dk-lib-swirl" /> {p.path} — {t('desk.library.addedIndexing')}</>
                  : <><Swirl size={12} className="dk-lib-swirl" /> {t('desk.library.adding')}: {t('desk.library.addingPath', { path: p.path })}
                      {p.hint ? ` ${p.hint}` : ''}</>}
              </p>
            ))}
            <div className="dk-pm">
              <button type="button" title={t('desk.library.addFolder')} aria-label={t('desk.library.addFolder')}
                      disabled={busy} onClick={() => setAdding(true)}>+</button>
              <button type="button" title={t('desk.library.remove')} aria-label={t('desk.library.remove')}
                      disabled={!highlighted || busy} onClick={() => setConfirm(highlighted)}>−</button>
            </div>
            {adding && (
              <ShareWizard pending={pending} busy={busy} onClose={() => setAdding(false)}
                           onAdd={(share) => apply({ add_path: share.path, add_username: share.user, add_password: share.pass })} />
            )}
            {confirm && (
              <Confirm title={t('desk.library.removeTitle')}
                       body={t('desk.library.removeBody', { folder: confirm.title || confirm.uri })}
                       action={t('desk.library.remove')} disabled={busy}
                       onConfirm={() => { apply({ remove_id: confirm.id }); setConfirm(null); setSelected(null) }}
                       onClose={() => setConfirm(null)} />
            )}
          </>
        )}
        {data && section === 'advanced' && (
          // The app builds this tab from its setting components (the
          // SMSettingComponent*View nibs): each row a bold 12pt caption,
          // right-aligned in a 174pt column, with its control from x=179.
          <div className="dk-box-scroll">
          <fieldset className="dk-setrows" disabled={busy}>
            <div className="dk-setrow">
              <span className="dk-setrow-cap">{t('desk.library.indexTitle')}</span>
              <div className="dk-setrow-ctl">
                <label className="dk-check">
                  <input type="checkbox" checked={scheduled}
                         onChange={(e) => apply({ daily_refresh: e.target.checked ? `${scheduleTime}:00` : '' })} />
                  <span>{t('desk.library.updateDaily')}</span>
                </label>
              </div>
            </div>
            {/* The time on a line of its own, 24-hour, with its stepper; the
                app has no Update Now here, only under Manage (2026-09-28). */}
            <div className="dk-setrow">
              <span className="dk-setrow-cap" />
              <div className="dk-setrow-ctl">
                <TimeField className="dk-lib-time" value={scheduleTime} clock={24} disabled={!scheduled}
                           label={t('desk.library.indexTitle')}
                           onChange={(time) => apply({ daily_refresh: `${time}:00` })} />
                {data.indexing && <span className="dk-setrow-note">{t('desk.library.indexing')}</span>}
                {data.index_error && (
                  <span className="dk-setrow-note" style={{ color: 'var(--t-critical, #c0392b)' }}>
                    {t('desk.library.indexError', { error: data.index_error })}
                  </span>
                )}
              </div>
            </div>
            <div className="dk-setrow">
              <span className="dk-setrow-cap">{t('desk.library.compilations')}</span>
              <div className="dk-setrow-ctl">
                <select className="dk-lib-popup" value={ALBUM_ARTIST_OPTIONS.includes(data.album_artist_option) ? data.album_artist_option : 'WMP'}
                        onChange={(e) => apply({ album_artist_option: e.target.value })}>
                  {ALBUM_ARTIST_OPTIONS.map((o) => <option key={o} value={o}>{t(`desk.library.group.${o}`)}</option>)}
                </select>
              </div>
            </div>
            <div className="dk-setrow">
              <span className="dk-setrow-cap" />
              <div className="dk-setrow-ctl">
                <label className="dk-check">
                  <input type="checkbox" checked={prefs.contributing}
                         onChange={(e) => setPrefs(writeLibraryPrefs({ contributing: e.target.checked }))} />
                  <span>{t('desk.library.showContributing')}</span>
                </label>
              </div>
            </div>
            <div className="dk-setrow">
              <span className="dk-setrow-cap">{t('desk.library.sortFolders')}</span>
              <div className="dk-setrow-ctl">
                <select className="dk-lib-popup" value={prefs.folderSort} onChange={(e) => setPrefs(writeLibraryPrefs({ folderSort: e.target.value }))}>
                  {FOLDER_SORTS.map((o) => <option key={o} value={o}>{t(`desk.library.sort.${o}`)}</option>)}
                </select>
              </div>
            </div>
          </fieldset>
          </div>
        )}
      </div>
    </>
  )
}

function MessagePage({ title, body }) {
  return (
    <>
      <h3>{title}</h3>
      <p>{body}</p>
    </>
  )
}

export function BasicPage({ title }) {
  const { t } = useI18n()
  // Both pieces are shared with every other settings page (see
  // components/ThemeChooser.jsx and components/SonosAccount.jsx); this page
  // adds only the dialog's heading. The account sits under the theme because
  // it is optional: a person who never signs in loses nothing but the service
  // logos and a soundbar's television input.
  return (
    <>
      <ThemeChooser title={title === undefined ? t('desk.prefs.basic') : title} />
      <SonosAccount />
    </>
  )
}

// Service Settings, as the application's own pane works: highlight a service
// in the list, then Remove (its tooltip there reads "Remove the highlighted
// service"), with a confirmation before the account comes off the household.
// Change Name opens the app's "Edit service" window (S1 Mac app, 2026-09-24):
// "Edit <service> account" in bold, "Please enter an account name:", the Name
// field holding the account's nickname, and a footer band with Cancel and
// Back grayed and Done the default. The app gives no other way out -- its
// window's lights are gray too -- so here Done with the name unchanged just
// closes, and only a new name is sent (SetAccountNicknameX, household-wide).
function EditAccountWindow({ service, zone, onClose, onDone, onError }) {
  const { t } = useI18n()
  const [name, setName] = useState(service.nickname || '')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const next = name.trim()
    if (busy || !next) return
    if (next === (service.nickname || '')) { onClose(); return }
    setBusy(true)
    try {
      await api.renameServiceAccount(service.id, { zone, account_id: service.account_id ?? '', nickname: next })
      onDone?.(next)
    } catch (exc) {
      onError?.(exc?.message || String(exc))
    }
  }
  return (
    <Window title={t('win.services.editTitle')} onClose={onClose} className="dk-editsvc">
      <div className="dk-editsvc-body">
        <h3>{t('win.services.editHeading', { service: service.name })}</h3>
        <p>{t('win.services.editPrompt')}</p>
        <label className="dk-editsvc-field"><span>{t('win.services.editName')}</span>
          <input type="text" value={name} autoFocus onFocus={(e) => e.target.select()}
                 onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') submit() }} /></label>
      </div>
      <div className="dk-editsvc-foot">
        <button type="button" className="dk-win-btn" disabled>{t('common.cancel')}</button>
        <span className="dk-editsvc-gap" />
        <button type="button" className="dk-win-btn" disabled>{t('common.back')}</button>
        <button type="button" className="dk-win-btn" data-default="true" disabled={busy || !name.trim()} onClick={submit}>{t('common.done')}</button>
      </div>
    </Window>
  )
}

// Visit Sonos Labs, as the S1 Mac app draws it once signed in (2026-09-29):
// the Preferences window gives way to an "Add a service" window like the
// Edit one -- 500 x 506, "Welcome to Sonos Labs" over "Select the Sonos
// Labs service you would like to add:", a white well from 20 to 480pt and
// 118pt down, 300 tall, and Cancel, Back and Next in the gray foot. The
// list is Sonos' to give: the service catalog's entries whose containerType
// is SONOS_LABS, and a household that has not opted in is offered none, so
// the app's well is empty and so is this one. Choosing one opens the same
// add-a-service flow as +. The app asks for the account's password first;
// Sonora uses its own sign-in instead, and says so in the well when it has
// none.
function SonosLabsWindow({ zone, onClose, onPick }) {
  const { t } = useI18n()
  const [state, setState] = useState({ loading: true, items: [], signedIn: true, error: '' })
  const [chosen, setChosen] = useState(null)
  useEffect(() => {
    let canceled = false
    api.labsServices(zone).then((r) => {
      if (!canceled) setState({ loading: false, items: r?.items || [], signedIn: r?.signed_in !== false, error: '' })
    }).catch((exc) => {
      if (!canceled) setState({ loading: false, items: [], signedIn: true, error: exc?.message || String(exc) })
    })
    return () => { canceled = true }
  }, [zone])
  const pick = state.items.find((item) => item.id === chosen) || null
  const note = state.loading ? t('desk.browse.loading')
    : state.error ? t('win.services.labsFailed', { error: state.error })
    : !state.signedIn ? t('win.services.labsSignedOut')
    : ''
  return (
    <Window title={t('win.services.addTitle')} onClose={onClose} className="dk-editsvc dk-labs">
      <div className="dk-editsvc-body">
        <h3>{t('win.services.labsTitle')}</h3>
        <p>{t('win.services.labsPrompt')}</p>
        <div className="dk-labs-well" role="listbox" aria-label={t('win.services.labs')}>
          {state.items.length === 0
            ? (note ? <p className="dk-labs-note">{note}</p> : null)
            : state.items.map((item) => (
              <div key={item.id} role="option" aria-selected={chosen === item.id}
                   onClick={() => setChosen(item.id)} onDoubleClick={() => onPick(item)}>
                <span>{item.name}</span>
                {item.description && <small>{item.description}</small>}
              </div>
            ))}
        </div>
      </div>
      <div className="dk-editsvc-foot">
        <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
        <span className="dk-editsvc-gap" />
        <button type="button" className="dk-win-btn" disabled>{t('common.back')}</button>
        <button type="button" className="dk-win-btn" data-default={pick ? 'true' : undefined} disabled={!pick}
                onClick={() => onPick(pick)}>{t('common.next')}</button>
      </div>
    </Window>
  )
}

export function ServicesPage({ households, onAdd, onChanged, onLinkService }) {
  const { t } = useI18n()
  // The gear beside + and - (S1 Mac app, 2026-09-24): Change Name and
  // Reauthorize Account for the highlighted row.
  const [gear, setGear] = useState(false)
  const [editing, setEditing] = useState(null)
  const [labs, setLabs] = useState(false)
  const [byHh, setByHh] = useState(null)
  const [tab, setTab] = useState(null)
  const [selected, setSelected] = useState(null)   // `${id}-${account_id}`
  const [confirm, setConfirm] = useState(null)     // service awaiting confirmation
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let canceled = false
    api.services().then((r) => {
      if (canceled) return
      const map = {}
      for (const hh of r.households || []) map[hh.household] = hh.in_use || []
      setByHh(map)
    }).catch(() => { if (!canceled) setByHh({}) })
    return () => { canceled = true }
  }, [version])
  const ordered = orderedHouseholds(households)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  // In the app's order: by service name, then by the account's name
  // (80er-Radio harmony, 80s80s, 90s90s, AccuRadio, Amazon Music ... in the S1
  // Mac app, 2026-09-24). The household's own order is not it.
  const services = [...((byHh && byHh[activeTab]) || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    || (a.nickname || '').localeCompare(b.nickname || '', undefined, { sensitivity: 'base' }))
  const keyOf = (s) => `${s.id}-${s.account_id ?? ''}`
  const highlighted = services.find((s) => keyOf(s) === selected) || null
  const zoneFor = () => households.find((h) => h.id === activeTab)?.zone_uuids?.[0]

  return (
    <>
      <div className="dk-prefs-head">
        <h3>{t('desk.prefs.services')}</h3>
        {systemChoiceMatters(households) && (
          <div className="dk-tabs" role="tablist">
            {ordered.map((h) => (
              <button key={h.id} type="button" role="tab" aria-selected={activeTab === h.id}
                      onClick={() => { setTab(h.id); setSelected(null) }}>
                {t('desk.services.tab', { system: h.generation })}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="dk-prefs-box">
        <h4 className="dk-prefs-boxtitle">{t('desk.prefs.servicesTitle')}</h4>
        {/* The app's four columns. Sonora never holds a login, so Account
            Login shows what the app shows for an account it cannot read (a
            dash) and marks anonymous services as the app does. */}
        <div className="dk-table dk-svc-table" role="listbox" aria-label={t('desk.prefs.servicesTitle')}>
          <div className="dk-table-head" aria-hidden="true">
            <span /><span>{t('desk.prefs.serviceNameCol')}</span><span>{t('desk.prefs.nameCol')}</span><span>{t('desk.prefs.loginCol')}</span>
          </div>
          <div className="dk-table-body">
            {byHh === null ? <p className="dk-table-empty">{t('desk.browse.loading')}</p> : services.length === 0
              ? <p className="dk-table-empty">{t('desk.prefs.servicesSignIn')}</p>
              : services.map((s) => (
                <div key={keyOf(s)} role="option" aria-selected={selected === keyOf(s)}
                     onClick={() => setSelected(keyOf(s))}>
                  {s.icon ? <img src={s.icon} alt="" /> : <Icon.Note width={16} height={16} />}
                  <span>{s.name}</span>
                  {/* The account's name as the speakers hold it. An anonymous
                      service has none, and the S1 Mac app leaves the cell
                      empty (2026-09-28). */}
                  <span>{s.nickname}</span>
                  <span className={s.auth === 'Anonymous' ? 'dk-svc-anon' : undefined}>
                    {s.auth === 'Anonymous' ? t('desk.prefs.anonymous') : '-'}
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div className="dk-svc-tools">
          <div className="dk-pm">
            <button type="button" title={t('desk.add.button')} aria-label={t('desk.add.button')} onClick={onAdd}>+</button>
            <button type="button" title={t('services.removeHint')} aria-label={t('services.remove')} disabled={!highlighted}
                    onClick={() => setConfirm(highlighted)}>−</button>
            <button type="button" className="dk-pm-gear" aria-haspopup="menu" aria-expanded={gear}
                    aria-label={t('desk.browse.actions')} disabled={!highlighted || highlighted.auth === 'Anonymous'}
                    onClick={() => setGear((v) => !v)}>
              <Icon.Gear width={12} height={12} /><Icon.CaretDown width={8} height={8} />
            </button>
          </div>
          {gear && highlighted && highlighted.auth !== 'Anonymous' && (
            <div className="dk-popover dk-action-menu dk-gear-menu" role="menu" onMouseLeave={() => setGear(false)}>
              {/* An anonymous service has no account to name or sign in again. */}
              <button type="button" role="menuitem" disabled={highlighted.auth === 'Anonymous'}
                      onClick={() => { setGear(false); setEditing(highlighted) }}>{t('desk.prefs.changeName')}</button>
              <button type="button" role="menuitem" disabled={highlighted.auth === 'Anonymous' || !onLinkService}
                      onClick={() => { setGear(false); onLinkService?.({ sid: highlighted.id, householdId: activeTab,
                                                                          name: highlighted.name, account: highlighted.account_id ?? '', reauthorize: true }) }}>
                {t('desk.prefs.reauthorize')}
              </button>
            </div>
          )}
          {/* The app's button opened sonos.com/labs, which Sonos has taken
              down (410 Gone, 2026-09-15). What that page offered was the
              household's Labs services to add, and Sonora can list those
              itself, so the button opens that list instead of a dead page. */}
          <button type="button" className="dk-win-btn dk-svc-labs" onClick={() => setLabs(true)}>{t('desk.prefs.visitLabs')}</button>
        </div>
        {error && <p className="dk-add-error" style={{ marginTop: 10 }}>{error}</p>}
        {editing && (
          <EditAccountWindow service={editing} zone={zoneFor()}
            onClose={() => setEditing(null)}
            onDone={() => { setEditing(null); setVersion((v) => v + 1); onChanged?.() }}
            onError={(msg) => { setEditing(null); setError(msg) }} />
        )}
        {labs && (
          <SonosLabsWindow zone={zoneFor()} onClose={() => setLabs(false)}
            onPick={(item) => { setLabs(false); onLinkService?.({ sid: item.id, householdId: activeTab, name: item.name, account: '' }) }} />
        )}
        {confirm && (
          <RemoveServiceDialog service={confirm} zone={zoneFor()} gen={ordered.find((h) => h.id === activeTab)?.generation}
            onClose={() => setConfirm(null)}
            onDone={() => { setConfirm(null); setSelected(null); setVersion((v) => v + 1); onChanged?.() }}
            onError={(msg) => { setConfirm(null); setError(msg) }} />
        )}
      </div>
    </>
  )
}

// The two-way remove confirmation: a box for Sonora and one for Sonos, each
// available only where the service actually lives.
export function RemoveServiceDialog({ service, zone, gen, onClose, onDone, onError, chrome = 'plain' }) {
  const { t } = useI18n()
  const c = useRemoveChoice({
    sid: service.id, zone, accountId: service.account_id ?? '',
    sonoraLinked: service.sonora_linked, onSystem: service.on_system,
    onDone,
  })
  useEffect(() => { if (c.error) onError(t('services.removeFailed', { service: service.name, error: c.error })) },
    [c.error]) // eslint-disable-line react-hooks/exhaustive-deps
  // With one side to remove from there is nothing to choose: the sentence
  // says where it goes, and the boxes are not drawn.
  const question = c.single === 'sonos' ? t('services.removeSonosBody', { service: service.name })
    : c.single === 'sonora' ? t('services.removeSonoraBody', { service: service.name })
    : t('services.removeChoose', { service: service.name })
  const boxes = c.single ? null : (
    <>
      <label className="dk-check" aria-disabled={!c.canSonora || undefined}>
        <input type="checkbox" disabled={!c.canSonora} checked={c.sonora}
               onChange={(e) => c.setSonora(e.target.checked)} />
        <span>{t('services.removeSonora')} <small>&mdash; {t('services.removeSonoraSub')}</small></span>
      </label>
      <label className="dk-check" aria-disabled={!c.canSonos || undefined}>
        <input type="checkbox" disabled={!c.canSonos} checked={c.sonos}
               onChange={(e) => c.setSonos(e.target.checked)} />
        <span>{t('services.removeSonos', { gen })} <small>&mdash; {t('services.removeSonosSub')}</small></span>
      </label>
    </>
  )
  // The Windows app's own confirmation is a MessageWindow (utilities/
  // messagewindow.xaml): title "Remove Account", one sentence on a light
  // gradient, and a 58px foot holding Remove and Cancel. Sonora asks a
  // question the app never has to -- Sonora's own link is separate from the
  // account on the speakers -- so the two boxes sit under the sentence.
  if (chrome === 'windows') {
    return (
      <Window title={t('win.services.removeTitle')} onClose={onClose} className="win-message">
        <div className="win-message-body">
          <p className="win-message-heading">{t('win.services.removeBody', { service: service.name })}</p>
          <p className="win-message-line">{question}</p>
          {boxes && <div className="win-message-choices">{boxes}</div>}
        </div>
        <div className="win-message-foot">
          <button type="button" className="dk-win-btn" data-default="true" disabled={!c.canConfirm || c.busy}
                  onClick={c.submit}>{c.busy ? t('services.removing', { service: service.name }) : t('services.confirmRemove')}</button>
          <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </Window>
    )
  }
  return (
    <Confirm title={t('services.removeTitle', { service: service.name })}
             body={question}
             action={c.busy ? t('services.removing', { service: service.name }) : t('services.confirmRemove')}
             disabled={!c.canConfirm || c.busy}
             onConfirm={c.submit} onClose={onClose}>
      {boxes}
    </Confirm>
  )
}

// --- Add Music Services ------------------------------------------------------------
//
// The household's own catalog, minus what is already linked. Choosing a
// service asks the provider for a code; the person signs in on the provider's
// site and enters it, and the speakers are polled until the account lands.

// `authorizeStep`: the Windows app's form of the browser sign-in (checked in
// the running app, 2026-09-29): no address printed, one Authorize button that
// opens it, and the wizard's Back / Next / Cancel with Next grayed until the
// service confirms. The Mac shell keeps the address and Open in browser.
// `wizard` words it as the Windows app's own "Add a service" wizard, which
// Settings > Services > Add opens there (2026-10-02): its title, an
// "Available services" heading and its sentence. The list keeps Sonora's
// icons and notes by ruling (2026-09-05).
export function AddServices({ households, zones, onClose, onLinked, preset = null, authorizeStep = false, wizard = false }) {
  const { t } = useI18n()
  const [byHh, setByHh] = useState(null)
  const [authorizing, setAuthorizing] = useState(false)
  const [tab, setTab] = useState(preset?.householdId ?? null)
  const [chosen, setChosen] = useState(null)   // { service, zone }
  const [link, setLink] = useState(null)
  const [status, setStatus] = useState('idle')
  const [registered, setRegistered] = useState(true)
  const [error, setError] = useState('')

  const ordered = orderedHouseholds(households)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const zoneForHousehold = (hid) => {
    const h = households.find((x) => x.id === hid)
    for (const u of h?.zone_uuids || []) if (zones[u]) return zones[u]
    return null
  }

  // The catalog to add per household (available minus already-configured),
  // with a real logo where the account exists on any system.
  useEffect(() => {
    let canceled = false
    api.services().then((all) => {
      if (canceled) return
      const logos = {}
      for (const hh of all.households || []) {
        for (const svc of hh.in_use || []) if (svc.icon && svc.id != null) logos[svc.id] = svc.icon
      }
      const map = {}
      for (const hh of all.households || []) {
        const used = new Set((hh.in_use || []).map((s) => s.id))
        map[hh.household] = (hh.available || [])
          .filter((s) => !used.has(s.id) || s.auth !== 'Anonymous')
          .map((s) => (used.has(s.id) ? { ...s, in_use: true } : s))
          .map((s) => ({ ...s, icon: s.icon || logos[s.id] || '' }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }
      setByHh(map)
    }).catch((exc) => { if (!canceled) { setByHh({}); setError(exc.message) } })
    return () => { canceled = true }
  }, [])

  // Poll while a code is outstanding, one request at a time: the next poll is
  // scheduled only after the current returns, so overlapping polls cannot turn
  // a link that just succeeded into a 502 by re-using a now-consumed code.
  useEffect(() => {
    if (status !== 'waiting' || !link || !chosen) return undefined
    let stop = false
    let timer = null
    const poll = async () => {
      try {
        const r = await api.completeLink(chosen.service.id, {
          zone: chosen.zone, link_code: link.link_code, device_id: link.device_id || '',
          account_id: chosen.accountId || '', reauthorize: Boolean(chosen.reauthorize) })
        if (stop) return
        if (r.linked) { setRegistered(r.registered !== false && r.replaced !== false); setStatus('done'); onLinked?.(); return }
      } catch (exc) {
        if (stop) return
        setStatus('failed'); setError(exc.message); return
      }
      if (!stop) timer = setTimeout(run, 3000)
    }
    let busy = false
    const run = async () => { timer = null; busy = true; try { await poll() } finally { busy = false } }
    // Coming back from the provider's sign-in page is the moment the link is
    // likely done, so ask then rather than at the next tick. Still one
    // request at a time (Pocket Casts reauthorize, 2026-10-05).
    const now = () => {
      if (stop || busy || document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      run()
    }
    window.addEventListener('focus', now)
    document.addEventListener('visibilitychange', now)
    timer = setTimeout(run, 3000)
    return () => {
      stop = true; if (timer) clearTimeout(timer)
      window.removeEventListener('focus', now); document.removeEventListener('visibilitychange', now)
    }
  }, [status, link, chosen, onLinked])

  const start = async (service, zoneUuid, accountId = '', reauthorize = false) => {
    const zu = zoneUuid || zoneForHousehold(activeTab)?.uuid
    if (!zu) return
    setChosen({ service, zone: zu, accountId, reauthorize }); setError(''); setLink(null); setAuthorizing(false); setStatus('starting')
    try {
      const r = await api.linkService(service.id, { zone: zu, account_id: accountId })
      if (r.linked) { setRegistered(r.registered !== false && r.replaced !== false); setStatus('done'); onLinked?.(); return }
      if (r.method === 'app') { setStatus('needsApp'); return }
      setLink(r); setStatus('waiting')
      // Open the provider's sign-in at once; the "Open in browser" button
      // remains for when a browser blocks this popup.
      if (r.reg_url) window.open(r.reg_url, '_blank', 'noopener')
    } catch (exc) {
      setStatus('failed'); setError(exc instanceof ApiError ? exc.message : String(exc))
    }
  }

  // Opened for one specific service (from a "Link with Sonora" prompt in
  // Browse): skip the catalog and start its sign-in straight away. The
  // server resolves the real service by id, so a bare {id, name} is enough.
  const startedPreset = useRef(false)
  useEffect(() => {
    if (!preset || startedPreset.current) return
    const zone = zoneForHousehold(preset.householdId)
    if (!zone) return
    startedPreset.current = true
    start({ id: preset.sid, name: preset.name }, zone.uuid, preset.account || '', Boolean(preset.reauthorize))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  const catalog = byHh ? (byHh[activeTab] || []) : null
  const name = chosen?.service?.name

  return (
    <Window title={wizard ? t('win.addService.title') : t('desk.add.title')} onClose={onClose} className={wizard ? 'dk-add-wizard' : ''}>
      <div className="dk-add">
        {!chosen ? (
          <>
            {wizard && <h3 className="dk-add-heading">{t('win.addService.heading')}</h3>}
            <p className="dk-add-intro">{wizard ? t('win.addService.intro') : t('desk.add.intro')}</p>
            {systemChoiceMatters(households) && (
              <div className="dk-tabs" role="tablist">
                {ordered.map((h) => (
                  <button key={h.id} type="button" role="tab" aria-selected={activeTab === h.id}
                          onClick={() => setTab(h.id)}>
                    {t('desk.services.tab', { system: h.generation })}
                  </button>
                ))}
              </div>
            )}
            {catalog === null ? (
              <div className="dk-add-loading"><span className="dk-spinner" />{t('desk.browse.loading')}</div>
            ) : (
              <div className="dk-add-list">
                {catalog.map((service) => {
                  const unpairable = service.pairable === false
                  return (
                    <button key={service.id} type="button"
                            className={`dk-add-row${unpairable ? ' dk-add-row-off' : ''}`}
                            disabled={unpairable} aria-disabled={unpairable || undefined}
                            title={unpairable ? t('desk.add.unpairable', { service: service.name }) : ''}
                            onClick={() => !unpairable && start(service)}>
                      {service.icon
                        ? <img className="dk-add-logo" src={service.icon} alt="" />
                        : <span className="dk-add-mono">{service.initials}</span>}
                      <span className="dk-add-name">{service.name}</span>
                      <span className="dk-add-auth">
                        {unpairable ? t('desk.add.appOnly')
                          : service.in_use ? t('desk.add.another') : t(`desk.add.auth.${service.auth}`)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {error && <p className="dk-add-error">{error}</p>}
          </>
        ) : (
          <div className="dk-add-flow">
            <h3>{authorizeStep && status === 'waiting' && link && !link.show_link_code
              ? t('desk.add.authorizeTitle', { service: name }) : name}</h3>
            {status === 'starting' && (
              <div className="dk-add-loading"><span className="dk-spinner" />{chosen?.service?.auth === 'Anonymous'
                ? t('desk.add.linking', { service: name })
                : t('desk.add.starting', { service: name })}</div>
            )}
            {status === 'needsApp' && <p>{t('desk.add.needsApp', { service: name })}</p>}
            {status === 'waiting' && link && authorizeStep && !link.show_link_code && (
              <>
                <p>{t('desk.add.authorizeBody', { service: name })}</p>
                <button type="button" className="dk-win-btn dk-add-authorize" data-default="true"
                        onClick={() => { setAuthorizing(true); window.open(link.reg_url, '_blank', 'noopener') }}>
                  {t('desk.add.authorize')}
                </button>
                {authorizing && <div className="dk-add-loading"><span className="dk-spinner" />{t('desk.add.waiting', { service: name })}</div>}
              </>
            )}
            {status === 'waiting' && link && !(authorizeStep && !link.show_link_code) && (
              <>
                <p>{link.show_link_code
                  ? t('desk.add.instructions', { url: link.reg_url })
                  : t('desk.add.instructionsNoCode', { url: link.reg_url })}</p>
                {link.show_link_code && <p className="dk-add-code">{link.link_code}</p>}
                <button type="button" className="dk-win-btn" data-default="true"
                        onClick={() => window.open(link.reg_url, '_blank', 'noopener')}>
                  {t('desk.add.open')}
                </button>
                <div className="dk-add-loading"><span className="dk-spinner" />{t('desk.add.waiting', { service: name })}</div>
              </>
            )}
            {status === 'done' && (
              <p><LinkedMessage result={serviceLinkedMessage(t, { name, zone: chosen?.zone, households, registered, auth: chosen?.service?.auth })} onOpen={(hid) => { setChosen(null); setStatus('idle'); setLink(null); setTab(hid) }} /></p>
            )}
            {status === 'failed' && <p className="dk-add-error">{t('desk.add.failed', { service: name, error })}</p>}
            <div className="dk-add-actions">
              {/* Back returns to the catalog, so it only makes sense when the
                  person came from it. Opened straight onto one service (preset,
                  from a "Link with Sonora" prompt) there is nowhere to go back
                  to, so it is left out. */}
              {!preset && status !== 'done' && (
                <button type="button" className="dk-win-btn"
                        onClick={() => { setChosen(null); setStatus('idle'); setLink(null) }}>
                  {t('common.back')}
                </button>
              )}
              {/* The Windows wizard keeps Next between them, grayed while the
                  service has yet to answer. */}
              {authorizeStep && status !== 'done' && (
                <button type="button" className="dk-win-btn" disabled>{t('common.next')}</button>
              )}
              <button type="button" className="dk-win-btn" data-default={status === 'done' || undefined} onClick={onClose}>
                {status === 'done' ? t('common.done') : t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Window>
  )
}
// Room Settings: what the Mac app leaves to the mobile app -- the room's
// name, status light, stereo pairing, and the extras a soundbar or line-in
// device reports -- for the room in the popup.
export function RoomPage({ rooms, households, zone, onRoom }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [name, setName] = useState(zone?.name || '')
  useEffect(() => { setName(zone?.name || '') }, [zone?.name, zone?.uuid])
  const household = zone && orderedHouseholds(households).find((h) => h.zone_uuids.includes(zone.uuid))

  return (
    <>
      <div className="dk-prefs-head">
        <h3>{t('desk.prefs.roomFor')}</h3>
        {zone && <RoomPopup rooms={rooms} households={households} value={zone.uuid} onChange={onRoom} />}
      </div>
      <div className="dk-prefs-box dk-prefs-box-scroll">
        {!zone ? <p>{t('desk.prefs.noRooms')}</p> : (
          <>
            <div className="dk-field">
              <span>{t('desk.prefs.roomName')}</span>
              <input className="dk-win-input" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="button" className="dk-win-btn" disabled={!name.trim() || name === zone.name}
                      onClick={() => actions.rename(zone.uuid, name.trim())}>
                {t('desk.prefs.apply')}
              </button>
            </div>
            <div className="dk-field">
              <span>{t('desk.prefs.statusLight')}</span>
              <button type="button" className="dk-win-btn" onClick={() => actions.setStatusLight(zone.uuid, true)}>{t('desk.prefs.on')}</button>
              <button type="button" className="dk-win-btn" onClick={() => actions.setStatusLight(zone.uuid, false)}>{t('desk.prefs.off')}</button>
            </div>
            <RoomExtras zone={zone} rooms={[]} />
            <StereoPairField zone={zone} />
            <div className="dk-field"><span>{t('desk.about.model')}</span><span>{zone.model}</span></div>
            <div className="dk-field"><span>{t('desk.about.version')}</span><span>{zone.display_version}</span></div>
            <div className="dk-field"><span>{t('desk.about.system')}</span><span>{household?.generation || ''}</span></div>
            <div className="dk-field"><span>{t('desk.about.address')}</span><span>{zone.host}</span></div>
          </>
        )}
      </div>
    </>
  )
}

// The settings a room may have beyond bass and treble, read from the device
// and shown only where it answers: a soundbar's Night Sound, Speech
// Enhancement, Sub and Surround; a line-in device's level and name; every
// room's autoplay (what plays when its line-in gets a signal).
const EQ_LABELS = { NightMode: 'desk.room.nightSound', DialogLevel: 'desk.room.speech', SubEnable: 'desk.room.sub',
                    SubGain: 'desk.room.subLevel', SurroundEnable: 'desk.room.surround', SurroundLevel: 'desk.room.surroundLevel',
                    MusicSurroundLevel: 'desk.room.musicSurroundLevel', AudioDelay: 'desk.room.audioDelay', HeightChannelLevel: 'desk.room.heightLevel' }
const EQ_FLAGS = new Set(['NightMode', 'DialogLevel', 'SubEnable', 'SurroundEnable'])
const EQ_RANGES = { SubGain: [-15, 15], SurroundLevel: [-15, 15], MusicSurroundLevel: [-15, 15], AudioDelay: [0, 5], HeightChannelLevel: [-10, 10] }
export function RoomExtras({ zone }) {
  const { t } = useI18n()
  const { zoneList } = useSystem()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let canceled = false
    setData(null)
    api.roomSettings(zone.uuid).then((r) => { if (!canceled) setData(r) }).catch(() => { if (!canceled) setData({ eq: {} }) })
    return () => { canceled = true }
  }, [zone.uuid])
  const apply = async (patch) => {
    setBusy(true)
    try { setData(await api.setRoomSettings(zone.uuid, patch)) } catch { /* the notice carries it */ }
    setBusy(false)
  }
  if (!data) return null
  const eq = data.eq || {}
  const keys = Object.keys(EQ_LABELS).filter((k) => k in eq && k !== 'SurroundMode')
  return (
    <fieldset className="dk-room-extras" disabled={busy}>
      {keys.map((k) => EQ_FLAGS.has(k) ? (
        <label key={k} className="dk-field dk-check">
          <input type="checkbox" checked={eq[k] === 1} onChange={(e) => apply({ eq: { [k]: e.target.checked ? 1 : 0 } })} />
          <span>{t(EQ_LABELS[k])}</span>
        </label>
      ) : (
        <div key={k} className="dk-field">
          <span>{t(EQ_LABELS[k])}</span>
          <input type="range" min={EQ_RANGES[k]?.[0] ?? -10} max={EQ_RANGES[k]?.[1] ?? 10} defaultValue={eq[k]}
                 onPointerUp={(e) => apply({ eq: { [k]: Number(e.target.value) } })} />
          <span>{eq[k]}</span>
        </div>
      ))}
      {'line_in_level' in data && (
        <>
          <div className="dk-field">
            <span>{t('desk.room.lineInName')}</span>
            <input className="dk-win-input" defaultValue={data.line_in_name} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== data.line_in_name) apply({ line_in_name: e.target.value.trim() }) }} />
          </div>
          <div className="dk-field">
            <span>{t('desk.room.lineInLevel')}</span>
            <input type="range" min="1" max="10" step="1" defaultValue={data.line_in_level} onPointerUp={(e) => apply({ line_in_level: Number(e.target.value) })} />
            <span>{data.line_in_level}</span>
          </div>
        </>
      )}
      {'autoplay_room' in data && (
        <>
          <div className="dk-field">
            <span>{t('desk.room.autoplayRoom')}</span>
            <select value={data.autoplay_room || ''} onChange={(e) => apply({ autoplay_room: e.target.value })}>
              <option value="">{t('desk.room.autoplayOff')}</option>
              {/* Autoplay hands a line-in feed to a speaker. */}
              {withoutBrowserRoom(zoneList).map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
            </select>
          </div>
          {data.autoplay_room && (
            <>
              <label className="dk-field dk-check"><input type="checkbox" checked={Boolean(data.autoplay_linked)} onChange={(e) => apply({ autoplay_linked: e.target.checked })} /><span>{t('desk.room.autoplayLinked')}</span></label>
              <label className="dk-field dk-check"><input type="checkbox" checked={Boolean(data.autoplay_use_volume)} onChange={(e) => apply({ autoplay_use_volume: e.target.checked })} /><span>{t('desk.room.autoplayUseVolume')}</span></label>
              {data.autoplay_use_volume && (
                <div className="dk-field"><span>{t('desk.room.autoplayVolume')}</span>
                  <input type="range" data-wheel-step="2" min="0" max="100" defaultValue={data.autoplay_volume} onPointerUp={(e) => apply({ autoplay_volume: Number(e.target.value) })} /><span>{data.autoplay_volume}</span></div>
              )}
            </>
          )}
        </>
      )}
    </fieldset>
  )
}

// Stereo pairing: an unpaired room offers the other unpaired rooms of the
// same model as its right channel; a pair offers to separate. Both ask first,
// since the speakers re-form the room.
function StereoPairField({ zone }) {
  const { t } = useI18n()
  const { zoneList, actions } = useSystem()
  const [partner, setPartner] = useState('')
  const [confirm, setConfirm] = useState(null)
  // The generations of a model pair with each other, so the "(Gen 2)" on
  // its name is not compared.
  const base = (model) => (model || '').replace(/ \(Gen \d\)$/, '')
  const candidates = zoneList.filter((z) => z.uuid !== zone.uuid && !z.paired && base(z.model) === base(zone.model) && canStereoPair(z) && canStereoPair(zone))
  if (zone.paired) {
    return (
      <div className="dk-field">
        <span>{t('desk.room.stereoPair')}</span>
        <button type="button" className="dk-win-btn" onClick={() => setConfirm('separate')}>{t('desk.room.separate')}</button>
        {confirm && (
          <Confirm title={t('desk.room.separate')} body={t('desk.room.separateBody', { room: zone.name })} action={t('desk.room.separate')}
                   onConfirm={() => { setConfirm(null); actions.separateStereoPair(zone.uuid) }} onClose={() => setConfirm(null)} />
        )}
      </div>
    )
  }
  if (candidates.length === 0) return null
  const chosen = candidates.find((z) => z.uuid === partner)
  return (
    <div className="dk-field">
      <span>{t('desk.room.stereoPair')}</span>
      <select value={partner} onChange={(e) => setPartner(e.target.value)}>
        <option value="">{t('desk.room.pairWith')}</option>
        {candidates.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
      </select>
      <button type="button" className="dk-win-btn" disabled={!chosen} onClick={() => setConfirm('pair')}>{t('desk.room.createPair')}</button>
      {confirm && chosen && (
        <Confirm title={t('desk.room.createPair')} body={t('desk.room.pairBody', { left: zone.name, right: chosen.name })} action={t('desk.room.createPair')}
                 onConfirm={() => { setConfirm(null); actions.createStereoPair(zone.uuid, chosen.uuid) }} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

function EqRow({ top, label, value, min, max, minLabel = '-', maxLabel = '+', onChange }) {
  const [local, setLocal] = useState(value)
  // What was let go of stays until the room reports it, past any value between (useHeld).
  const [held, setHeld] = useHeld(value)
  useEffect(() => { if (held === null) setLocal(value) }, [value, held])
  return (
    <div className="dk-eq-row" style={{ top }}>
      <label>{label}</label>
      <input
        type="range"
        className="dk-eq-slider"
        min={min}
        max={max}
        value={local}
        aria-label={label}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => { setHeld(local); onChange(local) }}
        onKeyUp={() => { setHeld(local); onChange(local) }}
      />
      <span className="dk-eq-min">{minLabel}</span>
      <span className="dk-eq-max">{maxLabel}</span>
      <span className="dk-eq-value">{local > 0 ? `+${local}` : local}</span>
    </div>
  )
}

// --- Group Rooms ------------------------------------------------------------------

export function GroupRooms({ group, zones, households, onClose, windows = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const coordinator = zones[group.coordinator]
  const household = orderedHouseholds(households).find((h) => h.zone_uuids.includes(group.coordinator))
  const candidates = (household?.zone_uuids || []).map((u) => zones[u]).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
  const [selected, setSelected] = useState(() => new Set(group.members))
  const [picking, setPicking] = useState(null)
  const [askNone, setAskNone] = useState(false)
  const allSelected = candidates.every((z) => selected.has(z.uuid))

  // Every room can be unticked, the one the dialog came from as well
  // (lib/grouping.js has what Done then does).
  const toggle = (uuid) => {
    const next = new Set(selected)
    if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
    setSelected(next)
  }
  const proposed = proposedGroups({ group, zones, candidates, selected })
  // The left column shows the one group whose music would play, or the
  // opening group's while that is not settled (ZoneGroupingViewModel).
  const showing = proposed.length === 1 ? zones[proposed[0]] || coordinator : coordinator
  const transport = showing?.transport ?? {}

  const applyTo = (target) => {
    const steps = groupingPlan({ group, zones, candidates, selected, target })
    onClose()
    runPlan(steps, actions)
  }
  const apply = () => {
    if (selected.size === 0) { setAskNone(true); return }
    if (proposed.length > 1) { setPicking(proposed); return }
    applyTo(proposed[0] || group.coordinator)
  }
  const lines = twoLineMetadata(transport, t)
  const line1 = selected.size === 0 ? t('desk.grouping.noMusic')
    : proposed.length > 1 ? t('desk.grouping.chooseMusic')
      : lines.line1
  const line2 = selected.size === 0 || proposed.length > 1 ? '' : lines.line2

  return (
    <>
    <Window title={t('desk.grouping.title')} onClose={picking || askNone ? () => {} : onClose}
            className={windows ? 'win-grouping-window' : ''}>
      <div className={`dk-grouping${windows ? ' win-grouping' : ''}`}>
        <h4 className="dk-grouping-left">{t('desk.grouping.willPlay')}</h4>
        <h4 className="dk-grouping-right">{t('desk.grouping.select')}</h4>
        <div className="dk-grouping-art">
          {/* Where the app's groupingDialogNowPlayingConverter shows its
              no-music picture (no rooms, or music still to choose), Sonora
              shows a tile of its own drawing. */}
          {windows && (selected.size === 0 || proposed.length > 1) ? <Icon.NoMusicTile />
            : transport.source === 'tv' ? <Icon.Tv />
            : <Art src={showing ? nowPlayingArt(showing.host, transport) : ''} size={40}
                   brokenFallback={windows ? 'disc' : 'note'} />}
        </div>
        <p className="dk-grouping-track">{line1}</p>
        <p className="dk-grouping-artist">{line2}</p>
        {/* The Mac app opens with the room list focused, its ring drawn
            round it (2026-09-29); the Windows app's does not. */}
        <div className="dk-grouping-list" tabIndex={windows ? undefined : 0}
             ref={(node) => { if (node && !windows && !node.dataset.focused) { node.dataset.focused = '1'; node.focus({ preventScroll: true }) } }}>
          {candidates.map((zone) => (
            <label key={zone.uuid}>
              <input type="checkbox" checked={selected.has(zone.uuid)}
                     onChange={() => toggle(zone.uuid)} />
              {zone.name}
            </label>
          ))}
        </div>
        <button type="button" className="dk-win-btn dk-grouping-all"
                onClick={() => setSelected(new Set(allSelected ? [] : candidates.map((z) => z.uuid)))}>
          {allSelected ? t('desk.grouping.unselectAll') : t('desk.grouping.partyMode')}
        </button>
        <div className="dk-grouping-actions">
          {windows ? (
            <>
              <button type="button" className="dk-win-btn" data-default="true" onClick={apply}>{t('common.done')}</button>
              <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
            </>
          ) : (
            <>
              {/* The Mac app's sheet: Cancel, then Done as the default (2026-09-15). */}
              <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
              <button type="button" className="dk-win-btn" data-default="true" onClick={apply}>{t('common.done')}</button>
            </>
          )}
        </div>
      </div>
    </Window>
    {picking && (
      <GroupingMusicPicker groups={picking} zones={zones} windows={windows}
                           onClose={() => setPicking(null)} onPick={(uuid) => applyTo(uuid)} />
    )}
    {/* Done with nothing ticked: the app asks, then stops the group's music
        and leaves the grouping alone (2026-09-23). */}
    {askNone && (
      <Confirm title={t('desk.grouping.noneTitle')} body={t('desk.grouping.noneBody')}
               action={t('desk.grouping.noneYes')} cancelLabel={t('common.cancel')}
               onClose={() => setAskNone(false)}
               onConfirm={() => { onClose(); actions.stop(group.coordinator) }} />
    )}
    </>
  )
}

// The app's GroupingMusicPicker: grouping rooms that are each playing
// something has to settle which music continues, so Done in Group Rooms puts
// up this list of the groups being merged and the chosen one becomes the
// group's coordinator (zones/groupingmusicpicker.xaml).
function GroupingMusicPicker({ groups, zones, onClose, onPick, windows = false }) {
  const { t } = useI18n()
  const [chosen, setChosen] = useState('')
  return (
    <Window title={t('desk.grouping.pickTitle')} onClose={onClose}
            className={windows ? 'win-musicpicker-window' : ''}>
      <div className="dk-musicpicker">
        <h4>{t('desk.grouping.pickHeading')}</h4>
        <div className="dk-musicpicker-list" role="listbox" aria-label={t('desk.grouping.pickHeading')}>
          {groups.map((uuid) => {
            const zone = zones[uuid]
            const tr = zone?.transport ?? {}
            const lines = twoLineMetadata(tr, t)
            return (
              <div key={uuid} role="option" tabIndex={0} aria-selected={chosen === uuid}
                   className="dk-musicpicker-row" onClick={() => setChosen(uuid)}
                   onDoubleClick={() => onPick(uuid)}
                   onKeyDown={(event) => { if (event.key === 'Enter') onPick(uuid) }}>
                <span className="dk-musicpicker-art">
                  <Art src={zone ? nowPlayingArt(zone.host, tr) : ''} size={40} />
                </span>
                <span className="dk-musicpicker-text">
                  <p className="dk-musicpicker-title">{lines.line1 || zone?.name || ''}</p>
                  <p className="dk-musicpicker-sub">{lines.line2}</p>
                </span>
              </div>
            )
          })}
        </div>
        <div className="dk-grouping-actions">
          {windows ? (
            <>
              <button type="button" className="dk-win-btn" data-default="true" disabled={!chosen}
                      onClick={() => onPick(chosen)}>{t('common.done')}</button>
              <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
            </>
          ) : (
            <>
              <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
              <button type="button" className="dk-win-btn" data-default="true" disabled={!chosen}
                      onClick={() => onPick(chosen)}>{t('common.done')}</button>
            </>
          )}
        </div>
      </div>
    </Window>
  )
}

// --- About, shortcuts, info ---------------------------------------------------------

// Which half of a bonded room a speaker is, as the desktop app labels it.
const ROLE_LABEL = { LF: 'L', RF: 'R', SW: 'Sub', LR: 'LS', RR: 'RS' }

// About My Sonos System, as the Mac app's 450px window lays it out
// (2026-09-15): the app icon beside the name and a few facts, a white box
// listing every product the way the app prints them (model and room, serial,
// Sonos OS, version, hardware version, series ID, address, wireless mode),
// the legal line, and a gray footer with one button. The app's is Submit
// Diagnostics; Sonora's copies the listing, which is what a support thread
// asks for.
export function About({ onClose }) {
  const { zoneList, households } = useSystem()
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const ordered = orderedHouseholds(households)
  const count = ordered.reduce((n, h) => n + playersOf(h, zoneList).length, 0)
  const line = (label, value) => (value ? `${label}: ${value}\n` : '')
  const listing = ordered.map((h) => {
    const players = playersOf(h, zoneList)
    let text = `${t('desk.about.systemLine', { gen: h.generation, count: players.length })}\n`
    for (const p of players) {
      text += '----------------------------------\n'
      text += `${p.model}: ${p.role ? `${p.name} (${ROLE_LABEL[p.role] ?? p.role})` : p.name}\n`
      text += line(t('desk.about.serial'), p.serial)
      text += line(t('desk.about.sonosOs'), h.generation)
      text += line(t('desk.about.version'), p.software_version && p.software_version !== p.display_version
        ? `${p.display_version} (${p.software_version})` : p.display_version)
      text += line(t('desk.about.hardware'), p.hardware_version)
      text += line(t('desk.about.series'), p.series_id)
      text += line(t('desk.about.ip'), p.host)
      text += line(t('desk.about.wm'), p.wireless_mode)
    }
    return text
  }).join('\n')
  const copy = async () => {
    try { await navigator.clipboard.writeText(listing); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* no clipboard here */ }
  }
  return (
    <Window title={t('desk.about.title')} onClose={onClose} className="dk-about-window">
      <div className="dk-about">
        <div className="dk-about-head">
          <img className="dk-about-icon" src={appIcon} alt="" />
          <div className="dk-about-facts">
            <h3>{APP.name}</h3>
            <dl>
              <dt>{t('desk.about.version')}:</dt><dd>{APP.version}</dd>
              <dt>{t('desk.about.sonosOs')}:</dt><dd>{ordered.map((h) => h.generation).join(', ')}</dd>
              <dt>{t('desk.about.products')}:</dt><dd>{count}</dd>
            </dl>
          </div>
        </div>
        <pre className="dk-about-box">{listing}</pre>
        <p className="dk-about-legal">
          {t('about.license', { license: APP.license })}
          <br /><a href={APP.source} target="_blank" rel="noopener">{APP.source}</a>
          <br /><a href="/third-party-notices" target="_blank" rel="noopener">{t('about.thirdParty')}</a>
        </p>
        <div className="dk-about-foot">
          <button type="button" className="dk-win-btn" onClick={copy}>{copied ? t('desk.about.copied') : t('desk.about.copy')}</button>
        </div>
      </div>
    </Window>
  )
}

export function Shortcuts({ onClose }) {
  const { t } = useI18n()
  const rows = [
    ['Space', t('desk.shortcuts.playPause')],
    ['⌘F', t('common.search')],
    ['⌘↑', t('desk.shortcuts.volUp')],
    ['⌘↓', t('desk.shortcuts.volDown')],
    ['⌘M', t('desk.shortcuts.mute')],
    ['⌘→', t('common.next')],
    ['⌘←', t('common.previous')],
    ['⌘]', t('desk.shortcuts.nextZone')],
    ['⌘[', t('desk.shortcuts.prevZone')],
    ['⌘,', t('desk.menu.settings')],
  ]
  return (
    <Window title={t('desk.shortcuts.title')} onClose={onClose}>
      <div className="dk-shortcuts">
        <table>
          <tbody>
            {rows.map(([key, label]) => (
              <tr key={key}><td><kbd>{key}</kbd></td><td>{label}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Window>
  )
}

export function TrackInfo({ zone, onClose }) {
  const { t } = useI18n()
  const transport = zone?.transport ?? {}
  const rows = [
    [t('desk.now.songLabel'), transport.title],
    [t('desk.now.artist'), transport.artist],
    [t('desk.now.album'), transport.album],
    [t('desk.info.source'), t(`source.${transport.source || 'unknown'}`)],
    [t('desk.info.room'), zone?.name],
    [t('desk.info.duration'), transport.track_duration],
  ].filter(([, v]) => v)
  return (
    <Window title={t('desk.now.infoOptions')} onClose={onClose}>
      <div className="dk-about" style={{ width: 420 }}>
        <table>
          <tbody>
            {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Window>
  )
}

// "Add a Radio Station" (captured from the Windows app 2026-09-05, 395x290):
// a bold heading, two sentences, Streaming URL, and Station Name fields each
// with a validator mark until filled, OK grayed until both are valid, Cancel.
// The fields start empty: the app shows no "http://" hint (2026-10-02).
export function AddRadioStation({ zone, onClose, onAdded }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const urlOk = /^(https?|x-rincon-mp3radio):\/\/\S+$/i.test(url.trim())
  const nameOk = name.trim().length > 0
  const submit = async () => {
    if (!urlOk || !nameOk || !zone) return
    setBusy(true)
    const result = await actions.addRadioStation(zone.uuid, url.trim(), name.trim())
    setBusy(false)
    if (result) { onAdded?.(result); onClose() }
  }
  return (
    <Window title={t('desk.radio.title')} onClose={onClose} className="dk-addradio">
      <div className="dk-addradio-body">
        <p><strong>{t('desk.radio.title')}</strong></p>
        <p>{t('desk.radio.intro')}<br />{t('desk.radio.where')}</p>
        <label className="dk-addradio-field">
          <span>{t('desk.radio.url')}</span>
          <input type="url" value={url} autoFocus onChange={(e) => setUrl(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') submit() }} aria-invalid={!urlOk} />
          <em className="dk-addradio-mark" hidden={urlOk}>!</em>
        </label>
        <label className="dk-addradio-field">
          <span>{t('desk.radio.name')}</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') submit() }} aria-invalid={!nameOk} />
          <em className="dk-addradio-mark" hidden={nameOk}>!</em>
        </label>
      </div>
      <div className="win-dialog-foot dk-addradio-foot">
        <button type="button" className="dk-win-btn" data-default="true" disabled={!urlOk || !nameOk || busy || !zone} onClick={submit}>{t('common.ok')}</button>
        <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}

// A question, or a name to type. The width and the button strip used to be
// inline styles, which no theme could reach; they are classes now so the
// Windows theme can wear the app's own frames -- MessageWindow for a
// question, TextInputDialogWindow (Width="350", content Margin="20", a 25px
// field, OK and Cancel) for a name.
export function Confirm({ title, body, action, onConfirm, onClose, children,
                          disabled = false, className = '', cancelLabel = null }) {
  const { t } = useI18n()
  return (
    <Window title={title} onClose={onClose} className={className}>
      <div className="dk-confirm">
        <p>{body}</p>
        {children}
        <div className="dk-confirm-foot">
          <button type="button" className="dk-win-btn" onClick={onClose}>{cancelLabel || t('common.close')}</button>
          <button type="button" className="dk-win-btn" data-default="true" disabled={disabled}
                  onClick={onConfirm}>{action}</button>
        </div>
      </div>
    </Window>
  )
}


// Sleep Timer, as the application offers it from the queue pane: off, or one of
// the fixed lengths, with what remains shown while one is running.
// `placement`: the Windows popover is centered over its button 12px up; the
// Mac one (2026-09-15) shares the button's left edge and sits on the footer.
// Centered over the button, but kept on the screen: on a phone the button
// sits at the edge and a centered popover would hang off it. The caret still
// points at the button's middle.
function centeredOver(anchor, width = 250, margin = 6) {
  const middle = anchor.x + anchor.width / 2
  const left = Math.max(margin, Math.min(middle - width / 2, window.innerWidth - width - margin))
  return { position: 'fixed', left: Math.round(left), bottom: Math.round(window.innerHeight - anchor.y + 12),
           '--caret-x': `${Math.round(middle - left)}px` }
}

export function SleepTimer({ zone, onClose, anchor = null, groupLabel = '', placement = 'center', chooseKey = 'win.sleep.choose' }) {
  const { t } = useI18n()
  const { remaining, set } = useSleepTimer(zone?.uuid)
  const at = anchor && (placement === 'left'
    ? { position: 'fixed', left: Math.round(anchor.x), bottom: Math.round(window.innerHeight - anchor.y) }
    : centeredOver(anchor))
  return (
    <Window title={t('desk.browse.sleepTimer')} onClose={onClose}
            className={anchor ? 'dk-sleep-window' : ''} style={at || undefined}>
      <div className="dk-sleep">
        {anchor && (
          <>
            <h4 className="dk-sleep-title">{t('win.sleep.title', { state: remaining ? remaining.replace(/^0:/, '') : t('desk.sleep.off') })}</h4>
            {/* The app names the whole group here ("<room> + 1"),
                not just the room the timer is set through. */}
            <p className="dk-sleep-choose">{t(chooseKey, { room: groupLabel || zone?.name || '' })}</p>
          </>
        )}
        
        <p>{remaining ? t('desk.sleep.remaining', { time: remaining.replace(/^0:/, '') })
                      : t('desk.sleep.none')}</p>
        <div className="dk-sleep-choices">
          <button type="button" className="dk-win-btn" aria-pressed={!remaining}
                  onClick={() => set(null)}>{t('desk.sleep.off')}</button>
          {SLEEP_CHOICES.map((m) => (
            <button key={m} type="button" className="dk-win-btn" onClick={() => set(m)}>
              {sleepLabel(t, m)}
            </button>
          ))}
        </div>
        <div className="dk-add-actions">
          <button type="button" className="dk-win-btn" data-default="true" onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </Window>
  )
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Alarms: the household's list with on/off and Delete. Creating one stays
// with the Sonos app (see useAlarms).
export function Alarms({ zone, onClose }) {
  const { t } = useI18n()
  const { alarms, error, busy, toggle, remove, create, update } = useAlarms(zone?.uuid)
  const { zoneList, households } = useSystem()
  // An alarm lives on a speaker, so the browser room is not one of these.
  const rooms = withoutBrowserRoom(zoneList).sort((a, b) => a.name.localeCompare(b.name))
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null) // null, 'new' or an alarm
  // Declared before the editor's early return: a hook after it made opening
  // the editor render fewer hooks than the list did, and React threw
  // (error #300), blanking the Mac theme on Add.
  const [selected, setSelected] = useState(null)
  const describe = (a) => {
    const key = recurrenceKey(a.Recurrence)
    if (key === 'ON') return recurrenceDays(a.Recurrence).map((i) => DAY_LETTERS[i]).join(' ')
    return t(`desk.alarms.recurrence.${key}`)
  }
  if (editing) {
    return (
      <Window title={t(editing === 'new' ? 'win.alarm.addTitle' : 'win.alarm.editTitle')} onClose={onClose}>
        {/* The Mac app's Add Alarm shows "07:00": a 24-hour clock, no AM/PM,
            whatever the Mac's own clock (watched 2026-09-23). */}
        <AlarmEditorPanel alarm={editing === 'new' ? null : editing} rooms={rooms} households={households} busy={busy} clock={24}
                          onCancel={() => setEditing(null)}
                          onSave={async (d) => { if (editing === 'new') await create(d); else await update(editing.ID, d); setEditing(null) }} />
      </Window>
    )
  }
  // The app's sheet (2026-09-15): "Manage Sonos Alarms", the current time,
  // a Where / When / ON table with a row highlighted, + - Edit under it, Done.
  const chosen = alarms?.find((a) => a.ID === selected) || null
  // "Current time: <date> - <time> <zone>", the app's AlarmDialogCurrentTimeFormat
  // in each of its languages, the zone named the generic way it does
  // ("Pacific Time", not "Pacific Daylight Time"; 2026-09-24).
  const now = new Date()
  const zonePart = (() => {
    try {
      return new Intl.DateTimeFormat(undefined, { timeZoneName: 'longGeneric' }).formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value || ''
    } catch { return '' }
  })()
  const stamp = t('desk.alarms.currentTime', {
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(now),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now),
    zone: zonePart,
  })
  const when = (a) => {
    const [h, m] = (a.StartTime || '00:00:00').split(':').map(Number)
    return `${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m))} - ${describe(a)}`
  }
  return (
    <Window title={t('desk.browse.alarms')} onClose={onClose} className="dk-alarms-window">
      <div className="dk-alarms">
        <h3 className="dk-alarms-heading">{t('win.alarms.manage')}</h3>
        <p className="dk-alarms-time">{stamp}</p>
        <div className="dk-table dk-alarms-table" role="listbox" aria-label={t('win.alarms.manage')}>
          <div className="dk-table-head" aria-hidden="true">
            <span>{t('win.alarms.where')}</span><span>{t('win.alarms.when')}</span><span>{t('win.alarms.on')}</span>
          </div>
          <div className="dk-table-body">
            {alarms === null && !error && <p className="dk-table-empty">{t('desk.browse.loading')}</p>}
            {error && <p className="dk-table-empty dk-add-error">{error}</p>}
            {alarms && alarms.map((a) => (
              <div key={a.ID} role="option" aria-selected={selected === a.ID} onClick={() => setSelected(a.ID)}
                   onDoubleClick={() => setEditing(a)}>
                <span>{a.room || '—'}</span>
                <span>{when(a)}</span>
                <span><input type="checkbox" checked={a.Enabled === '1'} disabled={busy} title={t('desk.alarms.enabled')}
                             onClick={(e) => e.stopPropagation()} onChange={(e) => toggle(a.ID, e.target.checked)} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="dk-alarms-tools">
          <div className="dk-pm">
            <button type="button" title={t('win.alarms.add')} aria-label={t('win.alarms.add')} disabled={busy} onClick={() => setEditing('new')}>+</button>
            <button type="button" title={t('win.alarms.remove')} aria-label={t('win.alarms.remove')} disabled={busy || !chosen} onClick={() => setConfirm(chosen)}>−</button>
          </div>
          <button type="button" className="dk-win-btn dk-alarms-edit" disabled={busy || !chosen} onClick={() => setEditing(chosen)}>{t('win.alarms.edit')}</button>
        </div>
        {/* A plain button in the app, not the blue default (2026-09-24). */}
        <button type="button" className="dk-win-btn dk-alarms-done" onClick={onClose}>{t('common.done')}</button>
      </div>
      {confirm && (
        <Confirm title={t('desk.alarms.deleteTitle')}
                 body={t('desk.alarms.deleteBody', { time: confirm.StartTime.replace(/:00$/, ''), room: confirm.room || '' })}
                 action={t('desk.alarms.delete')} cancelLabel={t('common.cancel')} disabled={busy}
                 onConfirm={() => { remove(confirm.ID); setConfirm(null); setSelected(null) }} onClose={() => setConfirm(null)} />
      )}
    </Window>
  )
}

// Save Queue: a name for the Sonos playlist the queue becomes.
// Save Queue, as the Mac app's sheet (2026-09-15): the queue becomes a Sonos
// Playlist under a suggested name ("Tuesday Morning Mix": the weekday and the
// part of the day), or replaces one of the existing playlists listed below.
export function SaveQueueDialog({ zone, onClose, onSave }) {
  const { t } = useI18n()
  const [title, setTitle] = useState(() => suggestedQueueName(t, zone))
  const [existing, setExisting] = useState(null)
  const [replace, setReplace] = useState(null)
  useEffect(() => {
    let canceled = false
    api.browse('SQ:', { zone: zone?.uuid, count: 500 })
      .then((r) => { if (!canceled) setExisting(r.items || []) })
      .catch(() => { if (!canceled) setExisting([]) })
    return () => { canceled = true }
  }, [zone?.uuid])
  const ready = replace ? true : Boolean(title.trim())
  const done = () => { if (!ready) return; replace ? onSave(replace.title, replace.id) : onSave(title.trim()) }
  return (
    <Window title={t('desk.queue.saveTitle')} onClose={onClose} className="dk-savequeue-window">
      <div className="dk-savequeue">
        <p className="dk-savequeue-intro">{t('desk.queue.saveBody')}</p>
        <label className="dk-savequeue-name">
          <span>{t('desk.queue.enterName')}</span>
          <input type="text" value={title} autoFocus onFocus={() => setReplace(null)}
                 onChange={(e) => { setTitle(e.target.value); setReplace(null) }}
                 onKeyDown={(e) => { if (e.key === 'Enter') done() }} />
        </label>
        <p className="dk-savequeue-or">{t('desk.queue.orReplace')}</p>
        <div className="dk-savequeue-list" role="listbox" aria-label={t('desk.queue.orReplace')}>
          {existing === null && <p className="dk-table-empty">{t('desk.browse.loading')}</p>}
          {(existing || []).map((item) => (
            <div key={item.id} role="option" aria-selected={replace?.id === item.id}
                 onClick={() => setReplace(item)} onDoubleClick={() => { setReplace(item); onSave(item.title, item.id) }}>
              {item.title}
            </div>
          ))}
        </div>
        <div className="dk-confirm-foot dk-savequeue-foot">
          <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="dk-win-btn" data-default="true" disabled={!ready} onClick={done}>{t('common.done')}</button>
        </div>
      </div>
    </Window>
  )
}

// The Mac app's Clear Queue question (2026-09-15): a sheet titled Confirm,
// Cancel and Clear Queue.
export function ClearQueueConfirm({ onClose, onConfirm }) {
  const { t } = useI18n()
  return (
    <Confirm title={t('desk.queue.confirmTitle')} body={t('desk.queue.clearBody')} action={t('desk.queue.clear')}
             cancelLabel={t('common.cancel')} onConfirm={onConfirm} onClose={onClose} />
  )
}

