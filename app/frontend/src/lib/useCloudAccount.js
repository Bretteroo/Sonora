import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { useSystem } from './store.jsx'

// The one Sonos account Sonora holds, and the three things a person does with
// it: see whether it is signed in, sign in, sign out.
//
// Signing in is optional and is the only part of Sonora that talks to Sonos'
// servers. It fills in what the speakers cannot say for themselves: which
// services a system has configured, their logos, and which input a soundbar's
// television audio arrives on. The password is used once and never kept; the
// session that comes back is, so a restart stays signed in.
//
// A fresh sign-in changes what the speakers can tell us, so the household is
// rescanned after both sign-in and sign-out.

// The answer, kept for the life of the page and asked for once.
//
// It used to be fetched when a settings page mounted, which is the moment it
// is about to be drawn -- so the account section could not be drawn on the
// first paint and appeared a moment later instead. Hiding the section until
// the answer arrived only turned a flash of the wrong content into a section
// snapping into view, which is what the third report of this called it.
//
// So the request goes out when this module is first imported, which is while
// the app is starting, and every later mount reads the answer that is already
// here. Opening Settings then draws the account section complete, first paint,
// nothing moving.
let cache = { status: null, known: false }
let inflight = null

/** Note an answer that came from somewhere other than the fetch above. */
function remember(answer) {
  cache = { status: answer, known: true }
  return answer
}

function load() {
  if (inflight) return inflight
  inflight = api.cloudStatus()
    .then((answer) => { cache = { status: answer, known: true }; return answer })
    .catch(() => { cache = { status: null, known: true }; return null })
    .finally(() => { inflight = null })
  return inflight
}

// Fired on import rather than on mount: by the time anyone opens Settings the
// answer is in hand. One small GET that every settings page was making anyway.
load()

export function useCloudAccount() {
  const { actions } = useSystem()
  const [status, setStatus] = useState(() => cache.status)
  // Whether the answer has come back at all, which is not the same as the
  // answer being "no". Without this every settings page drew the sign-in form
  // for the length of one fetch and then snapped to "signed in as ...",
  // because `null` and "signed out" both read as not signed in (reported on a
  // phone, where the fetch takes long enough to see).
  const [known, setKnown] = useState(() => cache.known)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    // A failed answer is still an answer: it resolves to signed out rather
    // than leaving the page waiting for one that will not come.
    load().then(() => { setStatus(cache.status); setKnown(true) })
  }, [])
  useEffect(refresh, [refresh])

  const signIn = useCallback(async (email, password) => {
    setBusy(true); setError('')
    try {
      setStatus(remember(await api.cloudLogin(email, password)))
      actions.refresh()
      return true
    } catch (exc) {
      setError(exc?.message || String(exc))
      return false
    } finally {
      setBusy(false)
    }
  }, [actions])

  const signOut = useCallback(async () => {
    setBusy(true); setError('')
    try {
      setStatus(remember(await api.cloudLogout()))
      actions.refresh()
    } catch (exc) {
      setError(exc?.message || String(exc))
    } finally {
      setBusy(false)
    }
  }, [actions])

  return { status, known, signedIn: Boolean(status?.signed_in), email: status?.email || '',
           busy, error, signIn, signOut, refresh }
}
