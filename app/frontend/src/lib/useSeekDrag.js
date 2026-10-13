import { useCallback, useEffect, useRef, useState } from 'react'

// A seek slider's drag, for every theme's seek bar.
//
// While the slider moves, `drag` holds where it is, so the bar can show that rather than the
// clock. The seek is sent on the slider's own `change` event, which a browser fires once, after
// the last `input`, when the slider is let go (pointer, touch or key). The bars used to send it
// on pointer-up and clear the drag there; when an `input` landed after that, the drag stuck: the
// time froze, Material Girl's wave lay flat, and since a bar stays mounted when the room changes,
// it stayed so in every room. A new room also clears any drag.
//
// Firefox does not always fire that `change`: a click on a slider that does not have the focus
// moves it first and focuses it after, and at release the value matches the one it had when it
// was focused, so no `change` comes. Hi-Fi's bar jumped back on every click in "This browser".
// So a release also sends whatever is still waiting, just after the `change` would have come;
// when it did come there is nothing left to send.
export function useSeekDrag(roomId, onSeek) {
  const [drag, setDrag] = useState(null)
  const pending = useRef(null)
  const seek = useRef(onSeek)
  seek.current = onSeek
  useEffect(() => { pending.current = null; setDrag(null) }, [roomId])

  const commit = useCallback(() => {
    const at = pending.current
    pending.current = null
    setDrag(null)
    if (at != null) seek.current(at)
  }, [])
  const node = useRef(null)
  const ref = useCallback((el) => {
    if (node.current) node.current.removeEventListener('change', commit)
    node.current = el
    if (el) el.addEventListener('change', commit)
  }, [commit])

  const inputProps = {
    ref,
    onChange: (event) => { const at = Number(event.target.value); pending.current = at; setDrag(at) },
    onPointerUp: () => { setTimeout(() => { if (pending.current != null) commit() }, 0) },
    onBlur: () => { pending.current = null; setDrag(null) },
  }
  return { drag, inputProps }
}
