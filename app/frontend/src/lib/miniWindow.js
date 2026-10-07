// Opening the Mini Controller's window, whichever shell asked for it.
//
// The panel itself is the shell's -- the desktop one reproduces the S1 app's
// mini controller, Sonofuture's is its own -- but getting a window to put it
// in is the same job twice, and the two copies had drifted apart on the one
// detail that matters: a Document Picture-in-Picture window is a separate
// document, so this page's stylesheets and the theme's own marks have to be
// copied into it or the panel renders unstyled. Sonofuture's copy carried
// `data-theme` across, the desktop one did not, and a theme keyed to that
// attribute rather than to a class -- Liquid Glass is, so its rules can reach
// the portalled sheets -- lost its styling in the desktop shell's picture-in
// -picture window.

export const MINI_QUERY = 'mini'
//: Both shells' minis talk to the page that opened them over this.
export const MINI_CHANNEL = 'sonora-mini'

/** Whether this document *is* a mini window. */
export function isMiniWindow() {
  try {
    return new URLSearchParams(window.location.search).has(MINI_QUERY)
  } catch { return false }
}

/**
 * Open the mini as a popup window.
 *
 * `name` keeps each shell's popup distinct, so switching theme does not
 * reuse a window dressed for the other one.
 */
export function openMiniWindow({ name, side, resizable = false, position = null }) {
  const features = [
    'popup=yes', `width=${side}`, `height=${side}`,
    `resizable=${resizable ? 'yes' : 'no'}`, 'scrollbars=no',
    ...(position ? [`left=${position.x}`, `top=${position.y}`] : []),
  ].join(',')
  const url = new URL(window.location.href)
  url.searchParams.set(MINI_QUERY, '1')
  try { return window.open(url.toString(), name, features) } catch { return null }
}

/**
 * Open the mini as a Document Picture-in-Picture window, dressed like this
 * page. Resolves to the window, or null when the browser has no such API --
 * Firefox has none, which is why the popup above still exists.
 */
export async function openMiniPip({ side, bodyClass }) {
  const api = window.documentPictureInPicture
  if (!api?.requestWindow) return null
  let pip
  try { pip = await api.requestWindow({ width: side, height: side }) } catch { return null }
  const doc = pip.document
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
    doc.head.appendChild(node.cloneNode(true))
  }
  const root = document.documentElement
  doc.documentElement.setAttribute('style', root.getAttribute('style') || '')
  doc.documentElement.className = root.className
  // A theme may be keyed to the attribute rather than a class, so it travels
  // too -- along with the appearance and variant marks, for a theme that has
  // a light and a dark way up.
  for (const mark of ['theme', 'appearance', 'variant']) {
    if (root.dataset[mark]) doc.documentElement.dataset[mark] = root.dataset[mark]
  }
  doc.title = 'Sonora'
  doc.body.className = bodyClass
  doc.body.style.margin = '0'
  return pip
}
