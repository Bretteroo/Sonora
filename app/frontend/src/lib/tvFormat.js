// What a soundbar says it is receiving on its television input.
//
// The speaker reports a number, HTAudioIn from DeviceProperties GetZoneInfo,
// and nothing on the local network names it. The codes and the names below
// are SoCo's AUDIO_INPUT_FORMATS (soco/core.py, MIT, see
// THIRD-PARTY-NOTICES.md), taken 2026-10-04 at commit 18effdc213. An Arc
// Ultra on HDMI read 84934718, "Dolby Multichannel PCM 5.1", while Sonos'
// cloud called the same stream Dolby MAT with five ground channels and one LFE
// (2026-10-04). Each name is a translation key, tvFormat.<code>.
export const TV_FORMAT_CODES = [
  0, 2, 7, 18, 21, 22, 59, 61, 63,
  33554434, 33554454, 33554488, 33554490, 33554492, 33554494,
  84934658, 84934713, 84934714, 84934716, 84934718, 84934721,
  118489090, 118489146, 118489148,
]

const KNOWN = new Set(TV_FORMAT_CODES)

/** The name of the format a soundbar on its TV input is receiving, or ''. */
export function tvFormat(transport, t) {
  if (!transport || transport.source !== 'tv') return ''
  const code = transport.tv_format_code
  if (code == null || !KNOWN.has(code)) return ''
  return t ? t(`tvFormat.${code}`) : ''
}

/**
 * The one line a theme shows under "TV" about the signal: "No Signal" when the
 * input is silent, otherwise the format's name, otherwise the cloud's own
 * description of the stream when signed in.
 */
export function tvSignalLine(transport, t) {
  if (!transport || transport.source !== 'tv') return ''
  if (transport.tv_signal === false) return t ? t('source.noSignal') : 'No Signal'
  return tvFormat(transport, t) || transport.tv_signal_text || ''
}
