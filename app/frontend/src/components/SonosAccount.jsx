import './shared.css'
import React, { useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { useCloudAccount } from '../lib/useCloudAccount.js'

// Signing in to Sonos, worn by every settings page that has no form of its
// own. Like the theme chooser, each shell hands over its own class names and,
// where it has one, its own labeled-field component, so the same arrangement
// sits in the Windows dialog and in a web page in each one's dress.
//
// What it says matters as much as what it does: this is optional, it is the
// only part of Sonora that talks to Sonos, and the password is used once and
// not kept. A person deciding whether to type it needs all three.
function DefaultRow({ c, label, children }) {
  return (
    <div className={c.field}>
      <span className={c.label}>{label}</span>
      {children}
    </div>
  )
}

export default function SonosAccount({ classes = {}, title = null, Field = null }) {
  const { t } = useI18n()
  const { known, signedIn, email, busy, error, signIn, signOut } = useCloudAccount()
  const [form, setForm] = useState({ email: '', password: '' })

  const c = {
    field: 'dk-field', label: '', input: '', button: 'dk-win-btn', primary: 'dk-win-btn',
    blurb: 'dk-theme-blurb', error: 'dk-add-error', actions: 'dk-theme-actions',
    section: 'dk-theme-manage',
    ...classes,
  }
  // The default row is a component of its own (below), not one written here:
  // inline, it was new on every render, and the email and password boxes were
  // rebuilt, losing what was typed, whenever a playing track ticked
  // (found with ThemeChooser's).
  const Row = Field || DefaultRow
  const rowProps = Field ? {} : { c }

  const submit = async (event) => {
    event.preventDefault()
    if (await signIn(form.email, form.password)) setForm({ email: '', password: '' })
    else setForm((prev) => ({ ...prev, password: '' }))
  }

  // Nothing until the answer is in: a heading over an empty space that fills
  // in a moment later reads as a flash just as the sign-in form did.
  if (!known) return null

  return (
    <div className={`${c.section} account-block`}>
      <h4>{title || t('account.title')}</h4>
      <p className={`${c.blurb} account-blurb`}>{t('account.blurb')}</p>
      <p className={`${c.blurb} account-blurb`}>{t('account.optional')}</p>
      {error && <p className={c.error}>{error}</p>}
      {signedIn ? (
        <div className={c.actions}>
          <span>{t('account.signedInAs', { email })}</span>
          <button type="button" className={c.button} disabled={busy} onClick={signOut}>
            {t('account.signOut')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Row {...rowProps} label={t('account.email')}>
            <input className={c.input} type="email" autoComplete="username" required
                   aria-label={t('account.email')} value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Row>
          <Row {...rowProps} label={t('account.password')}>
            <input className={c.input} type="password" autoComplete="current-password" required
                   aria-label={t('account.password')} value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Row>
          <div className={c.actions}>
            <button type="submit" className={c.primary} disabled={busy || !form.email || !form.password}>
              {busy ? t('account.signingIn') : t('account.signIn')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
