import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { nextTransport } from '../../frontend/src/lib/transport.js'
import { Sheet, Kbd } from './ui.jsx'
import { SLEEP_CHOICES, sleepLabel } from '../../frontend/src/lib/useSleepTimer.js'
import { genericArt, nowSummary } from './house.js'
import { useNarrow, SF_NARROW } from '../../frontend/src/lib/useNarrow.js'

// The command palette (Ctrl+K): rooms, actions, favorites, playlists, and a
// search in any service, from one box, by keyboard.

export default function Palette({ onClose, groups, zones, activeZone, favorites, playlists, scopes, onSelectRoom, onAction, onPlayItem, onSearch, onOpenSource }) {
  const { t } = useI18n()
  const narrow = useNarrow(SF_NARROW)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef(null)
  const q = query.trim().toLowerCase()
  const tr = activeZone?.transport || {}
  const playing = tr.state === 'PLAYING'
  const next = nextTransport(tr)

  const entries = useMemo(() => {
    const out = []
    const match = (text) => !q || (text || '').toLowerCase().includes(q)
    for (const g of groups) {
      const z = zones[g.coordinator]
      if (!z) continue
      const names = g.members.map((u) => zones[u]?.name).filter(Boolean)
      const label = names.length > 1 ? `${z.name} + ${names.length - 1}` : z.name
      if (match(label) || names.some(match)) {
        out.push({ group: t('desk.rooms.title'), id: `room:${g.coordinator}`, label, sub: nowSummary(z.transport, t).title || t('common.noMusicSelected'),
                   icon: <I.Speaker />, run: () => onSelectRoom(g.coordinator) })
      }
    }
    const actions = [
      // Named for what the press does: togglePlay stops a stream the speaker
      // cannot pause, and this line said Pause over it.
      { id: 'playpause', label: t(`common.${next}`), icon: next === 'stop' ? <I.Stop /> : next === 'pause' ? <I.Pause /> : <I.Play />, key: 'Space' },
      { id: 'next', label: t('common.next'), icon: <I.Next />, key: 'Ctrl →' },
      { id: 'previous', label: t('common.previous'), icon: <I.Prev />, key: 'Ctrl ←' },
      { id: 'mute', label: activeZone?.group_muted ? t('common.unmute') : t('common.mute'), icon: <I.Muted />, key: 'Ctrl M' },
      { id: 'pauseall', label: t('desk.rooms.pauseAll'), icon: <I.Pause /> },
      { id: 'shuffle', label: t('common.shuffle'), icon: <I.Shuffle />, key: 'Ctrl E' },
      { id: 'repeat', label: t('common.repeat'), icon: <I.Repeat />, key: 'Ctrl R' },
      { id: 'crossfade', label: t('desk.transport.crossfade'), icon: <I.Crossfade />, key: 'Ctrl ⇧ X' },
      { id: 'queue', label: t('common.queue'), icon: <I.Queue />, key: 'Ctrl G' },
      { id: 'stage', label: t('sf.openStage'), icon: <I.Expand /> },
      { id: 'group', label: t('desk.grouping.title'), icon: <I.Rooms /> },
      { id: 'mini', label: t('win.menu.showMini'), icon: <I.Collapse />, key: 'Ctrl D' },
      { id: 'sleepoff', label: `${t('desk.browse.sleepTimer')}: ${t('desk.sleep.off')}`, icon: <I.Moon /> },
      ...SLEEP_CHOICES.map((m) => ({ id: `sleep:${m}`, label: `${t('desk.browse.sleepTimer')}: ${sleepLabel(t, m)}`, icon: <I.Moon /> })),
      { id: 'alarms', label: t('desk.browse.alarms'), icon: <I.Bell /> },
      { id: 'settings', label: t('common.settings'), icon: <I.Sliders /> },
      // Nothing on a phone can press one, so the list leaves it out there.
      ...(narrow ? [] : [{ id: 'shortcuts', label: t('desk.shortcuts.title'), icon: <I.Keyboard />, key: '?' }]),
    ]
    for (const a of actions) if (match(a.label)) out.push({ group: t('sf.actions'), ...a, run: () => onAction(a.id) })
    for (const f of favorites.items) {
      if (f.available === false || !match(`${f.title} ${f.description || ''}`)) continue
      out.push({ group: t('desk.browse.favorites'), id: `fav:${f.id}`, label: f.title, sub: f.description || '', art: f.art, fallback: genericArt(f), run: () => onPlayItem(f, 'FV:2') })
    }
    for (const p of playlists.items) {
      if (!match(p.title)) continue
      out.push({ group: t('desk.browse.playlists'), id: `pl:${p.id}`, label: p.title, sub: t('desk.browse.playlists'), icon: <I.Playlist />, run: () => onPlayItem(p, 'SQ:') })
    }
    if (q) {
      for (const s of scopes) {
        out.push({ group: t('common.search'), id: `search:${s.key}`, label: t('sf.searchIn', { term: query.trim(), service: s.nickname && (s.accounts > 1 || scopes.filter((o) => o.id === s.id).length > 1) ? `${s.name} (${s.nickname})` : s.name }),
                   iconUrl: s.icon, icon: <I.Search />, run: () => onSearch(query.trim(), s) })
      }
    } else {
      for (const s of scopes.slice(0, 6)) {
        out.push({ group: t('sf.sources'), id: `open:${s.key}`, label: s.name, sub: s.nickname || '', iconUrl: s.icon, icon: <I.Note />, run: () => onOpenSource(s) })
      }
    }
    return out.slice(0, 60)
  }, [q, groups, zones, favorites.items, playlists.items, scopes, playing, next, activeZone, t]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setIndex(0) }, [q])
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
  let lastGroup = ''
  return (
    <Sheet kind="palette" title={t('sf.commandPalette')} onClose={onClose} className="sf-palette">
      <div className="sf-palette-input">
        <I.Search />
        <input type="text" value={query} data-autofocus placeholder={t('sf.paletteHint')} aria-label={t('sf.commandPalette')}
               onChange={(event) => setQuery(event.target.value)} onKeyDown={onKey} />
        <Kbd>Esc</Kbd>
      </div>
      <div className="sf-palette-list" ref={listRef} role="listbox">
        {entries.length === 0 && <p className="sf-muted sf-palette-empty">{t('common.noResults')}</p>}
        {entries.map((entry, i) => {
          const header = entry.group !== lastGroup ? entry.group : ''
          lastGroup = entry.group
          return (
            <React.Fragment key={entry.id}>
              {header && <p className="sf-palette-group">{header}</p>}
              <button type="button" role="option" aria-selected={i === index} className="sf-palette-row"
                      onMouseEnter={() => setIndex(i)} onClick={() => run(entry)}>
                <span className="sf-palette-icon" aria-hidden="true">
                  {entry.art !== undefined ? <Art src={entry.art} size={28} fallback={entry.fallback} />
                    : entry.iconUrl ? <img src={entry.iconUrl} alt="" /> : entry.icon}
                </span>
                <span className="sf-palette-text">
                  <span className="sf-palette-label">{entry.label}</span>
                  {entry.sub && <span className="sf-palette-sub">{entry.sub}</span>}
                </span>
                {entry.key && <Kbd>{entry.key}</Kbd>}
              </button>
            </React.Fragment>
          )
        })}
      </div>
    </Sheet>
  )
}
