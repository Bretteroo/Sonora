import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { playersOf, playerLabel } from '../../frontend/src/lib/players.js'
import { versionLabel, updateBody } from '../../frontend/src/lib/version.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { useContentFiltering } from '../../frontend/src/lib/useContentFiltering.js'
import { api } from '../../frontend/src/lib/api.js'
import { Toggle } from './SettingsPage.jsx'
import Overlay from './Overlay.jsx'

// Settings > View System Details, as the product lays it out (play.sonos.com,
// 2026-09-14, again 2026-09-24): a 40px title, a 12px line under it, an
// "About your system" heading and an 89px row per product -- its picture,
// "Beam • Black" in 12px over the room in 16px, "View" at the right. View
// opens the product's own dialog: the picture large, the room, whether it is
// connected, then Serial Number, Model, Color, Max Volume, and Version, each a
// label over its value between hairlines. Every line of it is read from the
// player itself (/api/players/<uuid>/details). The picture is the product's
// own render, the one play.sonos.com draws, which Sonora fetches from Sonos
// once and keeps. A player on an older board names no color, so its dialog
// offers the colors its model came in, Unknown until one is chosen.
export default function SystemDetailsPage({ onClose, systemFilter = 'all' }) {
  const { t } = useI18n()
  const { households, zoneList } = useSystem()
  const { byHousehold } = useContentFiltering()
  const [open, setOpen] = useState(null)
  // Each product's own facts, by uuid, asked of every player on the page.
  const [details, setDetails] = useState({})
  // The system the reader has chosen, as everywhere else on the page: with S2
  // picked the product lists that system alone, and Sonora listed S1 first.
  const shownHouseholds = orderedHouseholds(households)
    .filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  const many = shownHouseholds.length > 1
  // A software update waiting on a system's speakers (never an app's own).
  // play.sonos.com has no such control; the other themes put "Update Now"
  // at the head of their source list, and this is where the Web theme keeps
  // the system's players.
  const [updates, setUpdates] = useState({})
  const [updateAsk, setUpdateAsk] = useState(null)
  const householdIds = households.map((h) => h.id).join(',')
  // A speaker the household has lost is listed with the rest, as the product
  // lists it: its own row and dialog, with "Not connected" under its name.
  // The speakers keep it in VanishedDevices for as long as they like, and
  // it is shown for as long as they do.
  const lostOf = (h) => (h.vanished || []).map((v) => ({ uuid: v.uuid, name: v.name, model: v.model || '', role: '', online: false, lost: true }))
  const productsOf = (h) => [...playersOf(h, zoneList), ...lostOf(h)]
  const playerIds = shownHouseholds.flatMap((h) => productsOf(h).map((p) => p.uuid)).join(',')
  useEffect(() => {
    let canceled = false
    for (const uuid of playerIds.split(',').filter(Boolean)) {
      api.playerDetails(uuid)
        .then((r) => { if (!canceled) setDetails((prev) => ({ ...prev, [uuid]: r })) })
        // Null rather than nothing, so the row still draws the player's icon.
        .catch(() => { if (!canceled) setDetails((prev) => ({ ...prev, [uuid]: null })) })
    }
    return () => { canceled = true }
  }, [playerIds])
  useEffect(() => {
    let canceled = false
    for (const h of households) {
      api.softwareUpdate(h.id)
        .then((r) => { if (!canceled) setUpdates((prev) => ({ ...prev, [h.id]: r })) })
        .catch(() => {})
    }
    return () => { canceled = true }
  }, [householdIds]) // eslint-disable-line react-hooks/exhaustive-deps
  const startUpdate = async () => {
    const hh = updateAsk.hh
    setUpdateAsk(null)
    const done = await api.startSoftwareUpdate(hh).catch(() => null)
    if (done?.started?.length) setUpdates((prev) => ({ ...prev, [hh]: { ...prev[hh], pending: false, started: true } }))
  }

  return (
    <div className="wb-service-page wb-sysdetails">
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={16} height={16} />
      </button>
      <header className="wb-service-head"><h1>{t('web.settings.viewSystemDetails')}</h1></header>
      <p className="wb-sysdetails-lead">{t('web.settings.systemDetailsBlurb')}</p>

      {/* Content Filters first, as the product heads the page: Filter
          Explicit Content with a switch that shows the system's setting and
          cannot be moved from here -- "Change this setting in the Sonos app"
          (play.sonos.com, 2026-09-22). Sonora cannot write it either. */}
      <section className="wb-sysdetails-section">
        <h2>{t('web.settings.contentFilters')}</h2>
        <div className="wb-sysdetails-card">
          {shownHouseholds.map((household) => {
            const state = byHousehold[household.id]
            return (
              <div key={household.id} className="wb-sysdetails-filter">
                <span className="wb-sysdetails-text">
                  <span className="wb-sysdetails-filter-label">
                    {many ? t('web.settings.filterExplicitGen', { generation: household.generation }) : t('web.settings.filterExplicit')}
                  </span>
                  <span className="wb-sysdetails-product">{t('web.settings.filterElsewhere')}</span>
                </span>
                <Toggle checked={state?.filtering === true} disabled label={t('web.settings.filterExplicit')} onChange={() => {}} />
              </div>
            )
          })}
        </div>
      </section>

      {shownHouseholds.map((household) => (
        <section key={household.id} className="wb-sysdetails-section">
          <h2>{many ? t('web.settings.aboutSystemGen', { generation: household.generation }) : t('web.settings.aboutSystem')}</h2>
          <div className="wb-sysdetails-card">
          {(updates[household.id]?.pending || updates[household.id]?.started) && (
            <div className="wb-sysdetails-filter wb-sysdetails-update">
              <span className="wb-sysdetails-glyph"><Icon.Update width={24} height={24} /></span>
              <span className="wb-sysdetails-text">
                <span className="wb-sysdetails-filter-label">{t('desk.browse.updateNow')}</span>
                <span className="wb-sysdetails-product">
                  {updates[household.id].started ? t('desk.update.started') : versionLabel(updates[household.id].display, updates[household.id].version)}
                </span>
              </span>
              {updates[household.id].pending && (
                <button type="button" className="wb-btn"
                        onClick={() => setUpdateAsk({ hh: household.id, version: versionLabel(updates[household.id].display, updates[household.id].version) })}>
                  {t('desk.update.start')}
                </button>
              )}
            </div>
          )}
          {productsOf(household).map((player) => {
            const facts = details[player.uuid]
            return (
              <div key={player.uuid} className="wb-sysdetails-row">
                <button type="button" className="wb-sysdetails-main"
                        onClick={() => setOpen(player.uuid)}>
                  <span className="wb-sysdetails-glyph">
                    <ProductPicture key={facts?.picture || ''} uuid={player.uuid} facts={facts} />
                  </span>
                  <span className="wb-sysdetails-text">
                    <span className="wb-sysdetails-product">{productLine(player, facts)}</span>
                    <span className="wb-sysdetails-room">{playerLabel(player)}</span>
                    {player.lost && (
                      <span className="wb-sysdetails-lost">
                        <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>
                        {t('web.notConnected')}
                      </span>
                    )}
                  </span>
                  <span className="wb-sysdetails-view">{t('web.settings.view')}</span>
                </button>
              </div>
            )
          })}
          </div>
        </section>
      ))}

      {open && (() => {
        const player = shownHouseholds.flatMap((h) => productsOf(h)).find((p) => p.uuid === open)
        return player ? (
          <ProductDialog player={player} facts={details[open]} onClose={() => setOpen(null)}
                         onFacts={(facts) => setDetails((prev) => ({ ...prev, [player.uuid]: facts }))} />
        ) : null
      })()}

      {updateAsk && (
        <Overlay onClose={() => setUpdateAsk(null)} label={t('desk.update.title')} variant="dialog">
          <button type="button" className="wb-dialog-close" title={t('common.close')} onClick={() => setUpdateAsk(null)}>
            <Icon.Close width={10} height={10} />
          </button>
          <h2>{t('desk.update.title')}</h2>
          <p>{updateBody(t, households, updateAsk.hh, updateAsk.version)}</p>
          <div className="wb-dialog-actions">
            <button type="button" className="wb-dialog-btn" onClick={() => setUpdateAsk(null)}>{t('desk.update.notNow')}</button>
            <button type="button" className="wb-dialog-btn" onClick={startUpdate}>{t('desk.update.start')}</button>
          </div>
        </Overlay>
      )}
    </div>
  )
}

// "Beam • Black": the product's model and its color, as the row prints them.
// A player on an older board names no color, and the model stands alone.
function productLine(player, facts) {
  const model = facts?.model || (player.model || '').replace(/^Sonos\s+/, '')
  return [model, facts?.color].filter(Boolean).join(' • ')
}

// The picture the player serves of itself, or the generic speaker when it
// has none.
// The product's own render, as play.sonos.com draws it (Sonora fetches each
// from Sonos once and keeps it); the player's 48px icon when Sonos has no
// render of the model or the fetch failed; the speaker glyph last.
function ProductPicture({ uuid, facts, large = false }) {
  const sources = [facts?.picture, api.playerIcon(uuid)].filter(Boolean)
  const [failed, setFailed] = useState(0)
  const src = sources[failed]
  if (facts === undefined) return null
  if (!src) return <Icon.Speaker width={large ? 96 : 28} height={large ? 96 : 28} />
  const render = src === facts?.picture
  return <img className={large ? 'wb-product-picture-large' : 'wb-product-picture'}
              data-render={render ? '' : undefined}
              src={src} alt="" onError={() => setFailed((n) => n + 1)} />
}

// The product's View dialog (play.sonos.com, 2026-09-24): 450 wide on the
// panel's own dark, 16px corners, the close disc 16px in; the picture in a
// 280x280 box 24 down, the room in 20px at 320, a green dot and "Connected"
// under it, then each fact as a 14px label over a 14px value, 57px apart
// between rules of the raised gray. Max Volume is the room's volume limit.
// For a player that names no color, Sonora's own addition: the Color row
// stays, with a picker in it, unless the model was only ever sold in one
// color, which the row then states.
function ProductDialog({ player, facts, onClose, onFacts }) {
  const { t } = useI18n()
  // A lost speaker cannot be told its color; it shows what was last seen.
  const lost = !!facts && facts.online === false
  const picking = !!facts && !lost && !facts.color_reported && facts.colors?.length > 0
  const rows = [
    [t('web.settings.fact.serial'), facts?.serial || player.serial],
    [t('web.settings.fact.model'), facts?.model || (player.model || '').replace(/^Sonos\s+/, '')],
    [t('web.settings.fact.color'), picking
      ? <ColorPicker uuid={player.uuid} facts={facts} onFacts={onFacts} />
      : facts?.color || (lost ? t('web.settings.fact.colorUnknown') : '')],
    // A speaker that cannot be asked has no known limit; the product says so.
    [t('web.settings.fact.maxVolume'), facts?.max_volume != null ? `${facts.max_volume}%`
      : facts && !facts.online ? t('web.settings.fact.colorUnknown') : ''],
    [t('web.settings.fact.version'), [facts?.generation, facts?.software_version
      ? versionLabel(facts.display_version, facts.software_version)
      : versionLabel(player.display_version, player.software_version)].filter(Boolean).join(' ')],
  ].filter(([, value]) => value)
  const online = facts ? facts.online : player.online
  return (
    <Overlay onClose={onClose} label={playerLabel(player)} variant="product">
      <button type="button" className="wb-product-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={16} height={16} />
      </button>
      <div className="wb-product-art"><ProductPicture key={facts?.picture || ''} uuid={player.uuid} facts={facts} large /></div>
      <h1 className="wb-product-name">{playerLabel(player)}</h1>
      <p className="wb-product-status" data-online={online || undefined}>
        <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>
        <span>{online ? t('web.settings.fact.connected') : t('web.notConnected')}</span>
      </p>
      <dl className="wb-product-facts">
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </Overlay>
  )
}

// Unknown, then every color Sonos has a picture of the model in. The choice
// is Sonora's alone: it is kept on the server for every browser, draws the
// picture and the row's line, and is never written to the player. Once a
// color is chosen, Unknown is no longer offered: the speaker is one of them,
// and going back to not knowing is not a choice anyone makes.
function ColorPicker({ uuid, facts, onFacts }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const choose = async (color) => {
    setBusy(true)
    try {
      onFacts(await api.setPlayerColor(uuid, color))
    } catch {
      // The picker still shows what the server holds, which is the truth.
    } finally {
      setBusy(false)
    }
  }
  return (
    <select className="wb-settings-select wb-product-color" value={facts.color_choice || ''}
            disabled={busy} aria-label={t('web.settings.fact.color')}
            onChange={(e) => choose(e.target.value)}>
      {!facts.color_choice && <option value="">{t('web.settings.fact.colorUnknown')}</option>}
      {facts.colors.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
    </select>
  )
}
