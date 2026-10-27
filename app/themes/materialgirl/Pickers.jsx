import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as I from './icons.jsx'
import { Sheet, Button, IconButton, TextField, cx, useSheetExit } from './m3.jsx'

// Material 3's time and date pickers: a field that shows the value and, when
// pressed, opens the picker as a dialog. Sizes and color roles are Compose's
// (material3 tokens: TimePickerTokens, TimeInputTokens, DatePickerModalTokens).
//
// A time is 'HH:MM' on a 24-hour clock whatever the dialog shows, and a date
// 'YYYY-MM-DD', the same values the browser's own fields give, so a field can
// stand in for one of those without its caller changing.

const pad = (n) => String(n).padStart(2, '0')
const parseTime = (value) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '')
  return m ? [Number(m[1]) % 24, Number(m[2]) % 60] : [0, 0]
}
const parseDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// 12 or 24: what the caller says, else what the reader's language uses.
function useClock(clock, language) {
  return useMemo(() => clock || (new Intl.DateTimeFormat(language, { hour: 'numeric' }).resolvedOptions().hour12 ? 12 : 24), [clock, language])
}

// AM and PM in the reader's language, from the browser rather than a catalog.
function dayPeriods(language) {
  const of = (hour) => new Intl.DateTimeFormat(language, { hour: 'numeric', hour12: true })
    .formatToParts(new Date(2000, 0, 1, hour)).find((p) => p.type === 'dayPeriod')?.value
  return [of(1) || 'AM', of(13) || 'PM']
}

// The field: an outlined box with the value and a trailing icon, which opens
// the picker. Disabled, it shows the value and opens nothing.
function PickerField({ text, label, icon, disabled, onOpen, className }) {
  return (
    <button type="button" className={cx('mg-time-input', 'mg-picker-field', className)} disabled={disabled}
            aria-label={`${label}: ${text}`} aria-haspopup="dialog" onClick={onOpen}>
      <span>{text}</span>{icon}
    </button>
  )
}

export function TimeField({ value, onChange, clock = null, disabled = false, label = '', className = '' }) {
  const { language } = useI18n()
  const hours = useClock(clock, language)
  const [open, setOpen] = useState(false)
  const [h, m] = parseTime(value)
  // No time yet shows as the browser's own empty field did.
  const text = value
    ? new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', hour12: hours === 12 }).format(new Date(2000, 0, 1, h, m))
    : '--:--'
  return (
    <>
      <PickerField text={text} label={label} icon={<I.Clock />} disabled={disabled} className={className} onOpen={() => setOpen(true)} />
      {open && <TimePicker value={value} clock={hours} title={label}
                           onPick={(next) => { setOpen(false); if (next !== value) onChange?.(next) }}
                           onClose={() => setOpen(false)} />}
    </>
  )
}

export function DateField({ value, onChange, disabled = false, label = '', className = '' }) {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const date = parseDate(value)
  // No date yet shows the reader's own way of writing one, as a hint.
  const text = date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date) : datePattern(language)
  return (
    <>
      <PickerField text={text} label={label} icon={<I.Calendar />} disabled={disabled} className={className} onOpen={() => setOpen(true)} />
      {open && <DatePicker value={value} title={label}
                           onPick={(next) => { setOpen(false); if (next !== value) onChange?.(next) }}
                           onClose={() => setOpen(false)} />}
    </>
  )
}

// --- the time picker -------------------------------------------------------------

// The dial: 256px, its numbers 100px out from the centre, a 48px handle over
// the chosen one on a 2px track from an 8px centre. A 24-hour clock carries a
// second ring inside, 00 and 13-23, as Material's does.
const DIAL = 256
const OUTER = 100
const INNER = 64

function handAt(index, radius) {
  const a = (index / 12) * 2 * Math.PI - Math.PI / 2
  return { x: DIAL / 2 + radius * Math.cos(a), y: DIAL / 2 + radius * Math.sin(a) }
}

function Dial({ part, h, m, twelve, onHour, onMinute, onReleased, label }) {
  const ref = useRef(null)
  const dragging = useRef(false)
  // Where the pointer is on the dial, as the value it points at.
  const read = (event) => {
    const box = ref.current.getBoundingClientRect()
    const x = event.clientX - box.left - box.width / 2
    const y = event.clientY - box.top - box.height / 2
    const turn = ((Math.atan2(y, x) + Math.PI / 2) / (2 * Math.PI) + 1) % 1
    if (part === 'm') return Math.round(turn * 60) % 60
    const step = Math.round(turn * 12) % 12
    if (twelve) return (h >= 12 ? 12 : 0) + step
    const inner = Math.hypot(x, y) * (DIAL / box.width) < (OUTER + INNER) / 2
    return inner ? (step === 0 ? 0 : step + 12) : (step === 0 ? 12 : step)
  }
  const pick = (event) => (part === 'm' ? onMinute(read(event)) : onHour(read(event)))
  // The wheel over the dial turns it: up a step forward, down a step back, a
  // minute or an hour. A 12-hour hour keeps its AM or PM, as a dial's does. A
  // trackpad's run of small deltas is gathered into whole steps. Listened for
  // by hand, since React's wheel listener cannot stop the page scrolling.
  const latest = useRef({ part, h, m, twelve, onHour, onMinute })
  latest.current = { part, h, m, twelve, onHour, onMinute }
  useEffect(() => {
    const el = ref.current
    let gathered = 0
    const wheel = (event) => {
      event.preventDefault()
      gathered += event.deltaMode === 0 ? event.deltaY : event.deltaY * 40
      if (Math.abs(gathered) < 40) return
      const by = gathered < 0 ? 1 : -1
      gathered = 0
      const now = latest.current
      if (now.part === 'm') now.onMinute((now.m + by + 60) % 60)
      else if (now.twelve) now.onHour((now.h >= 12 ? 12 : 0) + ((now.h % 12) + by + 12) % 12)
      else now.onHour((now.h + by + 24) % 24)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  let labels, selected, radius
  if (part === 'm') {
    labels = Array.from({ length: 12 }, (_, i) => ({ text: pad(i * 5), index: i, radius: OUTER, on: m === i * 5 }))
    selected = m / 5
    radius = OUTER
  } else if (twelve) {
    labels = Array.from({ length: 12 }, (_, i) => ({ text: String(i === 0 ? 12 : i), index: i, radius: OUTER, on: h % 12 === i }))
    selected = h % 12
    radius = OUTER
  } else {
    labels = [
      ...Array.from({ length: 12 }, (_, i) => ({ text: String(i === 0 ? 12 : i), index: i, radius: OUTER, on: h === (i === 0 ? 12 : i) })),
      ...Array.from({ length: 12 }, (_, i) => ({ text: i === 0 ? '00' : String(i + 12), index: i, radius: INNER, on: h === (i === 0 ? 0 : i + 12), inner: true })),
    ]
    selected = h % 12
    radius = h === 0 || h > 12 ? INNER : OUTER
  }
  const end = handAt(selected, radius)
  const angle = (selected / 12) * 360 - 90
  return (
    <div className="mg-tp-dial" ref={ref} role="group" aria-label={label}
         onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); pick(event) }}
         onPointerMove={(event) => { if (dragging.current) pick(event) }}
         onPointerUp={() => { if (dragging.current) { dragging.current = false; onReleased() } }}
         onPointerCancel={() => { dragging.current = false }}>
      <span className="mg-tp-track" style={{ width: radius, transform: `rotate(${angle}deg)` }} />
      <span className="mg-tp-centre" />
      <span className="mg-tp-handle" style={{ left: end.x, top: end.y }}>
        {part === 'm' && m % 5 !== 0 && <i />}
      </span>
      {labels.map((l) => {
        const at = handAt(l.index, l.radius)
        return <span key={`${l.inner ? 'i' : 'o'}${l.index}`} className="mg-tp-num" data-on={l.on || undefined} data-inner={l.inner || undefined}
                     style={{ left: at.x, top: at.y }} aria-hidden="true">{l.text}</span>
      })}
    </div>
  )
}

function Period({ h, onChange, periods }) {
  return (
    <div className="mg-tp-period" role="radiogroup">
      {periods.map((label, i) => (
        <button key={label} type="button" role="radio" aria-checked={(h >= 12) === (i === 1)}
                onClick={() => onChange(i === 1 ? (h % 12) + 12 : h % 12)}>{label}</button>
      ))}
    </div>
  )
}

// A number box in the time's own field: a selector to press in the dial's
// mode, a field to type in when typing.
function NumberBox({ value, max, min, onChange, onEnter, label, autoFocus }) {
  const [text, setText] = useState(pad(value))
  useEffect(() => { setText(pad(value)) }, [value])
  return (
    <label className="mg-tp-field">
      <input className="mg-tp-box" inputMode="numeric" maxLength={2} value={text} aria-label={label}
             data-autofocus={autoFocus || undefined}
             onFocus={(event) => event.target.select()}
             onChange={(event) => {
               const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
               setText(digits)
               const n = Number(digits)
               if (digits && n >= min && n <= max) onChange(n)
             }}
             onBlur={() => setText(pad(value))}
             onKeyDown={(event) => {
               if (event.key === 'Enter') onEnter()
               else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                 event.preventDefault()
                 const span = max - min + 1
                 onChange(((value - min + (event.key === 'ArrowUp' ? 1 : -1) + span) % span) + min)
               }
             }} />
      <small>{label}</small>
    </label>
  )
}

export function TimePicker({ value, clock = 24, title = '', onPick, onClose }) {
  const { t, language } = useI18n()
  const [initialH, initialM] = parseTime(value)
  const [h, setH] = useState(initialH)
  const [m, setM] = useState(initialM)
  const [part, setPart] = useState('h')
  const [typing, setTyping] = useState(false)
  const twelve = clock === 12
  const periods = useMemo(() => dayPeriods(language), [language])
  const shownHour = twelve ? ((h + 11) % 12) + 1 : h
  const done = () => onPick(`${pad(h)}:${pad(m)}`)
  const heading = typing ? t('mg.picker.enterTime') : t('mg.picker.selectTime')
  // Switching modes takes the focus to the hour, as the dialog's opening does.
  const row = useRef(null)
  const switched = useRef(false)
  useEffect(() => {
    if (switched.current) row.current?.querySelector('input, button')?.focus()
    switched.current = true
  }, [typing])
  const step = (event, which) => {
    // The arrow keys step the selector that has the focus, as the dial would.
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const by = event.key === 'ArrowUp' ? 1 : -1
    if (which === 'm') setM((v) => (v + by + 60) % 60)
    else setH((v) => (v + by + 24) % 24)
  }
  return (
    <Sheet kind="dialog" title={title || heading} onClose={onClose} className="mg-tp" >
      <p className="mg-tp-head">{heading}</p>
      <div className="mg-tp-row" ref={row} data-typing={typing || undefined}>
        {typing ? (
          <>
            <NumberBox value={shownHour} min={twelve ? 1 : 0} max={twelve ? 12 : 23} label={t('mg.picker.hour')} autoFocus
                       onChange={(n) => setH(twelve ? (n % 12) + (h >= 12 ? 12 : 0) : n)} onEnter={done} />
            <span className="mg-tp-colon" aria-hidden="true">:</span>
            <NumberBox value={m} min={0} max={59} label={t('mg.picker.minute')} onChange={setM} onEnter={done} />
          </>
        ) : (
          <>
            <button type="button" className="mg-tp-box" data-on={part === 'h' || undefined} data-autofocus
                    aria-label={`${t('mg.picker.hour')} ${shownHour}`} aria-pressed={part === 'h'}
                    onClick={() => setPart('h')} onKeyDown={(event) => step(event, 'h')}>{twelve ? String(shownHour).padStart(2, '0') : pad(h)}</button>
            <span className="mg-tp-colon" aria-hidden="true">:</span>
            <button type="button" className="mg-tp-box" data-on={part === 'm' || undefined}
                    aria-label={`${t('mg.picker.minute')} ${m}`} aria-pressed={part === 'm'}
                    onClick={() => setPart('m')} onKeyDown={(event) => step(event, 'm')}>{pad(m)}</button>
          </>
        )}
        {twelve && <Period h={h} periods={periods} onChange={setH} />}
      </div>
      {!typing && (
        <Dial part={part} h={h} m={m} twelve={twelve} label={part === 'm' ? t('mg.picker.minute') : t('mg.picker.hour')}
              onHour={setH} onMinute={setM} onReleased={() => setPart((p) => (p === 'h' ? 'm' : p))} />
      )}
      <PickerActions done={done} onClose={onClose}
                     mode={<IconButton label={typing ? t('mg.picker.toDial') : t('mg.picker.toInput')} onClick={() => setTyping((v) => !v)}>
                       {typing ? <I.Clock /> : <I.Keyboard />}
                     </IconButton>} />
    </Sheet>
  )
}

// Cancel and OK at the foot of a picker, the mode switch at its start. Cancel
// leaves as the dialog came; OK takes the value first.
function PickerActions({ mode = null, done, onClose }) {
  const { t } = useI18n()
  const exit = useSheetExit()
  return (
    <footer className="mg-tp-actions">
      {mode}
      <span className="mg-grow" />
      <Button variant="text" onClick={() => (exit ? exit(onClose) : onClose())}>{t('common.cancel')}</Button>
      <Button variant="text" onClick={() => (exit ? exit(done) : done())}>{t('common.ok')}</Button>
    </footer>
  )
}

// --- the date picker -------------------------------------------------------------

// The first day of the reader's week: the browser knows it where it says so,
// and failing that Sunday for the languages whose calendars open on one.
function firstDay(language) {
  try {
    const loc = new Intl.Locale(language)
    const info = loc.getWeekInfo?.() || loc.weekInfo
    if (info?.firstDay) return info.firstDay % 7
  } catch { /* an old browser */ }
  return /^(en-US|ja|ko|zh|pt-BR|he)/.test(language) ? 0 : 1
}

// How the reader writes a date in figures (the order of day, month and year),
// for typing one, and that order as a hint: mm/dd/yyyy, dd.mm.yyyy.
function dateOrder(language) {
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(2000, 10, 22)).filter((p) => p.type !== 'literal').map((p) => p.type)
}
function datePattern(language) {
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(2000, 10, 22))
    .map((p) => ({ year: 'yyyy', month: 'mm', day: 'dd' }[p.type] ?? p.value)).join('')
}

export function DatePicker({ value, title = '', onPick, onClose }) {
  const { t, language } = useI18n()
  const today = useMemo(() => new Date(), [])
  const [picked, setPicked] = useState(() => parseDate(value) || today)
  const [view, setView] = useState(() => new Date(picked.getFullYear(), picked.getMonth(), 1))
  const [years, setYears] = useState(false)
  const [typing, setTyping] = useState(false)
  const [focus, setFocus] = useState(picked)
  const grid = useRef(null)
  const start = firstDay(language)
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'narrow' })
  const days = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2023, 0, 1 + ((start + i) % 7))))
  const monthTitle = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(view)
  const headline = new Intl.DateTimeFormat(language, { weekday: 'short', month: 'short', day: 'numeric' }).format(picked)
  const lead = (view.getDay() - start + 7) % 7
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]
  const done = () => onPick(isoDate(picked))
  const heading = typing ? t('mg.picker.enterDate') : t('mg.picker.selectDate')

  // The keyboard moves through the month as a grid: a day, a week, a month.
  const move = (to) => {
    setFocus(to)
    if (to.getMonth() !== view.getMonth() || to.getFullYear() !== view.getFullYear()) setView(new Date(to.getFullYear(), to.getMonth(), 1))
  }
  useEffect(() => {
    grid.current?.querySelector(`[data-day="${isoDate(focus)}"]`)?.focus?.({ preventScroll: true })
  }, [focus, view])
  const onKey = (event) => {
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (by) { event.preventDefault(); move(new Date(focus.getFullYear(), focus.getMonth(), focus.getDate() + by)) }
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      move(new Date(focus.getFullYear(), focus.getMonth() + (event.key === 'PageUp' ? -1 : 1), Math.min(focus.getDate(), 28)))
    }
  }

  return (
    <Sheet kind="dialog" title={title || heading} onClose={onClose} className="mg-dp">
      <header className="mg-dp-head">
        <p>{heading}</p>
        <div>
          <h2>{headline}</h2>
          <IconButton label={typing ? t('mg.picker.toCalendar') : t('mg.picker.toInput')} onClick={() => setTyping((v) => !v)}>
            {typing ? <I.Calendar /> : <I.Edit />}
          </IconButton>
        </div>
      </header>
      {typing ? (
        <DateTyping picked={picked} language={language} onDate={(d) => { setPicked(d); setView(new Date(d.getFullYear(), d.getMonth(), 1)); setFocus(d) }} onEnter={done} />
      ) : (
        <>
          <div className="mg-dp-month">
            <button type="button" className="mg-dp-monthname" aria-expanded={years} aria-label={`${monthTitle}, ${t('mg.picker.chooseYear')}`}
                    onClick={() => setYears((v) => !v)}>
              {monthTitle}<I.ChevronDown className={cx('mg-dp-caret', years && 'mg-dp-caret-up')} />
            </button>
            {!years && (
              <span>
                <IconButton label={t('mg.picker.prevMonth')} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><I.Chevron className="mg-dp-prev" /></IconButton>
                <IconButton label={t('mg.picker.nextMonth')} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><I.Chevron /></IconButton>
              </span>
            )}
          </div>
          {years ? (
            <YearGrid year={view.getFullYear()} current={today.getFullYear()}
                      onYear={(y) => { setView(new Date(y, view.getMonth(), 1)); setYears(false) }} />
          ) : (
            <div className="mg-dp-grid" ref={grid} role="grid" aria-label={monthTitle} onKeyDown={onKey}>
              {days.map((d, i) => <span key={`w${i}`} className="mg-dp-wd" aria-hidden="true">{d}</span>)}
              {cells.map((d, i) => (d ? (
                <button key={isoDate(d)} type="button" className="mg-dp-day" data-day={isoDate(d)}
                        data-today={sameDay(d, today) || undefined} aria-current={sameDay(d, today) ? 'date' : undefined}
                        aria-selected={sameDay(d, picked)} tabIndex={sameDay(d, focus) ? 0 : -1}
                        aria-label={new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(d)}
                        onClick={() => { setPicked(d); setFocus(d) }}>
                  <span>{d.getDate()}</span>
                </button>
              ) : <span key={`b${i}`} />))}
            </div>
          )}
        </>
      )}
      <PickerActions done={done} onClose={onClose} />
    </Sheet>
  )
}

// The years, three to a row, the shown one filled and this year outlined, a
// hundred either side of this one, opened on the shown one.
function YearGrid({ year, current, onYear }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' }) }, [])
  const list = Array.from({ length: 201 }, (_, i) => current - 100 + i)
  return (
    <div className="mg-dp-years" ref={ref} role="listbox">
      {list.map((y) => (
        <button key={y} type="button" role="option" className="mg-dp-year" aria-selected={y === year}
                data-today={y === current || undefined} onClick={() => onYear(y)}>{y}</button>
      ))}
    </div>
  )
}

// Typing a date: one field in the reader's own order of day, month and year.
function DateTyping({ picked, language, onDate, onEnter }) {
  const { t } = useI18n()
  const order = useMemo(() => dateOrder(language), [language])
  const shown = new Intl.DateTimeFormat(language, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const [text, setText] = useState(shown.format(picked))
  const pattern = datePattern(language)
  return (
    <div className="mg-dp-typing">
      <TextField label={t('mg.picker.date')} value={text} placeholder={pattern} autoFocus onEnter={onEnter}
                 onChange={(next) => {
                   setText(next)
                   const parts = next.split(/\D+/).filter(Boolean).map(Number)
                   if (parts.length !== 3) return
                   const at = Object.fromEntries(order.map((p, i) => [p, parts[i]]))
                   const d = new Date(at.year, at.month - 1, at.day)
                   if (at.year > 999 && d.getMonth() === at.month - 1 && d.getDate() === at.day) onDate(d)
                 }} />
    </div>
  )
}
