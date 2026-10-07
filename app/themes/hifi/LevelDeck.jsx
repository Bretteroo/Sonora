import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { localOut } from '../../frontend/src/lib/localOut.js'
import { readStored, writeStored } from './house.js'
import { Led } from './controls.jsx'

// The level display that fills the tuner's dial window for "This browser",
// in the same footprint as a speaker's preset dial. It is the one room whose
// sound the page plays itself, so what it shows is the real thing, read from
// Web Audio analysers on the page's own output (localOut.analyser):
//
//   * a graphic equalizer, ten octave bands, each lamp column peaking with
//     the loudest part of its band;
//   * a pair of VU meters, left and right, their needles following each
//     channel's level with a VU meter's slow swing, and four small meters
//     beside them for peak, balance, phase and dynamics;
//   * or the presets: the favorites dial a speaker shows here, read from the
//     system the switch has chosen (in place of "Off").
//
// Stopped or paused, the bars fall and the needles rest. The speakers' sound
// never reaches the page, so no other room gets one.

const MODE_KEY = 'sonora.hifi.levelDisplay'
const MODES = ['favorites', 'eq', 'vu']

const BANDS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const SEGMENTS = 12

function bandLabel(hz) {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz)
}

export default function LevelDeck({ playing, presets = null }) {
  const { t } = useI18n()
  const [mode, setModeState] = useState(() => (MODES.includes(readStored(MODE_KEY)) ? readStored(MODE_KEY) : 'eq'))
  const setMode = (next) => { setModeState(next); writeStored(MODE_KEY, next) }
  const labels = { favorites: t('desk.browse.favorites'), eq: t('hifi.eqDisplay'), vu: t('hifi.vuMeters') }
  // A source from another origin plays, but the page may not read it (see
  // readable() in localOut.js), so the window says so instead of lying flat.
  const [readableNow, setReadable] = useState(() => localOut.state.readable)
  useEffect(() => localOut.subscribe((out) => setReadable(Boolean(out.readable))), [])
  const unreadable = playing && !readableNow
  return (
    <div className="hf-leveldeck">
      <div className="hf-leveldeck-keys" role="radiogroup" aria-label={t('hifi.levelDisplay')}>
        {MODES.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={mode === id} className="hf-preset hf-leveldeck-key" onClick={() => setMode(id)}>
            <Led on={mode === id} />
            <span>{labels[id]}</span>
          </button>
        ))}
      </div>
      <div className="hf-leveldeck-window" data-mode={mode}>
        {mode === 'favorites' && presets}
        {mode !== 'favorites' && unreadable && <p className="hf-leveldeck-note">{t('hifi.levelsUnavailable')}</p>}
        {mode === 'eq' && !unreadable && <Spectrum playing={playing} label={labels.eq} />}
        {mode === 'vu' && !unreadable && <VuPair playing={playing} label={labels.vu} />}
      </div>
    </div>
  )
}

function Spectrum({ playing, label }) {
  const columns = useRef([])
  useEffect(() => {
    let frame = 0
    let analyser = null
    let data = null
    const levels = new Array(BANDS.length).fill(0)
    const paint = () => {
      if (!analyser && playing) {
        analyser = localOut.analyser()
        if (analyser) data = new Uint8Array(analyser.frequencyBinCount)
      }
      if (analyser && playing) analyser.getByteFrequencyData(data)
      const nyquist = analyser ? analyser.context.sampleRate / 2 : 24000
      BANDS.forEach((hz, i) => {
        let target = 0
        if (analyser && playing) {
          // An octave band runs from hz/√2 to hz·√2; its level is the loudest
          // bin inside it, which is how a band's lamp would peak.
          const lo = Math.max(1, Math.floor((hz / Math.SQRT2 / nyquist) * data.length))
          const hi = Math.min(data.length - 1, Math.ceil((hz * Math.SQRT2 / nyquist) * data.length))
          let peak = 0
          for (let b = lo; b <= hi; b += 1) if (data[b] > peak) peak = data[b]
          target = peak / 255
        }
        // Up at once, down gently, as a meter's lamps fall.
        levels[i] = target > levels[i] ? target : Math.max(target, levels[i] - 0.035)
        const el = columns.current[i]
        if (el) el.style.setProperty('--hf-eq-lit', String(Math.round(levels[i] * SEGMENTS)))
      })
      if (playing || levels.some((v) => v > 0)) frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  return (
    <div className="hf-eq" role="img" aria-label={label}>
      {BANDS.map((hz, i) => (
        <div key={hz} className="hf-eq-band">
          <div ref={(el) => { columns.current[i] = el }} className="hf-eq-column" style={{ '--hf-eq-lit': 0 }}>
            {Array.from({ length: SEGMENTS }, (_, s) => (
              <i key={s} style={{ '--hf-eq-n': SEGMENTS - s }} data-zone={SEGMENTS - s > SEGMENTS - 2 ? 'peak' : SEGMENTS - s > SEGMENTS - 4 ? 'high' : undefined} />
            ))}
          </div>
          <span className="hf-eq-hz">{bandLabel(hz)}</span>
        </div>
      ))}
    </div>
  )
}

// A VU meter reads 0 VU at a steady -18 dBFS, the usual alignment for
// digital audio, and runs from -20 to +3.
const VU_MIN = -20
const VU_MAX = 3
const SWEEP = 96 // degrees from stop to stop

function vuAngle(vu) {
  const clamped = Math.max(VU_MIN, Math.min(VU_MAX, vu))
  // The scale is not linear on a real meter; this spreads the top end the
  // way the printed scale does, 0 VU about two thirds of the way across.
  const frac = (10 ** (clamped / 20) - 10 ** (VU_MIN / 20)) / (10 ** (VU_MAX / 20) - 10 ** (VU_MIN / 20))
  return -SWEEP / 2 + frac * SWEEP
}

// The small meters beside the VU pair, each reading something else the two
// channels' samples say, each on a face of its own:
//
//   Peak      the louder channel's sample peak in dBFS, up at once and
//             falling back about 20 dB in 1.7 seconds, as a program-peak
//             meter does, so the transients a VU needle averages away show.
//   Balance   how much louder the right channel is than the left, in dB,
//             center zero.
//   Phase     the channels' correlation: +1 is the same signal in both (mono),
//             0 unrelated, -1 one the other's inverse, which cancels.
//   Dynamics  the crest factor: how far the peaks stand above the average,
//             in dB. Heavily limited music reads low, open music high.
const SMALL_SWEEP = 90
const SMALL = [
  { id: 'peak', face: 'black', min: -40, max: 0, ticks: [-40, -30, -20, -10, -6, -3, 0], numbers: [-40, -20, -10, 0], red: -3, fmt: (v) => String(v) },
  { id: 'balance', face: 'ivory', min: -10, max: 10, ticks: [-10, -5, 0, 5, 10], numbers: [-10, 0, 10], ends: ['L', 'R'], fmt: (v) => (v === 0 ? '0' : String(Math.abs(v))) },
  { id: 'phase', face: 'green', min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1], numbers: [-1, 0, 1], red: -0.001, redBelow: true, fmt: (v) => (v > 0 ? `+${v}` : String(v)) },
  { id: 'dynamics', face: 'cream', min: 0, max: 20, ticks: [0, 5, 10, 15, 20], numbers: [0, 10, 20], fmt: (v) => String(v) },
]
function smallAngle(meter, value) {
  const clamped = Math.max(meter.min, Math.min(meter.max, value))
  return -SMALL_SWEEP / 2 + ((clamped - meter.min) / (meter.max - meter.min)) * SMALL_SWEEP
}
const REST = { peak: -40, balance: 0, phase: 0, dynamics: 0 }

function VuPair({ playing, label }) {
  const { t } = useI18n()
  const needles = useRef([])
  const small = useRef({})
  useEffect(() => {
    let frame = 0
    let nodes = null
    let buffers = null
    const vu = [VU_MIN, VU_MIN]
    const read = { ...REST }
    const paint = () => {
      if (!nodes && playing) {
        nodes = localOut.channelAnalysers()
        if (nodes) buffers = nodes.map((n) => new Float32Array(n.fftSize))
      }
      const rms = [0, 0]
      const peak = [0, 0]
      let cross = 0
      if (nodes && playing) {
        nodes.forEach((node, c) => node.getFloatTimeDomainData(buffers[c]))
        const [left, right] = buffers
        let sl = 0; let sr = 0
        for (let k = 0; k < left.length; k += 1) {
          const l = left[k]; const r = right[k]
          sl += l * l; sr += r * r; cross += l * r
          if (Math.abs(l) > peak[0]) peak[0] = Math.abs(l)
          if (Math.abs(r) > peak[1]) peak[1] = Math.abs(r)
        }
        // A mono stream arrives on the left alone; every meter reads it as
        // the same signal in both channels.
        if (sr === 0 && sl > 0) { sr = sl; cross = sl; peak[1] = peak[0] }
        rms[0] = Math.sqrt(sl / left.length)
        rms[1] = Math.sqrt(sr / left.length)
        const target = {
          peak: Math.max(peak[0], peak[1]) > 0 ? 20 * Math.log10(Math.max(peak[0], peak[1])) : -40,
          balance: rms[0] > 0 && rms[1] > 0 ? 20 * Math.log10(rms[1] / rms[0]) : 0,
          phase: sl > 0 && sr > 0 ? cross / Math.sqrt(sl * sr) : 0,
          dynamics: 0,
        }
        const both = Math.sqrt((rms[0] ** 2 + rms[1] ** 2) / 2)
        if (both > 0) target.dynamics = target.peak - 20 * Math.log10(both)
        // Peak: up at once, down about 20 dB in 1.7 seconds at 60 frames.
        read.peak = target.peak > read.peak ? target.peak : Math.max(target.peak, read.peak - 0.2)
        read.balance += (target.balance - read.balance) * 0.08
        read.phase += (target.phase - read.phase) * 0.06
        read.dynamics += (target.dynamics - read.dynamics) * 0.05
      } else {
        for (const k of Object.keys(read)) read[k] += (REST[k] - read[k]) * 0.08
      }
      rms.forEach((level, c) => {
        const target = level > 0 ? 20 * Math.log10(level) + 18 : VU_MIN
        // A VU needle's swing: about 300ms to reach a steady level.
        vu[c] += (target - vu[c]) * 0.09
        const el = needles.current[c]
        if (el) el.setAttribute('transform', `rotate(${vuAngle(vu[c]).toFixed(2)} 100 118)`)
      })
      for (const meter of SMALL) {
        const el = small.current[meter.id]
        if (el) el.setAttribute('transform', `rotate(${smallAngle(meter, read[meter.id]).toFixed(2)} 60 72)`)
      }
      const moving = vu.some((v) => v > VU_MIN + 0.2) || Object.keys(read).some((k) => Math.abs(read[k] - REST[k]) > 0.02)
      if (playing || moving) frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  const ticks = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3]
  const numbered = new Set([-20, -10, -7, -5, -3, 0, 3])
  return (
    <div className="hf-vu" role="img" aria-label={label}>
      {['L', 'R'].map((side, c) => (
        <svg key={side} className="hf-vu-meter" viewBox="0 0 200 96" preserveAspectRatio="xMidYMid meet">
          <path className="hf-vu-arc" d={arc(-SWEEP / 2, vuAngle(0), 90, 100, 118)} />
          <path className="hf-vu-red" d={arc(vuAngle(0), SWEEP / 2, 90, 100, 118)} />
          {ticks.map((v) => {
            const a = vuAngle(v)
            return (
              <g key={v} transform={`rotate(${a} 100 118)`}>
                <line className="hf-vu-tick" x1="100" y1={118 - 90} x2="100" y2={118 - (numbered.has(v) ? 100 : 96)} data-red={v > 0 || undefined} />
                {numbered.has(v) && <text className="hf-vu-num" x="100" y={118 - 103} textAnchor="middle" data-red={v > 0 || undefined}>{v > 0 ? `+${v}` : v}</text>}
              </g>
            )
          })}
          <text className="hf-vu-label" x="100" y="74" textAnchor="middle">VU</text>
          <text className="hf-vu-side" x="12" y="90">{side}</text>
          <g ref={(el) => { needles.current[c] = el }} transform={`rotate(${-SWEEP / 2} 100 118)`}>
            <line className="hf-vu-needle" x1="100" y1="118" x2="100" y2="24" />
          </g>
        </svg>
      ))}
      <div className="hf-minimeters">
        {SMALL.map((meter) => (
          <svg key={meter.id} className="hf-mini" data-face={meter.face} viewBox="0 0 120 64" preserveAspectRatio="xMidYMid meet">
            <path className="hf-mini-arc" d={arc(-SMALL_SWEEP / 2, SMALL_SWEEP / 2, 44, 60, 72)} />
            {meter.red !== undefined && (
              <path className="hf-mini-red" d={meter.redBelow
                ? arc(-SMALL_SWEEP / 2, smallAngle(meter, meter.red), 44, 60, 72)
                : arc(smallAngle(meter, meter.red), SMALL_SWEEP / 2, 44, 60, 72)} />
            )}
            {meter.ticks.map((v) => (
              <g key={v} transform={`rotate(${smallAngle(meter, v)} 60 72)`}>
                <line className="hf-mini-tick" x1="60" y1={72 - 44} x2="60" y2={72 - 50} />
                {(meter.numbers || meter.ticks).includes(v) && <text className="hf-mini-num" x="60" y={72 - 53} textAnchor="middle">{meter.fmt(v)}</text>}
              </g>
            ))}
            {meter.ends && <><text className="hf-mini-end" x="8" y="60">{meter.ends[0]}</text><text className="hf-mini-end" x="112" y="60" textAnchor="end">{meter.ends[1]}</text></>}
            <text className="hf-mini-label" x="60" y="58" textAnchor="middle">{t(`hifi.meter.${meter.id}`)}</text>
            <g ref={(el) => { small.current[meter.id] = el }} transform={`rotate(${smallAngle(meter, REST[meter.id])} 60 72)`}>
              <line className="hf-mini-needle" x1="60" y1="72" x2="60" y2="24" />
            </g>
          </svg>
        ))}
      </div>
    </div>
  )
}

function arc(from, to, r, cx, cy) {
  const point = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`
  }
  return `M ${point(from)} A ${r} ${r} 0 0 1 ${point(to)}`
}
