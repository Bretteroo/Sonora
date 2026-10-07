import React, { useCallback, useState } from 'react'
import Arrangement from './Arrangement.jsx'
import { useShellContext, shellFacts } from '../lib/useShellContext.js'
import { useCloudAccount } from '../lib/useCloudAccount.js'
import { Confirm, GroupRooms, TrackInfo } from './Dialogs.jsx'
import TransientMessage from '../components/TransientMessage.jsx'
import './desktop.css'
import './window-chrome.css'
import './responsive.css'

// The shell an installed theme gets when its package carries a layout.
//
// A package may not carry code, so it cannot bring overlays -- those stay
// here, in Sonora's own hands, which is also the agreed division: a layout
// says where things go, a shell answers what to open. The layout is the only
// part of this that comes from the package, and it has already been validated
// twice by the time it arrives: once by the backend at the gate, once by the
// renderer before it draws.
export default function LayoutShell({ layout, theme }) {
  const [dialog, setDialog] = useState(null)
  const [transient, setTransient] = useState('')
  const onOpen = useCallback((kind, payload) => {
    if (kind === 'message') { setTransient(payload || ''); return }
    setDialog({ kind, payload })
  }, [])
  const context = useShellContext({ onOpen })
  // `signedIn` is a fact a layout may test, so it has to be answered.
  // It was not until now: shellFacts defaults it to false and nobody
  // passed it, which made `when: {signedIn: true}` a node that never drew.
  const { signedIn } = useCloudAccount()
  const facts = shellFacts(context, { signedIn })

  return (
    <div className="dk-root pt-root">
      <Arrangement arrangement={layout} theme={theme} context={context} facts={facts} />
      <TransientMessage text={transient} onDone={() => setTransient('')} />
      {dialog?.kind === 'group' && (
        <GroupRooms group={dialog.payload} zones={context.zones}
                    households={context.households} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'info' && (
        <TrackInfo zone={context.zone} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'pauseAll' && (
        <Confirm title="Pause all" body="Pause every room that is playing?" action="Pause"
                 onConfirm={() => {
                   for (const group of context.allGroups) {
                     if (group.transport?.state === 'PLAYING') context.actions.pause(group.coordinator)
                   }
                   setDialog(null)
                 }}
                 onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
