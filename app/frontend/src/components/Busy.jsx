import './shared.css'
import React from 'react'
import { useI18n } from '../i18n/index.jsx'

// The desktop apps' blocking overlay (main/busyskin.xaml): the window dims
// under #000 at 50% and a box in the transient-message style holds a 28px
// #d9d9d9 spinner over the message, with a progress bar and Cancel when the
// operation reports either. Nothing under it can be clicked while it is up.
export default function Busy({ text = '', percent = null, onCancel = null }) {
  const { t } = useI18n()
  return (
    <div className="dk-busy" role="alertdialog" aria-busy="true" aria-label={text || t('desk.browse.loading')}>
      <div className="dk-busy-box">
        <span className="dk-busy-spinner" aria-hidden="true" />
        {text && <p>{text}</p>}
        {(percent !== null || onCancel) && (
          <div className="dk-busy-progress">
            {percent !== null && <progress max="100" value={percent} />}
            {onCancel && (
              <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
