import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { nextTransport } from '../../frontend/src/lib/transport.js'
import { SLEEP_CHOICES, sleepLabel } from '../../frontend/src/lib/useSleepTimer.js'
import * as G from './glyphs.jsx'
import { IconBtn, Kbd, Btn, SvcImg } from './kit.jsx'
import { genericArt, nowSummary } from './house.js'

// The command line (Ctrl K, or the console's FIND key): one prompt that
// reaches the rooms, the console's actions, the favorites and playlists of
// the room in view, and a search in any service. The filter keys narrow what
// it lists; the arrow keys walk the results and Enter runs one.

const KINDS = ['rooms', 'actions', 'music', 'services']

export default function Command({ onClose, groups, zones, activeZone, favorites, playlists, scopes, onSelectRoom, onAction, onPlayItem, onSearch, onOpenSource, compact }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const q = query.trim().toLowerCase()
  const next = nextTransport(activeZone?.transport || {})
  useEffect(() => { inputRef.current?.focus() }, [])
  // Escape closes it, through a listener that stays put while it is open (see useDismiss in kit.jsx
  // for why one put back on each draw can miss the Escape meant for it).
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close.current() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

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
                     icon: <G.Speaker size={24} />, run: () => onSelectRoom(g.coordinator) })
        }
      }
    }
    if (want('actions')) {
      const actions = [
        { id: 'playpause', label: t(`common.${next}`), icon: <G.PlayWhat what={next} size={24} />, key: 'Space' },
        { id: 'next', label: t('common.next'), icon: <G.Next size={24} />, key: 'Ctrl →' },
        { id: 'previous', label: t('common.previous'), icon: <G.Prev size={24} />, key: 'Ctrl ←' },
        { id: 'mute', label: activeZone?.group_muted ? t('common.unmute') : t('common.mute'), icon: <G.Muted size={24} />, key: 'Ctrl M' },
        { id: 'pauseall', label: t('desk.rooms.pauseAll'), icon: <G.Pause size={24} /> },
        { id: 'party', label: t('sv.partyMode'), icon: <G.Sparkle size={24} /> },
        { id: 'shuffle', label: t('common.shuffle'), icon: <G.Shuffle size={24} />, key: 'Ctrl E' },
        { id: 'repeat', label: t('common.repeat'), icon: <G.Repeat size={24} />, key: 'Ctrl R' },
        { id: 'crossfade', label: t('desk.transport.crossfade'), icon: <G.Crossfade size={24} />, key: 'Ctrl ⇧ X' },
        { id: 'player', label: t('sv.prog.player'), icon: <G.Play size={24} />, key: 'Ctrl 1' },
        { id: 'queue', label: t('sv.prog.queue'), icon: <G.Queue size={24} />, key: 'Ctrl 2' },
        { id: 'group', label: t('desk.grouping.title'), icon: <G.Group size={24} /> },
        { id: 'sleepoff', label: `${t('desk.browse.sleepTimer')}: ${t('desk.sleep.off')}`, icon: <G.Moon size={24} /> },
        ...SLEEP_CHOICES.map((m) => ({ id: `sleep:${m}`, label: `${t('desk.browse.sleepTimer')}: ${sleepLabel(t, m)}`, icon: <G.Timer size={24} /> })),
        { id: 'clock', label: t('desk.browse.alarms'), icon: <G.Alarm size={24} />, key: 'Ctrl 5' },
        { id: 'settings', label: t('common.settings'), icon: <G.Settings size={24} />, key: 'Ctrl 6' },
        ...(compact ? [] : [{ id: 'shortcuts', label: t('desk.shortcuts.title'), icon: <G.Keyboard size={24} />, key: '?' }]),
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
        out.push({ group: 'music', id: `pl:${p.id}`, label: p.title, sub: t('desk.browse.playlists'), icon: <G.Playlist size={24} />, run: () => onPlayItem(p, 'SQ:') })
      }
    }
    if (want('services')) {
      if (q) {
        for (const s of scopes) {
          out.push({ group: 'services', id: `search:${s.key}`, label: t('sv.searchIn', { term: query.trim(), service: s.nickname && (s.accounts > 1 || scopes.filter((o) => o.id === s.id).length > 1) ? `${s.name} (${s.nickname})` : s.name }),
                     iconUrl: s.icon, icon: <G.Search size={24} />, run: () => onSearch(query.trim(), s) })
        }
      } else {
        for (const s of scopes.filter((x) => !x.all).slice(0, 8)) {
          out.push({ group: 'services', id: `open:${s.key}`, label: s.name, sub: s.nickname || '', iconUrl: s.icon, icon: <G.Note size={24} />, run: () => onOpenSource(s) })
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
    <div className="sv-layer sv-layer-command" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="sv-command sv-screenlike" role="dialog" aria-modal="true" aria-label={t('common.search')}>
        <div className="sv-command-bar">
          <span className="sv-prompt-sign" aria-hidden="true">{t('sv.commandPrompt')}</span>
          <input ref={inputRef} type="text" value={query} placeholder={t('sv.searchHint')} aria-label={t('common.search')} spellCheck={false}
                 onChange={(event) => setQuery(event.target.value)} onKeyDown={onKey} />
          {query ? <IconBtn size="s" label={t('common.close')} onClick={() => setQuery('')}><G.Close size={12} /></IconBtn> : !compact && <Kbd onPress={onClose} label={t('common.close')}>Esc</Kbd>}
        </div>
        <div className="sv-btnrow sv-command-kinds">
          {KINDS.map((k) => (
            <Btn key={k} size="s" selected={kind === k} onClick={() => setKind(kind === k ? '' : k)}>{t(`sv.search.${k}`)}</Btn>
          ))}
        </div>
        <div className="sv-command-list" ref={listRef} role="listbox">
          {entries.length === 0 && <p className="sv-dim sv-command-empty">{t('common.noResults')}</p>}
          {entries.map((entry, i) => {
            const header = entry.group !== last ? entry.group : ''
            last = entry.group
            return (
              <React.Fragment key={entry.id}>
                {header && <p className="sv-rule-head">{t(`sv.search.${header}`)}</p>}
                <button type="button" role="option" aria-selected={i === index} className="sv-command-row" onMouseEnter={() => setIndex(i)} onClick={() => run(entry)}>
                  <span className="sv-command-icon" aria-hidden="true">
                    {entry.art !== undefined ? <span className="sv-art"><Art src={entry.art} size={32} fallback={entry.fallback} /></span>
                      : entry.iconUrl ? <SvcImg src={entry.iconUrl} /> : entry.icon}
                  </span>
                  <span className="sv-command-text">
                    <span className="sv-command-label">{entry.label}</span>
                    {entry.sub && <span className="sv-command-sub">{entry.sub}</span>}
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
