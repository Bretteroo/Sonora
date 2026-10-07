import React from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { playersOf, playerLabel } from '../../frontend/src/lib/players.js'
import { APP } from '../../frontend/src/lib/meta.js'
import { Window } from './Dialogs.jsx'
import icon from '../../frontend/src/assets/sonora.png'
import { versionLabel } from '../../frontend/src/lib/version.js'

// "About My Sonos System" laid out as the Windows app draws it (captured
// 2026-09-05): the icon beside the product name and its facts, a bordered box
// listing every player with its identifiers, version and address, the legal
// line and a diagnostics button. Sonora's own facts stand where the app's do.
// The app names a player by product: "Play:1", "Connect:Amp", but "Sonos One"
// and "Sonos Amp", whose product names carry the brand.
const BRANDED = /^Sonos (One|Amp|Port|Move|Roam|Arc|Beam|Five|Ray|Era|Sub)\b/
function productName(model) {
  const name = model || ''
  return BRANDED.test(name) ? name : name.replace(/^Sonos /, '')
}

export default function About({ onClose }) {
  const { households, zoneList } = useSystem()
  const { t } = useI18n()
  const systems = orderedHouseholds(households)
  return (
    <Window title={t('win.about.title')} onClose={onClose} className="win-about">
      <div className="win-about-body">
        <div className="win-about-head">
          <img src={icon} alt="" />
          <div>
            <h3>{APP.name}</h3>
            <dl>
              <dt>{t('win.about.version')}</dt><dd>{APP.version}</dd>
              <dt>{t('win.about.os')}</dt><dd>{systems.map((h) => h.generation).join(', ') || '\u2014'}</dd>
              <dt>{t('win.about.license')}</dt><dd>{APP.license}</dd>
            </dl>
          </div>
        </div>
        <div className="win-about-box" tabIndex={0}>
          {systems.map((h) => {
            const players = playersOf(h, zoneList)
            // The app heads each system with the player the controller talks to.
            const associated = players.find((p) => p.online !== false)?.host || players[0]?.host || ''
            return (
              <React.Fragment key={h.id}>
                <p>{t('win.about.associated')} {associated}</p>
                {players.map((p) => (
                  <React.Fragment key={p.uuid}>
                    <p className="win-about-rule">--------------------------------</p>
                    <p>{productName(p.model)}: {playerLabel(p)}</p>
                    <p>{t('win.about.serial')}: {p.serial || p.uuid}</p>
                    <p>{t('win.about.os')} {h.generation}</p>
                    <p>{t('win.about.version')} {versionLabel(p.display_version, p.software_version) || '\u2014'}</p>
                    <p>{t('win.about.hardware')}: {p.hardware_version || '\u2014'}</p>
                    <p>{t('win.about.series')}: {p.series_id || '\u2014'}</p>
                    <p>{t('win.about.ip')}: {p.host}</p>
                    <p>{t('win.about.wm')}: {p.wireless_mode ?? '\u2014'}</p>
                    <p>{p.extra_version || 'OTP:'}</p>
                  </React.Fragment>
                ))}
              </React.Fragment>
            )
          })}
        </div>
        <p className="win-about-legal">
          {t('about.license', { license: APP.license })}{' '}
          <a href={APP.source} target="_blank" rel="noopener noreferrer">{t('about.github')}</a>{' '}
          <a href="/third-party-notices" target="_blank" rel="noopener noreferrer">{t('about.thirdParty')}</a>
        </p>
        <div className="win-about-foot">
          <button type="button" className="dk-win-btn" disabled title={t('desk.menu.disabledNote')}>
            {t('desk.menu.submitDiagnostics')}…
          </button>
        </div>
      </div>
    </Window>
  )
}
