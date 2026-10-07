// Every Sonos product Amazon lists, so that what Sonora names and links to
// does not depend on which speakers happen to be in one house.
//
// The ASINs were read off amazon.com's own product URLs on 2026-09-10. Each is
// the plain single unit in black where a color choice exists -- not a bundle,
// not a two-pack, not a Renewed listing, since those change price and stock
// far more often. Where Amazon lists only one color for a discontinued line,
// that color is noted.
//
// `usd` is the United States list price and is only filled in where it has
// actually been checked (the replacements the S2 upgrade page adds up, checked
// 2026-09-09). A null means unchecked rather than free: nothing sums a price
// that is not here.
//
// `current` marks what Sonos still sells. The discontinued entries are here
// because someone's system contains them and a link to the listing is still
// the quickest way to see what a thing was.

export const AMAZON_TAG = 'sonora301-20'

export const PRODUCTS = {
  // --- speakers ---------------------------------------------------------
  era100: { name: 'Sonos Era 100', asin: 'B0BW34LCB8', usd: 219, current: true, kind: 'speaker' },
  era100sl: { name: 'Sonos Era 100 SL', asin: 'B0GJ78ZKF6', usd: null, current: true, kind: 'speaker' },
  era300: { name: 'Sonos Era 300', asin: 'B0BW2LV57K', usd: null, current: true, kind: 'speaker' },
  five: { name: 'Sonos Five', asin: 'B087CC4QH4', usd: 599, current: true, kind: 'speaker' },
  one: { name: 'Sonos One', asin: '', usd: null, current: false, kind: 'speaker' },
  onesl: { name: 'Sonos One SL', asin: '', usd: null, current: false, kind: 'speaker' },
  play1: { name: 'Sonos Play:1', asin: '', usd: null, current: false, kind: 'speaker' },
  play3: { name: 'Sonos Play:3', asin: '', usd: null, current: false, kind: 'speaker' },
  play5: { name: 'Sonos Play:5', asin: '', usd: null, current: false, kind: 'speaker' },

  // --- portable ---------------------------------------------------------
  move2: { name: 'Sonos Move 2', asin: 'B0CGGYYK2D', usd: null, current: true, kind: 'portable' },
  move: { name: 'Sonos Move (gen 1)', asin: 'B07W95RBZM', usd: null, current: false, kind: 'portable' },
  roam2: { name: 'Sonos Roam 2', asin: 'B0CY6S748H', usd: null, current: true, kind: 'portable' },
  roamsl: { name: 'Sonos Roam SL', asin: 'B0C3HSL6QX', usd: null, current: false, kind: 'portable' },

  // --- home theater -----------------------------------------------------
  arcultra: { name: 'Sonos Arc Ultra', asin: 'B0DFK28LBB', usd: 1099, current: true, kind: 'soundbar' },
  arc: { name: 'Sonos Arc', asin: 'B087CCKWWP', usd: null, current: false, kind: 'soundbar' },
  beam2: { name: 'Sonos Beam (gen 2)', asin: 'B09GPYL7BJ', usd: 499, current: true, kind: 'soundbar' },
  beam: { name: 'Sonos Beam (gen 1)', asin: 'B07D4734HR', usd: null, current: false, kind: 'soundbar' },
  ray: { name: 'Sonos Ray', asin: 'B0B2KQFTG9', usd: null, current: true, kind: 'soundbar' },
  playbar: { name: 'Sonos Playbar', asin: '', usd: null, current: false, kind: 'soundbar' },
  playbase: { name: 'Sonos Playbase', asin: '', usd: null, current: false, kind: 'soundbar' },

  // --- subwoofers -------------------------------------------------------
  sub4: { name: 'Sonos Sub 4', asin: 'B0DFK42525', usd: 899, current: true, kind: 'sub' },
  sub3: { name: 'Sonos Sub (gen 3)', asin: 'B087CCZH4Q', usd: null, current: false, kind: 'sub' },
  sub1: { name: 'Sonos Sub (gen 1)', asin: 'B01HL8LXQ8', usd: null, current: false, kind: 'sub' },
  submini: { name: 'Sonos Sub Mini', asin: 'B0BGJV72YM', usd: null, current: true, kind: 'sub' },

  // --- components -------------------------------------------------------
  amp: { name: 'Sonos Amp', asin: 'B07LD8NN37', usd: 799, current: true, kind: 'component' },
  port: { name: 'Sonos Port', asin: 'B07XMDYJRZ', usd: 499, current: true, kind: 'component' },
  connect: { name: 'Sonos Connect', asin: 'B001CROHX6', usd: null, current: false, kind: 'component' },
  connectamp: { name: 'Sonos Connect:Amp', asin: 'B001CROHU4', usd: null, current: false, kind: 'component' },
  boost: { name: 'Sonos Boost', asin: '', usd: null, current: false, kind: 'component' },
  bridge: { name: 'Sonos Bridge', asin: '', usd: null, current: false, kind: 'component' },

  // --- headphones -------------------------------------------------------
  ace: { name: 'Sonos Ace', asin: 'B0CYHGTMNH', usd: null, current: true, kind: 'headphones' },
  aceultra: { name: 'Sonos Ace Ultra', asin: 'B0H8TBGMBJ', usd: null, current: true, kind: 'headphones' },
}

export function product(key) {
  return (key && PRODUCTS[key]) || null
}

/** An Amazon search for anything the catalog has no listing for. */
export function amazonSearch(term) {
  const query = String(term || '').trim()
  if (!query) return ''
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`
}

/**
 * A tagged Amazon link for a catalog key, a product name, or nothing.
 *
 * A key with an ASIN goes straight to that listing. A key without one, or a
 * bare name, falls back to a search: better a page of the right product than a
 * link to the wrong one.
 */
export function amazonLink(keyOrName) {
  const item = product(keyOrName)
  if (item && item.asin) return `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`
  return amazonSearch(item ? item.name : keyOrName)
}

/** The catalog as rows, current products first, for a picker, or a table. */
export function productList({ currentOnly = false } = {}) {
  return Object.entries(PRODUCTS)
    .filter(([, item]) => !currentOnly || item.current)
    .map(([key, item]) => ({ key, ...item }))
    .sort((a, b) => Number(b.current) - Number(a.current)
      || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
}
