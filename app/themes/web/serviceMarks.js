// Where a service's marks are fetched from, for the room they are drawn for.
// A service can carry a different badge or wordmark on S1 and on S2, so every
// mark names its room and the server reads that room's system's catalog;
// asked without one, it takes the first system that offers the service.

const roomQuery = (zone) => (zone ? `zone=${encodeURIComponent(zone)}` : '')

export function badgeSrc(sid, zone, size = 40) {
  return `/api/services/badge/${sid}?size=${size}${zone ? `&${roomQuery(zone)}` : ''}`
}

export function wordmarkSrc(sid, zone) {
  return `/api/services/wordmark/${sid}${zone ? `?${roomQuery(zone)}` : ''}`
}
