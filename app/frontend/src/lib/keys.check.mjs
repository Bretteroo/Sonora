// node frontend/src/lib/keys.check.mjs
import { isTyping, isCommand, keyOf, shuffleToggled, repeatCycled } from './keys.js'

let bad = 0
const is = (got, want, why) => {
  const ok = got === want
  if (!ok) { bad++; console.log(`FAIL  ${why}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
  else console.log(`ok    ${why}`)
}

is(isTyping({ target: { tagName: 'INPUT' } }), true, 'typing in a field')
is(isTyping({ target: { tagName: 'TEXTAREA' } }), true, 'or a text area')
is(isTyping({ target: { tagName: 'SELECT' } }), true, 'or a dropdown')
is(isTyping({ target: { tagName: 'DIV', isContentEditable: true } }), true,
   'or anything contenteditable -- the desktop shells used to miss this')
is(isTyping({ target: { tagName: 'DIV' } }), false, 'but not an ordinary element')
is(isTyping({}), false, 'and an event with no target is not typing')

is(isCommand({ ctrlKey: true }), true, 'control is the command key')
is(isCommand({ metaKey: true }), true, 'and so is command')
is(isCommand({}), false, 'neither held')
is(keyOf({ key: 'K' }), 'k', 'keys are lowercased once, here')
is(keyOf({}), '', 'and a missing key is empty rather than a crash')

// Shuffle flips within whatever repeat mode is on.
is(shuffleToggled('NORMAL'), 'SHUFFLE_NOREPEAT', 'off -> shuffle')
is(shuffleToggled('SHUFFLE_NOREPEAT'), 'NORMAL', 'and back')
is(shuffleToggled('REPEAT_ALL'), 'SHUFFLE', 'repeat all keeps repeating, shuffled')
is(shuffleToggled('SHUFFLE'), 'REPEAT_ALL', 'and back')
is(shuffleToggled('REPEAT_ONE'), 'SHUFFLE_REPEAT_ONE', 'repeat one likewise')
is(shuffleToggled('SHUFFLE_REPEAT_ONE'), 'REPEAT_ONE', 'and back')
is(shuffleToggled('NONSENSE'), 'SHUFFLE_NOREPEAT', 'an unknown mode shuffles')

// Repeat cycles off -> all -> one, keeping shuffle where it was.
is(repeatCycled('NORMAL'), 'REPEAT_ALL', 'off -> all')
is(repeatCycled('REPEAT_ALL'), 'REPEAT_ONE', 'all -> one')
is(repeatCycled('REPEAT_ONE'), 'NORMAL', 'one -> off')
is(repeatCycled('SHUFFLE_NOREPEAT'), 'SHUFFLE', 'shuffled, off -> all')
is(repeatCycled('SHUFFLE'), 'SHUFFLE_REPEAT_ONE', 'shuffled, all -> one')
is(repeatCycled('SHUFFLE_REPEAT_ONE'), 'SHUFFLE_NOREPEAT', 'shuffled, one -> off')
is(repeatCycled('NONSENSE'), 'REPEAT_ALL', 'an unknown mode repeats all')

// Every mode returns to itself in six presses, which is what makes the two
// buttons feel like buttons rather than a maze.
for (const start of ['NORMAL', 'SHUFFLE_NOREPEAT', 'REPEAT_ALL', 'SHUFFLE',
                     'REPEAT_ONE', 'SHUFFLE_REPEAT_ONE']) {
  let mode = start
  for (let i = 0; i < 3; i += 1) mode = repeatCycled(mode)
  is(mode, start, `${start} comes back after three repeat presses`)
  mode = shuffleToggled(shuffleToggled(start))
  is(mode, start, `${start} comes back after two shuffle presses`)
}

process.exit(bad ? 1 : 0)
