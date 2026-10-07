import { useEffect, useState } from 'react'

// The parts of keyboard handling every shell needs, and none of the bindings.
//
// The bindings themselves are not shared and should not be: the desktop
// shells reproduce the S1 application's own list (KeyboardShortcutManager.cs)
// and Sonofuture has its own, with sections on Ctrl+1 to Ctrl+5 and a command
// palette on Ctrl+K. What they had in common was the three lines at the top of
// every handler, and those had drifted: the desktop shells' "am I typing?"
// test did not know about contenteditable, so a shortcut fired while a person
// was typing into one.

/** Whether the event came from somewhere text is being entered. */
export function isTyping(event) {
  const tag = event?.target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || Boolean(event?.target?.isContentEditable)
}

/** Whether the platform's command modifier is held. */
export function isCommand(event) {
  return Boolean(event?.metaKey || event?.ctrlKey)
}

/** The key, lowercased, so a handler never has to remember to. */
export function keyOf(event) {
  return String(event?.key || '').toLowerCase()
}

//: Shuffle flips within whatever repeat mode is on, rather than replacing it.
const SHUFFLE_FLIP = {
  NORMAL: 'SHUFFLE_NOREPEAT',
  SHUFFLE_NOREPEAT: 'NORMAL',
  REPEAT_ALL: 'SHUFFLE',
  SHUFFLE: 'REPEAT_ALL',
  REPEAT_ONE: 'SHUFFLE_REPEAT_ONE',
  SHUFFLE_REPEAT_ONE: 'REPEAT_ONE',
}

/** The play mode a shuffle toggle should move to from this one. */
export function shuffleToggled(mode) {
  return SHUFFLE_FLIP[mode] || 'SHUFFLE_NOREPEAT'
}

//: Repeat cycles off -> all -> one, keeping shuffle wherever it was. Written
//: out four times across two shells before this.
const REPEAT_CYCLE = {
  NORMAL: 'REPEAT_ALL',
  REPEAT_ALL: 'REPEAT_ONE',
  REPEAT_ONE: 'NORMAL',
  SHUFFLE_NOREPEAT: 'SHUFFLE',
  SHUFFLE: 'SHUFFLE_REPEAT_ONE',
  SHUFFLE_REPEAT_ONE: 'SHUFFLE_NOREPEAT',
}

/** The play mode a repeat press should move to from this one. */
export function repeatCycled(mode) {
  return REPEAT_CYCLE[mode] || 'REPEAT_ALL'
}

/**
 * Fullscreen, and whether we are in it.
 *
 * The Windows replica's maximize button and the Mac replica's green stud both
 * mean this, and both kept their own copy of it.
 */
export function useFullscreen() {
  const [isFull, setIsFull] = useState(
    () => (typeof document === 'undefined' ? false : Boolean(document.fullscreenElement)))
  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }
  return { isFull, toggle }
}
