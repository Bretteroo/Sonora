import React, { useState } from 'react'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import ParentalControls from '../../frontend/src/components/ParentalControls.jsx'

// The Windows app's Parental Controls tab, rebuilt from its own XAML
// (s1win-2018/91-xaml/settingsmenu/settingswindow.xaml, TabItem
// `parentalControlSettings`, every word from strings.xaml beside it).
//
// The tab is in the 9.1 build and gone from the 57.23 one these themes
// replicate; it is here because the user asked for Parental Controls in every
// theme, and the app's own design is what it should look like
// rather than something invented.
//
// The XAML's arrangement, kept: the page header, then a white panel (its
// Grid is Margin 16,20,16,20) holding four Auto rows -- a body paragraph
// with 12 under it, an empty row, the action button (Width 260, centered,
// 10 above) and More Information (Width 260, centered, 20 above). Three body
// texts and two button labels, chosen by the two bindings the app uses:
//
//   FilterContentEnabled true  -> "...is enabled. Click the button below to
//     allow explicit content..." with the button reading Turn Explicit
//     Filtering Off.
//   FilterContentEnabled false -> "...is disabled. Click the button below to
//     prevent explicit content..." with the button reading Turn Explicit
//     Filtering On.
//   FilteringServicesAvailable false -> the "no services" sentence with the
//     action button Collapsed.
//
// That third state is the one Sonora leaves out. The app counts the services
// that filter from a list inside its core that no protocol field exposes, so
// claiming there are none would be a guess; a system whose setting will not
// read takes the button away instead.
const WIN_CLASSES = {
  section: 'win-parental', body: 'win-parental-body', note: 'win-parental-note',
  button: 'dk-win-btn win-parental-btn', error: 'dk-add-error',
  picker: 'win-settings-for win-lib-system',
}

export default function WinParental({ households = [] }) {
  const { t } = useI18n()
  // One system at a time, and the chooser sits above the panel rather than
  // inside it -- where this window's other pages put theirs.
  const ordered = orderedHouseholds(households)
  const [system, setSystem] = useState(null)
  const active = system && ordered.some((h) => h.id === system) ? system : chosenHousehold(ordered)
  return (
    <>
      <h3>{t('win.parental.title')}</h3>
      {systemChoiceMatters(households) && (
        <div className="win-settings-for win-lib-system">
          <select value={active || ''} onChange={(e) => setSystem(e.target.value)}>
            {ordered.map((h) => <option key={h.id} value={h.id}>{h.generation}</option>)}
          </select>
        </div>
      )}
      <div className="win-settings-panel win-parental-panel">
        <ParentalControls shape="button" showTitle={false} classes={WIN_CLASSES}
                          system={active} onSystem={setSystem} />
      </div>
    </>
  )
}
