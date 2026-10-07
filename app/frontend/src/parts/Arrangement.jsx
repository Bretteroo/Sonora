import React from 'react'
import { holds, validate, partsUsed } from './arrangement.js'
import { partsFor } from './registry.js'
import { EscapeHatch } from './Settings.jsx'
import './arrangement.css'

// Renders an arrangement: the other half of arrangement.js.
//
// A region becomes a div with a flex direction; a part becomes whichever
// component the theme registered for that name. What a part needs beyond its
// layout props -- the room in view, the callbacks that open dialogs -- comes
// from `context`, which the shell passes once and every part receives. A
// layout cannot reach into that: it may set only the props the vocabulary
// lists, which is what keeps an arrangement a description rather than a
// program.

const DIRECTION = { column: 'column', row: 'row' }

function styleFor(node, isRoot = false) {
  const style = {}
  if (node.width !== undefined) { style.width = node.width; style.flex = '0 0 auto' }
  if (node.height !== undefined) { style.height = node.height; style.flex = '0 0 auto' }
  if (node.grow) style.flex = '1 1 0%'
  if (node.scroll) style.overflow = 'auto'
  if (node.width === undefined && node.height === undefined && !node.grow) {
    // The root fills the shell whether or not the author said `grow`. It had
    // to be said, once, and a layout whose last part was below the fold was
    // the result -- and an inline flex beats any stylesheet trying to correct
    // it from outside.
    style.flex = isRoot ? '1 1 auto' : '0 0 auto'
  }
  if (isRoot) style.minHeight = 0
  return style
}

function Node({ node, parts, context, facts, path, isRoot = false }) {
  if (!holds(node, facts)) return null

  if (typeof node.region === 'string') {
    const stacked = node.region === 'stack'
    const style = {
      ...styleFor(node, isRoot),
      display: 'flex',
      flexDirection: stacked ? 'column' : DIRECTION[node.region],
      position: stacked ? 'relative' : undefined,
      minWidth: 0,
      minHeight: 0,
    }
    return (
      <div className={`pt-region pt-${node.region}`} style={style} data-path={path}>
        {node.children.map((child, i) => (
          <Node key={child.key || i} node={child} parts={parts} context={context}
                facts={facts} path={`${path}.${i}`} />
        ))}
      </div>
    )
  }

  const Part = parts[node.part]
  if (!Part) {
    // A theme that names a part it has no component for. Say so where it
    // would have been rather than rendering a hole.
    return (
      <div className="pt-missing" data-path={path} role="note">
        {`no component for "${node.part}"`}
      </div>
    )
  }
  return (
    <div className={`pt-part pt-part-${node.part}`} style={styleFor(node, isRoot)} data-path={path}>
      <Part {...context} {...(node.props || {})} />
    </div>
  )
}

/**
 * A shell, from an arrangement.
 *
 * `theme` supplies the parts; `context` is what every part is given; `facts`
 * answers the conditions. A layout that does not validate renders its problems
 * instead of a broken screen, because a theme author needs to see them and an
 * install that silently draws nothing is worse than one that complains.
 */
export default function Arrangement({ arrangement, theme, context = {}, facts = {} }) {
  const problems = validate(arrangement)
  if (problems.length) {
    return (
      <div className="pt-problems" role="alert">
        <strong>This layout cannot be drawn:</strong>
        <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
    )
  }
  // A layout decides what is on the screen, so a layout that shows no way to
  // leave it would stand a person in it with the browser console as the only
  // way back. Any arrangement that places no settings part gets this instead.
  const escapable = partsUsed(arrangement).includes('settings')
  return (
    <>
      <Node node={arrangement.root} parts={partsFor(theme)} context={context}
            facts={facts} path="root" isRoot />
      {!escapable && <EscapeHatch />}
    </>
  )
}
