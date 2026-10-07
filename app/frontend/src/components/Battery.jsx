import React from 'react'
import { useI18n } from '../i18n/index.jsx'

// A portable speaker's battery, as a room shows it (backend/sonos/battery.py).
//
// The S1 Windows app draws it under the player's name in the room tile: a
// 20x12 battery whose fill follows the level, a charging bolt over it while
// on wall power, and the percentage beside it in small type
// (zoneplayercontrol.xaml's zoneAdornmentContainer, ZonePlayerViewModel).
// At 10% or less the level counts as low (LOW_VALUE). The drawing here is
// Sonora's own; each theme places it and colors it through the classes:
//
//   .sn-battery            the whole gauge, data-low and data-charging on it
//   .sn-battery-glyph      the SVG; its body is currentColor
//   .sn-battery-fill       the level, also currentColor unless a theme says
//   .sn-battery-bolt       the charging mark
//   .sn-battery-text       the percentage
//
// The S2 desktop app (17.2.3) prints the percentage with an empty space where
// the battery should be; Sonora does not copy that.

export const BATTERY_LOW = 10

export function batteryShown(zone) {
  return Boolean(zone?.battery && zone.online !== false && Number.isFinite(zone.battery.level))
}

/** A room or group's battery: the lowest of its members that have one. */
export function groupBattery(members) {
  const found = (members || []).filter(batteryShown).map((m) => m.battery)
  return found.length ? found.reduce((a, b) => (b.level < a.level ? b : a)) : null
}

export function BatteryGlyph({ level = 0, charging = false, className = '' }) {
  const fill = Math.max(0, Math.min(100, level)) / 100
  return (
    <svg className={`sn-battery-glyph ${className}`} viewBox="0 0 20 12" width="20" height="12" aria-hidden="true" focusable="false">
      <rect x="0.75" y="0.75" width="16.5" height="10.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="18" y="4" width="1.75" height="4" rx="0.6" fill="currentColor" />
      <rect className="sn-battery-fill" x="2.5" y="2.5" width={13 * fill} height="7" rx="0.8" fill="currentColor" />
      {charging && (
        <path className="sn-battery-bolt" d="M10.2 1.6 6.4 6.6h2.9l-1 3.8 3.9-5.1H9.3z"
              fill="currentColor" stroke="var(--sn-battery-bolt-edge, Canvas)" strokeWidth="1.2" paintOrder="stroke" />
      )}
    </svg>
  )
}

export default function Battery({ battery, className = '', text = true }) {
  const { t } = useI18n()
  if (!battery || !Number.isFinite(battery.level)) return null
  const low = battery.level <= BATTERY_LOW
  const label = t(battery.charging ? 'desk.rooms.batteryCharging' : 'desk.rooms.battery', { level: battery.level })
  return (
    <span className={`sn-battery ${className}`} data-low={low || undefined} data-charging={battery.charging || undefined}
          role="img" aria-label={label} title={label}>
      <BatteryGlyph level={battery.level} charging={battery.charging} />
      {text && <span className="sn-battery-text">{t('desk.rooms.batteryLevel', { level: battery.level })}</span>}
    </span>
  )
}
