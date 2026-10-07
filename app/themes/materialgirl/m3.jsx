import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import Art from '../../frontend/src/components/Art.jsx'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import * as I from './icons.jsx'
import { SHAPES, LOADING_SEQUENCE } from './shapes.js'

// Material Girl's component kit, drawn from the Material 3 specification and
// its Expressive update: buttons whose corners square off when pressed,
// button groups whose pressed member widens, split buttons, the FAB and its
// menu, the thick-track slider with its handle gap, the switch with its
// growing thumb, the morphing loading indicator, sheets, dialogs, menus and
// the snackbar. Nothing here knows about Sonos; the sections compose these.

export function cx(...parts) { return parts.filter(Boolean).join(' ') }

// Escape and a press outside close whatever `ref` wraps.
export function useDismiss(ref, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const down = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
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

// --- buttons -----------------------------------------------------------------

// Common buttons: filled, tonal, outlined, text and elevated, in the five
// Expressive sizes. `square` starts them with the square shape instead of
// the round one; either way a press morphs the corners.
export function Button({ children, variant = 'filled', size = 's', icon = null, trailing = null, square = false, selected = null, className = '', type = 'button', ...rest }) {
  return (
    <button type={type} className={cx('mg-btn', `mg-btn-${variant}`, `mg-btn-${size}`, square && 'mg-btn-square', className)}
            aria-pressed={selected === null ? undefined : selected} {...rest}>
      <span className="mg-state" aria-hidden="true" />
      {icon && <span className="mg-btn-icon">{icon}</span>}
      {children != null && children !== '' && <span className="mg-btn-label">{children}</span>}
      {trailing && <span className="mg-btn-icon">{trailing}</span>}
    </button>
  )
}

// Icon buttons in their four colors, three widths and a toggle state. A
// selected toggle takes the filled icon and the round shape.
// Material's plain tooltip, in place of the browser's: inverse surface, 4dp corners, body-small,
// 4dp from what it names, shown after half a second of hover or at once on keyboard focus, never
// for a touch (Android shows those on a long press). Controls carry the text as data-tip; one layer
// in the shell draws it.
export function TooltipLayer() {
  const [tip, setTip] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    let timer = null
    let current = null
    const hide = () => { clearTimeout(timer); current = null; setTip(null) }
    const show = (el) => {
      if (!el.isConnected) return
      const r = el.getBoundingClientRect()
      setTip({ text: el.getAttribute('data-tip'), x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
    }
    const over = (event) => {
      if (event.pointerType === 'touch') return
      const el = event.target.closest?.('[data-tip]')
      if (el === current) return
      hide()
      if (!el || el.disabled) return
      current = el
      timer = setTimeout(() => show(el), 500)
    }
    const out = (event) => { if (current && !current.contains(event.relatedTarget)) hide() }
    const focus = (event) => {
      const el = event.target.closest?.('[data-tip]')
      hide()
      if (el && el.matches(':focus-visible')) { current = el; show(el) }
    }
    const key = (event) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('keydown', key)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('keydown', key)
    }
  }, [])
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!tip || !el) { setPos(null); return }
    const w = el.offsetWidth
    const h = el.offsetHeight
    const below = tip.top - h - 4 < 8
    setPos({
      left: Math.max(8, Math.min(tip.x - w / 2, window.innerWidth - w - 8)),
      top: below ? tip.bottom + 4 : tip.top - h - 4,
    })
  }, [tip])
  if (!tip) return null
  return createPortal(
    <div className="mg-tooltip" role="tooltip" ref={ref}
         style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>{tip.text}</div>,
    document.body,
  )
}

export function IconButton({ label, children, variant = 'standard', size = 's', width = 'default', selected = null, badge = null, className = '', ...rest }) {
  return (
    <button type="button" className={cx('mg-icon-btn', `mg-icon-btn-${variant}`, `mg-icon-btn-${size}`, width !== 'default' && `mg-icon-btn-${width}`, className)}
            aria-label={label} data-tip={label || undefined} aria-pressed={selected === null ? undefined : Boolean(selected)} {...rest}>
      <span className="mg-state" aria-hidden="true" />
      {children}
      {badge != null && badge !== 0 && <span className="mg-badge">{badge > 999 ? '999+' : badge}</span>}
    </button>
  )
}

// A standard button group: its members sit apart, and the one being pressed
// widens while its neighbors give way. `connected` joins them into one
// shape with inner corners, the selected member rounding fully.
export function ButtonGroup({ children, connected = false, className = '', label = '', ...rest }) {
  return (
    <div role="group" aria-label={label || undefined} className={cx('mg-bgroup', connected ? 'mg-bgroup-connected' : 'mg-bgroup-standard', className)} {...rest}>
      {children}
    </div>
  )
}

// A split button: the leading half does the common thing, the trailing half
// opens the rest. The trailing half's chevron turns when its menu is open.
export function SplitButton({ label, icon = null, onClick, menuLabel, children, variant = 'filled', size = 's', disabled = false }) {
  const [open, setOpen] = useState(null)
  return (
    <div className={cx('mg-split', `mg-split-${variant}`, `mg-split-${size}`)} data-open={open ? '' : undefined}>
      <button type="button" className="mg-split-lead" onClick={onClick} disabled={disabled}>
        <span className="mg-state" aria-hidden="true" />
        {icon && <span className="mg-btn-icon">{icon}</span>}
        <span className="mg-btn-label">{label}</span>
      </button>
      <button type="button" className="mg-split-trail" aria-label={menuLabel} data-tip={menuLabel} aria-haspopup="menu" aria-expanded={Boolean(open)}
              disabled={disabled} onClick={(event) => setOpen(open ? null : event.currentTarget.parentElement)}>
        <span className="mg-state" aria-hidden="true" />
        <I.ChevronDown className="mg-split-chev" />
      </button>
      {open && (
        <Menu anchor={open} align="right" onClose={() => setOpen(null)}>
          {typeof children === 'function' ? children(() => setOpen(null)) : children}
        </Menu>
      )}
    </div>
  )
}

// The floating action button, and its extended form with a label.
export function Fab({ icon, label = '', extended = false, size = 'fab', color = 'primary', className = '', ...rest }) {
  return (
    <button type="button" className={cx('mg-fab', `mg-fab-${size}`, `mg-fab-${color}`, extended && 'mg-fab-extended', className)}
            aria-label={label || undefined} data-tip={extended ? undefined : label} {...rest}>
      <span className="mg-state" aria-hidden="true" />
      <span className="mg-fab-icon">{icon}</span>
      {extended && <span className="mg-fab-label">{label}</span>}
    </button>
  )
}

// The FAB menu: the FAB turns into a close button and a short column of
// pill-shaped actions springs out above it, each staggered a beat.
export function FabMenu({ icon, label, items, color = 'primary', extended = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(ref, () => setOpen(false), open)
  const { t } = useI18n()
  return (
    <div className="mg-fabmenu" ref={ref} data-open={open || undefined}>
      {open && (
        <ul className="mg-fabmenu-list" role="menu" aria-label={label}>
          {items.map((item, index) => (
            <li key={item.id} style={{ '--mg-i': items.length - index }}>
              <button type="button" role="menuitem" className="mg-fabmenu-item" disabled={item.disabled}
                      onClick={() => { setOpen(false); item.onSelect() }}>
                <span className="mg-state" aria-hidden="true" />
                <span className="mg-fab-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={cx('mg-fab', 'mg-fab-fab', `mg-fab-${color}`, 'mg-fabmenu-toggle', extended && !open && 'mg-fab-extended')}
              aria-expanded={open} aria-haspopup="menu" aria-label={open ? t('common.close') : label}
              title={open ? t('common.close') : label} onClick={() => setOpen((v) => !v)}>
        <span className="mg-state" aria-hidden="true" />
        <span className="mg-fab-icon">{open ? <I.Close /> : icon}</span>
        {extended && !open && <span className="mg-fab-label">{label}</span>}
      </button>
    </div>
  )
}

// --- chips, switches, segmented buttons ----------------------------------------

export function Chip({ children, selected = null, icon = null, onClick, kind = 'filter', trailing = null, onTrailing = null, trailingLabel = '', disabled = false, title = '' }) {
  return (
    <span className={cx('mg-chip', `mg-chip-${kind}`)} data-selected={selected || undefined} data-disabled={disabled || undefined}>
      <button type="button" className="mg-chip-main" aria-pressed={selected === null ? undefined : Boolean(selected)} onClick={onClick} disabled={disabled} title={title || undefined}>
        <span className="mg-state" aria-hidden="true" />
        {selected ? <span className="mg-chip-icon"><I.Check /></span> : icon && <span className="mg-chip-icon">{icon}</span>}
        <span className="mg-chip-label">{children}</span>
      </button>
      {trailing && (
        <button type="button" className="mg-chip-trail" aria-label={trailingLabel} data-tip={trailingLabel || undefined} onClick={onTrailing} disabled={disabled}>
          <span className="mg-state" aria-hidden="true" />
          {trailing}
        </button>
      )}
    </span>
  )
}

// The switch: a track with an outline when off, a thumb that grows and
// takes a check when on, and grows again under a press.
export function Switch({ checked, onChange, label = '', ariaLabel = '', disabled = false, icons = true }) {
  return (
    <label className="mg-switch" data-disabled={disabled || undefined}>
      {label && <span className="mg-switch-label">{label}</span>}
      <input type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} aria-label={label ? undefined : (ariaLabel || undefined)}
             onChange={(event) => onChange(event.target.checked)} />
      <span className="mg-switch-track" aria-hidden="true">
        <span className="mg-switch-thumb">{icons && (checked ? <I.Check /> : <I.Close />)}</span>
      </span>
    </label>
  )
}

// Segmented buttons: a connected toggle row, one choice at a time. A radio group
// is one tab stop: the chosen segment takes focus, and the arrow keys move the
// choice along it (WAI-ARIA radio group, which the segments' roles promise).
export function Segmented({ options, value, onChange, label = '', dense = false }) {
  const chosen = options.some((o) => o.id === value) ? value : options[0]?.id
  const onKeyDown = (event) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!by) return
    event.preventDefault()
    const at = options.findIndex((o) => o.id === chosen)
    const next = options[(at + by + options.length) % options.length]
    if (!next) return
    onChange(next.id)
    const buttons = event.currentTarget.querySelectorAll('button')
    buttons[options.indexOf(next)]?.focus()
  }
  return (
    <div className={cx('mg-seg', dense && 'mg-seg-dense')} role="radiogroup" aria-label={label || undefined} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button key={option.id} type="button" role="radio" aria-checked={value === option.id} title={option.title || undefined}
                tabIndex={option.id === chosen ? 0 : -1} onClick={() => onChange(option.id)}>
          <span className="mg-state" aria-hidden="true" />
          {option.icon}
          {option.label && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}

// --- the slider ---------------------------------------------------------------

// The Expressive slider: an active track and an inactive one either side of a
// narrow handle, a gap around the handle, a stop dot at the far end, and the
// value in a bubble while it is dragged. `size` is the track's thickness
// class (xs 16px through xl 108px); the larger ones carry an icon inside the
// active track. It follows the pointer while dragging, throttled, and sends
// the last value on release. `value` is what the speaker reports.
const LIVE_MS = 90
export function Slider({ value, onCommit, label, min = 0, max = 100, step = 1, disabled = false, size = 'xs', icon = null, className = '', format = null, vertical = false, wheelStep = null }) {
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
  // The value let go of stays on screen until the room reports it (useHeld).
  const [held, setHeld] = useHeld(value)
  const finish = () => { if (!dragging) return; setDragging(false); setHeld(local); if (local !== sent.current.value) send(local) }
  const shown = dragging ? local : (held ?? value)
  const pct = Math.max(0, Math.min(100, (((shown ?? min) - min) / (max - min)) * 100))
  return (
    <div className={cx('mg-slider', `mg-slider-${size}`, vertical && 'mg-slider-vertical', className)} data-disabled={disabled || undefined}
         data-dragging={dragging || undefined} style={{ '--mg-pct': pct }}>
      <span className="mg-slider-active" aria-hidden="true">{icon && <span className="mg-slider-icon">{icon}</span>}</span>
      <span className="mg-slider-inactive" aria-hidden="true"><span className="mg-slider-stop" /></span>
      <span className="mg-slider-handle" aria-hidden="true"><span className="mg-slider-bubble">{format ? format(shown) : shown}</span></span>
      <input type="range" min={min} max={max} step={step} value={shown ?? min} aria-label={label} disabled={disabled} data-wheel-step={wheelStep || undefined}
             aria-orientation={vertical ? 'vertical' : undefined}
             onChange={(event) => { const next = Number(event.target.value); setDragging(true); setLocal(next); live(next) }}
             onKeyDown={(event) => {
               // A fine-stepped slider (EQ glides in twentieths) still moves a whole step per key.
               if (step >= 1) return
               const by = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[event.key]
               if (by === undefined) return
               event.preventDefault()
               const next = Math.max(min, Math.min(max, Math.round(shown ?? min) + by))
               setDragging(true); setLocal(next); live(next)
             }}
             onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    </div>
  )
}

// --- progress ----------------------------------------------------------------

// The loading indicator: one Expressive shape morphing into the next while it
// turns. `contained` puts it on a tonal disc, as a pull-to-refresh does.
export function Loading({ label = '', contained = false, size = 48 }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return undefined
    // Each morph is a spring of its own, one every 650ms with a quarter turn, as Compose's
    // LoadingIndicator steps; the turning of the whole is mg.css's, 4666ms a revolution.
    const frames = [...LOADING_SEQUENCE, LOADING_SEQUENCE[0]].map((name, i) => ({
      clipPath: SHAPES[name], transform: `rotate(${i * 90}deg)`, easing: 'cubic-bezier(0.42, 1.67, 0.21, 0.9)',
    }))
    const morph = el.animate(frames, { duration: 650 * LOADING_SEQUENCE.length, iterations: Infinity, easing: 'linear' })
    return () => morph.cancel()
  }, [])
  return (
    <span className={cx('mg-loading', contained && 'mg-loading-contained')} style={{ '--mg-size': `${size}px` }}
          role={label ? 'status' : undefined} aria-label={label || undefined}>
      <span className="mg-loading-spin"><span className="mg-loading-shape" ref={ref} style={{ clipPath: SHAPES.cookie9 }} /></span>
    </span>
  )
}

// A skeleton loader: the shape of what is coming, pulsing in a wave from the top left toward the
// bottom right, until it arrives and fades in over it (motion: transitions, Skeleton loaders).
// For content that is loading; Busy stays for an operation in progress.
export function Skeleton({ label = '', rows = 6, kind = 'list' }) {
  const items = Array.from({ length: rows }, (_, i) => i)
  return (
    <div className={cx('mg-skeleton', `mg-skeleton-${kind}`)} role="status" aria-label={label || undefined}>
      {items.map((i) => (
        kind === 'cards'
          ? <span key={i} className="mg-skel-card" style={{ '--i': i }} />
          : (
            <span key={i} className="mg-skel-row" style={{ '--i': i }}>
              <span className="mg-skel-art" />
              <span className="mg-skel-lines"><span className="mg-skel-line" /><span className="mg-skel-line mg-skel-line-short" /></span>
            </span>
          )
      ))}
    </div>
  )
}

export function Busy({ label }) {
  return <div className="mg-busy"><Loading size={36} />{label && <span>{label}</span>}</div>
}

// --- art in a shape --------------------------------------------------------------

export function ShapeArt({ src, shape = SHAPES.squircle, size = 56, fallback = 'note', className = '', children, spin = false, ...rest }) {
  return (
    <span className={cx('mg-shape-art', spin && 'mg-shape-spin', className)} style={{ '--mg-size': `${size}px`, clipPath: shape }} {...rest}>
      <Art src={src} size={size} fallback={fallback} brokenFallback={fallback} />
      {children}
    </span>
  )
}

// --- layers: dialogs, sheets ---------------------------------------------------------

// A layer over the shell. `dialog` is a basic dialog; `side` a modal side
// sheet from the trailing edge (a bottom sheet on a compact window);
// `bottom` a modal bottom sheet with its drag handle; `full` a full-screen
// dialog. Focus moves in and returns; Escape closes; the scrim closes.
const SheetKind = React.createContext('dialog')
// How long each kind of layer takes to leave: a dialog collapses quickly, a sheet slides off.
const EXIT_MS = { dialog: 150, side: 250, bottom: 250, full: 250 }
// A sheet's way out: play the exit, then run what was asked (its own onClose by default). A close
// button inside the sheet goes through it, so the layer leaves the way it came in.
const SheetExit = React.createContext(null)
export function useSheetExit() { return React.useContext(SheetExit) }

export function Sheet({ kind = 'dialog', title = '', onClose, children, className = '', wide = false }) {
  const ref = useRef(null)
  const [exiting, setExiting] = useState(false)
  const leaving = useRef(false)
  const exit = useCallback((then) => {
    if (leaving.current) return
    leaving.current = true
    setExiting(true)
    setTimeout(() => (then || onClose)?.(), EXIT_MS[kind] ?? 150)
  }, [onClose, kind])
  // Focus moves in once, when the sheet opens, and back out when it closes. This ran again on
  // every render (callers pass a new onClose each time), handing focus away and back: a slider
  // in the sheet lost it on its first value and stopped following the drag or the wheel.
  const exitRef = useRef(exit)
  exitRef.current = exit
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); exitRef.current() } }
    document.addEventListener('keydown', key)
    const previous = document.activeElement
    const first = ref.current?.querySelector('[data-autofocus]')
    if (first) first.focus?.()
    else ref.current?.focus?.()
    return () => { document.removeEventListener('keydown', key); previous?.focus?.() }
  }, [])
  return createPortal(
    <div className={cx('mg-layer', `mg-layer-${kind}`)} role="presentation" data-exiting={exiting || undefined}
         onPointerDown={(event) => { if (event.target === event.currentTarget) exit() }}>
      <div className={cx('mg-sheet', `mg-sheet-${kind}`, wide && 'mg-sheet-wide', className)}
           role="dialog" aria-modal="true" aria-label={title || undefined} ref={ref} tabIndex={-1}>
        {(kind === 'bottom' || kind === 'side') && <span className="mg-handle" aria-hidden="true" />}
        <SheetKind.Provider value={kind}><SheetExit.Provider value={exit}>{children}</SheetExit.Provider></SheetKind.Provider>
      </div>
    </div>,
    document.body,
  )
}

// A sheet's top bar: a close or back button, the headline, and any actions.
// Where a header's close goes depends on the layer it heads: a full-screen dialog closes from its
// leading end and confirms at its trailing end; a side or bottom sheet, or a dialog, closes from
// its trailing end, after anything else in the bar (Material's sheet and dialog anatomy).
export function SheetBar({ title, sub = '', onClose = null, back = null, children }) {
  const { t } = useI18n()
  const kind = React.useContext(SheetKind)
  const exit = React.useContext(SheetExit)
  const leadingClose = kind === 'full'
  const close = onClose ? <IconButton label={t('common.close')} onClick={() => (exit ? exit(onClose) : onClose())} className="mg-sheet-close"><I.Close /></IconButton> : null
  return (
    <header className="mg-sheet-bar">
      {back ? <IconButton label={t('common.back')} onClick={back}><I.Back /></IconButton> : leadingClose ? close : null}
      <div className="mg-sheet-titles">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
      {!leadingClose && close}
    </header>
  )
}

// A dialog's dismissing button, which lets the dialog leave as it came.
function ExitButton({ onClose, children }) {
  const exit = React.useContext(SheetExit)
  return <Button variant="text" onClick={() => (exit ? exit(onClose) : onClose?.())}>{children}</Button>
}

// A basic dialog asking one thing, or asking for a name when `input` is set.
export function Confirm({ title, body, action, cancelLabel, onConfirm, onClose, danger = false, input = null, disabled = false, icon = null, children }) {
  const { t } = useI18n()
  const [value, setValue] = useState(input?.initial || '')
  const ok = input ? value.trim() && (input.allowSame || value.trim() !== (input.initial || '')) : true
  const submit = () => { if (ok && !disabled) onConfirm(input ? value.trim() : undefined) }
  return (
    <Sheet kind="dialog" title={title} onClose={onClose} className="mg-confirm">
      {icon && <span className="mg-dialog-icon" aria-hidden="true">{icon}</span>}
      <h2 className="mg-dialog-headline" data-centered={icon ? '' : undefined}>{title}</h2>
      <div className="mg-dialog-body">
        {body && <p>{body}</p>}
        {input && (
          <TextField label={input.label || title} value={value} autoFocus placeholder={input.placeholder || ''}
                     onChange={setValue} onEnter={submit} />
        )}
        {children}
      </div>
      <footer className="mg-dialog-actions">
        <ExitButton onClose={onClose}>{cancelLabel || t('common.cancel')}</ExitButton>
        <Button variant={danger ? 'danger' : 'text'} disabled={!ok || disabled} onClick={submit}>{action}</Button>
      </footer>
    </Sheet>
  )
}

// --- menus -----------------------------------------------------------------------

export function Menu({ x, y, anchor = null, align = 'left', onClose, children, title = '', width = 0 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x || 0, top: y || 0, ready: false, above: false })
  // Dismissed, a menu fades out quickly before it goes.
  const [exiting, setExiting] = useState(false)
  const leave = useCallback(() => { if (exiting) return; setExiting(true); setTimeout(() => onClose?.(), 100) }, [exiting, onClose])
  useDismiss(ref, leave)
  const groups = menuGroups(children)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x ?? 0
    let top = y ?? 0
    let above = false
    if (anchor) {
      const a = anchor.getBoundingClientRect()
      left = align === 'right' ? a.right - rect.width : a.left
      top = a.bottom + 4
      if (top + rect.height > window.innerHeight - 8) { top = Math.max(8, a.top - rect.height - 4); above = true }
    }
    left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8))
    setPos({ left, top, ready: true, above })
  }, [x, y, anchor, align])
  // The menu takes focus when it opens, on its checked item or its first, as Compose's popup
  // does; the arrow keys walk its items and Escape hands focus back to what opened it.
  const items = () => [...(ref.current?.querySelectorAll('[role^="menuitem"]:not(:disabled)') || [])]
  useEffect(() => {
    if (!pos.ready) return
    const list = items()
    ;(list.find((el) => el.getAttribute('aria-checked') === 'true' || el.dataset.checked !== undefined) || list[0])?.focus({ preventScroll: false })
  }, [pos.ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (event) => {
    const list = items()
    const at = list.indexOf(document.activeElement)
    const go = (i) => { event.preventDefault(); list[(i + list.length) % list.length]?.focus() }
    if (event.key === 'ArrowDown') go(at + 1)
    else if (event.key === 'ArrowUp') go(at < 0 ? list.length - 1 : at - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(list.length - 1)
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); leave(); anchor?.focus?.() }
    else if (event.key === 'Tab') { onClose?.() }
  }
  return createPortal(
    <div className="mg-menu" ref={ref} role="menu" data-ready={pos.ready || undefined} data-above={pos.above || undefined} data-exiting={exiting || undefined} onKeyDown={onKeyDown}
         style={{ left: pos.left, top: pos.top, minWidth: width || undefined }}
         data-grouped={groups.length > 1 || undefined}
         onContextMenu={(event) => event.preventDefault()}>
      {groups.length > 1 ? groups.map((group, i) => (
        <div key={i} className="mg-menu-group" role="group">
          {i === 0 && title && <p className="mg-menu-title">{title}</p>}
          {group}
        </div>
      )) : (
        <>
          {title && <p className="mg-menu-title">{title}</p>}
          {children}
        </>
      )}
    </div>,
    document.body,
  )
}

// A menu's items in the groups its separators mark. Material's Expressive menus draw each group as
// a container of its own, 2dp from the next, where a divider used to run.
function menuGroups(children) {
  const flat = []
  const walk = (nodes) => React.Children.forEach(nodes, (child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) walk(child.props.children)
    else if (child !== null && child !== undefined && child !== false && child !== '') flat.push(child)
  })
  walk(children)
  const groups = [[]]
  for (const child of flat) {
    if (React.isValidElement(child) && child.type === MenuSep) { if (groups[groups.length - 1].length) groups.push([]) }
    else groups[groups.length - 1].push(child)
  }
  if (!groups[groups.length - 1].length) groups.pop()
  return groups
}

export function MenuItem({ children, onSelect, disabled = false, icon = null, checked = null, danger = false, note = '', trailing = null }) {
  return (
    <button type="button" role={checked === null ? 'menuitem' : 'menuitemradio'} className="mg-menu-item"
            aria-checked={checked === null ? undefined : checked} disabled={disabled}
            data-danger={danger || undefined} data-checked={checked || undefined} title={note || undefined}
            onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
      <span className="mg-state" aria-hidden="true" />
      <span className="mg-menu-icon" aria-hidden="true">{checked ? <I.Check /> : icon}</span>
      <span className="mg-menu-label">{children}</span>
      {trailing && <span className="mg-menu-trail">{trailing}</span>}
    </button>
  )
}
export function MenuSep() { return <span className="mg-menu-gap" role="separator" /> }

// An exposed dropdown menu: an outlined field that opens a menu of its
// options. It takes <option> children and calls onChange with an event-like
// { target: { value } }, so it drops in where a <select> was.
export function Select({ value, onChange, disabled = false, children, label = '', className = '', ...rest }) {
  const [open, setOpen] = useState(null)
  const options = React.Children.toArray(children).flatMap((child) => (child?.type === 'optgroup' ? React.Children.toArray(child.props.children) : [child]))
    .filter((child) => child && child.type === 'option')
    .map((child) => ({ value: String(child.props.value ?? ''), label: child.props.children, disabled: Boolean(child.props.disabled) }))
  const current = options.find((o) => o.value === String(value ?? '')) || options[0]
  const pick = (next) => { setOpen(null); if (next !== String(value ?? '')) onChange?.({ target: { value: next } }) }
  return (
    <>
      <button type="button" className={cx('mg-select', className)} disabled={disabled} data-open={open ? '' : undefined}
              aria-haspopup="menu" aria-expanded={Boolean(open)} aria-label={label || undefined} {...rest}
              onClick={(event) => setOpen(open ? null : event.currentTarget)}
              onKeyDown={(event) => {
                // The arrows open the choices, as an exposed dropdown does, rather than changing the
                // value unseen.
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(event.currentTarget) }
              }}>
        {label && <span className="mg-select-label">{label}</span>}
        {/* Every option stacked unseen in one grid cell under the chosen one, so the
            field is as wide as its longest choice, the way a native select is:
            "Sonos Windows Desktop" was wrapping in the theme menu. */}
        <span className="mg-select-value">
          {options.map((o) => <span key={o.value} className="mg-select-sizer" aria-hidden="true">{o.label}</span>)}
          <span className="mg-select-current">{current?.label}</span>
        </span>
        <I.ChevronDown className="mg-select-chev" />
      </button>
      {open && (
        <Menu anchor={open} width={open.getBoundingClientRect().width} onClose={() => setOpen(null)}>
          <div className="mg-menu-scroll">
            {options.map((o) => (
              <MenuItem key={o.value} checked={o.value === current?.value} disabled={o.disabled} onSelect={() => pick(o.value)}>{o.label}</MenuItem>
            ))}
          </div>
        </Menu>
      )}
    </>
  )
}

// --- text ---------------------------------------------------------------------------

// An outlined text field whose label floats into the outline once it holds
// something or has focus.
export function TextField({ label, value, onChange, onEnter = null, type = 'text', placeholder = '', autoFocus = false, autoComplete = 'off', className = '', leading = null, trailing = null, disabled = false, name = '' }) {
  const [focus, setFocus] = useState(false)
  // The label floats when the field is focused or holds something; a placeholder shows only then.
  const raised = focus || (value != null && String(value) !== '')
  return (
    <label className={cx('mg-field', className)} data-raised={raised || undefined} data-focus={focus || undefined} data-disabled={disabled || undefined}>
      {leading && <span className="mg-field-lead">{leading}</span>}
      <input type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} data-autofocus={autoFocus || undefined}
             autoComplete={autoComplete} disabled={disabled} name={name || undefined}
             onFocus={(event) => { setFocus(true); if (autoFocus) event.target.select?.() }} onBlur={() => setFocus(false)}
             onChange={(event) => onChange(event.target.value)}
             onKeyDown={(event) => { if (event.key === 'Enter' && onEnter) onEnter() }} />
      <span className="mg-field-label">{label}</span>
      {trailing && <span className="mg-field-trail">{trailing}</span>}
    </label>
  )
}

// The search bar: a full-round field on the container-high surface, leading
// search icon, trailing actions.
export const SearchBar = React.forwardRef(function SearchBar({ value, onChange, placeholder, leading = null, trailing = null, onKeyDown, label }, ref) {
  return (
    <div className="mg-searchbar" role="search">
      <span className="mg-searchbar-lead">{leading || <I.Search />}</span>
      <input ref={ref} type="search" value={value} placeholder={placeholder} aria-label={label || placeholder}
             onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} />
      {trailing && <span className="mg-searchbar-trail">{trailing}</span>}
    </div>
  )
})

// --- lists, empty states ----------------------------------------------------------------

export function Empty({ icon = null, title, body = '', children }) {
  return (
    <div className="mg-empty">
      {icon && <span className="mg-empty-icon" aria-hidden="true" style={{ clipPath: SHAPES.cookie9 }}>{icon}</span>}
      <p className="mg-empty-title">{title}</p>
      {body && <p className="mg-empty-body">{body}</p>}
      {children}
    </div>
  )
}

// One-line to three-line list items, with leading and trailing slots.
export function ListItem({ leading = null, headline, supporting = '', overline = '', trailing = null, onClick, selected = false, disabled = false, className = '', ...rest }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={cx('mg-li', onClick && 'mg-li-action', className)} onClick={onClick}
         data-selected={selected || undefined} disabled={onClick ? disabled : undefined} aria-disabled={!onClick && disabled ? true : undefined} {...rest}>
      {onClick && <span className="mg-state" aria-hidden="true" />}
      {leading && <span className="mg-li-lead">{leading}</span>}
      <span className="mg-li-text">
        {overline && <span className="mg-li-over">{overline}</span>}
        <span className="mg-li-head">{headline}</span>
        {supporting && <span className="mg-li-sup">{supporting}</span>}
      </span>
      {trailing && <span className="mg-li-trail">{trailing}</span>}
    </Tag>
  )
}

// Which system a page shows, as segmented buttons, only when there is an S1
// system and an S2 one to choose between.
export function SystemPicker({ households, value, onChange, all = true, label = '' }) {
  const { t } = useI18n()
  if (!systemChoiceMatters(households)) return null
  const ordered = orderedHouseholds(households)
  const options = [...ordered.map((h) => ({ id: h.id, label: h.generation })), ...(all ? [{ id: 'all', label: t('mg.all') }] : [])]
  return <Segmented dense options={options} value={value || (all ? 'all' : ordered[0]?.id)} onChange={onChange} label={label || t('desk.showSystem')} />
}

// --- snackbars ---------------------------------------------------------------------------

export function Snackbars({ items, onDismiss }) {
  const { t } = useI18n()
  return (
    <div className="mg-snacks" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="mg-snack" data-kind={item.kind || undefined} role="status">
          <div className="mg-snack-text">
            {item.title && <strong>{item.title}</strong>}
            <span>{item.text}</span>
          </div>
          {item.action && <button type="button" className="mg-snack-action" onClick={item.action.run}><span className="mg-state" aria-hidden="true" />{item.action.label}</button>}
          {item.dismissible && <IconButton label={t('common.dismiss')} onClick={() => onDismiss(item)} className="mg-snack-close"><I.Close /></IconButton>}
        </div>
      ))}
    </div>
  )
}

export function Kbd({ children }) { return <kbd className="mg-kbd">{children}</kbd> }
