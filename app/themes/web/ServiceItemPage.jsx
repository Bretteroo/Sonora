import React, { useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art from './Art.jsx'
import { anchorOf, menuAt, useDismiss } from './menus.js'
import { useOnAir } from './onAir.js'
import { kindLabel } from './kinds.js'

// One playable thing, on a page of its own.
//
// A row in a service is not a play button: the product opens the item and
// waits (read off play.sonos.com 2026-09-19, clicking a station in 80er-Radio
// harmony -- the URL becomes .../stream/stream_59 and nothing starts). That is
// what the chevron on every row is promising. Playing happens here, from the
// disc under the title or from the one thing the More menu offers.
//
// Measured on the product at 1536 wide: 256px art at the panel's left inset,
// the title 40px 32px right of it, a 48px white play disc and a 48px dark More
// disc 8px apart under the title, and beneath them the service's badge with
// its name and the item's kind.
export default function ServiceItemPage({
  sid, zone, title, art = '', uri = '', metadata = '', serviceName = '',
  logo = null, itemType = '', kind = '', playZone = '', onPlay, nav,
}) {
  const { t } = useI18n()
  const [menu, setMenu] = useState(null)
  useDismiss(Boolean(menu), () => setMenu(null))

  // The room the reader chose, which is not the room the browsing went
  // through: a service is browsed via a player of the household, and playing
  // to that one put the music in whichever room happened to be first
  // (the bar named one group and the sound
  // went to another room). The caller owns that distinction.
  // The page's own item on the room now turns the disc into a pause (onAir.js).
  const onAir = useOnAir(playZone || zone, uri)
  const play = () => {
    if (!uri) return
    onPlay({ uri, metadata, title })
    setMenu(null)
  }
  const pressDisc = () => { if (!onAir.press()) play() }

  return (
    <div className="wb-item-page">
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={() => nav.back()}>
        <Icon.Close width={16} height={16} />
      </button>

      <div className="wb-item-art">
        <Art src={art} size={64} />
      </div>

      <div className="wb-item-main">
        <h1>{title}</h1>
        <div className="wb-item-actions">
          <button type="button" className="wb-item-play" disabled={!uri} onClick={pressDisc}
                  title={onAir.next === 'play' ? t('web.playTitle', { title }) : onAir.next === 'stop' ? t('common.stop') : t('common.pause')}>
            {onAir.next === 'pause' ? <Icon.Pause width={20} height={20} />
              : onAir.next === 'stop' ? <Icon.Stop width={20} height={20} />
              : <Icon.Play width={20} height={20} />}
          </button>
          <span className="wb-item-more">
            <button type="button" className="wb-item-dots" aria-expanded={!!menu}
                    title={t('web.moreOptions')}
                    onClick={(event) => {
                      const at = anchorOf(event)
                      setMenu((open) => (open ? null : at))
                    }}>
              <Icon.Ellipsis width={20} height={20} />
            </button>
            {menu && (
              // One entry, as the product has it for a station.
              <div className="wb-item-menu" role="menu" style={menuAt(menu)}>
                <button type="button" role="menuitem" onClick={play} disabled={!uri}>
                  <Icon.Play width={16} height={16} />
                  <span>{t('desk.actions.playNow')}</span>
                </button>
              </div>
            )}
          </span>
        </div>
        <p className="wb-item-meta" data-nobadge={!sid || undefined}>
          {/* The service's attribution badge, as on the list page, not its
              colored logo: the product puts Audacy's gray mark before its
              name and nothing before AccuRadio's, which publishes no badge
              (Lovers Rock Reggae, 2026-09-28). A 404 removes the picture. */}
          {sid ? (
            <img className="wb-room-badge" src={`/api/services/badge/${sid}?size=40`}
                 alt="" aria-hidden="true"
                 onError={(event) => {
                   event.currentTarget.style.display = 'none'
                   event.currentTarget.parentElement.dataset.nobadge = ''
                 }} />
          ) : null}
          <span>{serviceName}</span>
          <span className="wb-item-dot">•</span>
          <span>{t(kindLabel({ item_type: itemType, kind, uri }))}</span>
        </p>
      </div>
    </div>
  )
}
