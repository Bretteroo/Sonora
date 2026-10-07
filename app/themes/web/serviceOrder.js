// The order of "Your Services", kept per browser as the product keeps it.
//
// play.sonos.com stores a list of service ids in the browser's own storage
// (`registeredConfigOrder`, read 2026-10-02 in the product's code and its
// local storage). Each time the services are read it keeps that list's
// order, drops a service that is no longer linked, and adds any service it
// has not seen yet at the end, in the order the list arrived, which is the
// catalog's. A fresh browser therefore shows catalog order, and services
// linked later queue up behind the ones it already knew. That is what made
// the home read in three runs that no rule over the services themselves
// could explain: they were the batches that one browser had seen them in.
// Sonora keeps the same list under its own name; the backend's catalog sort
// stays the order of a browser that has seen nothing yet.

const KEY = 'sonora.web.serviceOrder'

const read = () => {
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}
const write = (all) => {
  try { window.localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* fine */ }
}

const idOf = (service) => String(service.service_id ?? service.id)

/** `items` in this browser's order for `householdId`, remembering it. */
export function orderServices(householdId, items) {
  if (!householdId || !items?.length) return items || []
  const all = read()
  const present = [...new Set(items.map(idOf))]
  const kept = (Array.isArray(all[householdId]) ? all[householdId] : []).filter((id) => present.includes(id))
  const order = [...kept, ...present.filter((id) => !kept.includes(id))]
  if (JSON.stringify(order) !== JSON.stringify(all[householdId])) write({ ...all, [householdId]: order })
  const place = new Map(order.map((id, n) => [id, n]))
  return [...items].sort((a, b) => place.get(idOf(a)) - place.get(idOf(b)))
}
