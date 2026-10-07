import React, { useEffect, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { RemoveServiceDialog, Window } from './Dialogs.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'

// Service Settings as the Windows app lays it out (settingswindow.xaml,
// captured 2026-09-05): the page title, a white bordered panel holding the
// bold "My Service Accounts on Sonos", two instruction lines, a Service Name
// / Name / Account Login table (18px logo, name in link blue) and, at its
// right, Add and Sonos Labs, then Edit, Remove, Replace, Reauthorize.
//
// Which of those four are live follows the selected row, as the app's do:
// each is bound to a CanExecute that reads a flag off the selected account
// (SettingsWindow.cs), and with nothing selected all four are dead. Measured
// row by row against the app on 2026-09-12, over nine accounts:
//
//   Remove        every selected row          (SCLib's CanRemove is just true)
//   Edit          every account-bearing row   (CanEdit = it has edit actions)
//   Reauthorize   every account-bearing row   (CanReauthorize)
//   Replace       none of them
//
// "Account-bearing" tracked the auth kind exactly: the four Anonymous
// services offered neither Edit nor Reauthorize, the five DeviceLink and
// AppLink ones offered both. Sonora can do Remove, Reauthorize -- a fresh
// link against the same account id, which is what the app's reauthorize
// wizard is -- and Edit, which renames the account. Replace stays grayed:
// the app offered it nowhere.
export default function Services({ households, onAdd, onChanged }) {
  const { t } = useI18n()
  // The speakers announce a change to the household's services -- a service
  // added, removed or renamed in any app -- and the table follows it while it
  // is open, rather than showing what was true when it was opened.
  const { servicesEpoch } = useSystem()
  const [byHh, setByHh] = useState(null)
  const [tab, setTab] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [labs, setLabs] = useState(false)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let canceled = false
    api.services().then((r) => {
      if (canceled) return
      const map = {}
      for (const hh of r.households || []) map[hh.household] = hh.in_use || []
      setByHh(map)
    }).catch(() => { if (!canceled) setByHh({}) })
    return () => { canceled = true }
  }, [version, servicesEpoch])
  const ordered = orderedHouseholds(households)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const services = [...((byHh && byHh[activeTab]) || [])]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const keyOf = (s) => `${s.id}-${s.account_id ?? ''}`
  const highlighted = services.find((s) => keyOf(s) === selected) || null
  const zoneFor = () => households.find((h) => h.id === activeTab)?.zone_uuids?.[0]
  // The app prints "<Anonymous>" for services without an account and "-"
  // where a login exists but is not shown.
  const login = (s) => (s.auth === 'Anonymous' ? t('win.services.anonymous') : '-')
  const nickname = (s) => (s.auth === 'Anonymous' ? '' : (s.nickname || ''))
  // An anonymous service has no account to edit or re-authorize.
  const account = highlighted && highlighted.auth !== 'Anonymous' ? highlighted : null
  // The speakers have taken the new name by the time Done returns, so the
  // table shows it at once rather than waiting on the refetch behind it.
  const rename = (service, nickname) => setByHh((map) => {
    const rows = map?.[activeTab]
    if (!rows) return map
    return {
      ...map,
      [activeTab]: rows.map((s) => (keyOf(s) === keyOf(service) ? { ...s, nickname } : s)),
    }
  })
  const reauthorize = () => onAdd?.({
    householdId: activeTab, sid: account.id, name: account.name,
    account: account.account_id || '', reauthorize: true,
  })

  return (
    <>
      <h3>{t('desk.prefs.services')}</h3>
      {systemChoiceMatters(households) && (
        <div className="win-settings-for win-lib-system">
          <select value={activeTab || ''} onChange={(e) => { setTab(e.target.value); setSelected(null) }}>
            {ordered.map((h) => <option key={h.id} value={h.id}>{h.generation}</option>)}
          </select>
        </div>
      )}
      <div className="win-settings-panel win-svc-panel">
        <p className="win-lib-title">{t('desk.prefs.servicesTitle')}</p>
        <p>{t('win.services.addHint')}</p>
        <p>{t('win.services.labsHint')}</p>
        <div className="win-lib-grid">
          <div className="win-lib-table win-svc-table" role="listbox" aria-label={t('desk.prefs.servicesTitle')}>
            <table>
              <thead><tr><th>{t('win.services.serviceName')}</th><th>{t('win.services.name')}</th><th>{t('win.services.login')}</th></tr></thead>
              <tbody>
                {byHh !== null && services.map((s) => (
                  <tr key={keyOf(s)} role="option" aria-selected={selected === keyOf(s)} onClick={() => setSelected(keyOf(s))}>
                    <td>{s.icon ? <img src={s.icon} alt="" /> : <Icon.Note />}<span className="win-svc-name">{s.name}</span></td>
                    <td>{nickname(s)}</td>
                    <td>{login(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byHh === null && <p className="win-lib-note" style={{ margin: 8 }}>{t('desk.browse.loading')}</p>}
          </div>
          <div className="win-lib-buttons win-svc-buttons">
            <button type="button" className="dk-win-btn" onClick={() => onAdd?.()}>{t('win.services.add')}</button>
            <button type="button" className="dk-win-btn" onClick={() => setLabs(true)}>{t('win.services.labs')}</button>
            <span className="win-svc-gap" />
            <button type="button" className="dk-win-btn" disabled={!account}
                    title={account ? t('win.services.edit') : t('desk.menu.disabledNote')}
                    onClick={() => setEditing(account)}>{t('win.services.edit')}</button>
            <button type="button" className="dk-win-btn" disabled={!highlighted} title={t('services.removeHint')} onClick={() => setConfirm(highlighted)}>{t('services.remove')}</button>
            <button type="button" className="dk-win-btn" disabled title={t('desk.menu.disabledNote')}>{t('win.services.replace')}</button>
            <button type="button" className="dk-win-btn" disabled={!account}
                    title={account ? t('win.services.reauthorize') : t('desk.menu.disabledNote')}
                    onClick={reauthorize}>{t('win.services.reauthorize')}</button>
          </div>
        </div>
        {error && <p className="dk-add-error">{error}</p>}
      </div>
      {labs && (
        <SonosLabs zone={zoneFor()} householdId={activeTab} onAdd={onAdd}
                   onClose={() => setLabs(false)} />
      )}
      {editing && (
        <EditServiceDialog service={editing} zone={zoneFor()}
          onClose={() => setEditing(null)}
          onDone={(nick) => { setEditing(null); rename(editing, nick); setVersion((v) => v + 1); onChanged?.() }}
          onError={(msg) => { setEditing(null); setError(msg) }} />
      )}
      {confirm && (
        <RemoveServiceDialog chrome="windows" service={confirm} zone={zoneFor()} gen={ordered.find((h) => h.id === activeTab)?.generation}
          onClose={() => setConfirm(null)}
          onDone={() => { setConfirm(null); setSelected(null); setVersion((v) => v + 1); onChanged?.() }}
          onError={(msg) => { setConfirm(null); setError(msg) }} />
      )}
    </>
  )
}


// The app's Sonos Labs window (walked 2026-09-12): the Add-a-service chrome
// headed "Welcome to Sonos Labs" over "Select the Sonos Labs service you would
// like to add:", a bordered list, and Back / Next / Cancel with only Cancel
// live while nothing is picked.
//
// The list is Sonos' to give. The app reads its service catalog and keeps
// the entries whose containerType is SONOS_LABS rather than MUSIC_SERVICE
// (both strings are in sclib-csharp.dll beside the userType query it sends),
// and Sonora now asks the same catalog the same way. A household that has
// not opted in to Labs is offered none, and the app then shows an empty list
// box and says nothing about it -- no "there are none" line (walked again
// 2026-09-14). This does the same. The two notes it can still show say
// something the app never has to: that the list has not arrived yet, and that
// Sonora could not fetch it, which must not be mistaken for an empty one.
function SonosLabs({ zone, householdId, onAdd, onClose }) {
  const { t } = useI18n()
  const [state, setState] = useState({ loading: true, items: [], signedIn: true, error: '' })
  const [chosen, setChosen] = useState(null)
  useEffect(() => {
    let canceled = false
    api.labsServices(zone).then((r) => {
      if (!canceled) setState({ loading: false, items: r?.items || [], signedIn: r?.signed_in !== false, error: '' })
    }).catch((exc) => {
      // An empty list is a real answer here, so a fetch that failed must not
      // look like one: it says so instead.
      if (!canceled) setState({ loading: false, items: [], signedIn: true, error: exc?.message || String(exc) })
    })
    return () => { canceled = true }
  }, [zone])
  const pick = state.items.find((item) => item.id === chosen) || null
  // A household with no Labs services to add gets an empty list box and not a
  // word about it, which is what the app shows (walked again 2026-09-14 on a
  // household Sonos offers none to). The two notes that remain say something
  // the app never has to: that the list has not arrived yet, and that Sonora
  // has no Sonos sign-in to ask with.
  const note = state.loading ? t('desk.browse.loading')
    : state.error ? t('win.services.labsFailed', { error: state.error })
    : !state.signedIn ? t('win.services.labsSignedOut')
    : ''
  return (
    <Window title={t('win.services.addTitle')} onClose={onClose} className="win-wizard win-svc-labs">
      <div className="win-wizard-body">
        <h3>{t('win.services.labsTitle')}</h3>
        <p>{t('win.services.labsPrompt')}</p>
        <div className="win-svc-labs-list" role="listbox" aria-label={t('win.services.labs')}>
          {state.items.length === 0 ? (note ? <p className="win-lib-note">{note}</p> : null) : state.items.map((item) => (
            <button key={item.id} type="button" role="option" aria-selected={chosen === item.id}
                    className="win-svc-labs-row" onClick={() => setChosen(item.id)}
                    onDoubleClick={() => onAdd?.({ householdId, sid: item.id, name: item.name })}>
              <span>{item.name}</span>
              {item.description && <small>{item.description}</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="win-dialog-foot win-wizard-foot">
        <button type="button" className="dk-win-btn" disabled>{t('common.back')}</button>
        <button type="button" className="dk-win-btn" data-default={pick ? true : undefined} disabled={!pick}
                onClick={() => onAdd?.({ householdId, sid: pick.id, name: pick.name })}>{t('common.next')}</button>
        <button type="button" className="dk-win-btn" data-default={pick ? undefined : true} autoFocus onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}


// The app's "Edit service" window, walked in the VM on 2026-09-14: a plain
// wizard page headed "Edit <service> account" over "Please enter an account
// name:", a Name field holding the account's current nickname, and the
// wizard's Back / Done / Cancel footer with only Done live -- the other two
// are grayed, so the X in the title bar is the way out, which is the app's
// own arrangement and not an oversight here.
//
// Done sends SystemProperties#SetAccountNicknameX, and the speakers apply the
// new name household-wide: renaming from Sonora moves the name in the Windows
// app's own list, checked both ways.
function EditServiceDialog({ service, zone, onClose, onDone, onError }) {
  const { t } = useI18n()
  const [name, setName] = useState(service.nickname || '')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      await api.renameServiceAccount(service.id, {
        zone, account_id: service.account_id || '', nickname: name.trim(),
      })
      onDone?.(name.trim())
    } catch (exc) {
      onError?.(exc?.message || String(exc))
    }
  }
  return (
    <Window title={t('win.services.editTitle')} onClose={onClose} className="win-wizard">
      <div className="win-wizard-body">
        <h3>{t('win.services.editHeading', { service: service.name })}</h3>
        <p>{t('win.services.editPrompt')}</p>
        <label className="win-wizard-cred"><span>{t('win.services.editName')}</span>
          <input type="text" value={name} autoFocus
                 onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') submit() }} /></label>
      </div>
      <div className="win-dialog-foot win-wizard-foot">
        <button type="button" className="dk-win-btn" disabled>{t('common.back')}</button>
        <button type="button" className="dk-win-btn" data-default="true"
                disabled={busy || !name.trim()} onClick={submit}>{t('common.done')}</button>
        <button type="button" className="dk-win-btn" disabled>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}
