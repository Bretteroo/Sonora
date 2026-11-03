import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useScenes, applyScene, trySceneBody, reportText, sceneKey, sceneName, sceneSummary, sceneSummaryParts, endSceneTest } from '../../frontend/src/lib/scenes.js'
import { MarqueeProvider, MarqueeText } from '../../frontend/src/lib/marquee.jsx'
import SceneEditorPanel from '../../frontend/src/components/SceneEditorPanel.jsx'
import SceneTimeLeft from '../../frontend/src/components/SceneTimeLeft.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { Window, Confirm } from './Dialogs.jsx'
import Slider from './Slider.jsx'

// Scenes, in the music pane: every scene as a row, a double-click on one
// starting it, and its caret or a right-click opening the menu that starts,
// ends, edits, or deletes it, as a music row's does. A scene can
// span S1 and S2, so the same list shows whichever system's pane it is
// opened from. The editor opens as a window of its own (SceneWindow), as
// Alarms does.

// The editor's sliders are the controller's own: the thin track and round thumb the volume uses.
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

export function ScenesPage({ zones, onEdit, onMessage }) {
  const { t } = useI18n()
  const { scenesEpoch } = useSystem()
  const roomsKey = Object.values(zones).map((z) => z.name).join('|')
  const { households, scenes, active, loaded, reload } = useScenes(scenesEpoch, roomsKey)
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [menu, setMenu] = useState(null)
  const run = async (scene, key) => {
    if (busy) return
    setBusy(key)
    try {
      const report = await applyScene(t, scene)
      onMessage?.(reportText(t, scene, report))
    } catch {
      onMessage?.(reportText(t, scene, null))
    }
    setBusy('')
  }
  const end = async (scene, key) => {
    if (busy) return
    setBusy(`end:${key}`)
    try { onMessage?.(reportText(t, scene, await api.endScene(key), true)) } catch { onMessage?.(reportText(t, scene, null, true)) }
    reload()
    setBusy('')
  }
  const remove = async (scene) => {
    setConfirm(null)
    try { await api.removeScene(scene.id); reload() } catch { /* the push refreshes the list */ }
  }
  if (!loaded) return <p className="dk-browse-note">{t('desk.browse.loading')}</p>
  return (
    <div className="dk-browse-list dk-scenes">
      {/* a row's second line scrolls to and fro when it is too long for the row (lib/marquee.jsx) */}
      <MarqueeProvider enabled style="bounce">
      {scenes.map((scene) => {
        const key = sceneKey(scene)
        const on = Boolean(active?.[key])
        const open = (event) => setMenu({ scene, key, on, ...menuSpot(event), from: event.type === 'click' ? 'open' : 'context' })
        return (
          <div key={key} className="dk-browse-row dk-scene-row" aria-current={on || undefined} role="button" tabIndex={0} aria-busy={busy === key || undefined}
               data-menu={menu?.key === key ? menu.from : undefined}
               onDoubleClick={() => { if (!on) run(scene, key) }}
               onContextMenu={(event) => { event.preventDefault(); open(event) }}
               onKeyDown={(event) => {
                 if (event.key === 'Enter' && !on) run(scene, key)
                 else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); setConfirm(scene) }
               }}>
            <span className="dk-browse-art dk-browse-glyph"><Icon.Scenes /></span>
            <span className="dk-browse-text">
              <p className="dk-browse-title">{sceneName(t, scene)}</p>
              {/* A scene that is on is the row's own tint and, as on a playing room's tile, the play mark before its second line. */}
              <p className="dk-browse-sub">
                {on && <Icon.WinTilePlay className="dk-scene-state" aria-hidden="true" />}
                {busy === key ? t('scenes.applying') : busy === `end:${key}` ? t('scenes.ending') : <SceneSummary scene={scene} />}
              </p>
            </span>
            {/* how long it plays: an infinity, or the time left */}
            {on && <SceneTimeLeft on={active[key]} className="dk-scene-time" />}
            <button type="button" className="dk-browse-actions" title={t('desk.browse.actions')} onClick={(event) => { event.stopPropagation(); open(event) }}>
              <Icon.CaretDown />
            </button>
          </div>
        )
      })}
      </MarqueeProvider>
      {households.length > 0 && (
        <div className="dk-browse-row dk-scene-add" role="button" tabIndex={0}
             onClick={() => onEdit(null, households)} onKeyDown={(event) => { if (event.key === 'Enter') onEdit(null, households) }}>
          <span className="dk-browse-art dk-browse-glyph"><Icon.Plus /></span>
          <span className="dk-browse-text"><p className="dk-browse-title">{t('scenes.add')}</p></span>
        </div>
      )}
      {menu && (
        <SceneMenu title={sceneName(t, menu.scene)} on={menu.on} busy={Boolean(busy)} x={menu.x} y={menu.y} onClose={() => setMenu(null)}
                   onAct={(act) => {
                     const { scene, key } = menu
                     setMenu(null)
                     if (act === 'start') run(scene, key)
                     else if (act === 'end') end(scene, key)
                     else if (act === 'edit') onEdit(scene, households)
                     else setConfirm(scene)
                   }} />
      )}
      {confirm && (
        <Confirm title={t('scenes.deleteTitle')} body={t('scenes.deleteBody', { name: confirm.name })} action={t('scenes.delete')}
                 cancelLabel={t('common.cancel')} onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

// A scene's rooms and music, its room names in bold. The pieces are kept
// while the text is the same, so the line's scroll does not start over each
// time the list is drawn.
function SceneSummary({ scene }) {
  const { t } = useI18n()
  const text = sceneSummary(t, scene)
  const parts = useMemo(() => sceneSummaryParts(t, scene)
    .map((part, i) => (part.room ? <b key={i} className="dk-scene-room">{part.text}</b> : part.text)), [text]) // eslint-disable-line react-hooks/exhaustive-deps
  return <MarqueeText>{parts}</MarqueeText>
}

// Where a row's menu opens, as the music rows place theirs: from the caret,
// under the row with its left edge on the caret's; from a right-click, at
// the pointer.
function menuSpot(event) {
  const caret = event.type === 'click' ? event.currentTarget?.getBoundingClientRect?.() : null
  if (!caret?.width) return { x: event.clientX, y: event.clientY }
  const row = event.currentTarget.closest?.('.dk-browse-row')?.getBoundingClientRect()
  return { x: caret.left, y: (row ?? caret).bottom }
}

// A scene row's menu, the music rows' dropdown with the scene's own
// actions: Start Scene or End Scene enabled as the scene is off or on,
// then Edit and Delete.
function SceneMenu({ title, on, busy, x, y, onClose, onAct }) {
  const { t } = useI18n()
  const ref = useRef(null)
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  // Kept inside the window by its measured size, flipping above the
  // pointer when there is no room below.
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setFit({ left: Math.max(0, Math.min(x, window.innerWidth - width - 4)),
             top: Math.max(0, y + height > window.innerHeight - 4 ? y - height : y) })
  }, [x, y])
  return (
    <div className="dk-popover dk-action-menu" ref={ref} role="menu" style={fit ?? { left: 0, top: y, visibility: 'hidden' }}>
      <p className="dk-popover-title">{title}</p>
      <button type="button" role="menuitem" disabled={on || busy} onClick={() => onAct('start')}>{t('scenes.startScene')}</button>
      <button type="button" role="menuitem" disabled={!on || busy} onClick={() => onAct('end')}>{t('scenes.endScene')}</button>
      <hr className="dk-popover-sep" />
      <button type="button" role="menuitem" onClick={() => onAct('edit')}>{t('scenes.edit')}</button>
      <button type="button" role="menuitem" onClick={() => onAct('delete')}>{t('scenes.delete')}</button>
    </div>
  )
}

// The editor, as a window over the shell. `scene` is null for a new one, or
// a saved scene to change. A Try sets the scene as it stands; End after it
// puts the rooms back.
export function SceneWindow({ scene, households, onClose, onMessage }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
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
    try { onMessage?.(reportText(t, body, await trySceneBody(body))); setTried(true) } catch { onMessage?.(reportText(t, body, null)) }
    actions.scenesChanged()
    setBusy(false)
  }
  const end = async () => {
    setBusy(true)
    try { onMessage?.(reportText(t, scene, await endSceneTest(), true)); setTried(false) } catch { onMessage?.(reportText(t, scene, null, true)) }
    actions.scenesChanged()
    setBusy(false)
  }
  // A test still on when the editor goes, by Save, Cancel, or its close box, ends with it.
  const close = () => { if (tried) end(); onClose() }
  return (
    <Window title={scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} className="dk-scene-window">
      <SceneEditorPanel heading={false} Slider={SceneSlider} scene={scene} households={households} busy={busy} tried={tried} onCancel={close} onSave={save} onTry={tryIt} onEnd={end} />
    </Window>
  )
}

// A scene that is on with every room it plays in stopped or paused, by
// hand or from another app, as the server says (backend/main.py,
// _watch_scenes): asked once whether to end it. No leaves it on.
export function SceneQuietAsk({ onMessage }) {
  const { t } = useI18n()
  const { sceneQuiet, actions } = useSystem()
  if (!sceneQuiet) return null
  const scene = { name: sceneQuiet.name }
  const end = async () => {
    actions.sceneQuietSeen()
    try { onMessage?.(reportText(t, scene, await api.endScene(sceneQuiet.key), true)) } catch { onMessage?.(reportText(t, scene, null, true)) }
    actions.scenesChanged()
  }
  return (
    <Confirm title={sceneQuiet.name} body={t('scenes.quiet.body', { name: sceneQuiet.name })}
             action={t('scenes.quiet.yes')} cancelLabel={t('scenes.quiet.no')} onConfirm={end} onClose={actions.sceneQuietSeen} />
  )
}
