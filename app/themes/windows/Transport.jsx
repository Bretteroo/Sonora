import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { canPause, isFixedSource, isLoaded } from '../../frontend/src/lib/transport.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import { formatDuration, orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Slider from './Slider.jsx'
import { readRecentSearches, addRecentSearch, clearRecentSearches } from '../../frontend/src/lib/recentSearches.js'
import { withoutBrowserRoom } from '../../frontend/src/lib/browserRoom.js'

// The 80px strip across the top of the window. From the application's
// transport view: a "Group Volume" caption at (9,5) over a mute button at
// (11,24) and a 172px slider at (57,30); five buttons in a 242px cluster
// centered on the window; a 448x22 progress row along the bottom; a 212x25
// search field 12px from the right edge.

export default function Transport({ zone, group, query, onQuery, searchRef, scope = null, scopes = [], onScope, remainingTime = false, onEq,
  icons = null,
                                   households = [], systemFilter, onSystem }) {
  const { actions, zones } = useSystem()
  // The group volume popover: one row per room, opened from the caption.
  const [groupOpen, setGroupOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [recent, setRecent] = useState(readRecentSearches)
  // The EQ glyph asks which room of a group to open, as the app does.
  const [eqMenu, setEqMenu] = useState(null)
  useEffect(() => { setGroupOpen(false) }, [group?.coordinator])
  const { t } = useI18n()
  // A theme may bring its own transport glyphs (the Windows theme redraws the app's).
  const G = icons ? { ...Icon, ...icons } : Icon
  const transport = zone?.transport ?? {}
  // TRANSITIONING is the player buffering: the app keeps the pause
  // glyph up through it rather than flipping back to play, which is
  // what Sonora was doing after a seek.
  const playing = transport.state === 'PLAYING' || transport.state === 'TRANSITIONING'
  // Observed in the Windows app (2026-09-05): a stopped room dims the skip
  // buttons even with an 11-track queue, and its position bar has no thumb.
  const stopped = transport.state === 'STOPPED'
  // A stopped station counts: Play starts it again, and the S2 Mac app draws
  // Play live over a stopped Lovers Rock Reggae, skips dimmed (2026-09-29).
  // Sonora grayed Play there.
  const loaded = isLoaded(transport)
  const fixed = isFixedSource(transport)
  // The app's PlayButton shows what the next press does, and for a source that
  // will not pause that is Stop. The speaker answers which is which in its
  // transport actions -- a TuneIn station allows only "Set, Stop, Play" -- so
  // a radio room showed a stop square in the app where Sonora drew pause bars.
  // Every shell reads that same rule now; it lives in
  // lib/transport.js.
  const pausable = canPause(transport)
  // A transport that says it cannot skip means it (the browser room).
  const skippable = loaded && transport.can_skip !== false && !fixed && !transport.is_external_session
  // Either skip glyph is live where the track can be skipped or the position
  // can be moved: the app's IsForwardEnabled is isFastForwardEnabled OR
  // isNextTrackEnabled, and IsBackEnabled mirrors it (TransportViewModel).
  // So a queue on its last track keeps both bright -- it can still be scrubbed
  // -- while a broadcast, which allows none of the four, grays both.
  const movable = transport.can_seek !== false
  const skipBack = skippable && (movable || transport.can_previous !== false)
  const skipForward = skippable && (movable || transport.can_next !== false)
  // The position and the length, counted locally between the speaker's
  // reports; a live broadcast has neither (lib/useElapsed.js).
  const { elapsed, duration, live } = useElapsed(transport)

  const mode = transport.play_mode ?? 'NORMAL'
  const shuffled = mode.startsWith('SHUFFLE')
  const repeat = mode.includes('REPEAT_ONE') ? 'one'
    : mode.includes('REPEAT_ALL') || mode === 'SHUFFLE' ? 'all' : 'off'

  // Some services' tracks refuse Seek by design; the player says so in its
  // transport actions and the app then leaves the bar inert. A click here
  // used to earn a UPnP 701 instead.
  const seekable = Boolean(duration) && transport.can_seek !== false
  // The bar itself goes inert on a stopped track, thumb and all, though the
  // times stay: SCLib reports seek disabled there, and the Windows slider's
  // disabled thumb image is fully transparent. Both apps showed it on a
  // stopped queue track and a stopped Libby chapter (2026-10-03).
  const scrubbable = seekable && !stopped
  const seekBy = (delta) => {
    if (!zone || !seekable) return
    const target = Math.max(0, Math.min(duration, elapsed + delta))
    actions.seek(zone.uuid, hms(target))
  }
  const cycleRepeat = () => {
    const base = repeat === 'off' ? 'REPEAT_ALL' : repeat === 'all' ? 'REPEAT_ONE' : 'NORMAL'
    actions.setPlayMode(zone.uuid, shuffled ? withShuffle(base) : base)
  }
  // Observed in the app (2026-09-05): the header glyph only changes the
  // mode. The speaker then reports the queue in its shuffled order behind
  // the current track; playback is not restarted.
  const toggleShuffle = () => {
    actions.setPlayMode(zone.uuid, shuffled ? withoutShuffle(mode) : withShuffle(mode))
  }

  // The application's own caption, set per state (its setGroupVolumeLabel:
  // follows groupVolumeMode). The Mac build localises exactly one caption for
  // this control, "Group Volume", and shows it only for a group of two or more
  // rooms; a room on its own is captioned with its own name, which is why no
  // per-room string exists in the app's resources.
  const grouped = Boolean(group && group.members.length > 1)
  // Shuffle, repeat and crossfade act on the queue; a station, stream or
  // input has nothing for them to do, so the glyphs stay but are dimmed.
  // Shuffle and Repeat go where the speaker says it takes them;
  // before it has said, a queue.
  const modes = Boolean(zone) && (typeof transport.can_shuffle === 'boolean' ? transport.can_shuffle : transport.source === 'queue')
  const repeatOk = Boolean(zone) && (typeof transport.can_shuffle === 'boolean' ? transport.can_repeat : transport.source === 'queue')
  // Crossfade is the group's setting, and both apps leave it available on a
  // plain web stream (the Mac app on one) and a service's radio (the
  // Windows app on AccuRadio's), 2026-09-23; a broadcast, TV and the inputs
  // have nothing to fade between.
  // The speaker's own word decides (can_crossfade): a
  // Libby audiobook and a Sonos Radio station refuse it although the list
  // would offer it. The list stands in for a room that has not said.
  const crossfadeOk = Boolean(zone) && (typeof transport.can_crossfade === 'boolean' ? transport.can_crossfade
    : !['idle', 'tv', 'line_in', 'radio', 'service_stream', 'service_hls', 'grouped', 'unknown'].includes(transport.source))
  const volumeLabel = !zone ? '' : grouped ? t('desk.transport.groupVolume') : zone.name
  const playTitle = !zone ? '' : !loaded ? t('common.nothingQueued')
    : playing ? (pausable ? t('common.pause') : t('common.stop')) : t('common.play')

  return (
    <header className="dk-strip">
      {/* As the app's control (GroupVolumeControl.cs): a press anywhere on it
          except the mute button opens the group volume popover, and so does
          keyboard focus; hovering only keeps an open popover up. The caption
          also toggles it where a theme shows one. */}
      <div className="dk-strip-volume"
           onPointerDown={grouped ? (event) => { if (!event.target.closest('.dk-strip-mute')) setGroupOpen(true) } : undefined}
           onFocus={grouped ? (event) => { if (!event.target.closest('.dk-strip-mute')) setGroupOpen(true) } : undefined}>
        {grouped ? (
          <button type="button" className="dk-strip-volume-label dk-strip-group-toggle" data-grouped="true"
                  aria-expanded={groupOpen} title={group.name} onClick={() => setGroupOpen((v) => !v)}>
            {volumeLabel}
          </button>
        ) : (
          <p className="dk-strip-volume-label">{volumeLabel}</p>
        )}
        {grouped && groupOpen && (
          <GroupVolume members={group.members.map((uuid) => zones[uuid]).filter(Boolean)} icons={G}
                       actions={actions} onClose={() => setGroupOpen(false)} />
        )}
        <button
          type="button"
          className="dk-strip-mute"
          disabled={!zone}
          title={zone?.group_muted ? t('common.unmute') : t('common.mute')}
          onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}
        >
          {zone?.group_muted ? <G.VolumeOff /> : <G.VolumeOn />}
        </button>
        <div className="dk-strip-slider">
          <Slider
            value={zone?.group_volume ?? 0}
            disabled={!zone}
            label={volumeLabel || t('desk.transport.groupVolume')}
            onCommit={(level) => actions.setGroupVolume(zone.uuid, level)}
          />
        </div>
      </div>

      <div className="dk-strip-controls">
        <button type="button" className="dk-btn-back30" title={t('desk.transport.back30')}
                disabled={!skippable || !seekable} onClick={() => seekBy(-30)}>
          <Icon.Replay />
        </button>
        <button type="button" className="dk-btn-prev" title={t('common.previous')}
                disabled={!skipBack || stopped} onClick={() => actions.previous(zone.uuid)}>
          <G.Prev />
        </button>
        <button
          type="button"
          className="dk-btn-play"
          title={playTitle}
          disabled={!zone || !loaded}
          onClick={() => (playing
            ? (pausable ? actions.pause(zone.uuid) : actions.stop(zone.uuid))
            : actions.play(zone.uuid))}
        >
          {playing ? (pausable ? <G.Pause /> : <G.Stop />) : <G.Play />}
        </button>
        <button type="button" className="dk-btn-next" title={t('common.next')}
                disabled={!skipForward || stopped} onClick={() => actions.next(zone.uuid)}>
          <G.Next />
        </button>
        <button type="button" className="dk-btn-fwd30" title={t('desk.transport.forward30')}
                disabled={!skippable || !seekable} onClick={() => seekBy(30)}>
          <Icon.Forward />
        </button>
      </div>

      <div className="dk-strip-progress" data-stopped={stopped || undefined}
           data-paused={transport.state === 'PAUSED_PLAYBACK' || undefined}>
        <button type="button" className="dk-mode dk-mode-shuffle" aria-pressed={shuffled}
                title={t('common.shuffle')} disabled={!modes} onClick={toggleShuffle}>
          <G.Shuffle />
        </button>
        <time className="dk-time-elapsed">{duration ? formatDuration(elapsed) : ''}</time>
        <div
          className="dk-progress"
          data-seekable={scrubbable}
          role={scrubbable ? 'slider' : undefined}
          aria-label={t('common.seek')}
          aria-valuenow={duration ? elapsed : undefined}
          onClick={(event) => {
            if (!scrubbable) return
            const rect = event.currentTarget.getBoundingClientRect()
            const ratio = (event.clientX - rect.left) / rect.width
            actions.seek(zone.uuid, hms(Math.max(0, Math.min(duration, ratio * duration))))
          }}
        >
          <div className="dk-progress-track" />
          {duration > 0 && (
            <>
              <div className="dk-progress-fill" style={{ width: `${(elapsed / duration) * 100}%` }} />
              {scrubbable && <div className="dk-progress-thumb" style={{ left: `${(elapsed / duration) * 100}%` }} />}
            </>
          )}
        </div>
        {/* Both desktop apps count down what is left of the track: the Mac
            app showed 1:09 against -2:26 on a 3:35 track (2026-09-15), and
            the Windows app does the same. The prop stays, since a theme that
            is not replicating either app may want the length. */}
        <time className="dk-time-total">{duration ? (remainingTime ? `-${formatDuration(Math.max(0, duration - elapsed))}` : formatDuration(duration)) : ''}</time>
        <button type="button" className="dk-mode dk-mode-repeat" aria-pressed={repeat !== 'off'}
                title={repeat === 'one' ? t('desk.transport.repeatOne')
                  : repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}
                disabled={!repeatOk} onClick={cycleRepeat}>
          {repeat === 'one' ? <G.RepeatOne /> : <G.Repeat />}
        </button>
        <button type="button" className="dk-mode dk-mode-crossfade" aria-pressed={Boolean(transport.crossfade)}
                title={t('desk.transport.crossfade')} disabled={!crossfadeOk}
                onClick={() => actions.setCrossfade(zone.uuid, !transport.crossfade)}>
          <G.Crossfade />
        </button>
        {onEq && (
          /* No equalizer for the browser room: it is an output, not a player. */
          <button type="button" className="dk-mode dk-mode-eq" title={t('desk.prefs.musicEq')}
                  disabled={!zone || Boolean(zone.local)}
                  onClick={(event) => {
                    if (grouped) {
                      const r = event.currentTarget.getBoundingClientRect()
                      setEqMenu({ x: r.left, y: r.bottom + 4 })
                    } else onEq(zone.uuid)
                  }}>
            <G.Equalizer />
          </button>
        )}
      </div>
      {eqMenu && grouped && (
        <RoomMenu rooms={withoutBrowserRoom(group.members.map((uuid) => zones[uuid]).filter(Boolean))} x={eqMenu.x} y={eqMenu.y}
                  onClose={() => setEqMenu(null)} onPick={(uuid) => { setEqMenu(null); onEq(uuid) }} />
      )}

      <div className="dk-strip-aux">
        {onSystem && systemChoiceMatters(households) && (
          <label className="dk-strip-select">
            <span className="dk-sr-only">{t('desk.showSystem')}</span>
            <select value={systemFilter ?? 'all'} onChange={(event) => onSystem(event.target.value)}>
              <option value="all">{orderedHouseholds(households).map((h) => h.generation).join(' · ')}</option>
              {orderedHouseholds(households).map((h) => (
                <option key={h.id} value={h.id}>{h.generation}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <form
        className="dk-strip-search"
        onSubmit={(event) => { event.preventDefault(); setRecent(addRecentSearch(query)); onQuery(query) }}
      >
        {/* The scope badge: which service the box searches, as the app's
            pill shows with the service's logo and a caret. */}
        {scopes.length > 0 && (
          <button type="button" className="dk-strip-scope" aria-haspopup="menu" aria-expanded={scopeOpen}
                  title={t('desk.search.scope')} onClick={() => setScopeOpen((v) => !v)}>
            {scope?.icon ? <img src={scope.icon} alt="" /> : (() => {
              const Glyph = Icon.serviceGlyph(scope?.id)
              return <Glyph />
            })()}
            <G.CaretDown />
          </button>
        )}
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder={scope ? t('desk.search.in', { service: scope.name }) : t('common.search')}
          aria-label={t('common.search')}
          onChange={(event) => onQuery(event.target.value)}
        />
        {/* The app's ClearButton (searchboxspecialized.xaml): a 15px button
            before the magnifier, there only while the box holds text; the
            Mac app's field has one too. Shells without one hide it (desktop.css). */}
        {query && (
          <button type="button" className="dk-strip-clear" title={t('desk.search.clear')} aria-label={t('desk.search.clear')}
                  onClick={() => { onQuery(''); searchRef?.current?.focus() }} />
        )}
        <button type="submit" title={t('common.search')}><G.Search /></button>
      </form>
      {scopeOpen && (
        <ScopeMenu scopes={scopes} scope={scope} recent={recent} onClose={() => setScopeOpen(false)}
                   onPick={(next) => { onScope?.(next); setScopeOpen(false); searchRef?.current?.focus() }}
                   onRecent={(text) => { setScopeOpen(false); setRecent(addRecentSearch(text)); onQuery(text) }}
                   onClearRecent={() => { setRecent(clearRecentSearches()); setScopeOpen(false) }} />
      )}
    </header>
  )
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

function hms(seconds) {
  const total = Math.floor(seconds)
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}


// The app's group volume popover: under the strip's volume control, a row per
// room in the group with its own mute button and slider. Closes on a click
// elsewhere or Escape.
function GroupVolume({ members, actions, onClose, icons = Icon }) {
  const { t } = useI18n()
  const ref = React.useRef(null)
  useEffect(() => {
    // A press on the volume control itself keeps the popover, as the app's
    // does while the mouse is over it.
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target) && !event.target.closest?.('.dk-strip-volume')) onClose()
    }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div className="dk-group-volume" ref={ref} role="dialog" aria-label={t('desk.transport.groupVolume')}>
      {members.map((member) => (
        <div key={member.uuid} className="dk-group-volume-row">
          <strong>{member.name}</strong>
          <div className="dk-group-volume-ctl">
            <button type="button" className="dk-strip-mute"
                    title={member.muted ? t('common.unmute') : t('common.mute')}
                    onClick={() => actions.setMute(member.uuid, !member.muted)}>
              {member.muted ? <icons.VolumeOff /> : <icons.VolumeOn />}
            </button>
            <Slider value={member.volume ?? 0} label={member.name}
                    onCommit={(level) => actions.setVolume(member.uuid, level)} />
          </div>
        </div>
      ))}
    </div>
  )
}


// The services the search box can search, one per household account, with
// the current one marked.
// The app's search menu (searchcontextmenustyles.xaml + capture): every
// account of every service by its own name with its logo, a tick against the
// current one, then "Recent Searches" with what was typed before and a
// "Clear Recent Searches" row.
function ScopeMenu({ scopes, scope, recent = [], onClose, onPick, onRecent, onClearRecent }) {
  const { t } = useI18n()
  const ref = React.useRef(null)
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div className="dk-popover dk-scope-menu" ref={ref} role="menu">
      {scopes.map((item) => (
        <button key={item.key} type="button" role="menuitemradio"
                aria-checked={scope?.key === item.key} onClick={() => onPick(item)}>
          <span className="dk-scope-check" aria-hidden="true">{scope?.key === item.key ? <Icon.Check /> : null}</span>
          {/* A built-in source has no cloud icon; it draws its own glyph, as
              the app's menu does for TuneIn (2026-09-07). */}
          {item.icon ? <img src={item.icon} alt="" /> : (() => {
            const Glyph = Icon.serviceGlyph(item.id)
            return <Glyph />
          })()}
          {/* The app names the account only where it has to: a service with
              one account reads "Pandora", and only a second account of the
              same service turns both into "Spotify (Sam's Spotify)" and
              "Spotify (alexsounds)" (observed 2026-09-06). */}
          {(item.accounts > 1 || scopes.filter((other) => other.id === item.id).length > 1) && item.nickname
            ? `${item.name} (${item.nickname})`
            : item.name}
        </button>
      ))}
      {recent.length > 0 && (
        <>
          <hr className="dk-popover-sep" />
          <p className="dk-scope-heading">{t('desk.search.recent')}</p>
          {recent.map((text) => (
            <button key={text} type="button" role="menuitem" className="dk-scope-recent"
                    onClick={() => onRecent?.(text)}>{text}</button>
          ))}
          <hr className="dk-popover-sep" />
          <button type="button" role="menuitem" onClick={() => onClearRecent?.()}>{t('desk.search.clearRecent')}</button>
        </>
      )}
    </div>
  )
}


// A small menu of a group's rooms, for choosing whose settings to open.
function RoomMenu({ rooms, x, y, onClose, onPick }) {
  const ref = React.useRef(null)
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div className="dk-popover dk-room-menu" ref={ref} role="menu" style={{ left: x, top: y }}>
      {rooms.map((room) => (
        <button key={room.uuid} type="button" role="menuitem" onClick={() => onPick(room.uuid)}>{room.name}</button>
      ))}
    </div>
  )
}
