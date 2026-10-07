import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import NetworkMap, { HealthDonut } from '../../frontend/src/components/NetworkMap.jsx'

// Troubleshooting: the system's field notes, then the shared network map,
// which gives each speaker its verdict. The core-sample drawing of each
// room's response times went with the per-room views the map replaced.

export default function Canyon() {
  const { data, loading, error } = useDiagnostics()
  const { t } = useI18n()

  return (
    <div className="sd-ground">
      <div className="sd-section-head">
        <h2>Survey</h2>
        <span>
          {loading
            ? t('net.probing')
            : 'identify potential performance issues on your network'}
        </span>
      </div>

      {error && <p className="sd-empty">{error}</p>}
      {loading && !data && <p className="sd-empty">{t('net.probing')}</p>}

      {data?.households.map((household) => (
        <section className="sd-section" key={household.household}>
          <h3 className="sd-canyon-title">
            {household.generation} system
            <small>
              {Object.entries(household.channels)
                .map(([channel, rooms]) => `channel ${channel}, ${rooms.length} rooms`)
                .join(' · ')}
            </small>
          </h3>

          <HealthDonut household={household} />
          <FieldNotes findings={household.findings} />
          <Audible links={household.links} />
        </section>
      ))}
      <NetworkMap data={data} loading={loading} />
    </div>
  )
}

function FieldNotes({ findings }) {
  if (!findings?.length) return null
  return (
    <ul className="sd-notes">
      {findings.map((finding, index) => (
        <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
          <h4>{finding.title}</h4>
          <p>{finding.detail}</p>
          {finding.remedy && <p className="sd-remedy">{finding.remedy}</p>}
        </li>
      ))}
    </ul>
  )
}

function Audible({ links }) {
  // Links are drawn only between speakers on a SonosNet mesh. Without one
  // there are none to show, and saying no speaker hears another was untrue:
  // speakers on plain Wi-Fi hear their neighbors and exchange nothing with
  // them.
  if (!links?.length) return null
  return (
    <details className="sd-audible">
      <summary>What the rooms can hear of each other ({links.length} pairs)</summary>
      <p className="sd-note">
        Signal margin in dB above the noise floor, taking the weaker direction.
        This describes how good each room&rsquo;s radio position is. It is not
        the route audio takes unless the system is meshed.
      </p>
      <ul>
        {links.slice(0, 14).map((link) => (
          <li key={`${link.a}-${link.b}`}>
            <span className="sd-pair">{link.name_a} &amp; {link.name_b}</span>
            <span className="sd-seam" data-quality={link.quality}>
              <i style={{ width: `${Math.min(100, (link.worst_margin / 45) * 100)}%` }} />
            </span>
            <span className="sd-db">{link.worst_margin} dB</span>
            {link.asymmetry >= 8 && <span className="sd-tag" data-tone="quiet">lopsided</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}
