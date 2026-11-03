import React, { useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useScenes, applyScene, trySceneBody, reportText, sceneKey, sceneName, sceneSummaryParts, endSceneTest } from '../../frontend/src/lib/scenes.js'
import SceneEditorPanel from '../../frontend/src/components/SceneEditorPanel.jsx'
import SceneTimeLeft from '../../frontend/src/components/SceneTimeLeft.jsx'
import * as G from './glyphs.jsx'
import { Unit, Display, Key, IconKey, Panel, PanelHead, Confirm, Empty, Loading, Select, Fader } from './controls.jsx'

// The scene memory: groups of rooms, each on its own system, their levels
// and what each plays, recalled in one go. Each scene is a preset line
// with a play key under its preset number, whose lamp shows the scene is on
// (pressing it then ends the scene), its name in the tube and its rooms
// under it. A scene can span S1 and S2,
// so the front panel's choice of system has no say here.

// The editor's sliders as the deck's faders, with the editor's label and value around them.
function SceneFader({ label, value, min, max, step, disabled = false, onChange }) {
  return (
    <span className="scene-slider">
      {label && <span className="scene-slider-label">{label}</span>}
      <span className="scene-slider-track" data-center={(min < 0 && max > 0) || undefined}>
        <Fader value={value} min={min} max={max} label={label || ''} wheelStep={step} disabled={disabled} onCommit={onChange} />
      </span>
      <span className="scene-value">{value}</span>
    </span>
  )
}

// A tone switch as one of the deck's keys: the glyph on the key, the name as its legend, its lamp lit when on.
const TONE_GLYPHS = { loudness: G.Loudness, night: G.Moon, speech: G.Speech }
function SceneToneKey({ kind, label, on, onChange }) {
  const Glyph = TONE_GLYPHS[kind] || G.Sliders
  return <Key size="sm" legend={label} label={label} icon={<Glyph />} led={on} pressed={on} className="hf-scene-tone-key" onClick={() => onChange(!on)} />
}

// A scene's rooms and music, its room names in bold.
function SceneSummary({ scene }) {
  const { t } = useI18n()
  return sceneSummaryParts(t, scene).map((part, i) => (part.room ? <b key={i} className="hf-scene-room">{part.text}</b> : part.text))
}

export default function ScenesUnit({ zones, onMessage }) {
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
  const line = (scene, i) => {
    const key = sceneKey(scene)
    const on = Boolean(active?.[key])
    return (
      <li key={key} className="hf-program hf-scene" data-on={on || busy === key || undefined} data-active={on || undefined}>
        <Key legend={t('hifi.preset', { n: i + 1 })} label={`${t(on ? 'scenes.end' : 'scenes.apply')}: ${sceneName(t, scene)}`}
             icon={<G.Play />} led={on || busy === key} size="sm" className="hf-scene-key" disabled={Boolean(busy)}
             onClick={() => (on ? end(scene, key) : run(scene, key))} />
        <Display className="hf-program-display hf-scene-display">
          <span className="hf-vfd-title hf-scene-name">{sceneName(t, scene)}</span>
          {on && <span className="hf-scene-on">{t('scenes.on')}</span>}
          {on && <SceneTimeLeft on={active[key]} className="hf-scene-time" Glyph={G.Infinity} />}
          <span className="hf-vfd-sub">{busy === key ? t('scenes.applying') : busy === `end:${key}` ? t('scenes.ending') : <SceneSummary scene={scene} />}</span>
        </Display>
        <span className="hf-program-text" />
        <span className="hf-program-tools">
          <IconKey label={t('scenes.edit')} disabled={Boolean(busy)} onClick={() => open(scene)}><G.Pencil /></IconKey>
          <IconKey label={t('scenes.delete')} disabled={Boolean(busy)} onClick={() => setConfirm(scene)}><G.Trash /></IconKey>
        </span>
      </li>
    )
  }
  return (
    <Unit className="hf-scenes-unit" name={t('hifi.unit.scenes')} model={t('scenes.title')}>
      <div className="hf-scenes-body">
        <section className="hf-timer-programs hf-scene-presets" aria-label={t('scenes.title')}>
          <div className="hf-unit-toolbar">
            <h3 className="hf-section-plate"><G.Scenes />{t('scenes.title')}</h3>
            <span className="hf-grow" />
            <Key legend={t('hifi.newProgram')} label={t('scenes.addTitle')} icon={<G.Plus />} disabled={!households.length} onClick={() => open(null)} size="sm" />
          </div>
          {!loaded && <Loading>{t('desk.browse.loading')}</Loading>}
          {loaded && scenes.length === 0 && <Empty icon={<G.Scenes />} title={t('scenes.none')} body={t('scenes.noneBody')} />}
          {scenes.length > 0 && <ol className="hf-programs">{scenes.map(line)}</ol>}
        </section>
      </div>
      {editing && (
        <Panel kind="center" title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} className="hf-scene-editor" wide>
          <PanelHead title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} />
          <div className="hf-panel-body">
            <SceneEditorPanel heading={false} ToneGlyph={G.Gear} Select={Select} Slider={SceneFader} ToneSwitch={SceneToneKey} menuClass="hf-select" scene={editing.scene} households={households} busy={busy === 'save' || busy === 'try'} tried={tried}
                              onCancel={close} onSave={save} onTry={tryIt} onEnd={endTry} />
          </div>
        </Panel>
      )}
      {confirm && (
        <Confirm title={t('scenes.deleteTitle')} body={t('scenes.deleteBody', { name: confirm.name })}
                 action={t('scenes.delete')} danger onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
      )}
    </Unit>
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
