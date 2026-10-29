import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { zoneLabel } from '../../frontend/src/lib/timezones.js'
import { useServiceLink } from '../../frontend/src/lib/useServiceLink.js'
import { useCloudAccount } from '../../frontend/src/lib/useCloudAccount.js'
import { playersOf, playerLabel } from '../../frontend/src/lib/players.js'
import { useRemoveChoice } from '../../frontend/src/lib/useRemoveChoice.js'
import { useLibrarySettings } from '../../frontend/src/lib/useLibrarySettings.js'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import { serviceLinkedMessage, LinkedMessage } from '../../frontend/src/lib/serviceLinkedMessage.js'
import { CautionBadge, serviceCaution } from '../../frontend/src/components/CautionBadge.jsx'
import { readLibraryPrefs, writeLibraryPrefs, FOLDER_SORTS } from '../../frontend/src/lib/libraryPrefs.js'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'
import ThemeChooser from '../../frontend/src/components/ThemeChooser.jsx'
import S2Upgrade from '../../frontend/src/components/S2Upgrade.jsx'
import NetworkMap, { HealthDonut, MeshGuidance, forSystem } from '../../frontend/src/components/NetworkMap.jsx'
import ParentalControls from '../../frontend/src/components/ParentalControls.jsx'
import { versionLabel, updateBody } from '../../frontend/src/lib/version.js'
import * as G from './glyphs.jsx'
import { Window, WindowBar, Btn, IconBtn, Toggle, Confirm, Empty, Busy, Menu, MenuItem, MenuSep, Select, Field, Row, Seg, SystemPicker, Kbd, SvcImg, cx } from './kit.jsx'
import { ServiceGrid } from './Library.jsx'
import { useSpeakerUpdates } from './house.js'
import { PHOSPHORS, usePrefs, writePref } from './prefs.js'
import { keySound } from './sound.js'

// The Setup program: the settings as a numbered menu, as a terminal's setup
// screen would have them, and the chosen page beside it -- or, on a phone,
// the menu first and each page in its place with a way back. Every page
// reads and writes through the calls the other themes use.

export const PAGES = ['account', 'services', 'library', 'time', 'systems', 'parental', 's2', 'network', 'appearance', 'log']
const PAGE_GLYPHS = { account: G.Person, services: G.Link, library: G.Folder, time: G.Clock, systems: G.Speaker, parental: G.Prohibit, s2: G.Sparkle, network: G.Signal, appearance: G.Screen, log: G.Warning }

export default function SetupProgram({ households, zones, systemFilter, page, setPage, onLinkService, servicesVersion, onServicesChanged, onMessage, onAbout, onShortcuts, compact }) {
  const { t } = useI18n()
  const current = PAGES.includes(page) ? page : (compact ? '' : 'services')
  const detail = current && (
    <section className="sv-setup-page" key={current} data-page={current} aria-label={t(`sv.setup.${current}`)}>
      <header className="sv-programhead">
        {compact && <IconBtn label={t('common.back')} onClick={() => setPage('')}><G.Back size={24} /></IconBtn>}
        <div>
          <h1 className="sv-title">{t(`sv.setup.${current}`)}</h1>
          <p className="sv-dim">{t(`sv.setup.${current}.blurb`)}</p>
        </div>
      </header>
      {current === 'account' && <AccountPage />}
      {current === 'services' && <ServicesPage households={households} zones={zones} onLinkService={onLinkService} version={servicesVersion} onChanged={onServicesChanged} onMessage={onMessage} />}
      {current === 'library' && <LibraryPage households={households} />}
      {current === 'time' && <TimePage households={households} />}
      {current === 'systems' && <SystemsPage households={households} zones={zones} />}
      {current === 'parental' && <ParentalPage />}
      {current === 's2' && <S2Upgrade />}
      {current === 'network' && <NetworkPage systemFilter={systemFilter} />}
      {current === 'appearance' && <AppearancePage />}
      {current === 'log' && <LogPage />}
    </section>
  )
  if (compact && current) return <div className="sv-setup sv-setup-single">{detail}</div>
  return (
    <div className="sv-setup">
      <nav className="sv-setup-menu" aria-label={t('common.settings')}>
        <h1 className="sv-title">{t('common.settings')}</h1>
        <ol>
          {PAGES.map((id, i) => {
            const Glyph = PAGE_GLYPHS[id]
            return (
              <li key={id}>
                <button type="button" aria-current={current === id || undefined} onClick={() => setPage(id)}>
                  <span className="sv-setup-n">{(i + 1) % 10}</span>
                  <Glyph size={24} />
                  <span>{t(`sv.setup.${id}`)}</span>
                  {compact && <G.Chevron size={12} />}
                </button>
              </li>
            )
          })}
        </ol>
        <ol className="sv-setup-extra">
          {!compact && <li><button type="button" onClick={onShortcuts}><span className="sv-setup-n">?</span><G.Keyboard size={24} /><span>{t('desk.shortcuts.title')}</span></button></li>}
          <li><button type="button" onClick={onAbout}><span className="sv-setup-n">i</span><G.Info size={24} /><span>{t('about.menu')}</span></button></li>
        </ol>
      </nav>
      {!compact && detail}
    </div>
  )
}

// --- content filters -------------------------------------------------------------

const SV_PARENTAL = {
  section: 'sv-stack', blurb: 'sv-dim', note: 'sv-dim', error: 'sv-error', button: 'sv-btn sv-btn-line sv-btn-s', row: 'sv-parental-row', actions: 'sv-inline',
}
// Defined once, outside the page: written inside it, it would be a new component on every
// render, rebuilt whenever a playing track ticked.
const SvToggle = ({ label, checked, disabled, hint, onChange }) => (
  <span title={hint || undefined}><Toggle label={label} checked={checked} disabled={disabled} onChange={onChange} /></span>
)
function ParentalPage() {
  return <ParentalControls shape="switch" showTitle={false} classes={SV_PARENTAL} Toggle={SvToggle} />
}

// --- music services ------------------------------------------------------------------

function ServicesPage({ households, zones, onLinkService, version, onChanged, onMessage }) {
  const { t } = useI18n()
  const { servicesEpoch } = useSystem()
  const ordered = orderedHouseholds(households)
  const [tab, setTab] = useState(null)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const [byHh, setByHh] = useState(null)
  const [menu, setMenu] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let canceled = false
    api.services().then((r) => {
      if (canceled) return
      const map = {}
      for (const hh of r.households || []) map[hh.household] = hh.in_use || []
      setByHh(map)
    }).catch(() => { if (!canceled) setByHh({}) })
    return () => { canceled = true }
  }, [version, servicesEpoch, tick])
  const services = (byHh && byHh[activeTab]) || []
  const household = ordered.find((h) => h.id === activeTab)
  const zoneFor = () => household?.zone_uuids?.find((u) => zones[u]) || household?.zone_uuids?.[0]
  return (
    <div className="sv-stack">
      <div className="sv-toolrow">
        <SystemPicker households={ordered} value={activeTab} onChange={setTab} all={false} />
        <span className="sv-grow" />
        <Btn variant="solid" size="s" icon={<G.Plus size={12} />} onClick={() => setAdding(true)}>{t('desk.add.button')}</Btn>
      </div>
      {byHh === null ? <Busy label={t('desk.browse.loading')} />
        : services.length === 0 ? <Empty icon={<G.Link size={48} />} title={t('sv.services.none')} /> : (
          <div className="sv-listing">
            {services.map((s) => {
              const caution = serviceCaution(s)
              return (
                <Row key={`${s.id}-${s.account_id ?? ''}`}
                     lead={<span className="sv-source-icon sv-caution-anchor">{s.icon ? <SvcImg src={s.icon} /> : <span className="sv-initials">{s.initials}</span>}{caution && <CautionBadge kind={caution} title={t(`services.caution.${caution}`, { gen: household?.generation })} />}</span>}
                     title={<>{s.name}{s.nickname && s.nickname !== s.name ? <small> · {s.nickname}</small> : null}</>}
                     sub={s.auth === 'Anonymous' ? t('win.services.anonymous')
                       : caution === 'sonos' ? t('sv.services.notLinked')
                       : caution === 'sonora' ? t('services.caution.sonora', { gen: household?.generation })
                       : t('sv.services.linked')}
                     trail={<IconBtn size="s" label={t('desk.browse.actions')} onClick={(event) => setMenu({ s, anchor: event.currentTarget })}><G.More size={24} /></IconBtn>} />
              )
            })}
          </div>
        )}
      {error && <p className="sv-error">{error}</p>}
      {menu && (
        <Menu anchor={menu.anchor} align="right" onClose={() => setMenu(null)} title={menu.s.name}>
          {serviceCaution(menu.s) === 'sonos' && (
            <MenuItem icon={<G.Link size={12} />} onSelect={() => { setMenu(null); onLinkService?.({ sid: menu.s.id, householdId: activeTab, name: menu.s.name, account: menu.s.account_id ?? '', auth: menu.s.auth }) }}>
              {t('desk.browse.needsLink.action', { service: menu.s.name })}
            </MenuItem>
          )}
          {menu.s.auth !== 'Anonymous' && menu.s.sonora_linked && (
            <MenuItem icon={<G.Refresh size={12} />} onSelect={() => { setMenu(null); onLinkService?.({ sid: menu.s.id, householdId: activeTab, name: menu.s.name, account: menu.s.account_id ?? '', auth: menu.s.auth, reauthorize: true }) }}>
              {t('win.services.reauthorize')}
            </MenuItem>
          )}
          {menu.s.auth !== 'Anonymous' && <MenuItem icon={<G.Edit size={12} />} onSelect={() => { setMenu(null); setRenaming(menu.s) }}>{t('services.rename')}</MenuItem>}
          <MenuSep />
          <MenuItem icon={<G.Trash size={12} />} danger onSelect={() => { setMenu(null); setRemoving(menu.s) }}>{t('services.remove')}</MenuItem>
        </Menu>
      )}
      {renaming && (
        <Confirm title={t('services.renameTitle', { service: renaming.name })} body={t('win.services.editPrompt')} action={t('common.done')} icon={<G.Edit size={48} />}
                 input={{ initial: renaming.nickname || '', label: t('services.rename') }} onClose={() => setRenaming(null)}
                 onConfirm={async (name) => {
                   const was = renaming
                   setRenaming(null)
                   try {
                     await api.renameServiceAccount(was.id, { zone: zoneFor(), account_id: was.account_id ?? '', nickname: name })
                     setByHh((map) => (map?.[activeTab] ? { ...map, [activeTab]: map[activeTab].map((s) => (s === was ? { ...s, nickname: name } : s)) } : map))
                     setTick((v) => v + 1); onChanged?.()
                     onMessage?.(t('services.renamed', { service: was.name, name }))
                   } catch (exc) { setError(exc?.message || String(exc)) }
                 }} />
      )}
      {removing && (
        <RemoveServiceDialog service={removing} zone={zoneFor()} gen={household?.generation} onClose={() => setRemoving(null)}
                             onDone={() => { setRemoving(null); setTick((v) => v + 1); onChanged?.(); onMessage?.(t('sv.serviceRemoved', { service: removing.name })) }}
                             onError={(msg) => { setRemoving(null); setError(msg) }} />
      )}
      {adding && <LinkServiceWindow households={households} initialTab={activeTab} onClose={() => setAdding(false)} onLinked={() => { setTick((v) => v + 1); onChanged?.() }} />}
    </div>
  )
}

function RemoveServiceDialog({ service, zone, gen, onClose, onDone, onError }) {
  const { t } = useI18n()
  const c = useRemoveChoice({ sid: service.id, zone, accountId: service.account_id ?? '', sonoraLinked: service.sonora_linked, onSystem: service.on_system, onDone })
  useEffect(() => { if (c.error) onError(t('services.removeFailed', { service: service.name, error: c.error })) }, [c.error]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Confirm title={t('services.removeTitle', { service: service.name })} danger icon={<G.Trash size={48} />}
             body={c.single === 'sonos' ? t('services.removeSonosBody', { service: service.name })
               : c.single === 'sonora' ? t('services.removeSonoraBody', { service: service.name })
               : t('services.removeChoose', { service: service.name })}
             action={c.busy ? t('services.removing', { service: service.name }) : t('services.confirmRemove')} disabled={!c.canConfirm || c.busy}
             onConfirm={c.submit} onClose={onClose}>
      {!c.single && (
        <div className="sv-stack">
          {c.canSonora && <Toggle checked={c.sonora} onChange={c.setSonora} label={`${t('services.removeSonora')} - ${t('services.removeSonoraSub')}`} />}
          {c.canSonos && <Toggle checked={c.sonos} onChange={c.setSonos} label={`${t('services.removeSonos', { gen })} - ${t('services.removeSonosSub')}`} />}
        </div>
      )}
    </Confirm>
  )
}

// Linking a service: the household's catalog, or straight into one service's sign-in. The
// provider hands out a code; the person signs in on the provider's site; the speakers are polled
// until the account lands.
export function LinkServiceWindow({ households, preset = null, initialTab = null, onClose, onLinked }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  const presetZone = preset ? (households.find((h) => h.id === preset.householdId)?.zone_uuids || []).find((u) => zones[u]) : null
  const link = useServiceLink({
    preset: preset && presetZone ? { sid: preset.sid, name: preset.name, zone: presetZone, account_id: preset.account || '', auth: preset.auth, reauthorize: Boolean(preset.reauthorize) } : null,
    initialTab, onLinked,
  })
  const name = link.chosen?.service?.name
  const catalog = link.addableFor(link.activeTab)
  const [filter, setFilter] = useState('')
  const shown = catalog.filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()))
  return (
    <Window kind="full" title={t('desk.add.title')} onClose={onClose}>
      <WindowBar title={link.chosen ? name : t('desk.add.title')} sub={link.chosen ? '' : t('desk.add.intro')} onClose={onClose}
                 back={link.chosen && !preset && link.status !== 'done' ? link.reset : null}>
        {link.status === 'done' && <Btn variant="solid" size="s" onClick={onClose}>{t('common.done')}</Btn>}
      </WindowBar>
      <div className="sv-window-body sv-stack">
        {!link.chosen ? (
          <>
            <div className="sv-toolrow">
              <SystemPicker households={link.households} value={link.activeTab} onChange={link.setTab} all={false} />
              <Field label={t('sv.filterServices')} value={filter} onChange={setFilter} leading={<G.Search size={12} />} autoFocus />
            </div>
            {!link.loaded ? <Busy label={t('desk.browse.loading')} />
              : <ServiceGrid services={shown} t={t} onPick={(service) => link.start(service, link.zoneForHousehold(link.activeTab)?.uuid)} />}
            {link.error && <p className="sv-error">{link.error}</p>}
          </>
        ) : (
          <div className="sv-linkflow">
            {link.status === 'starting' && <Busy label={link.chosen?.service?.auth === 'Anonymous' ? t('desk.add.linking', { service: name }) : t('desk.add.starting', { service: name })} />}
            {link.status === 'needsApp' && <p>{t('desk.add.needsApp', { service: name })}</p>}
            {link.status === 'waiting' && link.link && (
              <>
                <p>{link.link.show_link_code ? t('desk.add.instructions', { url: link.link.reg_url }) : t('desk.add.instructionsNoCode', { url: link.link.reg_url })}</p>
                {link.link.show_link_code && <p className="sv-code">{link.link.link_code}</p>}
                <div><Btn variant="solid" icon={<G.Link size={12} />} onClick={() => window.open(link.link.reg_url, '_blank', 'noopener')}>{t('desk.add.open')}</Btn></div>
                <Busy label={t('desk.add.waiting', { service: name })} />
              </>
            )}
            {link.status === 'done' && (
              <p className="sv-done"><G.Check size={24} /><LinkedMessage result={serviceLinkedMessage(t, { name, zone: link.chosen?.zone, households, registered: link.registered, auth: link.chosen?.service?.auth })}
                                                                         onOpen={(hid) => { link.reset(); link.setTab(hid) }} /></p>
            )}
            {link.status === 'failed' && <p className="sv-error">{t('desk.add.failed', { service: name, error: link.error })}</p>}
          </div>
        )}
      </div>
    </Window>
  )
}

// --- music library ---------------------------------------------------------------------

const ALBUM_ARTIST_OPTIONS = ['ITUNES', 'WMP', 'NONE']
function Setting({ label, children, hint = '' }) {
  return (
    <div className="sv-setting">
      <span className="sv-setting-label">{label}</span>
      <div className="sv-setting-value">{children}</div>
      {hint && <p className="sv-dim">{hint}</p>}
    </div>
  )
}

function LibraryPage({ households }) {
  const [prefs, setPrefs] = useState(readLibraryPrefs)
  const { t } = useI18n()
  const lib = useLibrarySettings(households, { section: 'library' })
  const [adding, setAdding] = useState(false)
  const [path, setPath] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const addShare = () => {
    if (!path.trim()) return
    lib.apply({ add_path: path.trim(), add_username: user.trim(), add_password: pass })
    setAdding(false); setPath(''); setUser(''); setPass('')
  }
  const [confirm, setConfirm] = useState(null)
  const data = lib.data
  return (
    <div className="sv-stack">
      <SystemPicker households={lib.ordered} value={lib.activeTab} onChange={lib.setTab} all={false} />
      {!data && !lib.error && <Busy label={t('desk.browse.loading')} />}
      {lib.error && <p className="sv-error">{lib.error}</p>}
      {data && (
        <>
          <h2 className="sv-rule-head">{t('desk.library.mine')}</h2>
          {lib.shares.length === 0 && lib.pending.length === 0 ? <p className="sv-dim">{t('desk.library.none')}</p> : (
            <div className="sv-listing">
              {lib.shares.map((s) => {
                const going = lib.removingPhase(s)
                return (
                  <Row key={s.id} data-removing={going} role={going ? 'status' : undefined} lead={going ? <Busy inline /> : <G.Folder size={24} />}
                       title={(s.path || s.title || '').split('/').filter(Boolean).pop()}
                       sub={going ? <><span className="sv-li-line">{s.path || s.title}</span><span className="sv-li-line">{t('desk.library.removing')}</span></> : s.path || s.title}
                       trail={going ? null : <IconBtn size="s" label={t('desk.library.remove')} disabled={lib.busy} onClick={() => setConfirm(s)}><G.Trash size={24} /></IconBtn>} />
                )
              })}
              {lib.pending.map((p) => (
                <Row key={p.path} role="status" lead={p.state === 'failed' ? <G.Warning size={24} /> : <Busy inline />}
                     title={p.state === 'failed' ? t('desk.library.addFailed', { path: p.path })
                       : p.state === 'indexing' ? (p.path || '').split(/[\\/]/).filter(Boolean).pop() : t('desk.library.adding')}
                     sub={p.state === 'failed' ? (p.hint || t('desk.library.addFailedWhy'))
                       // The address under the name, as on the folders above, then the news.
                       : p.state === 'indexing' ? <><span className="sv-li-line">{p.path}</span><span className="sv-li-line">{t('desk.library.addedIndexing')}</span></>
                       : `${t('desk.library.addingPath', { path: p.path })}${p.hint ? ` ${p.hint}` : ''}`} />
              ))}
            </div>
          )}
          {adding ? (
            <div className="sv-box sv-stack">
              <Field label={t('desk.library.pathHint')} value={path} autoFocus onChange={setPath} onEnter={() => path.trim() && addShare()} />
              <div className="sv-inline">
                <Field label={t('desk.library.username')} value={user} onChange={setUser} onEnter={() => path.trim() && addShare()} />
                <Field label={t('desk.library.password')} type="password" value={pass} onChange={setPass} onEnter={() => path.trim() && addShare()} />
              </div>
              <p className="sv-dim">{t('desk.library.credHint')}</p>
              <div className="sv-inline">
                <Btn variant="solid" size="s" disabled={!path.trim() || lib.busy} onClick={addShare}>{t('desk.library.add')}</Btn>
                <Btn size="s" onClick={() => { setAdding(false); setPath(''); setUser(''); setPass('') }}>{t('common.cancel')}</Btn>
              </div>
            </div>
          ) : (
            <div><Btn icon={<G.Plus size={12} />} disabled={lib.busy} onClick={() => setAdding(true)}>{t('desk.library.addFolder')}</Btn></div>
          )}
          {data.index_error && <p className="sv-error">{t('desk.library.indexError', { error: data.index_error })}</p>}
          <p className="sv-dim">{t('desk.library.pathNote')}</p>
          <h2 className="sv-rule-head">{t('desk.library.indexTitle')}</h2>
          <div className="sv-inline">
            <Toggle checked={lib.scheduled} disabled={lib.busy} label={t('desk.library.schedule')} onChange={(on) => lib.apply({ daily_refresh: on ? `${lib.scheduleTime}:00` : '' })} />
            <input className="sv-time-input" type="time" value={lib.scheduleTime} disabled={!lib.scheduled || lib.busy} aria-label={t('desk.library.schedule')}
                   onChange={(e) => e.target.value && lib.apply({ daily_refresh: `${e.target.value}:00` })} />
          </div>
          <div className="sv-inline">
            <Btn size="s" icon={<G.Refresh size={12} />} disabled={data.indexing || lib.busy} onClick={() => lib.apply({ refresh: true })}>{t('desk.library.updateNow')}</Btn>
            {data.indexing && <Busy inline label={t('desk.library.indexing')} />}
          </div>
          <h2 className="sv-rule-head">{t('desk.library.compilations')}</h2>
          <Setting label={t('desk.library.groupBy')} hint={t('desk.library.compilationsNote')}>
            <Select disabled={lib.busy} value={ALBUM_ARTIST_OPTIONS.includes(data.album_artist_option) ? data.album_artist_option : 'WMP'} onChange={(e) => lib.apply({ album_artist_option: e.target.value })}>
              {ALBUM_ARTIST_OPTIONS.map((o) => <option key={o} value={o}>{t(`desk.library.group.${o}`)}</option>)}
            </Select>
          </Setting>
          <Toggle checked={prefs.contributing} label={t('desk.library.showContributing')} onChange={(on) => setPrefs(writeLibraryPrefs({ contributing: on }))} />
          <Setting label={t('desk.library.sortFolders')}>
            <Select value={prefs.folderSort} onChange={(e) => setPrefs(writeLibraryPrefs({ folderSort: e.target.value }))}>
              {FOLDER_SORTS.map((o) => <option key={o} value={o}>{t(`desk.library.sort.${o}`)}</option>)}
            </Select>
          </Setting>
          {confirm && (
            <Confirm title={t('desk.library.removeTitle')} body={t('desk.library.removeBody', { folder: confirm.title || confirm.uri })} action={t('desk.library.remove')} danger disabled={lib.busy} icon={<G.Folder size={48} />}
                     onConfirm={() => { lib.remove(confirm); setConfirm(null) }} onClose={() => setConfirm(null)} />
          )}
        </>
      )}
    </div>
  )
}

// --- date and time -----------------------------------------------------------------------

const DATE_FORMATS = ['MDY', 'DMY', 'YMD']
const TIME_FORMATS = ['12H', '24H']
function formatClock(local, timeFormat, dateFormat) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(local || '')
  if (!m) return { date: local || '', time: '' }
  const [, y, mo, d, hh, mi] = m
  const date = dateFormat === 'DMY' ? `${d}/${mo}/${y}` : dateFormat === 'YMD' ? `${y}/${mo}/${d}` : `${mo}/${d}/${y}`
  let time = `${hh}:${mi}`
  if (timeFormat !== '24H') { const h = Number(hh); time = `${((h + 11) % 12) + 1}:${mi} ${h < 12 ? 'AM' : 'PM'}` }
  return { date, time }
}
function TimePage({ households }) {
  const { t } = useI18n()
  const ordered = orderedHouseholds(households)
  const [tab, setTab] = useState(null)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const zone = households.find((h) => h.id === activeTab)?.zone_uuids?.[0]
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({ date: '', time: '' })
  const [guess, setGuess] = useState({})
  const load = useCallback(() => {
    if (!zone) return
    api.timeSettings(zone).then((r) => { setData(r); setError('') }).catch((exc) => setError(exc.message))
  }, [zone])
  useEffect(() => { setData(null); setGuess({}); load() }, [load])
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])
  const apply = async (patch, optimistic = null) => {
    setError('')
    if (optimistic) setGuess((prev) => ({ ...prev, ...optimistic }))
    setBusy(true)
    try { setData(await api.setTime({ zone, ...patch })) } catch (exc) { setError(exc.message) }
    setGuess({})
    setBusy(false)
  }
  // A system that keeps its time server (S2) always sets its clock from the Internet, so it is
  // offered no switch for it, as the S2 apps offer none.
  const fixed = Boolean(data?.server_fixed)
  const internet = fixed || (guess.internet ?? Boolean(data?.server))
  const autoDst = guess.auto_dst ?? Boolean(data?.auto_dst)
  const clock = data ? formatClock(data.local, data.time_format, data.date_format) : null
  const zoneEntry = data?.zones.find((z) => z.index === data.index)
  return (
    <div className="sv-stack">
      <SystemPicker households={ordered} value={activeTab} onChange={setTab} all={false} />
      {!data && !error && <Busy label={t('desk.time.loading')} />}
      {error && <p className="sv-error">{error}</p>}
      {data && (
        <>
          <div className="sv-clockface">
            <strong>{clock.time}</strong>
            <span>{clock.date}</span>
            {internet && data.server && <small>{t('desk.time.server', { server: data.server.split(',')[0] })}</small>}
          </div>
          <Setting label={t('desk.time.timeZone')}>
            <Select value={data.index} onChange={(e) => apply({ index: Number(e.target.value) })}>
              {data.zones.map((z) => <option key={z.index} value={z.index}>{zoneLabel(z)}</option>)}
            </Select>
          </Setting>
          {zoneEntry?.dst && <Toggle checked={autoDst} label={t('desk.time.autoDst')} onChange={(on) => apply({ auto_dst: on }, { auto_dst: on })} />}
          {!fixed && <Toggle checked={internet} label={t('desk.time.internet')} onChange={(on) => apply({ internet_time: on }, { internet: on })} />}
          {!internet && (
            <div className="sv-inline">
              <input className="sv-time-input" type="date" value={manual.date} aria-label={t('desk.time.setNow')} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
              <input className="sv-time-input" type="time" value={manual.time} aria-label={t('desk.time.setNow')} onChange={(e) => setManual({ ...manual, time: e.target.value })} />
              <Btn variant="solid" size="s" disabled={busy || !manual.date || !manual.time}
                   onClick={() => apply({ desired_time: `${manual.date} ${manual.time.length === 5 ? `${manual.time}:00` : manual.time}` })}>{t('desk.time.setNow')}</Btn>
            </div>
          )}
          <div className="sv-two">
            <Setting label={t('desk.time.dateFormat')}>
              <Select value={DATE_FORMATS.includes(data.date_format) ? data.date_format : ''} onChange={(e) => apply({ date_format: e.target.value })}>
                {!DATE_FORMATS.includes(data.date_format) && <option value="">{t('desk.time.notSet')}</option>}
                {DATE_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
              </Select>
            </Setting>
            <Setting label={t('desk.time.timeFormat')}>
              <Select value={TIME_FORMATS.includes(data.time_format) ? data.time_format : ''} onChange={(e) => apply({ time_format: e.target.value })}>
                {!TIME_FORMATS.includes(data.time_format) && <option value="">{t('desk.time.notSet')}</option>}
                {TIME_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
              </Select>
            </Setting>
          </div>
        </>
      )}
    </div>
  )
}

// --- systems and rooms --------------------------------------------------------------------

// The speakers' own update, on the system it is for. Confirmed first, as music stops in each room
// while it installs.
function SystemUpdate({ household, households, update, onStarted }) {
  const { t } = useI18n()
  const [ask, setAsk] = useState(false)
  const [started, setStarted] = useState(false)
  if (!update?.pending && !started) return null
  return (
    <div className="sv-toolrow sv-box">
      <G.Update size={24} />
      {started ? <span>{t('desk.update.started')}</span> : (
        <span><strong>{t('desk.update.title')}</strong> <span className="sv-dim">{versionLabel(update.display, update.version)}</span></span>
      )}
      <span className="sv-grow" />
      {!started && <Btn variant="solid" size="s" onClick={() => setAsk(true)}>{t('desk.update.start')}</Btn>}
      {ask && (
        <Confirm title={t('desk.update.title')} body={updateBody(t, households, household.id, versionLabel(update.display, update.version))} icon={<G.Update size={48} />}
                 action={t('desk.update.start')} cancelLabel={t('desk.update.notNow')} onClose={() => setAsk(false)}
                 onConfirm={async () => {
                   setAsk(false)
                   const done = await api.startSoftwareUpdate(household.id).catch(() => null)
                   if (done?.started?.length) { setStarted(true); onStarted() }
                 }} />
      )}
    </div>
  )
}

function SystemsPage({ households, zones }) {
  const { t } = useI18n()
  const { actions, scanning, lastScan, connected } = useSystem()
  const speakerUpdates = useSpeakerUpdates(households)
  const [health, setHealth] = useState(null)
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)) }, [])
  return (
    <div className="sv-stack">
      <div className="sv-toolrow">
        <span className="sv-dot" data-on={connected || undefined} />
        <span>{connected ? t('net.live') : t('common.reconnecting')}</span>
        {health && <span className="sv-dim">· {t.plural('common.rooms', health.zones)}</span>}
        <span className="sv-grow" />
        <Btn size="s" icon={<G.Refresh size={12} />} disabled={scanning} onClick={() => actions.refresh()}>{scanning ? t('net.scanning') : t('net.rescan')}</Btn>
      </div>
      {lastScan && <p className="sv-dim">{t('net.scanDone', { rooms: t.plural('common.rooms', lastScan.rooms), systems: t.plural('common.systems', lastScan.systems) })}</p>}
      {orderedHouseholds(households).map((h) => {
        const speakers = playersOf(h, Object.values(zones))
        const rooms = h.zone_uuids.length
        return (
          <section key={h.id} className="sv-stack">
            <h2 className="sv-rule-head">{h.generation} <small>
              {t.plural('common.rooms', rooms)}{speakers.length !== rooms && ` · ${t.plural('common.speakers', speakers.length)}`}
            </small></h2>
            <SystemUpdate household={h} households={households} update={speakerUpdates.updates[h.id]} onStarted={() => speakerUpdates.clear(h.id)} />
            <div className="sv-table-wrap">
              <table className="sv-table">
                <colgroup><col style={{ width: '27%' }} /><col style={{ width: '27%' }} /><col style={{ width: '27%' }} /><col style={{ width: '19%' }} /></colgroup>
                <thead><tr><th>{t('desk.about.speakers')}</th><th>{t('desk.about.model')}</th><th>{t('desk.about.version')}</th><th>{t('desk.about.address')}</th></tr></thead>
                <tbody>
                  {speakers.map((p) => (
                    <tr key={p.uuid} data-offline={p.online === false || undefined}>
                      <th>{playerLabel(p)}{p.online === false && <small> · {t('desk.rooms.offline')}</small>}</th>
                      <td>{p.model}</td><td>{versionLabel(p.display_version, p.software_version)}</td><td>{p.host}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {h.vanished?.length > 0 && <p className="sv-dim">{t('sv.alsoRemembered', { names: h.vanished.map((v) => v.name).join(', ') })}</p>}
          </section>
        )
      })}
    </div>
  )
}

// --- Sonos account ----------------------------------------------------------------------

function AccountPage() {
  const { t } = useI18n()
  const account = useCloudAccount()
  const [creds, setCreds] = useState({ email: '', password: '' })
  const { busy, error } = account
  const signIn = async (event) => {
    event.preventDefault()
    if (await account.signIn(creds.email, creds.password)) setCreds({ email: '', password: '' })
    else setCreds((prev) => ({ ...prev, password: '' }))
  }
  return (
    <div className="sv-stack">
      {account.known && <><p className="sv-dim">{t('account.blurb')}</p><p className="sv-dim">{t('account.optional')}</p></>}
      {!account.known ? null : account.signedIn ? (
        <div className="sv-box sv-toolrow">
          <G.Person size={24} />
          <span>{t('account.signedInAs', { email: account.email })}</span>
          <span className="sv-grow" />
          <Btn size="s" disabled={busy} onClick={account.signOut}>{t('account.signOut')}</Btn>
        </div>
      ) : (
        <form className="sv-stack sv-signin" onSubmit={signIn}>
          <Field label={t('account.email')} type="email" value={creds.email} onChange={(v) => setCreds({ ...creds, email: v })} autoComplete="username" />
          <Field label={t('account.password')} type="password" value={creds.password} onChange={(v) => setCreds({ ...creds, password: v })} autoComplete="current-password" />
          <div><Btn variant="solid" type="submit" disabled={busy || !creds.email || !creds.password}>{busy ? t('account.signingIn') : t('account.signIn')}</Btn></div>
        </form>
      )}
      {error && <p className="sv-error">{error}</p>}
    </div>
  )
}

// --- network ---------------------------------------------------------------------------

function NetworkPage({ systemFilter }) {
  const { t } = useI18n()
  const { data, loading, error } = useDiagnostics()
  return (
    <div className="sv-stack">
      <MeshGuidance />
      {error && <p className="sv-error">{error}</p>}
      {loading && !data && <Busy label={t('net.probing')} />}
      {forSystem(data, systemFilter)?.households.map((h) => (
        <section key={h.household} className="sv-stack">
          <h2 className="sv-rule-head">{h.generation} <small>{t.plural('common.speakers', h.rooms.length)}</small></h2>
          <HealthDonut household={h} />
          {h.findings?.length > 0 ? (
            <div className="sv-findings">
              {h.findings.map((f, i) => (
                <div key={i} className="sv-box sv-finding" data-severity={f.severity}>
                  <strong>{f.title}</strong>
                  <p>{f.detail}</p>
                  {f.remedy && <p className="sv-dim">{f.remedy}</p>}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      <NetworkMap data={data} loading={loading} systemFilter={systemFilter} />
    </div>
  )
}

// --- appearance ------------------------------------------------------------------------------

function Field2({ label, children, hint = '' }) {
  return (
    <div className="sv-setting">
      <span className="sv-setting-label">{label}</span>
      <div className="sv-setting-value">{children}</div>
      {hint && <p className="sv-dim">{hint}</p>}
    </div>
  )
}

// The screen's phosphor, how the covers are drawn on it, and whether the keys sound, then the
// theme chooser every theme carries.
function AppearancePage() {
  const { t } = useI18n()
  const prefs = usePrefs()
  return (
    <div className="sv-stack">
      <Setting label={t('sv.phosphor')} hint={t('sv.phosphorBody')}>
        <Seg label={t('sv.phosphor')} value={prefs.phosphor} onChange={(id) => writePref('phosphor', id)}
             options={PHOSPHORS.map((id) => ({ id, label: t(`sv.phosphor.${id}`), icon: <span className="sv-swatch" data-phosphor={id} aria-hidden="true" /> }))} />
      </Setting>
      <Toggle checked={prefs.colorArt} label={t('sv.colorArt')} onChange={(on) => writePref('colorArt', on)} />
      <p className="sv-dim sv-hint">{t('sv.colorArtBody')}</p>
      <div className="sv-inline">
        <Toggle checked={prefs.sound} label={t('sv.keySound')} onChange={(on) => { writePref('sound', on); if (on) setTimeout(() => { keySound('down'); setTimeout(() => keySound('up'), 90) }, 0) }} />
      </div>
      <p className="sv-dim sv-hint">{t('sv.keySoundBody')}</p>
      <ThemeChooser Field={Field2} Select={Select} classes={{
        select: 'sv-select', button: 'sv-btn sv-btn-line sv-btn-s', primary: 'sv-btn sv-btn-solid sv-btn-s',
        preview: 'sv-theme-preview', version: 'sv-theme-version', blurb: 'sv-dim',
        noshot: 'sv-theme-noshot', actions: 'sv-inline', error: 'sv-error', manage: 'sv-theme-manage',
      }} />
    </div>
  )
}

// --- the log -------------------------------------------------------------------------------------

function LogPage() {
  const { t } = useI18n()
  const [entries, setEntries] = useState(null)
  const load = useCallback(() => { api.errorLog().then((r) => setEntries(r.entries || [])).catch(() => setEntries([])) }, [])
  useEffect(() => { load() }, [load])
  return (
    <div className="sv-stack">
      <div className="sv-toolrow"><span className="sv-grow" /><Btn size="s" icon={<G.Refresh size={12} />} onClick={load}>{t('sv.reload')}</Btn></div>
      {entries === null ? <Busy label={t('desk.browse.loading')} />
        : entries.length === 0 ? <Empty icon={<G.Check size={48} />} title={t('desk.errorLog.empty')} /> : (
          <div className="sv-table-wrap">
            <table className="sv-table sv-log">
              <tbody>
                {[...entries].reverse().map((e, i) => (
                  <tr key={i} data-level={e.level}>
                    <td>{new Date(e.time * 1000).toLocaleTimeString()}</td>
                    <td><span className="sv-level" data-level={e.level}>{e.level}</span></td>
                    <td className="sv-dim">{e.source}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

export function ShortcutsWindow({ onClose }) {
  const { t } = useI18n()
  const rows = [
    [t('desk.shortcuts.playPause'), 'Space'], [t('common.next'), 'Ctrl →'], [t('common.previous'), 'Ctrl ←'],
    [t('desk.shortcuts.volUp'), 'Ctrl ↑'], [t('desk.shortcuts.volDown'), 'Ctrl ↓'], [t('desk.shortcuts.mute'), 'Ctrl M'], [t('win.shortcuts.muteAll'), 'Ctrl ⇧ M'],
    [t('win.shortcuts.toggleShuffle'), 'Ctrl E'], [t('win.shortcuts.toggleRepeat'), 'Ctrl R'], [t('win.shortcuts.toggleCrossfade'), 'Ctrl ⇧ X'],
    [t('desk.shortcuts.nextZone'), 'Ctrl .'], [t('desk.shortcuts.prevZone'), 'Ctrl ,'],
    [t('common.search'), 'Ctrl K'], [t('win.shortcuts.jumpSearch'), 'Ctrl F'],
    [t('sv.prog.player'), '1'], [t('sv.prog.queue'), '2'], [t('sv.prog.library'), '3'], [t('sv.prog.rooms'), '4'],
    [t('sv.prog.clock'), '5'], [t('sv.prog.setup'), '6'],
    [t('win.shortcuts.favorites'), 'Ctrl *'], [t('desk.shortcuts.title'), '?'], [t('win.shortcuts.closeWindow'), 'Esc'],
  ]
  return (
    <Window kind="dialog" title={t('desk.shortcuts.title')} onClose={onClose}>
      <WindowBar title={t('desk.shortcuts.title')} onClose={onClose} />
      <div className="sv-window-body">
        <dl className="sv-shortcuts">
          {rows.map(([label, key]) => <React.Fragment key={key}><dt>{label}</dt><dd><Kbd>{key}</Kbd></dd></React.Fragment>)}
        </dl>
      </div>
      <footer className="sv-window-actions"><Btn variant="solid" onClick={onClose}>{t('common.done')}</Btn></footer>
    </Window>
  )
}
