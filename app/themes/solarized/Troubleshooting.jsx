import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import NetworkMap, { HealthDonut, MeshGuidance, forSystem } from '../../frontend/src/components/NetworkMap.jsx'
import { Window } from './Dialogs.jsx'

// Troubleshooting, under Help as in Outrun and Sedona: each system's health
// and findings, what its rooms hear of each other on a SonosNet mesh, then the
// shared network map with every speaker's verdict and the week's dropouts.
// It follows the S1/S2/All picker.

export default function TroubleshootingWindow({ onClose, systemFilter }) {
  const { t } = useI18n()
  const { data, loading, error } = useDiagnostics()
  return (
    <Window title={t('solarized.troubleshoot')} onClose={onClose} className="sz-troubleshoot">
      <div className="sz-ts-body">
        <p className="sz-ts-blurb">{loading ? t('net.probing') : t('solarized.troubleshoot.blurb')}</p>
        <MeshGuidance />
        {error && <p className="sz-ts-error">{error}</p>}
        {forSystem(data, systemFilter)?.households.map((household) => (
          <section key={household.household} className="sz-ts-system">
            <h3>{t('common.system', { generation: household.generation })}</h3>
            <HealthDonut household={household} />
            {household.findings?.length > 0 && (
              <ul className="sz-ts-findings">
                {household.findings.map((finding, index) => (
                  <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
                    <strong>{finding.title}</strong>
                    <p>{finding.detail}</p>
                    {finding.remedy && <p className="sz-ts-remedy">{finding.remedy}</p>}
                  </li>
                ))}
              </ul>
            )}
            {household.links?.length > 0 && (
              // Only a SonosNet mesh has links; speakers on plain Wi-Fi
              // exchange nothing with their neighbors, so there are none.
              <details className="sz-ts-links">
                <summary>{t('solarized.troubleshoot.hearing')} ({household.links.length})</summary>
                <p className="sz-ts-note">{t('solarized.troubleshoot.pairsNote')}</p>
                <ul>
                  {household.links.slice(0, 14).map((link) => (
                    <li key={`${link.a}-${link.b}`} data-quality={link.quality}>
                      <span>{link.name_a} · {link.name_b}</span>
                      <span>{t('solarized.troubleshoot.marginLine', { margin: link.worst_margin })}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ))}
        <NetworkMap data={data} loading={loading} systemFilter={systemFilter} />
      </div>
    </Window>
  )
}
