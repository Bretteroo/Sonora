import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as G from './glyphs.jsx'

// The hardware: every control the rack is built from. Each one is a real
// form control underneath -- a knob is a slider with a value, a lever is a
// switch, a key is a button -- so the keyboard and a screen reader get what
// a pointer gets, and the metal is only what it looks like.

// Escape and a press outside close whatever `ref` wraps.
export function useDismiss(ref, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const down = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    // A tick later, so the press that opened it does not close it again.
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

// A rack unit: a faceplate with its ears, four screws and its engraved name.
export function Unit({ name, model = '', className = '', children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`hf-unit ${className}`.trim()} {...rest}>
      <span className="hf-screw hf-screw-tl" aria-hidden="true" />
      <span className="hf-screw hf-screw-tr" aria-hidden="true" />
      <span className="hf-screw hf-screw-bl" aria-hidden="true" />
      <span className="hf-screw hf-screw-br" aria-hidden="true" />
      {(name || model) && (
        <header className="hf-unit-plate">
          {name && <h2 className="hf-unit-name">{name}</h2>}
          {model && <span className="hf-unit-model">{model}</span>}
        </header>
      )}
      {children}
    </Tag>
  )
}

// The glass a display sits behind.
export function Display({ className = '', children, ...rest }) {
  return (
    <div className={`hf-display ${className}`.trim()} {...rest}>
      <div className="hf-display-inner">{children}</div>
    </div>
  )
}

export function Led({ on = false, tone = '', label = '' }) {
  return <span className="hf-led" data-on={on || undefined} data-tone={tone || undefined} aria-hidden={label ? undefined : true} title={label || undefined} />
}

// A push key with its legend engraved beneath (`legend`) or printed on it
// (children), and an LED where the key latches something on.
export function Key({ children, legend = '', label = '', icon = null, onClick, disabled = false, led = null, pressed = null,
                      size = 'md', shape = 'key', tone = '', className = '', type = 'button', ...rest }) {
  const title = label || (typeof children === 'string' ? children : legend) || undefined
  return (
    <span className={`hf-key-wrap hf-key-wrap-${size} ${className}`.trim()}>
      <button type={type} className={`hf-key hf-key-${shape} hf-key-${size}`} disabled={disabled} onClick={onClick}
              aria-label={label || undefined} title={title} aria-pressed={pressed === null ? undefined : Boolean(pressed)}
              data-tone={tone || undefined} data-lit={led || undefined} {...rest}>
        {led !== null && <Led on={Boolean(led)} tone={tone === 'danger' ? 'red' : ''} />}
        {icon}
        {children != null && children !== '' && <span className="hf-key-text">{children}</span>}
      </button>
      {legend && <span className="hf-legend" aria-hidden="true">{legend}</span>}
    </span>
  )
}

// A small square key with a glyph, for rows and panels.
// `led`, when not null, adds a lamp that shows whether the key is latched;
// a key with a lamp says so by the lamp alone and does not sink in.
export function IconKey({ label, onClick, children, disabled = false, active = false, size = 'sm', className = '', badge = null,
                          led = null, tone = '', ...rest }) {
  const lamp = led !== null
  return (
    <button type="button" className={`hf-ikey hf-ikey-${size} ${lamp ? 'hf-ikey-lamp' : ''} ${className}`.replace(/ +/g, ' ').trim()}
            title={label} aria-label={label}
            aria-pressed={lamp ? Boolean(led) : active || undefined} disabled={disabled} onClick={onClick} {...rest}>
      {lamp && <Led on={Boolean(led)} tone={tone === 'danger' ? 'red' : ''} />}
      {children}
      {badge != null && badge !== 0 && <span className="hf-badge">{badge}</span>}
    </button>
  )
}

// A wider plain key, for dialogs and forms.
export function Button({ children, onClick, primary = false, quiet = false, danger = false, disabled = false, small = false,
                         icon = null, className = '', type = 'button', ...rest }) {
  return (
    <button type={type} className={`hf-btn${primary ? ' hf-btn-primary' : ''}${quiet ? ' hf-btn-quiet' : ''}${danger ? ' hf-btn-danger' : ''}${small ? ' hf-btn-small' : ''} ${className}`.trim()}
            disabled={disabled} onClick={onClick} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

// While a control is dragged it reports as it goes, but not faster than
// this, and always once more with the final value on release.
const LIVE_MS = 90
function useThrottledCommit(value, onCommit) {
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
    setLocal(next)
    const since = Date.now() - sent.current.at
    if (since >= LIVE_MS) { send(next); return }
    clearTimeout(sent.current.timer)
    sent.current.timer = setTimeout(() => send(next), LIVE_MS - since)
  }
  // What was let go of stays until the room reports it, past any value between (useHeld).
  const [held, setHeld] = useHeld(value)
  const finish = (last) => {
    setDragging(false)
    const final = last ?? local
    setHeld(final)
    if (final !== sent.current.value) send(final)
  }
  return { shown: dragging ? local : (held ?? value), live, finish, setDragging, dragging, local }
}

// A rotary knob. It turns from seven o'clock to five o'clock (270 degrees);
// dragging up or right turns it up, the wheel turns it a notch at a time,
// and the arrow keys, Page Up/Down, Home and End work as on any slider.
// `detent` draws the center mark that tone controls have.
export function Knob({ value = 0, min = 0, max = 100, step = 1, onCommit, label, size = 'md', disabled = false,
                       detent = false, format = null, className = '', ticks = 11, showValue = false }) {
  const { shown, live, finish, setDragging } = useThrottledCommit(value, onCommit)
  const drag = useRef(null)
  const ref = useRef(null)
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v / step) * step))
  const span = max - min || 1
  const frac = ((shown ?? min) - min) / span
  const angle = -135 + frac * 270
  const text = format ? format(shown) : String(shown)
  const onPointerDown = (event) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    ref.current?.focus()
    ref.current?.setPointerCapture?.(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: shown ?? min, last: shown ?? min }
    setDragging(true)
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    // A full sweep is about 200 pixels of travel, whichever way it goes.
    const moved = (event.clientX - d.x) - (event.clientY - d.y)
    const next = clamp(d.start + (moved / 200) * span)
    if (next !== d.last) { d.last = next; live(next) }
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d) finish(d.last)
  }
  // The wheel is a passive listener in React, so it is bound by hand to be
  // allowed to keep the page from scrolling under the knob.
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const wheel = (event) => {
      if (disabled) return
      event.preventDefault()
      const by = (event.deltaY < 0 || event.deltaX > 0 ? 1 : -1) * step * (span > 40 ? 2 : 1)
      const next = clamp((drag.current?.last ?? shownRef.current ?? min) + by)
      shownRef.current = next
      live(next)
      clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => finish(next), 250)
      setDragging(true)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })
  const shownRef = useRef(shown)
  shownRef.current = shown
  const wheelTimer = useRef(null)
  const onKeyDown = (event) => {
    if (disabled) return
    const big = Math.max(step, Math.round(span / 10))
    const moves = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big }
    let next = null
    if (event.key in moves) next = clamp((shown ?? min) + moves[event.key])
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    event.stopPropagation()
    live(next)
    finish(next)
  }
  const tickMarks = Array.from({ length: ticks }, (_, i) => -135 + (i * 270) / (ticks - 1))
  return (
    <div className={`hf-knob hf-knob-${size} ${className}`.trim()} data-disabled={disabled || undefined}>
      <div ref={ref} className="hf-knob-body" role="slider" tabIndex={disabled ? -1 : 0} aria-label={label}
           aria-valuemin={min} aria-valuemax={max} aria-valuenow={shown ?? min} aria-valuetext={text}
           aria-disabled={disabled || undefined} title={label ? `${label}: ${text}` : text}
           onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
           onKeyDown={onKeyDown} onKeyUp={(event) => event.stopPropagation()}>
        <svg className="hf-knob-scale" viewBox="0 0 100 100" aria-hidden="true">
          {tickMarks.map((a, i) => (
            <line key={i} x1="50" y1="3" x2="50" y2={i === 0 || i === ticks - 1 || (detent && Math.abs(a) < 1) ? 10 : 7.5}
                  transform={`rotate(${a} 50 50)`} className={Math.abs(a) < 1 && detent ? 'hf-knob-detent' : ''} />
          ))}
          {/* Each pip is a target too: pressing one sets the knob to that
              point at once. Keyboard users have Home, End and Page keys. */}
          {!disabled && tickMarks.map((a, i) => {
            const at = clamp(min + (i * span) / (ticks - 1))
            return (
              <circle key={`pip${i}`} className="hf-knob-pip" cx="50" cy="6" r="6" transform={`rotate(${a} 50 50)`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        event.preventDefault(); event.stopPropagation()
                        ref.current?.focus()
                        live(at); finish(at)
                      }}>
                <title>{label ? `${label}: ${format ? format(at) : at}` : String(format ? format(at) : at)}</title>
              </circle>
            )
          })}
          {/* The lit arc runs from the start of the sweep to the pointer, or
              from the center for a control that has one. */}
          <path className="hf-knob-arc" d={arcPath(detent ? 0 : -135, angle)} />
        </svg>
        {/* The cap stays still, as its shadow and the light on it would;
            only the knurled rim and the pointer turn. */}
        <span className="hf-knob-cap">
          <span className="hf-knob-knurl" style={{ transform: `rotate(${angle}deg)` }} />
          <span className="hf-knob-pointer" style={{ transform: `rotate(${angle}deg)` }}><span className="hf-knob-mark" /></span>
        </span>
      </div>
      {showValue && <output className="hf-knob-value">{text}</output>}
    </div>
  )
}
function arcPath(from, to) {
  if (Math.abs(to - from) < 0.5) return ''
  const a0 = Math.min(from, to)
  const a1 = Math.max(from, to)
  const r = 44
  const pt = (a) => {
    const rad = ((a - 90) * Math.PI) / 180
    return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)]
  }
  const [x0, y0] = pt(a0)
  const [x1, y1] = pt(a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

// A slide potentiometer: a range input with a machined cap for a thumb.
export function Fader({ value = 0, min = 0, max = 100, onCommit, label, disabled = false, className = '', vertical = false, format = null, wheelStep = null }) {
  const { shown, live, finish, setDragging } = useThrottledCommit(value, onCommit)
  const pct = Math.max(0, Math.min(100, (((shown ?? min) - min) / ((max - min) || 1)) * 100))
  return (
    <div className={`hf-fader${vertical ? ' hf-fader-v' : ''} ${className}`.trim()} data-disabled={disabled || undefined} style={{ '--hf-pct': `${pct}%` }}>
      <input type="range" min={min} max={max} value={shown ?? min} aria-label={label} disabled={disabled} data-wheel-step={wheelStep || undefined}
             aria-valuetext={format ? format(shown) : `${shown ?? min}`} {...(vertical ? { 'aria-orientation': 'vertical', orient: 'vertical' } : {})}
             onChange={(event) => { setDragging(true); live(Number(event.target.value)) }}
             onPointerUp={(event) => finish(Number(event.currentTarget.value))}
             onKeyUp={(event) => finish(Number(event.currentTarget.value))}
             onBlur={(event) => { if (Number(event.currentTarget.value) !== value) finish(Number(event.currentTarget.value)) }} />
    </div>
  )
}

// A bat-handle toggle switch: up is on.
export function Lever({ checked, onChange, label, disabled = false, hint = '', className = '' }) {
  return (
    <label className={`hf-lever ${className}`.trim()} aria-disabled={disabled || undefined} title={hint || undefined}>
      <input type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="hf-lever-body" aria-hidden="true"><span className="hf-lever-bat" /></span>
      {label && <span className="hf-lever-label">{label}</span>}
    </label>
  )
}

// A slide switch with two or three positions, each named on the panel above
// its stop -- the system selector, a view selector.
export function SlideSwitch({ options, value, onChange, label = '', className = '' }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  // The bar itself answers too: a press lands the thumb on the stop under
  // it, and dragging carries it from stop to stop. The legends above remain
  // the radios a keyboard or a screen reader uses.
  const track = useRef(null)
  const dragging = useRef(false)
  const pick = (clientX) => {
    const box = track.current?.getBoundingClientRect()
    if (!box || !box.width) return
    const at = Math.max(0, Math.min(options.length - 1, Math.floor(((clientX - box.left) / box.width) * options.length)))
    if (options[at].id !== value) onChange(options[at].id)
  }
  return (
    <div className={`hf-slide ${className}`.trim()} role="radiogroup" aria-label={label || undefined} style={{ '--hf-stops': options.length, '--hf-at': index }}>
      <div className="hf-slide-legends">
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={o.id === value} title={o.title || undefined}
                  onClick={() => onChange(o.id)}>{o.icon || o.label}</button>
        ))}
      </div>
      <div ref={track} className="hf-slide-track" aria-hidden="true"
           onPointerDown={(event) => {
             if (event.button !== 0) return
             event.currentTarget.setPointerCapture?.(event.pointerId)
             dragging.current = true
             pick(event.clientX)
           }}
           onPointerMove={(event) => { if (dragging.current) pick(event.clientX) }}
           onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}>
        <span className="hf-slide-thumb" />
      </div>
    </div>
  )
}


// A modal panel: `center` is a dialog, `side` drops in from the right,
// `full` covers the rack. Focus moves in and comes back; Escape closes.
export function Panel({ kind = 'center', title = '', onClose, children, className = '', wide = false }) {
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
    const first = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('button, input, select, [tabindex="0"]')
    first?.focus?.()
    return () => { document.removeEventListener('keydown', key); previous?.focus?.() }
  }, [])
  return createPortal(
    <div className={`hf-layer hf-layer-${kind}`} role="presentation"
         onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <div className={`hf-panel hf-panel-${kind}${wide ? ' hf-panel-wide' : ''} ${className}`.trim()}
           role="dialog" aria-modal="true" aria-label={title || undefined} ref={ref}>
        <span className="hf-screw hf-screw-tl" aria-hidden="true" />
        <span className="hf-screw hf-screw-tr" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function PanelHead({ title, sub = '', onClose, children, back = null }) {
  const { t } = useI18n()
  return (
    <header className="hf-panel-head">
      {back && <IconKey label={t('common.back')} onClick={back}><G.ArrowLeft /></IconKey>}
      <div className="hf-panel-title">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
      {onClose && <IconKey label={t('common.close')} onClick={onClose} className="hf-panel-close"><G.Close /></IconKey>}
    </header>
  )
}

// A menu at a point (a right-click) or hanging from an element.
export function Menu({ x, y, anchor = null, align = 'left', onClose, children, title = '', width = 250, className = '' }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x || 0, top: y || 0 })
  useDismiss(ref, onClose)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x ?? 0
    let top = y ?? 0
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
  useEffect(() => {
    ref.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])
  const onKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = [...(ref.current?.querySelectorAll('button:not(:disabled)') || [])]
    const at = items.indexOf(document.activeElement)
    const next = items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]
    next?.focus()
  }
  return createPortal(
    <div className={`hf-menu ${className}`.trim()} ref={ref} role="menu" style={{ left: pos.left, top: pos.top, width: Math.min(width, window.innerWidth - 16) }}
         onKeyDown={onKeyDown} onContextMenu={(event) => event.preventDefault()}>
      {title && <p className="hf-menu-title">{title}</p>}
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ children, onSelect, disabled = false, icon = null, checked = null, danger = false, note = '' }) {
  return (
    <button type="button" role={checked === null ? 'menuitem' : 'menuitemcheckbox'} className="hf-menu-item"
            aria-checked={checked === null ? undefined : checked} disabled={disabled}
            data-danger={danger || undefined} title={note || undefined}
            onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
      <span className="hf-menu-icon" aria-hidden="true">{checked ? <G.Check /> : icon}</span>
      <span className="hf-menu-label">{children}</span>
    </button>
  )
}
export function MenuSep() { return <hr className="hf-menu-sep" /> }

// A selector drawn by the theme: the same <option> children as a <select>,
// and onChange called with { target: { value } }, so it drops in where one
// was. Firefox draws a native list differently on every platform; this one
// is the rack's own menu, as wide as the field. Both are drawn as amber-lit
// dial glass, the list marking its choice with a lamp.
export function Select({ value, onChange, disabled = false, children, className = '', ...rest }) {
  const [open, setOpen] = useState(null)
  const options = React.Children.toArray(children)
    .filter((child) => child && child.type === 'option')
    .map((child) => ({ value: String(child.props.value ?? ''), label: child.props.children, disabled: Boolean(child.props.disabled) }))
  const current = options.find((o) => o.value === String(value ?? '')) || options[0]
  const pick = (next) => { setOpen(null); if (next !== String(value ?? '')) onChange?.({ target: { value: next } }) }
  const step = (by) => {
    const live = options.filter((o) => !o.disabled)
    const at = live.findIndex((o) => o.value === current?.value)
    const next = live[Math.max(0, Math.min(live.length - 1, at + by))]
    if (next) pick(next.value)
  }
  return (
    <>
      <button type="button" className={`hf-select ${className}`.trim()} disabled={disabled}
              aria-haspopup="listbox" aria-expanded={Boolean(open)} {...rest}
              onClick={(event) => setOpen(open ? null : event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); step(1) }
                else if (event.key === 'ArrowUp') { event.preventDefault(); step(-1) }
              }}>
        <span className="hf-select-label">{current?.label}</span>
        <span className="hf-select-cell" aria-hidden="true"><G.ChevronDown className="hf-select-chev" /></span>
      </button>
      {open && (
        <Menu anchor={open} width={Math.max(180, open.getBoundingClientRect().width)} onClose={() => setOpen(null)} className="hf-menu-amber">
          {options.map((o) => (
            <MenuItem key={o.value} checked={o.value === current?.value} disabled={o.disabled} onSelect={() => pick(o.value)}>{o.label}</MenuItem>
          ))}
        </Menu>
      )}
    </>
  )
}

export function Field({ label, children, hint = '' }) {
  return (
    <div className="hf-field">
      <span className="hf-field-label">{label}</span>
      <div className="hf-field-body">{children}</div>
      {hint && <p className="hf-field-hint">{hint}</p>}
    </div>
  )
}

export function Empty({ icon = null, title, body = '', children }) {
  return (
    <div className="hf-empty">
      {icon && <span className="hf-empty-icon" aria-hidden="true">{icon}</span>}
      <p className="hf-empty-title">{title}</p>
      {body && <p className="hf-empty-body">{body}</p>}
      {children}
    </div>
  )
}

export function Spinner({ label = '' }) {
  return <span className="hf-spinner" role={label ? 'status' : undefined} aria-label={label || undefined}><i /><i /><i /></span>
}

export function Loading({ children }) {
  return <div className="hf-loading"><Spinner />{children}</div>
}

export function Kbd({ children }) { return <kbd className="hf-kbd">{children}</kbd> }

// A question with one action, or a name to type in when `input` is given.
export function Confirm({ title, body, action, cancelLabel, onConfirm, onClose, danger = false, input = null, disabled = false, children }) {
  const { t } = useI18n()
  const [value, setValue] = useState(input?.initial || '')
  const ok = input ? value.trim() && (input.allowSame || value.trim() !== (input.initial || '')) : true
  const submit = () => { if (ok && !disabled) onConfirm(input ? value.trim() : undefined) }
  return (
    <Panel kind="center" title={title} onClose={onClose} className="hf-confirm">
      <PanelHead title={title} onClose={onClose} />
      <div className="hf-panel-body">
        {body && <p className="hf-confirm-body">{body}</p>}
        {input && (
          <input className="hf-input" type="text" value={value} data-autofocus placeholder={input.placeholder || ''}
                 onFocus={(event) => event.target.select()}
                 onChange={(event) => setValue(event.target.value)}
                 onKeyDown={(event) => { if (event.key === 'Enter') submit() }} />
        )}
        {children}
      </div>
      <footer className="hf-panel-foot">
        <Button quiet onClick={onClose}>{cancelLabel || t('common.cancel')}</Button>
        <Button primary danger={danger} disabled={!ok || disabled} onClick={submit}>{action}</Button>
      </footer>
    </Panel>
  )
}

// A small latching key with a word on it: a search category, a duration.
export function Chip({ children, active = false, onClick, icon = null, title = '' }) {
  return (
    <button type="button" className="hf-chip" aria-pressed={active || undefined} onClick={onClick} title={title || undefined}>
      <Led on={active} />{icon}<span>{children}</span>
    </button>
  )
}

// A strip of latching keys: exactly one lit, like a bank of input selectors.
export function KeyBank({ options, value, onChange, label = '', className = '' }) {
  return (
    <div className={`hf-bank ${className}`.trim()} role="tablist" aria-label={label || undefined}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} title={o.title || undefined}
                className="hf-bank-key" onClick={() => onChange(o.id)}>
          <Led on={value === o.id} />
          {o.icon}{o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}
