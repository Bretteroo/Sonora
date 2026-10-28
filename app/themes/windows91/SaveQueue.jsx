import React, { useEffect, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { Window } from './Dialogs.jsx'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'

// "Save Queue" as the Windows app draws it (savequeuedialog.xaml, measured
// again 2026-09-06 at 444x422): 20px inset, the sentence, 20px, "Enter a new
// playlist name:" over a field holding the suggested name selected, 20px,
// "Or select an existing Sonos Playlist to replace:" over a white list that
// fills the rest; Done (default) and Cancel at the foot.
export default function SaveQueue({ zone, onClose, onSave }) {
  const { t } = useI18n()
  const [title, setTitle] = useState(() => suggestedQueueName(t, zone))
  const [existing, setExisting] = useState([])
  const [replace, setReplace] = useState(null)
  useEffect(() => {
    if (!zone) return
    api.playlists(zone.uuid).then((r) => setExisting(r.items || [])).catch(() => setExisting([]))
  }, [zone])
  const pick = (item) => { setReplace(item); setTitle(item.title) }
  return (
    <Window title={t('desk.queue.saveTitle')} onClose={onClose} className="win-savequeue">
      <div className="win-savequeue-body">
        <p>{t('desk.queue.saveBody')}</p>
        <label className="win-savequeue-field">
          <span>{t('win.saveQueue.name')}</span>
          <input type="text" value={title} autoFocus onFocus={(e) => e.target.select()}
                 onChange={(e) => { setTitle(e.target.value); setReplace(null) }} />
        </label>
        <p>{t('win.saveQueue.replace')}</p>
        <div className="win-savequeue-list" role="listbox">
          {existing.map((item) => (
            <button key={item.id} type="button" role="option" aria-selected={replace?.id === item.id}
                    onClick={() => pick(item)}>{item.title}</button>
          ))}
        </div>
      </div>
      <div className="win-dialog-foot">
        <button type="button" className="dk-win-btn" data-default="true" disabled={!title.trim()}
                onClick={() => onSave(title.trim(), replace?.id || '')}>{t('common.done')}</button>
        <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}
