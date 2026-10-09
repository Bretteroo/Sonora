import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import NetworkMap, { HealthDonut, MeshGuidance } from '../../frontend/src/components/NetworkMap.jsx'

// The troubleshooting view.
//
// It is built around one observation: the number people reach for, average
// response time, is the number least likely to explain a dropout. A speaker
// that answers in 7 ms almost always and 1000 ms occasionally sounds broken
// while every average looks healthy. So latency is shown as a distribution,
// with the 95th percentile given equal billing to the median, and the findings
// list leads with whatever is actually wrong rather than dumping counters.

export default function Diagnostics() {
  const { data, loading, error } = useDiagnostics()
  const { t } = useI18n()

  return (
    <div className="or-body">
      <div className="or-section-head">
        <h2>Troubleshooting</h2>
        <span>
          {loading
            ? t('net.probing')
            : 'identify potential performance issues on your network'}
        </span>
      </div>
      <MeshGuidance />

      {error && <p className="or-diag-error">{error}</p>}
      {loading && !data && <p className="or-empty">Measuring…</p>}

      {data?.households.map((household) => (
        <section key={household.household} className="or-diag-house">
          <h3 className="or-diag-house-title">
            {household.generation} system
            <small>
              {household.rooms.length} rooms
              {' · '}
              {Object.entries(household.channels)
                .map(([channel, rooms]) => `channel ${channel} (${rooms.length})`)
                .join(', ')}
            </small>
          </h3>

          <HealthDonut household={household} />
          <Findings findings={household.findings} />
          <Links links={household.links} />
        </section>
      ))}
      <NetworkMap data={data} loading={loading} />
    </div>
  )
}

function Findings({ findings }) {
  if (!findings?.length) return null
  return (
    <ul className="or-diag-findings">
      {findings.map((finding, index) => (
        <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
          <div className="or-diag-finding-head">
            <Icon.Warning width={13} height={13} />
            <strong>{finding.title}</strong>
            <span className="or-badge">{finding.severity}</span>
          </div>
          <p>{finding.detail}</p>
          {finding.remedy && <p className="or-diag-remedy">{finding.remedy}</p>}
        </li>
      ))}
    </ul>
  )
}

function Links({ links }) {
  // Links are drawn only between speakers on a SonosNet mesh. Without one
  // there are none to show, and saying no speaker hears another was untrue:
  // speakers on plain Wi-Fi hear their neighbors and exchange nothing with
  // them.
  if (!links?.length) return null
  return (
    <details className="or-diag-links">
      <summary>
        <Icon.Signal width={13} height={13} />
        What the speakers can hear of each other ({links.length} pairs)
      </summary>
      <p className="or-diag-note">
        Signal margin in dB above the noise floor, taking the weaker of the two
        directions. This measures how good each room&rsquo;s radio position is;
        it is not the route audio takes unless the system is meshed.
      </p>
      <ul>
        {links.slice(0, 14).map((link) => (
          <li key={`${link.a}-${link.b}`}>
            <span className="or-diag-pair">
              {link.name_a} <em>and</em> {link.name_b}
            </span>
            <span className="or-diag-bar" data-quality={link.quality}>
              <span style={{ width: `${Math.min(100, (link.worst_margin / 45) * 100)}%` }} />
            </span>
            <span className="num">{link.worst_margin} dB</span>
            {link.asymmetry >= 8 && (
              <span className="or-badge" title="The two ends disagree">
                lopsided
              </span>
            )}
            {!link.reciprocal && (
              <span className="or-badge" title="Only one end reported this">
                one-sided
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
