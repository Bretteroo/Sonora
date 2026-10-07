// node frontend/src/lib/version.check.mjs
import { versionLabel, updateBody } from './version.js'

let failed = 0
const is = (got, want, what) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

is(versionLabel('18.8', '97.1-80312'), '18.8 (97.1-80312)', 'release, then the build in parentheses')
is(versionLabel('11.16.1', '57.23-74170'), '11.16.1 (57.23-74170)', 'S1 reads the same way')
is(versionLabel('', '97.2-81220'), '97.2-81220', 'a build alone stands by itself')
is(versionLabel('18.8', ''), '18.8', 'a release alone stands by itself')
is(versionLabel('18.8', '18.8'), '18.8', 'the same number is not printed twice')
is(versionLabel(undefined, null), '', 'nothing known prints nothing')

const t = (key, v) => `${key} ${JSON.stringify(v)}`
const both = [{ id: 'a', generation: 'S1' }, { id: 'b', generation: 'S2' }]
is(updateBody(t, both, 'b', '97.2-81220'), 'desk.update.bodySystem {"system":"S2","version":"97.2-81220"}', 'with S1 and S2 both present, the update names its system')
is(updateBody(t, [{ id: 'b', generation: 'S2' }], 'b', '97.2-81220'), 'desk.update.body {"version":"97.2-81220"}', 'with one kind only, it does not')
is(updateBody(t, [{ id: 'a', generation: 'S2' }, { id: 'b', generation: 'S2' }], 'b', '1'), 'desk.update.body {"version":"1"}', 'two S2 systems are still one kind')

if (failed) process.exit(1)
