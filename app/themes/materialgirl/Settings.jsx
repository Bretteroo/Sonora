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
import NetworkMap, { HealthDonut } from '../../frontend/src/components/NetworkMap.jsx'
import ParentalControls from '../../frontend/src/components/ParentalControls.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetBar, Button, IconButton, Switch, Confirm, Empty, Busy, Menu, MenuItem, MenuSep, Select, TextField, ListItem, SystemPicker, Loading, Kbd, Skeleton } from './m3.jsx'
import { SHAPES } from './shapes.js'
import { readDynamic, writeDynamic } from './color.js'
import { ServiceGrid } from './Browse.jsx'

// Settings, in M3's list-detail layout: the pages as a list with a line of
// what each is for, and the page beside it on a wide window. On a compact
// window the list is the page, and choosing a row opens its page with a back
// arrow. Every page reads and writes through the calls the other themes use.

export const PAGES = ['account', 'services', 'library', 'time', 'systems', 'parental', 's2', 'network', 'appearance', 'log']
const PAGE_ICONS = { account: I.Person, services: I.Link, library: I.Library, time: I.Clock, systems: I.Speaker, parental: I.Prohibit, s2: I.Sparkle, network: I.Signal, appearance: I.Palette, log: I.Warning }

export default function SettingsPage({ households, zones, page, setPage, onLinkService, servicesVersion, onServicesChanged, onMessage, onAbout, onShortcuts, compact }) {
  const { t } = useI18n()
  const current = PAGES.includes(page) ? page : (compact ? '' : 'services')
  // On a phone the list and a page are two levels: a page slides in forward, the list comes back
  // from the left. Beside the list on a wide window, a new page simply fades in.
  const wasOn = useRef(current)
  const motion = compact ? (current ? 'forward' : (wasOn.current ? 'back' : '')) : (wasOn.current !== current ? 'fade' : '')
  useEffect(() => { wasOn.current = current }, [current])
  const detail = current && (
    <section className="mg-settings-detail" key={current} data-motion={motion || undefined} data-page={current} aria-label={t(`mg.settings.${current}`)}>
      <header className="mg-settings-detail-head">
        {compact && <IconButton label={t('common.back')} onClick={() => setPage('')}><I.Back /></IconButton>}
        <div>
          <h2 className="mg-headline">{t(`mg.settings.${current}`)}</h2>
          <p className="mg-muted">{t(`mg.settings.${current}.blurb`)}</p>
        </div>
      </header>
      {current === 'account' && <AccountPage />}
      {current === 'services' && <ServicesPage households={households} zones={zones} onLinkService={onLinkService} version={servicesVersion} onChanged={onServicesChanged} onMessage={onMessage} />}
      {current === 'library' && <LibraryPage households={households} />}
      {current === 'time' && <TimePage households={households} />}
      {current === 'systems' && <SystemsPage households={households} zones={zones} />}
      {current === 'parental' && <ParentalPage />}
      {current === 's2' && <S2Upgrade />}
      {current === 'network' && <NetworkPage />}
      {current === 'appearance' && <AppearancePage />}
      {current === 'log' && <LogPage />}
    </section>
  )
  if (compact && current) return <div key="page" className="mg-page mg-settings mg-settings-single">{detail}</div>
  return (
    <div key="list" className="mg-page mg-settings" data-motion={compact && motion === 'back' ? 'back' : undefined}>
      <nav className="mg-settings-list" aria-label={t('common.settings')}>
        <h1 className="mg-headline">{t('common.settings')}</h1>
        <div className="mg-card mg-card-filled mg-list">
          {PAGES.map((id) => {
            const Glyph = PAGE_ICONS[id]
            return (
              <ListItem key={id} selected={current === id} onClick={() => setPage(id)} aria-current={current === id || undefined}
                        leading={<span className="mg-li-glyph" style={{ clipPath: current === id ? SHAPES.cookie9 : SHAPES.circle }}><Glyph /></span>}
                        headline={t(`mg.settings.${id}`)}
                        trailing={compact ? <I.Chevron /> : null} />
            )
          })}
        </div>
        <div className="mg-card mg-card-filled mg-list">
          {!compact && <ListItem leading={<span className="mg-li-glyph"><I.Keyboard /></span>} headline={t('desk.shortcuts.title')} onClick={onShortcuts} />}
          <ListItem leading={<span className="mg-li-glyph"><I.Info /></span>} headline={t('about.menu')} onClick={onAbout} />
        </div>
      </nav>
      {!compact && detail}
    </div>
  )
}

// --- content filters -------------------------------------------------------------

const MG_PARENTAL = {
  section: 'mg-stack', blurb: 'mg-muted', note: 'mg-muted', error: 'mg-error', button: 'mg-btn mg-btn-tonal mg-btn-xs', row: 'mg-parental-row', actions: 'mg-inline',
}
// Defined once, outside the page: written inside it, it was a new component on every render, and
// each switch was rebuilt whenever a playing track ticked.
const MgSwitch = ({ label, checked, disabled, hint, onChange }) => (
  <span title={hint || undefined}><Switch label={label} checked={checked} disabled={disabled} onChange={onChange} /></span>
)
function ParentalPage() {
  return <ParentalControls shape="switch" showTitle={false} classes={MG_PARENTAL} Toggle={MgSwitch} />
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
    <div className="mg-stack">
      <div className="mg-toolbar-row">
        <SystemPicker households={ordered} value={activeTab} onChange={setTab} all={false} />
        <span className="mg-grow" />
        <Button variant="filled" size="s" icon={<I.Plus />} onClick={() => setAdding(true)}>{t('desk.add.button')}</Button>
      </div>
      {byHh === null ? <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />
        : services.length === 0 ? <Empty icon={<I.Link />} title={t('mg.services.none')} /> : (
          <div className="mg-card mg-card-filled mg-list">
            {services.map((s) => {
              const caution = serviceCaution(s)
              return (
                <ListItem key={`${s.id}-${s.account_id ?? ''}`}
                          leading={<span className="mg-li-logo">{s.icon ? <img src={s.icon} alt="" /> : <span className="mg-initials">{s.initials}</span>}{caution && <CautionBadge kind={caution} title={t(`services.caution.${caution}`, { gen: household?.generation })} />}</span>}
                          headline={<>{s.name}{s.nickname && s.nickname !== s.name ? <small> · {s.nickname}</small> : null}</>}
                          supporting={s.auth === 'Anonymous' ? t('win.services.anonymous')
                            : caution === 'sonos' ? t('mg.services.notLinked')
                            : caution === 'sonora' ? t('services.caution.sonora', { gen: household?.generation })
                            : t('mg.services.linked')}
                          trailing={<IconButton size="xs" label={t('desk.browse.actions')} onClick={(event) => setMenu({ s, anchor: event.currentTarget })}><I.More /></IconButton>} />
              )
            })}
          </div>
        )}
      {error && <p className="mg-error">{error}</p>}
      {menu && (
        <Menu anchor={menu.anchor} align="right" onClose={() => setMenu(null)} title={menu.s.name}>
          {serviceCaution(menu.s) === 'sonos' && (
            <MenuItem icon={<I.Link />} onSelect={() => { setMenu(null); onLinkService?.({ sid: menu.s.id, householdId: activeTab, name: menu.s.name, account: menu.s.account_id ?? '', auth: menu.s.auth }) }}>
              {t('desk.browse.needsLink.action', { service: menu.s.name })}
            </MenuItem>
          )}
          {menu.s.auth !== 'Anonymous' && menu.s.sonora_linked && (
            <MenuItem icon={<I.Refresh />} onSelect={() => { setMenu(null); onLinkService?.({ sid: menu.s.id, householdId: activeTab, name: menu.s.name, account: menu.s.account_id ?? '', auth: menu.s.auth, reauthorize: true }) }}>
              {t('win.services.reauthorize')}
            </MenuItem>
          )}
          {menu.s.auth !== 'Anonymous' && <MenuItem icon={<I.Edit />} onSelect={() => { setMenu(null); setRenaming(menu.s) }}>{t('services.rename')}</MenuItem>}
          <MenuSep />
          <MenuItem icon={<I.Trash />} danger onSelect={() => { setMenu(null); setRemoving(menu.s) }}>{t('services.remove')}</MenuItem>
        </Menu>
      )}
      {renaming && (
        <Confirm title={t('services.renameTitle', { service: renaming.name })} body={t('win.services.editPrompt')} action={t('common.done')} icon={<I.Edit />}
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
                             onDone={() => { setRemoving(null); setTick((v) => v + 1); onChanged?.(); onMessage?.(t('mg.serviceRemoved', { service: removing.name })) }}
                             onError={(msg) => { setRemoving(null); setError(msg) }} />
      )}
      {adding && <LinkServiceSheet households={households} initialTab={activeTab} onClose={() => setAdding(false)} onLinked={() => { setTick((v) => v + 1); onChanged?.() }} />}
    </div>
  )
}

function RemoveServiceDialog({ service, zone, gen, onClose, onDone, onError }) {
  const { t } = useI18n()
  const c = useRemoveChoice({ sid: service.id, zone, accountId: service.account_id ?? '', sonoraLinked: service.sonora_linked, onSystem: service.on_system, onDone })
  useEffect(() => { if (c.error) onError(t('services.removeFailed', { service: service.name, error: c.error })) }, [c.error]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Confirm title={t('services.removeTitle', { service: service.name })} danger icon={<I.Trash />}
             body={c.single === 'sonos' ? t('services.removeSonosBody', { service: service.name })
               : c.single === 'sonora' ? t('services.removeSonoraBody', { service: service.name })
               : t('services.removeChoose', { service: service.name })}
             action={c.busy ? t('services.removing', { service: service.name }) : t('services.confirmRemove')} disabled={!c.canConfirm || c.busy}
             onConfirm={c.submit} onClose={onClose}>
      {!c.single && (
        <div className="mg-stack">
          <Switch checked={c.sonora} disabled={!c.canSonora} onChange={c.setSonora} label={`${t('services.removeSonora')} — ${t('services.removeSonoraSub')}`} />
          <Switch checked={c.sonos} disabled={!c.canSonos} onChange={c.setSonos} label={`${t('services.removeSonos', { gen })} — ${t('services.removeSonosSub')}`} />
        </div>
      )}
    </Confirm>
  )
}

// Linking a service: the household's catalog, or straight into one service's
// sign-in. The provider hands out a code; the person signs in on the
// provider's site; the speakers are polled until the account lands.
export function LinkServiceSheet({ households, preset = null, initialTab = null, onClose, onLinked }) {
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
    <Sheet kind="full" title={t('desk.add.title')} onClose={onClose}>
      <SheetBar title={link.chosen ? name : t('desk.add.title')} sub={link.chosen ? '' : t('desk.add.intro')} onClose={onClose}
                back={link.chosen && !preset && link.status !== 'done' ? link.reset : null}>
        <Button variant={link.status === 'done' ? 'filled' : 'text'} size="s" onClick={onClose}>{link.status === 'done' ? t('common.done') : t('common.cancel')}</Button>
      </SheetBar>
      <div className="mg-sheet-body mg-stack">
        {!link.chosen ? (
          <>
            <div className="mg-toolbar-row">
              <SystemPicker households={link.households} value={link.activeTab} onChange={link.setTab} all={false} />
              <TextField label={t('mg.filterServices')} value={filter} onChange={setFilter} leading={<I.Search />} autoFocus />
            </div>
            {!link.loaded ? <Busy label={t('desk.browse.loading')} />
              : <ServiceGrid services={shown} t={t} onPick={(service) => link.start(service, link.zoneForHousehold(link.activeTab)?.uuid)} />}
            {link.error && <p className="mg-error">{link.error}</p>}
          </>
        ) : (
          <div className="mg-card mg-card-tonal mg-linkflow">
            {link.status === 'starting' && <Busy label={link.chosen?.service?.auth === 'Anonymous' ? t('desk.add.linking', { service: name }) : t('desk.add.starting', { service: name })} />}
            {link.status === 'needsApp' && <p>{t('desk.add.needsApp', { service: name })}</p>}
            {link.status === 'waiting' && link.link && (
              <>
                <p>{link.link.show_link_code ? t('desk.add.instructions', { url: link.link.reg_url }) : t('desk.add.instructionsNoCode', { url: link.link.reg_url })}</p>
                {link.link.show_link_code && <p className="mg-code">{link.link.link_code}</p>}
                <div><Button variant="filled" icon={<I.Link />} onClick={() => window.open(link.link.reg_url, '_blank', 'noopener')}>{t('desk.add.open')}</Button></div>
                <Busy label={t('desk.add.waiting', { service: name })} />
              </>
            )}
            {link.status === 'done' && (
              <p className="mg-done"><I.Check /><LinkedMessage result={serviceLinkedMessage(t, { name, zone: link.chosen?.zone, households, registered: link.registered, auth: link.chosen?.service?.auth })}
                                                   onOpen={(hid) => { link.reset(); link.setTab(hid) }} /></p>
            )}
            {link.status === 'failed' && <p className="mg-error">{t('desk.add.failed', { service: name, error: link.error })}</p>}
          </div>
        )}
      </div>
    </Sheet>
  )
}

// --- music library ---------------------------------------------------------------------

const ALBUM_ARTIST_OPTIONS = ['ITUNES', 'WMP', 'NONE']
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
    <div className="mg-stack">
      <SystemPicker households={lib.ordered} value={lib.activeTab} onChange={lib.setTab} all={false} />
      {!data && !lib.error && <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />}
      {lib.error && <p className="mg-error">{lib.error}</p>}
      {data && (
        <>
          <h3 className="mg-title-m">{t('desk.library.mine')}</h3>
          {data.shares.length === 0 && lib.pending.length === 0 ? <p className="mg-muted">{t('desk.library.none')}</p> : (
            <div className="mg-card mg-card-filled mg-list">
              {data.shares.map((s) => (
                <ListItem key={s.id} leading={<span className="mg-li-glyph"><I.Folder /></span>}
                          headline={(s.path || s.title || '').split('/').filter(Boolean).pop()} supporting={s.path || s.title}
                          trailing={<IconButton size="xs" label={t('desk.library.remove')} disabled={lib.busy} onClick={() => setConfirm(s)}><I.Trash /></IconButton>} />
              ))}
              {lib.pending.map((p) => (
                <ListItem key={p.path} role="status" leading={<span className="mg-li-glyph">{p.state === 'failed' ? <I.Warning /> : <Loading size={24} />}</span>}
                          headline={p.state === 'failed' ? t('desk.library.addFailed', { path: p.path })
                            : p.state === 'indexing' ? (p.path || '').split(/[\\/]/).filter(Boolean).pop() : t('desk.library.adding')}
                          supporting={p.state === 'failed' ? (p.hint || t('desk.library.addFailedWhy'))
                            : p.state === 'indexing' ? t('desk.library.addedIndexing') : `${t('desk.library.addingPath', { path: p.path })}${p.hint ? ` ${p.hint}` : ''}`} />
              ))}
            </div>
          )}
          {adding ? (
            <div className="mg-card mg-card-outlined mg-stack mg-addshare">
              <TextField label={t('desk.library.pathHint')} value={path} autoFocus onChange={setPath} onEnter={() => path.trim() && addShare()} />
              <div className="mg-inline">
                <TextField label={t('desk.library.username')} value={user} onChange={setUser} onEnter={() => path.trim() && addShare()} />
                <TextField label={t('desk.library.password')} type="password" value={pass} onChange={setPass} onEnter={() => path.trim() && addShare()} />
              </div>
              <p className="mg-muted">{t('desk.library.credHint')}</p>
              <div className="mg-inline">
                <Button variant="filled" size="s" disabled={!path.trim() || lib.busy} onClick={addShare}>{t('desk.library.add')}</Button>
                <Button variant="text" size="s" onClick={() => { setAdding(false); setPath(''); setUser(''); setPass('') }}>{t('common.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div><Button variant="tonal" icon={<I.Plus />} disabled={lib.busy} onClick={() => setAdding(true)}>{t('desk.library.addFolder')}</Button></div>
          )}
          {data.index_error && <p className="mg-error">{t('desk.library.indexError', { error: data.index_error })}</p>}
          <p className="mg-muted">{t('desk.library.pathNote')}</p>
          <h3 className="mg-title-m">{t('desk.library.indexTitle')}</h3>
          <div className="mg-inline">
            <Switch checked={lib.scheduled} disabled={lib.busy} label={t('desk.library.schedule')} onChange={(on) => lib.apply({ daily_refresh: on ? `${lib.scheduleTime}:00` : '' })} />
            <input className="mg-time-input" type="time" value={lib.scheduleTime} disabled={!lib.scheduled || lib.busy} aria-label={t('desk.library.schedule')}
                   onChange={(e) => e.target.value && lib.apply({ daily_refresh: `${e.target.value}:00` })} />
          </div>
          <div className="mg-inline">
            <Button variant="outlined" size="s" icon={<I.Refresh />} disabled={data.indexing || lib.busy} onClick={() => lib.apply({ refresh: true })}>{t('desk.library.updateNow')}</Button>
            {data.indexing && <span className="mg-muted mg-inline"><Loading size={24} />{t('desk.library.indexing')}</span>}
          </div>
          <h3 className="mg-title-m">{t('desk.library.compilations')}</h3>
          <div className="mg-setting">
            <span className="mg-setting-label">{t('desk.library.groupBy')}</span>
            <Select disabled={lib.busy} value={ALBUM_ARTIST_OPTIONS.includes(data.album_artist_option) ? data.album_artist_option : 'WMP'} onChange={(e) => lib.apply({ album_artist_option: e.target.value })}>
              {ALBUM_ARTIST_OPTIONS.map((o) => <option key={o} value={o}>{t(`desk.library.group.${o}`)}</option>)}
            </Select>
            <p className="mg-muted">{t('desk.library.compilationsNote')}</p>
          </div>
          <Switch checked={prefs.contributing} label={t('desk.library.showContributing')} onChange={(on) => setPrefs(writeLibraryPrefs({ contributing: on }))} />
          <div className="mg-setting">
            <span className="mg-setting-label">{t('desk.library.sortFolders')}</span>
            <Select value={prefs.folderSort} onChange={(e) => setPrefs(writeLibraryPrefs({ folderSort: e.target.value }))}>
              {FOLDER_SORTS.map((o) => <option key={o} value={o}>{t(`desk.library.sort.${o}`)}</option>)}
            </Select>
          </div>
          {confirm && (
            <Confirm title={t('desk.library.removeTitle')} body={t('desk.library.removeBody', { folder: confirm.title || confirm.uri })} action={t('desk.library.remove')} danger disabled={lib.busy} icon={<I.Folder />}
                     onConfirm={() => { lib.apply({ remove_id: confirm.id }); setConfirm(null) }} onClose={() => setConfirm(null)} />
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
  // A system that keeps its time server (S2) always sets its clock from
  // the Internet, so it is offered no switch for it, as the S2 apps offer none.
  const fixed = Boolean(data?.server_fixed)
  const internet = fixed || (guess.internet ?? Boolean(data?.server))
  const autoDst = guess.auto_dst ?? Boolean(data?.auto_dst)
  const clock = data ? formatClock(data.local, data.time_format, data.date_format) : null
  const zoneEntry = data?.zones.find((z) => z.index === data.index)
  return (
    <div className="mg-stack">
      <SystemPicker households={ordered} value={activeTab} onChange={setTab} all={false} />
      {!data && !error && <Skeleton label={t('desk.time.loading')} kind="list" rows={3} />}
      {error && <p className="mg-error">{error}</p>}
      {data && (
        <>
          <div className="mg-card mg-card-tonal mg-clockface">
            <strong>{clock.time}</strong>
            <span>{clock.date}</span>
            {internet && data.server && <small>{t('desk.time.server', { server: data.server.split(',')[0] })}</small>}
          </div>
          <div className="mg-setting">
            <span className="mg-setting-label">{t('desk.time.timeZone')}</span>
            <Select value={data.index} onChange={(e) => apply({ index: Number(e.target.value) })}>
              {data.zones.map((z) => <option key={z.index} value={z.index}>{zoneLabel(z)}</option>)}
            </Select>
          </div>
          <Switch checked={autoDst} disabled={!zoneEntry?.dst} label={t('desk.time.autoDst')} onChange={(on) => apply({ auto_dst: on }, { auto_dst: on })} />
          {!fixed && <Switch checked={internet} label={t('desk.time.internet')} onChange={(on) => apply({ internet_time: on }, { internet: on })} />}
          {!internet && (
            <div className="mg-inline">
              <input className="mg-time-input" type="date" value={manual.date} aria-label={t('desk.time.setNow')} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
              <input className="mg-time-input" type="time" value={manual.time} aria-label={t('desk.time.setNow')} onChange={(e) => setManual({ ...manual, time: e.target.value })} />
              <Button variant="filled" size="s" disabled={busy || !manual.date || !manual.time}
                      onClick={() => apply({ desired_time: `${manual.date} ${manual.time.length === 5 ? `${manual.time}:00` : manual.time}` })}>{t('desk.time.setNow')}</Button>
            </div>
          )}
          <div className="mg-two">
            <div className="mg-setting">
              <span className="mg-setting-label">{t('desk.time.dateFormat')}</span>
              <Select value={DATE_FORMATS.includes(data.date_format) ? data.date_format : ''} onChange={(e) => apply({ date_format: e.target.value })}>
                {!DATE_FORMATS.includes(data.date_format) && <option value="">{t('desk.time.notSet')}</option>}
                {DATE_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
              </Select>
            </div>
            <div className="mg-setting">
              <span className="mg-setting-label">{t('desk.time.timeFormat')}</span>
              <Select value={TIME_FORMATS.includes(data.time_format) ? data.time_format : ''} onChange={(e) => apply({ time_format: e.target.value })}>
                {!TIME_FORMATS.includes(data.time_format) && <option value="">{t('desk.time.notSet')}</option>}
                {TIME_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- systems and rooms --------------------------------------------------------------------

function SystemsPage({ households, zones }) {
  const { t } = useI18n()
  const { actions, scanning, lastScan, connected } = useSystem()
  const [health, setHealth] = useState(null)
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)) }, [])
  return (
    <div className="mg-stack">
      <div className="mg-toolbar-row">
        <span className="mg-dot" data-on={connected || undefined} />
        <span>{connected ? t('net.live') : t('common.reconnecting')}</span>
        {health && <span className="mg-muted">· {t.plural('common.rooms', health.zones)}</span>}
        <span className="mg-grow" />
        <Button variant="tonal" size="s" icon={<I.Refresh />} disabled={scanning} onClick={() => actions.refresh()}>{scanning ? t('net.scanning') : t('net.rescan')}</Button>
      </div>
      {lastScan && <p className="mg-muted">{t('net.scanDone', { rooms: t.plural('common.rooms', lastScan.rooms), systems: t.plural('common.systems', lastScan.systems) })}</p>}
      {orderedHouseholds(households).map((h) => {
        const speakers = playersOf(h, Object.values(zones))
        const rooms = h.zone_uuids.length
        return (
          <section key={h.id} className="mg-stack">
            <h3 className="mg-title-m">{h.generation} <small className="mg-muted">
              {t.plural('common.rooms', rooms)}{speakers.length !== rooms && ` · ${t.plural('common.speakers', speakers.length)}`}
            </small></h3>
            <div className="mg-table-wrap">
              <table className="mg-table">
                <colgroup><col style={{ width: '30%' }} /><col style={{ width: '30%' }} /><col style={{ width: '18%' }} /><col style={{ width: '22%' }} /></colgroup>
                <thead><tr><th>{t('desk.about.speakers')}</th><th>{t('desk.about.model')}</th><th>{t('desk.about.version')}</th><th>{t('desk.about.address')}</th></tr></thead>
                <tbody>
                  {speakers.map((p) => (
                    <tr key={p.uuid} data-offline={p.online === false || undefined}>
                      <th>{playerLabel(p)}{p.online === false && <small> · {t('desk.rooms.offline')}</small>}</th>
                      <td>{p.model}</td><td>{p.display_version || ''}</td><td className="mg-mono">{p.host}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {h.vanished?.length > 0 && <p className="mg-muted">{t('mg.alsoRemembered', { names: h.vanished.map((v) => v.name).join(', ') })}</p>}
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
    <div className="mg-stack">
      {account.known && <><p className="mg-muted">{t('account.blurb')}</p><p className="mg-muted">{t('account.optional')}</p></>}
      {!account.known ? null : account.signedIn ? (
        <div className="mg-card mg-card-filled">
          <ListItem leading={<span className="mg-li-glyph mg-li-glyph-primary" style={{ clipPath: SHAPES.cookie9 }}><I.Person /></span>}
                    headline={t('account.signedInAs', { email: account.email })}
                    trailing={<Button variant="outlined" size="xs" disabled={busy} onClick={account.signOut}>{t('account.signOut')}</Button>} />
        </div>
      ) : (
        <form className="mg-stack mg-signin" onSubmit={signIn}>
          <TextField label={t('account.email')} type="email" value={creds.email} onChange={(v) => setCreds({ ...creds, email: v })} autoComplete="username" />
          <TextField label={t('account.password')} type="password" value={creds.password} onChange={(v) => setCreds({ ...creds, password: v })} autoComplete="current-password" />
          <div><Button variant="filled" type="submit" disabled={busy || !creds.email || !creds.password}>{busy ? t('account.signingIn') : t('account.signIn')}</Button></div>
        </form>
      )}
      {error && <p className="mg-error">{error}</p>}
    </div>
  )
}

// --- network ---------------------------------------------------------------------------

function NetworkPage() {
  const { t } = useI18n()
  const { data, loading, error } = useDiagnostics()
  return (
    <div className="mg-stack">
      {error && <p className="mg-error">{error}</p>}
      {loading && !data && <Busy label={t('net.probing')} />}
      {data?.households.map((h) => (
        <section key={h.household} className="mg-stack">
          <h3 className="mg-title-m">{h.generation} <small className="mg-muted">{t.plural('common.speakers', h.rooms.length)}</small></h3>
          <HealthDonut household={h} />
          {h.findings?.length > 0 ? (
            <div className="mg-findings">
              {h.findings.map((f, i) => (
                <div key={i} className="mg-card mg-finding" data-severity={f.severity}>
                  <strong>{f.title}</strong>
                  <p>{f.detail}</p>
                  {f.remedy && <p className="mg-muted">{f.remedy}</p>}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      <NetworkMap data={data} loading={loading} />
    </div>
  )
}

// --- appearance ------------------------------------------------------------------------------

function Field({ label, children, hint = '' }) {
  return (
    <div className="mg-setting">
      <span className="mg-setting-label">{label}</span>
      <div>{children}</div>
      {hint && <p className="mg-muted">{hint}</p>}
    </div>
  )
}

function AppearancePage() {
  const { t } = useI18n()
  const [dynamic, setDynamic] = useState(readDynamic)
  return (
    <div className="mg-stack">
      {/* Dynamic color is this theme's own: the playing cover picks the hue
          every color role is built from. */}
      <div className="mg-card mg-card-filled">
        <ListItem leading={<span className="mg-li-glyph mg-li-glyph-primary" style={{ clipPath: SHAPES.flower }}><I.Palette /></span>}
                  headline={t('mg.dynamicColor')} supporting={t('mg.dynamicColorBody')}
                  trailing={<Switch checked={dynamic} onChange={(on) => { setDynamic(on); writeDynamic(on) }} ariaLabel={t('mg.dynamicColor')} />} />
      </div>
      <ThemeChooser Field={Field} Select={Select} classes={{
        select: 'mg-select', button: 'mg-btn mg-btn-outlined mg-btn-s', primary: 'mg-btn mg-btn-filled mg-btn-s',
        preview: 'mg-theme-preview', version: 'mg-theme-version', blurb: 'mg-muted',
        noshot: 'mg-theme-noshot', actions: 'mg-inline', error: 'mg-error', manage: 'mg-theme-manage',
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
    <div className="mg-stack">
      <div className="mg-toolbar-row"><span className="mg-grow" /><Button variant="tonal" size="s" icon={<I.Refresh />} onClick={load}>{t('mg.reload')}</Button></div>
      {entries === null ? <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />
        : entries.length === 0 ? <Empty icon={<I.Check />} title={t('desk.errorLog.empty')} /> : (
          <div className="mg-table-wrap">
            <table className="mg-table mg-log">
              <tbody>
                {[...entries].reverse().map((e, i) => (
                  <tr key={i} data-level={e.level}>
                    <td className="mg-mono">{new Date(e.time * 1000).toLocaleTimeString()}</td>
                    <td><span className="mg-level" data-level={e.level}>{e.level}</span></td>
                    <td className="mg-muted">{e.source}</td>
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

export function ShortcutsSheet({ onClose }) {
  const { t } = useI18n()
  const rows = [
    [t('desk.shortcuts.playPause'), 'Space'], [t('common.next'), 'Ctrl →'], [t('common.previous'), 'Ctrl ←'],
    [t('desk.shortcuts.volUp'), 'Ctrl ↑'], [t('desk.shortcuts.volDown'), 'Ctrl ↓'], [t('desk.shortcuts.mute'), 'Ctrl M'], [t('win.shortcuts.muteAll'), 'Ctrl ⇧ M'],
    [t('win.shortcuts.toggleShuffle'), 'Ctrl E'], [t('win.shortcuts.toggleRepeat'), 'Ctrl R'], [t('win.shortcuts.toggleCrossfade'), 'Ctrl ⇧ X'],
    [t('desk.shortcuts.nextZone'), 'Ctrl .'], [t('desk.shortcuts.prevZone'), 'Ctrl ,'],
    [t('common.search'), 'Ctrl K'], [t('win.shortcuts.jumpSearch'), 'Ctrl F'], [t('common.queue'), 'Ctrl G'], [t('mg.openPlayer'), 'Ctrl J'],
    [t('mg.nav.listen'), 'Ctrl 1'], [t('mg.nav.browse'), 'Ctrl 2'], [t('mg.nav.rooms'), 'Ctrl 3'], [t('mg.nav.clock'), 'Ctrl 4'], [t('mg.nav.settings'), 'Ctrl 5'],
    [t('win.shortcuts.favorites'), 'Ctrl *'], [t('desk.shortcuts.title'), '?'], [t('win.shortcuts.closeWindow'), 'Esc'],
  ]
  return (
    <Sheet kind="dialog" title={t('desk.shortcuts.title')} onClose={onClose}>
      <span className="mg-dialog-icon" aria-hidden="true"><I.Keyboard /></span>
      <h2 className="mg-dialog-headline" data-centered="">{t('desk.shortcuts.title')}</h2>
      <div className="mg-dialog-body">
        <dl className="mg-shortcuts">
          {rows.map(([label, key]) => <React.Fragment key={key}><dt>{label}</dt><dd><Kbd>{key}</Kbd></dd></React.Fragment>)}
        </dl>
      </div>
      <footer className="mg-dialog-actions"><Button variant="text" onClick={onClose}>{t('common.done')}</Button></footer>
    </Sheet>
  )
}

