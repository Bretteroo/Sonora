import React, { useCallback, useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n, LANGUAGES } from '../../frontend/src/i18n/index.jsx'
import { useTheme } from '../../frontend/src/lib/theme.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { zoneLabel } from '../../frontend/src/lib/timezones.js'
import { useServiceLink } from '../../frontend/src/lib/useServiceLink.js'
import { useNarrow, SF_NARROW } from '../../frontend/src/lib/useNarrow.js'
import { useCloudAccount } from '../../frontend/src/lib/useCloudAccount.js'
import { playersOf, playerLabel } from '../../frontend/src/lib/players.js'
import { useRemoveChoice } from '../../frontend/src/lib/useRemoveChoice.js'
import { useLibrarySettings } from '../../frontend/src/lib/useLibrarySettings.js'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import { serviceLinkedMessage, LinkedMessage } from '../../frontend/src/lib/serviceLinkedMessage.js'
import { CautionBadge, serviceCaution } from '../../frontend/src/components/CautionBadge.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetHeader, Button, IconButton, Toggle, Field, Confirm, Empty, Spinner, SystemTabs, Kbd, Menu, MenuItem, MenuSep, Select } from './ui.jsx'
import { readLibraryPrefs, writeLibraryPrefs, FOLDER_SORTS } from '../../frontend/src/lib/libraryPrefs.js'
import ThemeChooser from '../../frontend/src/components/ThemeChooser.jsx'
import S2Upgrade from '../../frontend/src/components/S2Upgrade.jsx'
import NetworkMap, { HealthDonut } from '../../frontend/src/components/NetworkMap.jsx'
import Swirl from '../../frontend/src/components/Swirl.jsx'
import AlarmsSection from './Alarms.jsx'
import ParentalControls from '../../frontend/src/components/ParentalControls.jsx'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'
import { versionLabel } from '../../frontend/src/lib/version.js'

// Settings, arranged by what a person wants done: the music services and
// their links, the music library's folders, the clock, the systems, and their
// rooms, the network the speakers depend on, how Sonora looks, and what went
// wrong. Every page reads and writes through the same calls the desktop
// themes use.

// The Sonos account has a page of its own, first, where it had sat at the
// foot of Systems and rooms.
export const PAGES = ['account', 'services', 'library', 'time', 'systems', 'parental', 's2', 'network', 'appearance', 'log']
const PAGE_ICONS = { account: I.Person, alarms: I.Bell, services: I.Link, library: I.Library, time: I.Clock, systems: I.Speaker, parental: I.Prohibit, s2: I.Sparkle, network: I.Signal, appearance: I.Sun, log: I.Warning }

export default function SettingsSection({ households, zones, activeZone, activeGroup, systemFilter, page, setPage, onLinkService, servicesVersion, onServicesChanged, onMessage, onAbout, onShortcuts }) {
  const { t } = useI18n()
  // On a phone the navigation bar has no room for alarms, so they are one of
  // the settings pages there instead. Keyboard
  // shortcuts go the other way: nothing on a phone can press them.
  const narrow = useNarrow(SF_NARROW)
  const pages = narrow ? ['alarms', ...PAGES] : PAGES
  const current = pages.includes(page) ? page : 'services'
  return (
    <div className="sf-settings">
      <nav className="sf-settings-nav" aria-label={t('common.settings')}>
        <h1>{t('common.settings')}</h1>
        {/* A column of pages on a wide screen; on a narrow one the stylesheet
            hides it and shows the dropdown below instead. */}
        <label className="sf-settings-jump">
          <span className="sf-sr-only">{t('common.settings')}</span>
          <Select value={current} onChange={(event) => setPage(event.target.value)}>
            {pages.map((id) => <option key={id} value={id}>{t(`sf.settings.${id}`)}</option>)}
          </Select>
        </label>
        <div className="sf-settings-nav-strip">
        {pages.map((id) => {
          const Glyph = PAGE_ICONS[id]
          return (
            <button key={id} type="button" className="sf-settings-tab" aria-current={current === id || undefined} onClick={() => setPage(id)}>
              <Glyph /><span>{t(`sf.settings.${id}`)}</span>
            </button>
          )
        })}
        </div>
        <div className="sf-settings-nav-foot">
          {!narrow && <button type="button" className="sf-settings-tab" onClick={onShortcuts}><I.Keyboard /><span>{t('desk.shortcuts.title')}</span></button>}
          <button type="button" className="sf-settings-tab" onClick={onAbout}><I.Info /><span>{t('about.menu')}</span></button>
        </div>
      </nav>
      <section className="sf-settings-page" data-page={current} aria-label={t(`sf.settings.${current}`)}>
        {current !== 'alarms' && <h2 className="sf-settings-title">{t(`sf.settings.${current}`)}</h2>}
        {/* The upgrade advisor opens with a line of its own, in every theme,
            so this frame does not print a second one above it. */}
        {current !== 'alarms' && current !== 's2' && current !== 'account'
          && <p className="sf-page-sub">{t(`sf.settings.${current}.blurb`)}</p>}
        {current === 'account' && <AccountPage />}
        {current === 'alarms' && <AlarmsSection households={households} zones={zones} activeZone={activeZone} activeGroup={activeGroup} systemFilter={systemFilter} />}
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
    </div>
  )
}

// --- parental controls ---------------------------------------------------------

// The modern app calls this page Content Filters and draws it as a switch;
// this theme is the modern one, so it gets the switch rather than the Windows
// tab's button. The setting is the system's own, so there is one per system.
const SF_PARENTAL = {
  section: 'sf-settings-block', blurb: 'sf-muted', note: 'sf-muted',
  error: 'sf-error', button: 'sf-btn', row: 'sf-parental-row',
  actions: 'sf-parental-actions',
}

// Defined once, outside the page: written inside it, it was a new component on every render, and
// each switch was rebuilt whenever a playing track ticked.
const SfToggle = ({ label, checked, disabled, hint, onChange }) => (
  <span title={hint || undefined}>
    <Toggle label={label} checked={checked} disabled={disabled} onChange={onChange} />
  </span>
)
function ParentalPage() {
  return <ParentalControls shape="switch" showTitle={false} classes={SF_PARENTAL} Toggle={SfToggle} />
}

// --- music services ------------------------------------------------------------

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
    <div className="sf-settings-block">
      <div className="sf-settings-toolbar">
        <SystemTabs households={ordered} value={activeTab} onChange={setTab} />
        <Button primary icon={<I.Plus />} onClick={() => setAdding(true)}>{t('desk.add.button')}</Button>
      </div>
      {byHh === null ? <div className="sf-loading"><Spinner />{t('desk.browse.loading')}</div>
        : services.length === 0 ? <Empty icon={<I.Link />} title={t('outrun.services.none')} /> : (
          <ul className="sf-svc-list">
            {services.map((s) => {
              const caution = serviceCaution(s)
              return (
                <li key={`${s.id}-${s.account_id ?? ''}`} className="sf-svc">
                  <span className="sf-svc-icon">{s.icon ? <img src={s.icon} alt="" /> : <span className="sf-initials">{s.initials}</span>}{caution && <CautionBadge kind={caution} title={t(`services.caution.${caution}`, { gen: household?.generation })} />}</span>
                  <span className="sf-svc-text">
                    <span className="sf-svc-name">{s.name}{s.nickname && s.nickname !== s.name ? <small> · {s.nickname}</small> : null}</span>
                    <span className="sf-svc-state">
                      {s.auth === 'Anonymous' ? t('win.services.anonymous')
                        : caution === 'sonos' ? t('outrun.services.notLinked')
                        : caution === 'sonora' ? t('services.caution.sonora', { gen: household?.generation })
                        : t('outrun.services.linked')}
                    </span>
                  </span>
                  <IconButton size="sm" label={t('desk.browse.actions')} onClick={(event) => setMenu({ s, anchor: event.currentTarget })}><I.Ellipsis /></IconButton>
                </li>
              )
            })}
          </ul>
        )}
      {error && <p className="sf-error">{error}</p>}
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
          {menu.s.auth !== 'Anonymous' && (
            <MenuItem icon={<I.Pencil />} onSelect={() => { setMenu(null); setRenaming(menu.s) }}>
              {t('services.rename')}
            </MenuItem>
          )}
          <MenuSep />
          <MenuItem icon={<I.Trash />} danger onSelect={() => { setMenu(null); setRemoving(menu.s) }}>{t('services.remove')}</MenuItem>
        </Menu>
      )}
      {renaming && (
        <Confirm title={t('services.renameTitle', { service: renaming.name })}
                 body={t('win.services.editPrompt')} action={t('common.done')}
                 input={{ initial: renaming.nickname || '' }} onClose={() => setRenaming(null)}
                 onConfirm={async (name) => {
                   const was = renaming
                   setRenaming(null)
                   try {
                     await api.renameServiceAccount(was.id, { zone: zoneFor(), account_id: was.account_id ?? '', nickname: name })
                     // The speakers took it before this returned, so the row
                     // shows the new name now; the refetch behind it agrees.
                     setByHh((map) => (map?.[activeTab] ? { ...map, [activeTab]: map[activeTab].map((s) => (s === was ? { ...s, nickname: name } : s)) } : map))
                     setTick((v) => v + 1); onChanged?.()
                     onMessage?.(t('services.renamed', { service: was.name, name }))
                   } catch (exc) { setError(exc?.message || String(exc)) }
                 }} />
      )}
      {removing && (
        <RemoveServiceSheet service={removing} zone={zoneFor()} gen={household?.generation} onClose={() => setRemoving(null)}
                            onDone={() => { setRemoving(null); setTick((v) => v + 1); onChanged?.(); onMessage?.(t('sf.serviceRemoved', { service: removing.name })) }}
                            onError={(msg) => { setRemoving(null); setError(msg) }} />
      )}
      {adding && (
        <LinkServiceSheet households={households} initialTab={activeTab} onClose={() => setAdding(false)} onLinked={() => { setTick((v) => v + 1); onChanged?.() }} />
      )}
    </div>
  )
}

function RemoveServiceSheet({ service, zone, gen, onClose, onDone, onError }) {
  const { t } = useI18n()
  const c = useRemoveChoice({ sid: service.id, zone, accountId: service.account_id ?? '', sonoraLinked: service.sonora_linked, onSystem: service.on_system, onDone })
  useEffect(() => { if (c.error) onError(t('services.removeFailed', { service: service.name, error: c.error })) }, [c.error]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Confirm title={t('services.removeTitle', { service: service.name })} danger
             body={c.single === 'sonos' ? t('services.removeSonosBody', { service: service.name })
               : c.single === 'sonora' ? t('services.removeSonoraBody', { service: service.name })
               : t('services.removeChoose', { service: service.name })}
             action={c.busy ? t('services.removing', { service: service.name }) : t('services.confirmRemove')} disabled={!c.canConfirm || c.busy}
             onConfirm={c.submit} onClose={onClose}>
      {!c.single && <div className="sf-stack">
        <Toggle checked={c.sonora} disabled={!c.canSonora} onChange={c.setSonora} label={`${t('services.removeSonora')} — ${t('services.removeSonoraSub')}`} />
        <Toggle checked={c.sonos} disabled={!c.canSonos} onChange={c.setSonos} label={`${t('services.removeSonos', { gen })} — ${t('services.removeSonosSub')}`} />
      </div>}
    </Confirm>
  )
}

// Linking a service: the household's catalog, or straight into one
// service's sign-in when opened for it. The provider hands out a code; the
// person signs in on the provider's site; the speakers are polled until the
// account lands.
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
    <Sheet kind="center" title={t('desk.add.title')} onClose={onClose} wide>
      <SheetHeader title={link.chosen ? name : t('desk.add.title')} sub={link.chosen ? '' : t('desk.add.intro')} onClose={onClose}
                   back={link.chosen && !preset && link.status !== 'done' ? link.reset : null} />
      <div className="sf-sheet-body">
        {!link.chosen ? (
          <>
            <div className="sf-settings-toolbar">
              <SystemTabs households={link.households} value={link.activeTab} onChange={link.setTab} />
              <div className="sf-search sf-search-inline"><I.Search className="sf-search-glyph" /><input type="search" value={filter} placeholder={t('sf.filterServices')} onChange={(e) => setFilter(e.target.value)} data-autofocus /></div>
            </div>
            {!link.loaded ? <div className="sf-loading"><Spinner />{t('desk.browse.loading')}</div> : (
              <div className="sf-grid sf-grid-tight">
                {shown.map((service) => {
                  const unpairable = service.pairable === false
                  return (
                    <button key={service.id} type="button" className="sf-tile sf-tile-btn" disabled={unpairable}
                            title={unpairable ? t('desk.add.unpairable', { service: service.name }) : ''}
                            onClick={() => !unpairable && link.start(service, link.zoneForHousehold(link.activeTab)?.uuid)}>
                      <span className="sf-tile-art sf-tile-logo">{service.icon ? <img src={service.icon} alt="" /> : <span className="sf-initials">{service.initials}</span>}</span>
                      <span className="sf-tile-title">{service.name}</span>
                      <span className="sf-tile-sub">{unpairable ? t('desk.add.appOnly') : service.in_use ? t('desk.add.another') : t(`desk.add.auth.${service.auth}`)}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {link.error && <p className="sf-error">{link.error}</p>}
          </>
        ) : (
          <div className="sf-link-flow">
            {link.status === 'starting' && <div className="sf-loading"><Spinner />{link.chosen?.service?.auth === 'Anonymous' ? t('desk.add.linking', { service: name }) : t('desk.add.starting', { service: name })}</div>}
            {link.status === 'needsApp' && <p>{t('desk.add.needsApp', { service: name })}</p>}
            {link.status === 'waiting' && link.link && (
              <>
                <p>{link.link.show_link_code ? t('desk.add.instructions', { url: link.link.reg_url }) : t('desk.add.instructionsNoCode', { url: link.link.reg_url })}</p>
                {link.link.show_link_code && <p className="sf-code">{link.link.link_code}</p>}
                <Button primary icon={<I.Link />} onClick={() => window.open(link.link.reg_url, '_blank', 'noopener')}>{t('desk.add.open')}</Button>
                <div className="sf-loading"><Spinner />{t('desk.add.waiting', { service: name })}</div>
              </>
            )}
            {link.status === 'done' && (
              <p className="sf-done"><I.Check /><LinkedMessage result={serviceLinkedMessage(t, { name, zone: link.chosen?.zone, households, registered: link.registered, auth: link.chosen?.service?.auth })}
                                                   onOpen={(hid) => { link.reset(); link.setTab(hid) }} /></p>
            )}
            {link.status === 'failed' && <p className="sf-error">{t('desk.add.failed', { service: name, error: link.error })}</p>}
          </div>
        )}
      </div>
      <footer className="sf-sheet-foot">
        <Button primary={link.status === 'done'} quiet={link.status !== 'done'} onClick={onClose}>{link.status === 'done' ? t('common.done') : t('common.cancel')}</Button>
      </footer>
    </Sheet>
  )
}

// --- music library ----------------------------------------------------------------

const ALBUM_ARTIST_OPTIONS = ['ITUNES', 'WMP', 'NONE']
function LibraryPage({ households }) {
  const [prefs, setPrefs] = useState(readLibraryPrefs)
  const { t } = useI18n()
  // Sonofuture's Settings has one page per section, so leaving the library
  // page and coming back re-seeds what counts as an old failure.
  const lib = useLibrarySettings(households, { section: 'library' })
  const [adding, setAdding] = useState(false)
  const [path, setPath] = useState('')
  // A share on a server that refuses guests needs an account; most servers do
  // now, so the fields sit here rather than behind anything.
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
    <div className="sf-settings-block">
      <SystemTabs households={lib.ordered} value={lib.activeTab} onChange={lib.setTab} />
      {!data && !lib.error && <div className="sf-loading"><Spinner />{t('desk.browse.loading')}</div>}
      {lib.error && <p className="sf-error">{lib.error}</p>}
      {data && (
        <>
          <h3 className="sf-h3">{t('desk.library.mine')}</h3>
          {data.shares.length === 0 ? <p className="sf-muted">{t('desk.library.none')}</p> : (
            <ul className="sf-svc-list">
              {data.shares.map((s) => (
                <li key={s.id} className="sf-svc">
                  <span className="sf-svc-icon"><I.Folder /></span>
                  <span className="sf-svc-text"><span className="sf-svc-name">{(s.path || s.title || '').split('/').filter(Boolean).pop()}</span><span className="sf-svc-state">{s.path || s.title}</span></span>
                  <IconButton size="sm" label={t('desk.library.remove')} disabled={lib.busy} onClick={() => setConfirm(s)}><I.Trash /></IconButton>
                </li>
              ))}
            </ul>
          )}
          {/* Accepted by the players, still being mounted. It sits in the
              list because that is where the folder will appear. */}
          {lib.pending.map((p) => (
            <div key={p.path} className="sf-svc sf-svc-pending" role="status">
              <span className="sf-svc-icon">{p.state === 'failed' ? <I.Warning /> : <Swirl size={16} />}</span>
              <span className="sf-svc-text">
                <span className="sf-svc-name">
                  {p.state === 'failed' ? t('desk.library.addFailed', { path: p.path })
                    : p.state === 'indexing' ? (p.path || '').split(/[\\/]/).filter(Boolean).pop()
                    : t('desk.library.adding')}
                </span>
                <span className="sf-svc-state">
                  {p.state === 'failed'
                    ? (p.hint || t('desk.library.addFailedWhy'))
                    : p.state === 'indexing'
                    ? t('desk.library.addedIndexing')
                    : `${t('desk.library.addingPath', { path: p.path })}${p.hint ? ` ${p.hint}` : ''}`}
                </span>
              </span>
            </div>
          ))}
          {adding ? (
            <div className="sf-addshare">
              <input className="sf-input" type="text" value={path} placeholder={t('desk.library.pathHint')} data-autofocus autoFocus onChange={(e) => setPath(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter' && path.trim()) addShare() }} />
              <div className="sf-inline">
                <input className="sf-input" type="text" value={user} autoComplete="off" placeholder={t('desk.library.username')} onChange={(e) => setUser(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && path.trim()) addShare() }} />
                <input className="sf-input" type="password" value={pass} autoComplete="off" placeholder={t('desk.library.password')} onChange={(e) => setPass(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && path.trim()) addShare() }} />
              </div>
              <div className="sf-inline">
                <Button primary small disabled={!path.trim() || lib.busy} onClick={addShare}>{t('desk.library.add')}</Button>
                <Button quiet small onClick={() => { setAdding(false); setPath(''); setUser(''); setPass('') }}>{t('common.cancel')}</Button>
              </div>
              <p className="sf-muted">{t('desk.library.credHint')}</p>
            </div>
          ) : (
            <Button quiet icon={<I.Plus />} disabled={lib.busy} onClick={() => setAdding(true)}>{t('desk.library.addFolder')}</Button>
          )}
          {data.index_error && <p className="sf-error">{t('desk.library.indexError', { error: data.index_error })}</p>}
          <p className="sf-muted">{t('desk.library.pathNote')}</p>
          <h3 className="sf-h3">{t('desk.library.indexTitle')}</h3>
          <div className="sf-inline">
            <Toggle checked={lib.scheduled} disabled={lib.busy} label={t('desk.library.schedule')} onChange={(on) => lib.apply({ daily_refresh: on ? `${lib.scheduleTime}:00` : '' })} />
            <input className="sf-input sf-input-time" type="time" value={lib.scheduleTime} disabled={!lib.scheduled || lib.busy} onChange={(e) => e.target.value && lib.apply({ daily_refresh: `${e.target.value}:00` })} />
          </div>
          <div className="sf-inline">
            <Button quiet icon={<I.Refresh />} disabled={data.indexing || lib.busy} onClick={() => lib.apply({ refresh: true })}>{t('desk.library.updateNow')}</Button>
            {data.indexing && <span className="sf-muted"><Spinner /> {t('desk.library.indexing')}</span>}
          </div>
          <h3 className="sf-h3">{t('desk.library.compilations')}</h3>
          <Field label={t('desk.library.groupBy')} hint={t('desk.library.compilationsNote')}>
            <Select disabled={lib.busy} value={ALBUM_ARTIST_OPTIONS.includes(data.album_artist_option) ? data.album_artist_option : 'WMP'} onChange={(e) => lib.apply({ album_artist_option: e.target.value })}>
              {ALBUM_ARTIST_OPTIONS.map((o) => <option key={o} value={o}>{t(`desk.library.group.${o}`)}</option>)}
            </Select>
          </Field>
          <Toggle checked={prefs.contributing} label={t('desk.library.showContributing')} onChange={(on) => setPrefs(writeLibraryPrefs({ contributing: on }))} />
          <Field label={t('desk.library.sortFolders')}>
            <Select value={prefs.folderSort} onChange={(e) => setPrefs(writeLibraryPrefs({ folderSort: e.target.value }))}>
              {FOLDER_SORTS.map((o) => <option key={o} value={o}>{t(`desk.library.sort.${o}`)}</option>)}
            </Select>
          </Field>
          {confirm && (
            <Confirm title={t('desk.library.removeTitle')} body={t('desk.library.removeBody', { folder: confirm.title || confirm.uri })} action={t('desk.library.remove')} danger disabled={lib.busy}
                     onConfirm={() => { lib.apply({ remove_id: confirm.id }); setConfirm(null) }} onClose={() => setConfirm(null)} />
          )}
        </>
      )}
    </div>
  )
}

// --- date and time --------------------------------------------------------------------

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
  // A switch moves the moment it is pressed and the speaker's own answer
  // replaces the guess when it arrives, so neither one waits on a round trip
  // to show what was asked for.
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
    <div className="sf-settings-block">
      <SystemTabs households={ordered} value={activeTab} onChange={setTab} />
      {!data && !error && <div className="sf-loading"><Spinner />{t('desk.time.loading')}</div>}
      {error && <p className="sf-error">{error}</p>}
      {data && (
        <fieldset className="sf-fieldset">
          <div className="sf-clock">
            <strong>{clock.time}</strong>
            <span>{clock.date}</span>
            {internet && data.server && <small>{t('desk.time.server', { server: data.server.split(',')[0] })}</small>}
          </div>
          <Field label={t('desk.time.timeZone')}>
            <Select value={data.index} onChange={(e) => apply({ index: Number(e.target.value) })}>
              {data.zones.map((z) => <option key={z.index} value={z.index}>{zoneLabel(z)}</option>)}
            </Select>
          </Field>
          <Toggle checked={autoDst} disabled={!zoneEntry?.dst} label={t('desk.time.autoDst')} onChange={(on) => apply({ auto_dst: on }, { auto_dst: on })} />
          {!fixed && <Toggle checked={internet} label={t('desk.time.internet')} onChange={(on) => apply({ internet_time: on }, { internet: on })} />}
          {!internet && (
            <Field label={t('desk.time.setNow')}>
              <div className="sf-inline">
                <input className="sf-input" type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
                <input className="sf-input sf-input-time" type="time" value={manual.time} onChange={(e) => setManual({ ...manual, time: e.target.value })} />
                <Button small primary disabled={busy || !manual.date || !manual.time}
                        onClick={() => apply({ desired_time: `${manual.date} ${manual.time.length === 5 ? `${manual.time}:00` : manual.time}` })}>{t('desk.time.setNow')}</Button>
              </div>
            </Field>
          )}
          <div className="sf-two">
            <Field label={t('desk.time.dateFormat')}>
              <Select value={DATE_FORMATS.includes(data.date_format) ? data.date_format : ''} onChange={(e) => apply({ date_format: e.target.value })}>
                {!DATE_FORMATS.includes(data.date_format) && <option value="">{t('desk.time.notSet')}</option>}
                {DATE_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('desk.time.timeFormat')}>
              <Select value={TIME_FORMATS.includes(data.time_format) ? data.time_format : ''} onChange={(e) => apply({ time_format: e.target.value })}>
                {!TIME_FORMATS.includes(data.time_format) && <option value="">{t('desk.time.notSet')}</option>}
                {TIME_FORMATS.map((f) => <option key={f} value={f}>{t(`desk.time.fmt.${f}`)}</option>)}
              </Select>
            </Field>
          </div>
        </fieldset>
      )}
    </div>
  )
}

// --- systems and rooms -----------------------------------------------------------------

function SystemsPage({ households, zones }) {
  const { t } = useI18n()
  const { actions, scanning, lastScan, connected } = useSystem()
  const [health, setHealth] = useState(null)
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)) }, [])

  return (
    <div className="sf-settings-block">
      <div className="sf-status-row">
        <span className="sf-dot" data-on={connected || undefined} />
        <span>{connected ? t('net.live') : t('common.reconnecting')}</span>
        {health && <span className="sf-muted">· {t.plural('common.rooms', health.zones)}</span>}
        <span className="sf-grow" />
        <Button quiet icon={<I.Refresh />} disabled={scanning} onClick={() => actions.refresh()}>{scanning ? t('net.scanning') : t('net.rescan')}</Button>
      </div>
      {lastScan && <p className="sf-muted">{t('net.scanDone', { rooms: t.plural('common.rooms', lastScan.rooms), systems: t.plural('common.systems', lastScan.systems) })}</p>}
      {orderedHouseholds(households).map((h) => {
        // Every speaker, not every room: a stereo pair is one room and two
        // speakers, and the room list names only the half the controller
        // talks to.
        const speakers = playersOf(h, Object.values(zones))
        const rooms = h.zone_uuids.length
        return (
        <section key={h.id} className="sf-system">
          <h3 className="sf-h3">{h.generation} <small>
            {t.plural('common.rooms', rooms)}
            {speakers.length !== rooms && ` · ${t.plural('common.speakers', speakers.length)}`}
          </small></h3>
          <div className="sf-table-wrap">
            {/* Named widths rather than the browser's own: one system's room
                names are longer than the other's, so the two tables drew
                their columns in different places. */}
            <table className="sf-table sf-table-fixed">
              <colgroup><col style={{ width: '30%' }} /><col style={{ width: '30%' }} /><col style={{ width: '18%' }} /><col style={{ width: '22%' }} /></colgroup>
              <thead><tr><th>{t('desk.about.speakers')}</th><th>{t('desk.about.model')}</th><th>{t('desk.about.version')}</th><th>{t('desk.about.address')}</th></tr></thead>
              <tbody>
                {speakers.map((p) => (
                  <tr key={p.uuid} data-offline={p.online === false || undefined}>
                    <th>{playerLabel(p)}{p.online === false && <small> · {t('desk.rooms.offline')}</small>}</th>
                    <td>{p.model}</td><td>{versionLabel(p.display_version, p.software_version)}</td><td className="sf-mono">{p.host}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {h.vanished?.length > 0 && <p className="sf-muted">{t('sedona.alsoRemembered', { names: h.vanished.map((v) => v.name).join(', ') })}</p>}
        </section>
      )})}
    </div>
  )
}

// --- Sonos account ---------------------------------------------------------------------

function AccountPage() {
  const { t } = useI18n()
  // The account itself is the same three things on every settings page, so
  // the reading and the two writes live in one hook (lib/useCloudAccount.js).
  const account = useCloudAccount()
  const [creds, setCreds] = useState({ email: '', password: '' })
  const { busy, error } = account
  const signIn = async (event) => {
    event.preventDefault()
    if (await account.signIn(creds.email, creds.password)) setCreds({ email: '', password: '' })
    else setCreds((prev) => ({ ...prev, password: '' }))
  }
  // Nothing shows until the account is known: the sign-in form flashing up
  // for someone already signed in read as a glitch.
  return (
    <div className="sf-settings-body">
      {account.known && <><p className="sf-muted">{t('account.blurb')}</p><p className="sf-muted">{t('account.optional')}</p></>}
      {!account.known ? null : account.signedIn ? (
        <div className="sf-inline">
          <span>{t('account.signedInAs', { email: account.email })}</span>
          <Button quiet small disabled={busy} onClick={account.signOut}>{t('account.signOut')}</Button>
        </div>
      ) : (
        <form className="sf-inline sf-signin" onSubmit={signIn}>
          <input className="sf-input" type="email" placeholder={t('account.email')} value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} autoComplete="username" />
          <input className="sf-input" type="password" placeholder={t('account.password')} value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} autoComplete="current-password" />
          <Button primary small type="submit" disabled={busy || !creds.email || !creds.password}>{busy ? t('account.signingIn') : t('account.signIn')}</Button>
        </form>
      )}
      {error && <p className="sf-error">{error}</p>}
    </div>
  )
}

// --- network ------------------------------------------------------------------------------

function NetworkPage() {
  const { t } = useI18n()
  const { data, loading, error } = useDiagnostics()
  return (
    <div className="sf-settings-block">
      {error && <p className="sf-error">{error}</p>}
      {loading && !data && <div className="sf-loading"><Spinner />{t('net.probing')}</div>}
      {data?.households.map((h) => (
        <section key={h.household} className="sf-system">
          <h3 className="sf-h3">{h.generation} <small>{t.plural('common.speakers', h.rooms.length)}</small></h3>
          <HealthDonut household={h} />
          {h.findings?.length > 0 ? (
            <ul className="sf-findings">
              {h.findings.map((f, i) => (
                <li key={i} data-severity={f.severity}>
                  <strong>{f.title}</strong>
                  <p>{f.detail}</p>
                  {f.remedy && <p className="sf-muted">{f.remedy}</p>}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <NetworkMap data={data} loading={loading} />
    </div>
  )
}

// --- appearance ------------------------------------------------------------------------------

function AppearancePage() {
  return (
    <div className="sf-settings-block">
      {/* Language, the theme, its appearance where it has two, the still with
          what it is beside it, then Manage Themes: the shared chooser, in
          this sheet's own fields and buttons. */}
      <ThemeChooser Field={Field} Select={Select} classes={{
        select: 'sf-select', button: 'sf-btn', primary: 'sf-btn sf-btn-primary',
        preview: 'sf-theme-preview', version: 'sf-theme-version', blurb: 'sf-muted',
        noshot: 'sf-theme-noshot', actions: 'sf-theme-actions', error: 'sf-error',
        manage: 'sf-theme-manage',
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
    <div className="sf-settings-block">
      <div className="sf-settings-toolbar"><span className="sf-grow" /><Button quiet icon={<I.Refresh />} onClick={load}>{t('sf.reload')}</Button></div>
      {entries === null ? <div className="sf-loading"><Spinner />{t('desk.browse.loading')}</div>
        : entries.length === 0 ? <Empty icon={<I.Check />} title={t('desk.errorLog.empty')} /> : (
          <div className="sf-table-wrap">
            <table className="sf-table sf-log">
              <tbody>
                {[...entries].reverse().map((e, i) => (
                  <tr key={i} data-level={e.level}>
                    <td className="sf-mono">{new Date(e.time * 1000).toLocaleTimeString()}</td>
                    <td><span className="sf-level" data-level={e.level}>{e.level}</span></td>
                    <td className="sf-muted">{e.source}</td>
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
    [t('sf.commandPalette'), 'Ctrl K'], [t('win.shortcuts.jumpSearch'), 'Ctrl F'], [t('common.queue'), 'Ctrl G'], [t('win.shortcuts.toggleMini'), 'Ctrl D'],
    [t('sf.nav.home'), 'Ctrl 1'], [t('sf.nav.library'), 'Ctrl 2'], [t('sf.nav.rooms'), 'Ctrl 3'], [t('sf.nav.alarms'), 'Ctrl 4'], [t('common.settings'), 'Ctrl 5'],
    [t('win.shortcuts.favorites'), 'Ctrl *'], [t('desk.shortcuts.title'), '?'], [t('win.shortcuts.closeWindow'), 'Esc'],
  ]
  return (
    <Sheet kind="center" title={t('desk.shortcuts.title')} onClose={onClose}>
      <SheetHeader title={t('desk.shortcuts.title')} onClose={onClose} />
      <div className="sf-sheet-body">
        <dl className="sf-shortcuts">
          {rows.map(([label, key]) => (
            <React.Fragment key={key}><dt>{label}</dt><dd><Kbd>{key}</Kbd></dd></React.Fragment>
          ))}
        </dl>
      </div>
      <footer className="sf-sheet-foot"><Button primary onClick={onClose}>{t('common.done')}</Button></footer>
    </Sheet>
  )
}
