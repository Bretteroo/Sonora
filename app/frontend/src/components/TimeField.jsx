import './shared.css'
import React, { useEffect, useRef, useState } from 'react'
import './TimeField.css'
import { useI18n } from '../i18n/index.jsx'

// A time in parts, with arrows that step it: the S1 apps' time fields.
//
// The Windows app's TimePicker (utilities/timepicker.xaml, TimePicker.cs) and
// the Mac app's time field with its stepper behave alike: hours and minutes
// in parts of their own with the separator between, AM/PM after them on a
// 12-hour clock, and two arrows that step the part that has the focus -- the
// hours when none has -- repeating while held. The arrow keys step the
// focused part too. How it looks is the theme's: the Windows app puts the
// arrows inside the box, the Mac app beside it in a stepper of their own, so
// the box and the arrows are separate elements.
//
// `value` is 'HH:MM' on a 24-hour clock whatever is shown. `clock` is 12 or
// 24; a duration is a 24-hour value with no AM/PM.

const pad = (n) => String(n).padStart(2, '0')

export default function TimeField({ value, onChange, clock = 24, disabled = false, className = '', label = '' }) {
  const [h24, m] = (/^(\d{1,2}):(\d{2})$/.exec(value || '') || [null, '0', '0']).slice(1).map(Number)
  const [field, setField] = useState(null)
  // Each box says which it is, in the reader's language, for a screen reader (and a test)
  // to tell the hour from the minute; the browser knows the words.
  const { language } = useI18n()
  const fieldName = (part) => { try { return new Intl.DisplayNames(language, { type: 'dateTimeField' }).of(part) } catch { return part } }
  const hours = useRef(null)
  const minutes = useRef(null)
  const repeat = useRef(null)
  const twelve = clock === 12
  const pm = h24 >= 12
  const shownHour = twelve ? ((h24 + 11) % 12) + 1 : h24

  const emit = (hour, minute) => onChange?.(`${pad(((hour % 24) + 24) % 24)}:${pad(((minute % 60) + 60) % 60)}`)
  const step = (part, by) => {
    if (part === 'm') emit(h24, m + by)
    else if (part === 'ap') emit(h24 + 12, m)
    else emit(h24 + by, m)
  }
  const arrow = (by) => {
    const part = field || 'h'
    if (!field) { setField('h'); hours.current?.focus() }
    step(part, by)
  }
  const hold = (by) => (event) => {
    event.preventDefault()
    if (disabled) return
    arrow(by)
    clearInterval(repeat.current)
    const started = Date.now()
    repeat.current = setInterval(() => { if (Date.now() - started > 400) arrow(by) }, 80)
  }
  const release = () => clearInterval(repeat.current)
  useEffect(() => release, [])

  const keys = (part) => (event) => {
    if (event.key === 'ArrowUp') { event.preventDefault(); step(part, 1) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); step(part, -1) }
  }
  // Typed digits land when the part is left, as the app's ValidateAndStore
  // does; out of range falls back to what was there.
  const typed = (part) => (event) => {
    const n = Number(event.target.value)
    if (!Number.isInteger(n)) return
    if (part === 'm' && n >= 0 && n < 60) emit(h24, n)
    if (part === 'h' && twelve && n >= 1 && n <= 12) emit((n % 12) + (pm ? 12 : 0), m)
    if (part === 'h' && !twelve && n >= 0 && n < 24) emit(n, m)
  }

  return (
    <span className={`dk-timefield ${className}`} aria-disabled={disabled || undefined} role="group" aria-label={label || undefined}>
      <span className="dk-timefield-box">
        <input ref={hours} className="dk-timefield-part" aria-label={fieldName('hour')} inputMode="numeric" maxLength={2} disabled={disabled}
               key={`h${shownHour}`} defaultValue={twelve ? String(shownHour) : pad(shownHour)}
               onFocus={() => setField('h')} onKeyDown={keys('h')} onBlur={typed('h')} />
        <span className="dk-timefield-sep">:</span>
        <input ref={minutes} className="dk-timefield-part" aria-label={fieldName('minute')} inputMode="numeric" maxLength={2} disabled={disabled}
               key={`m${m}`} defaultValue={pad(m)}
               onFocus={() => setField('m')} onKeyDown={keys('m')} onBlur={typed('m')} />
        {twelve && (
          <button type="button" className="dk-timefield-ampm" disabled={disabled}
                  onFocus={() => setField('ap')} onKeyDown={keys('ap')} onClick={() => step('ap', 1)}>
            {pm ? 'PM' : 'AM'}
          </button>
        )}
      </span>
      <span className="dk-timefield-arrows" aria-hidden="true">
        <button type="button" tabIndex={-1} className="dk-timefield-up" disabled={disabled}
                onMouseDown={hold(1)} onMouseUp={release} onMouseLeave={release} />
        <button type="button" tabIndex={-1} className="dk-timefield-down" disabled={disabled}
                onMouseDown={hold(-1)} onMouseUp={release} onMouseLeave={release} />
      </span>
    </span>
  )
}
