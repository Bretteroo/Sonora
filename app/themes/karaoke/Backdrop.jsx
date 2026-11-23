import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrefs } from './prefs.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import useOnline from '../../frontend/src/lib/useOnline.js'

// What plays behind the words: the videos listed on the Appearance page,
// YouTube links one to a line, without their sound. A playlist's link stands
// for every video in it. Each song gets a video of its own, and which one is
// worked out from the song and the list alone, so every browser looking at
// that song shows the same video. Where the song says how far in it is, the
// video is kept that far in too (going round again from its beginning when it
// is the shorter of the two), so those browsers also show the same moment of
// it. Where the music names no song there is nothing to work it out from:
// the videos then play in no set order, each once before any plays again,
// a video that runs out gives way to another, the same video never follows
// itself while there is another, and each room keeps its own, to be found as
// it would be by now when the room is looked at again. The video pauses with the
// music and holds on its frame until the music starts again; once the music
// is stopped the video is taken off the screen. With the list empty the
// words stand on a flat blue screen, and the blue is also what shows while
// the music is stopped, while a video is still loading, when YouTube will
// not play it here, and when the player has not done what it was asked.
//
// The video is YouTube's own embedded player in a frame, asked for only while
// there is a list, so a machine with an empty list never talks to YouTube.
// The page takes no script from anywhere but Sonora, so the player is spoken
// to in the messages its frame answers to, not through YouTube's script.
// What a playlist holds is learned the same way: a player out of sight is
// given the playlist, not started, and says which videos are in it. The page
// keeps that answer for some hours so a playlist is not asked after on every
// visit.

const ORIGIN = 'https://www.youtube-nocookie.com'
const ID = /^[A-Za-z0-9_-]{11}$/
const LIST = /^[A-Za-z0-9_-]{12,64}$/
const HOSTS = /(^|\.)youtube(-nocookie)?\.com$/
const SHORT = /^youtu\.be$/
const MOST = 500
const HELD = 'sonora.km.playlists'
const FRESH_MS = 12 * 60 * 60 * 1000
// How long a playlist is given to say what is in it.
const READ_MS = 15000

// One line of the list: a video, a playlist, or nothing the machine can use. A link to a video
// inside a playlist names both: the playlist is used whole, and the video alone should the
// playlist not say what it holds.
export function readLink(line) {
  const text = line.trim()
  if (!text) return null
  if (ID.test(text)) return { video: text }
  let url
  try { url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`) } catch { return null }
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)
  let video = ''
  if (SHORT.test(host)) video = parts[0] || ''
  else if (HOSTS.test(host)) {
    if (parts[0] === 'watch') video = url.searchParams.get('v') || ''
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) video = parts[1] || ''
  } else return null
  const named = url.searchParams.get('list') || ''
  const list = LIST.test(named) ? named : ''
  if (ID.test(video)) return list ? { video, list } : { video }
  return list ? { list } : null
}

// A pasted link written out in full: one that names a playlist as the playlist's own page, and a
// youtu.be link as the video's, with whatever else it carried (a start time) kept after the
// video. A mix made up for one video has no page of its own, so a link into one stays a link to
// its video. Any other line is handed back as it is.
export function fullLink(line) {
  const text = line.trim()
  let url
  try { url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`) } catch { return line }
  const link = readLink(text)
  if (link?.list && !(link.video && link.list.startsWith('RD'))) {
    const page = `https://www.youtube.com/playlist?list=${link.list}`
    return text === page ? line : page
  }
  const video = url.pathname.split('/').filter(Boolean)[0] || ''
  if (!SHORT.test(url.hostname.toLowerCase()) || !ID.test(video)) return line
  const rest = url.searchParams.toString()
  return `https://www.youtube.com/watch?v=${video}${rest ? `&${rest}` : ''}${url.hash}`
}

// The box without its repeats: a line naming a video or playlist that an earlier line names is
// left out, however each of them is written. Empty lines stay where they are.
export function withoutRepeats(text) {
  const met = new Set()
  return String(text || '').split(/\r?\n/).filter((line) => {
    const link = readLink(line)
    if (!link) return true
    const name = `${link.video || ''}|${link.list || ''}`
    if (met.has(name)) return false
    met.add(name)
    return true
  }).join('\n')
}

// The whole box: the videos and playlists it names, and the first line that is not a link.
export function readList(text) {
  const videos = []
  const lists = []
  let bad = ''
  String(text || '').split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return
    const link = readLink(line)
    if (!link) { if (!bad) bad = line.trim(); return }
    if (link.video && !videos.includes(link.video)) videos.push(link.video)
    if (link.list && !lists.includes(link.list)) lists.push(link.list)
  })
  return { videos: videos.slice(0, MOST), lists, bad }
}

// What playlists were found to hold, as this browser remembers it.
function heldPlaylists() {
  try { return JSON.parse(localStorage.getItem(HELD) || '{}') || {} } catch { return {} }
}
function heldPlaylist(list) {
  const got = heldPlaylists()[list]
  // A playlist remembered as empty is read again: it was a read that went wrong, not a playlist.
  return got && Array.isArray(got.ids) && got.ids.length && Date.now() - got.at < FRESH_MS ? got.ids : null
}
function keepPlaylist(list, ids) {
  try {
    const all = heldPlaylists()
    for (const [key, value] of Object.entries(all)) if (!value || Date.now() - value.at >= FRESH_MS) delete all[key]
    all[list] = { ids, at: Date.now() }
    localStorage.setItem(HELD, JSON.stringify(all))
  } catch { /* the page carries on without it */ }
  window.dispatchEvent(new Event(PLAYLIST_READ))
}
const PLAYLIST_READ = 'sonora:km-playlist-read'
// Playlists this visit could not read (YouTube sent nothing for them in time): counted as done,
// with nothing in them, so the count stops waiting for them; tried again on the next visit.
// Each is kept with why, as YouTube's player said: 'embed' (101 or 150: its owner does not let it
// play outside YouTube), 'gone' (100 or 2: private, deleted, or no such playlist), or 'quiet' (the
// player never said).
const unreadable = new Map()
function markUnreadable(list, why = 'quiet') {
  unreadable.set(list, why)
  window.dispatchEvent(new Event(PLAYLIST_READ))
}

// How many videos a box's links come to: its videos and those in its playlists, each once, and
// the playlists not yet read, which add nothing until they are. `onRead` subscribes to playlists
// being read on this page, for a count that should grow as they are.
export function countVideos(text) {
  const list = readList(text)
  const all = new Set(list.videos)
  let unread = 0
  const failed = []
  for (const each of list.lists) {
    const ids = heldPlaylist(each)
    if (ids) ids.forEach((id) => all.add(id))
    else if (unreadable.has(each)) failed.push({ list: each, why: unreadable.get(each) })
    else unread += 1
  }
  return { count: all.size, unread, failed }
}
export function onPlaylistRead(fn) {
  window.addEventListener(PLAYLIST_READ, fn)
  return () => window.removeEventListener(PLAYLIST_READ, fn)
}

const PARAMS = { mute: '1', controls: '0', playsinline: '1', disablekb: '1', rel: '0', fs: '0', iv_load_policy: '3', enablejsapi: '1' }

// A video asked for while the music is not playing loads without starting.
function address(video, start, at = 0) {
  const ask = new URLSearchParams({ ...PARAMS, autoplay: start ? '1' : '0', origin: window.location.origin })
  if (at >= 1) ask.set('start', String(Math.floor(at)))
  return `${ORIGIN}/embed/${video}?${ask}`
}

// Sized like a small player, since a frame with no size may not start at all.
const OUT_OF_SIGHT = { position: 'fixed', left: -10000, top: 0, width: 320, height: 180, border: 0, opacity: 0, pointerEvents: 'none' }

const anyOf = (ids) => ids[Math.floor(Math.random() * ids.length)]

// The video that goes with a song: every video is given a number made from the song and
// itself, and the highest wins. Two browsers whose lists differ a little (a playlist read
// at different hours) still agree wherever both hold the winner, and a video that will
// not play gives way to the same runner-up everywhere.
function mark(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12
  return h >>> 0
}
function videoFor(song, ids) {
  let best = ''
  let top = -1
  for (const id of ids) {
    const got = mark(`${song}|${id}`)
    if (got > top || (got === top && id < best)) { top = got; best = id }
  }
  return best
}
// The video for a song in a room as Sonora's server deals it (/api/karaoke/video): from the
// videos the room has not yet shown, so every one plays once before any plays again, and the same
// answer for every browser showing the room. Where the server cannot be asked, the song's own
// video as above, which every browser still agrees on.
async function dealt(room, song, ids, skip) {
  try {
    const answer = await fetch('/api/karaoke/video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: room || '', song, pool: ids, skip }),
    })
    if (answer.ok) {
      const { video } = await answer.json()
      if (video && ids.includes(video)) return video
    }
  } catch { /* the song's own, below */ }
  return videoFor(song, ids)
}

// How far out of step with its song a video may run before it is put right, and how
// long it is then left to settle. A video a little out runs a little fast or slow until it
// is back within IN_STEP: a seek throws away what the player has fetched ahead, and a phone
// on Wi-Fi then stops to fetch again, falls behind, and is sent on again, every few seconds.
// Only one FAR out is sent to its place. A player takes a while to start again from where
// it is sent, so one that lands late is next sent that much further on, up to MOST_LEAD.
const OUT_OF_STEP = 0.5
const IN_STEP = 0.2
const FAR = 4
const CATCH_UP = 1.25
const HOLD_BACK = 0.75
const SETTLE_MS = 4000
const MOST_LEAD = 4

// The video last seen playing, kept past the player that showed it and past a
// reload, so that the next player made does not open on the same one.
const LAST = 'sonora.km.lastVideo'
let last = ''
function lastShown() {
  if (last) return last
  try { last = sessionStorage.getItem(LAST) || '' } catch { /* nothing kept */ }
  return last
}
function noteShown(id) {
  if (id === last) return
  last = id
  try { sessionStorage.setItem(LAST, id) } catch { /* the page carries on without it */ }
}
// Whether a video's picture is squarer than the screen (shot 4:3, which the player draws with empty
// sides), so that Zoom video may fill a wide screen with it and leave a widescreen picture alone.
// YouTube does not say; its 4:3 still of every video does: a widescreen video's still has black
// bands across its top and bottom, a 4:3 one's has picture there. A still that cannot be read, or
// a 4:3 video opening on black, counts as widescreen, which is never cut.
const shapes = new Map()
function squareFromStill(id) {
  if (shapes.has(id)) return shapes.get(id)
  const asked = new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 120
        canvas.height = 90
        const pen = canvas.getContext('2d', { willReadFrequently: true })
        pen.drawImage(img, 0, 0, 120, 90)
        // The bands of a 16:9 picture in a 4:3 still are an eighth of its height, top and bottom.
        const band = (y0, y1) => {
          const { data } = pen.getImageData(0, y0, 120, y1 - y0)
          let most = 0
          for (let k = 0; k < data.length; k += 4) most = Math.max(most, data[k], data[k + 1], data[k + 2])
          return most
        }
        resolve(!(band(1, 9) < 24 && band(81, 89) < 24))
      } catch { resolve(false) }
    }
    img.onerror = () => resolve(false)
    img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  })
  shapes.set(id, asked)
  return asked
}
function markShape(id) {
  const well = document.getElementById('km-video')
  if (!well || !id) return
  squareFromStill(id).then((square) => {
    if (well.getAttribute('data-showing') !== id) return
    well.toggleAttribute('data-square', square)
  })
  well.setAttribute('data-showing', id)
  well.removeAttribute('data-square')
}

// One to open on: any but the one last shown, while there is another.
function opener(ids) {
  const others = ids.filter((id) => id !== lastShown())
  return anyOf(others.length ? others : ids)
}

// Each room's video, as it was when the room was last on the screen: which video, for which
// song, how far in, and when. A room come back to while it still plays that song is shown
// the same video at the place it would have reached by now, as if it had played on unseen.
const rooms = new Map()
function keepRoom(room, song, video, at, length, playing) {
  if (room && song) rooms.set(room, { song, video, at, length, playing, when: Date.now() })
}
function roomVideo(room, song, pool, playing) {
  const kept = room && song ? rooms.get(room) : null
  if (!kept || kept.song !== song || !pool.includes(kept.video)) return null
  let at = kept.at + (kept.playing && playing ? (Date.now() - kept.when) / 1000 : 0)
  if (kept.length > 1) at %= kept.length
  return { video: kept.video, at }
}

// The player out of sight that is handed a playlist and says what is in it.
// It reads one playlist at a time and is never started. A playlist that will
// not play here, or that does not answer in time, adds nothing.
function PlaylistReader({ list, onRead }) {
  const frame = useRef(null)
  const told = useRef(onRead)
  told.current = onRead
  useEffect(() => {
    const el = frame.current
    if (!el) return undefined
    let done = false
    let knock = 0
    // Why the playlist would not open, if YouTube says before time runs out: whether the link names a
    // playlist at all (YouTube's description of it), and whether the player refused to play it here.
    let refused = 'quiet'
    let exists = false
    let heardRefusal = false
    const finish = (ids, keep) => {
      if (done) return
      done = true
      if (keep && ids.length) keepPlaylist(list, ids)
      else if (!ids.length) markUnreadable(list, refused)
      told.current(list, ids)
    }
    const onLoad = () => {
      clearInterval(knock)
      knock = setInterval(() => {
        try { el.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'km-list', channel: 'widget' }), ORIGIN) } catch { /* not there yet */ }
      }, 400)
    }
    const onMessage = (event) => {
      if (event.origin !== ORIGIN || event.source !== el.contentWindow) return
      // Handled once the event is over: React reads window.event while it schedules an
      // update, and in Firefox an event that came from YouTube's frame refuses that read
      // ('Permission denied to access property "type"').
      const raw = event.data
      setTimeout(() => { if (!done) heardFrom(raw) }, 0)
    }
    const heardFrom = (raw) => {
      let data
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return }
      if (!data || typeof data !== 'object') return
      // An error is about one video (its first, say, kept off other sites), not the playlist: the
      // playlist's contents may still come, so the read goes on until they do or time runs out.
      if (data.event === 'onError') {
        // The player's word alone is not enough: it says "not allowed outside YouTube" (150) of a
        // playlist that does not exist, too. It is believed once YouTube's own description of the
        // link (below) has said the playlist is there.
        const code = Number(data.info)
        if (code === 101 || code === 150) heardRefusal = true
        else if (code === 100 || code === 2) refused = 'gone'
        if (heardRefusal && exists) refused = 'embed'
        return
      }
      const info = data.info
      if (info && typeof info === 'object' && Array.isArray(info.playlist) && info.playlist.length && info.playlistId === list) {
        finish(info.playlist.filter((id) => ID.test(id)).slice(0, MOST), true)
      }
    }
    const late = setTimeout(() => finish([], false), READ_MS)
    // YouTube's description of the link, asked at once: a playlist that does not exist, or is private,
    // has none, and is given up on there and then; one that does is the one the player is believed of.
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${list}`)}`, { credentials: 'omit' })
      .then((answer) => {
        if (done) return
        if (answer.ok) { exists = true; if (heardRefusal) refused = 'embed'; return }
        if (answer.status >= 400 && answer.status < 500) { refused = 'gone'; finish([], false) }
      })
      .catch(() => { /* no description to go on; the player alone is listened to */ })
    el.addEventListener('load', onLoad)
    window.addEventListener('message', onMessage)
    return () => { done = true; el.removeEventListener('load', onLoad); window.removeEventListener('message', onMessage); clearInterval(knock); clearTimeout(late) }
  }, [list])
  const ask = new URLSearchParams({ ...PARAMS, autoplay: '0', listType: 'playlist', list, origin: window.location.origin })
  return (
    <iframe ref={frame} className="km-playlist-reader" style={OUT_OF_SIGHT} src={`${ORIGIN}/embed/videoseries?${ask}`} title="" tabIndex={-1} aria-hidden="true"
            allow="encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
  )
}

const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const BUFFERING = 3
const QUIET_MS = 8000
const SLOW_MS = 2500
// How many times a player that stops by itself is started again.
const AGAIN = 3

// Whether the player is doing what the music is doing.
const fits = (value, playing) => (playing ? value === PLAYING || value === BUFFERING : value === PAUSED)

function Video({ first, pool, playing, stopped, song, room, where, onShown }) {
  const frame = useRef(null)
  const [live, setLive] = useState(false)
  const [gone, setGone] = useState(false)
  // The player has not followed the music: still running after a pause, or
  // still stopped after a start.
  const [stuck, setStuck] = useState(false)
  // A video newly asked for, until it has played past YouTube's opening marks.
  const want = useRef(playing)
  want.current = playing
  const loaded = useRef(false)
  const heard = useRef(false)
  const now = useRef(null)
  const again = useRef(0)
  // The videos to choose from, which grow as playlists are read; the ones that
  // will not play here; the ones already played in this round.
  const choice = useRef(pool)
  choice.current = pool
  // How far into its song the music is, where the song says.
  const place = useRef(where)
  place.current = where
  const into = () => { const at = place.current?.(); return typeof at === 'number' && at >= 0 ? at : null }
  // The song's own video, as far in as the song is. Music that names no song has the
  // room's own video where it left one, taken up where it would be by now.
  const [kept] = useState(() => (song ? { video: videoFor(song, pool), at: into() || 0 } : roomVideo(room, song, pool, playing)))
  const current = useRef(kept?.video || first)
  const broken = useRef(new Set())
  const played = useRef(new Set([current.current]))
  // The room on the screen, and whether the video in the player has started for it: until
  // it has, what the player says of itself is still about the video before.
  const inRoom = useRef(room)
  const settled = useRef(false)
  const length = useRef(0)
  const righted = useRef(0)
  const lead = useRef(0)
  const aimed = useRef(false)
  const going = useRef(false)
  // Where in the video the song's place falls: a video shorter than its song goes round.
  const due = () => {
    const at = into()
    if (at === null) return null
    return length.current > 1 ? at % length.current : at
  }
  // The one last seen playing, here or in the player before this one, which a video that
  // would not play does not take the place of.
  const seen = useRef(lastShown())
  // The song the video on the screen is for, and whether the music names one now.
  const sung = useRef(song)
  const named = useRef(song)
  named.current = song
  // The address is settled when the player is made: whether it starts by itself is
  // whether the music is playing then. After that it is told.
  const [src] = useState(() => address(current.current, playing, kept?.at || 0))

  const tell = (func, args = []) => {
    if (!loaded.current) return
    try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), ORIGIN) } catch { /* the frame has gone */ }
  }
  // The speed the video is running at to come back in step with its song.
  const rate = useRef(1)
  const pace = (to) => { if (rate.current === to) return; rate.current = to; tell('setPlaybackRate', [to]) }

  // A song's video, once dealt: the one on the screen already is only put in step with the song.
  const take = (id) => {
    if (!id) return
    if (id === current.current) { const at = due(); if (at !== null) tell('seekTo', [at, true]); return }
    current.current = id
    settled.current = false
    length.current = 0
    aimed.current = false
    tell('loadVideoById', [id, into() || 0])
  }
  // The song playing when the player was made started on its own video, which every browser agrees
  // on; the server is asked for the one it deals, and that is taken in its place if it differs.
  useEffect(() => {
    const asked = named.current
    if (!asked) return
    dealt(inRoom.current, asked, choice.current.filter((id) => !broken.current.has(id)), [...broken.current])
      .then((id) => { if (named.current === asked) take(id) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The next video, drawn at random from those not yet played this round.
  const onward = () => {
    const usable = choice.current.filter((id) => !broken.current.has(id))
    if (!usable.length) { setGone(true); return }
    if (named.current) {
      const asked = named.current
      dealt(inRoom.current, asked, usable, [...broken.current]).then((id) => { if (named.current === asked) take(id) })
      return
    }
    // Never the one just shown, while there is another: neither the one that was asked for
    // last nor, where that one would not play, the one seen before it.
    const other = (id) => id !== current.current && id !== seen.current
    let left = usable.filter((id) => !played.current.has(id) && other(id))
    if (!left.length) {
      played.current = new Set()
      left = usable.filter(other)
      if (!left.length) left = usable
    }
    const id = anyOf(left)
    played.current.add(id)
    current.current = id
    settled.current = false
    length.current = 0
    aimed.current = false
    tell('loadVideoById', [id])
  }

  useEffect(() => {
    const el = frame.current
    if (!el) return undefined
    let knock = 0
    let quiet = 0
    const listen = () => {
      try { el.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'km', channel: 'widget' }), ORIGIN) } catch { /* not there yet */ }
    }
    const onLoad = () => {
      loaded.current = true
      listen()
      clearInterval(knock)
      knock = setInterval(() => { if (heard.current) clearInterval(knock); else listen() }, 400)
      clearTimeout(quiet)
      // A player that never answers is still a player: it was asked to start
      // on its own, so it is shown once it has had time to.
      quiet = setTimeout(() => { if (!heard.current) setLive(true) }, QUIET_MS)
    }
    const state = (value) => {
      now.current = value
      if (value === PLAYING) tell('unloadModule', ['captions'])
      // A player that starts while the music is paused is stopped again, on the frame it got to.
      going.current = value === PLAYING
      if (value === PLAYING) { settled.current = true; seen.current = current.current; noteShown(current.current); markShape(current.current); again.current = 0; setLive(true); if (!want.current) tell('pauseVideo') }
      // A video shorter than its song goes round again.
      else if (value === ENDED) {
        if (named.current) { tell('seekTo', [due() || 0, true]); if (want.current) tell('playVideo') } else onward()
        return
      }
      // A browser stops a silent video in a tab that is out of sight and
      // leaves it stopped when the tab is looked at again. The music went
      // on, so the video is started again, though not forever: a player
      // that will not stay started is left alone.
      else if (value === PAUSED && want.current && document.visibilityState === 'visible' && again.current < AGAIN) { again.current += 1; tell('playVideo') }
      if (fits(value, want.current)) setStuck(false)
    }
    let gone = false
    const onMessage = (event) => {
      if (event.origin !== ORIGIN || event.source !== el.contentWindow) return
      // Handled once the event is over: React reads window.event while it schedules an
      // update, and in Firefox an event that came from YouTube's frame refuses that read
      // ('Permission denied to access property "type"').
      const raw = event.data
      setTimeout(() => { if (!gone) heardFrom(raw) }, 0)
    }
    const heardFrom = (raw) => {
      let data
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return }
      if (!data || typeof data !== 'object') return
      if (!heard.current) {
        heard.current = true
        tell('addEventListener', ['onStateChange'])
        tell('addEventListener', ['onError'])
      }
      if (data.event === 'onReady') { tell('mute'); tell('unloadModule', ['captions']); if (want.current) tell('playVideo') }
      else if (data.event === 'onStateChange') state(data.info)
      else if (data.event === 'infoDelivery' || data.event === 'initialDelivery') {
        if (typeof data.info?.playerState === 'number') state(data.info.playerState)
        if (typeof data.info?.duration === 'number' && data.info.duration > 0) length.current = data.info.duration
        if (settled.current && typeof data.info?.currentTime === 'number') {
          if (!named.current) keepRoom(inRoom.current, sung.current, current.current, data.info.currentTime, length.current, want.current)
          // Kept in step with its song, so every browser on the song shows the same moment.
          const at = want.current && named.current ? due() : null
          if (at !== null && Date.now() - righted.current > SETTLE_MS) {
            let behind = at - data.info.currentTime
            const round = length.current
            if (round > 1) behind = ((((behind + round / 2) % round) + round) % round) - round / 2
            if (going.current && Math.abs(behind) > FAR) {
              // What the last correction missed by is how long this player takes to start again.
              if (aimed.current) lead.current = Math.min(MOST_LEAD, Math.max(0, lead.current + behind))
              aimed.current = true
              righted.current = Date.now()
              pace(1)
              const to = at + lead.current
              tell('seekTo', [round > 1 ? to % round : to, true])
            } else if (going.current && Math.abs(behind) > OUT_OF_STEP) pace(behind > 0 ? CATCH_UP : HOLD_BACK)
          }
          // Back at its own speed once in step, and whenever there is no song to keep step with.
          if (rate.current !== 1) {
            if (at === null) pace(1)
            else {
              let off = at - data.info.currentTime
              const round = length.current
              if (round > 1) off = ((((off + round / 2) % round) + round) % round) - round / 2
              if (Math.abs(off) < IN_STEP || (rate.current > 1) !== (off > 0)) pace(1)
            }
          }
        }
      }
      else if (data.event === 'onError') {
        // This one will not play here; another may. A list with nothing
        // that plays is given up on, and the machine keeps its own picture.
        setLive(false)
        broken.current.add(current.current)
        onward()
      }
    }
    el.addEventListener('load', onLoad)
    window.addEventListener('message', onMessage)
    return () => { gone = true; el.removeEventListener('load', onLoad); window.removeEventListener('message', onMessage); clearInterval(knock); clearTimeout(quiet) }
  }, [first])

  // The video stops with the music and starts with it. A paused video stays
  // on the screen only once the player says it has stopped: one that never
  // answers cannot be trusted to have, and one that takes too long gives the
  // screen back to the machine's own picture, which does hold.
  useEffect(() => {
    tell(playing ? 'playVideo' : 'pauseVideo')
    if (!heard.current) { setStuck(!playing); return undefined }
    const timer = setTimeout(() => { if (!fits(now.current, playing)) setStuck(true) }, SLOW_MS)
    return () => clearTimeout(timer)
  }, [playing])

  // A new song brings its own video. The player starts either way, and holds on a frame
  // where the room is paused.
  useEffect(() => {
    const moved = room !== inRoom.current
    if (!moved && (!song || song === sung.current)) return
    inRoom.current = room
    sung.current = song
    if (song) { onward(); return }
    if (moved) {
      // Another room, naming no song: its own video where it left one, and a new one if not.
      settled.current = false
      const back = roomVideo(room, song, choice.current.filter((id) => !broken.current.has(id)), playing)
      if (!back) { onward(); return }
      current.current = back.video
      played.current.add(back.video)
      length.current = 0
      aimed.current = false
      tell('loadVideoById', [back.video, back.at])
    }
  }, [song, room])

  // The tab coming back into sight: the player is asked to carry on, and is
  // held to it like any other start.
  useEffect(() => {
    let timer = 0
    const back = () => {
      if (document.visibilityState !== 'visible' || !want.current) return
      again.current = 0
      tell('playVideo')
      clearTimeout(timer)
      if (heard.current) timer = setTimeout(() => { if (!fits(now.current, want.current)) setStuck(true) }, SLOW_MS)
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('pageshow', back)
    return () => { document.removeEventListener('visibilitychange', back); window.removeEventListener('pageshow', back); clearTimeout(timer) }
  }, [])

  // Stopped is not paused: there is no song for a held frame to belong to, so the screen
  // goes back to blue. The player stays where it is and is shown again when music starts.
  const shown = live && !stuck && !gone && !stopped
  useEffect(() => { onShown(shown); return () => onShown(false) }, [shown, onShown])
  if (gone) return null
  return (
    <iframe ref={frame} className="km-video-frame" data-shown={shown || undefined} src={src} title="" tabIndex={-1} aria-hidden="true"
            allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
  )
}

export default function Backdrop({ playing, stopped = false, song = '', room = '', where = null, off = false }) {
  const prefs = usePrefs()
  const list = useMemo(() => readList(prefs.videos), [prefs.videos])
  const [shown, setShown] = useState(false)
  // No video is asked for while the device is off the network. A browser that
  // calls itself offline is believed only while Sonora is not answering it.
  const { connected } = useSystem()
  const online = useOnline(connected)
  // Nor while the room plays its television: that has a picture of its own, somewhere else.
  const has = online && !off && prefs.videosOn && (list.videos.length > 0 || list.lists.length > 0)
  // What each playlist holds: read on this page, or remembered from an earlier visit.
  const [read, setRead] = useState({})
  const known = useMemo(() => {
    const out = {}
    for (const each of list.lists) { const ids = read[each] ?? heldPlaylist(each); if (ids) out[each] = ids }
    return out
  }, [list, read])
  // Playlists are read whether the videos are on or not, so the Settings page can count what is in
  // them as soon as they are added; nothing is played until the videos are on.
  const unread = online && !off ? list.lists.filter((each) => !known[each]) : []
  const onRead = useCallback((each, ids) => setRead((prev) => ({ ...prev, [each]: ids })), [])
  const pool = useMemo(() => [...new Set([...list.videos, ...list.lists.flatMap((each) => known[each] || [])])].slice(0, MOST), [list, known])
  // The first video, drawn at random once every playlist has been read, so it
  // can be any of them. It is drawn again only when the list no longer holds it.
  const [first, setFirst] = useState('')
  const ready = has && pool.length > 0 && unread.length === 0
  const start = ready && pool.includes(first) ? first : ''
  useEffect(() => {
    if (ready && !pool.includes(first)) setFirst(opener(pool))
  }, [ready, pool, first])
  // The video sits under the screen, not on it: the screen's bend is worked
  // out for what the page itself draws, and a frame from elsewhere is not
  // that. The screen is clear where the stage is, so the video shows through
  // and the words over it bend as they always do.
  const [well, setWell] = useState(null)
  useEffect(() => {
    setWell(has ? document.getElementById('km-video') : null)
    if (!has) setShown(false)
  }, [has])
  return (
    <>
      <div className="km-backdrop" data-video={shown || undefined} />
      {well && start && createPortal(<Video key={start} first={start} pool={pool} playing={playing} stopped={stopped} song={song} room={room} where={where} onShown={setShown} />, well)}
      {unread.length > 0 && createPortal(<PlaylistReader key={unread[0]} list={unread[0]} onRead={onRead} />, document.body)}
    </>
  )
}
