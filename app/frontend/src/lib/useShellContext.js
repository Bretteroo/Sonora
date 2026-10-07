import { systemChoiceMatters } from './format.js'
import { useCallback, useMemo, useState } from 'react'
import { useSystem } from './store.jsx'
import { useShellSelection } from './shellSelection.js'
import { useNarrow, DESKTOP_NARROW } from './useNarrow.js'

// Everything a part needs, assembled once.
//
// A part is given this and its layout props, and nothing else. That division
// is the point: the layout says where things go, the context says what they
// are looking at, and a theme-authored arrangement can therefore be data --
// it never has to name a callback or reach into state.
//
// Overlays are not in here. Each shell keeps its own, because the two
// disagree about what an overlay even is -- one modal at a time in the desktop
// shells, a stack of coexisting drawers and sheets in Sonofuture -- and
// forcing one shape on both would make the layouts harder to describe rather
// than easier. A shell passes `onOpen(kind, payload)` and the context turns
// that into the specific callbacks the parts ask for.

/**
 * @param onOpen  (kind, payload) => void, the shell's own overlay opener.
 *                Kinds the parts ask for: 'group', 'eq', 'info', 'sleep',
 *                'confirm', 'message'.
 */
export function useShellContext({ onOpen = () => {}, onSelect = null } = {}) {
  // Read as the window changes, not once at load: a layout's narrow branch
  // had needed a reload to appear (the theme-guide test).
  const narrow = useNarrow(DESKTOP_NARROW)
  // Which pane the narrow layout's tabs have chosen.
  const [pane, setPane] = useState('now')
  const { zones, groups, households, connected, actions, servicesEpoch } = useSystem()
  const selection = useShellSelection({ onSelect })
  const { activeZone, activeGroup, visibleGroups, systemFilter, chooseSystem, select } = selection

  // Search belongs to the transport part and is read by the browse part, so
  // it is the one piece of state that has to sit between them.
  const [query, setQuery] = useState('')
  const [searchScope, setSearchScope] = useState(null)
  const [searchScopes, setSearchScopes] = useState([])

  const open = useCallback((kind, payload) => onOpen(kind, payload), [onOpen])

  const pauseAll = useCallback(() => open('pauseAll'), [open])

  return useMemo(() => ({
    // what there is
    zones,
    groups: visibleGroups,
    allGroups: groups,
    households,
    connected,
    actions,
    servicesEpoch,
    // what is in view
    zone: activeZone,
    group: activeGroup,
    activeId: activeGroup?.coordinator || null,
    systemFilter,
    onSystem: chooseSystem,
    onSelect: select,
    // searching
    query,
    onQuery: setQuery,
    scope: searchScope,
    scopes: searchScopes,
    onScope: setSearchScope,
    onScopes: setSearchScopes,
    // what a part asks the shell to open
    onGroup: (group) => open('group', group),
    onEq: (uuid) => open('eq', uuid),
    onInfo: (item) => open('info', item),
    onMessage: (text) => open('message', text),
    onPauseAll: pauseAll,
    narrow,
    pane,
    onPane: setPane,
  }), [narrow, pane, zones, groups, visibleGroups, households, connected, actions, servicesEpoch,
       activeZone, activeGroup, systemFilter, chooseSystem, select,
       query, searchScope, searchScopes, open, pauseAll])
}

/** The facts an arrangement's `when` conditions are answered from. */
export function shellFacts(context, { signedIn = false } = {}) {
  const transport = context?.zone?.transport || {}
  return {
    narrow: Boolean(context?.narrow),
    // A pane shows when the window is wide enough for all three, or when the
    // narrow layout's tabs have chosen it.
    paneRooms: !context?.narrow || context?.pane === 'rooms',
    paneNow: !context?.narrow || (context?.pane || 'now') === 'now',
    paneMusic: !context?.narrow || context?.pane === 'music',
    roomSelected: Boolean(context?.zone),
    grouped: (context?.group?.members?.length || 0) > 1,
    queued: (transport.queue_length ?? 0) > 0,
    signedIn: Boolean(signedIn),
    manySystems: systemChoiceMatters(context?.households),
  }
}
