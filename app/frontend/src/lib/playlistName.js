// The part of the day a greeting names ("Good evening"): Sonora's own four,
// for the rail themes' Home.
export function dayPart(date = new Date()) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'overnight'
}

// The part of the day in the name the apps offer for a mixed queue. The
// Windows app has three: Morning from midnight, Afternoon from noon, Night
// from 17:00 (read off it hour by hour on 2026-09-29 by moving the VM's time
// zone; the app reads the zone only at start).
export function mixPart(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'night'
}

// A queue built from one album or playlist is offered under that name, as
// the app offers it; anything else is "<Weekday> <Part> Mix".
export function suggestedQueueName(t, zone = null, date = new Date()) {
  const source = zone?.transport?.queue_source
  if (source) return source
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)
  return t('desk.queue.mixName', { weekday, part: t(`desk.queue.part.${mixPart(date)}`) })
}
