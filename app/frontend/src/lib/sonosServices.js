// The service ids Sonos itself assigns to its own services. These are
// protocol constants, not Sonora's choices: a speaker names them in every
// URI it plays and in the account list it publishes, and the desktop apps
// hardcode them too. They live here so a reader meets a name rather than a
// number, and so there is one place to look when Sonos adds another.
//
// A service id is the right key ONLY where the behavior belongs to that one
// service because Sonos made it so. Anything a service merely happens to
// support -- rating buttons, whether an item can be queued, whether an
// account can be renamed -- is read from what the service declares, never
// from this file.

//: TuneIn. Built into an S1 household, and the owner of the "My Radio
//: Stations" and "My Radio Shows" containers the players keep.
export const TUNEIN = 254

//: Sonos Radio. Sonos' own service, which both desktop apps list ahead of
//: everything else in the music pane, with the rest of the catalog A-Z
//: after it (measured 2026-09-09).
export const SONOS_RADIO = 303
