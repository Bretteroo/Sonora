// Application metadata, in one place so the About dialog and anything else
// agree. The version tracks package.json rather than a second copy.
import pkg from '../../package.json'

export const APP = {
  name: 'Sonora',
  version: pkg.version,
  license: pkg.license || 'AGPL-3.0-only',
  // Where someone who wants to can chip in. About shows it in every theme.
  donate: 'https://ko-fi.com/bretteroo',
  // Where Sonora's source is: AGPL-3.0-only's offer to everyone who uses a
  // copy over the network. About links to it in every theme.
  source: 'https://github.com/Bretteroo/Sonora',
}
