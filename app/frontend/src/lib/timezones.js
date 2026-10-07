// The names the S1 apps show for the speakers' time-zone table.
//
// The firmware keeps a fixed table of 75 zones addressed by index in
// AlarmClock#SetTimeZone, carrying each entry's UTC offset and DST rule but no
// name. The apps label them with the classic Windows zone list, which this
// mirrors. `offset` is minutes east of UTC and `dst` whether the entry carries
// a daylight-saving rule; a label is used only when the speaker's own entry at
// that index agrees on both, so a firmware with a different table falls back
// to the bare offset rather than naming the wrong place.
export const TIMEZONES = [
  ['International Date Line West', -720, false],
  ['Midway Island, Samoa', -660, false],
  ['Hawaii', -600, false],
  ['Alaska', -540, true],
  ['Pacific Time (US & Canada); Tijuana', -480, true],
  ['Arizona', -420, false],
  ['Chihuahua, La Paz, Mazatlan', -420, false],
  ['Mountain Time (US & Canada)', -420, true],
  ['Central America', -360, false],
  ['Central Time (US & Canada)', -360, true],
  ['Guadalajara, Mexico City, Monterrey', -360, false],
  ['Saskatchewan', -360, false],
  ['Bogota, Lima, Quito', -300, false],
  ['Eastern Time (US & Canada)', -300, true],
  ['Indiana (East)', -300, true],
  ['Atlantic Time (Canada)', -240, true],
  ['Caracas, La Paz', -240, false],
  ['Santiago', -240, true],
  ['Newfoundland', -210, true],
  ['Brasilia', -180, true],
  ['Buenos Aires, Georgetown', -180, false],
  ['Greenland', -180, true],
  ['Mid-Atlantic', -120, false],
  ['Azores', -60, true],
  ['Cape Verde Is.', -60, false],
  ['Casablanca, Monrovia', 0, false],
  ['Greenwich Mean Time: Dublin, Edinburgh, Lisbon, London', 0, true],
  ['Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna', 60, true],
  ['Belgrade, Bratislava, Budapest, Ljubljana, Prague', 60, true],
  ['Brussels, Copenhagen, Madrid, Paris', 60, true],
  ['Sarajevo, Skopje, Warsaw, Zagreb', 60, true],
  ['West Central Africa', 60, false],
  ['Athens, Istanbul, Minsk', 120, true],
  ['Bucharest', 120, true],
  ['Cairo', 120, false],
  ['Harare, Pretoria', 120, false],
  ['Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius', 120, true],
  ['Jerusalem', 120, true],
  ['Baghdad', 180, false],
  ['Kuwait, Riyadh', 180, false],
  ['Moscow, St. Petersburg, Volgograd', 180, false],
  ['Nairobi', 180, false],
  ['Tehran', 210, true],
  ['Abu Dhabi, Muscat', 240, false],
  ['Baku, Tbilisi, Yerevan', 240, false],
  ['Kabul', 270, false],
  ['Ekaterinburg', 300, false],
  ['Islamabad, Karachi, Tashkent', 300, false],
  ['Chennai, Kolkata, Mumbai, New Delhi', 330, false],
  ['Kathmandu', 345, false],
  ['Almaty, Novosibirsk', 360, false],
  ['Astana, Dhaka', 360, false],
  ['Sri Jayawardenepura', 360, false],
  ['Rangoon', 390, false],
  ['Bangkok, Hanoi, Jakarta', 420, false],
  ['Krasnoyarsk', 420, false],
  ['Beijing, Chongqing, Hong Kong, Urumqi', 480, false],
  ['Irkutsk, Ulaan Bataar', 480, false],
  ['Kuala Lumpur, Singapore', 480, false],
  ['Perth', 480, false],
  ['Taipei', 480, false],
  ['Osaka, Sapporo, Tokyo', 540, false],
  ['Seoul', 540, false],
  ['Yakutsk', 540, false],
  ['Adelaide', 570, true],
  ['Darwin', 570, false],
  ['Brisbane', 600, false],
  ['Canberra, Melbourne, Sydney', 600, true],
  ['Guam, Port Moresby', 600, false],
  ['Hobart', 600, true],
  ['Vladivostok', 600, false],
  ['Magadan, Solomon Is., New Caledonia', 660, false],
  ['Auckland, Wellington', 720, true],
  ['Fiji, Kamchatka, Marshall Is.', 720, false],
  ["Nuku'alofa", 780, false],
]

export function offsetLabel(minutes) {
  const sign = minutes < 0 ? '-' : '+'
  const a = Math.abs(minutes)
  return `(GMT${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')})`
}

// The label for one entry of the speaker's table, named only when it matches.
export function zoneLabel(entry) {
  const known = TIMEZONES[entry.index]
  const base = offsetLabel(entry.offset)
  if (known && known[1] === entry.offset && known[2] === entry.dst) return `${base} ${known[0]}`
  return base
}
