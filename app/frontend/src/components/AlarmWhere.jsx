import React from 'react'
// The alarm tables' "Room / Scene" column: each word with its mark letter in bold,
// and the mark that leads each row, R for a room and S for a scene (each language
// names its own letters).
export function RoomSceneHeading({ t }) {
  const word = (text, letter) => (text.startsWith(letter)
    ? <><b>{letter}</b>{text.slice(letter.length)}</> : <><b>{letter}</b> {text}</>)
  return <>{word(t('desk.alarms.room'), t('win.alarms.roomLetter'))} / {word(t('win.alarms.scene'), t('win.alarms.sceneLetter'))}</>
}
export function AlarmWhere({ alarm, t, empty = '' }) {
  const scene = Boolean(alarm.scene_name)
  return <><i className="alarm-kind" data-kind={scene ? 'scene' : 'room'}>{t(scene ? 'win.alarms.sceneLetter' : 'win.alarms.roomLetter')}</i>{alarm.scene_name || alarm.room || empty}</>
}
