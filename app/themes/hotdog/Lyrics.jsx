import React, { useRef } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useFollowLine, useLyrics, useLyricsLine } from '../../frontend/src/lib/lyrics.js'

// The lyrics, in the queue's place under Now Playing: the line being sung lit
// and held third from the top, the ones sung dimmed, a hand on them holding them
// still for a moment. Words with no timings that fit this recording are shown
// whole.
export default function Lyrics({ transport }) {
  const { t } = useI18n()
  const lyrics = useLyrics(transport, true)
  const note = {
    loading: t('lyrics.loading'),
    none: t('lyrics.none'),
    instrumental: t('lyrics.instrumental'),
    error: t('lyrics.error'),
  }[lyrics.state]
  return (
    <div className="dk-lyrics" aria-label={t('lyrics.show')} role="region">
      {lyrics.state === 'notice' ? (
        // Before the first lookup: what goes to LRCLIB, and the reader's go-ahead.
        <div className="dk-lyrics-notice">
          <p>{t('lyrics.notice')}</p>
          <button type="button" className="dk-lyrics-agree" onClick={lyrics.agree}>{t('lyrics.agree')}</button>
        </div>
      ) : lyrics.state === 'timed' ? <Timed key={transport.track_uri || ''} transport={transport} lines={lyrics.lines} />
        : lyrics.state === 'plain' ? (
          <div className="dk-lyrics-scroll" tabIndex={0}>
            <p className="dk-lyrics-untimed">{t('lyrics.untimed')}</p>
            {lyrics.text.split('\n').map((words, i) => <p key={i} className="dk-lyrics-plain">{words || ' '}</p>)}
          </div>
        ) : <p className="dk-lyrics-note">{note}</p>}
    </div>
  )
}

function Timed({ transport, lines }) {
  const index = useLyricsLine(transport, lines)
  const box = useRef(null)
  // The line being sung is held third from the top, two sung lines above it.
  useFollowLine(box, index, { lead: 2 })
  return (
    <div className="dk-lyrics-scroll dk-lyrics-timed" ref={box} tabIndex={0}>
      {lines.map(([, words], i) => (
        <p key={i} data-line={i} data-at={i === index ? 'now' : i < index ? 'past' : undefined}>
          {/* An empty line is a break in the singing. */}
          {words || '♪'}
        </p>
      ))}
    </div>
  )
}

// A speech bubble with lines of words in it.
export function LyricsGlyph(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" {...props}>
      <path d="M2 2.5h12v8.5H6.5L3.5 13.5V11H2z" strokeLinejoin="miter" />
      <path d="M4.5 5.5h7M4.5 8h5" />
    </svg>
  )
}

// LRCLIB's credit, its name a link to the site. Every translation keeps the
// name as is, so the link is cut out of whatever the words around it say.
// Hot Dog Stand gives it in the pane's header, as the queue gives "(Not in Use)".
export function Credit({ text }) {
  const at = text.indexOf('LRCLIB')
  if (at < 0) return text
  return <>{text.slice(0, at)}<a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a>{text.slice(at + 6)}</>
}
