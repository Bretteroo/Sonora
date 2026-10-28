import React from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { Shell as DesktopShell } from './DesktopShell.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import TroubleshootingWindow from './Troubleshooting.jsx'
import strings from './strings.js'
import { tokens } from './tokens.js'
import './coromar.css'
import thumbnail from './thumbnail.webp'

// Coromar, the default theme, wearing the building it is named for: the Sonos
// headquarters at 301 Coromar Drive in Goleta. The window is that elevation
// read top to bottom -- the coping's dark tan reveal, the light tan band the
// building carries its name on (301 and the name letterspaced, as the sign is
// set), the taupe spandrel, then the blue-green glazing in the transport
// strip, the tilt-up concrete of the panes, and the stacked sandstone veneer
// as a base course along the foot of the window. It wears the Windows shell
// whole: the strip, the Rooms, Now Playing, Queue, and Music panes, every menu
// and dialog, the Mini Controller, the shortcuts.

function Top({ title, openAbout, t }) {
  const { connected, zoneList } = useSystem()
  return (
    <header className="co-top">
      <button type="button" className="co-brand" onClick={openAbout} title={t('about.menu')}>
        <span className="co-brand-num" aria-hidden="true">301</span>
        <span className="co-brand-name">Sonora</span>
      </button>
      <span className="co-title">{title}</span>
      <span className="co-link" data-off={!connected}>
        <i aria-hidden="true" />
        {connected ? t.plural('common.rooms', zoneList.length) : t('common.reconnecting')}
      </span>
    </header>
  )
}

function Shell() {
  const { t } = useI18n()
  return (
    <DesktopShell rootClass="co-root" frame={(ctx) => <Top title={ctx.title} openAbout={ctx.openAbout} t={ctx.t} />}
                  extraHelpItems={(open) => [{ id: 'troubleshoot', label: `${t('coromar.troubleshoot')}…`, onSelect: () => open('troubleshoot') }]}
                  extraDialogs={(dialog, close, { systemFilter }) => (dialog?.kind === 'troubleshoot' ? <TroubleshootingWindow onClose={close} systemFilter={systemFilter} /> : null)} />
  )
}

export default {
  id: 'coromar',
  name: 'Coromar',
  thumbnail,
  description: "Sonora's own default: light concrete, navy glass, tilt-up concrete walls, and stacked stone veneers. Inspired by the seaside office building Sonos calls home.",
  colorScheme: 'light',
  strings,
  tokens,
  Shell,
}
