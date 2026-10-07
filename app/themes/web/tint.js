import { useEffect, useRef, useState } from 'react'

// The color the product paints a room in.
//
// Measured on play.sonos.com 2026-09-19: the active room's card, the Now
// Playing panel and the grouping panel all carry the same color, taken from
// whatever that room is playing -- rgb(98,29,42) under a maroon cover,
// rgb(112,59,41) under an orange one -- while every other card keeps the
// ordinary surface. The picture comes through Sonora's own origin, so a
// canvas may read it; a cover that will not load leaves the surface alone.
//
// The product cannot always do this. It loads covers straight from the
// service's host, and one that sends no CORS header (Audacy's
// radioimg.audacy.com, 1010 WINS) taints its canvas, so its card stays gray
// there. That gray is a failure, not the design, and Sonora keeps the cover's
// color.
//
// The dim text on a tinted surface is the same color lifted: the product's
// artist line under a track, and the second line of a room's card, is the
// tint's own hue and saturation with half a turn of lightness added. Two
// covers measured on 2026-09-21 give it exactly -- rgb(110,69,33) paints
// rgb(229,197,169) and rgb(79,71,43) paints rgb(208,200,169) -- where Sonora
// had been using the palette's cool gray, which sat oddly on a warm card.
//
// The shade is the cover's own average, not a darkened one. Measured again on
// 2026-09-21 against the same picture the product had up: Chet Baker's
// "Summertime" cover averages rgb(80,72,44) over a 16x16 sample and the
// product's card reads rgb(79,71,43). An earlier pass had darkened it to 0.6
// of that, which left every card nearly black beside theirs.

// The card's own controls -- the play disc, the foot discs, the room pill --
// are the tint half a step lighter, not a gray or a white laid over it: a card
// of rgb(123,38,30) carries discs of rgb(144,44,35) and one of rgb(66,47,54)
// carries rgb(81,57,66), which in both cases is the same hue and saturation
// with 0.05 added to the lightness (play.sonos.com, 2026-09-21). White at 9%
// came close on one channel and missed the other two.
//
// A light cover does not make a light card: the product keeps the average's
// hue and saturation and takes its lightness no higher than 0.30. Scott
// Hamilton's "Night Spot" cover, cream with brown ink, averages rgb(198,171,125)
// at a lightness of 0.63 and the product's card reads rgb(105,84,48) -- the
// same hue to a tenth of a degree, the same saturation, lightness exactly 0.30
// (both clients side by side on the same track, 2026-09-21). Every darker
// cover measured sits below that and passes through untouched, which is why
// the averages matched before this one turned up.
const CEILING = 0.3
// And a dark one does not make a black card: the lightness is kept no lower
// than 0.10. Dr. Dre's "2001", black with green ink, averages rgb(7,11,11) at
// a lightness of 0.035, and the product's queue panel and card read
// rgb(19,32,31) -- the same hue and saturation at 0.10 -- with the artist
// line at the usual half turn lighter, rgb(126,180,175) (play.sonos.com,
// 2026-09-22). Sonora had painted rgb(9,12,12).
const FLOOR = 0.1

function hsl([r, g, b]) {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    const [rr, gg, bb] = [r / 255, g / 255, b / 255]
    h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, Math.max(FLOOR, Math.min(l, CEILING))]
}

function paint([h, s, l], by = 0) {
  const light = Math.min(1, l + by)
  const c = (1 - Math.abs(2 * light - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  const sixth = Math.floor(h / 60) % 6
  const [pr, pg, pb] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sixth]
  const out = [pr, pg, pb].map((v) => Math.round((v + m) * 255))
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`
}

export function useTint(src) {
  const [tint, setTint] = useState(null)
  const seen = useRef({})
  useEffect(() => {
    if (!src) { setTint(null); return undefined }
    if (seen.current[src]) { setTint(seen.current[src]); return undefined }
    let canceled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (canceled) return
      try {
        const canvas = document.createElement('canvas')
        // 32 on a side, not 16: Firefox shrinks a picture by sampling it, and
        // at 16 it read "2001" as rgb(9,12,12) where the cover's true average
        // is rgb(7,11,11) -- half the saturation, and a grayer card than the
        // product's. At 32 the sample and the average agree (2026-09-22).
        canvas.width = canvas.height = 32
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(image, 0, 0, 32, 32)
        const { data } = ctx.getImageData(0, 0, 32, 32)
        let r = 0, g = 0, b = 0
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2] }
        const pixels = data.length / 4
        const mix = (channel) => Math.round(channel / pixels)
        const shade = hsl([mix(r), mix(g), mix(b)])
        const found = {
          color: paint(shade),
          text: paint(shade, 0.5),
          raise: paint(shade, 0.05),
        }
        seen.current[src] = found
        setTint(found)
      } catch {
        setTint(null)          // a tainted canvas: no tint rather than a throw
      }
    }
    image.onerror = () => { if (!canceled) setTint(null) }
    image.src = src
    return () => { canceled = true }
  }, [src])
  return tint
}
