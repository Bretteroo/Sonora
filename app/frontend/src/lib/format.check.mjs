// node frontend/src/lib/format.check.mjs
//
// The speaker's own placeholders in r:streamContent. "Connecting..." is the
// speaker talking about itself, not what is on air: with a station's title to
// show it adds nothing, and an S2 speaker can report it for as long as the
// station plays, which kept "Connecting..." under BBC Radio 1 in the bar
// while it played.
import { describeNowPlaying, streamText } from './format.js'

let failed = 0
const is = (got, want, what) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const t = (key) => ({ 'desk.now.zp.connecting': 'Connecting...' }[key] ?? key)

is(streamText('ZPSTR_CONNECTING', t), 'Connecting...', 'a placeholder still reads as a sentence where it is shown')
const playing = { state: 'PLAYING', title: 'BBC Radio 1', stream_content: 'ZPSTR_CONNECTING', source: 'radio' }
is(describeNowPlaying(playing, t).secondary, '', 'a titled station does not carry the placeholder')
is(describeNowPlaying({ ...playing, stream_content: 'Summer Of 69' }, t).secondary, 'Summer Of 69', 'real stream text still shows')
is(describeNowPlaying({ ...playing, title: '' }, t).primary, 'Connecting...', 'with nothing else to show, the placeholder stands')

if (failed) { console.log(`${failed} failed`); process.exit(1) }
