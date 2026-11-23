import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { rectOf, viewW, viewH, overlayRoot } from './layout.js'
import * as G from './glyphs.jsx'

// What the machine's song-select pages are drawn with: round keys with a
// hard shadow under them, pill switches, round-ended bars for anything with
// a level, menus and windows as cards with a colored band for the title, and
// a ribbon for messages. Nothing here knows about Sonos; the programs
// compose these.

export function cx(...parts) { return parts.filter(Boolean).join(' ') }

// Escape and a press outside close whatever `ref` wraps. The listeners stay put for as long as it
// is open and call whatever `onClose` is current: put back each time the caller drew a new one,
// they could be taken off in the middle of the very Escape that was to close it (the machine's own
// keys answer Escape first and redraw the screen, and Chrome and Safari draw it before the next
// listener runs), and a listener put on mid-event never hears that event.
export function useDismiss(ref, onClose, enabled = true) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!enabled) return undefined
    const down = (event) => { if (ref.current && !ref.current.contains(event.target)) close.current() }
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close.current() } }
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', down)
      document.addEventListener('keydown', key)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [ref, enabled])
}

// --- the screen ----------------------------------------------------------------------

// A key. `line` is the plain card color, `solid` the yellow of the one to press, `text` bare words.
// No key of the machine is ever shown switched off: one with nothing to do keeps its look and its
// press, and the press does nothing. It is still said to be unavailable to a screen reader.
export function idle(off, onClick) {
  if (!off) return { onClick }
  return { 'aria-disabled': true, onClick: (event) => { event.preventDefault(); event.stopPropagation() } }
}

export function Btn({ children, variant = 'line', size = 'm', icon = null, trailing = null, className = '', type = 'button', selected = null, disabled = false, onClick, ...rest }) {
  return (
    <button type={type} className={cx('km-btn', `km-btn-${variant}`, `km-btn-${size}`, className)}
            aria-pressed={selected === null ? undefined : Boolean(selected)} {...rest} {...idle(disabled, onClick)}>
      {icon && <span className="km-btn-icon" aria-hidden="true">{icon}</span>}
      {children != null && children !== '' && <span className="km-btn-label">{children}</span>}
      {trailing && <span className="km-btn-icon" aria-hidden="true">{trailing}</span>}
    </button>
  )
}

// A glyph alone on a round key.
export function IconBtn({ label, children, selected = null, badge = null, className = '', size = 'm', disabled = false, onClick, ...rest }) {
  return (
    <button type="button" className={cx('km-ibtn', `km-ibtn-${size}`, className)} aria-label={label} data-tip={label || undefined}
            aria-pressed={selected === null ? undefined : Boolean(selected)} {...rest} {...idle(disabled, onClick)}>
      {children}
      {badge != null && badge !== 0 && <span className="km-badge">{badge > 999 ? '999+' : badge}</span>}
    </button>
  )
}

// A switch: a pill with a ball that slides to the lit end.
export function Toggle({ checked, onChange, label = '', ariaLabel = '', disabled = false }) {
  return (
    <label className="km-toggle" data-disabled={disabled || undefined}>
      <input type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} aria-label={label ? undefined : (ariaLabel || undefined)}
             onChange={(event) => onChange(event.target.checked)} />
      <span className="km-toggle-box" aria-hidden="true" />
      {label && <span className="km-toggle-label">{label}</span>}
    </label>
  )
}

// A box to tick a row with.
export function Tick({ checked, onChange, label }) {
  return (
    <label className="km-tick" title={label}>
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} aria-label={label} />
      <span aria-hidden="true" />
    </label>
  )
}

// One choice of a few, in a row; one tab stop, the arrow keys moving the choice.
export function Seg({ options, value, onChange, label = '', className = '' }) {
  const chosen = options.some((o) => o.id === value) ? value : options[0]?.id
  const onKeyDown = (event) => {
    // A row of choices answers to left and right; up and down are left to move focus away.
    const by = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!by) return
    event.preventDefault()
    const at = options.findIndex((o) => o.id === chosen)
    const next = options[(at + by + options.length) % options.length]
    if (!next) return
    onChange(next.id)
    event.currentTarget.querySelectorAll('button')[options.indexOf(next)]?.focus()
  }
  return (
    <div className={cx('km-seg', className)} role="radiogroup" aria-label={label || undefined} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button key={option.id} type="button" role="radio" aria-checked={chosen === option.id} title={option.title || undefined}
                tabIndex={option.id === chosen ? 0 : -1} onClick={() => onChange(option.id)}>
          {option.icon}
          {option.label && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}

// Which system a program shows, only when there is an S1 and an S2 to choose between.
export function SystemPicker({ households, value, onChange, all = true, label = '' }) {
  const { t } = useI18n()
  if (!systemChoiceMatters(households)) return null
  const ordered = orderedHouseholds(households)
  const options = [...ordered.map((h) => ({ id: h.id, label: h.generation })), ...(all ? [{ id: 'all', label: t('km.all') }] : [])]
  return <Seg options={options} value={value || (all ? 'all' : ordered[0]?.id)} onChange={onChange} label={label || t('desk.showSystem')} />
}

// A value that follows a drag, sending as it goes but no more than every
// ninety milliseconds, and the last one on release. What was let go of stays
// on screen until the room reports it (useHeld). A value that is only wanted
// once (a place in a song) is sent on release alone.
const LIVE_MS = 90
function useLive(value, onCommit, onRelease = false) {
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
  const [held, setHeld] = useHeld(value)
  const finish = () => { if (!dragging) return; setDragging(false); setHeld(local); if (onRelease || local !== sent.current.value) send(local) }
  const change = (next) => { setDragging(true); setLocal(next); if (!onRelease) live(next) }
  return { shown: dragging ? local : (held ?? value), change, finish, dragging }
}

function percent(value, min, max) {
  return Math.max(0, Math.min(100, (((value ?? min) - min) / (max - min)) * 100))
}

// A level: a round-ended track filled as far as it is set, with a ball to drag. A
// fine-stepped bar (the EQ glides in twentieths) still moves a whole step per key.
export function Bar({ value, onCommit, label, min = 0, max = 100, step = 1, disabled = false, format = null, wheelStep = null, showValue = true, className = '', center = false, onRelease = false, lit = false }) {
  const { shown, change, finish, dragging } = useLive(value, onCommit, onRelease)
  const pct = percent(shown, min, max)
  const text = format ? format(shown) : Math.round(shown ?? min)
  return (
    <div className={cx('km-bar', className)} data-disabled={disabled || undefined} data-dragging={dragging || undefined} data-center={center || undefined} data-lit={lit || undefined}
         style={{ '--km-pct': pct }}>
      <span className="km-bar-track" aria-hidden="true"><span className="km-bar-fill" /><span className="km-bar-head" /></span>
      {showValue && <output className="km-bar-value" aria-hidden="true">{text}</output>}
      <input type="range" min={min} max={max} step={step} value={shown ?? min} aria-label={label} disabled={disabled} data-wheel-step={wheelStep || undefined}
             aria-valuetext={String(text)}
             onChange={(event) => change(Number(event.target.value))}
             onKeyDown={(event) => {
               if (step >= 1) return
               const by = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[event.key]
               if (by === undefined) return
               event.preventDefault()
               change(Math.max(min, Math.min(max, Math.round(shown ?? min) + by)))
             }}
             onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    </div>
  )
}

// A text field: its label above, the entry under it.
export function Field({ label, value, onChange, onEnter = null, type = 'text', placeholder = '', autoFocus = false, autoComplete = 'off', className = '', leading = null, trailing = null, disabled = false, name = '' }) {
  return (
    <label className={cx('km-field', className)} data-disabled={disabled || undefined}>
      {label && <span className="km-field-label">{label}</span>}
      <span className="km-field-box">
        {leading && <span className="km-field-lead" aria-hidden="true">{leading}</span>}
        <input type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} data-autofocus={autoFocus || undefined}
               autoComplete={autoComplete} disabled={disabled} name={name || undefined}
               onFocus={(event) => { if (autoFocus) event.target.select?.() }}
               onChange={(event) => onChange(event.target.value)}
               onKeyDown={(event) => { if (event.key === 'Enter' && onEnter) onEnter() }} />
        {trailing && <span className="km-field-trail">{trailing}</span>}
      </span>
    </label>
  )
}

export function Menu({ x, y, anchor = null, align = 'left', onClose, children, title = '', width = 0 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x || 0, top: y || 0, ready: false })
  useDismiss(ref, onClose)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = rectOf(el)
    let left = x ?? 0
    let top = y ?? 0
    if (anchor) {
      const a = rectOf(anchor)
      left = align === 'right' ? a.right - rect.width : a.left
      top = a.bottom + 2
      if (top + rect.height > viewH() - 8) top = Math.max(8, a.top - rect.height - 2)
    }
    left = Math.max(8, Math.min(left, viewW() - rect.width - 8))
    top = Math.max(8, Math.min(top, viewH() - rect.height - 8))
    setPos({ left, top, ready: true })
  }, [x, y, anchor, align])
  // The menu takes focus when it opens, on its checked item or its first; the arrow keys walk
  // its items and Escape hands focus back to what opened it.
  const items = () => [...(ref.current?.querySelectorAll('[role^="menuitem"]:not(:disabled)') || [])]
  useEffect(() => {
    if (!pos.ready) return
    const list = items()
    ;(list.find((el) => el.getAttribute('aria-checked') === 'true') || list[0])?.focus({ preventScroll: false })
  }, [pos.ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (event) => {
    const list = items()
    const at = list.indexOf(document.activeElement)
    const go = (i) => { event.preventDefault(); list[(i + list.length) % list.length]?.focus() }
    if (event.key === 'ArrowDown') go(at + 1)
    else if (event.key === 'ArrowUp') go(at < 0 ? list.length - 1 : at - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(list.length - 1)
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose?.(); anchor?.focus?.() }
    else if (event.key === 'Tab') { onClose?.() }
  }
  return createPortal(
    <div className="km-menu km-screenlike" ref={ref} role="menu" data-ready={pos.ready || undefined} onKeyDown={onKeyDown}
         style={{ left: pos.left, top: pos.top, minWidth: width || undefined }} onContextMenu={(event) => event.preventDefault()}>
      {title && <p className="km-menu-title">{title}</p>}
      <div className="km-menu-body">{children}</div>
    </div>,
    overlayRoot(),
  )
}

export function MenuItem({ children, onSelect, disabled = false, icon = null, checked = null, danger = false, note = '', trailing = null }) {
  return (
    <button type="button" role={checked === null ? 'menuitem' : 'menuitemradio'} className="km-menu-item"
            aria-checked={checked === null ? undefined : checked} disabled={disabled} data-danger={danger || undefined} title={note || undefined}
            onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
      <span className="km-menu-mark" aria-hidden="true">{checked ? <G.Check size={12} /> : icon}</span>
      <span className="km-menu-label">{children}</span>
      {trailing && <span className="km-menu-trail">{trailing}</span>}
    </button>
  )
}
export function MenuSep() { return <span className="km-menu-sep" role="separator" /> }

// A dropdown: the chosen value on a pill, the choices in a menu. It takes <option>
// children and calls onChange with an event-like { target: { value } }, so it drops in where
// a <select> was.
export function Select({ value, onChange, disabled = false, children, label = '', className = '', ...rest }) {
  const [open, setOpen] = useState(null)
  const options = React.Children.toArray(children).flatMap((child) => (child?.type === 'optgroup' ? React.Children.toArray(child.props.children) : [child]))
    .filter((child) => child && child.type === 'option')
    .map((child) => ({ value: String(child.props.value ?? ''), label: child.props.children, disabled: Boolean(child.props.disabled) }))
  const current = options.find((o) => o.value === String(value ?? '')) || options[0]
  const pick = (next) => { setOpen(null); if (next !== String(value ?? '')) onChange?.({ target: { value: next } }) }
  return (
    <>
      <button type="button" className={cx('km-select', className)} disabled={disabled} data-open={open ? '' : undefined}
              aria-haspopup="menu" aria-expanded={Boolean(open)} aria-label={label || undefined} {...rest}
              onClick={(event) => setOpen(open ? null : event.currentTarget)}
              onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(event.currentTarget) } }}>
        <span className="km-select-value">
          {options.map((o) => <span key={o.value} className="km-select-sizer" aria-hidden="true">{o.label}</span>)}
          <span className="km-select-current">{current?.label}</span>
        </span>
        <G.Down size={12} className="km-select-chev" />
      </button>
      {open && (
        <Menu anchor={open} width={rectOf(open).width} onClose={() => setOpen(null)}>
          <div className="km-menu-scroll">
            {options.map((o) => (
              <MenuItem key={o.value} checked={o.value === current?.value} disabled={o.disabled} onSelect={() => pick(o.value)}>{o.label}</MenuItem>
            ))}
          </div>
        </Menu>
      )}
    </>
  )
}

// --- windows -------------------------------------------------------------------------

// A window over the machine's screen. `dialog` asks one thing; `panel` holds a page of its
// own (a room's sound, Info & Options); `full` takes the whole screen (the alarm editor,
// adding a service). On a phone every kind takes the whole screen. It pops up from a little
// under size and drops away the same way; Escape and the dim area around it close it, and
// focus goes in and comes back.
const WindowExit = React.createContext(null)
export function Window({ kind = 'dialog', title = '', onClose, children, className = '' }) {
  const ref = useRef(null)
  const [exiting, setExiting] = useState(false)
  const leaving = useRef(false)
  const exit = useCallback((then) => {
    if (leaving.current) return
    leaving.current = true
    setExiting(true)
    setTimeout(() => (then || onClose)?.(), 80)
  }, [onClose])
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
    <div className={cx('km-layer', `km-layer-${kind}`)} role="presentation" data-exiting={exiting || undefined}
         onPointerDown={(event) => { if (event.target === event.currentTarget) exit() }}>
      <div className={cx('km-window', 'km-screenlike', `km-window-${kind}`, className)} role="dialog" aria-modal="true" aria-label={title || undefined} ref={ref} tabIndex={-1}>
        <WindowExit.Provider value={exit}>{children}</WindowExit.Provider>
      </div>
    </div>,
    overlayRoot(),
  )
}

// A window's title band: the way back, the title, its actions, and close.
export function WindowBar({ title, sub = '', onClose = null, back = null, children }) {
  const { t } = useI18n()
  const exit = React.useContext(WindowExit)
  return (
    <header className="km-window-bar">
      {back && <IconBtn label={t('common.back')} onClick={back} className="km-window-back"><G.Back size={12} /></IconBtn>}
      <div className="km-window-titles">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
      {onClose && <IconBtn label={t('common.close')} onClick={() => (exit ? exit(onClose) : onClose())} className="km-window-close"><G.Close size={12} /></IconBtn>}
    </header>
  )
}

function ExitBtn({ onClose, children }) {
  const exit = React.useContext(WindowExit)
  return <Btn variant="line" onClick={() => (exit ? exit(onClose) : onClose?.())}>{children}</Btn>
}

// A dialog asking one thing, or asking for a name when `input` is set.
export function Confirm({ title, body, action, cancelLabel, onConfirm, onClose, danger = false, input = null, disabled = false, cancelable = true, icon = null, alt = null, children }) {
  const { t } = useI18n()
  const [value, setValue] = useState(input?.initial || '')
  const ok = input ? value.trim() && (input.allowSame || value.trim() !== (input.initial || '')) : true
  const submit = () => { if (ok && !disabled) onConfirm(input ? value.trim() : undefined) }
  return (
    <Window kind="dialog" title={title} onClose={onClose} className="km-confirm">
      <WindowBar title={title} onClose={onClose} />
      <div className="km-window-body">
        {icon && <span className="km-confirm-icon" aria-hidden="true">{icon}</span>}
        {body && <p>{body}</p>}
        {input && <Field label={input.label || title} value={value} autoFocus placeholder={input.placeholder || ''} onChange={setValue} onEnter={submit} />}
        {children}
      </div>
      <footer className="km-window-actions">
        {cancelable && <ExitBtn onClose={onClose}>{cancelLabel || t('common.cancel')}</ExitBtn>}
        {/* A second way to answer, beside the first (Add to End beside Replace, say). */}
        {alt && <Btn disabled={disabled} onClick={alt.onSelect}>{alt.label}</Btn>}
        <Btn variant="solid" data-danger={danger || undefined} disabled={!ok || disabled} onClick={submit}>{action}</Btn>
      </footer>
    </Window>
  )
}

// --- lists and states ------------------------------------------------------------------

export function Row({ lead = null, title, sub = '', over = '', trail = null, onClick, selected = false, disabled = false, className = '', ...rest }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={cx('km-li', onClick && 'km-li-action', className)}
         data-selected={selected || undefined} {...rest} {...(onClick ? idle(disabled, onClick) : { 'aria-disabled': disabled || undefined })}>
      {lead && <span className="km-li-lead">{lead}</span>}
      <span className="km-li-text">
        {over && <span className="km-li-over">{over}</span>}
        <span className="km-li-title">{title}</span>
        {sub && <span className="km-li-sub">{sub}</span>}
      </span>
      {trail && <span className="km-li-trail">{trail}</span>}
    </Tag>
  )
}

export function Empty({ icon = null, title, body = '', children }) {
  return (
    <div className="km-empty">
      {icon && <span className="km-empty-icon" aria-hidden="true">{icon}</span>}
      <p className="km-empty-title">{title}</p>
      {body && <p className="km-empty-body">{body}</p>}
      {children}
    </div>
  )
}

// Something under way: its words, and a row of colored bulbs lighting one after another.
export function Busy({ label = '', inline = false }) {
  return (
    <div className={cx('km-busy', inline && 'km-busy-inline')} role="status" aria-label={label || undefined}>
      <span className="km-busy-bulbs" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      {label && <span className="km-busy-label">{label}</span>}
    </div>
  )
}

export function Kbd({ children, onPress = null, label = '' }) {
  // A key cap that is also the thing it names (the Esc on a window that Esc closes) can be pressed.
  if (onPress) return <button type="button" className="km-kbd km-kbd-press" onClick={onPress} aria-label={label || undefined} data-tip={label || undefined}>{children}</button>
  return <kbd className="km-kbd">{children}</kbd>
}

// The message ribbons: what just happened, and the notices the system raised, newest last. One
// that can be dismissed goes at a press anywhere on it, or on its button.
export function Ticker({ items, onDismiss }) {
  const { t } = useI18n()
  return (
    <div className="km-ticker" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="km-ticker-line" data-kind={item.kind || undefined} role="status" data-dismissible={item.dismissible || undefined}
             data-leaving={item.leaving || undefined} aria-hidden={item.leaving || undefined}
             title={item.dismissible ? t('common.dismiss') : undefined} onClick={item.dismissible ? () => onDismiss(item) : undefined}>
          <span className="km-ticker-sign" aria-hidden="true">{item.kind === 'warn' ? <G.Warning size={16} /> : <G.Sparkle size={16} />}</span>
          <span className="km-ticker-text">
            {item.title && <strong>{item.title}</strong>}
            <span>{item.text}</span>
          </span>
          {item.dismissible && <IconBtn size="s" label={t('common.dismiss')} onClick={(event) => { event.stopPropagation(); onDismiss(item) }}><G.Close size={14} /></IconBtn>}
        </div>
      ))}
    </div>
  )
}

// A tooltip on a yellow pill, in place of the browser's: shown after half a second
// over a control that names itself, or at once when the keyboard reaches it.
export function TooltipLayer() {
  const [tip, setTip] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    let timer = null
    let current = null
    // A control's name can change or go while the pointer rests on it (Mute's "Unmute" goes when
    // the room is unmuted): the tip follows it, and with no name left there is no tip, never an
    // empty one.
    let shown = false
    const watch = new MutationObserver(() => { if (current && shown) show(current) })
    const hide = () => { clearTimeout(timer); watch.disconnect(); current = null; shown = false; setTip(null) }
    const show = (el) => {
      const text = el.isConnected ? el.getAttribute('data-tip') : ''
      shown = Boolean(text)
      if (!text) { setTip(null); return }
      const r = rectOf(el)
      setTip({ text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
    }
    const follow = (el) => { watch.disconnect(); watch.observe(el, { attributes: true, attributeFilter: ['data-tip'] }) }
    const over = (event) => {
      if (event.pointerType === 'touch') return
      const el = event.target.closest?.('[data-tip]')
      if (el === current) return
      hide()
      if (!el || el.disabled) return
      current = el
      follow(el)
      timer = setTimeout(() => show(el), 500)
    }
    const out = (event) => { if (current && !current.contains(event.relatedTarget)) hide() }
    const focus = (event) => {
      const el = event.target.closest?.('[data-tip]')
      hide()
      if (el && el.matches(':focus-visible')) { current = el; follow(el); show(el) }
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
      watch.disconnect()
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
    setPos({ left: Math.max(8, Math.min(tip.x - w / 2, viewW() - w - 8)), top: below ? tip.bottom + 4 : tip.top - h - 4 })
  }, [tip])
  if (!tip) return null
  return createPortal(
    <div className="km-tooltip km-screenlike" role="tooltip" ref={ref} style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>{tip.text}</div>,
    overlayRoot(),
  )
}

// The volume dial: a smooth knob, turned by taking hold of it and going round, by the mouse wheel
// over it, or by the arrow keys. It turns through three quarters of a circle, from seven o'clock
// (nothing) to five o'clock (all the way up). The knob is one picture, the same however it is
// turned; the mark near its edge is drawn over it and turns with the value. `lit` is 'full' for the
// whole mark lit, 'end' for its outer end alone, 'mute' for a dot at its inner end, false for none.
const DIAL_SWEEP = 270
export function Dial({ value, onCommit, label, min = 0, max = 100, disabled = false, wheelStep = 2, lit = false, className = '' }) {
  const { shown, change, finish, dragging } = useLive(value, onCommit)
  const ref = useRef(null)
  const grip = useRef(null)
  const now = useRef(shown)
  now.current = shown ?? min
  const pct = percent(shown, min, max)
  const turn = -DIAL_SWEEP / 2 + (pct / 100) * DIAL_SWEEP
  const set = (next) => change(Math.max(min, Math.min(max, Math.round(next))))
  const angleOf = (event) => {
    const box = ref.current.getBoundingClientRect()
    return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180 / Math.PI
  }
  const onDown = (event) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    ref.current.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    grip.current = { id: event.pointerId, angle: angleOf(event), value: now.current }
  }
  const onMove = (event) => {
    const g = grip.current
    if (!g || g.id !== event.pointerId) return
    const angle = angleOf(event)
    let by = angle - g.angle
    if (by > 180) by -= 360
    if (by < -180) by += 360
    g.angle = angle
    g.value = Math.max(min, Math.min(max, g.value + (by / DIAL_SWEEP) * (max - min)))
    set(g.value)
  }
  const onUp = (event) => {
    if (!grip.current || grip.current.id !== event.pointerId) return
    grip.current = null
    finish()
  }
  const step = useRef(null)
  step.current = (by) => { if (!disabled) set(now.current + by) }
  useEffect(() => {
    const el = ref.current
    let last = 0
    let rest = 0
    const onWheel = (event) => {
      event.preventDefault()
      if (!event.deltaY || event.timeStamp - last < 40) return
      last = event.timeStamp
      step.current(event.deltaY < 0 ? wheelStep : -wheelStep)
      clearTimeout(rest)
      rest = setTimeout(() => finishNow.current(), 250)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(rest) }
  }, [wheelStep])
  const finishNow = useRef(finish)
  finishNow.current = finish
  const onKeyDown = (event) => {
    const by = { ArrowUp: wheelStep, ArrowRight: wheelStep, ArrowDown: -wheelStep, ArrowLeft: -wheelStep, PageUp: 10, PageDown: -10 }[event.key]
    if (event.key === 'Home') { event.preventDefault(); set(min); return }
    if (event.key === 'End') { event.preventDefault(); set(max); return }
    if (by === undefined) return
    event.preventDefault()
    step.current(by)
  }
  return (
    <div className={cx('ld-dial', className)} ref={ref} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-disabled={disabled || undefined}
         aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(shown ?? min)} aria-valuetext={String(Math.round(shown ?? min))}
         data-disabled={disabled || undefined} data-dragging={dragging || undefined} data-lit={lit || undefined}
         style={{ '--ld-turn': `${turn}deg` }}
         onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}
         onKeyDown={onKeyDown} onKeyUp={finish} onBlur={finish}>
      <i className="ld-dial-ring" aria-hidden="true" />
      <i className="ld-dial-mark" aria-hidden="true" />
    </div>
  )
}
