import React, { useEffect } from 'react'

// The desktop apps' transient message: a translucent dark box centered over
// the window (TransientMessageBackgroundStyle: #1F1F1F at 95%, 1px #262626,
// 6px corners, 280-410 wide) that fades after a few seconds. Used for a
// provider's confirmation after a rating.
export default function TransientMessage({ text, onDone, duration = 3000 }) {
  useEffect(() => {
    if (!text) return undefined
    const timer = setTimeout(onDone, duration)
    return () => clearTimeout(timer)
  }, [text, duration, onDone])
  if (!text) return null
  return (
    <div className="transient-message" role="status" onClick={onDone}>
      <p>{text}</p>
    </div>
  )
}
