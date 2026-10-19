// What the browser room is playing, as a service knows it: the service, the
// item's id there, and the room it was browsed from (for its household). The
// panes ask for the item's rating buttons through api.itemMetadata, which
// reads it here. A module of its own for the reason browserQueue.js gives.

let read = () => ({ sid: 0, item: '', zone: '' })

/** localOut names what it plays. */
export function setBrowserItem(next) { read = next }

/** The service item the browser room plays, or sid 0 where it plays none. */
export function browserItem() { return read() }
