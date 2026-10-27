import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { ServiceBadge } from './Browse.jsx'
import Overlay from './Overlay.jsx'
import { Pencil, Padlock } from './icons.jsx'
import { orderServices } from './serviceOrder.js'

// The web player's Content Services pages, as play.sonos.com draws them
// (measured 2026-10-27): the list a household's services are managed from
// ("Manage" on the home's Your Services row), the catalog a service is added
// from (the row's "+"), a service's own page and an account's. Each is the
// panel the column's pages are, with the close disc at its top right.
//
// `household` is the household object (id, generation, zone_uuids); the
// household's services are read through one of its rooms.

const CATEGORIES = ['MUSIC', 'RADIO', 'PODCASTS', 'AUDIOBOOKS']

// One household's services: what it has (in_use, one entry per account) and
// what the catalog offers (available, with descriptions and kinds).
function useHouseholdServices(household, version) {
  const [data, setData] = useState(null)
  const zone = household?.zone_uuids?.[0]
  useEffect(() => {
    let canceled = false
    if (!zone) { setData({ in_use: [], available: [] }); return undefined }
    api.services(zone).then((result) => {
      if (!canceled) setData(result.households?.[0] || { in_use: [], available: [] })
    }).catch(() => { if (!canceled) setData({ in_use: [], available: [] }) })
    return () => { canceled = true }
  }, [zone, version])
  return data
}

function Panel({ onClose, children, className = '' }) {
  const { t } = useI18n()
  return (
    <div className={`wb-services-page wb-cs ${className}`}>
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={16} height={16} />
      </button>
      {children}
    </div>
  )
}

// --- Manage: the household's services ---------------------------------------------

export function ManageServices({ household, nav, version, onClose }) {
  const { t } = useI18n()
  const data = useHouseholdServices(household, version)
  // One row per service, in the order the home's row keeps, under the name
  // of its first account: the product lists AccuRadio once whatever number
  // of accounts it holds, and opens the accounts on the service's page.
  const items = useMemo(() => {
    const seen = new Set()
    return orderServices(household?.id, data?.in_use || []).filter((s) => !seen.has(s.id) && seen.add(s.id))
  }, [data, household?.id])
  return (
    <Panel onClose={onClose}>
      <h1>{t('web.cs.title')}</h1>
      <h2 className="wb-cs-h2">{t('web.cs.connected')}</h2>
      <div className="wb-cs-card">
        {items.map((service, index) => (
          <button key={`${service.id}-${service.account_id ?? index}`} type="button" className="wb-cs-row"
                  onClick={() => nav.push({ kind: 'service-settings', household: household.id, sid: service.id })}>
            <span className="wb-cs-icon"><ServiceBadge service={service} /></span>
            <span className="wb-cs-text">
              <span className="wb-cs-name">{service.name}</span>
              {service.nickname && service.nickname !== service.name && <span className="wb-cs-sub">{service.nickname}</span>}
            </span>
            <Icon.ChevronRight className="wb-cs-chev" width={20} height={20} aria-hidden="true" />
          </button>
        ))}
        <button type="button" className="wb-cs-row wb-cs-addrow"
                onClick={() => nav.push({ kind: 'add-services', tab: household.id })}>
          <Icon.Plus width={20} height={20} aria-hidden="true" />
          <span className="wb-cs-name">{t('web.cs.add')}</span>
        </button>
      </div>
    </Panel>
  )
}

// --- Add: the catalog ---------------------------------------------------------------

export function AddServices({ household, nav, version, onClose }) {
  const { t } = useI18n()
  const data = useHouseholdServices(household, version)
  const [term, setTerm] = useState('')
  const [kind, setKind] = useState('ALL')
  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return [...(data?.available || [])]
      .filter((s) => kind === 'ALL' || (s.categories || []).includes(kind))
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, term, kind])
  // The product heads the whole catalog "All Services" and anything narrowed
  // by a kind or a search "Top Results".
  const narrowed = kind !== 'ALL' || term.trim()
  return (
    <Panel onClose={onClose}>
      <h1>{t('web.cs.title')}</h1>
      <label className="wb-cs-search">
        <Icon.Search width={18} height={18} aria-hidden="true" />
        <input type="search" value={term} placeholder={t('web.cs.search')} aria-label={t('web.cs.search')}
               onChange={(event) => setTerm(event.target.value)} />
      </label>
      <div className="wb-cs-chips" role="radiogroup">
        {['ALL', ...CATEGORIES].map((id) => (
          <button key={id} type="button" role="radio" aria-checked={kind === id} className="wb-cs-chip"
                  onClick={() => setKind(id)}>{t(`web.cs.cat.${id}`)}</button>
        ))}
      </div>
      <h2 className="wb-cs-h2">{narrowed ? t('web.cs.topResults') : t('web.cs.allServices')}</h2>
      <div className="wb-cs-catalog">
        {shown.map((service) => (
          <button key={service.id} type="button" className="wb-cs-item"
                  onClick={() => nav.push({ kind: 'service-settings', household: household.id, sid: service.id })}>
            <span className="wb-cs-icon wb-cs-icon-lg"><ServiceBadge service={service} /></span>
            <span className="wb-cs-text">
              <span className="wb-cs-name">{service.name}</span>
              {service.description && <span className="wb-cs-desc">{service.description}</span>}
            </span>
            <Icon.ChevronRight className="wb-cs-chev" width={20} height={20} aria-hidden="true" />
          </button>
        ))}
      </div>
    </Panel>
  )
}

// --- a service's page ---------------------------------------------------------------

export function ServiceSettings({ household, sid, nav, version, onClose, onLink, onChanged }) {
  const { t } = useI18n()
  const data = useHouseholdServices(household, version)
  const [dialog, setDialog] = useState(null)
  const [error, setError] = useState('')
  const [fromSonora, setFromSonora] = useState(true)
  const [fromSonos, setFromSonos] = useState(true)
  if (!data) return <Panel onClose={onClose} />
  const accounts = (data.in_use || []).filter((s) => s.id === sid)
  const info = (data.available || []).find((s) => s.id === sid) || accounts[0] || {}
  const service = { ...info, ...(accounts[0] || {}), name: info.name || accounts[0]?.name || '' }
  const connected = accounts.length > 0
  const anonymous = service.auth === 'Anonymous'
  const zone = household.zone_uuids?.[0]
  const categories = service.categories || info.categories || []

  // Removing asks where from, as every other theme does (useRemoveChoice):
  // Sonora's own sign-in, the account on the Sonos system, or both. Each side
  // is offered only for the accounts it holds. The Sonos side is never asked
  // for a login Sonora keeps with no account on the system to name: told to
  // remove one with no account named, the speakers take off whichever
  // account of the service they choose.
  const sonosSide = (a) => Boolean(a.on_system) && !a.unattributed && (Boolean(a.account_id) || anonymous)
  const canSonora = accounts.some((a) => a.sonora_linked)
  const canSonos = accounts.some(sonosSide)
  const removeAll = async () => {
    setError('')
    try {
      for (const account of accounts) {
        const sonora = fromSonora && canSonora && Boolean(account.sonora_linked)
        const system = fromSonos && canSonos && sonosSide(account)
        if (!sonora && !system) continue
        await api.removeService(sid, { zone, account_id: account.account_id || '', from_sonora: sonora, from_system: system })
      }
      setDialog(null)
      onChanged?.()
      nav.back()
    } catch (exc) { setError(exc.message) }
  }

  return (
    <Panel onClose={onClose}>
      <header className="wb-service-head">
        <span className="wb-service-logo" aria-hidden="true">
          {service.icon ? <img src={service.icon} alt="" /> : <span>{service.initials}</span>}
        </span>
        <h1>{service.name}</h1>
      </header>
      <div className="wb-cs-actions">
        {connected ? (
          <button type="button" className="wb-cs-pill" onClick={() => setDialog('remove')}>{t('web.cs.removeFromSonos')}</button>
        ) : (
          <button type="button" className="wb-cs-pill" disabled={service.pairable === false}
                  title={service.pairable === false ? t('desk.add.unpairable', { service: service.name }) : undefined}
                  onClick={() => setDialog('add')}>{t('web.cs.addToSonos')}</button>
        )}
        {service.site && (
          <a className="wb-cs-pill" href={service.site} target="_blank" rel="noopener noreferrer">
            <Icon.ExternalLink width={16} height={16} />
            <span>{service.name}</span>
          </a>
        )}
      </div>
      {error && <p className="wb-add-error">{error}</p>}

      {connected && !anonymous && (
        <>
          <h2 className="wb-cs-h2">{t('web.cs.connectedAccounts')}</h2>
          <div className="wb-cs-card">
            {accounts.map((account, index) => (
              <button key={account.account_id || index} type="button" className="wb-cs-row wb-cs-account"
                      onClick={() => nav.push({ kind: 'service-account', household: household.id, sid, account_id: account.account_id || '' })}>
                <span className="wb-cs-text">
                  <span className="wb-cs-name">{account.nickname || service.name}</span>
                  {index === 0 && <span className="wb-cs-sub">{t('web.cs.primaryAccount')}</span>}
                </span>
                <Icon.ChevronRight className="wb-cs-chev" width={20} height={20} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="wb-cs-row wb-cs-addrow"
                    onClick={() => onLink?.({ sid, name: service.name, zone, auth: service.auth })}>
              <Icon.Plus width={20} height={20} aria-hidden="true" />
              <span className="wb-cs-name">{t('web.cs.addAccount')}</span>
            </button>
          </div>
        </>
      )}

      {service.description && (
        <>
          <h2 className="wb-cs-h2">{t('web.cs.about')}</h2>
          <p className="wb-cs-about">{service.description}</p>
        </>
      )}
      {categories.length > 0 && (
        <>
          <h2 className="wb-cs-h2">{t('web.cs.availableContent')}</h2>
          <div className="wb-cs-chips wb-cs-tags">
            {categories.map((id) => <span key={id} className="wb-cs-chip">{t(`web.cs.cat.${id}`)}</span>)}
          </div>
        </>
      )}

      {dialog === 'add' && (
        <Sheet onClose={() => setDialog(null)} title={t('web.cs.addTitle', { service: service.name })}
               body={t('web.cs.addBody', { service: service.name })}
               picture={<span className="wb-cs-sheet-icon"><ServiceBadge service={service} /></span>}
               primary={{ label: t('web.cs.haveAccount'),
                          onClick: () => { setDialog(null); onLink?.({ sid, name: service.name, zone, auth: service.auth }) } }}
               secondary={service.site ? { label: t('web.cs.newTo', { service: service.name }),
                                           onClick: () => { window.open(service.site, '_blank', 'noopener'); setDialog(null) } } : null} />
      )}
      {dialog === 'remove' && (
        <Sheet onClose={() => setDialog(null)}
               title={accounts.length > 1 || anonymous ? t('web.cs.removeAllTitle', { service: service.name })
                 : t('web.cs.removeAccountTitle', { service: service.name })}
               body={canSonora && canSonos ? t('services.removeChoose', { service: service.name })
                 : canSonora ? t('services.removeSonoraBody', { service: service.name })
                 : accounts.length > 1 || anonymous ? t('web.cs.removeAllBody', { service: service.name })
                 : t('web.cs.removeAccountBody', { service: service.name })}
               primary={{ label: t('web.cs.disconnect'), onClick: removeAll,
                          disabled: !((fromSonora && canSonora) || (fromSonos && canSonos)) }}
               secondary={{ label: t('common.cancel'), onClick: () => setDialog(null) }}>
          <RemoveSides gen={household.generation} canSonora={canSonora} canSonos={canSonos}
                       sonora={fromSonora} setSonora={setFromSonora} sonos={fromSonos} setSonos={setFromSonos} />
        </Sheet>
      )}
    </Panel>
  )
}

// Where a service is removed from: two boxes, Sonora and the Sonos system,
// each ticked where it applies and dimmed where it does not. With only one
// side to offer there is no question, and nothing is drawn.
function RemoveSides({ gen, canSonora, canSonos, sonora, setSonora, sonos, setSonos }) {
  const { t } = useI18n()
  if (!canSonora || !canSonos) return null
  return (
    <div className="wb-cs-sides">
      <label><input type="checkbox" checked={sonos} onChange={(e) => setSonos(e.target.checked)} />
        <span><strong>{t('services.removeSonos', { gen: gen || '' })}</strong>{t('services.removeSonosSub')}</span></label>
      <label><input type="checkbox" checked={sonora} onChange={(e) => setSonora(e.target.checked)} />
        <span><strong>{t('services.removeSonora')}</strong>{t('services.removeSonoraSub')}</span></label>
    </div>
  )
}

// --- an account's page --------------------------------------------------------------

export function AccountSettings({ household, sid, accountId, nav, version, onClose, onLink, onChanged }) {
  const { t } = useI18n()
  const data = useHouseholdServices(household, version)
  const [dialog, setDialog] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [fromSonora, setFromSonora] = useState(true)
  const [fromSonos, setFromSonos] = useState(true)
  if (!data) return <Panel onClose={onClose} />
  const account = (data.in_use || []).find((s) => s.id === sid && String(s.account_id || '') === String(accountId || ''))
    || (data.in_use || []).find((s) => s.id === sid) || {}
  const zone = household.zone_uuids?.[0]
  const shown = account.nickname || account.name || ''

  const rename = async () => {
    setError('')
    try {
      await api.renameServiceAccount(sid, { zone, account_id: account.account_id || '', nickname: name.trim() })
      setDialog(null); onChanged?.()
    } catch (exc) { setError(exc.message) }
  }
  // Where from, as on the service's page: the Sonos side only for an
  // account the system holds under a number of its own.
  const canSonora = Boolean(account.sonora_linked)
  const canSonos = Boolean(account.on_system) && !account.unattributed
    && (Boolean(account.account_id) || account.auth === 'Anonymous')
  const sonora = fromSonora && canSonora
  const system = fromSonos && canSonos
  const remove = async () => {
    setError('')
    try {
      await api.removeService(sid, { zone, account_id: account.account_id || '', from_sonora: sonora, from_system: system })
      setDialog(null); onChanged?.(); nav.back()
    } catch (exc) { setError(exc.message) }
  }

  return (
    <Panel onClose={onClose}>
      <p className="wb-cs-eyebrow">{account.name}</p>
      <h1>{shown}</h1>
      <div className="wb-cs-card wb-cs-actionlist">
        <button type="button" className="wb-cs-row wb-cs-action" onClick={() => { setName(shown); setDialog('rename') }}>
          <Pencil /><span>{t('web.cs.changeName')}</span>
        </button>
        <button type="button" className="wb-cs-row wb-cs-action"
                onClick={() => onLink?.({ sid, name: account.name, zone, auth: account.auth, account_id: account.account_id || '', reauthorize: true })}>
          <Padlock /><span>{t('web.cs.reauthorize')}</span>
        </button>
        <button type="button" className="wb-cs-row wb-cs-action" onClick={() => setDialog('remove')}>
          <Icon.Close width={16} height={16} /><span>{t('web.cs.removeAccount')}</span>
        </button>
      </div>
      {error && <p className="wb-add-error">{error}</p>}

      {dialog === 'rename' && (
        <Sheet onClose={() => setDialog(null)} title={t('web.cs.renameTitle')} body={t('web.cs.renamePrompt')}
               field={<input className="wb-cs-field" type="text" value={name} autoFocus maxLength={60}
                             aria-label={t('web.cs.renameTitle')} onChange={(event) => setName(event.target.value)}
                             onKeyDown={(event) => { if (event.key === 'Enter' && name.trim() && name.trim() !== shown) rename() }} />}
               primary={{ label: t('common.done'), onClick: rename, disabled: !name.trim() || name.trim() === shown, quiet: true }} />
      )}
      {dialog === 'remove' && (
        <Sheet onClose={() => setDialog(null)} title={t('web.cs.removeAccountTitle', { service: account.name })}
               body={canSonora && canSonos ? t('services.removeChoose', { service: account.name })
                 : canSonora ? t('services.removeSonoraBody', { service: account.name })
                 : t('web.cs.removeAccountBody', { service: account.name })}
               primary={{ label: t('web.cs.disconnect'), onClick: remove, disabled: !(sonora || system) }}
               secondary={{ label: t('common.cancel'), onClick: () => setDialog(null) }}>
          <RemoveSides gen={household.generation} canSonora={canSonora} canSonos={canSonos}
                       sonora={fromSonora} setSonora={setFromSonora} sonos={fromSonos} setSonos={setFromSonos} />
        </Sheet>
      )}
    </Panel>
  )
}

// The product's tall dialogs: 512 wide, the title in 40px, the words under it,
// anything else in the middle, and full-width pills at the foot -- the first
// white, the second outlined; a disabled one gray.
function Sheet({ title, body, picture = null, field = null, primary, secondary = null, onClose, children = null }) {
  const { t } = useI18n()
  return (
    <Overlay onClose={onClose} label={title} variant="sheet">
      <button type="button" className="wb-cs-sheet-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={16} height={16} />
      </button>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {field}
      {children}
      <div className="wb-cs-sheet-mid">{picture}</div>
      <div className="wb-cs-sheet-actions">
        <button type="button" className={`wb-cs-sheet-btn${primary.quiet ? ' wb-cs-sheet-quiet' : ''}`}
                disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</button>
        {secondary && <button type="button" className="wb-cs-sheet-btn wb-cs-sheet-outline" onClick={secondary.onClick}>{secondary.label}</button>}
      </div>
    </Overlay>
  )
}
