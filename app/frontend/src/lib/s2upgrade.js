// Which Sonos products stay on S1, what replaces them, and what that costs.
//
// The compatibility list is Sonos' own, from its "Sonos app version
// compatibility" support article (read 2026-09-09): Bridge, Connect (gen 1),
// Connect:Amp (gen 1), CR200, Play:5 (gen 1) and the ZonePlayers 80, 90, 100,
// 120 and S5 work with the S1 controller alone. Everything else Sonos has
// shipped can run S2, the 2015 Connect and Connect:Amp included, which is why
// the test below is on the model number a device reports rather than on its
// name: a Connect answering ZP90 is legacy and one answering S15 is not, and
// both call themselves "Sonos Connect".
//
// A speaker cannot answer the question itself. Its device description carries
// swGen, but that is the generation of the software it is running, so every
// device on an S1 household reports 1 whether or not it could move (measured
// across this system 2026-09-09: a Play:1, which S2 supports, reports the
// same swGen as the Play:5 gen 1, which it does not).
import { PRODUCTS } from './sonosProducts.js'

export const LEGACY_BY_MODEL_NUMBER = {
  S5: { product: 'Play:5 (Gen 1)', replacement: 'five' },
  ZP80: { product: 'ZonePlayer 80', replacement: 'port' },
  ZP90: { product: 'Connect (Gen 1)', replacement: 'port' },
  ZP100: { product: 'ZonePlayer 100', replacement: 'amp' },
  ZP120: { product: 'Connect:Amp (Gen 1)', replacement: 'amp' },
  BR100: { product: 'Bridge', replacement: null },
  CR200: { product: 'CR200 controller', replacement: null },
}

// Two of those name themselves in the model name rather than the number on
// some firmware, so they are matched either way.
const LEGACY_BY_NAME = [[/bridge/i, 'BR100'], [/\bcr200\b/i, 'CR200']]

// The current product that takes an older one's place, with the United States
// list price. Prices move: Sonos raised them across the range in 2025 for
// tariffs, so the date this was checked travels with them and the page says
// so. Checked 2026-10-05 on sonos.com's own product pages (read in Firefox; a
// plain fetch is refused), regular prices rather than sales: Era 100 $219,
// Five $599, Port $499, Amp $799, Beam (gen 2) $499, Arc Ultra $1,099, Sub 4
// $899. All unchanged since 2026-09-09.
// What replaces an older product, priced. These are the catalog's own
// entries, so a name, a price, and an Amazon listing come from one place --
// see lib/sonosProducts.js, which carries the whole Sonos line-up rather than
// only the handful this page happens to suggest.
const REPLACEMENT_KEYS = ['era100', 'five', 'port', 'amp', 'beam2', 'arcultra', 'sub4']
export const S2_REPLACEMENTS = Object.fromEntries(
  REPLACEMENT_KEYS.map((key) => [key, PRODUCTS[key]]))

export const PRICES_CHECKED = '2026-10-05'

// Sonora's Amazon Associates tag, so a purchase made from this page credits
// the person who wrote it.
export const AMAZON_TAG = 'sonora301-20'

export function amazonLink(replacement) {
  const item = replacement ? S2_REPLACEMENTS[replacement] : null
  return item && item.asin ? `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}` : ''
}

// The two tiers inside S2.
//
// Sonos drew a second line in 2025: a set of S2 products with 256 MB of memory
// or less that carry on working but no longer receive the newest app features.
// Sonora calls that tier S2.0 and everything current S2.1. Those are this
// app's shorthand for the reader's benefit, not names Sonos uses, and the page
// says as much.
//
// The list is by product, so it is matched by name for the lines that are on
// it whole. Two cases cannot be settled from what a speaker reports: the
// SYMFONISK bookshelf and table lamp are listed in their first generation only
// (the bookshelf's gen 1 answers S21, which is checked, and nothing else is
// known), and the Sub is listed for its first two generations while the gen 3
// and the Sub 4 are current. Those come back 'unknown' rather than guessed.
const LOWER_TIER = [
  [/play:1/, 'era100'],
  [/play:3/, 'era100'],
  // Any Play:5 that can run S2 is a gen 2; the gen 1 never gets this far.
  [/play:5/, 'five'],
  [/playbar/, 'arcultra'],
  [/playbase/, 'arcultra'],
  [/connect:amp/, 'amp'],
  [/connect/, 'port'],
  // A Boost has no current equivalent: SonosNet comes from a wired speaker.
  [/boost/, null],
]
const TIER_UNKNOWN = [/symfonisk/, /\bsub\b/]
const LOWER_BY_MODEL_NUMBER = { S21: 'era100' }

// Which tier a unit that can run S2 would land in, and what would replace it
// to reach S2.1.
export function s2Tier(player) {
  const number = String(player?.model_number || '').trim().toUpperCase()
  const name = String(player?.model || '').trim().toLowerCase()
  if (number in LOWER_BY_MODEL_NUMBER) {
    return { tier: 's2.0', upgrade: LOWER_BY_MODEL_NUMBER[number] }
  }
  for (const [pattern, upgrade] of LOWER_TIER) {
    if (pattern.test(name)) return { tier: 's2.0', upgrade }
  }
  for (const pattern of TIER_UNKNOWN) {
    if (pattern.test(name)) return { tier: 'unknown', upgrade: null }
  }
  return { tier: 's2.1', upgrade: null }
}

// What one player is: on S2 already possible, S1 for good, or unknown because
// the device told us nothing to go on.
export function classifyPlayer(player) {
  const number = String(player?.model_number || '').trim().toUpperCase()
  const name = String(player?.model || '').trim()
  let hit = LEGACY_BY_MODEL_NUMBER[number]
  if (!hit) {
    for (const [pattern, key] of LEGACY_BY_NAME) {
      if (pattern.test(name)) { hit = LEGACY_BY_MODEL_NUMBER[key]; break }
    }
  }
  if (hit) {
    // A legacy unit cannot run S2 at all, so it has no tier; what replaces it
    // is a current product and therefore S2.1 already.
    return { s2: false, product: hit.product, replacement: hit.replacement,
             tier: null, upgrade: hit.replacement }
  }
  if (!number && !name) return { s2: null, product: '', replacement: null, tier: null, upgrade: null }
  return { s2: true, product: name, replacement: null, ...s2Tier(player) }
}

// One row per physical player in the house, and the bills for the ones that
// cannot move. Each half of a bonded pair is its own row, because each is a
// box that would have to be replaced.
//
// Every household is walked, not only the S1 ones: a house already wholly on
// S2 still has rooms that would only ever reach S2.0, and the S2.1 bill is
// the whole point of the page for that reader.
export function upgradePlan(households) {
  const all = households || []
  const s1 = all.filter((h) => h.generation === 'S1')
  const rows = []
  for (const household of all) {
    for (const player of household.players || []) {
      rows.push({
        key: `${household.id}:${player.host || player.name}:${player.role || ''}`,
        household: household.id,
        generation: household.generation,
        room: player.name || '',
        role: player.role || '',
        model: player.model || '',
        modelNumber: player.model_number || '',
        version: player.display_version || '',
        online: player.online !== false,
        ...classifyPlayer(player),
      })
    }
  }
  rows.sort((a, b) => a.room.localeCompare(b.room) || a.role.localeCompare(b.role))
  const legacy = rows.filter((row) => row.s2 === false)
  const price = (key) => (key && S2_REPLACEMENTS[key] ? S2_REPLACEMENTS[key].usd : 0)
  const total = legacy.reduce((sum, row) => sum + price(row.replacement), 0)
  // Reaching S2.1 in every room means replacing the units that cannot run S2
  // at all and the ones that would only reach S2.0.
  const lower = rows.filter((row) => row.s2 === true && row.tier === 's2.0')
  const forS21 = [...legacy, ...lower]
  const totalS21 = forS21.reduce((sum, row) => sum + price(row.upgrade), 0)
  return {
    rows,
    legacy,
    lower,
    forS21,
    total,
    totalS21,
    households: all,
    hasS1: s1.length > 0,
    hasS2: all.some((h) => h.generation !== 'S1'),
    // Every room already on the current tier, which is the one house with
    // nothing to decide. A unit whose generation the speaker will not name
    // has tier `unknown` and keeps this false, since it might not be.
    allS21: rows.length > 0 && rows.every((row) => row.tier === 's2.1'),
    ready: rows.filter((row) => row.s2 === true).length,
    unknown: rows.filter((row) => row.s2 === null).length,
    tierUnknown: rows.filter((row) => row.tier === 'unknown').length,
  }
}

// Sonos' instructions for moving an S1 speaker to S2, which is where an
// "Update now" on a unit that only needs the software goes.
export const S1_UPDATE_URL = 'https://support.sonos.com/en-us/article/update-to-the-latest-sonos-app-using-the-s1-controller'

// Where one row stands on the way to S2, for the S2 bill, which lists every
// device: 'legacy' needs replacing, 'upgradable' is on S1 and needs only the
// software, 'running' is on S2 already, and 'unknown' told us nothing.
export function s2Status(row) {
  if (row.s2 === false) return 'legacy'
  if (row.s2 === null) return 'unknown'
  return row.generation === 'S1' ? 'upgradable' : 'running'
}

// The same for S2.1. A unit that would only reach S2.0 is 'lower' whichever
// system it is on now, since software alone will not take it further.
export function s21Status(row) {
  if (row.s2 === false) return 'legacy'
  if (row.s2 === null || row.tier === 'unknown') return 'unknown'
  if (row.tier === 's2.0') return 'lower'
  return row.generation === 'S1' ? 'upgradable' : 'running'
}

export function formatUsd(amount) {
  try {
    return amount.toLocaleString('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    })
  } catch {
    return `$${Math.round(amount)}`
  }
}

// The three generations as retail eras: the first and last month a product
// of each was on sale, for the timeline on the S2 Upgrade page. Dates are
// launch and end-of-sale, checked 2026-09-14 against the product tables on
// en.wikipedia.org/wiki/Sonos with the boundary products cross-checked in
// launch coverage (Engadget and Gear Patrol for the One SL replacing the
// Play:1 in September 2019). The S1-only era is bounded by the ZonePlayer 100
// (January 2005) and the Play:5 gen 1 (sold until 20 November 2015); the
// Bridge's own end of sale is not documented anywhere reliable but fell in
// the same period, after the Boost took over in October 2014. The S2.0 tier
// runs from the Play:3 (July 2011) to the Symfonisk table lamp gen 1
// (January 2022); the Boost may have outlasted it, but Sonos' end-of-sale
// notice gives no date, so it does not set the boundary. S2.1 opens with the
// Sonos One in October 2017 and is still being sold into.
export const ERAS_CHECKED = '2026-09-14'
export const PRODUCT_ERAS = [
  { key: 's1', tier: 'legacy', from: 2005, to: 2015 },
  { key: 's20', tier: 's2.0', from: 2011, to: 2022 },
  { key: 's21', tier: 's2.1', from: 2017, to: null },
]
// Two moments worth a mark on the same axis: the S2 app itself (8 June 2020,
// the day the Arc, Five and Sub gen 3 shipped) and the 2025 feature freeze
// that made the S2.0 tier a tier.
export const ERA_MARKS = [
  { key: 's2app', year: 2020 + 5 / 12 },
  { key: 'freeze', year: 2025 },
]

// Sonos' own announcements of the two moments the timeline marks: the S2 app
// and OS in June 2020, and the 2025 notice that froze the S2.0 tier.
export const S2_LAUNCH_URL = 'https://en.community.sonos.com/product-updates/introducing-s2-new-app-and-os-for-sonos-6841762'
export const S21_LAUNCH_URL = 'https://support.sonos.com/en-us/article/legacy-product-update'
