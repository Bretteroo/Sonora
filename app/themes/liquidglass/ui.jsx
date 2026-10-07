import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import * as I from './icons.jsx'

// Sonofuture's interface primitives: the modal sheet, the anchored menu, the
// slider, the segmented control and the small pieces the sections share.
// They are drawn from the theme's tokens and know nothing about Sonos.

// Escape and a pointer press outside close whatever `ref` wraps.
export function useDismiss(ref, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const down = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    // Deferred by a tick so the press that opened the menu does not close it.
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', down)
      document.addEventListener('keydown', key)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [ref, onClose, enabled])
}

// A layer over the page: `side` slides in from the right, `center` is a
// dialog, `full` covers the shell (the stage). Focus moves in, Escape closes.
export function Sheet({ kind = 'center', title = '', onClose, children, className = '', wide = false, labeledBy = '' }) {
  const ref = useRef(null)
  // Focus moves in once, when it opens, and back out when it closes. This ran again on every
  // render (callers pass a new onClose each time), handing focus away and back: a slider inside
  // lost it on its first value and stopped following the drag or the wheel.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); closeRef.current?.() } }
    document.addEventListener('keydown', key)
    const previous = document.activeElement
    ref.current?.querySelector('[data-autofocus]')?.focus?.()
    return () => { document.removeEventListener('keydown', key); previous?.focus?.() }
  }, [])
  return createPortal(
    <div className={`sf-layer sf-layer-${kind}`} role="presentation"
         onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <div className={`sf-sheet sf-sheet-${kind}${wide ? ' sf-sheet-wide' : ''} ${className}`.trim()}
           role="dialog" aria-modal="true" aria-label={title || undefined} aria-labelledby={labeledBy || undefined} ref={ref}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function SheetHeader({ title, sub = '', onClose, children, back = null }) {
  const { t } = useI18n()
  return (
    <header className="sf-sheet-head">
      {back && (
        <IconButton label={t('common.back')} onClick={back}><I.ArrowLeft /></IconButton>
      )}
      <div className="sf-sheet-title">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
      {onClose && <IconButton label={t('common.close')} onClick={onClose}><I.Close /></IconButton>}
    </header>
  )
}

// A menu anchored at a point (a right-click) or under an element.
export function Menu({ x, y, anchor = null, align = 'left', onClose, children, title = '', width = 240 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x || 0, top: y || 0 })
  useDismiss(ref, onClose)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (anchor) {
      const a = anchor.getBoundingClientRect()
      left = align === 'right' ? a.right - rect.width : a.left
      top = a.bottom + 6
      if (top + rect.height > window.innerHeight - 8) top = Math.max(8, a.top - rect.height - 6)
    }
    left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8))
    setPos({ left, top })
  }, [x, y, anchor, align])
  return createPortal(
    <div className="sf-menu" ref={ref} role="menu" style={{ left: pos.left, top: pos.top, width }}
         onContextMenu={(event) => event.preventDefault()}>
      {title && <p className="sf-menu-title">{title}</p>}
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ children, onSelect, disabled = false, icon = null, checked = null, danger = false, note = '' }) {
  return (
    <button type="button" role={checked === null ? 'menuitem' : 'menuitemcheckbox'} className="sf-menu-item"
            aria-checked={checked === null ? undefined : checked} disabled={disabled}
            data-danger={danger || undefined} title={note || undefined}
            onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
      <span className="sf-menu-icon" aria-hidden="true">
        {checked ? <I.Check /> : icon}
      </span>
      <span className="sf-menu-label">{children}</span>
    </button>
  )
}
// A dropdown drawn by the theme rather than the browser. Firefox lays out an
// open <select>'s list differently on each platform, and on Linux its hover
// bar stopped well short of the list's right edge, with the arrow against
// the field's end (2026-09-28). This takes the same <option> children
// and calls onChange with { target: { value } }, so it drops in where a
// <select> was. The list is the theme's own menu, as wide as the field.
export function Select({ value, onChange, disabled = false, children, className = '', ...rest }) {
  const [open, setOpen] = useState(null)
  const options = React.Children.toArray(children)
    .filter((child) => child && child.type === 'option')
    .map((child) => ({ value: String(child.props.value ?? ''), label: child.props.children, disabled: Boolean(child.props.disabled) }))
  const current = options.find((o) => o.value === String(value ?? '')) || options[0]
  const pick = (next) => { setOpen(null); if (next !== String(value ?? '')) onChange?.({ target: { value: next } }) }
  // Up and down step the choice while the list is shut, as a select's do.
  const step = (by) => {
    const live = options.filter((o) => !o.disabled)
    const at = live.findIndex((o) => o.value === current?.value)
    const next = live[Math.max(0, Math.min(live.length - 1, at + by))]
    if (next) pick(next.value)
  }
  return (
    <>
      <button type="button" className={`sf-select sf-select-btn ${className}`.trim()} disabled={disabled}
              aria-haspopup="listbox" aria-expanded={Boolean(open)} {...rest}
              onClick={(event) => setOpen(open ? null : event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); step(1) }
                else if (event.key === 'ArrowUp') { event.preventDefault(); step(-1) }
              }}>
        <span className="sf-select-label">{current?.label}</span>
        <I.ChevronDown className="sf-select-chev" />
      </button>
      {open && (
        <Menu anchor={open} width={open.getBoundingClientRect().width} onClose={() => setOpen(null)}>
          {options.map((o) => (
            <MenuItem key={o.value} checked={o.value === current?.value} disabled={o.disabled} onSelect={() => pick(o.value)}>
              {o.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  )
}

export function MenuSep() { return <hr className="sf-menu-sep" /> }

export function IconButton({ label, onClick, children, active = false, disabled = false, size = 'md', className = '', badge = null, tone = '', ...rest }) {
  return (
    <button type="button" className={`sf-icon-btn sf-icon-btn-${size} ${className}`.trim()} title={label} aria-label={label}
            aria-pressed={active || undefined} disabled={disabled} data-tone={tone || undefined} onClick={onClick} {...rest}>
      {children}
      {badge != null && badge !== 0 && <span className="sf-badge">{badge}</span>}
    </button>
  )
}

export function Button({ children, onClick, primary = false, quiet = false, disabled = false, small = false, icon = null, className = '', type = 'button', ...rest }) {
  return (
    <button type={type} className={`sf-btn${primary ? ' sf-btn-primary' : ''}${quiet ? ' sf-btn-quiet' : ''}${small ? ' sf-btn-small' : ''} ${className}`.trim()}
            disabled={disabled} onClick={onClick} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

// The volume slider: follows the pointer while dragging, throttled, and sends
// the final value on release. `value` is what the speaker reports.
const LIVE_MS = 90
export function Slider({ value, onCommit, label, max = 100, disabled = false, className = '', fine = false }) {
  const [local, setLocal] = useState(value)
  const [dragging, setDragging] = useState(false)
  const sent = useRef({ at: 0, value, timer: null })
  useEffect(() => { if (!dragging) setLocal(value) }, [value, dragging])
  useEffect(() => () => clearTimeout(sent.current.timer), [])
  const send = (next) => {
    clearTimeout(sent.current.timer)
    sent.current = { at: Date.now(), value: next, timer: null }
    onCommit(next)
  }
  const live = (next) => {
    const since = Date.now() - sent.current.at
    if (since >= LIVE_MS) { send(next); return }
    clearTimeout(sent.current.timer)
    sent.current.timer = setTimeout(() => send(next), LIVE_MS - since)
  }
  const finish = () => { if (!dragging) return; setDragging(false); if (local !== sent.current.value) send(local) }
  const shown = dragging ? local : value
  const pct = Math.max(0, Math.min(100, ((shown ?? 0) / max) * 100))
  return (
    <div className={`sf-slider${fine ? ' sf-slider-fine' : ''} ${className}`.trim()} data-disabled={disabled || undefined} style={{ '--sf-pct': `${pct}%` }}>
      <input type="range" min={0} max={max} value={shown ?? 0} aria-label={label} disabled={disabled} data-wheel-step="2"
             aria-valuetext={`${shown ?? 0}`}
             onChange={(event) => { const next = Number(event.target.value); setDragging(true); setLocal(next); live(next) }}
             onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    </div>
  )
}

export function Segmented({ options, value, onChange, label = '' }) {
  return (
    <div className="sf-segmented" role="tablist" aria-label={label || undefined}>
      {options.map((option) => (
        <button key={option.id} type="button" role="tab" aria-selected={value === option.id}
                onClick={() => onChange(option.id)} title={option.title || undefined}>
          {option.icon}{option.label && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}

export function Chip({ children, active = false, onClick, icon = null, title = '' }) {
  return (
    <button type="button" className="sf-chip" aria-pressed={active || undefined} onClick={onClick} title={title || undefined}>
      {icon}{children}
    </button>
  )
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className="sf-toggle" aria-disabled={disabled || undefined}>
      <input type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="sf-toggle-track" aria-hidden="true"><span className="sf-toggle-knob" /></span>
      {label && <span className="sf-toggle-label">{label}</span>}
    </label>
  )
}

export function Field({ label, children, hint = '' }) {
  return (
    <div className="sf-field">
      <span className="sf-field-label">{label}</span>
      <div className="sf-field-body">{children}</div>
      {hint && <p className="sf-field-hint">{hint}</p>}
    </div>
  )
}

export function Empty({ icon = null, title, body = '', children }) {
  return (
    <div className="sf-empty">
      {icon && <span className="sf-empty-icon" aria-hidden="true">{icon}</span>}
      <p className="sf-empty-title">{title}</p>
      {body && <p className="sf-empty-body">{body}</p>}
      {children}
    </div>
  )
}

export function Spinner({ label = '' }) {
  return <span className="sf-spinner" role={label ? 'status' : undefined} aria-label={label || undefined} />
}

export function Kbd({ children }) { return <kbd className="sf-kbd">{children}</kbd> }

// A question with one action, or a name to type when `input` is given.
export function Confirm({ title, body, action, cancelLabel, onConfirm, onClose, danger = false, input = null, disabled = false, children }) {
  const { t } = useI18n()
  const [value, setValue] = useState(input?.initial || '')
  const ok = input ? value.trim() && (input.allowSame || value.trim() !== (input.initial || '')) : true
  const submit = () => { if (ok && !disabled) onConfirm(input ? value.trim() : undefined) }
  return (
    <Sheet kind="center" title={title} onClose={onClose} className="sf-confirm">
      <SheetHeader title={title} onClose={onClose} />
      <div className="sf-sheet-body">
        {body && <p className="sf-confirm-body">{body}</p>}
        {input && (
          <input className="sf-input" type="text" value={value} data-autofocus placeholder={input.placeholder || ''}
                 onFocus={(event) => event.target.select()}
                 onChange={(event) => setValue(event.target.value)}
                 onKeyDown={(event) => { if (event.key === 'Enter') submit() }} />
        )}
        {children}
      </div>
      <footer className="sf-sheet-foot">
        <Button quiet onClick={onClose}>{cancelLabel || t('common.cancel')}</Button>
        <Button primary disabled={!ok || disabled} onClick={submit} className={danger ? 'sf-btn-danger' : ''}>{action}</Button>
      </footer>
    </Sheet>
  )
}

// Household tabs, shown only when there is an S1 system and an S2 one: a
// house on one generation has nothing to choose between.
export function SystemTabs({ households, value, onChange }) {
  if (!systemChoiceMatters(households)) return null
  return (
    <Segmented options={households.map((h) => ({ id: h.id, label: h.generation }))} value={value} onChange={onChange} />
  )
}

// Which system the page shows. The rail carries this on a wide screen; on a
// phone the rail is a navigation bar with no room for it, so it sits at the
// top of Home, Library and Rooms instead and the stylesheet shows whichever
// copy belongs to the width.
export function SystemPicker({ households, value, onChange, label = '', allLabel = '' }) {
  const ordered = orderedHouseholds(households)
  if (!systemChoiceMatters(households)) return null
  const options = [...ordered.map((h) => ({ id: h.id, label: h.generation })), { id: 'all', label: allLabel }]
  return (
    <div className="sf-page-systems" role="radiogroup" aria-label={label || undefined}>
      {options.map((opt) => (
        <button key={opt.id} type="button" role="radio" aria-checked={(value || 'all') === opt.id}
                onClick={() => onChange(opt.id)}>{opt.label}</button>
      ))}
    </div>
  )
}
