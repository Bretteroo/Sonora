import { useSystem } from '../../frontend/src/lib/store.jsx'

// Hours, minutes, and seconds, as a counter shows them.
export function hms(seconds) {
  const total = Math.floor(seconds)
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

export function withShuffle(mode) {
  if (mode.includes('REPEAT_ONE')) return 'SHUFFLE_REPEAT_ONE'
  if (mode.includes('REPEAT_ALL')) return 'SHUFFLE'
  return 'SHUFFLE_NOREPEAT'
}

export function withoutShuffle(mode) {
  if (mode === 'SHUFFLE_REPEAT_ONE') return 'REPEAT_ONE'
  if (mode === 'SHUFFLE') return 'REPEAT_ALL'
  return 'NORMAL'
}

// The machine plays a queue straight through and has no repeat. A room another app has set to
// repeat is set back to play through whenever the machine starts something in it; shuffle stays.
export function withoutRepeat(mode) {
  if (mode === 'SHUFFLE' || mode === 'SHUFFLE_REPEAT_ONE') return 'SHUFFLE_NOREPEAT'
  if (mode === 'REPEAT_ALL' || mode === 'REPEAT_ONE') return 'NORMAL'
  return mode
}
export function playThrough(actions, zone) {
  const mode = zone?.transport?.play_mode
  if (!mode) return
  const want = withoutRepeat(mode)
  if (want !== mode) actions.setPlayMode(zone.uuid, want)
}

// Shuffle, repeat and crossfade for a room: what each is now, whether the
// speaker will take it, and the press that changes it.
export function useModes(zone) {
  const { actions } = useSystem()
  const tr = zone?.transport || {}
  const mode = tr.play_mode ?? 'NORMAL'
  const shuffled = mode.startsWith('SHUFFLE')
  const repeat = mode.includes('REPEAT_ONE') ? 'one' : mode.includes('REPEAT_ALL') || mode === 'SHUFFLE' ? 'all' : 'off'
  // Shuffle and Repeat go where the speaker says it takes them; before it has said, a queue.
  const canShuffle = Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_shuffle : tr.source === 'queue')
  const canRepeat = Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_repeat : tr.source === 'queue')
  const canCrossfade = Boolean(zone) && (typeof tr.can_crossfade === 'boolean' ? tr.can_crossfade
    : !['idle', 'tv', 'line_in', 'radio', 'service_stream', 'service_hls', 'grouped', 'unknown'].includes(tr.source))
  return {
    shuffled, repeat, crossfade: Boolean(tr.crossfade), canShuffle, canRepeat, canCrossfade,
    toggleShuffle: () => zone && actions.setPlayMode(zone.uuid, shuffled ? withoutShuffle(mode) : withShuffle(mode)),
    cycleRepeat: () => {
      if (!zone) return
      const base = repeat === 'off' ? 'REPEAT_ALL' : repeat === 'all' ? 'REPEAT_ONE' : 'NORMAL'
      actions.setPlayMode(zone.uuid, shuffled ? withShuffle(base) : base)
    },
    toggleCrossfade: () => zone && actions.setCrossfade(zone.uuid, !tr.crossfade),
  }
}
