import React, { useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useScenes, applyScene, trySceneBody, reportText, sceneKey, sceneName, sceneSummaryParts, endSceneTest } from '../../frontend/src/lib/scenes.js'
import SceneEditorPanel from '../../frontend/src/components/SceneEditorPanel.jsx'
import SceneTimeLeft from '../../frontend/src/components/SceneTimeLeft.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetHeader, Button, Confirm, Empty, IconButton, Spinner, Select } from './ui.jsx'

// Scenes: groups of rooms, each on its own system, their levels and what
// each plays, set in one go. Every scene as a card, a press on one setting
// it and End on one that is on putting everything back. A scene can span
// S1 and S2, so the rail's choice of system has no say here.

// A scene's rooms and music, its room names in bold.
function SceneSummary({ scene }) {
  const { t } = useI18n()
  return sceneSummaryParts(t, scene).map((part, i) => (part.room ? <b key={i} className="sf-scene-room">{part.text}</b> : part.text))
}

export default function ScenesSection({ zones, onMessage }) {
  const { t } = useI18n()
  const { scenesEpoch } = useSystem()
  const roomsKey = Object.values(zones).map((z) => z.name).join('|')
  const { households, scenes, active, loaded, reload } = useScenes(scenesEpoch, roomsKey)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)   // null, or { scene }
  const [tried, setTried] = useState(false)
  const [confirm, setConfirm] = useState(null)
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
      <article key={key} className="sf-scene" data-busy={busy === key || undefined} aria-current={on || undefined} role="button" tabIndex={0}
               onClick={() => { if (!on) run(scene, key) }} onKeyDown={(event) => { if (event.key === 'Enter' && !on) run(scene, key) }}>
        <span className="sf-scene-glyph">{busy === key ? <Spinner /> : <I.Clapper />}</span>
        <div className="sf-scene-text">
          <strong>{sceneName(t, scene)}</strong>
          <span>{busy === key ? t('scenes.applying') : busy === `end:${key}` ? t('scenes.ending') : <SceneSummary scene={scene} />}</span>
        </div>
        <div className="sf-scene-tools" onClick={(event) => event.stopPropagation()}>
          {on && <SceneTimeLeft on={active[key]} className="sf-scene-time" Glyph={I.Infinity} />}
          {on && <Button primary disabled={Boolean(busy)} onClick={() => end(scene, key)}>{t('scenes.end')}</Button>}
          <IconButton size="sm" label={t('scenes.edit')} onClick={() => open(scene)}><I.Pencil /></IconButton>
          <IconButton size="sm" label={t('scenes.delete')} onClick={() => setConfirm(scene)}><I.Trash /></IconButton>
        </div>
      </article>
    )
  }
  return (
    <div className="sf-scenes">
      <header className="sf-page-head">
        <div>
          <h1>{t('scenes.title')}</h1>
          <p className="sf-page-sub">{t('sf.sub.scenes')}</p>
        </div>
        <div className="sf-page-actions">
          <Button primary icon={<I.Plus />} disabled={!households.length} onClick={() => open(null)}>{t('scenes.add')}</Button>
        </div>
      </header>
      {!loaded && <div className="sf-loading"><Spinner />{t('desk.browse.loading')}</div>}
      {loaded && scenes.length === 0 && <Empty icon={<I.Clapper />} title={t('scenes.none')} body={t('scenes.noneBody')} />}
      {scenes.length > 0 && (
        <section className="sf-scene-list" aria-label={t('scenes.title')}>
          {scenes.map(card)}
        </section>
      )}
      {editing && (
        <Sheet kind="center" title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} className="sf-scene-editor" wide>
          <SheetHeader title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} />
          <div className="sf-sheet-body">
            <SceneEditorPanel heading={false} Select={Select} scene={editing.scene} households={households} busy={busy === 'save' || busy === 'try'} tried={tried}
                              onCancel={close} onSave={save} onTry={tryIt} onEnd={endTry} />
          </div>
        </Sheet>
      )}
      {confirm && (
        <Confirm title={t('scenes.deleteTitle')} body={t('scenes.deleteBody', { name: confirm.name })}
                 action={t('scenes.delete')} danger onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
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
