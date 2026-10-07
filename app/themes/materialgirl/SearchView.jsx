import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { nextTransport } from '../../frontend/src/lib/transport.js'
import { SLEEP_CHOICES, sleepLabel } from '../../frontend/src/lib/useSleepTimer.js'
import * as I from './icons.jsx'
import { IconButton, Kbd, Chip } from './m3.jsx'
import { KIND_SHAPES } from './shapes.js'
import { genericArt, nowSummary } from './data.js'

// The search view (Ctrl K): M3's search bar expanded into a view of its own,
// full screen on a phone and docked under the bar on a wider window. One box
// reaches the rooms, the house's actions, the favorites and playlists of the
// room in view, and a search in any service. Filter chips narrow what it
// lists; the arrow keys walk the results.

const KINDS = ['rooms', 'actions', 'music', 'services']

export default function SearchView({ onClose, groups, zones, activeZone, favorites, playlists, scopes, onSelectRoom, onAction, onPlayItem, onSearch, onOpenSource, compact }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const q = query.trim().toLowerCase()
  const next = nextTransport(activeZone?.transport || {})
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  const entries = useMemo(() => {
    const out = []
    const match = (text) => !q || (text || '').toLowerCase().includes(q)
    const want = (k) => !kind || kind === k
    if (want('rooms')) {
      for (const g of groups) {
        const z = zones[g.coordinator]
        if (!z) continue
        const names = g.members.map((u) => zones[u]?.name).filter(Boolean)
        const label = names.length > 1 ? `${z.name} + ${names.length - 1}` : z.name
        if (match(label) || names.some(match)) {
          out.push({ group: 'rooms', id: `room:${g.coordinator}`, label, sub: nowSummary(z.transport, t).title || t('common.noMusicSelected'),
                     shape: KIND_SHAPES.room, icon: <I.Speaker />, run: () => onSelectRoom(g.coordinator) })
        }
      }
    }
    if (want('actions')) {
      const actions = [
        { id: 'playpause', label: t(`common.${next}`), icon: next === 'stop' ? <I.Stop /> : next === 'pause' ? <I.Pause /> : <I.Play />, key: 'Space' },
        { id: 'next', label: t('common.next'), icon: <I.Next />, key: 'Ctrl →' },
        { id: 'previous', label: t('common.previous'), icon: <I.Prev />, key: 'Ctrl ←' },
        { id: 'mute', label: activeZone?.group_muted ? t('common.unmute') : t('common.mute'), icon: <I.Muted />, key: 'Ctrl M' },
        { id: 'pauseall', label: t('desk.rooms.pauseAll'), icon: <I.Pause /> },
        { id: 'party', label: t('mg.partyMode'), icon: <I.Sparkle /> },
        { id: 'shuffle', label: t('common.shuffle'), icon: <I.Shuffle />, key: 'Ctrl E' },
        { id: 'repeat', label: t('common.repeat'), icon: <I.Repeat />, key: 'Ctrl R' },
        { id: 'crossfade', label: t('desk.transport.crossfade'), icon: <I.Crossfade />, key: 'Ctrl ⇧ X' },
        { id: 'queue', label: t('common.queue'), icon: <I.Queue />, key: 'Ctrl G' },
        { id: 'player', label: t('mg.openPlayer'), icon: <I.Expand />, key: 'Ctrl J' },
        { id: 'group', label: t('desk.grouping.title'), icon: <I.Group /> },
        { id: 'sleepoff', label: `${t('desk.browse.sleepTimer')}: ${t('desk.sleep.off')}`, icon: <I.Moon /> },
        ...SLEEP_CHOICES.map((m) => ({ id: `sleep:${m}`, label: `${t('desk.browse.sleepTimer')}: ${sleepLabel(t, m)}`, icon: <I.Timer /> })),
        { id: 'clock', label: t('desk.browse.alarms'), icon: <I.Alarm /> },
        { id: 'settings', label: t('common.settings'), icon: <I.Settings /> },
        ...(compact ? [] : [{ id: 'shortcuts', label: t('desk.shortcuts.title'), icon: <I.Keyboard />, key: '?' }]),
      ]
      for (const a of actions) if (match(a.label)) out.push({ group: 'actions', ...a, run: () => onAction(a.id) })
    }
    if (want('music')) {
      for (const f of favorites.items) {
        if (f.available === false || !match(`${f.title} ${f.description || ''}`)) continue
        out.push({ group: 'music', id: `fav:${f.id}`, label: f.title, sub: f.description || t('desk.browse.favorites'), art: f.art, fallback: genericArt(f), run: () => onPlayItem(f, 'FV:2') })
      }
      for (const p of playlists.items) {
        if (!match(p.title)) continue
        out.push({ group: 'music', id: `pl:${p.id}`, label: p.title, sub: t('desk.browse.playlists'), icon: <I.Playlist />, shape: KIND_SHAPES.playlist, run: () => onPlayItem(p, 'SQ:') })
      }
    }
    if (want('services')) {
      if (q) {
        for (const s of scopes) {
          out.push({ group: 'services', id: `search:${s.key}`, label: t('mg.searchIn', { term: query.trim(), service: s.nickname && (s.accounts > 1 || scopes.filter((o) => o.id === s.id).length > 1) ? `${s.name} (${s.nickname})` : s.name }),
                     iconUrl: s.icon, icon: <I.Search />, run: () => onSearch(query.trim(), s) })
        }
      } else {
        for (const s of scopes.filter((x) => !x.all).slice(0, 8)) {
          out.push({ group: 'services', id: `open:${s.key}`, label: s.name, sub: s.nickname || '', iconUrl: s.icon, icon: <I.Note />, run: () => onOpenSource(s) })
        }
      }
    }
    return out.slice(0, 80)
  }, [q, kind, groups, zones, favorites.items, playlists.items, scopes, next, activeZone, compact, t]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setIndex(0) }, [q, kind])
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]')
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [index])
  const run = (entry) => { if (!entry) return; onClose(); entry.run() }
  const onKey = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((i) => Math.min(entries.length - 1, i + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
    else if (event.key === 'Enter') { event.preventDefault(); run(entries[index]) }
  }
  let last = ''
  return createPortal(
    <div className="mg-searchview-layer" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="mg-searchview" role="dialog" aria-modal="true" aria-label={t('common.search')}>
        <div className="mg-searchview-bar">
          <IconButton label={t('common.back')} onClick={onClose}><I.Back /></IconButton>
          <input ref={inputRef} type="text" value={query} placeholder={t('mg.searchHint')} aria-label={t('common.search')}
                 onChange={(event) => setQuery(event.target.value)} onKeyDown={onKey} />
          {query ? <IconButton label={t('common.close')} onClick={() => setQuery('')}><I.Close /></IconButton> : !compact && <Kbd>Esc</Kbd>}
        </div>
        <div className="mg-chips mg-searchview-chips">
          {KINDS.map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => setKind(kind === k ? '' : k)}>{t(`mg.search.${k}`)}</Chip>
          ))}
        </div>
        <div className="mg-searchview-list" ref={listRef} role="listbox">
          {entries.length === 0 && <p className="mg-muted mg-searchview-empty">{t('common.noResults')}</p>}
          {entries.map((entry, i) => {
            const header = entry.group !== last ? entry.group : ''
            last = entry.group
            return (
              <React.Fragment key={entry.id}>
                {header && <p className="mg-searchview-group">{t(`mg.search.${header}`)}</p>}
                <button type="button" role="option" aria-selected={i === index} className="mg-searchview-row" onMouseEnter={() => setIndex(i)} onClick={() => run(entry)}>
                  <span className="mg-state" aria-hidden="true" />
                  <span className="mg-searchview-icon" aria-hidden="true" style={entry.shape ? { clipPath: entry.shape } : undefined} data-shaped={entry.shape ? '' : undefined}>
                    {entry.art !== undefined ? <Art src={entry.art} size={40} fallback={entry.fallback} />
                      : entry.iconUrl ? <img src={entry.iconUrl} alt="" /> : entry.icon}
                  </span>
                  <span className="mg-searchview-text">
                    <span className="mg-searchview-label">{entry.label}</span>
                    {entry.sub && <span className="mg-searchview-sub">{entry.sub}</span>}
                  </span>
                  {entry.key && !compact && <Kbd>{entry.key}</Kbd>}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
