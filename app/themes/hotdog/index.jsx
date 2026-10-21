import React from 'react'
import { Shell as DesktopShell } from './DesktopShell.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import TroubleshootingWindow from './Troubleshooting.jsx'
import strings from './strings.js'
import { tokens } from './tokens.js'
import './hotdog.css'
import thumbnail from './thumbnail.webp'

// Hot Dog Stand: the Sonos desktop controller in the Windows 3.1 color
// scheme of that name. The Windows shell is kept whole, title bar and all;
// only the colors change, to the red, yellow, black, and white the scheme
// used, with the square corners and white-and-black bevels of the period.

function Shell() {
  const { t } = useI18n()
  return (
    <DesktopShell rootClass="hd-root"
                  extraHelpItems={(open) => [{ id: 'troubleshoot', label: `${t('hotdog.troubleshoot')}…`, onSelect: () => open('troubleshoot') }]}
                  extraDialogs={(dialog, close, { systemFilter }) => (dialog?.kind === 'troubleshoot' ? <TroubleshootingWindow onClose={close} systemFilter={systemFilter} /> : null)} />
  )
}

export default {
  id: 'hotdog',
  name: 'Hot Dog Stand',
  thumbnail,
  description:
    'The desktop controller in the Windows 3.1 color scheme of the same name: '
    + 'red, yellow, black and white, square corners, bevelled buttons.',
  colorScheme: 'light',
  strings,
  tokens,
  Shell,
}
