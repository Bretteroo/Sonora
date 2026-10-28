import React, { useEffect, useRef, useState } from 'react'
import { systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useLibrarySettings } from '../../frontend/src/lib/useLibrarySettings.js'
import { Confirm } from './Dialogs.jsx'
import { readLibraryPrefs, writeLibraryPrefs, FOLDER_SORTS } from '../../frontend/src/lib/libraryPrefs.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import LibraryWizard from './LibraryWizard.jsx'
import Swirl from '../../frontend/src/components/Swirl.jsx'
import TimePicker from './TimePicker.jsx'

// In the app's own order: iTunes Compilations, Album Artists, Do not group.
const ALBUM_ARTIST_OPTIONS = ['ITUNES', 'WMP', 'NONE']

// Music Library Settings as the Windows app lays it out (settingswindow.xaml,
// utilities/shareslistcontrol.xaml, 2026-09-05): a 14px bold page title, then
// an inner tab control (Folders, Advanced) whose white bordered panel holds
// the content. Folders is the SharesListControl: bold "My Music Folders on
// Sonos", the Add instruction, a Name / Path table with Add and Remove
// buttons stacked at its right, and the Remove instruction at the foot.
// Advanced stacks settings items, each a bold header at the left (168px) and
// its control at the right, as the app's HeaderControl draws them. The
// Windows-only "fix permissions" item is shown grayed: it rewrites the ACLs on
// the music files of the PC running the app, which serves them to the players
// itself, and Sonora shares no files of its own. It says so on hover rather
// than wearing the generic "only in the Sonos app" note, which left people
// wondering what it would even have done.
export default function Library({ households, onBusy }) {
  const { t, language } = useI18n()
  // The app's clock follows the locale, as the Alarm editor's does.
  const clock = new Intl.DateTimeFormat(language, { hour: 'numeric' }).resolvedOptions().hour12 ? 12 : 24
  const [section, setSection] = useState('folders')
  const { ordered, activeTab, setTab, data, error, busy, selected, setSelected, apply, highlighted, scheduled, scheduleTime, reload, pending } = useLibrarySettings(households, { section })
  // The app dims and blocks the whole settings window during a library
  // write (main/busyskin.xaml), so the shell paints the overlay.
  useEffect(() => { onBusy?.(busy) }, [busy, onBusy])
  // A share the players took but have not listed: the first is what the mask
  // names, and any that ran out of time are reported as the app reports them.
  const mounting = pending.find((p) => p.state === 'adding') || null
  // Taken by a player and being indexed: the folder is real, so it goes in
  // the list, and the mask says what the app's says while an index runs.
  const settling = pending.filter((p) => p.state === 'indexing')
  const zoneId = households.find((h) => h.id === activeTab)?.zone_uuids?.[0]
  const [prefs, setPrefs] = useState(readLibraryPrefs)
  // The shared hook has already dropped the failures that were standing when
  // this page opened, so these are the ones that arrived while it was open.
  const failedAdds = pending.filter((p) => p.state === 'failed')
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState(null)
  // The app shows shares as UNC paths.
  // The share's path as the app shows it, in Windows slashes. `path` comes
  // from the backend; the URI is a browse address, not a location.
  const unc = (share) => (share.path || share.title || '').replace(/^x-file-cifs:/, '').replace(/\//g, '\\')
  const name = (s) => unc(s).split('\\').filter(Boolean).pop() || unc(s)

  return (
    <>
      {/* The app's title stands alone; Sonora's choice of system rides in
          the title row, as the EQ page's room does, so the page below keeps
          the app's geometry. */}
      <h3 className="win-settings-for">
        <span>{t('desk.prefs.musicLibrary')}</span>
        {systemChoiceMatters(households) && (
          <select className="win-lib-system" value={activeTab || ''} onChange={(e) => setTab(e.target.value)}>
            {ordered.map((h) => <option key={h.id} value={h.id}>{h.generation}</option>)}
          </select>
        )}
      </h3>
      <div className="dk-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={section === 'folders'} onClick={() => setSection('folders')}>{t('desk.library.folders')}</button>
        <button type="button" role="tab" aria-selected={section === 'advanced'} onClick={() => setSection('advanced')}>{t('desk.library.advanced')}</button>
      </div>
      <div className={`win-settings-panel win-lib-panel win-lib-${section}`}>
        {!data && !error && <p>{t('desk.browse.loading')}</p>}
        {error && <p className="dk-add-error">{error}</p>}
        {data && section === 'folders' && (
          <>
            <p className="win-lib-title">{t('win.library.title')}</p>
            <p>{t('win.library.addHint')}</p>
            <div className="win-lib-grid">
              <div className="win-lib-table" role="listbox" aria-label={t('win.library.title')}>
                <table>
                  <thead><tr><th>{t('win.library.name')}</th><th>{t('win.library.path')}</th></tr></thead>
                  <tbody>
                    {data.shares.map((s) => (
                      <tr key={s.id} role="option" aria-selected={selected === s.id} title={unc(s)}
                          onClick={() => setSelected(s.id)}>
                        <td><Icon.Library width={16} height={16} /><span>{name(s)}</span></td>
                        <td>{unc(s)}</td>
                      </tr>
                    ))}
                    {settling.map((p) => (
                      <tr key={p.path} className="win-lib-settling">
                        <td><Icon.Library width={16} height={16} />
                          <span>{(p.path || '').split(/[\\/]/).filter(Boolean).pop()}</span></td>
                        <td>{p.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* The app's own busy mask, from utilities/shareslistcontrol.xaml:
                    a white panel over the list (not its header), the swirl
                    32px in #666 raised above the middle, then the two lines.
                    WPF centers an element including its margins, so its
                    Margin="0,0,0,60" on the swirl and "0,40,0,0" on the second
                    line are half those distances on screen. */}
                {/* The same mask carries an add in flight. The app puts that
                    on its wizard page instead (MusicLibrarySetupSubWizard case
                    4103: the title "Adding music folder" over a spinner, and
                    nothing else) because its add happens in a modal; Sonora
                    adds in the pane, so the pane is where it belongs. */}
                {(data.indexing || mounting || settling.length > 0) && (
                  <div className="win-lib-indexing" role="status" aria-live="polite">
                    <Swirl size={32} className="win-lib-swirl" />
                    <p className="win-lib-indexing-1">
                      {mounting ? t('desk.library.adding') : t('win.library.indexing1')}
                    </p>
                    <p className="win-lib-indexing-2">
                      {mounting ? mounting.path : t('win.library.indexing2')}
                    </p>
                  </div>
                )}
              </div>
              <div className="win-lib-buttons">
                <button type="button" className="dk-win-btn" disabled={busy || adding} onClick={() => setAdding(true)}>{t('desk.library.add')}</button>
                <button type="button" className="dk-win-btn" disabled={!highlighted || busy} onClick={() => setConfirm(highlighted)}>{t('desk.library.remove')}</button>
              </div>
            </div>
            {/* Still going: the file server's answers, once the first wait
                has passed, so a slow mount and a broken one read apart. */}
            {mounting?.hint && <p className="win-lib-note">{mounting.hint}</p>}
            {failedAdds.map((p) => (
              <p className="win-lib-error" key={p.path}>
                {t('desk.library.addFailed', { path: p.path })}{' '}
                {p.hint || t('desk.library.addFailedWhy')}
              </p>
            ))}
            {data.index_error && (
              <p className="win-lib-error">{t('desk.library.indexError', { error: data.index_error })}</p>
            )}
            {adding && zoneId && (
              <LibraryWizard zone={zoneId} onClose={() => setAdding(false)} onAdded={() => reload?.()} />
            )}
            <p className="win-lib-foot">{t('win.library.removeHint')}</p>
            {confirm && (
              <Confirm title={t('desk.library.removeTitle')}
                       body={t('desk.library.removeBody', { folder: confirm.title || unc(confirm.uri) })}
                       action={t('desk.library.remove')} disabled={busy}
                       onConfirm={() => { apply({ remove_id: confirm.id }); setConfirm(null); setSelected(null) }}
                       onClose={() => setConfirm(null)} />
            )}
          </>
        )}
        {data && section === 'advanced' && (
          <fieldset className="win-lib-items" disabled={busy}>
            {/* The app's Advanced tab (S1 Windows app, 2026-09-14): four
                labeled rows, the label bold at the left, the control at the
                right. Library Updates: "Update content every day at:" with the
                time. Group Albums using: the three groupings, then "Show
                Contributing Artists in the Music Library. This preference
                affects only this controller." Sort Folders by. (Its fourth
                row, Music Library Permissions, rewrote ACLs on the Windows
                machine's own shares and is gone from Sonora, which shares
                nothing.) */}
            <div className="win-lib-item">
              <p className="win-lib-item-head">{t('desk.library.indexTitle')}</p>
              <div className="win-lib-item-body">
                <label className="dk-check">
                  <input type="checkbox" checked={scheduled}
                         onChange={(e) => apply({ daily_refresh: e.target.checked ? `${scheduleTime}:00` : '' })} />
                  <span>{t('desk.library.updateDaily')}</span>
                </label>
                {/* The app's TimePicker, "2 :00 AM" with its arrows, where a
                    bare time input had stood. */}
                <TimePicker className="win-lib-time" value={scheduleTime} clock={clock} disabled={!scheduled}
                            label={t('desk.library.updateDaily')}
                            onChange={(time) => time && apply({ daily_refresh: `${time}:00` })} />
                {/* The app's dialog has no update button; that is Manage >
                    Update Music Library Now. An index in progress is still
                    said here. */}
                {data.indexing && <span className="win-lib-note">{t('desk.library.indexing')}</span>}
              </div>
            </div>
            <div className="win-lib-item">
              <p className="win-lib-item-head">{t('desk.library.compilations')}</p>
              <div className="win-lib-item-body">
                <select value={ALBUM_ARTIST_OPTIONS.includes(data.album_artist_option) ? data.album_artist_option : 'WMP'}
                        onChange={(e) => apply({ album_artist_option: e.target.value })}>
                  {ALBUM_ARTIST_OPTIONS.map((o) => <option key={o} value={o}>{t(`desk.library.group.${o}`)}</option>)}
                </select>
                <label className="dk-check">
                  <input type="checkbox" checked={prefs.contributing}
                         onChange={(e) => setPrefs(writeLibraryPrefs({ contributing: e.target.checked }))} />
                  <span>{t('desk.library.showContributing')}</span>
                </label>
              </div>
            </div>
            <div className="win-lib-item">
              <p className="win-lib-item-head">{t('desk.library.sortFolders')}</p>
              <div className="win-lib-item-body">
                <select value={prefs.folderSort} onChange={(e) => setPrefs(writeLibraryPrefs({ folderSort: e.target.value }))}>
                  {FOLDER_SORTS.map((o) => <option key={o} value={o}>{t(`desk.library.sort.${o}`)}</option>)}
                </select>
              </div>
            </div>
          </fieldset>
        )}
      </div>
    </>
  )
}
