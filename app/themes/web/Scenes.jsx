import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useScenes, applyScene, trySceneBody, reportText, sceneKey, sceneName, sceneSummary, endSceneTest } from '../../frontend/src/lib/scenes.js'
import SceneEditorPanel from '../../frontend/src/components/SceneEditorPanel.jsx'
import SceneTimeLeft from '../../frontend/src/components/SceneTimeLeft.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import SceneArt, { sceneGround } from './SceneArt.jsx'
import { Bin, Pencil } from './icons.jsx'
import Overlay from './Overlay.jsx'
import Slider from './Slider.jsx'
import useEdgeFade from './useEdgeFade.js'

// Scenes in the web theme: a row of tiles on the home, above Sonos
// Favorites, and a Manage page with every scene as a row. The product has
// no scenes, so everything here is drawn from its own parts: the home's
// tiles and section head, Content Services' card of rows, the player's
// menu, and the dialog panel. A tile starts its scene, or ends it while it
// is on; its "…" (or a right-click) opens Start, End, Edit and Delete.

// What a scene's message says, shown as a toast of its own that leaves after
// a few seconds; the speakers' refusals keep the store's notices, which wait
// to be dismissed.
const MESSAGE = 'sonora:web-scene-message'
const say = (text) => { if (text) window.dispatchEvent(new CustomEvent(MESSAGE, { detail: text })) }

export function SceneToast() {
  const [text, setText] = useState('')
  useEffect(() => {
    let timer = null
    const on = (event) => {
      setText(event.detail)
      clearTimeout(timer)
      timer = setTimeout(() => setText(''), 4000)
    }
    window.addEventListener(MESSAGE, on)
    return () => { window.removeEventListener(MESSAGE, on); clearTimeout(timer) }
  }, [])
  if (!text) return null
  return (
    <div className="wb-toasts wb-scene-toasts" role="status">
      <div className="wb-toast"><p>{text}</p></div>
    </div>
  )
}

// A scene that changes place, as one turning on moves to the head of the
// list and one ending goes back to its own place, slides there from where it
// was, as Severed's table does: each item's last place is kept, and after a
// reorder it starts at its old offset and settles at the new one. Both ways,
// since the home's tiles move along a line and the page's rows up and down.
// `ref(key)` is set on each item.
function useSlide(order) {
  const nodes = useRef(new Map())
  const placed = useRef({ order: null, at: new Map() })
  // Read after every drawing, from the layout and not the screen, so a resize
  // between reorders or a slide still running never skews where one starts.
  useLayoutEffect(() => {
    const now = new Map()
    for (const [key, node] of nodes.current) if (node?.isConnected) now.set(key, { x: node.offsetLeft, y: node.offsetTop })
    const last = placed.current
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!still && last.order !== null && last.order !== order) {
      for (const [key, at] of now) {
        const was = last.at.get(key)
        if (was && (Math.abs(was.x - at.x) > 1 || Math.abs(was.y - at.y) > 1)) {
          nodes.current.get(key).animate([{ transform: `translate(${was.x - at.x}px, ${was.y - at.y}px)` }, { transform: 'translate(0, 0)' }],
                                         { duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
        }
      }
    }
    placed.current = { order, at: now }
  })
  return (key) => (node) => { if (node) nodes.current.set(key, node); else nodes.current.delete(key) }
}

// The scenes, their state and the work on them, shared by the row and the page.
function useSceneActions(zones) {
  const { t } = useI18n()
  const { scenesEpoch } = useSystem()
  const roomsKey = Object.values(zones).map((z) => z.name).join('|')
  const state = useScenes(scenesEpoch, roomsKey)
  const [busy, setBusy] = useState('')
  const run = async (scene, key) => {
    if (busy) return
    setBusy(key)
    try { say(reportText(t, scene, await applyScene(t, scene))) } catch { say(reportText(t, scene, null)) }
    setBusy('')
  }
  const end = async (scene, key) => {
    if (busy) return
    setBusy(`end:${key}`)
    try { say(reportText(t, scene, await api.endScene(key), true)) } catch { say(reportText(t, scene, null, true)) }
    state.reload()
    setBusy('')
  }
  const remove = async (scene) => {
    try { await api.removeScene(scene.id); state.reload() } catch { /* the push refreshes the list */ }
  }
  return { ...state, busy, run, end, remove }
}

// The home's row: the section head with Manage at the right, as Your
// Services has it, then every scene and a "New Scene" tile at the end, on
// one line that scrolls sideways under Your Services' scrollbar and edge
// fade. Each tile is as wide as the home's tile rows make theirs at this
// width, so the line keeps their columns.
export function ScenesRow({ zones, onManage }) {
  const { t } = useI18n()
  const scenes = useSceneActions(zones)
  const [row, edges] = useEdgeFade([scenes.scenes.length, scenes.loaded])
  const tileWidth = useTileWidth(row, scenes.loaded)
  const [editing, setEditing] = useState(null)
  const [menu, setMenu] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const shown = scenes.scenes
  const slide = useSlide(shown.map(sceneKey).join('|'))
  if (!scenes.loaded || !scenes.households.length) return null
  return (
    <section className="wb-section wb-scenes">
      <div className="wb-section-head">
        <div><h2>{t('scenes.title')}</h2></div>
        {scenes.scenes.length > 0 && (
          <button type="button" className="wb-viewall" onClick={onManage}>{t('web.cs.manage')}</button>
        )}
      </div>
      <div className="wb-services wb-scene-line" ref={row}
           style={tileWidth ? { '--wb-scene-w': `${tileWidth}px` } : undefined}
           data-fade-left={edges.left || undefined}
           data-fade-right={edges.right || undefined}>
        {shown.map((scene) => (
          <SceneTile key={sceneKey(scene)} slideRef={slide(sceneKey(scene))} scene={scene} scenes={scenes}
                     onMenu={(spot) => setMenu({ scene, ...spot })} />
        ))}
        <button type="button" className="wb-tile wb-scene-add" onClick={() => setEditing({ scene: null })}>
          <div className="wb-tile-art"><Icon.Plus /></div>
          <p className="wb-tile-label">{t('scenes.add')}</p>
        </button>
      </div>
      {menu && <SceneMenu scene={menu.scene} scenes={scenes} spot={menu} onClose={() => setMenu(null)}
                          onEdit={(scene) => setEditing({ scene })} onDelete={setConfirm} />}
      {editing && <SceneEditor scene={editing.scene} households={scenes.households} onClose={() => setEditing(null)} />}
      {confirm && <DeleteConfirm scene={confirm} onClose={() => setConfirm(null)} onDelete={() => { scenes.remove(confirm); setConfirm(null) }} />}
    </section>
  )
}

// The width the home's tile grids give a tile in a column this wide: as many
// 150px-or-wider tiles as fit with 16px between them, sharing the width
// (.wb-tiles).
function useTileWidth(ref, ready) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => {
      const w = node.clientWidth
      if (w <= 0) return
      const fits = Math.max(1, Math.floor((w + 16) / (150 + 16)))
      setWidth((w - 16 * (fits - 1)) / fits)
    }
    measure()
    const watcher = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    watcher?.observe(node)
    return () => watcher?.disconnect()
  }, [ref, ready])
  return width
}

// One scene as a home tile, its picture the scene's own (SceneArt.jsx).
// Off, a click starts it; on, the tile wears the end mark over its picture
// and a click ends it. Its line under the name is the rooms and music, or
// the time left while it is on.
function SceneTile({ scene, scenes, onMenu, slideRef }) {
  const { t } = useI18n()
  const key = sceneKey(scene)
  const on = scenes.active?.[key]
  const working = scenes.busy === key ? t('scenes.applying') : scenes.busy === `end:${key}` ? t('scenes.ending') : ''
  const openMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const box = event.type === 'click' ? event.currentTarget.getBoundingClientRect() : null
    onMenu(box ? { x: box.right, y: box.bottom, align: 'right' } : { x: event.clientX, y: event.clientY })
  }
  return (
    <div className="wb-scene-tile" ref={slideRef} data-on={on ? 'true' : undefined} aria-busy={working ? 'true' : undefined}
         onContextMenu={openMenu}>
      <button type="button" className="wb-tile"
              title={on ? `${t('scenes.endScene')}: ${sceneName(t, scene)}` : `${t('scenes.startScene')}: ${sceneName(t, scene)}`}
              onClick={() => (on ? scenes.end(scene, key) : scenes.run(scene, key))}>
        <div className="wb-tile-art">
          <SceneArt id={scene.id || key} />
          {on && (
            <span className="wb-scene-end" aria-hidden="true">
              <span className="wb-scene-end-disc"><i /></span>
              <span className="wb-scene-end-word">{t('scenes.end')}</span>
            </span>
          )}
        </div>
        <p className="wb-tile-label">{sceneName(t, scene)}</p>
        <p className="wb-tile-sub">
          {working || (on
            ? <><Icon.WinTilePlay className="wb-scene-state" aria-hidden="true" /><SceneTimeLeft on={on} className="wb-scene-time" /></>
            : sceneSummary(t, scene))}
        </p>
      </button>
      <button type="button" className="wb-scene-more" title={t('desk.browse.actions')} aria-label={t('desk.browse.actions')}
              aria-haspopup="menu" onClick={openMenu}>
        <Icon.Ellipsis width={20} height={20} />
      </button>
    </div>
  )
}

// The page Manage opens: Content Services' card, one row per scene with its
// menu, and "New Scene" last.
export function ScenesPage({ zones, onClose }) {
  const { t } = useI18n()
  const scenes = useSceneActions(zones)
  const [editing, setEditing] = useState(null)
  const [menu, setMenu] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const slide = useSlide(scenes.scenes.map(sceneKey).join('|'))
  return (
    <div className="wb-services-page wb-cs wb-scenes-page">
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={16} height={16} />
      </button>
      <h1>{t('scenes.title')}</h1>
      <div className="wb-cs-card">
        {scenes.scenes.map((scene) => {
          const key = sceneKey(scene)
          const on = scenes.active?.[key]
          const working = scenes.busy === key ? t('scenes.applying') : scenes.busy === `end:${key}` ? t('scenes.ending') : ''
          const openMenu = (event) => {
            event.preventDefault()
            event.stopPropagation()
            const box = event.type === 'click' ? event.currentTarget.getBoundingClientRect() : null
            setMenu({ scene, ...(box ? { x: box.right, y: box.bottom, align: 'right' } : { x: event.clientX, y: event.clientY }) })
          }
          return (
            <div key={key} ref={slide(key)} className="wb-cs-row wb-scene-row" data-on={on ? 'true' : undefined}
                 style={on ? { '--wb-scene-ground': sceneGround(scene.id || key) } : undefined} aria-busy={working ? 'true' : undefined}
                 role="button" tabIndex={0} onContextMenu={openMenu}
                 onClick={() => (on ? scenes.end(scene, key) : scenes.run(scene, key))}
                 onKeyDown={(event) => { if (event.key === 'Enter') (on ? scenes.end(scene, key) : scenes.run(scene, key)) }}>
              <span className="wb-cs-icon wb-scene-icon"><SceneArt id={scene.id || key} /></span>
              <span className="wb-cs-text">
                <span className="wb-cs-name">{sceneName(t, scene)}</span>
                <span className="wb-cs-sub">
                  {working || (on
                    ? <><Icon.WinTilePlay className="wb-scene-state" aria-hidden="true" />{sceneSummary(t, scene)}</>
                    : sceneSummary(t, scene))}
                </span>
              </span>
              {on && <SceneTimeLeft on={on} className="wb-scene-time" />}
              <button type="button" className="wb-scene-more" title={t('desk.browse.actions')} aria-label={t('desk.browse.actions')}
                      aria-haspopup="menu" onClick={openMenu}>
                <Icon.Ellipsis width={20} height={20} />
              </button>
            </div>
          )
        })}
        {scenes.households.length > 0 && (
          <button type="button" className="wb-cs-row wb-cs-addrow" onClick={() => setEditing({ scene: null })}>
            <Icon.Plus width={20} height={20} aria-hidden="true" />
            <span className="wb-cs-name">{t('scenes.add')}</span>
          </button>
        )}
      </div>
      {menu && <SceneMenu scene={menu.scene} scenes={scenes} spot={menu} onClose={() => setMenu(null)}
                          onEdit={(scene) => setEditing({ scene })} onDelete={setConfirm} />}
      {editing && <SceneEditor scene={editing.scene} households={scenes.households} onClose={() => setEditing(null)} />}
      {confirm && <DeleteConfirm scene={confirm} onClose={() => setConfirm(null)} onDelete={() => { scenes.remove(confirm); setConfirm(null) }} />}
    </div>
  )
}

// A scene's menu, in the player menu's panel: Start or End as the scene is
// off or on, then Edit and Delete. Kept inside the window by its measured
// size.
function SceneMenu({ scene, scenes, spot, onClose, onEdit, onDelete }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const key = sceneKey(scene)
  const on = Boolean(scenes.active?.[key])
  useEffect(() => {
    const away = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const keys = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', keys, true)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', keys, true) }
  }, [onClose])
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const left = spot.align === 'right' ? spot.x - width : spot.x
    setFit({ left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
             top: Math.max(8, spot.y + height > window.innerHeight - 8 ? spot.y - height : spot.y) })
  }, [spot])
  const act = (fn) => () => { onClose(); fn() }
  return (
    <div className="wb-np-menu wb-scene-menu" role="menu" ref={ref} style={fit ?? { left: 0, top: 0, visibility: 'hidden' }}>
      {on ? (
        <button type="button" role="menuitem" disabled={Boolean(scenes.busy)} onClick={act(() => scenes.end(scene, key))}>
          <Icon.Stop width={20} height={20} /><span>{t('scenes.endScene')}</span>
        </button>
      ) : (
        <button type="button" role="menuitem" disabled={Boolean(scenes.busy)} onClick={act(() => scenes.run(scene, key))}>
          <Icon.Play width={20} height={20} /><span>{t('scenes.startScene')}</span>
        </button>
      )}
      <button type="button" role="menuitem" onClick={act(() => onEdit(scene))}>
        <Pencil width={20} height={20} /><span>{t('scenes.edit')}</span>
      </button>
      <button type="button" role="menuitem" onClick={act(() => onDelete(scene))}>
        <Bin width={20} height={20} /><span>{t('scenes.delete')}</span>
      </button>
    </div>
  )
}

// The editor's sliders are the theme's own: the 2px rail and 12px knob the volume uses.
function SceneSlider({ label, value, min, max, step, disabled = false, onChange }) {
  return (
    <span className="scene-slider" data-disabled={disabled || undefined}>
      {label && <span className="scene-slider-label">{label}</span>}
      <span className="scene-slider-track" data-center={(min < 0 && max > 0) || undefined}>
        <Slider value={value} min={min} max={max} wheelStep={step} label={label || ''} disabled={disabled} center={min < 0 && max > 0} onCommit={onChange} />
      </span>
      <span className="scene-value">{value}</span>
    </span>
  )
}

// The editor, in the theme's panel. `scene` is null for a new one. A Try
// sets the scene as it stands; End after it puts the rooms back, and a test
// still on when the panel goes ends with it.
function SceneEditor({ scene, households, onClose }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const end = async () => {
    setBusy(true)
    try { say(reportText(t, scene, await endSceneTest(), true)); setTried(false) } catch { say(reportText(t, scene, null, true)) }
    actions.scenesChanged()
    setBusy(false)
  }
  const close = () => { if (tried) end(); onClose() }
  const save = async (body) => {
    setBusy(true)
    try {
      if (scene?.id) await api.updateScene(scene.id, body)
      else await api.addScene(body)
      actions.scenesChanged()
      close()
    } catch {
      setBusy(false)
    }
  }
  const tryIt = async (body) => {
    setBusy(true)
    try { say(reportText(t, body, await trySceneBody(body))); setTried(true) } catch { say(reportText(t, body, null)) }
    actions.scenesChanged()
    setBusy(false)
  }
  const title = scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')
  return (
    <Overlay onClose={close} label={title} variant="scene">
      <button type="button" className="wb-dialog-close" title={t('common.close')} onClick={close}>
        <Icon.Close width={16} height={16} />
      </button>
      <h2>{title}</h2>
      <div className="wb-scene-editor">
        <SceneEditorPanel heading={false} Slider={SceneSlider} scene={scene} households={households} busy={busy} tried={tried}
                          onCancel={close} onSave={save} onTry={tryIt} onEnd={end} />
      </div>
    </Overlay>
  )
}

// Delete, asked in the theme's dialog: the title and line, Cancel and Delete.
function DeleteConfirm({ scene, onClose, onDelete }) {
  const { t } = useI18n()
  return (
    <Overlay onClose={onClose} label={t('scenes.deleteTitle')} variant="dialog">
      <h2>{t('scenes.deleteTitle')}</h2>
      <p>{t('scenes.deleteBody', { name: scene.name })}</p>
      <div className="wb-dialog-actions">
        <button type="button" className="wb-dialog-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="wb-dialog-btn" onClick={onDelete}>{t('scenes.delete')}</button>
      </div>
    </Overlay>
  )
}

// A scene that is on with every room it plays in stopped or paused, as the
// server says (backend/main.py, _watch_scenes): asked once whether to end
// it, in the same dialog. No leaves it on.
export function SceneQuietAsk() {
  const { t } = useI18n()
  const { sceneQuiet, actions } = useSystem()
  if (!sceneQuiet) return null
  const scene = { name: sceneQuiet.name }
  const end = async () => {
    actions.sceneQuietSeen()
    try { say(reportText(t, scene, await api.endScene(sceneQuiet.key), true)) } catch { say(reportText(t, scene, null, true)) }
    actions.scenesChanged()
  }
  return (
    <Overlay onClose={actions.sceneQuietSeen} label={sceneQuiet.name} variant="dialog">
      <h2>{sceneQuiet.name}</h2>
      <p>{t('scenes.quiet.body', { name: sceneQuiet.name })}</p>
      <div className="wb-dialog-actions">
        <button type="button" className="wb-dialog-btn" onClick={actions.sceneQuietSeen}>{t('scenes.quiet.no')}</button>
        <button type="button" className="wb-dialog-btn" onClick={end}>{t('scenes.quiet.yes')}</button>
      </div>
    </Overlay>
  )
}
