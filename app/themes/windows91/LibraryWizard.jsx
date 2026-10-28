import React, { useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { Window } from './Dialogs.jsx'

// The app's "Sonos setup" wizard for adding a music folder, walked in the VM
// on 2026-09-05 (wizard/strings.xaml for the words): "Add music from your
// networked share" with the path field, a validator mark and examples;
// "Username and password"; "Adding music folder" with a spinner; then either
// the "Music library setup" page or an "Error adding music" message with a
// Reason line. Back / Next / Cancel sit in the footer.
//
// The app opens on an "Add music folder" page first, three tiles asking where
// the music is: this PC's My Music folder, another folder on this PC, or a
// networked device. The first two share a folder from the Windows machine
// through the app's own file server, which a page in a browser has no way to
// do, so both were drawn grayed and the third was the only live tile. A
// question with one possible answer is not a question, so that page is gone
// and Add opens on the share path.
export default function LibraryWizard({ zone, onClose, onAdded }) {
  const { t } = useI18n()
  const [page, setPage] = useState('path')
  const [path, setPath] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const pathOk = /^(\\\\|\/\/|smb:\/\/)[^\\/]+[\\/].+/.test(path.trim())

  const add = async () => {
    setPage('adding'); setError('')
    try {
      const answer = await api.setLibrary({ zone, add_path: path.trim(),
                                            add_username: user.trim(), add_password: pass })
      // A 200 is not success: the players can take the folder and refuse to
      // mount it, and the answer says which happened.
      if (answer?.add_failed) {
        setError(answer.add_hint || ''); setPage('error')
        onAdded?.()
        return
      }
      setPage('done'); onAdded?.()
    } catch (exc) {
      setError(exc?.message || ''); setPage('error')
    }
  }
  const next = () => {
    if (page === 'path' && pathOk) setPage('credentials')
    else if (page === 'credentials') add()
  }
  const back = () => { if (page === 'credentials') setPage('path') }
  const canBack = page === 'credentials'
  const canNext = (page === 'path' && pathOk) || page === 'credentials'

  return (
    <Window title={t('win.setup.title')} onClose={onClose} className="win-wizard">
      <div className="win-wizard-body">
        {page === 'path' && (
          <>
            <h3>{t('win.setup.lib.pathTitle')}</h3>
            <p>{t('win.setup.lib.pathText')}</p>
            <div className="win-wizard-pathrow">
              <input type="text" value={path} autoFocus onChange={(e) => setPath(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter' && pathOk) next() }} aria-invalid={!pathOk} />
              <em className="win-wizard-mark" hidden={pathOk}>!</em>
              <button type="button" className="dk-win-btn" disabled title={t('desk.menu.disabledNote')}>{t('win.setup.lib.browse')}</button>
            </div>
            <p className="win-wizard-examples">{t('win.setup.lib.examples')}</p>
            <p className="win-wizard-example">{String.raw`\\MyOtherComputer\Shared\Music`}</p>
            <p className="win-wizard-example">{String.raw`\\MyNetworkedStorage\Shared\Music`}</p>
          </>
        )}
        {page === 'credentials' && (
          <>
            <h3>{t('win.setup.lib.credTitle')}</h3>
            <p>{t('win.setup.lib.credText')}</p>
            <label className="win-wizard-cred"><span>{t('win.setup.lib.username')}</span>
              <input type="text" value={user} autoFocus onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') next() }} /></label>
            <label className="win-wizard-cred"><span>{t('win.setup.lib.password')}</span>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') next() }} /></label>
          </>
        )}
        {page === 'adding' && (
          <>
            <h3>{t('win.setup.lib.adding')}</h3>
            <div className="win-wizard-spinner"><span className="dk-spinner" /></div>
          </>
        )}
        {page === 'done' && (
          <>
            <h3>{t('win.setup.lib.doneTitle')}</h3>
            <p>{t('win.setup.lib.doneSetUp', { folder: path.trim() })}</p>
            <p>{t('win.setup.lib.doneAdding')}</p>
            <p>{t('win.setup.lib.doneNotice')}</p>
          </>
        )}
        {page === 'error' && (
          <>
            <h3>{t('win.setup.lib.adding')}</h3>
            <div className="win-wizard-error" role="alertdialog">
              <div className="win-wizard-error-title">{t('win.setup.lib.errorTitle')}</div>
              <div className="win-wizard-error-body">
                <span className="win-wizard-error-icon" aria-hidden="true">✕</span>
                <div>
                  <p><strong>{t('win.setup.lib.errorMessage')}</strong></p>
                  <p>{t('win.setup.lib.errorDetails')}</p>
                  {error && <p>{t('win.setup.lib.errorReason', { reason: error })}</p>}
                </div>
              </div>
              <div className="win-dialog-foot">
                <button type="button" className="dk-win-btn" data-default="true" autoFocus onClick={() => setPage('path')}>{t('common.ok')}</button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="win-dialog-foot win-wizard-foot">
        {page === 'done' ? (
          <button type="button" className="dk-win-btn" data-default="true" onClick={onClose}>{t('common.done')}</button>
        ) : (
          <>
            <button type="button" className="dk-win-btn" disabled={!canBack} onClick={back}>{t('common.back')}</button>
            <button type="button" className="dk-win-btn" data-default={canNext || undefined} disabled={!canNext} onClick={next}>{t('common.next')}</button>
            <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
          </>
        )}
      </div>
    </Window>
  )
}
