// node frontend/src/parts/arrangement.check.mjs
import { validate, holds, partsUsed, CONDITIONS, REGIONS } from './arrangement.js'

let bad = 0
const is = (got, want, why) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log(`FAIL  ${why}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`) }
  else console.log(`ok    ${why}`)
}

// The desktop shell's layout, written as data. If this does not validate the
// format cannot describe the shells it exists to describe.
const desktop = {
  root: {
    region: 'column',
    children: [
      { part: 'transport' },
      { part: 'paneSwitch', when: { narrow: true } },
      {
        region: 'row',
        grow: true,
        children: [
          { part: 'rooms', width: 260, when: { narrow: false } },
          {
            region: 'column',
            grow: true,
            children: [
              { part: 'nowPlaying' },
              { part: 'queue', grow: true, scroll: true, props: { expanded: false } },
            ],
          },
          { part: 'browse', width: 380, when: { narrow: false } },
        ],
      },
    ],
  },
}
is(validate(desktop), [], 'the desktop shell is expressible, and validates')
is(partsUsed(desktop).sort(),
   ['browse', 'nowPlaying', 'paneSwitch', 'queue', 'rooms', 'transport'],
   'and names six parts')

// Sonofuture's: a rail beside one section at a time, a bar along the bottom.
const modern = {
  root: {
    region: 'row',
    children: [
      { region: 'column', width: 96, children: [{ part: 'rooms', props: { plainNames: true } }] },
      {
        region: 'column',
        grow: true,
        children: [
          { region: 'stack', grow: true, children: [
            { part: 'browse' },
            { part: 'nowPlaying', when: { roomSelected: true } },
          ] },
          { part: 'transport' },
        ],
      },
    ],
  },
}
is(validate(modern), [], 'a stacked, rail-led layout validates too')

const problems = validate({
  root: {
    region: 'column',
    children: [
      { part: 'stage' },
      { region: 'grid', children: [{ part: 'rooms', props: { color: 'red' } }] },
      { part: 'queue', children: [{ part: 'rooms' }] },
      { part: 'rooms', when: { phase_of_moon: true } },
      { part: 'rooms', when: { narrow: 'yes' } },
      { region: 'column' },
      { part: 'rooms', wobble: 3 },
    ],
  },
})
is(problems, [
  'root.children[0]: no such part "stage"',
  'root.children[1]: no such region "grid"',
  'root.children[1].children[0].props: "rooms" takes no "color" (it takes plainNames)',
  'root.children[2]: a part holds nothing',
  'root.children[3].when: no such condition "phase_of_moon"',
  'root.children[4].when.narrow: conditions are true or false',
  'root.children[5]: a region needs children',
  'root.children[6]: "wobble" means nothing here',
], 'every kind of mistake is named, with where it is')

is(validate({}), ['the arrangement needs a root node'], 'an empty arrangement says so')
is(validate({ root: { region: 'column', part: 'rooms', children: [] } }),
   ['root: a node is either a region or a part, not both or neither'],
   'a node cannot be both')

is(holds({ part: 'rooms' }, {}), true, 'a node with no condition always shows')
is(holds({ when: { narrow: true } }, { narrow: true }), true, 'a condition that matches')
is(holds({ when: { narrow: true } }, { narrow: false }), false, 'and one that does not')
is(holds({ when: { narrow: false } }, {}), true, 'a missing fact counts as false')
is(holds({ when: { narrow: true, roomSelected: true } }, { narrow: true }), false,
   'every condition has to hold, not just one')

is(Object.keys(REGIONS).sort(), ['column', 'row', 'stack'], 'three ways to lay children out')
is(Object.keys(CONDITIONS).length, 9, 'nine facts a layout may ask about (THEMES.md, Conditions)')

process.exit(bad ? 1 : 0)
