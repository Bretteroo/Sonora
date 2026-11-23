import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import * as G from './glyphs.jsx'
import { Confirm, Busy, Window, WindowBar, Row } from './kit.jsx'

// "Add to Sonos Playlist": the household's playlists and a new one.
export function AddToPlaylistWindow({ picks, source, hzone, onClose, onMessage }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [playlists, setPlaylists] = useState(null)
  const [naming, setNaming] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!hzone) return
    api.playlists(hzone).then((r) => setPlaylists(r.items || [])).catch(() => setPlaylists([]))
  }, [hzone])
  const items = (picks || []).filter((item) => item.uri)
  const addAll = async (id, title) => {
    setBusy(true)
    let added = 0
    for (const item of items) { const done = await actions.addToPlaylist(hzone, id, item, source || ''); if (done) added += 1 }
    setBusy(false)
    if (added) {
      onMessage?.(added === 1 ? t('desk.playlists.added', { title: items[0].title, playlist: title }) : t('desk.playlists.addedMany', { count: added, playlist: title }))
      onClose()
    }
  }
  return (
    <Window kind="panel" title={t('desk.playlists.addTitle')} onClose={onClose}>
      <WindowBar title={t('desk.playlists.addTitle')} sub={items.length === 1 ? items[0].title : t.plural('common.items', items.length)} onClose={onClose} />
      <div className="km-window-body">
        {playlists === null ? <Busy label={t('desk.browse.loading')} /> : (
          <div className="km-listing">
            <Row lead={<G.Plus size={24} />} title={t('desk.playlists.new')} onClick={() => setNaming(true)} />
            {playlists.map((item) => (
              <Row key={item.id} lead={<G.Playlist size={24} />} title={item.title} disabled={busy} onClick={() => { if (!busy) addAll(item.id, item.title) }} />
            ))}
          </div>
        )}
      </div>
      {naming && (
        <Confirm title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} action={t('common.ok')} icon={<G.Playlist size={48} />} input={{ initial: '', label: t('desk.playlists.nameTitle') }}
                 onClose={() => setNaming(false)}
                 onConfirm={async (title) => { setNaming(false); const made = await actions.createPlaylist(hzone, title); if (made?.id) await addAll(made.id, title) }} />
      )}
    </Window>
  )
}
