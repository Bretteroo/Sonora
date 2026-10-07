import { useState } from 'react'
import { api } from './api.js'

// State for removing a service two independent ways: from Sonora (its sign-in
// and listing here) and from Sonos (the account on the household, for every
// app). Each side is offered only where the service actually lives:
// `sonoraLinked` gates the Sonora side, `onSystem` gates the Sonos side. Both
// sides start ticked where they are offered, so a service with a sign-in goes
// from both unless one is unticked. Confirm is possible only when a box that
// can do something is ticked.
//
// `single` names the one side there is when only one is offered: an
// anonymous service lives on the system alone, so removing it there takes it
// out of Sonora too. The dialogs then ask no question and show no boxes.
// `sonosLocked` withholds the Sonos side even though the service is on the
// system: several accounts of it are, and the speakers cannot be trusted to
// remove the right one from here, so that is left to the Sonos app.
export function useRemoveChoice({ sid, zone, accountId = '', sonoraLinked, onSystem,
                                  sonosLocked = false, onDone }) {
  const canSonora = Boolean(sonoraLinked)
  const canSonos = Boolean(onSystem) && !sonosLocked
  const [sonora, setSonora] = useState(canSonora)
  const [sonos, setSonos] = useState(canSonos)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fromSonora = sonora && canSonora
  const fromSystem = sonos && canSonos
  const canConfirm = fromSonora || fromSystem
  const single = canSonora === canSonos ? null : canSonos ? 'sonos' : 'sonora'

  const submit = async () => {
    if (!canConfirm || busy) return
    setBusy(true); setError('')
    try {
      await api.removeService(sid, {
        zone, account_id: accountId || '',
        from_sonora: fromSonora, from_system: fromSystem,
      })
      onDone?.()
    } catch (exc) {
      setError(exc.message); setBusy(false)
    }
  }

  return { canSonora, canSonos, sonora, setSonora, sonos, setSonos,
           busy, error, canConfirm, single, submit }
}
