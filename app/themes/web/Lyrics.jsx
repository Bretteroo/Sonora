import React, { useRef } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useFollowLine, useLyrics, useLyricsLine } from '../../frontend/src/lib/lyrics.js'

// The lyrics, in the big player's art box: the line being sung lit and held
// in the middle, the ones sung dimmed, a hand on them holding them still for
// a moment. Words with no timings that fit this recording are shown whole.
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
    <div className="wb-lyrics" aria-label={t('lyrics.show')} role="region">
      {lyrics.state === 'notice' ? (
        // Before the first lookup: what goes to LRCLIB, and the reader's go-ahead.
        <div className="wb-lyrics-notice">
          <p>{t('lyrics.notice')}</p>
          <button type="button" className="wb-lyrics-agree" onClick={lyrics.agree}>{t('lyrics.agree')}</button>
        </div>
      ) : lyrics.state === 'timed' ? <Timed key={transport.track_uri || ''} transport={transport} lines={lyrics.lines} />
        : lyrics.state === 'plain' ? (
          <div className="wb-lyrics-scroll" tabIndex={0}>
            <p className="wb-lyrics-untimed">{t('lyrics.untimed')}</p>
            {lyrics.text.split('\n').map((words, i) => <p key={i} className="wb-lyrics-plain">{words || ' '}</p>)}
          </div>
        ) : <p className="wb-lyrics-note">{note}</p>}
      {(lyrics.state === 'timed' || lyrics.state === 'plain') && <p className="wb-lyrics-credit"><Credit text={t('lyrics.credit')} /></p>}
    </div>
  )
}

function Timed({ transport, lines }) {
  const index = useLyricsLine(transport, lines)
  const box = useRef(null)
  useFollowLine(box, index)
  return (
    <div className="wb-lyrics-scroll wb-lyrics-timed" ref={box} tabIndex={0}>
      {lines.map(([, words], i) => (
        <p key={i} data-line={i} data-at={i === index ? 'now' : i < index ? 'past' : undefined}>
          {/* An empty line is a break in the singing. */}
          {words || '♪'}
        </p>
      ))}
    </div>
  )
}

// The credit line, its LRCLIB a link to the site. Every translation keeps the
// name as is, so the link is cut out of whatever the sentence around it says.
function Credit({ text }) {
  const at = text.indexOf('LRCLIB')
  if (at < 0) return text
  return <>{text.slice(0, at)}<a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a>{text.slice(at + 6)}</>
}
