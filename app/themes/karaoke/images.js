// The machine's hardware: renders of a model of the cabinet, its keys, and
// its front panel, made for this theme. The sheet cannot reach for a file by
// name, so each one is handed to it as a custom property on the theme's root.
// The cabinet and the wall behind it were rendered twice, once in each
// version's light; the keys, lamps, and thumbwheel are the same
// in both.
import wall from './img/wall.webp'
import shell from './img/shell.webp'
import glare from './img/glare.webp'
import panel from './img/panel.webp'
import grille from './img/grille.webp'
import led from './img/led.webp'
import lampOff from './img/lamp-off.webp'
import lampOn from './img/lamp-on.webp'
import slot from './img/slot.webp'
import drum from './img/drum.webp'
import wheelslot from './img/wheelslot.webp'
import wheel from './img/wheel.webp'
import brush from './img/brush.webp'
import keyGrayUp from './img/key-gray-up.webp'
import keyGrayDown from './img/key-gray-down.webp'
import keyRedUp from './img/key-red-up.webp'
import keyRedDown from './img/key-red-down.webp'
import keyDarkUp from './img/key-dark-up.webp'
import keyDarkDown from './img/key-dark-down.webp'
import keyWineUp from './img/key-wine-up.webp'
import keyWineDown from './img/key-wine-down.webp'
import keyTealUp from './img/key-teal-up.webp'
import keyTealDown from './img/key-teal-down.webp'
import keyWhiteUp from './img/key-white-up.webp'
import keyWhiteDown from './img/key-white-down.webp'
import keyWhiteLit from './img/key-white-lit.webp'
import wallLight from './img/wall-light.webp'
import shellLight from './img/shell-light.webp'
import glareLight from './img/glare-light.webp'
import panelLight from './img/panel-light.webp'
import grilleLight from './img/grille-light.webp'
import ledLight from './img/led-light.webp'
import slotLight from './img/slot-light.webp'
import drumLight from './img/drum-light.webp'
import wheelslotLight from './img/wheelslot-light.webp'
import bookBase from './img/book-base.webp'
import bookStacks from './img/book-stacks.webp'
import bookRings from './img/book-rings.webp'
import bookSheen from './img/book-sheen.webp'
import bookCover from './img/book-cover.webp'
import bookTabs from './img/book-tabs.webp'
import cldKeyUp from './img/cld-key-up.webp'
import cldKeyDown from './img/cld-key-down.webp'
import cldSilverUp from './img/cld-silver-up.webp'
import cldSilverDown from './img/cld-silver-down.webp'
import cldBarUp from './img/cld-bar-up.webp'
import cldBarDown from './img/cld-bar-down.webp'
import cldTallUp from './img/cld-tall-up.webp'
import cldTallDown from './img/cld-tall-down.webp'
import cldVfd from './img/cld-vfd.webp'
import cldFace from './img/cld-face.webp'
import cldSub from './img/cld-sub.webp'
import cldFaceLight from './img/cld-face-light.webp'
import cldSubLight from './img/cld-sub-light.webp'
import cldDial from './img/cld-dial.webp'
import cldKnob from './img/cld-knob.webp'
import cldWheel from './img/cld-wheel.webp'
import cldWheelslot from './img/cld-wheelslot.webp'
import cldJack from './img/cld-jack.webp'
import cldPlug from './img/cld-plug.webp'
// The alternate design's own pieces: its hanging microphones and their cables, and its cabinet
// by day (cream, where the lead design's is silver).
import jack from './img/jack.webp'
import cableCore from './img/cable-core.webp'
import cableShade from './img/cable-shade.webp'
import micRed from './img/mic-red.webp'
import micBlue from './img/mic-blue.webp'
import plugLeft from './img/plug-left.webp'
import plugRight from './img/plug-right.webp'
import shellLightAlt from './img/shell-light-alt.webp'

const FILES = {
  'cld-key-up': cldKeyUp, 'cld-key-down': cldKeyDown, 'cld-silver-up': cldSilverUp, 'cld-silver-down': cldSilverDown, 'cld-bar-up': cldBarUp, 'cld-bar-down': cldBarDown, 'cld-tall-up': cldTallUp, 'cld-tall-down': cldTallDown, 'cld-vfd': cldVfd, 'cld-face': cldFace, 'cld-sub': cldSub, 'cld-face-light': cldFaceLight, 'cld-sub-light': cldSubLight, 'cld-dial': cldDial, 'cld-knob': cldKnob, 'cld-wheel': cldWheel, 'cld-wheelslot': cldWheelslot, 'cld-jack': cldJack, 'cld-plug': cldPlug,
  wheel,
  'lamp-off': lampOff, 'lamp-on': lampOn,
  brush, 'key-gray-up': keyGrayUp, 'key-gray-down': keyGrayDown,
  'key-red-up': keyRedUp, 'key-red-down': keyRedDown,
  'key-dark-up': keyDarkUp, 'key-dark-down': keyDarkDown,
  'key-wine-up': keyWineUp, 'key-wine-down': keyWineDown,
  'key-teal-up': keyTealUp, 'key-teal-down': keyTealDown,
  'key-white-up': keyWhiteUp, 'key-white-down': keyWhiteDown, 'key-white-lit': keyWhiteLit,
  'book-base': bookBase, 'book-stacks': bookStacks, 'book-rings': bookRings,
  'book-sheen': bookSheen, 'book-cover': bookCover, 'book-tabs': bookTabs,
}

const DARK = { wall, shell, glare, panel, grille, led, slot, drum, wheelslot }
const LIGHT = {
  wall: wallLight, shell: shellLight, glare: glareLight,
  panel: panelLight, grille: grilleLight, led: ledLight, slot: slotLight,
  drum: drumLight, wheelslot: wheelslotLight,
}

// --km-i-<name> for every image the two versions share, and --km-id-<name>
// and --km-il-<name> for the dark and light renders of the rest, to go on the
// root's style. The sheet picks between the last two.
const named = (prefix, files) => Object.entries(files).map(([name, src]) => [`--km-${prefix}-${name}`, `url("${src}")`])
export const IMAGE_VARS = Object.fromEntries([...named('i', FILES), ...named('id', DARK), ...named('il', LIGHT)])
// The alternate design draws on the same pictures and these besides.
const ALT_FILES = { jack, 'cable-core': cableCore, 'cable-shade': cableShade, 'mic-red': micRed, 'mic-blue': micBlue, 'plug-left': plugLeft, 'plug-right': plugRight }
export const ALT_IMAGE_VARS = { ...IMAGE_VARS, ...Object.fromEntries(named('i', ALT_FILES)), ...Object.fromEntries(named('il', { shell: shellLightAlt })) }

// What a key or a lamp turns into is fetched ahead, so the first press does
// not show a gap while its image arrives.
const LATER = [keyGrayDown, keyRedDown, keyDarkDown, keyWineDown, lampOn]
export function preloadImages() {
  if (typeof Image === 'undefined') return
  LATER.forEach((src) => { const img = new Image(); img.src = src })
}

// The songbook's pictures are asked for when the menu that offers it opens,
// and the binder waits for them (briefly) before it slides in, so that it
// never arrives as a blank board.
const BOOK = [bookBase, bookStacks, bookRings, bookSheen, bookCover, bookTabs]
let bookLoad = null
export function loadBookImages() {
  if (typeof Image === 'undefined') return Promise.resolve()
  bookLoad ||= Promise.all(BOOK.map((src) => new Promise((done) => {
    const img = new Image()
    img.onload = done
    img.onerror = done
    img.src = src
  })))
  return bookLoad
}
