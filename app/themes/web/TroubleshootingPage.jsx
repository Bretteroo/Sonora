import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import NetworkMap, { HealthDonut, MeshGuidance } from '../../frontend/src/components/NetworkMap.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { Row, Section } from './SettingsPage.jsx'

// Troubleshooting, in the web theme's own visual language.
//
// The same measurements Nocturne and Strata present, laid out the way this
// theme lays out Settings: a panel in the browse column with a 40px title, a
// close disc, and sections of rows. Findings lead, then one row per room with
// its response-time distribution, then what the rooms can hear of each other.
// The product has no equivalent page; its Diagnostics section submits to
// Sonos support, where this measures locally.

export default function TroubleshootingPage({ onClose }) {
  const { t } = useI18n()
  const { data, loading, error } = useDiagnostics()

  return (
    <section className="wb-settings" aria-label={t('diag.title')}>
      <header className="wb-settings-head">
        <h1>{t('diag.title')}</h1>
        <div className="wb-diag-controls">
          <button type="button" className="wb-settings-close"
                  aria-label={t('common.close')} onClick={onClose}>
            <Icon.Close width={18} height={18} />
          </button>
        </div>
      </header>
      <MeshGuidance />

      {error && <p className="wb-settings-error">{error}</p>}
      {loading && !data && (
        <p className="wb-diag-status">{t('net.probing')}</p>
      )}

      {data?.households.map((household) => (
        <React.Fragment key={household.household}>
          <Section
            title={`${t('diag.findings')} · ${t('common.system', { generation: household.generation })}`}
          >
            <HealthDonut household={household} />
            {household.findings.map((f, i) => (
              <div className="wb-settings-row wb-diag-finding"
                   data-severity={f.severity} key={`${f.code}-${i}`}>
                <span className="wb-settings-row-text">
                  <span className="wb-settings-row-label">{f.title}</span>
                  <span className="wb-settings-row-sub">{f.detail}</span>
                  {f.remedy && <span className="wb-settings-row-sub wb-diag-remedy">{f.remedy}</span>}
                </span>
              </div>
            ))}
          </Section>


          {household.links.length > 0 && (
            <Section title={t('diag.hearing')} blurb={t('diag.pairsNote')}>
              {household.links.slice(0, 14).map((link) => (
                <Row
                  key={`${link.a}-${link.b}`}
                  label={`${link.name_a} · ${link.name_b}`}
                  sub={t('diag.marginLine', { margin: link.worst_margin })}
                  control={<span className="wb-diag-quality" data-quality={link.quality} />}
                />
              ))}
            </Section>
          )}
        </React.Fragment>
      ))}
      <NetworkMap data={data} loading={loading} />
    </section>
  )
}
