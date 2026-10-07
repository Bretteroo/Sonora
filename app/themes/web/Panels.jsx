import React, { useEffect, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Overlay from './Overlay.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'

// Modal panels: grouping and the queue.

export function GroupPanel({ zone, onClose }) {
  const { actions, zones, groups, households } = useSystem()
  const { t } = useI18n()
  if (!zone) return null

  const household = households.find((h) => h.zone_uuids.includes(zone.uuid))
  const candidates = (household?.zone_uuids ?? [])
    .map((uuid) => zones[uuid])
    .filter(Boolean)

  const group = groups.find((g) => g.members.includes(zone.uuid))
  const memberSet = new Set(group?.members ?? [zone.uuid])

  return (
    <Overlay onClose={onClose} label={`Group with ${zone.name}`}>
      <h2>{t('web.group.title', { room: zone.name })}</h2>
      <p>{t('web.group.blurb', { room: zone.name })}</p>
      {candidates.map((candidate) => {
        const inGroup = memberSet.has(candidate.uuid)
        const isLeader = candidate.uuid === zone.uuid
        return (
          <div className="wb-group-row" key={candidate.uuid}>
            <span>
              {candidate.topology_label || candidate.name}
              {isLeader && <small> · {t('web.group.leads')}</small>}
            </span>
            {isLeader ? null : (
              <button
                type="button"
                className="wb-btn"
                data-variant={inGroup ? 'ghost' : undefined}
                onClick={() => (inGroup
                  ? actions.leave(candidate.uuid)
                  : actions.join(candidate.uuid, zone.uuid))}
              >
                {inGroup ? t('web.group.remove') : t('web.group.add')}
              </button>
            )}
          </div>
        )
      })}
      <div className="wb-panel-actions">
        <button type="button" className="wb-btn" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </Overlay>
  )
}

