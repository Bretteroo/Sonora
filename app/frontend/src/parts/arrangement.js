import { isPart, layoutPropsFor } from './vocabulary.js'

// An arrangement: a theme's layout, as data.
//
// A shell decides what is on the screen and where. Written as React that is
// code, and a theme installed from a file may not carry code. So a layout is
// a tree of regions and parts instead:
//
//   {
//     "root": {
//       "region": "column",
//       "children": [
//         { "part": "transport" },
//         { "region": "row", "grow": true, "children": [
//             { "part": "rooms", "width": 260 },
//             { "region": "column", "grow": true, "children": [
//                 { "part": "nowPlaying" },
//                 { "part": "queue", "grow": true }
//             ] },
//             { "part": "browse", "width": 380 }
//         ] }
//       ]
//     }
//   }
//
// Regions nest and hold children; parts are leaves and name something from
// the vocabulary. A node may carry a `when` condition on facts the shell
// already knows, which is what lets one arrangement serve a wide window and a
// narrow one:
//
//   { "part": "rooms", "when": { "paneRooms": true } }
//   { "part": "paneSwitch", "when": { "narrow": true } }
//
// paneRooms, paneNow and paneMusic are true when the window is wide enough
// for all three, or when it is narrow and the paneSwitch tabs chose that one.
//
// Conditions are a flat object of name to expected value, all of which must
// match. They are deliberately not expressions: an arrangement is data that
// gets validated and rendered, and the moment it can compute it stops being
// either.

/** The facts a `when` may test, and what each means. */
export const CONDITIONS = {
  narrow: 'the window is too narrow for more than one pane',
  paneRooms: 'the rooms show: the window is wide, or the pane tabs chose Rooms',
  paneNow: 'now playing shows: the window is wide, or the pane tabs chose Now Playing',
  paneMusic: 'the music shows: the window is wide, or the pane tabs chose Music',
  roomSelected: 'a room is in view',
  grouped: 'the room in view is playing with others',
  queued: 'the room in view has a queue',
  signedIn: 'a Sonos account is signed in',
  manySystems: 'both an S1 and an S2 system were found',
}

/** How a region lays its children out. */
export const REGIONS = {
  column: 'children stacked top to bottom',
  row: 'children side by side',
  stack: 'children on top of one another, the last one in front',
}

const SIZE_KEYS = ['width', 'height', 'grow', 'scroll']

/**
 * Check an arrangement. Returns a list of problems, empty when it is sound.
 *
 * Every problem names the path it is at, because a layout is written by hand
 * and "unknown part" without a location is not worth printing.
 */
export function validate(arrangement) {
  const problems = []
  const root = arrangement?.root
  if (!root || typeof root !== 'object') {
    return ['the arrangement needs a root node']
  }
  walk(root, 'root', problems, 0)
  return problems
}

function walk(node, path, problems, depth) {
  if (depth > 12) { problems.push(`${path}: nested too deeply`); return }
  if (!node || typeof node !== 'object') {
    problems.push(`${path}: not a node`); return
  }
  const isRegion = typeof node.region === 'string'
  const isLeaf = typeof node.part === 'string'
  if (isRegion === isLeaf) {
    problems.push(`${path}: a node is either a region or a part, not both or neither`)
    return
  }

  if (node.when !== undefined) {
    if (typeof node.when !== 'object' || node.when === null || Array.isArray(node.when)) {
      problems.push(`${path}.when: a condition is an object of name to value`)
    } else {
      for (const key of Object.keys(node.when)) {
        if (!Object.hasOwn(CONDITIONS, key)) {
          problems.push(`${path}.when: no such condition "${key}"`)
        } else if (typeof node.when[key] !== 'boolean') {
          problems.push(`${path}.when.${key}: conditions are true or false`)
        }
      }
    }
  }

  for (const key of Object.keys(node)) {
    if (['region', 'part', 'children', 'when', 'props', 'key'].includes(key)) continue
    if (!SIZE_KEYS.includes(key)) {
      problems.push(`${path}: "${key}" means nothing here`)
    }
  }

  if (isRegion) {
    if (!Object.hasOwn(REGIONS, node.region)) {
      problems.push(`${path}: no such region "${node.region}"`)
    }
    if (!Array.isArray(node.children) || node.children.length === 0) {
      problems.push(`${path}: a region needs children`)
      return
    }
    node.children.forEach((child, i) => walk(child, `${path}.children[${i}]`, problems, depth + 1))
    return
  }

  if (!isPart(node.part)) {
    problems.push(`${path}: no such part "${node.part}"`)
    return
  }
  if (node.children) problems.push(`${path}: a part holds nothing`)
  if (node.props !== undefined) {
    if (typeof node.props !== 'object' || node.props === null || Array.isArray(node.props)) {
      problems.push(`${path}.props: props are an object`)
      return
    }
    const allowed = layoutPropsFor(node.part)
    for (const key of Object.keys(node.props)) {
      if (!allowed.includes(key)) {
        problems.push(`${path}.props: "${node.part}" takes no "${key}"`
                      + (allowed.length ? ` (it takes ${allowed.join(', ')})` : ''))
      }
    }
  }
}

/** Whether a node's condition holds, given what the shell knows. */
export function holds(node, facts = {}) {
  if (!node?.when) return true
  return Object.entries(node.when).every(([key, want]) => Boolean(facts[key]) === want)
}

/** Every part an arrangement names, for working out what a theme needs. */
export function partsUsed(arrangement) {
  const found = new Set()
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.part === 'string') found.add(node.part)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  visit(arrangement?.root)
  return [...found]
}
