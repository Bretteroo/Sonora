import { localOut } from './localOut.js'

// The sleep timer of "This browser".
//
// A speaker keeps its own sleep timer and stops itself when it runs out. The
// browser room has no speaker behind it, so the page keeps the timer: a
// deadline, and a timeout that stops the page's own output when it passes.
// It answers in the speakers' shape (a remaining ``H:MM:SS``, or ``""`` for
// none), so api.js can hand it to every sleep pane as if a player had said
// it, and no theme needs to know the difference.
//
// It lives only as long as the page. A reload ends the timer, and it also
// ends what was playing, since the page was the player.

/**
 * A sleep timer that calls `stop` when it runs out. The page has one, for
 * the browser room; the factory is what a check can run without an audio
 * element behind it.
 */
export function makeSleepTimer(stop) {
  let deadline = null
  let timer = null
  const listeners = new Set()
  const emit = () => { for (const fn of listeners) fn() }
  const api = {
    /** What is left, as the players report it: ``H:MM:SS``, or ``""``. */
    remaining() {
      if (deadline === null) return ''
      const left = (deadline - Date.now()) / 1000
      return left > 0 ? hms(left) : ''
    },

    /**
     * Start, replace or clear the timer. `duration` is ``H:MM:SS`` as the
     * panes send it to a speaker; empty or null clears it. When it runs out,
     * whatever the page is playing stops.
     */
    set(duration) {
      if (timer) { clearTimeout(timer); timer = null }
      const total = seconds(duration)
      deadline = total > 0 ? Date.now() + total * 1000 : null
      if (deadline !== null) {
        timer = setTimeout(() => {
          timer = null
          deadline = null
          stop()
          emit()
        }, total * 1000)
      }
      emit()
      return api.remaining()
    },

    /** Called whenever the timer is set, cleared or runs out. */
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  return api
}

function seconds(duration) {
  const parts = String(duration || '').split(':').map(Number)
  if (!parts.length || parts.some(Number.isNaN)) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function hms(total) {
  const s = Math.max(0, Math.ceil(total))
  const two = (n) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`
}

export const browserSleep = makeSleepTimer(() => localOut.stop())
