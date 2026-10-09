import React, { useCallback, useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n, LANGUAGES } from '../../frontend/src/i18n/index.jsx'
import { useTheme } from '../../frontend/src/lib/theme.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { zoneLabel } from '../../frontend/src/lib/timezones.js'
import { useServiceLink } from '../../frontend/src/lib/useServiceLink.js'
import { useCloudAccount } from '../../frontend/src/lib/useCloudAccount.js'
import { playersOf, playerLabel } from '../../frontend/src/lib/players.js'
import { useRemoveChoice } from '../../frontend/src/lib/useRemoveChoice.js'
import { useLibrarySettings } from '../../frontend/src/lib/useLibrarySettings.js'
import { useDiagnostics } from '../../frontend/src/lib/useDiagnostics.js'
import { serviceLinkedMessage, LinkedMessage } from '../../frontend/src/lib/serviceLinkedMessage.js'
import { CautionBadge, serviceCaution } from '../../frontend/src/components/CautionBadge.jsx'
import * as G from './glyphs.jsx'
import { Panel, PanelHead, Button, IconKey, Lever, Field, Confirm, Empty, Loading, Kbd, Menu, MenuItem, MenuSep, Select, KeyBank, Unit, Led, Display } from './controls.jsx'
import { readLibraryPrefs, writeLibraryPrefs, FOLDER_SORTS } from '../../frontend/src/lib/libraryPrefs.js'
import ThemeChooser from '../../frontend/src/components/ThemeChooser.jsx'
import S2Upgrade from '../../frontend/src/components/S2Upgrade.jsx'
import NetworkMap, { HealthDonut, MeshGuidance } from '../../frontend/src/components/NetworkMap.jsx'
import Swirl from '../../frontend/src/components/Swirl.jsx'
import ParentalControls from '../../frontend/src/components/ParentalControls.jsx'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'
import { versionLabel, updateBody } from '../../frontend/src/lib/version.js'
import { useSpeakerUpdates } from './house.js'

// The rear panel: the settings, reached by turning the function selector to
// SETUP, as the connections and service switches of a component are round
// its back. A column of engraved keys names the pages -- the account, the
// music services, the music library's folders, the clock, the systems, the
// content filter, the upgrade advisor, the network, the look and the log --
// and the page beside them reads and writes through the same calls every
// theme uses.

export const PAGES = ['account', 'services', 'library', 'time', 'systems', 'parental', 's2', 'network', 'appearance', 'log']
const PAGE_ICONS = { account: G.Person, services: G.Link, library: G.Library, time: G.Clock, systems: G.Speaker, parental: G.Prohibit, s2: G.Update, network: G.Signal, appearance: G.Sun, log: G.Warning }

// A system's tabs, drawn only when there is an S1 system and an S2 one: a
// house on one generation has nothing to choose between.
export function SystemTabs({ households, value, onChange }) {
  const { t } = useI18n()
  if (!systemChoiceMatters(households)) return null
  return <KeyBank value={value} onChange={onChange} label={t('desk.showSystem')} options={households.map((h) => ({ id: h.id, label: h.generation }))} />
}

export default function SetupUnit({ households, zones, page, setPage, onLinkService, servicesVersion, onServicesChanged, onMessage, onAbout, onShortcuts }) {
  const { t } = useI18n()
  const current = PAGES.includes(page) ? page : 'services'
  return (
    <Unit className="hf-setup-unit" name={t('hifi.unit.setup')} model={t('common.settings')}>
      <div className="hf-setup">
        <nav className="hf-setup-nav" aria-label={t('common.settings')}>
          {/* A column of keys on a wide rack; on a narrow one the stylesheet
              hides it and shows the selector instead. */}
          <label className="hf-setup-jump">
            <span className="hf-sr-only">{t('common.settings')}</span>
            <Select value={current} onChange={(event) => setPage(event.target.value)}>
              {PAGES.map((id) => <option key={id} value={id}>{t(`hifi.setup.${id}`)}</option>)}
            </Select>
          </label>
          <div className="hf-setup-keys">
            {PAGES.map((id) => {
              const Glyph = PAGE_ICONS[id]
              return (
                <button key={id} type="button" className="hf-setup-key" aria-current={current === id || undefined} onClick={() => setPage(id)}>
                  <Led on={current === id} /><Glyph /><span>{t(`hifi.setup.${id}`)}</span>
                </button>
              )
            })}
          </div>
          <div className="hf-setup-foot">
            <button type="button" className="hf-setup-key hf-setup-shortcuts" onClick={onShortcuts}><G.Keyboard /><span>{t('desk.shortcuts.title')}</span></button>
            <button type="button" className="hf-setup-key" onClick={onAbout}><G.Info /><span>{t('about.menu')}</span></button>
          </div>
        </nav>
        <section key={current} className="hf-setup-page" data-page={current} aria-label={t(`hifi.setup.${current}`)}>
          <h3 className="hf-setup-title">{t(`hifi.setup.${current}`)}</h3>
          {/* The upgrade advisor opens with a line of its own, in every theme,
              so this frame does not print a second one above it. */}
          {current !== 's2' && current !== 'account' && <p className="hf-muted hf-setup-blurb">{t(`hifi.setup.${current}.blurb`)}</p>}
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
      </div>
    </Unit>
  )
}

// --- parental controls ---------------------------------------------------------

// The content filter is a switch on the panel, one per system, since the
// setting is the system's own.
const HF_PARENTAL = {
  section: 'hf-settings-block', blurb: 'hf-muted', note: 'hf-muted',
  error: 'hf-error', button: 'hf-btn', row: 'hf-parental-row',
  actions: 'hf-parental-actions',
}

// Defined once, outside the page: written inside it, it was a new component on every render, and
// each switch was rebuilt whenever a playing track ticked.
const PanelSwitch = ({ label, checked, disabled, hint, onChange }) => (
  <Lever label={label} checked={checked} disabled={disabled} hint={hint} onChange={onChange} />
)
function ParentalPage() {
  return <ParentalControls shape="switch" showTitle={false} classes={HF_PARENTAL} Toggle={PanelSwitch} />
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
    <div className="hf-settings-block">
      <div className="hf-settings-toolbar">
        <SystemTabs households={ordered} value={activeTab} onChange={setTab} />
        <Button primary icon={<G.Plus />} onClick={() => setAdding(true)}>{t('desk.add.button')}</Button>
      </div>
      {byHh === null ? <Loading>{t('desk.browse.loading')}</Loading>
        : services.length === 0 ? <Empty icon={<G.Link />} title={t('hifi.services.none')} /> : (
          <ul className="hf-svc-list">
            {services.map((s) => {
              const caution = serviceCaution(s)
              return (
                <li key={`${s.id}-${s.account_id ?? ''}`} className="hf-svc">
                  <span className="hf-svc-icon">{s.icon ? <img src={s.icon} alt="" /> : <span className="hf-initials">{s.initials}</span>}{caution && <CautionBadge kind={caution} title={t(`services.caution.${caution}`, { gen: household?.generation })} />}</span>
                  <span className="hf-svc-text">
                    <span className="hf-svc-name">{s.name}{s.nickname && s.nickname !== s.name ? <small> · {s.nickname}</small> : null}</span>
                    <span className="hf-svc-state">
                      {s.auth === 'Anonymous' ? t('win.services.anonymous')
                        : caution === 'sonos' ? t('hifi.services.notLinked')
                        : caution === 'sonora' ? t('services.caution.sonora', { gen: household?.generation })
                        : t('hifi.services.linked')}
                    </span>
                  </span>
                  <IconKey label={t('desk.browse.actions')} onClick={(event) => setMenu({ s, anchor: event.currentTarget })}><G.Ellipsis /></IconKey>
                </li>
              )
            })}
          </ul>
        )}
      {error && <p className="hf-error">{error}</p>}
      {menu && (
        <Menu anchor={menu.anchor} align="right" onClose={() => setMenu(null)} title={menu.s.name}>
          {serviceCaution(menu.s) === 'sonos' && (
            <MenuItem icon={<G.Link />} onSelect={() => { setMenu(null); onLinkService?.({ sid: menu.s.id, householdId: activeTab, name: menu.s.name, account: menu.s.account_id ?? '', auth: menu.s.auth }) }}>
              {t('desk.browse.needsLink.action', { service: menu.s.name })}
            </MenuItem>
          )}
          {menu.s.auth !== 'Anonymous' && menu.s.sonora_linked && (
            <MenuItem icon={<G.Refresh />} onSelect={() => { setMenu(null); onLinkService?.({ sid: menu.s.id, householdId: activeTab, name: menu.s.name, account: menu.s.account_id ?? '', auth: menu.s.auth, reauthorize: true }) }}>
              {t('win.services.reauthorize')}
            </MenuItem>
          )}
          {menu.s.auth !== 'Anonymous' && (
            <MenuItem icon={<G.Pencil />} onSelect={() => { setMenu(null); setRenaming(menu.s) }}>
              {t('services.rename')}
            </MenuItem>
          )}
          <MenuSep />
          <MenuItem icon={<G.Trash />} danger onSelect={() => { setMenu(null); setRemoving(menu.s) }}>{t('services.remove')}</MenuItem>
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
                            onDone={() => { setRemoving(null); setTick((v) => v + 1); onChanged?.(); onMessage?.(t('hifi.serviceRemoved', { service: removing.name })) }}
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
      {!c.single && <div className="hf-stack">
        <Lever checked={c.sonora} disabled={!c.canSonora} onChange={c.setSonora} label={`${t('services.removeSonora')} — ${t('services.removeSonoraSub')}`} />
        <Lever checked={c.sonos} disabled={!c.canSonos} onChange={c.setSonos} label={`${t('services.removeSonos', { gen })} — ${t('services.removeSonosSub')}`} />
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
    <Panel kind="center" title={t('desk.add.title')} onClose={onClose} wide>
      <PanelHead title={link.chosen ? name : t('desk.add.title')} sub={link.chosen ? '' : t('desk.add.intro')} onClose={onClose}
                   back={link.chosen && !preset && link.status !== 'done' ? link.reset : null} />
      <div className="hf-panel-body">
        {!link.chosen ? (
          <>
            <div className="hf-settings-toolbar">
              <SystemTabs households={link.households} value={link.activeTab} onChange={link.setTab} />
              <div className="hf-search hf-search-inline"><G.Search className="hf-search-glyph" /><input type="search" value={filter} placeholder={t('hifi.filterServices')} onChange={(e) => setFilter(e.target.value)} data-autofocus /></div>
            </div>
            {!link.loaded ? <Loading>{t('desk.browse.loading')}</Loading> : (
              <div className="hf-grid hf-grid-tight">
                {shown.map((service) => {
                  const unpairable = service.pairable === false
                  return (
                    <button key={service.id} type="button" className="hf-tile hf-tile-btn" disabled={unpairable}
                            title={unpairable ? t('desk.add.unpairable', { service: service.name }) : ''}
                            onClick={() => !unpairable && link.start(service, link.zoneForHousehold(link.activeTab)?.uuid)}>
                      <span className="hf-tile-art hf-tile-logo">{service.icon ? <img src={service.icon} alt="" /> : <span className="hf-initials">{service.initials}</span>}</span>
                      <span className="hf-tile-title">{service.name}</span>
                      <span className="hf-tile-sub">{unpairable ? t('desk.add.appOnly') : service.in_use ? t('desk.add.another') : t(`desk.add.auth.${service.auth}`)}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {link.error && <p className="hf-error">{link.error}</p>}
          </>
        ) : (
          <div className="hf-link-flow">
            {link.status === 'starting' && <Loading>{link.chosen?.service?.auth === 'Anonymous' ? t('desk.add.linking', { service: name }) : t('desk.add.starting', { service: name })}</Loading>}
            {link.status === 'needsApp' && <p>{t('desk.add.needsApp', { service: name })}</p>}
            {link.status === 'waiting' && link.link && (
              <>
                <p>{link.link.show_link_code ? t('desk.add.instructions', { url: link.link.reg_url }) : t('desk.add.instructionsNoCode', { url: link.link.reg_url })}</p>
                {link.link.show_link_code && <p className="hf-code">{link.link.link_code}</p>}
                <Button primary icon={<G.Link />} onClick={() => window.open(link.link.reg_url, '_blank', 'noopener')}>{t('desk.add.open')}</Button>
                <Loading>{t('desk.add.waiting', { service: name })}</Loading>
              </>
            )}
            {link.status === 'done' && (
              <p className="hf-done"><G.Check /><LinkedMessage result={serviceLinkedMessage(t, { name, zone: link.chosen?.zone, households, registered: link.registered, auth: link.chosen?.service?.auth })}
                                                   onOpen={(hid) => { link.reset(); link.setTab(hid) }} /></p>
            )}
            {link.status === 'failed' && <p className="hf-error">{t('desk.add.failed', { service: name, error: link.error })}</p>}
          </div>
        )}
      </div>
      <footer className="hf-panel-foot">
        <Button primary={link.status === 'done'} quiet={link.status !== 'done'} onClick={onClose}>{link.status === 'done' ? t('common.done') : t('common.cancel')}</Button>
      </footer>
    </Panel>
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
    <div className="hf-settings-block">
      <SystemTabs households={lib.ordered} value={lib.activeTab} onChange={lib.setTab} />
      {!data && !lib.error && <Loading>{t('desk.browse.loading')}</Loading>}
      {lib.error && <p className="hf-error">{lib.error}</p>}
      {data && (
        <>
          <h3 className="hf-h3">{t('desk.library.mine')}</h3>
          {data.shares.length === 0 ? <p className="hf-muted">{t('desk.library.none')}</p> : (
            <ul className="hf-svc-list">
              {data.shares.map((s) => (
                <li key={s.id} className="hf-svc">
                  <span className="hf-svc-icon"><G.Folder /></span>
                  <span className="hf-svc-text"><span className="hf-svc-name">{(s.path || s.title || '').split('/').filter(Boolean).pop()}</span><span className="hf-svc-state">{s.path || s.title}</span></span>
                  <IconKey label={t('desk.library.remove')} disabled={lib.busy} onClick={() => setConfirm(s)}><G.Trash /></IconKey>
                </li>
              ))}
            </ul>
          )}
          {/* Accepted by the players, still being mounted. It sits in the
              list because that is where the folder will appear. */}
          {lib.pending.map((p) => (
            <div key={p.path} className="hf-svc hf-svc-pending" role="status">
              <span className="hf-svc-icon">{p.state === 'failed' ? <G.Warning /> : <Swirl size={16} />}</span>
              <span className="hf-svc-text">
                <span className="hf-svc-name">
                  {p.state === 'failed' ? t('desk.library.addFailed', { path: p.path })
                    : p.state === 'indexing' ? (p.path || '').split(/[\\/]/).filter(Boolean).pop()
                    : t('desk.library.adding')}
                </span>
                <span className="hf-svc-state">
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
            <div className="hf-addshare">
              <input className="hf-input" type="text" value={path} placeholder={t('desk.library.pathHint')} data-autofocus autoFocus onChange={(e) => setPath(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter' && path.trim()) addShare() }} />
              <div className="hf-inline">
                <input className="hf-input" type="text" value={user} autoComplete="off" placeholder={t('desk.library.username')} onChange={(e) => setUser(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && path.trim()) addShare() }} />
                <input className="hf-input" type="password" value={pass} autoComplete="off" placeholder={t('desk.library.password')} onChange={(e) => setPass(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && path.trim()) addShare() }} />
              </div>
              <div className="hf-inline">
                <Button primary small disabled={!path.trim() || lib.busy} onClick={addShare}>{t('desk.library.add')}</Button>
                <Button quiet small onClick={() => { setAdding(false); setPath(''); setUser(''); setPass('') }}>{t('common.cancel')}</Button>
              </div>
              <p className="hf-muted">{t('desk.library.credHint')}</p>
            </div>
          ) : (
            <Button quiet icon={<G.Plus />} disabled={lib.busy} onClick={() => setAdding(true)}>{t('desk.library.addFolder')}</Button>
          )}
          {data.index_error && <p className="hf-error">{t('desk.library.indexError', { error: data.index_error })}</p>}
          <p className="hf-muted">{t('desk.library.pathNote')}</p>
          <h3 className="hf-h3">{t('desk.library.indexTitle')}</h3>
          <div className="hf-inline">
            <Lever checked={lib.scheduled} disabled={lib.busy} label={t('desk.library.schedule')} onChange={(on) => lib.apply({ daily_refresh: on ? `${lib.scheduleTime}:00` : '' })} />
            <input className="hf-input hf-input-time" type="time" value={lib.scheduleTime} disabled={!lib.scheduled || lib.busy} onChange={(e) => e.target.value && lib.apply({ daily_refresh: `${e.target.value}:00` })} />
          </div>
          <div className="hf-inline">
            <Button quiet icon={<G.Refresh />} disabled={data.indexing || lib.busy} onClick={() => lib.apply({ refresh: true })}>{t('desk.library.updateNow')}</Button>
            {data.indexing && <span className="hf-muted hf-inline"><Loading>{t('desk.library.indexing')}</Loading></span>}
          </div>
          <h3 className="hf-h3">{t('desk.library.compilations')}</h3>
          <Field label={t('desk.library.groupBy')} hint={t('desk.library.compilationsNote')}>
            <Select disabled={lib.busy} value={ALBUM_ARTIST_OPTIONS.includes(data.album_artist_option) ? data.album_artist_option : 'WMP'} onChange={(e) => lib.apply({ album_artist_option: e.target.value })}>
              {ALBUM_ARTIST_OPTIONS.map((o) => <option key={o} value={o}>{t(`desk.library.group.${o}`)}</option>)}
            </Select>
          </Field>
          <Lever checked={prefs.contributing} label={t('desk.library.showContributing')} onChange={(on) => setPrefs(writeLibraryPrefs({ contributing: on }))} />
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
    <div className="hf-settings-block">
      <SystemTabs households={ordered} value={activeTab} onChange={setTab} />
      {!data && !error && <Loading>{t('desk.time.loading')}</Loading>}
      {error && <p className="hf-error">{error}</p>}
      {data && (
        <fieldset className="hf-fieldset">
          <div className="hf-clock">
            <strong>{clock.time}</strong>
            <span>{clock.date}</span>
            {internet && data.server && <small>{t('desk.time.server', { server: data.server.split(',')[0] })}</small>}
          </div>
          <Field label={t('desk.time.timeZone')}>
            <Select value={data.index} onChange={(e) => apply({ index: Number(e.target.value) })}>
              {data.zones.map((z) => <option key={z.index} value={z.index}>{zoneLabel(z)}</option>)}
            </Select>
          </Field>
          <Lever checked={autoDst} disabled={!zoneEntry?.dst} label={t('desk.time.autoDst')} onChange={(on) => apply({ auto_dst: on }, { auto_dst: on })} />
          {!fixed && <Lever checked={internet} label={t('desk.time.internet')} onChange={(on) => apply({ internet_time: on }, { internet: on })} />}
          {!internet && (
            <Field label={t('desk.time.setNow')}>
              <div className="hf-inline">
                <input className="hf-input" type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
                <input className="hf-input hf-input-time" type="time" value={manual.time} onChange={(e) => setManual({ ...manual, time: e.target.value })} />
                <Button small primary disabled={busy || !manual.date || !manual.time}
                        onClick={() => apply({ desired_time: `${manual.date} ${manual.time.length === 5 ? `${manual.time}:00` : manual.time}` })}>{t('desk.time.setNow')}</Button>
              </div>
            </Field>
          )}
          <div className="hf-two">
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

// The speakers' own update, on the system it is for: the source list offers
// it too, but there it sits below every source of the system above. Confirmed
// first, as music stops in each room while it installs.
function SystemUpdate({ household, households, update, onStarted }) {
  const { t } = useI18n()
  const [ask, setAsk] = useState(false)
  const [started, setStarted] = useState(false)
  if (!update?.pending && !started) return null
  return (
    <div className="hf-status-row">
      <G.Update />
      {started ? <span>{t('desk.update.started')}</span> : (
        <span><strong>{t('desk.update.title')}</strong> <span className="hf-muted">{versionLabel(update.display, update.version)}</span></span>
      )}
      <span className="hf-grow" />
      {!started && <Button primary small onClick={() => setAsk(true)}>{t('desk.update.start')}</Button>}
      {ask && (
        <Confirm title={t('desk.update.title')} body={updateBody(t, households, household.id, versionLabel(update.display, update.version))}
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
    <div className="hf-settings-block">
      <div className="hf-status-row">
        <span className="hf-dot" data-on={connected || undefined} />
        <span>{connected ? t('net.live') : t('common.reconnecting')}</span>
        {health && <span className="hf-muted">· {t.plural('common.rooms', health.zones)}</span>}
        <span className="hf-grow" />
        <Button quiet icon={<G.Refresh />} disabled={scanning} onClick={() => actions.refresh()}>{scanning ? t('net.scanning') : t('net.rescan')}</Button>
      </div>
      {lastScan && <p className="hf-muted">{t('net.scanDone', { rooms: t.plural('common.rooms', lastScan.rooms), systems: t.plural('common.systems', lastScan.systems) })}</p>}
      {orderedHouseholds(households).map((h) => {
        // Every speaker, not every room: a stereo pair is one room and two
        // speakers, and the room list names only the half the controller
        // talks to.
        const speakers = playersOf(h, Object.values(zones))
        const rooms = h.zone_uuids.length
        return (
        <section key={h.id} className="hf-system">
          <h3 className="hf-h3">{h.generation} <small>
            {t.plural('common.rooms', rooms)}
            {speakers.length !== rooms && ` · ${t.plural('common.speakers', speakers.length)}`}
          </small></h3>
          <SystemUpdate household={h} households={households} update={speakerUpdates.updates[h.id]} onStarted={() => speakerUpdates.clear(h.id)} />
          <div className="hf-table-wrap">
            {/* Named widths rather than the browser's own: one system's room
                names are longer than the other's, so the two tables drew
                their columns in different places. */}
            <table className="hf-table hf-table-fixed">
              <colgroup><col style={{ width: '27%' }} /><col style={{ width: '27%' }} /><col style={{ width: '27%' }} /><col style={{ width: '19%' }} /></colgroup>
              <thead><tr><th>{t('desk.about.speakers')}</th><th>{t('desk.about.model')}</th><th>{t('desk.about.version')}</th><th>{t('desk.about.address')}</th></tr></thead>
              <tbody>
                {speakers.map((p) => (
                  <tr key={p.uuid} data-offline={p.online === false || undefined}>
                    <th>{playerLabel(p)}{p.online === false && <small> · {t('desk.rooms.offline')}</small>}</th>
                    <td>{p.model}</td><td>{versionLabel(p.display_version, p.software_version)}</td><td className="hf-mono">{p.host}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {h.vanished?.length > 0 && <p className="hf-muted">{t('hifi.alsoRemembered', { names: h.vanished.map((v) => v.name).join(', ') })}</p>}
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
    <div className="hf-settings-body">
      {account.known && <><p className="hf-muted">{t('account.blurb')}</p><p className="hf-muted">{t('account.optional')}</p></>}
      {!account.known ? null : account.signedIn ? (
        <div className="hf-inline">
          <span>{t('account.signedInAs', { email: account.email })}</span>
          <Button quiet small disabled={busy} onClick={account.signOut}>{t('account.signOut')}</Button>
        </div>
      ) : (
        <form className="hf-inline hf-signin" onSubmit={signIn}>
          <input className="hf-input" type="email" placeholder={t('account.email')} value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} autoComplete="username" />
          <input className="hf-input" type="password" placeholder={t('account.password')} value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} autoComplete="current-password" />
          <Button primary small type="submit" disabled={busy || !creds.email || !creds.password}>{busy ? t('account.signingIn') : t('account.signIn')}</Button>
        </form>
      )}
      {error && <p className="hf-error">{error}</p>}
    </div>
  )
}

// --- network ------------------------------------------------------------------------------

function NetworkPage() {
  const { t } = useI18n()
  const { data, loading, error } = useDiagnostics()
  return (
    <div className="hf-settings-block">
      <MeshGuidance />
      {error && <p className="hf-error">{error}</p>}
      {loading && !data && <Loading>{t('net.probing')}</Loading>}
      {data?.households.map((h) => (
        <section key={h.household} className="hf-system">
          <h3 className="hf-h3">{h.generation} <small>{t.plural('common.speakers', h.rooms.length)}</small></h3>
          <HealthDonut household={h} />
          {h.findings?.length > 0 ? (
            <ul className="hf-findings">
              {h.findings.map((f, i) => (
                <li key={i} data-severity={f.severity}>
                  <strong>{f.title}</strong>
                  <p>{f.detail}</p>
                  {f.remedy && <p className="hf-muted">{f.remedy}</p>}
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
    <div className="hf-settings-block">
      {/* Language, the theme, its appearance where it has two, the still with
          what it is beside it, then Manage Themes: the shared chooser, in
          this sheet's own fields and buttons. */}
      <ThemeChooser Field={Field} Select={Select} classes={{
        select: 'hf-select', button: 'hf-btn', primary: 'hf-btn hf-btn-primary',
        preview: 'hf-theme-preview', version: 'hf-theme-version', blurb: 'hf-muted',
        noshot: 'hf-theme-noshot', actions: 'hf-theme-actions', error: 'hf-error',
        manage: 'hf-theme-manage',
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
    <div className="hf-settings-block">
      <div className="hf-settings-toolbar"><span className="hf-grow" /><Button quiet icon={<G.Refresh />} onClick={load}>{t('hifi.reload')}</Button></div>
      {entries === null ? <Loading>{t('desk.browse.loading')}</Loading>
        : entries.length === 0 ? <Empty icon={<G.Check />} title={t('desk.errorLog.empty')} /> : (
          <div className="hf-table-wrap">
            <table className="hf-table hf-log">
              <tbody>
                {[...entries].reverse().map((e, i) => (
                  <tr key={i} data-level={e.level}>
                    <td className="hf-mono">{new Date(e.time * 1000).toLocaleTimeString()}</td>
                    <td><span className="hf-level" data-level={e.level}>{e.level}</span></td>
                    <td className="hf-muted">{e.source}</td>
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
    [t('win.shortcuts.jumpSearch'), 'Ctrl F'], [t('common.queue'), 'Ctrl G'],
    [t('hifi.fn.zones'), 'Ctrl 1'], [t('hifi.fn.tuner'), 'Ctrl 2'], [t('hifi.fn.tape'), 'Ctrl 3'], [t('hifi.fn.timer'), 'Ctrl 4'], [t('hifi.fn.setup'), 'Ctrl 5'],
    [t('win.shortcuts.favorites'), 'Ctrl *'], [t('desk.shortcuts.title'), '?'], [t('win.shortcuts.closeWindow'), 'Esc'],
  ]
  return (
    <Panel kind="center" title={t('desk.shortcuts.title')} onClose={onClose}>
      <PanelHead title={t('desk.shortcuts.title')} onClose={onClose} />
      <div className="hf-panel-body">
        <dl className="hf-shortcuts">
          {rows.map(([label, key]) => (
            <React.Fragment key={key}><dt>{label}</dt><dd><Kbd>{key}</Kbd></dd></React.Fragment>
          ))}
        </dl>
      </div>
      <footer className="hf-panel-foot"><Button primary onClick={onClose}>{t('common.done')}</Button></footer>
    </Panel>
  )
}
