import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useServiceLink } from '../../frontend/src/lib/useServiceLink.js'
import { serviceLinkedMessage, LinkedMessage } from '../../frontend/src/lib/serviceLinkedMessage.js'
import Overlay from './Overlay.jsx'

// The sign-in itself, as a modal: the provider's link and code, "open in
// browser", and Sonora polling until the provider confirms. It is opened with
// a `preset` ({ sid, name, zone }) naming one service and starts that sign-in
// at once. Two things open it: choosing a service in the Add Music Services
// view, and the "Link with Sonora" button on a service page for an account the
// Sonos app already holds. Picking a service is a page; signing in is this.

export default function LinkServiceModal({ preset, onClose, onLinked, onRelink }) {
  const { t } = useI18n()
  const { chosen, link, status, registered, error, households } = useServiceLink({ preset, onLinked })
  const name = chosen?.service?.name ?? preset?.name
  // An anonymous service has no sign-in to ask for; it is simply being linked.
  const anonymous = (chosen?.service?.auth ?? preset?.auth) === 'Anonymous'
  const startingText = anonymous
    ? t('desk.add.linking', { service: name })
    : t('desk.add.starting', { service: name })

  return (
    <Overlay onClose={onClose} label={t('desk.add.title')}>
      <h2>{t('desk.add.title')}</h2>
      <div className="wb-add-flow">
        <h3>{name}</h3>
        {(status === 'idle' || status === 'starting') && (
          <div className="wb-add-loading"><span className="wb-spinner" />{startingText}</div>
        )}
        {status === 'needsApp' && <p>{t('desk.add.needsApp', { service: name })}</p>}
        {status === 'waiting' && link && (
          <>
            <p>{link.show_link_code
              ? t('desk.add.instructions', { url: link.reg_url })
              : t('desk.add.instructionsNoCode', { url: link.reg_url })}</p>
            {link.show_link_code && <p className="wb-add-code">{link.link_code}</p>}
            <button type="button" className="wb-btn"
                    onClick={() => window.open(link.reg_url, '_blank', 'noopener')}>
              {t('desk.add.open')}
            </button>
            <div className="wb-add-loading"><span className="wb-spinner" />{t('desk.add.waiting', { service: name })}</div>
          </>
        )}
        {status === 'done' && (
          <p><LinkedMessage result={serviceLinkedMessage(t, { name, zone: chosen?.zone, households, registered, auth: chosen?.service?.auth })} onOpen={onRelink} /></p>
        )}
        {status === 'failed' && <p className="wb-add-error">{t('desk.add.failed', { service: name, error })}</p>}
      </div>
      <div className="wb-panel-actions">
        <button type="button" className="wb-btn" onClick={onClose}>
          {status === 'done' ? t('common.done') : t('common.cancel')}
        </button>
      </div>
    </Overlay>
  )
}
