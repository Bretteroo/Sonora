import React, { useEffect } from 'react'
import { systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useServiceLink } from '../../frontend/src/lib/useServiceLink.js'
import { ServiceBadge } from './Browse.jsx'

// The Add Music Services page: the household's addable catalog as a view in
// the browse column, one tab per system when there are two, each service with
// its logo and how it signs in. Services whose provider refuses a sign-in from
// anything but Sonos' own app are grayed and unselectable. Choosing a service
// does not sign in here; it opens the sign-in modal for that one service.

export default function AddServicesView({ onLink, servicesVersion = 0, initialTab = null }) {
  const { t } = useI18n()
  const { households, activeTab, setTab, addableFor, zoneForHousehold, loaded, error, refresh }
    = useServiceLink({ initialTab })

  // A link completed elsewhere (the modal) changes what is still addable.
  useEffect(() => { if (servicesVersion) refresh() }, [servicesVersion, refresh])

  const zone = zoneForHousehold(activeTab)
  const catalog = addableFor(activeTab)

  return (
    <div className="wb-services-page wb-add-page">
      <h1>{t('desk.add.title')}</h1>
      <p className="wb-add-intro">{t('desk.add.intro')}</p>
      {systemChoiceMatters(households) && (
        <div className="wb-tabs" role="tablist">
          {households.map((h) => (
            <button key={h.id} type="button" role="tab" className="wb-tab"
                    aria-selected={activeTab === h.id} onClick={() => setTab(h.id)}>
              {t('desk.services.tab', { system: h.generation })}
            </button>
          ))}
        </div>
      )}
      {!loaded ? (
        <div className="wb-add-loading"><span className="wb-spinner" />{t('desk.browse.loading')}</div>
      ) : (
        <div className="wb-rows wb-add-list">
          {catalog.map((service) => {
            const off = service.pairable === false
            return (
              <button key={service.id} type="button"
                      className={`wb-row wb-add-row${off ? ' wb-add-row-off' : ''}`}
                      disabled={off || !zone} aria-disabled={off || undefined}
                      title={off ? t('desk.add.unpairable', { service: service.name }) : ''}
                      onClick={() => !off && zone
                        && onLink({ sid: service.id, name: service.name, zone: zone.uuid,
                                    auth: service.auth })}>
                <span className="wb-row-art wb-add-art"><ServiceBadge service={service} /></span>
                <span className="wb-add-text">
                  <span className="wb-row-label">{service.name}</span>
                  <span className="wb-add-auth">
                    {off ? t('desk.add.appOnly')
                      : service.in_use ? t('desk.add.another') : t(`desk.add.auth.${service.auth}`)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      {error && <p className="wb-add-error">{error}</p>}
    </div>
  )
}
