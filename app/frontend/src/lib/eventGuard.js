// React reads window.event whenever it schedules an update, to learn how urgent the update
// is. In Firefox that read can name an event that belongs to an embedded frame of another
// origin (a YouTube player), and touching its `type` then throws "Permission denied to access
// property", which loses the update. This makes such an event read as no event at all, which
// React takes as an ordinary update.
const own = Object.getOwnPropertyDescriptor(window, 'event')
const inherited = Object.getOwnPropertyDescriptor(Window.prototype, 'event')
const read = (own && own.get) || (inherited && inherited.get)
if (read && (!own || own.configurable)) {
  try {
    Object.defineProperty(window, 'event', {
      configurable: true,
      get() {
        const event = read.call(window)
        if (!event) return event
        try { void event.type } catch { return undefined }
        return event
      },
      set(value) { if (own && own.set) own.set.call(window, value) },
    })
  } catch { /* the browser will not let it be wrapped; nothing changes */ }
}
