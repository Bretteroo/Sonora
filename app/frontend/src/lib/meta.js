// Application metadata, in one place so the About dialog and anything else
// agree. The version is the one the backend serving the page puts in it
// (backend/release.py), so a bundle built before a version bump still names
// the right Sonora; package.json's is for the dev server, which has no tag.
import pkg from '../../package.json'

const served = typeof document === 'undefined'
  ? '' : document.querySelector('meta[name="sonora-version"]')?.content || ''

export const APP = {
  name: 'Sonora',
  version: served || pkg.version,
  license: pkg.license || 'AGPL-3.0-only',
  // Where someone who wants to can chip in. About shows it in every theme.
  donate: 'https://ko-fi.com/bretteroo',
  // Where Sonora's source is: AGPL-3.0-only's offer to everyone who uses a
  // copy over the network. About links to it in every theme.
  source: 'https://github.com/Bretteroo/Sonora',
}
