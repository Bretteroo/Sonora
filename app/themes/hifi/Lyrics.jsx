import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { lyricsSong, useLyrics, useLyricsLine, useLyricsOpen } from '../../frontend/src/lib/lyrics.js'
import { Panel, PanelHead, Button } from './controls.jsx'

// Lyrics on the amplifier's display, the way a CD player shows its disc's
// text or a tuner its station's: the line being sung where the title stands,
// in the display's large lettering, and the two lines after it dim beneath. The
// Lyrics key beside Sleep, Info and Link switches the display between its
// usual reading and this. Three lines are all it holds, so words with no
// timings that fit this recording are not shown there; the display says so.

/** Whether the display shows lyrics, and the key's state, for the zone in view. */
export function useDisplayLyrics(zone) {
  // The display's lines fade by themselves (hifi.css), so no view transition.
  const [open, toggle] = useLyricsOpen({ transition: false })
  const available = Boolean(lyricsSong(zone?.transport))
  return { open: open && available, available, toggle }
}

// The three lines the display prints in place of the title and what follows it.
// `onCancel` turns lyrics off, from the one-time notice. `waiting` is what the
// display reads while the lookup runs: the song's own title, so that turning
// lyrics on changes the display once, when the words arrive. A title faded to
// "Looking for lyrics", swapped for the words a moment later and then faded
// up again flickered two or three times; the note shows only when the
// answer is slow.
const SLOW_MS = 1500
export function LyricsReading({ transport, onCancel, waiting = null }) {
  const { t } = useI18n()
  const lyrics = useLyrics(transport, true)
  const [slow, setSlow] = useState(false)
  const loading = lyrics.state === 'loading'
  useEffect(() => {
    setSlow(false)
    if (!loading) return undefined
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [loading])
  if (lyrics.state === 'timed') return <Timed transport={transport} lines={lyrics.lines} />
  if (loading && !slow && waiting) return waiting
  const note = {
    // The notice itself is a panel (Notice); the display waits for it.
    notice: t('lyrics.show'),
    loading: t('lyrics.loading'),
    plain: t('lyrics.untimed'),
    none: t('lyrics.none'),
    instrumental: t('lyrics.instrumental'),
    error: t('lyrics.error'),
  }[lyrics.state] || ''
  return (
    <div className="hf-vfd-lines hf-vfd-lyrics">
      <p className="hf-vfd-title hf-vfd-lyric-note" title={note}>{note}</p>
      <p className="hf-vfd-sub" />
      {lyrics.state === 'notice' && <Notice onAgree={lyrics.agree} onClose={onCancel} />}
    </div>
  )
}

function Timed({ transport, lines }) {
  const index = useLyricsLine(transport, lines)
  // Before the first line the display waits with the opening line dim.
  const now = index >= 0 ? lines[index][1] || '♪' : ''
  const after = [1, 2].map((n) => (lines[index + n] ? lines[index + n][1] || '♪' : ''))
  // A line too long for the display runs on to a second line, and the last
  // of the lines after it gives up its place, so the display keeps its height.
  const current = useRef(null)
  const [wrapped, setWrapped] = useState(false)
  useLayoutEffect(() => {
    const el = current.current
    if (!el) return undefined
    const measure = () => {
      const height = parseFloat(getComputedStyle(el).lineHeight) || 0
      setWrapped(height > 0 && el.scrollHeight > height * 1.5)
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [now])
  return (
    <div className="hf-vfd-lines hf-vfd-lyrics">
      {/* Keyed by the line, so each new one comes up on the display rather
          than being swapped in place. */}
      <p key={`now-${index}`} ref={current} className="hf-vfd-title hf-vfd-lyric" title={now}>{now || '♪'}</p>
      {(wrapped ? after.slice(0, 1) : after).map((words, n) => (
        <p key={`next-${index}-${n}`} className="hf-vfd-sub hf-vfd-lyric-next" title={words}>{words}</p>
      ))}
    </div>
  )
}

// LRCLIB's credit, its name a link to the site, printed on the metal under
// the display's lower right corner while lyrics are on: the display itself
// has no line to spare. It fades in and out with them.
export function LyricsCredit({ shown }) {
  const { t } = useI18n()
  const text = t('lyrics.credit')
  const at = text.indexOf('LRCLIB')
  return (
    <p className="hf-legend hf-lyrics-credit" data-shown={shown || undefined} aria-hidden={!shown || undefined}>
      {at < 0 ? text : <>{text.slice(0, at)}<a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer" tabIndex={shown ? undefined : -1}>LRCLIB</a>{text.slice(at + 6)}</>}
    </p>
  )
}

// The first time lyrics are asked for: what a lookup sends to LRCLIB, as a
// panel, since the display has no room for it. Closing it turns lyrics off.
function Notice({ onAgree, onClose }) {
  const { t } = useI18n()
  return (
    <Panel kind="center" title={t('lyrics.show')} onClose={onClose} className="hf-confirm">
      <PanelHead title={t('lyrics.show')} onClose={onClose} />
      <div className="hf-panel-body"><p className="hf-confirm-body">{t('lyrics.notice')}</p></div>
      <footer className="hf-panel-foot">
        <Button quiet onClick={onClose}>{t('common.cancel')}</Button>
        <Button primary data-autofocus onClick={onAgree}>{t('lyrics.agree')}</Button>
      </footer>
    </Panel>
  )
}
