import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { clockText, sceneSecondsLeft } from '../lib/scenes.js'
import * as Icon from './Icons.jsx'
import './scene.css'

// How long a scene that is on will play, for its row or card: Material
// Design Icons' infinity for one that plays until it is ended, or the time
// left, counting down by the second, for one that ends on its own (every
// group with a play duration). Nothing for a scene that is off. `on` is the
// scene's entry in the list's `active`; `Glyph` is a theme's own infinity,
// where it draws one.
export default function SceneTimeLeft({ on, className = '', Glyph = Icon.Infinity }) {
  const { t } = useI18n()
  const ends = on?.ends
  const [, tick] = useState(0)
  useEffect(() => {
    if (!ends) return undefined
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [ends])
  if (!on) return null
  if (!ends) {
    const label = t('scenes.endless')
    return <span className={`scene-time ${className}`.trim()} data-endless="" role="img" aria-label={label} title={label}><Glyph aria-hidden="true" /></span>
  }
  const left = clockText(sceneSecondsLeft(ends))
  return <span className={`scene-time ${className}`.trim()} data-countdown="" title={t('scenes.timeLeft', { time: left })}>{left}</span>
}
