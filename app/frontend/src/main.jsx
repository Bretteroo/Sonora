// First, so Sonora's own URLs carry Home Assistant's prefix before anything
// asks for one (lib/base.js).
import './lib/base.js'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { SystemProvider } from './lib/store.jsx'
import { ThemeProvider, useTheme } from './lib/theme.jsx'
import { I18nProvider } from './i18n/index.jsx'
import './styles/base.css'
import { installWheelRange } from './lib/wheelRange.js'

// A new boundary for each theme, so picking another on the crash screen
// draws it rather than the crash screen again.
function Guarded() {
  const { themeId } = useTheme()
  return <ErrorBoundary key={themeId}><App /></ErrorBoundary>
}

// Volume sliders follow the mouse wheel in every theme (lib/wheelRange.js).
installWheelRange()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* The theme is outermost because a theme brings its own words as well as
        its own shell: the catalog is the core one with the chosen theme's
        strings laid over it. It also says whether the browser room is offered
        at all -- one that sets localOutput false shows only the rooms the
        systems report -- which the system state below needs to know. */}
    <ThemeProvider>
      <I18nProvider>
        <SystemProvider>
          <Guarded />
        </SystemProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
