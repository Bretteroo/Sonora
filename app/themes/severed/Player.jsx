import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { MarqueeProvider, MarqueeText } from '../../frontend/src/lib/marquee.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { formatDuration } from '../../frontend/src/lib/format.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import { useSleepTimers, clockText } from '../../frontend/src/lib/useSleepTimer.js'
import Art, { nowPlayingArt, cachedArt } from '../../frontend/src/components/Art.jsx'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'
import { useSeekDrag } from '../../frontend/src/lib/useSeekDrag.js'
import { isConnectSession } from '../../frontend/src/lib/transport.js'
import { lyricsSong } from '../../frontend/src/lib/lyrics.js'
import * as G from './glyphs.jsx'
import { Btn, IconBtn, Bar, Seg, cx } from './kit.jsx'
import { isLoaded, nowSummary, nowLines, useProviderMetadata, groupTitle, readStored, writeStored } from './house.js'
import Lyrics from './Lyrics.jsx'

// The Player program: what the room in view is playing, as the screen of a
// terminal would print it. The cover (or the words, when Lyrics is on) at the
// left; the lines beside it run out to their values along a row of dots;
// the progress is a bar of block characters you can seek on; the transport,
// the play modes and the room's own actions sit under it as bracketed
// buttons. Below, what plays next and the mixer -- each room of the group
// at its own level -- side by side.

export function hms(seconds) {
  const total = Math.floor(seconds)
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
function withShuffle(mode) {
  if (mode.includes('REPEAT_ONE')) return 'SHUFFLE_REPEAT_ONE'
  if (mode.includes('REPEAT_ALL')) return 'SHUFFLE'
  return 'SHUFFLE_NOREPEAT'
}
function withoutShuffle(mode) {
  if (mode === 'SHUFFLE_REPEAT_ONE') return 'REPEAT_ONE'
  if (mode === 'SHUFFLE') return 'REPEAT_ALL'
  return 'NORMAL'
}

// Shuffle, repeat and crossfade for a room: what each is now, whether the
// speaker will take it, and the press that changes it. The console's MODE
// keys and the Player's buttons both read it.
export function useModes(zone) {
  const { actions } = useSystem()
  const tr = zone?.transport || {}
  const mode = tr.play_mode ?? 'NORMAL'
  const shuffled = mode.startsWith('SHUFFLE')
  const repeat = mode.includes('REPEAT_ONE') ? 'one' : mode.includes('REPEAT_ALL') || mode === 'SHUFFLE' ? 'all' : 'off'
  // Shuffle and Repeat go where the speaker says it takes them; before it has said, a queue.
  const canShuffle = Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_shuffle : tr.source === 'queue')
  const canRepeat = Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_repeat : tr.source === 'queue')
  const canCrossfade = Boolean(zone) && (typeof tr.can_crossfade === 'boolean' ? tr.can_crossfade
    : !['idle', 'tv', 'line_in', 'radio', 'service_stream', 'service_hls', 'grouped', 'unknown'].includes(tr.source))
  return {
    shuffled, repeat, crossfade: Boolean(tr.crossfade), canShuffle, canRepeat, canCrossfade,
    toggleShuffle: () => zone && actions.setPlayMode(zone.uuid, shuffled ? withoutShuffle(mode) : withShuffle(mode)),
    cycleRepeat: () => {
      if (!zone) return
      const base = repeat === 'off' ? 'REPEAT_ALL' : repeat === 'all' ? 'REPEAT_ONE' : 'NORMAL'
      actions.setPlayMode(zone.uuid, shuffled ? withShuffle(base) : base)
    },
    toggleCrossfade: () => zone && actions.setCrossfade(zone.uuid, !tr.crossfade),
  }
}

// How far into the track, as a whole percent, for the screen's heading.
export function useProgress(zone) {
  const tr = zone?.transport || {}
  const { elapsed, duration, live } = useElapsed(tr)
  if (!duration || live) return null
  return Math.max(0, Math.min(100, Math.floor((elapsed / duration) * 100)))
}

// The progress bar, which also seeks. Inert where the track refuses Seek; a live stream shows
// "Live" and a full bar while it plays.
export function Seek({ zone, remaining = false, compact = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { elapsed, duration, live } = useElapsed(tr)
  const seekable = Boolean(duration) && !live && tr.can_seek !== false && tr.state !== 'STOPPED'
  const { drag, inputProps } = useSeekDrag(zone?.uuid, (at) => actions.seek(zone.uuid, hms(at)), elapsed)
  const shown = drag ?? elapsed
  const pct = duration ? Math.max(0, Math.min(100, (shown / duration) * 100)) : (live && tr.state === 'PLAYING' ? 100 : 0)
  return (
    <div className={cx('sv-seek', compact && 'sv-seek-compact')} data-seekable={seekable || undefined} data-playing={tr.state === 'PLAYING' || undefined}
         style={{ '--sv-pct': pct }}>
      <time className="sv-seek-time">{duration ? formatDuration(shown) : (live && isLoaded(tr) ? t('common.live') : '--:--')}</time>
      <span className="sv-seek-track">
        <span className="sv-seek-done" aria-hidden="true" />
        <input type="range" min={0} max={duration || 1} value={Math.min(shown, duration || 1)} disabled={!seekable} aria-label={t('common.seek')} {...inputProps} />
      </span>
      <time className="sv-seek-time sv-seek-end">{duration ? (remaining ? `-${formatDuration(Math.max(0, duration - shown))}` : formatDuration(duration)) : '--:--'}</time>
    </div>
  )
}

// Every room of the group at its own level, and the group's above them.
export function Volumes({ zone, group, zones }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  if (!zone) return null
  const members = (group?.members || [zone.uuid]).map((u) => zones[u]).filter(Boolean)
  const glyph = (level, muted) => (muted ? <G.Muted size={24} /> : level < 40 ? <G.VolumeLow size={24} /> : <G.Volume size={24} />)
  return (
    <div className="sv-mixer">
      {members.length > 1 && (
        <div className="sv-mixer-row sv-mixer-group">
          <IconBtn label={zone.group_muted ? t('common.unmute') : t('common.mute')} selected={zone.group_muted}
                   onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}>{glyph(zone.group_volume ?? 0, zone.group_muted)}</IconBtn>
          <span className="sv-mixer-name">{t('sv.mixerGroup')}</span>
          <Bar wheelStep={2} value={zone.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(zone.uuid, level)} />
        </div>
      )}
      {members.map((m) => (
        <div key={m.uuid} className="sv-mixer-row" data-offline={m.online === false || undefined}>
          <IconBtn label={m.muted ? t('common.unmute') : t('common.mute')} selected={m.muted}
                   onClick={() => actions.setMute(m.uuid, !m.muted)}>{glyph(m.volume ?? 0, m.muted)}</IconBtn>
          <span className="sv-mixer-name">{m.name}</span>
          <Bar wheelStep={2} value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
        </div>
      ))}
    </div>
  )
}

// A service's rating glyph sits small in the middle of a larger image (AccuRadio's star is 16px
// of a 40x32 PNG). Where the glyph's ink lies is read once per image, and the stencil is scaled
// so that ink fills the button. The image's own opacity is kept: a service may tell selected
// from not by it alone.
const GLYPH_BOXES = new Map()
function useGlyphBox(url) {
  const [box, setBox] = useState(() => GLYPH_BOXES.get(url) || null)
  useEffect(() => {
    if (!url || GLYPH_BOXES.has(url)) { setBox(GLYPH_BOXES.get(url) || null); return undefined }
    let live = true
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const g = c.getContext('2d'); g.drawImage(img, 0, 0)
        const { data } = g.getImageData(0, 0, c.width, c.height)
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
        for (let y = 0; y < c.height; y += 1) {
          for (let x = 0; x < c.width; x += 1) {
            if (data[(y * c.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
          }
        }
        const found = x1 < 0 ? null : { w: c.width, h: c.height, x0, y0, iw: x1 - x0 + 1, ih: y1 - y0 + 1 }
        GLYPH_BOXES.set(url, found)
        if (live) setBox(found)
      } catch { GLYPH_BOXES.set(url, null) }
    }
    img.src = url
    return () => { live = false }
  }, [url])
  return box
}
export function RatingGlyph({ icon, size = 22 }) {
  const url = cachedArt(icon)
  const box = useGlyphBox(url)
  const style = { '--sv-rating-icon': `url("${url}")` }
  if (box) {
    const k = size / Math.max(box.iw, box.ih)
    style['--sv-rating-size'] = `${box.w * k}px ${box.h * k}px`
    style['--sv-rating-pos'] = `${size / 2 - (box.x0 + box.iw / 2) * k}px ${size / 2 - (box.y0 + box.ih / 2) * k}px`
  }
  return <span className="sv-rating-img" aria-hidden="true" style={style} />
}

// What plays next: the coming rows of the queue, a press playing one.
function UpNext({ zone, queue, onQueue }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  if (isConnectSession(tr)) {
    return (
      <p className="sv-dim">{tr.next_title ? [tr.next_title, tr.next_artist].filter(Boolean).join(' · ') : t('desk.queue.notInUse')}</p>
    )
  }
  const inUse = tr.source === 'queue' || tr.source === 'external_session'
  const start = inUse ? (tr.track_number || 0) : 0
  const rows = queue.items.slice(start, start + 6)
  if (!queue.items.length) return <p className="sv-dim">{t('common.queueIsEmpty')}</p>
  return (
    <ol className="sv-upnext" start={start + 1}>
      {rows.map((item, i) => {
        const n = start + i + 1
        return (
          <li key={`${item.id}-${n}`}>
            <button type="button" onClick={async () => { await actions.seekTrack(zone.uuid, n); if (tr.state !== 'PLAYING') actions.play(zone.uuid) }}>
              <span className="sv-upnext-n">{String(n).padStart(3, '0')}</span>
              <span className="sv-upnext-title">{item.title}</span>
              <span className="sv-upnext-sub">{item.artist || ''}</span>
            </button>
          </li>
        )
      })}
      <li className="sv-upnext-more"><Btn variant="text" size="s" trailing={<G.Chevron size={12} />} onClick={onQueue}>{t('sv.fullQueue')}</Btn></li>
    </ol>
  )
}

// `keys` says which of the screen's controls the console has keys for; those stay off the
// screen, so nothing is offered twice.
export function PlayerProgram({ zone, group, zones, queue, compact, lyrics, keys = {}, onInfo, onMessage, onGroup, onSleep, sleepOn, onQueue, onRoomSettings }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { provider, refresh } = useProviderMetadata(zone)
  const lines = nowLines(tr, provider, t)
  const loaded = isLoaded(tr)
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr, { best: true, zone: zone.uuid }) : ''
  const nextTrack = isConnectSession(tr) ? (tr.next_title ? { title: tr.next_title, artist: tr.next_artist } : null)
    : tr.source === 'queue' ? queue.items[(tr.track_number || 0)] : null
  const [lyricsOpen, toggleLyrics] = lyrics
  const hasLyrics = Boolean(lyricsSong(tr))
  const showLyrics = lyricsOpen && hasLyrics
  const modes = useModes(zone)
  const [panel, setPanel] = useState(() => readStored('sonora.sv.playerPanel', 'next'))
  const choosePanel = (id) => { setPanel(id); writeStored('sonora.sv.playerPanel', id) }

  // Ratings: the service's own buttons from its presentation map.
  const serviceRatings = (provider?.ratings || []).filter((b) => b.icon)
  const ratedItem = tr.item_id || (() => {
    const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(tr.track_uri || '')
    try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  })()
  const rateById = async (button) => {
    // A lit button the service gives no way back from does nothing (see rating_is_inert in
    // backend/main.py: AccuRadio's loved star).
    if (button.inert) return
    const item = provider?.item_id || ratedItem
    if (!item) return
    const result = await actions.rateItemById(zone.uuid, tr.service_id, item, button.id)
    if (result?.ok) { onMessage?.(result.message || button.message || ''); refresh() }
    return result?.ok
  }
  const { ratings: shownRatings, press: pressRating } = useOptimisticRatings(serviceRatings, `${zone?.uuid}|${tr.track_uri || ''}`)

  if (!zone) return <div className="sv-player-none"><p className="sv-title">{t('desk.browse.selectRoom')}</p></div>
  // A room can hold a source and still have nothing to say about it (a Spotify Connect address
  // kept after the session ended): it then reads as a room with no music.
  const shown = loaded && lines.length > 0
  const [title, ...rest] = shown ? lines : [[t('desk.now.noMusic'), t('desk.now.noMusic')]]
  const source = tr.service_name || (tr.source ? t(`source.${tr.source}`) : '')
  const many = (group?.members?.length || 1) > 1
  return (
    <div className={cx('sv-player', compact && 'sv-player-compact')} data-playing={playing || undefined}>
      <div className="sv-player-art" data-lyrics={showLyrics || undefined}>
        {showLyrics ? <Lyrics transport={tr} onClose={toggleLyrics} />
          : tr.source === 'tv' ? <span className="sv-player-tv"><G.Tv size={96} /></span>
          : <span className="sv-art sv-art-big"><Art src={art} size={compact ? 260 : 360} fallback="note" brokenFallback="note" /></span>}
      </div>
      <div className="sv-player-text">
        {shown && <p className="sv-over">{title[0]}</p>}
        <h1 className="sv-player-title">
          {title[1]}
          {loaded && tr.explicit === true && <G.Explicit size={24} className="sv-explicit" role="img" aria-label={t('common.explicit')} />}
        </h1>
        {/* a line too long for its leader scrolls, one at a time (lib/marquee.jsx) */}
        <MarqueeProvider enabled style="sonora">
          <dl className="sv-leaders">
            {rest.map(([caption, value]) => (
              <div key={caption}><dt>{caption}</dt><dd><MarqueeText>{value}</MarqueeText></dd></div>
            ))}
            {nextTrack && <div><dt>{t('desk.now.next')}</dt><dd><MarqueeText>{[nextTrack.title, nextTrack.artist].filter(Boolean).join(' · ')}</MarqueeText></dd></div>}
            {source && <div><dt>{t('sv.source')}</dt><dd>{source}</dd></div>}
            <div><dt>{t('sv.room')}</dt><dd>{groupTitle(group, zones, t)}</dd></div>
          </dl>
        </MarqueeProvider>
        {loaded && serviceRatings.length > 0 && (
          <div className="sv-player-ratings">
            {shownRatings.map((button) => (
              <IconBtn key={button.id} aria-disabled={button.inert || undefined} onClick={() => pressRating(button, rateById)}
                       label={button.inert ? t('rating.cannotUndo', { service: tr.service_name || '' }) : (button.label || '')}>
                <RatingGlyph icon={button.icon} />
              </IconBtn>
            ))}
          </div>
        )}
      </div>
      <div className="sv-player-seek"><Seek zone={zone} /></div>
      <div className="sv-player-buttons">
        {!keys.modes && (
          <div className="sv-btnrow sv-btnrow-modes" role="group" aria-label={t('sv.playModes')}>
          {modes.canShuffle && <Btn size="s" icon={<G.Shuffle size={12} />} selected={modes.shuffled} onClick={modes.toggleShuffle}>{t('common.shuffle')}</Btn>}
          {modes.canRepeat && (
            <Btn size="s" icon={modes.repeat === 'one' ? <G.RepeatOne size={12} /> : <G.Repeat size={12} />} selected={modes.repeat !== 'off'} onClick={modes.cycleRepeat}
                 title={modes.repeat === 'one' ? t('desk.transport.repeatOne') : modes.repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}>
              {modes.repeat === 'one' ? t('desk.transport.repeatOne') : t('common.repeat')}
            </Btn>
          )}
          {modes.canCrossfade && <Btn size="s" icon={<G.Crossfade size={12} />} selected={modes.crossfade} onClick={modes.toggleCrossfade}>{t('desk.transport.crossfade')}</Btn>}
          {hasLyrics && <Btn size="s" icon={<G.Lyrics size={12} />} selected={showLyrics} onClick={toggleLyrics}>{t('lyrics.show')}</Btn>}
          </div>
        )}
        <div className="sv-btnrow sv-btnrow-room" role="group" aria-label={groupTitle(group, zones, t)}>
          {!keys.sleep && <Btn size="s" icon={<G.Moon size={12} />} selected={sleepOn} onClick={onSleep}>{t('desk.browse.sleepTimer')}</Btn>}
          {!keys.group && !group?.local && <Btn size="s" icon={<G.Group size={12} />} onClick={onGroup}>{many ? t('sv.editGroup') : t('sv.addRooms')}</Btn>}
          {!keys.sound && !zone.local && <Btn size="s" icon={<G.Settings size={12} />} onClick={() => onRoomSettings(zone.uuid)}>{t('sv.soundAndRoom')}</Btn>}
          {!keys.info && loaded && (tr.source === 'queue' || tr.service_id) && <Btn size="s" icon={<G.Info size={12} />} onClick={onInfo}>{t('desk.now.infoOptions')}</Btn>}
        </div>
      </div>
      <section className="sv-player-panels" aria-label={t('sv.upNextAndMixer')}>
        {compact && (
          <Seg label={t('sv.upNextAndMixer')} value={panel} onChange={choosePanel}
               options={[{ id: 'next', label: t('sv.upNext') }, { id: 'mixer', label: t('sv.mixer') }]} />
        )}
        {(!compact || panel === 'next') && (
          <div className="sv-panel">
            {!compact && <h2 className="sv-rule-head">{t('sv.upNext')}</h2>}
            <UpNext zone={zone} queue={queue} onQueue={onQueue} />
          </div>
        )}
        {(!compact || panel === 'mixer') && (
          <div className="sv-panel">
            {!compact && <h2 className="sv-rule-head">{t('sv.mixer')}</h2>}
            <Volumes zone={zone} group={group} zones={zones} />
          </div>
        )}
      </section>
    </div>
  )
}

// The display on the console: the room, what plays scrolling past, and the time.
export function NowLcd({ zone, group, zones }) {
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const summary = nowSummary(tr, t)
  const { elapsed, duration, live } = useElapsed(tr)
  const text = zone ? ([summary.title, summary.sub].filter(Boolean).join('  ·  ') || t('desk.now.noMusic')) : t('desk.browse.selectRoom')
  const state = !zone ? '' : tr.state === 'PLAYING' ? '>' : tr.state === 'PAUSED_PLAYBACK' ? '||' : tr.state === 'TRANSITIONING' ? '..' : '[]'
  // A sleep timer set on the room counts down between the times, a second at a time, from the
  // same timers the clock page reads.
  const { timers } = useSleepTimers()
  const sleepLeft = (zone && timers.find((row) => row.zone === zone.uuid)?.seconds) || 0
  return (
    <div className="sv-lcd-now">
      <div className="sv-lcd-row">
        <span className="sv-lcd-room">{zone ? groupTitle(group, zones, t) : ''}</span>
        <span className="sv-lcd-state">{state}</span>
      </div>
      {/* A long reading scrolls a character at a time, as an LCD's does: the text and its gap
          (3em, six characters of this face) in that many steps, four a second. */}
      <div className="sv-lcd-marquee" data-long={text.length > 22 || undefined} style={{ '--sv-marquee-n': text.length + 6 }}>
        <span>{text}</span>{text.length > 22 && <span aria-hidden="true">{text}</span>}
      </div>
      <div className="sv-lcd-row">
        <span>{duration && !live ? formatDuration(elapsed) : live && isLoaded(tr) ? t('common.live') : '--:--'}</span>
        {sleepLeft > 0 && (
          <span className="sv-lcd-sleep" title={t('desk.browse.sleepTimer')}><G.LcdClock size={10} />{clockText(sleepLeft)}</span>
        )}
        <span>{duration && !live ? formatDuration(duration) : ''}</span>
      </div>
    </div>
  )
}
