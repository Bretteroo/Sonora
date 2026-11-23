import { useEffect, useState } from 'react'

// Whether this device is on a network, as far as the page can tell.
//
// The browser's own word (navigator.onLine) can be trusted when it says yes.
// Its no is another matter: Chrome for Android called itself offline on a
// phone that was reaching Sonora through a VPN (seen 2026-11-12), with the
// page loaded and its socket open. So a no stands only until Sonora answers
// a request made after it.
//
// `connected` is the store's: whether the page's socket to Sonora is open.
export default function useOnline(connected) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const [answered, setAnswered] = useState(false)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  useEffect(() => {
    setAnswered(false)
    if (online || !connected) return undefined
    let live = true
    const control = new AbortController()
    const timer = setTimeout(() => control.abort(), 5000)
    fetch('/api/health', { cache: 'no-store', signal: control.signal })
      .then((response) => { if (live && response.ok) setAnswered(true) })
      .catch(() => {})
    return () => { live = false; clearTimeout(timer); control.abort() }
  }, [online, connected])
  return online || answered
}
