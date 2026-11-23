// The machine's sounds, made here in the browser from noise (no recording, and
// no tone, which would make them beeps). Every one draws its own pitch, timing,
// decay, and loudness, so no two are quite the same. Settings' Appearance page
// turns them off.
//
// A key going down is a light, crisp tick: the slim keys of this panel sit on
// rubber domes, so there is a soft press under a short click and little else.
//
// A leaf of the songbook going over is a breath of air that brightens as the
// leaf comes up and a soft slap as it lands; a riffle is one of those a leaf.

let audio = null
let noise = null

function context() {
  if (audio) return audio
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!Ctx) return null
  audio = new Ctx()
  // Half a second of white noise, made once; each tick plays a different stretch of it.
  noise = audio.createBuffer(1, Math.round(audio.sampleRate * 0.5), audio.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  return audio
}

const around = (value, spread) => value * (1 - spread + Math.random() * spread * 2)

// One burst of noise through a filter, rising at once and dying away over `decay` seconds.
function burst(ac, out, at, { type, frequency, q, level, decay }) {
  const source = ac.createBufferSource()
  source.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  const gain = ac.createGain()
  gain.gain.setValueAtTime(level, at)
  gain.gain.exponentialRampToValueAtTime(0.0005, at + decay)
  source.connect(filter).connect(gain).connect(out)
  source.start(at, Math.random() * 0.4, decay + 0.01)
}

// Gets the sound ready to be made: called on a touch of the page, which is the only time a
// browser lets a page start making sound.
export function soundReady() {
  const ac = context()
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
  return ac
}

// A key going down: a slim, light key on a rubber dome, not a deep one. A soft, short press of the
// dome giving way, the crisp tick of the key's plastic meeting its stop, and a faint second tick as
// it settles; very little underneath.
export function keyClick(weight = 1) {
  const ac = soundReady()
  if (!ac) return
  const now = ac.currentTime + 0.004
  const out = ac.createGain()
  out.gain.value = around(0.34, 0.15) * weight
  out.connect(ac.destination)
  // The dome giving way: a soft, short puff low in the plastic.
  burst(ac, out, now, { type: 'bandpass', frequency: around(900, 0.2), q: 0.9, level: around(1.1, 0.2), decay: around(0.014, 0.25) })
  // The key meeting its stop: a crisp tick.
  burst(ac, out, now + around(0.003, 0.4), { type: 'bandpass', frequency: around(2600, 0.2), q: around(1.6, 0.25), level: around(1.0, 0.2), decay: around(0.008, 0.3) })
  // Its edge: a very short, bright click on top.
  burst(ac, out, now + around(0.003, 0.4), { type: 'highpass', frequency: around(4200, 0.15), q: 0.7, level: around(0.35, 0.25), decay: around(0.0035, 0.3) })
  // Settling: a faint second tick a moment later.
  burst(ac, out, now + around(0.012, 0.35), { type: 'bandpass', frequency: around(2200, 0.25), q: 1.2, level: around(0.25, 0.3), decay: around(0.006, 0.3) })
}

// One leaf going over, `long` seconds of it: air through a filter that opens as the leaf comes
// up and closes as it falls, swelling and dying away, and the slap of the leaf landing.
function flap(ac, out, at, long) {
  const source = ac.createBufferSource()
  source.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = around(0.9, 0.2)
  filter.frequency.setValueAtTime(around(700, 0.25), at)
  filter.frequency.exponentialRampToValueAtTime(around(2600, 0.25), at + long * 0.6)
  filter.frequency.exponentialRampToValueAtTime(around(1100, 0.2), at + long)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0005, at)
  gain.gain.exponentialRampToValueAtTime(around(0.5, 0.3), at + long * 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0005, at + long)
  source.connect(filter).connect(gain).connect(out)
  source.start(at, Math.random() * 0.3, long + 0.01)
  burst(ac, out, at + long * 0.8, { type: 'bandpass', frequency: around(1700, 0.3), q: 0.8, level: around(0.35, 0.3), decay: around(0.018, 0.3) })
}

// The songbook's pages flying by: `leaves` of them, one every `step` milliseconds, each taking
// `leaf` milliseconds to go over. A leaf is heard for less time than it is seen: the leaves of a
// riffle are in the air together, and heard whole they would run into one hiss.
export function pageFlaps(leaves = 1, step = 75, leaf = 380) {
  const ac = soundReady()
  if (!ac) return
  const out = ac.createGain()
  out.gain.value = around(0.32, 0.1)
  out.connect(ac.destination)
  const now = ac.currentTime + 0.01
  const long = Math.min(leaf / 1000, Math.max(0.07, (step / 1000) * 1.5))
  // Each is heard as its leaf stands upright, a quarter of the way through its turn.
  for (let i = 0; i < leaves; i += 1) flap(ac, out, now + (i * step + leaf * 0.25) / 1000 + Math.random() * 0.008, around(long, 0.2))
}

// A microphone's plug going into a jack on a live amplifier: the scratch of the tip dragging over the
// contacts, then the thump of the speaker cone kicked as it seats, a short ring of feedback as the
// open microphone catches the room, and the mains hum the input lets through, which fades out slowly
// as the amplifier settles. Pulled out, a smaller scrape and thump.
function cone(ac, out, at, { frequency, level, decay }) {
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency * 1.6, at)
  osc.frequency.exponentialRampToValueAtTime(frequency, at + 0.03)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(level, at + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0005, at + decay)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + decay + 0.02)
}

function hum(ac, out, at, { level, rise, hold, fall }) {
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(level, at + rise)
  gain.gain.setValueAtTime(level, at + rise + hold)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + rise + hold + fall)
  gain.connect(out)
  // Mains hum is its base and the odd harmonics a transformer adds, the base quietest to small speakers.
  for (const [mult, part] of [[1, 0.5], [2, 1], [3, 0.6], [5, 0.25]]) {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = around(60, 0.004) * mult
    const g = ac.createGain()
    g.gain.value = part
    osc.connect(g).connect(gain)
    osc.start(at)
    osc.stop(at + rise + hold + fall + 0.05)
  }
}

// The scratch: a run of tiny crackles over a dragged, filtered hiss, swelling and fading.
function scratch(ac, out, at, long, level) {
  const source = ac.createBufferSource()
  source.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(around(2200, 0.2), at)
  filter.frequency.linearRampToValueAtTime(around(3400, 0.2), at + long)
  filter.Q.value = 1.2
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(level, at + long * 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + long)
  source.connect(filter).connect(gain).connect(out)
  source.start(at, Math.random() * 0.3, long + 0.02)
  for (let t = 0; t < long; t += around(0.013, 0.5)) {
    burst(ac, out, at + t, { type: 'bandpass', frequency: around(3200, 0.35), q: 1.6, level: around(level * 1.8, 0.5), decay: around(0.008, 0.4) })
  }
}

// Feedback: a tone the room and the microphone hold between them. It starts from almost nothing and
// grows, slowly and then faster, as each trip round the loop comes back louder; two paths through the
// room a hair apart in pitch make it beat; the amplifier, driven hard, roughens it. Then it is pulled
// back, as a hand on the volume would.
function feedback(ac, out, at, { frequency, level, grow, hold, cut }) {
  const shaper = ac.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i += 1) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 2.4) / Math.tanh(2.4) }
  shaper.curve = curve
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.setTargetAtTime(level, at, grow / 2.2)
  gain.gain.setValueAtTime(level, at + grow + hold)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + grow + hold + cut)
  const drive = ac.createGain()
  drive.gain.value = 0.55
  drive.connect(shaper).connect(gain).connect(out)
  for (const detune of [0, around(3.2, 0.3)]) {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequency + detune
    osc.connect(drive)
    osc.start(at)
    osc.stop(at + grow + hold + cut + 0.05)
  }
}

// No two go in alike: how long the tip drags, whether it catches once on the way, how hard the cone
// is kicked, whether the room rings back and for how long, and how long the hum lasts are drawn
// afresh each time. `scratchFor` is how long the drag lasts, in seconds; the shell, which also moves
// the plug, chooses it so the thump comes as the plug seats.
const between = (lo, hi) => lo + Math.random() * (hi - lo)
const FEEDBACK_HZ = 1046.5 // C6, the one note this room and microphone ring at
export function plugIn(scratchFor = 0.12) {
  const ac = soundReady()
  if (!ac) return
  const now = ac.currentTime + 0.004
  const out = ac.createGain()
  out.gain.value = between(0.4, 0.58)
  out.connect(ac.destination)
  const seat = now + scratchFor
  if (Math.random() < 0.3) {
    // the tip catches on the way in: a drag, a moment's stop, and the rest of it
    const first = scratchFor * between(0.3, 0.55)
    const gap = between(0.015, 0.04)
    scratch(ac, out, now, first, between(0.16, 0.28))
    scratch(ac, out, now + first + gap, Math.max(0.03, scratchFor - first - gap + 0.02), between(0.14, 0.26))
  } else {
    scratch(ac, out, now, scratchFor + 0.02, between(0.15, 0.3))
  }
  cone(ac, out, seat, { frequency: between(52, 78), level: between(0.45, 0.8), decay: between(0.13, 0.26) })
  burst(ac, out, seat, { type: 'lowpass', frequency: between(420, 640), q: 1, level: between(0.7, 1.3), decay: between(0.035, 0.06) })
  // The room rings back only some of the time, always on the one note this room and microphone make
  // between them, and for a different length each time it does.
  if (Math.random() < 0.6) {
    feedback(ac, out, seat + between(0.03, 0.12), { frequency: FEEDBACK_HZ, level: between(0.05, 0.1), grow: between(0.25, 0.65), hold: between(0.04, 0.25), cut: between(0.1, 0.25) })
  }
  hum(ac, out, seat + 0.01, { level: between(0.1, 0.16), rise: between(0.05, 0.12), hold: between(0.9, 1.8), fall: between(1.8, 3.2) })
}

export function plugOut() {
  const ac = soundReady()
  if (!ac) return
  const now = ac.currentTime + 0.004
  const out = ac.createGain()
  out.gain.value = 0.32
  out.connect(ac.destination)
  burst(ac, out, now, { type: 'bandpass', frequency: around(2800, 0.2), q: 0.8, level: around(0.4, 0.2), decay: around(0.05, 0.25) })
  cone(ac, out, now + 0.02, { frequency: around(70, 0.1), level: around(0.6, 0.1), decay: around(0.14, 0.15) })
}
