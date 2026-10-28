import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { Window } from './Dialogs.jsx'
import ErrorLog from '../../frontend/src/components/ErrorLog.jsx'

// "Sonos System Error Log" (main/errorlogwindow.xaml, captured 2026-09-05):
// a 500x500 window, a read-only text box 20px in with a 60px foot, Done.
export default function ErrorLogWindow({ onClose }) {
  const { t } = useI18n()
  return (
    <Window title={t('win.errorLog.title')} onClose={onClose} className="win-errorlog">
      <div className="win-errorlog-body"><ErrorLog /></div>
      <div className="win-dialog-foot">
        <button type="button" className="dk-win-btn" data-default="true" onClick={onClose}>{t('common.done')}</button>
      </div>
    </Window>
  )
}
