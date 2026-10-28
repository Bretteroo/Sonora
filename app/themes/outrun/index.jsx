import React from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { Shell as DesktopShell } from './DesktopShell.jsx'
import Diagnostics from './Diagnostics.jsx'
import { tokens } from './tokens.js'
import './outrun.css'
import thumbnail from './thumbnail.webp'
import strings from './strings.js'

// Outrun: the desktop controller in the Outrun aesthetic -- a synthwave
// sunset with a striped sun sinking into a perspective grid across the top,
// deep indigo grounds, neon magenta and cyan for edges and selection. It wears
// the Windows shell (the transport strip, the Rooms, Now Playing, Queue and
// Music panes, every menu and dialog, the Mini Controller, the shortcuts) and
// keeps Troubleshoot, the view that treats the network the speakers depend on
// as a first-class subject, under Help.

function Top({ title, openAbout, t }) {
  const { connected, zoneList } = useSystem()
  return (
    <header className="or-top">
      <div className="or-sun" aria-hidden="true" />
      <div className="or-grid" aria-hidden="true" />
      <button type="button" className="or-brand" onClick={openAbout} title={t('about.menu')}>
        Sonora
      </button>
      <span className="or-top-title">{title}</span>
      <span className="or-link-state">
        <span className="or-dot" data-off={!connected} />
        {connected ? t.plural('common.rooms', zoneList.length) : t('common.reconnecting')}
      </span>
    </header>
  )
}

function DiagnosticsWindow({ onClose, systemFilter }) {
  const { t } = useI18n()
  return (
    <div className="or-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dk-window or-diag-window" role="dialog" aria-modal="true" aria-label={t('outrun.troubleshoot')}>
        <div className="dk-window-title">
          <div className="dk-lights"><button type="button" className="dk-light dk-light-close" onClick={onClose} aria-label={t('common.close')} /></div>
          <span>{t('outrun.troubleshoot')}</span>
        </div>
        <div className="dk-window-body or-diag-body">
          <Diagnostics systemFilter={systemFilter} />
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { t } = useI18n()
  return (
    <DesktopShell
      rootClass="or-root"
      frame={(ctx) => <Top title={ctx.title} openAbout={ctx.openAbout} t={ctx.t} />}
      extraHelpItems={(open) => [{ id: 'diag', label: `${t('outrun.troubleshoot')}…`, onSelect: () => open('diag') }]}
      extraDialogs={(dialog, close, { systemFilter }) => (dialog?.kind === 'diag' ? <DiagnosticsWindow onClose={close} systemFilter={systemFilter} /> : null)}
    />
  )
}

export default {
  id: 'outrun',
  name: 'Outrun',
  thumbnail,
  description: 'A synthwave sunset, neon, lasers, and a nostalgic feeling. Quintessential Outrun.',
  colorScheme: 'dark',
  strings,
  tokens,
  Shell,
}
