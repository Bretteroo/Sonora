import React from 'react'
import * as Icon from './Icons.jsx'
import './caution.css'

// A service listed on a household sits in one of three states with respect to
// Sonora, and two of them deserve a mark on its icon:
//
//   'sonos'   on the Sonos system, not linked in Sonora: it can be seen but not
//             browsed until it is linked here. Yellow.
//   'sonora'  linked in Sonora, not on the Sonos system: it can be browsed but
//             the speakers cannot play it until it is added in the Sonos app.
//             Blue.
//
// An account-less service on the system needs no Sonora link, so it gets none.
export function serviceCaution(service) {
  if (!service) return null
  if (service.on_system === false) return 'sonora'
  const browsable = service.sonora_token ?? service.sonora_linked
  // A service whose home needs no credentials is browsable whatever Sonora
  // holds for it: Sonos Radio answers its browse endpoint anonymously, and
  // marking it cautioned put a warning on a service that opens perfectly
  // well and offers nothing to fix.
  if (!browsable && service.auth !== 'Anonymous' && !service.public_browse) return 'sonos'
  return null
}

// The mark itself. Small, a colored disc with a caution triangle overlaying
// the bottom-right corner of an icon (the parent must be positioned). Large, a
// colored oval beside the text that explains the state: the service's own
// logo sits in its left half and the triangle in its right, so the mark names
// the service it is about. `logo` is { icon, initials } for that.
export function CautionBadge({ kind, size = 'small', title, logo }) {
  if (!kind) return null
  return (
    <span className="svc-caution" data-kind={kind} data-size={size}
          role="img" aria-label={title} title={title}>
      {size === 'large' && (
        <span className="svc-caution-logo">
          {logo?.icon ? <img src={logo.icon} alt="" /> : <span>{logo?.initials ?? ''}</span>}
        </span>
      )}
      <Icon.Caution />
    </span>
  )
}
