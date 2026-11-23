import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'

// The songbook: every song the machine can be asked for has a number, the way
// a karaoke room's binder gives one to every title. The queue's entries take
// their place in line (1 for the first). A favorite takes the next number
// above 9000 the first time it is listed and keeps it, so its number does not
// move as the queue fills and empties or as the favorites are put in another
// order. The songs printed in the binder start at 10000 and are numbered the
// same way. Sonora holds both lists on its own disk.
export const FAVORITE_BASE = 9000
export const BOOK_FIRST = 10000
export const DIGITS = 5

export const pad = (n) => String(n).padStart(DIGITS, '0')

const keyOf = (item) => item?.id || item?.uri || ''
const NONE = {}

const Songbook = createContext({ numberOf: () => 0 })

// What the rows and tiles read: the number on a favorite, or 0 for an item
// that has none.
export function useSongNumber(item) {
  return useContext(Songbook).numberOf(item)
}

// The favorites' numbers as Sonora keeps them, by the favorite's id. They are
// read again whenever the list of favorites changes, since a favorite new to
// the list is given its number by that reading. Until an answer is in, a
// favorite shows no number.
export function useFavoriteNumbers(favorites, zone) {
  const [held, setHeld] = useState({ zone: '', numbers: NONE })
  const listed = favorites.map(keyOf).join('\n')
  useEffect(() => {
    if (!zone || !listed) return undefined
    let mine = true
    api.songbookFavorites(zone).then((got) => { if (mine) setHeld({ zone, numbers: got?.numbers || NONE }) }, () => {})
    return () => { mine = false }
  }, [zone, listed])
  return held.zone === zone ? held.numbers : NONE
}

export function SongbookProvider({ numbers, children }) {
  const value = useMemo(() => ({
    numberOf: (item) => (item?.kind === 'favorite' ? numbers[keyOf(item)] || 0 : 0),
  }), [numbers])
  return <Songbook.Provider value={value}>{children}</Songbook.Provider>
}

// What a typed number asks for: a place in the queue, a favorite, or nothing.
export function lookUp(number, { queueItems, queueTotal, favorites, numbers }) {
  if (!number) return null
  if (number >= BOOK_FIRST) return null
  if (number > FAVORITE_BASE) {
    const item = favorites.find((each) => numbers[keyOf(each)] === number)
    return item ? { kind: 'favorite', item, title: item.title || '' } : null
  }
  if (number <= queueTotal) {
    const item = queueItems[number - 1]
    return { kind: 'queue', number, title: item?.title || '' }
  }
  return null
}

// The number as the machine shows it beside a favorite.
export function SongNumber({ item }) {
  const n = useSongNumber(item)
  if (!n) return null
  return <span className="km-songno" aria-hidden="true">{pad(n)}</span>
}
