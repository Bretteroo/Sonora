import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { Shell as DesktopShell } from './DesktopShell.jsx'
import Canyon from './Canyon.jsx'
import wordmark from '../../frontend/src/assets/wordmark-readme.png'
import landscape from './landscape.webp'
import { tokens } from './tokens.js'
import './sedona.css'
import thumbnail from './thumbnail.webp'
import strings from './strings.js'

// Sedona: the desktop controller, dressed as a desert section.
//
// It is the same application as the Windows theme -- the transport strip,
// the Rooms, Now Playing, Queue, and Music panes, every menu and dialog, the
// Mini Controller and the keyboard shortcuts -- so the Windows shell renders
// all of it and Sedona supplies the frame overhead and the skin: sky at the
// top, a mesa horizon, panes of sand capped with sedimentary bands, room
// tiles resting on the ground like boulders. Its one addition is the
// Troubleshooting survey, drawn as core samples, under Help.

function Sky({ title, openAbout, t }) {
  return (
    <div className="sd-frame">
      <div className="sd-sky" style={{ backgroundImage: `url(${landscape})` }}>
        <button type="button" className="sd-brand" onClick={openAbout} title={t('about.menu')}>
          <img src={wordmark} alt="Sonora" draggable="false" />
        </button>
        <span className="sd-title">{title}</span>
      </div>
    </div>
  )
}

// The Troubleshooting survey in a window of its own.
function SurveyWindow({ onClose }) {
  const { t } = useI18n()
  return (
    <div className="sd-survey-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dk-window sd-survey" role="dialog" aria-modal="true" aria-label={t('sedona.survey')}>
        <div className="dk-window-title">
          <div className="dk-lights"><button type="button" className="dk-light dk-light-close" onClick={onClose} aria-label={t('common.close')} /></div>
          <span>{t('sedona.survey')}</span>
        </div>
        <div className="dk-window-body sd-survey-body">
          <Canyon />
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { t } = useI18n()
  return (
    <DesktopShell
      rootClass="sd-root"
      frame={(ctx) => <Sky title={ctx.title} openAbout={ctx.openAbout} t={ctx.t} />}
      extraHelpItems={(open) => [
        { id: 'survey', label: `${t('sedona.survey')}…`, onSelect: () => open('survey') },
      ]}
      extraDialogs={(dialog, close) => (dialog?.kind === 'survey' ? <SurveyWindow onClose={close} /> : null)}
    />
  )
}

export default {
  id: 'sedona',
  name: 'Sedona',
  version: '1.0.0',
  thumbnail,
  description:
    'The desktop controller as a desert section: sky overhead, a mesa horizon, '
    + 'panes of sand capped with sedimentary bands and rooms resting on the '
    + 'ground like boulders. Everything the Windows theme does, in the arid palette.',
  colorScheme: 'light',
  strings,
  tokens,
  Shell,
}
