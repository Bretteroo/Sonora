// The machine's sounds, made here in the browser from noise (no recording, and
// no tone, which would make them beeps). Every one draws its own pitch, timing,
// decay, and loudness, so no two are quite the same. Settings' Appearance page
// turns them off.
//
// A key going down is a deep plastic clunk: the thump of the key meeting the
// chassis, a knock from the plastic around it, a small tick on top, and a
// softer knock a few thousandths of a second later as the key settles.
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

export function keyClick(weight = 1) {
  const ac = soundReady()
  if (!ac) return
  const now = ac.currentTime + 0.004
  const out = ac.createGain()
  out.gain.value = around(0.42, 0.15) * weight
  out.connect(ac.destination)
  // The key meeting the chassis: a low thump. So little of the noise is this low that it is
  // turned up well past the rest to be heard under them.
  burst(ac, out, now, { type: 'lowpass', frequency: around(360, 0.2), q: 1, level: around(5, 0.15), decay: around(0.04, 0.25) })
  // The plastic around it: a hollow knock.
  burst(ac, out, now, { type: 'bandpass', frequency: around(760, 0.25), q: around(1.4, 0.3), level: around(1.6, 0.2), decay: around(0.02, 0.3) })
  // The edge of the click: a small tick, well below where a bright one would sit.
  burst(ac, out, now, { type: 'bandpass', frequency: around(1300, 0.25), q: 0.8, level: around(0.5, 0.25), decay: around(0.007, 0.3) })
  // Settling: a softer knock a moment later.
  burst(ac, out, now + around(0.011, 0.4), { type: 'bandpass', frequency: around(900, 0.3), q: 1, level: around(0.45, 0.35), decay: around(0.01, 0.3) })
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
