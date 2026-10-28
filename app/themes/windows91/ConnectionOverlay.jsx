import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'

// What the S1 desktop apps put over their panes when they cannot reach the
// household: main/connectionerrorsoverlay.xaml, a #0A0A0A cover with the
// wordmark over a 290px band that centers up to three 364px lines of text.
// Seen live in the Windows app with the VM's network link cut (2026-09-22):
// the transport strip stays drawn above it, "SONOS" stands at y=133, and the
// one line of body text -- "You need to be connected to a wired or wireless
// network to use Sonos. Check your network settings." -- wraps in two lines
// centered at y=291.
//
// Sonora shows it for the same reason the app does, the computer being off
// the network, and for the one the app never has: the page losing Sonora
// itself. The wordmark is Sonora's, set the way the web theme sets its own.
export default function ConnectionOverlay() {
  const { connected } = useSystem()
  const { t } = useI18n()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  if (online && connected) return null
  return (
    <div className="dk-lc" role="alert">
      <p className="dk-lc-mark" aria-hidden="true">SONORA</p>
      <div className="dk-lc-body">
        <p>{online ? t('desk.lc.noSonora') : t('desk.lc.noNetwork')}</p>
      </div>
    </div>
  )
}
