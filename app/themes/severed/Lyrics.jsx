import React, { useRef } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useFollowLine, useLyrics, useLyricsLine } from '../../frontend/src/lib/lyrics.js'
import * as G from './glyphs.jsx'

// The words, in the Player's cover's place: the line being sung in inverse
// video and held in the middle, the ones sung dimmed, the ones to come at
// full strength. A hand on them holds them still for a moment. Words with no
// timings that fit this recording are printed whole. A bar over them turns
// them off again, so the switch is never out of reach below them.
export default function Lyrics({ transport, onClose }) {
  const { t } = useI18n()
  const lyrics = useLyrics(transport, true)
  const note = {
    loading: t('lyrics.loading'),
    none: t('lyrics.none'),
    instrumental: t('lyrics.instrumental'),
    error: t('lyrics.error'),
  }[lyrics.state]
  return (
    <div className="sv-lyrics" aria-label={t('lyrics.show')} role="region">
      <div className="sv-lyrics-bar">
        <span>{t('lyrics.show')}</span>
        {onClose && (
          <button type="button" className="sv-lyrics-close" onClick={onClose} aria-label={`${t('common.close')} ${t('lyrics.show')}`}>
            <G.Close size={12} />
          </button>
        )}
      </div>
      {lyrics.state === 'notice' ? (
        // Before the first lookup: what goes to LRCLIB, and the reader's go-ahead.
        <div className="sv-lyrics-notice">
          <p>{t('lyrics.notice')}</p>
          <button type="button" className="sv-btn sv-btn-solid sv-btn-m" onClick={lyrics.agree}><span className="sv-btn-label">{t('lyrics.agree')}</span></button>
        </div>
      ) : lyrics.state === 'timed' ? <Timed key={transport.track_uri || ''} transport={transport} lines={lyrics.lines} />
        : lyrics.state === 'plain' ? (
          <div className="sv-lyrics-scroll" tabIndex={0}>
            <p className="sv-lyrics-untimed">{t('lyrics.untimed')}</p>
            {lyrics.text.split('\n').map((words, i) => <p key={i} className="sv-lyrics-plain">{words || ' '}</p>)}
          </div>
        ) : <p className="sv-lyrics-note">{note}</p>}
      {(lyrics.state === 'timed' || lyrics.state === 'plain') && <p className="sv-lyrics-credit"><Credit text={t('lyrics.credit')} /></p>}
    </div>
  )
}

function Timed({ transport, lines }) {
  const index = useLyricsLine(transport, lines)
  const box = useRef(null)
  useFollowLine(box, index)
  return (
    <div className="sv-lyrics-scroll sv-lyrics-timed" ref={box} tabIndex={0}>
      {lines.map(([, words], i) => (
        <p key={i} data-line={i} data-at={i === index ? 'now' : i < index ? 'past' : undefined}>
          {/* An empty line is a break in the singing. */}
          {words || '♪'}
        </p>
      ))}
    </div>
  )
}

// The credit line, its LRCLIB a link to the site. Every translation keeps the name as is, so
// the link is cut out of whatever the sentence around it says.
function Credit({ text }) {
  const at = text.indexOf('LRCLIB')
  if (at < 0) return text
  return <>{text.slice(0, at)}<a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a>{text.slice(at + 6)}</>
}
