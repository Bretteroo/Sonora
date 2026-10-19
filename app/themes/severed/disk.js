import { useSyncExternalStore } from 'react'

// The console's hard drive: whatever has it working holds it busy until done, and the access
// lamp and the drive's sound follow. Holds are counted, so two searches at once keep it busy
// until the second ends.

let holds = 0
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

export function holdDisk() {
  holds += 1
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    holds -= 1
    emit()
  }
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDiskBusy() {
  return useSyncExternalStore(subscribe, () => holds > 0, () => false)
}
