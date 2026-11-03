import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useScenes, applyScene, trySceneBody, reportText, sceneKey, sceneName, sceneSummary, sceneSummaryParts, endSceneTest } from '../../frontend/src/lib/scenes.js'
import SceneEditorPanel from '../../frontend/src/components/SceneEditorPanel.jsx'
import SceneTimeLeft from '../../frontend/src/components/SceneTimeLeft.jsx'
import * as G from './glyphs.jsx'
import { Window, WindowBar, Btn, Confirm, Empty, Busy, Menu, MenuItem, Select, Bar } from './kit.jsx'
import { MarqueeProvider, MarqueeText } from '../../frontend/src/lib/marquee.jsx'
import { pt } from './layout.js'

// The Scenes program: groups of rooms, each on its own system, their
// levels and what each plays, run in one go. Every scene as a table, one
// line each: the name, its rooms and what they play, a Set key and an End
// key while it is on. Edit and Delete keys end the line, and a right click
// offers the same. A scene can span
// S1 and S2, so the deck's choice of system has no say here.

// The editor's sliders as the screen's level bars: the label stays the
// editor's, the value is the bar's own, and a tone bar is centered on zero.
function SceneBar({ label, value, min, max, step, disabled = false, onChange }) {
  return (
    <span className="scene-slider">
      {label && <span className="scene-slider-label">{label}</span>}
      <Bar value={value} min={min} max={max} step={step} label={label || ''} center={min < 0} wheelStep={step} disabled={disabled} onCommit={onChange} />
    </span>
  )
}

// A scene's rooms and music, its room names in bold. The pieces are kept
// while the text is the same, so the line's scroll does not start over each
// time the list is drawn.
function SceneSummary({ scene }) {
  const { t } = useI18n()
  const text = sceneSummary(t, scene)
  const parts = useMemo(() => sceneSummaryParts(t, scene)
    .map((part, i) => (part.room ? <b key={i} className="sv-scene-room">{part.text}</b> : part.text)), [text]) // eslint-disable-line react-hooks/exhaustive-deps
  return <MarqueeText>{parts}</MarqueeText>
}

export default function ScenesProgram({ zones, onMessage }) {
  const { t } = useI18n()
  const { scenesEpoch } = useSystem()
  const roomsKey = Object.values(zones).map((z) => z.name).join('|')
  const { households, scenes, active, loaded, reload } = useScenes(scenesEpoch, roomsKey)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)   // null, or { scene }
  // A row that changes place on the table slides there from where it was:
  // the rows' last positions are kept, and after a reorder each row starts
  // at its old offset and settles at the new one.
  const rows = useRef(new Map())
  const placed = useRef(new Map())
  const order = scenes.map(sceneKey).join('|')
  useLayoutEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const now = new Map()
    for (const [key, node] of rows.current) if (node) now.set(key, node.getBoundingClientRect().top)
    for (const [key, top] of now) {
      const was = placed.current.get(key)
      if (!still && was != null && Math.abs(was - top) > 1) {
        rows.current.get(key).animate([{ transform: `translateY(${was - top}px)` }, { transform: 'translateY(0)' }],
                                      { duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
      }
    }
    placed.current = now
  }, [order])
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
  return (
    <div className="sv-scenes">
      <section aria-label={t('scenes.title')}>
        <header className="sv-programhead">
          <h1 className="sv-title">{t('scenes.title')}</h1>
          <div className="sv-programhead-tools">
            <Btn variant="solid" size="s" icon={<G.Plus size={12} />} disabled={!households.length} onClick={() => open(null)}>{t('scenes.add')}</Btn>
          </div>
        </header>
        {!loaded && <Busy label={t('desk.browse.loading')} />}
        {loaded && scenes.length === 0 && <Empty icon={<G.Clapper size={48} />} title={t('scenes.none')} body={t('scenes.noneBody')} />}
        {scenes.length > 0 && (
          <div className="sv-alarm-table sv-scene-table" role="table" aria-label={t('scenes.title')}>
            {/* the rooms and their music scroll when the line is too long for the row (lib/marquee.jsx) */}
            <MarqueeProvider enabled style="bounce">
            {scenes.map((scene) => {
              const key = sceneKey(scene)
              const on = Boolean(active?.[key])
              return (
                <div key={key} ref={(node) => { if (node) rows.current.set(key, node); else rows.current.delete(key) }}
                     className="sv-scene" data-on={busy === key || undefined} data-active={on || undefined} role="row"
                     onContextMenu={(event) => { event.preventDefault(); setMenu({ scene, x: pt(event.clientX), y: pt(event.clientY) }) }}>
                  <span className="sv-scene-key" role="cell">
                    {on
                      ? <Btn variant="solid" size="s" disabled={Boolean(busy)} onClick={() => end(scene, key)}>{t('scenes.end')}</Btn>
                      : <Btn variant="line" size="s" disabled={Boolean(busy)} onClick={() => run(scene, key)}>{t('scenes.apply')}</Btn>}
                  </span>
                  <span className="sv-scene-glyph" role="cell"><G.Clapper size={18} /></span>
                  <strong className="sv-scene-name" role="cell">{sceneName(t, scene)}</strong>
                  <span className="sv-scene-sub" role="cell">{busy === key || busy === `end:${key}` ? <MarqueeText>{t(busy === key ? 'scenes.applying' : 'scenes.ending')}</MarqueeText> : <SceneSummary scene={scene} />}</span>
                  <span className="sv-alarm-tools" role="cell">
                    {on && <SceneTimeLeft on={active[key]} className="sv-scene-time" Glyph={G.Infinity} />}
                    <Btn variant="line" size="s" disabled={Boolean(busy)} onClick={() => open(scene)}>{t('scenes.edit')}</Btn>
                    <Btn variant="line" size="s" disabled={Boolean(busy)} onClick={() => setConfirm(scene)}>{t('scenes.delete')}</Btn>
                  </span>
                </div>
              )
            })}
            </MarqueeProvider>
          </div>
        )}
      </section>
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={sceneName(t, menu.scene)}>
          <MenuItem icon={<G.Edit size={12} />} onSelect={() => { const s = menu.scene; setMenu(null); open(s) }}>{t('scenes.edit')}</MenuItem>
          <MenuItem icon={<G.Trash size={12} />} danger onSelect={() => { const s = menu.scene; setMenu(null); setConfirm(s) }}>{t('scenes.delete')}</MenuItem>
        </Menu>
      )}
      {editing && (
        <Window kind="full" title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close} className="sv-scene-editor">
          <WindowBar title={editing.scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')} onClose={close}>
            <Btn variant="solid" size="s" type="submit" form="sv-scene-form" disabled={busy === 'save'}>{t('common.save')}</Btn>
          </WindowBar>
          <div className="sv-window-body">
            <SceneEditorPanel heading={false} ToneGlyph={G.Gear} formId="sv-scene-form" Select={Select} Slider={SceneBar} menuClass="sv-select" scene={editing.scene} households={households} busy={busy === 'save' || busy === 'try'} tried={tried}
                              onCancel={close} onSave={save} onTry={tryIt} onEnd={endTry} />
          </div>
        </Window>
      )}
      {confirm && (
        <Confirm title={t('scenes.deleteTitle')} body={t('scenes.deleteBody', { name: confirm.name })}
                 action={t('scenes.delete')} danger icon={<G.Clapper size={48} />} onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
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
