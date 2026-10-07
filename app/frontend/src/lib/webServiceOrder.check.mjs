// The web theme's "Your Services" keeps the order this browser first saw the
// services in, as play.sonos.com does (themes/web/serviceOrder.js).
import assert from 'node:assert/strict'

const store = {}
globalThis.window = { localStorage: {
  getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) } } }
const { orderServices } = await import('../../../themes/web/serviceOrder.js')
const names = (list) => list.map((s) => s.name)
const svc = (id, name) => ({ service_id: id, name })

// A fresh browser shows them as they arrive (the catalog's order).
assert.deepEqual(names(orderServices('H', [svc(188, 'AccuRadio'), svc(516, 'SomaFM'), svc(12, 'Spotify')])),
  ['AccuRadio', 'SomaFM', 'Spotify'])
// Linked later: Pandora and Mixcloud come after what it already knew, even
// where the catalog would put Mixcloud first.
assert.deepEqual(names(orderServices('H', [svc(181, 'Mixcloud'), svc(188, 'AccuRadio'), svc(516, 'SomaFM'),
  svc(12, 'Spotify'), svc(236, 'Pandora')])), ['AccuRadio', 'SomaFM', 'Spotify', 'Mixcloud', 'Pandora'])
// Unlinked and linked again, a service goes to the end; the rest keep their places.
assert.deepEqual(names(orderServices('H', [svc(188, 'AccuRadio'), svc(12, 'Spotify'), svc(236, 'Pandora')])),
  ['AccuRadio', 'Spotify', 'Pandora'])
assert.deepEqual(names(orderServices('H', [svc(181, 'Mixcloud'), svc(188, 'AccuRadio'), svc(516, 'SomaFM'),
  svc(12, 'Spotify'), svc(236, 'Pandora')])), ['AccuRadio', 'Spotify', 'Pandora', 'Mixcloud', 'SomaFM'])
// Each household keeps its own.
assert.deepEqual(names(orderServices('S1', [svc(12, 'Spotify'), svc(188, 'AccuRadio')])), ['Spotify', 'AccuRadio'])
console.log('ok')
