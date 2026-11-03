import React, { useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useScenes, applyScene, trySceneBody, reportText, sceneKey, sceneName, sceneSummaryLines, endSceneTest } from '../../frontend/src/lib/scenes.js'
import SceneEditorPanel from '../../frontend/src/components/SceneEditorPanel.jsx'
import SceneTimeLeft from '../../frontend/src/components/SceneTimeLeft.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetBar, Button, Confirm, Empty, IconButton, Loading, Menu, MenuItem, Select, Skeleton } from './m3.jsx'

// Scenes: groups of rooms, each on its own system, their levels and what
// each plays, set in one go. Every scene as a card in a grid, a tap on one
// setting it and End on one that is on putting everything back. A card's
// menu edits or deletes it. A scene can span S1 and S2, so the shell's
// choice of system has no say here.

// A scene's rooms and music, each group starting on a line of its own, its room names in bold.
function SceneSummary({ scene }) {
  const { t } = useI18n()
  return sceneSummaryLines(t, scene).map((line, n) => (
    <span key={n} className="mg-scene-line">
      {line.map((part, i) => (part.room ? <b key={i} className="mg-scene-room">{part.text}</b> : part.text))}
    </span>
  ))
}

export default function ScenesPage({ zones, onMessage }) {
  const { t } = useI18n()
  const { scenesEpoch } = useSystem()
  const roomsKey = Object.values(zones).map((z) => z.name).join('|')
  const { households, scenes, active, loaded, reload } = useScenes(scenesEpoch, roomsKey)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)   // null, or { scene }
  const [tried, setTried] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [menu, setMenu] = useState(null)
  const run = async (scene, key) => {
    if (busy) return
    setBusy(key)
    try { onMessage?.(reportText(t, scene, await applyScene(t, scene))) } catch { onMessage?.(reportText(t, scene, null)) }
    setBusy('')
  }
  const end = async (scene, key) => {
    if (busy) return
    setBusy(`end:${key}`)
    try { onMessage?.(reportText(t, scene, await api.endScene(key), true)) } catch { onMessage?.(reportText(t, scene, null, true)) }
    reload()
    setBusy('')
  }
  const save = async (body) => {
    setBusy('save')
    try {
      if (editing.scene?.id) await api.updateScene(editing.scene.id, body)
      else await api.addScene(body)
      close(); reload()
    } catch { /* the editor stays open */ }
    setBusy('')
  }
  const tryIt = async (body) => {
    setBusy('try')
    try { onMessage?.(reportText(t, body, await trySceneBody(body))); setTried(true) } catch { onMessage?.(reportText(t, body, null)) }
    setBusy('')
  }
  const endTry = async () => {
    setBusy('try')
    try { onMessage?.(reportText(t, editing.scene, await endSceneTest(), true)); setTried(false) } catch { onMessage?.(reportText(t, editing.scene, null, true)) }
    setBusy('')
  }
  // A test still on when the editor goes, by Save, Cancel, or its close box, ends with it.
  const close = () => { if (tried) endTry(); setEditing(null); setTried(false) }
  const remove = async (scene) => {
    setConfirm(null)
    try { await api.removeScene(scene.id); reload() } catch { /* likewise */ }
  }
  const open = (scene) => { setTried(false); setEditing({ scene }) }
  const card = (scene) => {
    const key = sceneKey(scene)
    const on = Boolean(active?.[key])
    return (
      <article key={key} className="mg-card mg-scene" data-on={on || undefined} data-busy={busy === key || undefined} role="button" tabIndex={0}
               onClick={() => { if (!on) run(scene, key) }} onKeyDown={(event) => { if (event.key === 'Enter' && !on) run(scene, key) }}
               onContextMenu={(event) => { event.preventDefault(); setMenu({ scene, x: event.clientX, y: event.clientY }) }}>
        <span className="mg-state" aria-hidden="true" />
        <div className="mg-scene-top">
          {/* While it starts, the disc itself becomes the loading indicator, at
              the disc's own size; the padded Busy block overflowed it. */}
          <span className="mg-scene-glyph" data-busy={busy === key || undefined}>{busy === key ? <Loading size={40} /> : <I.Clapper />}</span>
          <IconButton size="xs" className="mg-scene-more" label={t('desk.browse.actions')}
                      onClick={(event) => { event.stopPropagation(); setMenu({ scene, anchor: event.currentTarget }) }}><I.More /></IconButton>
        </div>
        <strong className="mg-scene-name">{sceneName(t, scene)}</strong>
        <span className="mg-scene-sub">{busy === key ? t('scenes.applying') : busy === `end:${key}` ? t('scenes.ending') : <SceneSummary scene={scene} />}</span>
        {/* The corner holds what a tap on the card does: play while the scene is off, as Browse's Play Now button; End while it is on. */}
        <div className="mg-scene-actions" onClick={(event) => event.stopPropagation()}>
          {on && <SceneTimeLeft on={active[key]} className="mg-scene-time" Glyph={I.Infinity} />}
          {on
            ? <Button variant="tonal" size="s" disabled={Boolean(busy)} onClick={() => end(scene, key)}>{t('scenes.end')}</Button>
            : <IconButton variant="filled" label={t('scenes.startScene')} disabled={Boolean(busy)} onClick={() => run(scene, key)}><I.Play /></IconButton>}
        </div>
      </article>
    )
  }
  return (
    <div className="mg-scenes">
      <div className="mg-alarms-head">
        <h2 className="mg-title-l">{t('scenes.title')}</h2>
        <span className="mg-grow" />
        <Button variant="filled" size="s" icon={<I.Plus />} disabled={!households.length} onClick={() => open(null)}>{t('scenes.add')}</Button>
      </div>
      {!loaded && <Skeleton label={t('desk.browse.loading')} kind="cards" rows={3} />}
      {loaded && scenes.length === 0 && <Empty icon={<I.Clapper />} title={t('scenes.none')} body={t('scenes.noneBody')} />}
      {scenes.length > 0 && <div className="mg-alarm-grid mg-scene-grid">{scenes.map(card)}</div>}
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={sceneName(t, menu.scene)}>
          <MenuItem icon={<I.Edit />} onSelect={() => { const s = menu.scene; setMenu(null); open(s) }}>{t('scenes.edit')}</MenuItem>
          <MenuItem icon={<I.Trash />} danger onSelect={() => { const s = menu.scene; setMenu(null); setConfirm(s) }}>{t('scenes.delete')}</MenuItem>
        </Menu>
      )}
      {editing && (
        <Sheet kind="full" title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} className="mg-scene-editor">
          <SheetBar title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close}>
            <Button variant="text" size="s" type="submit" form="mg-scene-form" disabled={busy === 'save'}>{t('common.save')}</Button>
          </SheetBar>
          <div className="mg-sheet-body">
            <SceneEditorPanel heading={false} ToneGlyph={I.SettingsLine} formId="mg-scene-form" Select={Select} menuClass="mg-select" scene={editing.scene} households={households} busy={busy === 'save' || busy === 'try'} tried={tried}
                              onCancel={close} onSave={save} onTry={tryIt} onEnd={endTry} />
          </div>
        </Sheet>
      )}
      {confirm && (
        <Confirm title={t('scenes.deleteTitle')} body={t('scenes.deleteBody', { name: confirm.name })}
                 action={t('scenes.delete')} danger icon={<I.Clapper />} onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
      )}
    </div>
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
