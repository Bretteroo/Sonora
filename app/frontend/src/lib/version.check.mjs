// node frontend/src/lib/version.check.mjs
import { versionLabel } from './version.js'

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

if (failed) process.exit(1)
