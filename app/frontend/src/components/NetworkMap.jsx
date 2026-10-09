import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { useCloudAccount } from '../lib/useCloudAccount.js'
import { api } from '../lib/api.js'
import { deviceGlyph } from './DeviceGlyphs.jsx'
import './networkmap.css'

// Every Sonos device on the network, one card each (the component is at the
// foot of this file).
//
// No speaker reports how well it hears the router, S1 or S2: not on any
// status page, the support page, the topology attributes or S2's local API
// (checked 2026-10-02). What a speaker does report is how loudly it hears
// the other Sonos speakers of its own system, as margins above its noise
// floor; the strongest margin plus the floor is the figure an S1 speaker
// here shows as dBm. A Beam or a Ray reports no floor, so it shows the
// margin; a speaker that hears no other on its system shows none in range.
// That figure describes where the speaker sits, not its connection, so it
// is a detail. The verdict each card leads with comes from what every
// speaker can be measured by (network.room_health in the backend).
//
// Takes the diagnostics payload the caller already fetched, so a view holding
// one useDiagnostics() can drop this in without asking the speakers twice.

// What a speaker's signal reads as, in words, for every theme's network view.
// S1 and S2 behave alike: a speaker hears only its own system's speakers, so a
// small S2 system of rooms far apart can leave one hearing none. That speaker
// is said to have none in range, which is a fact about the house rather than a
// fault; one in a system of one is simply not measurable.
export function signalReading(room, rooms, t) {
  if (room.wired) return t('net.wired')
  if (room.rssi != null) return `${room.rssi} dBm`
  if (room.margin != null && room.neighbors) return t('net.margin', { n: room.margin })
  const others = (rooms || []).filter((r) => r !== room && !r.wired).length
  return others ? t('net.alone') : t('net.notMeasurable')
}

// A speaker's verdict, in words: what each reason code from the backend's
// room_health says, joined, worst first.
export function healthWhy(health, t) {
  return (health?.reasons || []).map((r) => t(`net.why.${r.code}`, r)).join(' · ')
}

// The official product pictures (the renders the Sonos Web theme shows),
// for a person signed in to Sonos: each player's
// details name its picture, which Sonora fetches from Sonos once and keeps
// on disk (backend/sonos/products.py). Not signed in, or a model Sonos has
// no render of, the card keeps its drawn glyph.
function useProductPictures(players, signedIn) {
  const [pictures, setPictures] = useState({})
  const key = signedIn ? players.join(',') : ''
  useEffect(() => {
    if (!key) return undefined
    let canceled = false
    for (const uuid of key.split(',').filter(Boolean)) {
      api.playerDetails(uuid)
        .then((r) => { if (!canceled && r?.picture) setPictures((prev) => ({ ...prev, [uuid]: r.picture })) })
        .catch(() => {})
    }
    return () => { canceled = true }
  }, [key])
  return signedIn ? pictures : {}
}

function DeviceArt({ model, picture }) {
  const [broken, setBroken] = useState(false)
  if (picture && !broken) return <img src={picture} alt="" onError={() => setBroken(true)} />
  const Glyph = deviceGlyph(model)
  return <Glyph />
}

// A system's one-line summary, from its speakers' verdicts, so the line at
// the top of a network view cannot say all is well while cards below say
// otherwise. It said "Nothing worth flagging" whenever the system had no
// findings, with speakers worth watching below it.
export function healthSummary(household, t) {
  const rooms = household?.rooms || []
  const problems = rooms.filter((r) => r.health?.level === 'problem').length
    + (household?.unreachable || []).length
  const watching = rooms.filter((r) => r.health?.level === 'watch').length
  if (!problems && !watching) return t('net.summary.clear')
  const parts = [problems ? t.plural('net.count.problem', problems) : '',
                 watching ? t.plural('net.count.watch', watching) : ''].filter(Boolean)
  return t('net.summary.issues', { parts: parts.join(t('net.summary.and')) })
}

// What the makers of mesh systems and managed access points say about Sonos,
// for the top of every theme's network page. The names are the makers' own and
// read the same in every language.
const MESH_GUIDES = [
  { name: 'Sonos', href: 'https://support.sonos.com/en-us/article/recommended-eero-network-configuration-for-sonos' },
  { name: 'Eero', href: 'https://eero.com/support/articles/how-do-i-set-up-sonos-speakers-on-my-eero-network' },
  { name: 'Ubiquiti UniFi', href: 'https://help.ui.com/hc/en-us/articles/18930473041047-Best-Practices-for-Sonos-Devices' },
  { name: 'TP-Link Omada', href: 'https://support.omadanetworks.com/us/document/131292/' },
  { name: 'TP-Link Deco', href: 'https://community.tp-link.com/en/home/stories/detail/500290' },
  { name: 'RUCKUS', href: 'https://community.ruckuswireless.com/discussion/48789/access-point-to-allow-pass-through-multi-cast-broad-cast' },
]

export function MeshGuidance() {
  const { t } = useI18n()
  // "sometimes" is set in italics, wherever the language puts it.
  const [before, after = ''] = t('net.mesh.blurb').split('{sometimes}')
  return (
    // Folded until asked for: most households are not on a mesh, and the
    // speakers below are what the page is for.
    <details className="nm-mesh">
      <summary className="nm-title">{t('net.mesh.title')}</summary>
      <p className="nm-blurb">{before}<em>{t('net.mesh.sometimes')}</em>{after}</p>
      <p className="nm-mesh-links">
        <strong>{t('net.mesh.guidance')}</strong>
        <span>
          {MESH_GUIDES.map((g, i) => (
            <span key={g.name}>
              {i > 0 && <span className="nm-mesh-sep" aria-hidden="true"> | </span>}
              <a href={g.href} target="_blank" rel="noopener noreferrer">{g.name}</a>
            </span>
          ))}
        </span>
      </p>
    </details>
  )
}

// A system's speakers as a donut: good, worth watching and problem, with
// the count in the middle and a legend beside it. It replaced the line of
// text that opened each system; that line stays as
// the chart's accessible name.
const DONUT_LEVELS = [
  { level: 'good', color: 'var(--t-good, #2f9e65)' },
  { level: 'watch', color: 'var(--t-fair, #d9a227)' },
  { level: 'problem', color: 'var(--t-critical, #d0453d)' },
]

export function HealthDonut({ household }) {
  const { t } = useI18n()
  const rooms = household?.rooms || []
  const counts = {
    good: rooms.filter((r) => r.health?.level === 'good').length,
    watch: rooms.filter((r) => r.health?.level === 'watch').length,
    problem: rooms.filter((r) => r.health?.level === 'problem').length + (household?.unreachable || []).length,
  }
  const total = counts.good + counts.watch + counts.problem
  const r = 42
  const length = 2 * Math.PI * r
  let offset = 0
  return (
    <figure className="nm-donut" role="img" aria-label={`${household?.generation || ''}: ${healthSummary(household, t)}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="nm-donut-track" />
        {total > 0 && DONUT_LEVELS.map(({ level, color }) => {
          const share = counts[level] / total
          if (!share) return null
          const dash = share * length
          const arc = (
            <circle key={level} cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="12"
                    strokeDasharray={`${dash} ${length - dash}`} strokeDashoffset={-offset}
                    transform="rotate(-90 50 50)" data-level={level} />
          )
          offset += dash
          return arc
        })}
        <text x="50" y="42" className="nm-donut-name">{household?.generation || ''}</text>
        <text x="50" y="65" className="nm-donut-count">{total}</text>
      </svg>
      <figcaption className="nm-donut-legend">
        {DONUT_LEVELS.map(({ level, color }) => (
          <span key={level} data-level={level} data-empty={!counts[level] || undefined}>
            <i style={{ background: color }} />
            <b>{counts[level]}</b> {t(`net.health.${level}`)}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

const LEVEL_ORDER = { problem: 0, watch: 1, good: 2 }
const LEVEL_QUALITY = { problem: 'critical', watch: 'fair', good: 'good' }

// Speakers that need attention first, then by name.
export function byHealth(rooms) {
  return [...(rooms || [])].sort((a, b) =>
    (LEVEL_ORDER[a.health?.level] ?? 3) - (LEVEL_ORDER[b.health?.level] ?? 3)
    || String(a.name).localeCompare(String(b.name))
    || String(a.role || '').localeCompare(String(b.role || '')))
}

// Every Sonos device on the network, one card each, saying first whether
// its connection is healthy and why (rebuilt: the cards had
// shown dBm for some speakers, a margin for others and nothing for the
// rest, side by side as if comparable, and called nearly every healthy
// speaker uneven). The verdict comes from what every speaker can be
// measured by: how quickly and how reliably it answers, and the packets its
// own link drops. The rest is under Details, each figure labeled for what it
// is: how loudly the speaker hears the other Sonos speakers is not its
// Wi-Fi signal, which no speaker reports.
export default function NetworkMap({ data, loading = false }) {
  const { t } = useI18n()
  const { signedIn } = useCloudAccount()
  const households = data?.households || []
  const scanning = loading && !households.length
  const pictures = useProductPictures(households.flatMap((h) => (h.rooms || []).map((r) => r.player).filter(Boolean)), signedIn)
  return (
    <section className="nm" aria-label={t('net.mapTitle')}>
      {/* The heading and its blurb wait for the scan: while it runs there
          is nothing yet for them to describe, and the page around the map
          already says it is probing. */}
      {!scanning && (
        <>
          <h3 className="nm-title">{t('net.mapTitle')}</h3>
          <p className="nm-blurb">{t('net.mapBlurb')}</p>
        </>
      )}
      {!loading && !households.length && <p className="nm-note">{t('net.mapEmpty')}</p>}
      {households.map((household) => {
        const rooms = byHealth(household.rooms)
        const counts = rooms.reduce((n, r) => ({ ...n, [r.health?.level || 'unknown']: (n[r.health?.level || 'unknown'] || 0) + 1 }), {})
        return (
          <div key={household.household} className="nm-system">
            <p className="nm-system-head">
              <strong>{household.generation}</strong>
              <span>{t.plural('common.speakers', rooms.length)}</span>
              {['problem', 'watch'].map((level) => (counts[level]
                ? <span key={level} className="nm-count" data-level={level}>{t.plural(`net.count.${level}`, counts[level])}</span> : null))}
            </p>
            <div className="nm-grid">
              {rooms.map((room) => {
                const level = room.health?.level || ''
                const label = room.role ? `${room.name} (${room.role})` : room.name
                const l = room.latency
                return (
                  <article key={room.player || room.zone || room.name} className="nm-card"
                           data-quality={LEVEL_QUALITY[level] || 'unknown'} title={`${label} — ${room.model}`}>
                    <span className="nm-art"><DeviceArt model={room.model} picture={pictures[room.player]} /></span>
                    <div className="nm-text">
                      <p className="nm-room">{label}</p>
                      <p className="nm-model">{room.model}</p>
                      <p className="nm-verdict" data-level={level || undefined}>
                        {level ? t(`net.health.${level}`) : t('net.health.unmeasured')}
                      </p>
                      {room.health && <p className="nm-why">{healthWhy(room.health, t)}</p>}
                      {/* What may be getting in the way: the likely cause of
                          the worst reason, and what to try, for a speaker
                          that is not good (the page promised this and only
                          gave symptoms). */}
                      {level && level !== 'good' && room.health.reasons[0] && (
                        <p className="nm-fix">{t(`net.fix.${room.health.reasons[0].code}`)}</p>
                      )}
                      <details className="nm-details">
                        <summary>{t('net.details')}</summary>
                        <dl>
                          <dt>{t('net.connection')}</dt>
                          <dd>{room.wired ? t('net.wired') : room.sonosnet ? t('net.onSonosnet') : t('net.onWifi')}
                            {room.channel ? `, ${t('net.channel', { n: room.channel })}` : ''}</dd>
                          {l && (<>
                            <dt>{t('net.replies')}</dt>
                            <dd>{t('net.repliesLine', { median: Math.round(l.median_ms ?? 0), p95: Math.round(l.p95_ms ?? 0), worst: Math.round(l.worst_ms ?? 0), failed: l.failures, attempts: l.attempts })}</dd>
                          </>)}
                          <dt>{t('net.dropped')}</dt>
                          <dd>{room.drops_per_min != null ? t('net.perMinute', { n: room.drops_per_min }) : t('net.notReported')}</dd>
                          <dt title={t('net.hearsHint')}>{t('net.hears')}</dt>
                          <dd>{room.wired ? t('net.wired') : signalReading(room, household.rooms, t)}</dd>
                          {room.noise_floor != null && (<>
                            <dt>{t('net.noiseLabel')}</dt>
                            <dd>{`${room.noise_floor} dBm`}</dd>
                          </>)}
                        </dl>
                      </details>
                    </div>
                  </article>
                )
              })}
              {(household.unreachable || []).map((name) => (
                <article key={`gone-${name}`} className="nm-card nm-card-gone" data-quality="critical">
                  <span className="nm-art">{React.createElement(deviceGlyph(''))}</span>
                  <div className="nm-text">
                    <p className="nm-room">{typeof name === 'string' ? name : name?.name || ''}</p>
                    <p className="nm-verdict" data-level="problem">{t('net.health.problem')}</p>
                    <p className="nm-why">{t('net.unreachable')}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      })}
      {!scanning && <Dropouts />}
    </section>
  )
}

// The playback dropouts of the last seven days (backend sonos/dropouts.py):
// a room that paused to buffer mid-track, or a source a speaker could not
// play. Read when the page opens and every minute while it stays open.
const DROPOUTS_SHOWN = 30

function Dropouts() {
  const { t, language } = useI18n()
  const [entries, setEntries] = useState(null)
  useEffect(() => {
    let live = true
    const read = () => api.dropouts().then((r) => { if (live) setEntries(r.entries || []) }).catch(() => {})
    read()
    const id = setInterval(read, 60000)
    return () => { live = false; clearInterval(id) }
  }, [])
  if (entries === null) return null
  const newest = [...entries].reverse()
  const when = new Intl.DateTimeFormat(language || undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  const what = (e) => (e.kind === 'buffering' ? t('net.drop.buffering', { seconds: e.seconds })
    : e.kind === 'skipped' ? t('net.drop.skipped') : t('net.drop.failed'))
  return (
    <div className="nm-drops">
      <h3 className="nm-title">{t('net.drop.title')}</h3>
      <p className="nm-blurb">{t('net.drop.blurb')}</p>
      {!newest.length ? <p className="nm-note">{t('net.drop.none')}</p> : (
        <ul className="nm-drop-list">
          {newest.slice(0, DROPOUTS_SHOWN).map((e, i) => (
            <li key={`${e.time}-${i}`} data-kind={e.kind}>
              <time dateTime={new Date(e.time * 1000).toISOString()}>{when.format(new Date(e.time * 1000))}</time>
              <strong>{e.room}</strong>
              <span>{what(e)}</span>
              <span className="nm-drop-item">{[e.title, e.service].filter(Boolean).join(' · ')}{e.detail ? ` (${e.detail})` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {newest.length > DROPOUTS_SHOWN && <p className="nm-note">{t('net.drop.more', { count: newest.length - DROPOUTS_SHOWN })}</p>}
    </div>
  )
}
