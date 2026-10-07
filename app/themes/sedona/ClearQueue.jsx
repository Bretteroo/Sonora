import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { Window } from './Dialogs.jsx'

// Clear Queue asks first in the Windows app. QueuePanel's clearButton calls
// PlayQueueViewModel.ClearExecuted, which puts up a MultiButtonMessageWindow
// with SC_ARE_YOU_SURE_TITLE ("Confirm"), SC_ARE_YOU_SURE_INSTRUCTIONS ("Are
// you sure you want to clear the queue?") and one action button labeled
// SC_ARE_YOU_SURE_CLEAR ("Clear") beside Cancel. Measured on the app at
// 494x157 with the same 58px foot every dialog there has (2026-09-06).
export default function ClearQueue({ onClose, onConfirm }) {
  const { t } = useI18n()
  return (
    <Window title={t('win.queue.confirmTitle')} onClose={onClose} className="win-message">
      <div className="win-message-body">
        <p className="win-message-line">{t('win.queue.confirmClear')}</p>
      </div>
      <div className="win-message-foot">
        <button type="button" className="dk-win-btn" data-default="true"
                onClick={onConfirm}>{t('win.queue.clearAction')}</button>
        <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}
