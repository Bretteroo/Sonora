// The browser room's queue, between the page's player and api.queue.
//
// It is a module of its own, importing nothing, because the two cannot reach
// each other directly: localOut imports api, and api imports browserSleep,
// which imports localOut. Kept in api.js, the hand-off was registered by
// localOut and then reset by api.js's own initializer, which ran after it in
// that cycle, so the queue panes saw an empty queue.

let read = () => ({ items: [], total: 0 })

/** localOut names what it holds: an album or playlist's tracks, or nothing. */
export function setBrowserQueue(next) { read = next }

/** What api.queue answers for the browser room. */
export function browserQueue(start = 0, count = 200) { return read(start, count) }
