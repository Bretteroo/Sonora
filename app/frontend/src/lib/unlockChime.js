// The chime for unlocking a hidden theme: two struck glass bells a fifth
// apart (E6, then B6), made in the browser with Web Audio so it needs no sound
// file. It plays in the page that typed the code, never on the speakers, and
// only from inside the keypress that unlocked it, so the browser lets it sound.

function bell(ctx, out, t, f, gain, length) {
  // Two-operator FM: an inharmonic modulator gives the struck-metal edge.
  const carrier = ctx.createOscillator()
  const modulator = ctx.createOscillator()
  const depth = ctx.createGain()
  const level = ctx.createGain()
  carrier.frequency.value = f
  modulator.frequency.value = f * 3.5
  depth.gain.setValueAtTime(f * 2.2, t)
  depth.gain.exponentialRampToValueAtTime(1, t + length)
  modulator.connect(depth).connect(carrier.frequency)
  level.gain.setValueAtTime(0, t)
  level.gain.linearRampToValueAtTime(gain, t + 0.004)
  level.gain.exponentialRampToValueAtTime(0.0001, t + length)
  carrier.connect(level).connect(out)
  carrier.start(t)
  modulator.start(t)
  carrier.stop(t + length + 0.05)
  modulator.stop(t + length + 0.05)
}

export function playUnlockChime() {
  const Context = window.AudioContext || window.webkitAudioContext
  if (!Context) return
  try {
    const ctx = new Context()
    const out = ctx.createGain()
    out.gain.value = 0.8
    out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination)
    const t = ctx.currentTime + 0.03
    bell(ctx, out, t, 1318.5, 0.25, 1.6)
    bell(ctx, out, t + 0.16, 1975.5, 0.22, 2)
    setTimeout(() => ctx.close(), 2500)
  } catch {
    // No sound is no loss: the theme still unlocks.
  }
}
