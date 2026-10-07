// Keeps the words of About Sonora readable whatever a theme's stylesheet does.
//
// A theme may restyle and rearrange the About view, never change what it says
// Rewording is closed elsewhere (i18n/index.jsx drops a
// theme's about.* strings; backend/themes.py refuses `content:` on about-
// selectors). Hiding is the other way to change what it says, so each element
// carrying `data-about-text`, and every element between it and the card, is
// checked against its computed style for the ways text is commonly hidden, and
// whatever hides it is undone inline with !important, which outranks any
// stylesheet rule, !important ones included.

const px = (value) => parseFloat(value) || 0

function alpha(color) {
  if (!color || color === 'transparent') return 0
  const m = /rgba?\(([^)]+)\)/.exec(color)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length > 3 ? parseFloat(parts[3]) : 1
}

// What `display` an element should have when a stylesheet took it away.
function shownDisplay(el) {
  if (el.tagName === 'LI') return 'list-item'
  if (el.classList.contains('about-support')) return 'flex'
  if (el.tagName === 'A' || el.tagName === 'SPAN') return 'inline'
  return 'block'
}

// One element's repairs: each [property, value] that undoes a way it is hidden.
function repairsFor(el, s, text) {
  const out = []
  const set = (prop, value) => out.push([prop, value])
  if (s.display === 'none') set('display', shownDisplay(el))
  if (s.visibility === 'hidden' || s.visibility === 'collapse') set('visibility', 'visible')
  if (px(s.opacity) < 0.6) set('opacity', '1')
  if (s.contentVisibility === 'hidden') set('content-visibility', 'visible')
  if (s.clipPath && s.clipPath !== 'none') set('clip-path', 'none')
  if (s.clip && s.clip !== 'auto') set('clip', 'auto')
  if (s.mask && s.mask !== 'none' && s.maskImage && s.maskImage !== 'none') set('mask', 'none')
  if (s.filter && s.filter !== 'none') set('filter', 'none')
  if (s.transform && s.transform !== 'none') {
    const m = s.transform.match(/matrix\(([^)]+)\)/)
    const v = m ? m[1].split(',').map(Number) : null
    // A squash or a slide off the card; a plain small turn or nudge is design.
    if (!v || Math.hypot(v[0], v[1]) < 0.6 || Math.hypot(v[2], v[3]) < 0.6
        || Math.abs(v[4]) > 200 || Math.abs(v[5]) > 200) set('transform', 'none')
  }
  if (text) {
    if (px(s.fontSize) < 9) set('font-size', 'inherit')
    if (px(s.lineHeight) && px(s.lineHeight) < px(s.fontSize) * 0.8) set('line-height', 'inherit')
    if (Math.abs(px(s.textIndent)) > 100) set('text-indent', '0')
    if (px(s.letterSpacing) < -2 || px(s.letterSpacing) > 20) set('letter-spacing', 'normal')
    if (alpha(s.color) < 0.4) set('color', 'var(--t-fg, CanvasText)')
    if (s.webkitTextFillColor && alpha(s.webkitTextFillColor) < 0.4) set('-webkit-text-fill-color', 'currentColor')
    if (s.fontSize && s.color === s.backgroundColor) set('color', 'var(--t-fg, CanvasText)')
  }
  // Squeezed to nothing with its overflow cut off.
  if ((s.overflow !== 'visible') && (px(s.height) < 2 || px(s.maxHeight) < 2 || px(s.width) < 2 || px(s.maxWidth) < 2)) {
    set('overflow', 'visible'); set('height', 'auto'); set('max-height', 'none'); set('width', 'auto'); set('max-width', 'none')
  }
  // Thrown off the screen.
  if (s.position === 'absolute' || s.position === 'fixed') {
    const r = el.getBoundingClientRect()
    if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) set('position', 'static')
  }
  return out
}

/**
 * Check and repair the About card's words. Returns how many properties were
 * forced, for a test to read.
 */
export function guardAboutText(card) {
  if (!card) return 0
  const touched = new Set()
  let forced = 0
  for (const el of card.querySelectorAll('[data-about-text]')) {
    for (let node = el; node && node !== card.parentElement?.parentElement; node = node.parentElement) {
      if (touched.has(node)) continue
      const repairs = repairsFor(node, window.getComputedStyle(node), node === el)
      for (const [prop, value] of repairs) {
        node.style.setProperty(prop, value, 'important')
        forced += 1
      }
      if (node !== el) touched.add(node)
    }
  }
  return forced
}
