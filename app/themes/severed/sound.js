import { readPrefs } from './prefs.js'
import keysUrl from './sounds/keys.ogg?url'

// The sound of a key on the console is a real keyboard's: eight presses and
// their eight releases cut from recordings of single keystrokes (see
// THIRD-PARTY-NOTICES.md), one file, each press picking one of the eight at
// random, a shade higher or lower and louder or softer each time. The drives'
// sounds below are made on the spot from noise and tones.
//
// The audio context is made at the first press, which is also the first
// gesture a browser will let a page make sound from. It is the theme's own,
// apart from the one the "This browser" room plays music through.

let ctx = null
let noise = null
let enabled = readPrefs().sound
if (typeof window !== 'undefined') {
  window.addEventListener('sonora:svprefs', (event) => { enabled = (event.detail || readPrefs()).sound })
}

// Safari can stop a context while the page stays open: `interrupted` after sleep, a call, or a
// change of output, and now and then `closed`. Each sound wakes it from anything but running, and
// a closed one is replaced, the hard drive's voice with it.
function audio() {
  if (ctx && ctx.state === 'closed') { ctx = null; drive = null }
  if (ctx) {
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    return ctx
  }
  const Context = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!Context) return null
  try { ctx = new Context({ latencyHint: 'interactive' }) } catch { return null }
  // Half a second of white noise, made once and read from at a different place each press.
  const length = Math.floor(ctx.sampleRate / 2)
  noise = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = noise.getChannelData(0)
  let seed = 22695477
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    data[i] = (seed / 1073741824) - 1
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {})
  return ctx
}

// A burst of noise through a filter, shaped by a fast attack and a decay.
function burst(ac, out, at, { type, frequency, q = 1, gain, decay, peak = null }) {
  const source = ac.createBufferSource()
  source.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  let tail = filter
  if (peak) {
    const shelf = ac.createBiquadFilter()
    shelf.type = 'peaking'
    shelf.frequency.value = peak.frequency
    shelf.Q.value = peak.q
    shelf.gain.value = peak.gain
    filter.connect(shelf)
    tail = shelf
  }
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.0015)
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  source.connect(filter)
  tail.connect(env).connect(out)
  source.start(at, Math.random() * 0.4, decay + 0.02)
}

// A short tone whose pitch falls, for the body of the key.
function thump(ac, out, at, { from, to, gain, decay }) {
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + decay * 0.6)
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + 0.003)
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + decay + 0.02)
}

// Where each press and release lies in the file, in seconds: [start, length].
const KEY_CUTS = {
  down: [[0.05, 0.07], [0.17, 0.07], [0.29, 0.07], [0.41, 0.07], [0.53, 0.07], [0.65, 0.0679], [0.7679, 0.0688], [0.8867, 0.07]],
  up: [[1.0067, 0.06], [1.1167, 0.06], [1.2267, 0.06], [1.3367, 0.06], [1.4467, 0.06], [1.5567, 0.06], [1.6667, 0.06], [1.7767, 0.06]],
}
// The file is fetched and decoded as soon as the sounds are on, through a context of its own that
// needs no gesture, so the first press already has it; an AudioBuffer plays in any context.
let keys = null
let keysLoading = false
function loadKeys() {
  if (keys || keysLoading || typeof window === 'undefined') return
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) return
  keysLoading = true
  fetch(keysUrl).then((r) => r.arrayBuffer())
    .then((data) => new Offline(1, 1, 48000).decodeAudioData(data))
    .then((buffer) => { keys = buffer })
    .catch(() => { keysLoading = false })
}
if (enabled) loadKeys()
if (typeof window !== 'undefined') window.addEventListener('sonora:svprefs', () => { if (enabled) loadKeys() })

// `weight` is the key's size: a long bar sounds a little lower and louder than a small key.
export function keySound(kind = 'down', weight = 1) {
  if (!enabled) return
  const ac = audio()
  if (!ac) return
  if (!keys) { loadKeys(); return }
  // Firefox's audio clock moves in steps of about 11 ms and the block after its reading is often
  // already made: a sound set to start inside it would lose its first milliseconds, the click
  // itself. It is set more than two steps ahead.
  const at = ac.currentTime + 0.025
  const cuts = KEY_CUTS[kind === 'up' ? 'up' : 'down']
  const [start, length] = cuts[Math.floor(Math.random() * cuts.length)]
  const source = ac.createBufferSource()
  source.buffer = keys
  source.playbackRate.value = (0.97 + Math.random() * 0.06) / Math.pow(weight, 0.12)
  const out = ac.createGain()
  out.gain.value = 0.45 * Math.min(1.3, Math.sqrt(weight)) * (0.85 + Math.random() * 0.15)
  source.connect(out).connect(ac.destination)
  source.start(at, start, length)
  source.onended = () => out.disconnect()
}

// The hard drive, as a desk machine's sounded in the nineties: no hum, only the head arm. The
// voice coil that throws the arm across the platters buzzes as it moves, a reedy note near
// 330 Hz, mostly its odd overtones and loudest around 1 kHz, and every step the arm takes
// is a tick in that buzz, a few milliseconds apart. A seek is a run of one tick to a dozen; each
// rings out in a few tens of milliseconds. The access lamp calls `driveSeek` each time it
// lights, so the two keep time.
let drive = null

export function driveSpin(on) {
  if (!on) {
    if (!drive) return
    const { out } = drive
    drive = null
    setTimeout(() => out.disconnect(), 400)
    return
  }
  if (drive || !enabled) return
  const ac = audio()
  if (!ac) return
  const out = ac.createGain()
  out.gain.value = 0.55
  out.connect(ac.destination)
  drive = { ac, out }
}

// One seek: a square wave at the coil's note, shaped by the run of ticks, then pushed toward
// its 1 kHz overtone as the drive's cover carries it.
export function driveSeek() {
  if (!enabled || !drive) return
  const { ac, out } = drive
  const start = ac.currentTime + 0.025
  const roll = Math.random()
  const ticks = roll < 0.45 ? 1 : roll < 0.75 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 8)
  const osc = ac.createOscillator()
  osc.type = 'square'
  osc.frequency.value = 320 + Math.random() * 20
  const tone = ac.createBiquadFilter()
  tone.type = 'peaking'
  tone.frequency.value = 990
  tone.Q.value = 2
  tone.gain.value = 9
  const top = ac.createBiquadFilter()
  top.type = 'lowpass'
  top.frequency.value = 4000
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, start)
  let at = start
  for (let i = 0; i < ticks; i += 1) {
    const level = 0.05 + Math.random() * 0.04
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(level, at + 0.0006)
    const ring = i === ticks - 1 ? 0.03 + Math.random() * 0.02 : 0.004
    env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(ring, 0.004))
    at += i === ticks - 1 ? ring : 0.0045 + Math.random() * 0.003
  }
  osc.connect(tone).connect(top).connect(env).connect(out)
  osc.start(start)
  osc.stop(at + 0.02)
  // The step itself: a dry click under the buzz at the first tick.
  burst(ac, out, start, { type: 'bandpass', frequency: 1000, q: 1.5, gain: 0.14, decay: 0.005 })
}

// The floppy drive. Eject: the latch lets go with a click, then the eject motor runs for the half
// second the disk takes to come out. Insert: the motor runs for the half second the disk takes to
// go in, and the latch clicks home as it seats. The motor's timing is the animation's (severed.css,
// sv-disk-out and sv-disk-in).
function floppyMotor(ac, out, at, { seconds, from, to }) {
  // A small DC motor through a gear train: a triangle at its turning note with a square under it
  // for bite, the commutator's ripple over both at fifty-odd hertz, a gear whine high above, and
  // the carriage's rattle over the rails as noise.
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(1, at + 0.04)
  env.gain.setValueAtTime(1, at + seconds - 0.07)
  env.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2600
  tone.connect(env).connect(out)
  const ripple = ac.createGain()
  ripple.gain.value = 0.75
  const lfo = ac.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 52
  const depth = ac.createGain()
  depth.gain.value = 0.25
  lfo.connect(depth).connect(ripple.gain)
  ripple.connect(tone)
  const voice = (type, scale, gain) => {
    const osc = ac.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from * scale, at)
    osc.frequency.exponentialRampToValueAtTime(to * scale, at + seconds * 0.8)
    const g = ac.createGain()
    g.gain.value = gain
    osc.connect(g).connect(ripple)
    osc.start(at)
    osc.stop(at + seconds + 0.02)
    return osc
  }
  voice('triangle', 1, 0.16)
  voice('square', 2, 0.035)
  voice('sine', 6, 0.03)
  lfo.start(at)
  lfo.stop(at + seconds + 0.02)
  burst(ac, out, at + 0.02, { type: 'bandpass', frequency: 3300, q: 0.9, gain: 0.09, decay: seconds - 0.04 })
}
function floppyClick(ac, out, at) {
  thump(ac, out, at, { from: 230, to: 105, gain: 0.5, decay: 0.055 })
  burst(ac, out, at, { type: 'lowpass', frequency: 2600, q: 0.7, gain: 0.9, decay: 0.03 })
  burst(ac, out, at + 0.004, { type: 'bandpass', frequency: 3400, q: 2, gain: 0.45, decay: 0.012 })
}
export function floppySound(kind = 'eject') {
  if (!enabled) return
  const ac = audio()
  if (!ac) return
  const at = ac.currentTime + 0.025
  const out = ac.createGain()
  out.gain.value = 0.4
  out.connect(ac.destination)
  if (kind === 'eject') {
    floppyClick(ac, out, at)
    floppyMotor(ac, out, at + 0.1, { seconds: 0.5, from: 390, to: 470 })
  } else {
    floppyMotor(ac, out, at, { seconds: 0.5, from: 460, to: 380 })
    floppyClick(ac, out, at + 0.5)
  }
  setTimeout(() => out.disconnect(), 1200)
}
