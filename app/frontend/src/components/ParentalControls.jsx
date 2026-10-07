import './shared.css'
import React, { useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { useSystem } from '../lib/store.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../lib/format.js'
import { useContentFiltering } from '../lib/useContentFiltering.js'

// Parental Controls, worn by every theme's settings.
//
// The control is the household's, not Sonora's: turning it on turns it on for
// every app that controls those speakers. That is the whole reason the value
// is read off them rather than kept here.
//
// Two shapes, because the apps have two. `button` is the Windows app's own
// tab, rebuilt from 9.1's settingswindow.xaml: one paragraph that changes
// with the state, one button whose label flips between Turn Explicit
// Filtering On and Off, and More Information under it. `switch` is the modern
// app's Content Filters page: a switch per system. Each theme picks the one
// its app would have had and hands over its own class names, and, where it
// has one, its own switch and its own settings row to sit it in.
//
// Either shape shows the household's real state and is wired to the write.
// While the speakers refuse that write (`changeable` false) the control is
// disabled with the reason beside it, and
// nothing here has to change on the day it starts working.
export const FAQ = 'https://faq.sonos.com/parentalcontrols'

function DefaultSwitch({ id, label, checked, disabled, hint, onChange }) {
  return (
    <label className="dk-check" title={hint || undefined} aria-disabled={disabled || undefined}>
      <input type="checkbox" id={id} checked={checked} disabled={disabled}
             onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export default function ParentalControls({
  shape = 'switch', classes = {}, title = null, showTitle = true,
  Toggle = null, Row = null, Group = null, system = null, onSystem = null,
}) {
  const { t } = useI18n()
  const { households } = useSystem()
  const { byHousehold, busy, error, set } = useContentFiltering()
  const systems = orderedHouseholds(households || [])
  const [own, setOwn] = useState(null)

  const c = {
    section: 'dk-theme-manage', blurb: 'dk-theme-blurb', error: 'dk-add-error',
    actions: 'dk-theme-actions', button: 'dk-win-btn', row: 'pc-row', note: 'pc-note',
    body: 'pc-body', picker: 'pc-picker',
    ...classes,
  }

  const stateOf = (id) => (Object.hasOwn(byHousehold, id) ? byHousehold[id] : undefined)
  const rows = (children) => (Group ? <Group>{children}</Group> : children)
  const moreInfo = (
    <button type="button" className={`${c.button} pc-more`}
            onClick={() => window.open(FAQ, '_blank', 'noopener')}>
      {t('desk.parental.moreInfo')}
    </button>
  )

  if (shape === 'button') {
    // The app's own tab. One system at a time, chosen above the panel where
    // there is more than one -- something the app never had to draw.
    const chosen = system ?? own
    const active = chosen && systems.some((h) => h.id === chosen) ? chosen : systems[0]?.id
    const state = active ? stateOf(active) : undefined
    const reading = state === undefined
    const unreadable = state === null
    const on = Boolean(state?.filtering)
    const body = reading ? t('desk.parental.reading')
      : unreadable ? t('win.parental.unreadable')
        : on ? t('win.parental.enabled') : t('win.parental.disabled')
    return (
      <div className={`${c.section} parental-block`}>
        {showTitle && <h4>{title || t('win.parental.title')}</h4>}
        {/* A shell that wants the chooser somewhere of its own passes
            `onSystem` and draws it there; otherwise it belongs here. */}
        {systemChoiceMatters(systems) && !onSystem && (
          <div className={c.picker}>
            <select value={active || ''} onChange={(e) => setOwn(e.target.value)}>
              {systems.map((h) => <option key={h.id} value={h.id}>{h.generation}</option>)}
            </select>
          </div>
        )}
        <p className={c.body}>{body.split('\n').map((line, i) => (
          <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
        ))}</p>
        {error && <p className={c.error}>{error}</p>}
        {!unreadable && (
          <button type="button" className={`${c.button} pc-flip`}
                  disabled={reading || state?.changeable === false || busy === active}
                  title={state?.changeable === false ? t('desk.parental.unavailable') : undefined}
                  onClick={() => active && set(active, !on)}>
            {on ? t('win.parental.turnOff') : t('win.parental.turnOn')}
          </button>
        )}
        {state?.changeable === false && <p className={c.note}>{t('desk.parental.unavailable')}</p>}
        {moreInfo}
      </div>
    )
  }

  // Defined once below, not here: an inline default was a new component on
  // every render, so the switches were rebuilt on every tick of a playing track.
  const Switch = Toggle || DefaultSwitch

  return (
    <div className={`${c.section} parental-block`}>
      {showTitle && <h4>{title || t('desk.prefs.parental')}</h4>}
      <p className={c.blurb}>{t('desk.parental.body').split('\n').map((line, i) => (
        <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
      ))}</p>
      {error && <p className={c.error}>{error}</p>}
      {systems.length === 0 && <p className={c.note}>{t('desk.parental.reading')}</p>}
      {/* A shell whose settings rows live in a group of their own wraps them
          in it; otherwise the rows stand on their own. */}
      {rows(systems.map((household) => {
        const state = stateOf(household.id)
        const label = systems.length > 1
          ? t('desk.parental.filterFor', { system: household.generation })
          : t('desk.parental.filter')
        const note = [
          state === undefined ? t('desk.parental.reading')
            : state === null ? t('desk.parental.unknown')
              : state.filtering ? t('desk.parental.on') : t('desk.parental.off'),
          state && state.changeable === false ? t('desk.parental.unavailable') : null,
        ].filter(Boolean).join(' · ')
        const control = (
          <Switch
            id={`parental-${household.id}`}
            label={label}
            checked={Boolean(state?.filtering)}
            disabled={!state || state.changeable === false || busy === household.id}
            hint={state && state.changeable === false ? t('desk.parental.unavailable') : undefined}
            onChange={(on) => set(household.id, on)}
          />
        )
        return Row
          ? <Row key={household.id} id={household.id} label={label} note={note} control={control} />
          : (
            <div key={household.id} className={c.row}>
              {control}
              <span className={c.note}>{note}</span>
            </div>
          )
      }))}
      <div className={c.actions}>{moreInfo}</div>
    </div>
  )
}
