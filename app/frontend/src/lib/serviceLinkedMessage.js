import React from 'react'
import { orderedHouseholds } from './format.js'

// The message shown once a service has been linked, worded for the household it
// was linked in, whether the person has a second system, and what kind of link
// actually happened.
//
// A Sonora sign-in is held per household (the token is keyed by household id),
// so a service linked for S1 covers only S1 devices; using it on S2 means
// linking it again from the S2 services. Three outcomes read differently:
//
//   registered            a service the speakers accepted, anonymous or linked
//                          (a linked account goes on sealed): it
//                          is on the Sonos system itself, so it is already in
//                          the official app, nothing more to do there.
//   anonymous, not on it   an anonymous add the speakers refused: usable in
//                          Sonora (it needs no account to browse) but not on
//                          the system, so it will not appear in the Sonos apps.
//                          It has no sign-in, so that word is avoided.
//   otherwise              a token sign-in Sonora holds and the system cannot:
//                          Sonora-only, add it in the official app to use it
//                          there.
//
// When the person has a second system the message carries a `{link}` slot where
// "the other system's services" is named. serviceLinkedMessage returns the raw
// text (slot intact), the other system's household id, and the words to show in
// the slot; LinkedMessage renders it, turning the slot into a control that opens
// Add Music Services on that other tab.
export function serviceLinkedMessage(t, { name, zone, households, registered, auth }) {
  const linked = households.find((h) => (h.zone_uuids || []).includes(zone))
  const gen = linked?.generation
  const others = orderedHouseholds(households).filter((h) => h.id !== linked?.id)
  const multi = Boolean(gen && others.length)
  const other = others[0]?.generation
  const otherId = others[0]?.id ?? null
  const p = { service: name, gen, other }

  let text
  if (registered) {
    text = multi ? t('desk.add.doneSystem.multi', p) : t('desk.add.doneSystem.solo', p)
  } else if (auth === 'Anonymous') {
    text = multi ? t('desk.add.doneAnon.multi', p) : t('desk.add.doneAnon.solo', p)
  } else {
    text = multi ? t('desk.add.doneSonora.multi', p) : t('desk.add.doneSonora.solo', p)
  }
  return { text, linkText: t('services.relinkLinkText', { other }), otherId }
}

// A newline in a message is a line break on screen.
function lines(text) {
  return text.split('\n').flatMap((line, i) =>
    (i === 0 ? [line] : [React.createElement('br'), line]))
}

// Render a linked message. The `{link}` slot (present only with a second system)
// becomes a control that opens Add Music Services on the other system's tab.
// A theme with no way to open that view passes no onOpen; the slot then renders
// as plain text.
//
// The whole sentence is one inline span, never loose pieces: a theme that sets
// the message in a flex row beside an icon (Material Girl's check)
// otherwise laid out the text, the link and the closing period as three
// columns side by side.
export function LinkedMessage({ result, onOpen }) {
  const { text, linkText, otherId } = result
  const at = text.indexOf('{link}')
  if (at === -1 || !onOpen || otherId == null) {
    return React.createElement('span', { className: 'svc-linked-message' },
      ...lines(text.replace('{link}', linkText)))
  }
  const before = text.slice(0, at)
  const after = text.slice(at + '{link}'.length)
  return React.createElement(
    'span',
    { className: 'svc-linked-message' },
    ...lines(before),
    React.createElement(
      'button',
      { type: 'button', className: 'svc-relink', onClick: () => onOpen(otherId) },
      linkText,
    ),
    ...lines(after),
  )
}
