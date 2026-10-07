import React, { useState } from 'react'
import { isLoaded } from '../../frontend/src/lib/transport.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { useSleepTimer, SLEEP_CHOICES, durationSeconds, clockText } from '../../frontend/src/lib/useSleepTimer.js'
import { menuAbove, menuBeside } from './menus.js'
import { isBroadcast } from './useTransport.js'

// The product's sleep timer wears an alarm clock: a ring with two little ears
// and its hands at twelve and three (play.sonos.com, 2026-09-21).
const SleepClock = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="10" cy="11.5" r="6.9" />
    <path d="M3.6 3.9l2 1.8M16.4 3.9l-2 1.8" />
    <path d="M10 7.8v3.7h3.4" />
  </svg>
)

// What the "..." disc opens, in the big player and in the bar along the
// bottom alike: the product gives both the same four lines and puts the panel
// in the same place, with its left edge on the button's and its foot 8px
// above it (measured on play.sonos.com 2026-09-21).
//
// The panel is drawn where the window can see it rather than inside whatever
// opened it -- the player's card scrolls, and an absolutely placed menu was
// cut to three clipped words there.
// Which of the menu's lines a room offers, so the disc that opens it can go
// when there are none. The browser room is an output, not a player: it takes
// no crossfade. Its sleep timer is the page's own (browserSleep.js), which
// stops what the page plays when it runs out.
export function playerMenuLines(zone, artist = '', canSearch = false) {
  const transport = zone?.transport || {}
  const loaded = isLoaded(transport)
  const quiet = isBroadcast(transport) || !loaded
  const local = Boolean(zone?.local)
  return {
    search: !quiet && Boolean(artist) && canSearch,
    crossfade: !quiet && !local && transport.can_crossfade !== false,
    sleep: true,
    playNow: !quiet,
  }
}

export function hasPlayerMenu(zone, artist = '', canSearch = false) {
  return Object.values(playerMenuLines(zone, artist, canSearch)).some(Boolean)
}

export default function PlayerMenu({ zone, artist, anchor, onClose, onSearch, onRoomSound }) {
  const { actions, zones } = useSystem()
  const { t } = useI18n()
  const [sleepAt, setSleepAt] = useState(null)
  const { remaining, set: setSleep } = useSleepTimer(zone?.uuid)
  if (!zone || !anchor) return null
  const transport = zone.transport || {}
  const close = () => { setSleepAt(null); onClose() }
  // A live broadcast has nothing to cross-fade, no one artist to look for and
  // nothing to start over: the product's menu there is Sleep Timer alone, in
  // the big player and the bar, playing or stopped (80s80s Reggae, 1010 WINS).
  // A service radio of tracks keeps Crossfade and Play Now (AccuRadio's
  // Chill), and a queue's track adds the search (2026-09-21, 2026-09-24).
  // An empty room has nothing to act on either, and gets the same one line
  // (an empty room, big player and bar, 2026-09-24).
  const lines = playerMenuLines(zone, artist, Boolean(onSearch))

  return (
    <>
      <div className="wb-np-menu" role="menu" style={menuAbove(anchor)}>
        {lines.search && (
          <button type="button" role="menuitem"
                  onClick={() => { close(); onSearch(artist) }}>
            <Icon.Search width={20} height={20} />
            <span>{t('web.searchFor', { term: artist })}</span>
          </button>
        )}
        {/* The switch moves and the panel stays, which is what a switch in the
            product's menu does. */}
        {lines.crossfade && (
          <button type="button" role="menuitemcheckbox" aria-checked={Boolean(transport.crossfade)}
                  onClick={() => actions.setCrossfade(zone.uuid, !transport.crossfade)}>
            <Icon.Crossfade width={20} height={20} />
            <span>{t('desk.transport.crossfade')}</span>
            <span className="wb-np-switch" aria-hidden="true"><i /></span>
          </button>
        )}
        {/* Sonora's own lines, not the product's: each room's sound settings, which the product
            has nowhere; one per room of a group, since every speaker has its own. Not for this
            browser, which has no speaker to tune. */}
        {onRoomSound && (zone.group_members?.length ? zone.group_members : [zone.uuid])
          .map((uuid) => zones[uuid]).filter((z) => z && !z.local).map((z) => (
            <button key={z.uuid} type="button" role="menuitem" onClick={() => { close(); onRoomSound(z.uuid) }}>
              <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 6h9M15 6h2M3 14h3M9 14h8" strokeLinecap="round" /><circle cx="13.5" cy="6" r="1.75" /><circle cx="7.5" cy="14" r="1.75" />
              </svg>
              <span>{t('desk.rooms.menu.eq', { name: z.name })}</span>
            </button>
          ))}
        {lines.sleep && (
          <button type="button" role="menuitem" aria-haspopup="menu"
                  aria-expanded={Boolean(sleepAt)}
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect()
                    setSleepAt((open) => (open ? null : { right: box.right, top: box.top }))
                  }}>
            <SleepClock width={20} height={20} />
            <span>{t('desk.browse.sleepTimer')}</span>
            <span className="wb-np-menu-value">
              {remaining ? clockText(durationSeconds(remaining)) : t('desk.sleep.off')}
            </span>
            <Icon.ChevronRight className="wb-np-menu-caret" width={16} height={16} />
          </button>
        )}
        {lines.playNow && (
          <button type="button" role="menuitem"
                  onClick={() => { close(); actions.play(zone.uuid) }}>
            <Icon.Play width={20} height={20} />
            <span>{t('desk.actions.playNow')}</span>
          </button>
        )}
      </div>
      {sleepAt && (
        <div className="wb-np-menu wb-np-submenu" role="menu"
             style={menuBeside(sleepAt, 32 + (SLEEP_CHOICES.length + (remaining ? 1 : 0)) * 36)}>
          {/* A timer that is running has to be stoppable; the product's list
              is these five durations alone, so Off joins it only while one is
              counting down. */}
          {remaining ? (
            <button type="button" role="menuitem"
                    onClick={() => { close(); setSleep(0) }}>
              <span>{t('desk.sleep.off')}</span>
            </button>
          ) : null}
          {SLEEP_CHOICES.map((minutes) => (
            <button type="button" role="menuitem" key={minutes}
                    onClick={() => { close(); setSleep(minutes) }}>
              <span>{minutes >= 60 ? t.plural('desk.sleep.hours', minutes / 60)
                : t('web.sleep.minutes', { count: minutes })}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
