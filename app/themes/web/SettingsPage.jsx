import React, { useEffect, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import ThemeChooser from '../../frontend/src/components/ThemeChooser.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import S2Upgrade from '../../frontend/src/components/S2Upgrade.jsx'
import Overlay from './Overlay.jsx'
import { useCloudAccount } from '../../frontend/src/lib/useCloudAccount.js'
import { useContentFiltering } from '../../frontend/src/lib/useContentFiltering.js'
import { versionLabel } from '../../frontend/src/lib/version.js'

// Settings, in the shape the product gives it.
//
// Not a modal. The official client replaces the browse column with a rounded
// panel: a 40px title with a 40px close disc, then sections of an 18px heading
// over a 12px description, each followed by a group of 52px rows carrying a
// chevron, a link glyph or a 56x32 toggle at the right. Measured at 1440px:
// panel [16,76,972,740], title at (40,100), rows 924px wide at x=40.
//
// The content is Sonora's own where the product has none to copy -- its
// sections manage a cloud account and telemetry; this controller has an
// optional sign-in, a theme, a language, and the systems it found -- laid out
// in the product's language rather than invented anew. What the product does
// not offer at all is not offered here either: no music-service tools, no
// network rescan and no content-filter page, whose setting View System
// Details already shows.

export default function SettingsPage({ onClose, onTroubleshoot, onSystemDetails, systemFilter = 'all' }) {
  const { t } = useI18n()
  const { households, zones } = useSystem()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [s2Open, setS2Open] = useState(false)
  const [naming, setNaming] = useState(false)
  // The system section is about the system in view, as View System Details
  // is: the one picked at the top of the page, or every one when all are.
  const shown = orderedHouseholds(households)
    .filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  // The product shows its one system's filtering here -- "Content filters
  // off" -- and with two in view each is named.
  const { byHousehold } = useContentFiltering()
  const filterLine = shown.map((h) => {
    const state = Object.hasOwn(byHousehold, h.id) ? byHousehold[h.id] : undefined
    const text = state === undefined ? t('desk.parental.reading')
      : state === null ? t('desk.parental.unknown')
        : state.filtering ? t('desk.parental.on') : t('desk.parental.off')
    return shown.length > 1 ? `${h.generation}: ${text}` : text
  }).join(' · ') || null

  return (
    <section className="wb-settings" aria-label={t('common.settings')}>
      <header className="wb-settings-head">
        <h1>{t('common.settings')}</h1>
        <button type="button" className="wb-settings-close"
                aria-label={t('common.close')} onClick={onClose}>
          <Icon.Close width={18} height={18} />
        </button>
      </header>

      <Account />


      <Section title={t('web.settings.appearance')}
               blurb={t('web.settings.appearanceBlurb')}>
        <ThemeChooser Field={ChooserRow} classes={WEB_CHOOSER} />
      </Section>

      <Section title={t('about.title')}>
        <Row label={t('about.menu')} onClick={() => setAboutOpen(true)} />
      </Section>

      <Section title={t('s2.title')} blurb={t('sf.settings.s2.blurb')}>
        <Row
          label={t('web.settings.upgradeReport')}
          onClick={() => setS2Open(true)}
          control={<Icon.ChevronRight width={16} height={16} />}
        />
      </Section>

      {/* "System" over "Your System", as the product heads its two rows. */}
      <Section title={t('web.settings.systems')} blurb={t('web.yourSystem')}>
        {shown.map((household) => {
          const first = household.zone_uuids.map((uuid) => zones[uuid]).find((z) => z?.display_version)
          const version = versionLabel(first?.display_version, first?.software_version)
          const unreachable = household.vanished.length
          return (
            <Row
              key={household.id}
              label={t('common.system', { generation: household.generation })}
              sub={[
                t('web.settings.roomsAndVersion', {
                  rooms: t.plural('common.rooms', household.zone_uuids.length),
                  version,
                }),
                unreachable
                  ? t('web.settings.unreachable', { count: unreachable }) : null,
              ].filter(Boolean).join(' · ')}
            />
          )
        })}
        {/* The product's two system rows, in its order: details, then the
            name. The product puts the system's content filtering under the
            first as a second line -- "Content filters off" -- and so does
            this (measured at play.sonos.com, 2026-09-17). */}
        <Row label={t('web.settings.viewSystemDetails')} sub={filterLine} onClick={onSystemDetails}
             control={<Icon.ChevronRight width={16} height={16} />} />
        <Row label={t('web.settings.systemName')} onClick={() => setNaming(true)}
             control={<Icon.ChevronRight width={16} height={16} />} />
      </Section>

      <Section title={t('web.settings.diagnostics')}
               blurb={t('web.settings.diagnosticsBlurb')}>
        <Row
          label={t('diag.title')}
          onClick={onTroubleshoot}
          control={<Icon.ChevronRight width={16} height={16} />}
        />
      </Section>
      {aboutOpen && <AboutSonora onClose={() => setAboutOpen(false)} />}
      {s2Open && <S2Upgrade onClose={() => setS2Open(false)} />}
      {naming && <SystemNameDialog households={orderedHouseholds(households)} systemFilter={systemFilter} onClose={() => setNaming(false)} />}
    </section>
  )
}

export function Section({ title, blurb, children }) {
  return (
    <div className="wb-settings-section">
      <h2>{title}</h2>
      {blurb && <p>{blurb}</p>}
      <div className="wb-settings-group">{children}</div>
    </div>
  )
}

// A 52px row: 14px label, optional 12px sub-line, a control at the right. A
// row with an onClick is a button, as the product's navigation rows are.
export function Row({ label, sub, control, onClick, disabled = false }) {
  const inner = (
    <>
      <span className="wb-settings-row-text">
        <span className="wb-settings-row-label">{label}</span>
        {sub && <span className="wb-settings-row-sub">{sub}</span>}
      </span>
      {control && <span className="wb-settings-row-control">{control}</span>}
    </>
  )
  return (onClick || disabled)
    ? <button type="button" className="wb-settings-row" onClick={onClick}
              disabled={disabled} aria-busy={disabled || undefined}>{inner}</button>
    : <div className="wb-settings-row">{inner}</div>
}

// 56x32 switch: a white pill with a dark knob when on, inverted when off.
export function Toggle({ checked, onChange, label, disabled = false, hint = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={hint || undefined}
      disabled={disabled}
      className="wb-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="wb-toggle-knob" />
    </button>
  )
}

// The shared chooser in the product's settings rows: a label at the left,
// the control at the right, and its still and buttons as a block beneath.
function ChooserRow({ label, hint, children }) {
  return <Row label={label} sub={hint} control={children} />
}
const WEB_CHOOSER = {
  select: 'wb-settings-select', button: 'wb-btn', primary: 'wb-btn',
  preview: 'wb-theme-preview', version: 'wb-theme-version', blurb: 'wb-theme-blurb',
  noshot: 'wb-theme-noshot', actions: 'wb-theme-actions', error: 'wb-add-error',
  manage: 'wb-theme-manage',
}

// The account section mirrors the product's: heading, the email as the
// description, and a "Sign out" row. Signed out, the description explains what
// the sign-in is for and the group holds the form.
function Account() {
  const { t } = useI18n()
  // The reading and the two writes are shared with every other settings page
  // (lib/useCloudAccount.js); the product's own markup stays here.
  const { known, signedIn, email: signedInAs, busy, error, signIn, signOut } = useCloudAccount()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    await signIn(email, password)
    setPassword('')
  }

  // Nothing at all until the answer is in.
  //
  // This first drew the sign-in form at someone already signed in, for the
  // length of one fetch. Hiding only the form left a heading and an empty
  // line that collapsed when the answer came -- a blank space that snapped
  // away, which is what a second report called it. The section
  // is what has to wait: it arrives once, complete, and nothing moves under
  // the reader.
  if (!known) return null

  return (
    <div className="wb-settings-section">
      <h2>{t('web.settings.sonosAccount')}</h2>
      {signedIn ? <p>{signedInAs}</p> : <><p>{t('account.blurb')}</p><p>{t('account.optional')}</p></>}
      <div className="wb-settings-group">
        {signedIn ? (
          <button type="button" className="wb-settings-row" onClick={signOut}
                  disabled={busy}>
            <span className="wb-settings-row-text">
              <span className="wb-settings-row-label">{t('account.signOut')}</span>
            </span>
            <span className="wb-settings-row-control">
              <Icon.ChevronRight width={16} height={16} />
            </span>
          </button>
        ) : (
          <>
            <form className="wb-settings-row wb-settings-form" onSubmit={submit}>
            <input type="email" autoComplete="username" required
                   placeholder={t('account.email')}
                   aria-label={t('account.email')}
                   value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" autoComplete="current-password" required
                   placeholder={t('account.password')}
                   aria-label={t('account.password')}
                   value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className="wb-btn" disabled={busy}>
              {busy ? t('account.signingIn') : t('account.signIn')}
            </button>
            </form>
          </>
        )}
      </div>
      {error && <p className="wb-settings-error">{error}</p>}
    </div>
  )
}


// "System Name": the product's dialog, "Rename your system:" over a field with
// Cancel and Save. The name is Sonora's own, kept per household, and becomes
// the heading over that system's rooms. With two systems on the network the
// dialog asks which one first.
function SystemNameDialog({ households, systemFilter = 'all', onClose }) {
  const { t } = useI18n()
  const [names, setNames] = useState(null)
  // The system already chosen on the page, where one is: the product's
  // dialog names one system and asks nothing about which.
  const chosen = households.find((h) => h.id === systemFilter)
  const [household, setHousehold] = useState(chosen?.id ?? households[0]?.id ?? '')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.systemNames().then((data) => { setNames(data); setValue(data[household] ?? '') }).catch(() => setNames({}))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The field is set in the same click that picks the system (below), so
  // Save never sees one system's name against the other's for a frame and
  // flashes on. This covers the names arriving.
  useEffect(() => { if (names) setValue(names[household] ?? '') }, [names]) // eslint-disable-line react-hooks/exhaustive-deps

  const s2Name = households.find((h) => h.id === household)?.generation !== 'S1'
  // An S2 system is renamed through the Sonos cloud, as the web player does
  // it, so it needs Sonora signed in; an S1 system's name is Sonora's own.
  const { signedIn } = useCloudAccount()
  const locked = s2Name && !signedIn
  const save = async () => {
    setBusy(true); setError('')
    try {
      const data = await api.setSystemName({ household, name: value })
      setNames(data)
      window.dispatchEvent(new CustomEvent('sonora:systemnames', { detail: data }))
      onClose()
    } catch (exc) {
      setError(exc.message)
      setBusy(false)
    }
  }

  return (
    <Overlay onClose={onClose} label={t('web.settings.systemName')} variant="dialog">
      <button type="button" className="wb-dialog-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={10} height={10} />
      </button>
      <h2>{t('web.settings.systemName')}</h2>
      <p>{t('web.settings.renamePrompt')}</p>
      {/* Which system, as a pair of pills rather than a dropdown, in the
          Add Services page's own tabs. */}
      {!chosen && systemChoiceMatters(households) && (
        <div className="wb-tabs wb-name-tabs" role="tablist" aria-label={t('web.settings.systems')}>
          {households.map((h) => (
            <button key={h.id} type="button" role="tab" className="wb-tab"
                    aria-selected={household === h.id}
                    onClick={() => { setHousehold(h.id); setValue(names?.[h.id] ?? '') }}>
              {h.generation}
            </button>
          ))}
        </div>
      )}
      <input className="wb-input wb-name-input" type="text" value={value} autoFocus maxLength={60} readOnly={locked}
             placeholder={t('web.yourSystem')} aria-label={t('web.settings.systemName')}
             onChange={(e) => setValue(e.target.value)}
             onKeyDown={(e) => { if (e.key === 'Enter' && !busy) save() }} />
      {/* An S2 system's name belongs to its speakers, which take a new one
          from the cloud's households/setName, the web player's own route
          (2026-09-28). Signed out, Sonora cannot send it, and says so. */}
      {locked && <p className="wb-dialog-note">{t('web.settings.renameNeedsAccount')}</p>}
      {error && <p className="wb-add-error">{error}</p>}
      {/* Two equal pills; Save stays gray and does nothing until the name
          is new -- the product's is disabled over an empty field
          (play.sonos.com, 2026-09-22). */}
      <div className="wb-dialog-actions">
        <button type="button" className="wb-dialog-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="wb-dialog-btn"
                disabled={locked || busy || names === null || !value.trim() || value.trim() === (names?.[household] ?? '')}
                onClick={save}>{t('common.save')}</button>
      </div>
    </Overlay>
  )
}
