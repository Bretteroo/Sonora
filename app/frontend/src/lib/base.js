// Sonora's page below someone else's path: Home Assistant's ingress.
//
// Home Assistant shows an app's page through its own proxy, at
// /api/hassio_ingress/<token>/ on Home Assistant's address. Everything Sonora
// names with a leading slash -- /api/state, /api/art?u=..., /license, and the
// same URLs inside the state the backend sends -- would then go to Home
// Assistant's own /api and fail. The backend names the prefix in a
// `sonora-base` meta tag when a request came that way (backend/ingress.py),
// and this module puts it in front of every such URL as the browser is handed
// it: fetches, sockets, src and href however they are set, and url() in an
// inline style. So no theme, built in or uploaded, has to know.
//
// Without the tag, which is every copy not inside Home Assistant, nothing
// here is installed.

const meta = typeof document === 'undefined' ? null : document.querySelector('meta[name="sonora-base"]')

/** The path Sonora's page is served under, without a trailing slash, or ''. */
export const BASE = (meta?.getAttribute('content') || '').replace(/\/+$/, '')

/** `url` with the base in front, when it names a path on Sonora's root. */
export function withBase(url) {
  if (!BASE || typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url
  if (url === BASE || url.startsWith(`${BASE}/`) || url.startsWith(`${BASE}?`)) return url
  return BASE + url
}

/** The WebSocket URL for a path on Sonora, under the base. */
export function socketUrl(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}${withBase(path)}`
}

// url("/...") or url(/...) inside a CSS value.
const CSS_URL = /url\(\s*(['"]?)(\/(?!\/)[^'")]*)\1\s*\)/g
const withBaseCss = (value) => (typeof value === 'string' && value.includes('url(')
  ? value.replace(CSS_URL, (_, quote, url) => `url(${quote}${withBase(url)}${quote})`)
  : value)

// Replace a property's setter on the first prototype in the chain that has it.
function wrapSetter(proto, name, wrap) {
  let owner = proto
  while (owner && !Object.prototype.hasOwnProperty.call(owner, name)) owner = Object.getPrototypeOf(owner)
  const desc = owner && Object.getOwnPropertyDescriptor(owner, name)
  if (!desc?.set || !desc.configurable) return
  Object.defineProperty(owner, name, {
    ...desc,
    set(value) { desc.set.call(this, wrap(value)) },
  })
}

const URL_ATTRS = new Set(['src', 'href', 'poster', 'action', 'formaction', 'data'])

function install() {
  const fetchRaw = window.fetch.bind(window)
  window.fetch = (input, init) => fetchRaw(typeof input === 'string' ? withBase(input) : input, init)

  const open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return open.call(this, method, withBase(url), ...rest)
  }

  const windowOpen = window.open
  window.open = function (url, ...rest) { return windowOpen.call(this, withBase(url), ...rest) }

  const setAttribute = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    const key = String(name).toLowerCase()
    if (URL_ATTRS.has(key)) value = withBase(value)
    else if (key === 'style') value = withBaseCss(value)
    return setAttribute.call(this, name, value)
  }

  for (const [Type, names] of [
    [HTMLImageElement, ['src']],
    [HTMLMediaElement, ['src']],
    [HTMLVideoElement, ['poster']],
    [HTMLSourceElement, ['src']],
    [HTMLIFrameElement, ['src']],
    [HTMLAnchorElement, ['href']],
    [HTMLLinkElement, ['href']],
    [HTMLFormElement, ['action']],
  ]) {
    for (const name of names) wrapSetter(Type.prototype, name, withBase)
  }

  // Inline styles: React sets ordinary properties by name and custom ones
  // (--x) through setProperty.
  const style = document.documentElement.style
  for (const name of ['background', 'backgroundImage', 'maskImage', 'webkitMaskImage', 'listStyleImage', 'borderImage', 'borderImageSource', 'content', 'cursor']) {
    wrapSetter(style, name, withBaseCss)
  }
  const styleProto = Object.getPrototypeOf(style)
  let declaration = styleProto
  while (declaration && !Object.prototype.hasOwnProperty.call(declaration, 'setProperty')) declaration = Object.getPrototypeOf(declaration)
  if (declaration) {
    const setProperty = declaration.setProperty
    declaration.setProperty = function (name, value, priority) {
      return setProperty.call(this, name, withBaseCss(value), priority)
    }
  }
  wrapSetter(style, 'cssText', withBaseCss)
}

if (BASE && typeof window !== 'undefined') install()
