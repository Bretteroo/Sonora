// node frontend/src/lib/oneAlert.check.mjs
import { stepAlert, shownAlerts, EMPTY_ALERT } from './oneAlert.js'

let bad = 0
const is = (got, want, why) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log(`FAIL  ${why}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
  else console.log(`ok    ${why}`)
}
const shown = (s) => shownAlerts(s).map((x) => (x.leaving ? `${x.id}~` : x.id))

let s = stepAlert(EMPTY_ALERT, [])
is(shown(s), [], 'nothing to say, nothing shown')
s = stepAlert(s, [{ id: 'a' }])
is(shown(s), ['a'], 'the first alert shows')
s = stepAlert(s, [{ id: 'b' }, { id: 'a' }])
is(shown(s), ['b', 'a~'], 'a newer one takes its place and the old one leaves')
s = { ...s, leaving: null }
is(shown(s), ['b'], 'then only the newest is left')
s = stepAlert(s, [{ id: 'b' }, { id: 'a' }])
is(shown(s), ['b'], 'a replaced alert still in its list never comes back')
s = stepAlert(s, [{ id: 'a' }])
is(shown(s), ['b~'], 'dismissing the one showing lets it leave the same way, and the replaced one stays gone')
s = stepAlert({ ...s, leaving: null }, [{ id: 'a' }])
is(shown(s), [], 'and then nothing shows')
s = stepAlert(s, [{ id: 'c' }])
s = stepAlert(s, [{ id: 'd' }, { id: 'c' }])
s = stepAlert(s, [{ id: 'e' }, { id: 'd' }, { id: 'c' }])
is(shown(s), ['e', 'd~'], 'a burst shows the newest and only the one just before it leaving')
s = stepAlert({ ...EMPTY_ALERT, seen: new Set(['x']), current: 'x', last: { id: 'x' } }, [{ id: 'y' }])
is(shown(s), ['y', 'x~'], 'replaced in the same update it was removed in, it still leaves')
s = stepAlert(s, [{ id: 'y', text: 'new words' }])
is(shownAlerts(s)[0].text, 'new words', 'the one showing follows its item as it changes')

if (bad) { console.log(`${bad} failed`); process.exit(1) }
