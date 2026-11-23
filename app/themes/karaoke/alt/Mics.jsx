import React, { useEffect, useRef } from 'react'

// The machine's two microphones, each hanging by its cord from a plug in the
// cabinet's side. They control nothing. Each is a pendulum: poke it or pull
// it aside and let go, and it swings on its cord until it settles.
//
// The pictures are the sheet's: the plug stays where it is, and the cord,
// its coil, and the microphone turn together about the point where the cord
// leaves the plug, which is the top middle of the box. On a phone the cord
// comes from a socket on the faceplate instead.
//
// Out of the plug the cord turns down in a curve, drawn here as the microphone
// swings: it leaves the plug level and joins the hanging cord a little way
// below the point it swings from, so a cord pulled far opens into a wide bend
// rather than folding at one point. At rest the curve is the quarter turn the
// plug was modeled with. Its shadow is drawn the same way, set off to the side
// the light throws it, as the hanging cord's is. On a phone the cord comes up
// from a socket on the faceplate, and a round joint the cord's own thickness
// covers the turn there.
const SWING = 24      // gravity over cord length: sets how fast it swings
const DRAG = 1.1      // how quickly a swing dies away
const LIMIT = 1.15    // radians either side of straight down
const REST = { angle: 0.0015, speed: 0.012 }
// The bend, as shares of the microphone's width (the plug picture's measure): where the cord
// leaves the plug, how far it then turns down to the point it swings from, how far below
// that the curve joins the hanging cord, the cord's thickness, and its shadow's offset.
const EXIT = { x: 0.1543, y: -0.1995 }
const PIVOT_Y = -0.0463
const TURN = 0.1543
const REACH = 0.26
const THICK = 0.0741
const SHADE_X = 0.1574

// The curve from the plug to the hanging cord, for a cord swung by `angle`.
function bend(w, side, angle) {
  const m = side === 'left' ? 1 : -1
  const ex = w / 2 + EXIT.x * w * m
  const ey = EXIT.y * w
  const px = w / 2
  const py = PIVOT_Y * w
  const dx = Math.sin(angle)
  const dy = Math.cos(angle)
  const ax = px + dx * REACH * w
  const ay = py + dy * REACH * w
  const k1 = 0.552 * TURN * w
  const k2 = (0.552 * TURN + REACH) * w
  // It runs on a little past the join, under the hanging cord, so no seam shows there.
  const on = THICK * w
  return `M ${ex.toFixed(2)} ${ey.toFixed(2)} C ${(ex - m * k1).toFixed(2)} ${ey.toFixed(2)} ${(ax - dx * k2).toFixed(2)} ${(ay - dy * k2).toFixed(2)} ${ax.toFixed(2)} ${ay.toFixed(2)} L ${(ax + dx * on).toFixed(2)} ${(ay + dy * on).toFixed(2)}`
}

function Mic({ side }) {
  const arm = useRef(null)
  const shade = useRef(null)
  const cord = useRef(null)
  const cordShade = useRef(null)
  useEffect(() => {
    const el = arm.current
    const dark = shade.current
    if (!el) return undefined
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let angle = 0
    let speed = 0
    let frame = 0
    let last = 0
    let held = false
    let track = []
    const draw = () => {
      const turn = `rotate(${(-angle * 180) / Math.PI}deg)`
      el.style.transform = turn
      if (dark) dark.style.transform = `translateX(var(--km-mic-shade-x)) ${turn}`
      const w = el.parentElement.offsetWidth
      if (w && cord.current && getComputedStyle(cord.current).display !== 'none') {
        const d = bend(w, side, angle)
        for (const path of cord.current.querySelectorAll('path')) path.setAttribute('d', d)
        if (cordShade.current) {
          cordShade.current.setAttribute('transform', `translate(${(SHADE_X * w).toFixed(2)} 0)`)
          // The shadow stops at the join, where the hanging cord's own shadow fades in over the
          // same short way, so neither lies over the other at full strength.
          const far = THICK * w * 0.5
          const longer = d.replace(/L [^ ]+ [^ ]+$/, () => {
            const [ax, ay] = d.match(/C .* ([-\d.]+) ([-\d.]+) L/).slice(1).map(Number)
            return `L ${(ax + Math.sin(angle) * far).toFixed(2)} ${(ay + Math.cos(angle) * far).toFixed(2)}`
          })
          for (const path of cordShade.current.querySelectorAll('path')) path.setAttribute('d', longer)
          const soft = cordShade.current.ownerSVGElement?.querySelector('feGaussianBlur')
          if (soft) soft.setAttribute('stdDeviation', (0.04 * w).toFixed(2))
        }
      }
    }
    draw()
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw)
    resized?.observe(el.parentElement)
    const step = (now) => {
      frame = 0
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016)
      last = now
      if (!held) {
        if (still?.matches) {
          // Without the swinging: it eases straight back to rest.
          speed = 0
          angle *= Math.exp(-dt * 9)
        } else {
          speed += (-SWING * Math.sin(angle) - DRAG * speed) * dt
          angle += speed * dt
          if (Math.abs(angle) > LIMIT) { angle = Math.sign(angle) * LIMIT; speed *= -0.35 }
        }
        if (Math.abs(angle) < REST.angle && Math.abs(speed) < REST.speed) { angle = 0; speed = 0; draw(); return }
      }
      draw()
      frame = requestAnimationFrame(step)
    }
    const run = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(step) } }
    // The angle from the plug to the pointer: straight down is none.
    const toward = (event) => {
      const pivot = el.parentElement.getBoundingClientRect()
      const x = event.clientX - (pivot.left + pivot.width / 2)
      const y = Math.max(24, event.clientY - pivot.top)
      return Math.max(-LIMIT, Math.min(LIMIT, Math.atan2(x, y)))
    }
    const down = (event) => {
      if (event.button) return
      held = true
      speed = 0
      track = [{ at: performance.now(), angle }]
      el.setPointerCapture?.(event.pointerId)
      el.dataset.held = ''
      event.preventDefault()
    }
    const move = (event) => {
      if (held) {
        angle = toward(event)
        const now = performance.now()
        track.push({ at: now, angle })
        while (track.length > 2 && now - track[0].at > 90) track.shift()
        draw()
      } else if (event.pointerType === 'mouse' && Math.abs(event.movementX) > 3) {
        // Brushed in passing: a nudge the way the pointer was going.
        speed += Math.max(-1.6, Math.min(1.6, event.movementX * 0.03))
        run()
      }
    }
    const up = (event) => {
      if (!held) return
      held = false
      delete el.dataset.held
      el.releasePointerCapture?.(event.pointerId)
      const first = track[0]
      const span = (performance.now() - first.at) / 1000
      // Let go mid-swing it keeps the pace it had; pressed and let go where it hung, it gets a poke.
      speed = span > 0.01 ? Math.max(-9, Math.min(9, (angle - first.angle) / span)) : 0
      if (Math.abs(angle) < 0.02 && Math.abs(speed) < 0.3) speed = side === 'left' ? -2.4 : 2.4
      run()
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      resized?.disconnect()
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [side])
  return (
    <div className="km-mic" data-side={side} aria-hidden="true">
      <div className="km-mic-shade" ref={shade}>
        <span className="km-mic-reach" />
        <span className="km-mic-cable-shade" />
        <span className="km-mic-piece-space" />
      </div>
      <span className="km-mic-joint-shade" />
      <svg className="km-mic-bend-shade" aria-hidden="true" focusable="false">
        <filter id={`km-cord-soft-${side}`} filterUnits="userSpaceOnUse" x="-200" y="-200" width="600" height="600"><feGaussianBlur stdDeviation="3" /></filter>
        <g ref={cordShade}><path className="km-mic-bend-shade-core" filter={`url(#km-cord-soft-${side})`} /></g>
      </svg>
      <span className="km-mic-plug" />
      <svg className="km-mic-bend" ref={cord} aria-hidden="true" focusable="false">
        <path className="km-mic-bend-body" /><path className="km-mic-bend-sheen" />
      </svg>
      <span className="km-mic-joint" />
      <span className="km-mic-jack" />
      <div className="km-mic-arm" ref={arm}>
        <span className="km-mic-reach" />
        <span className="km-mic-cable" />
        <span className="km-mic-piece" />
      </div>
    </div>
  )
}

export default function Mics() {
  return (
    <>
      <Mic side="left" />
      <Mic side="right" />
    </>
  )
}
