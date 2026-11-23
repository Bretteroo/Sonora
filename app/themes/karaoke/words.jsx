import React, { useEffect, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'

// The keys on the machine's face are lettered twice: Korean first, as it left
// the factory, and under it the same word in the reader's language. A reader
// whose language is Korean gets English underneath, as the export models did.
// Only the keys are lettered this way; what the screen shows is in the
// reader's language alone. Each entry: the Korean, the catalog key for the
// second line, and the English a Korean reader sees there.
const WORDS = {
  restart: ['처음부터', 'km.restart', 'Restart'],
  previous: ['이전곡', 'common.previous', 'Previous'],
  prev: ['이전곡', 'km.prev', 'Prev'],
  play: ['시작', 'common.play', 'Play'],
  start: ['시작', 'km.start', 'Start'],
  playPause: ['재생/일시정지', 'desk.shortcuts.playPause', 'Play/Pause'],
  pause: ['일시정지', 'common.pause', 'Pause'],
  stop: ['정지', 'common.stop', 'Stop'],
  next: ['다음곡', 'common.next', 'Next'],
  volume: ['음량', 'km.volume', 'Volume'],
  volMin: ['최소', 'km.volMin', 'Min'],
  volMax: ['최대', 'km.volMax', 'Max'],
  progress: ['진행시간', 'km.progress', 'Progress'],
  mute: ['음소거', 'common.mute', 'Mute'],
  unmute: ['소리 켜기', 'common.unmute', 'Unmute'],
  rooms: ['방목록', 'km.prog.rooms', 'Rooms'],
  settings: ['설정', 'common.settings', 'Settings'],
  queue: ['예약목록', 'common.queue', 'Queue'],
  songbook: ['노래책', 'km.book', 'Songbook'],
  full: ['전체화면', 'km.fullScreen', 'Full screen'],
  window: ['화면 축소', 'km.exitFullScreen', 'Exit full screen'],
  cancel: ['취소', 'common.cancel', 'Cancel'],
  number: ['선곡번호', 'km.songNumber', 'Song number'],
  songEntry: ['번호 입력', 'km.songEntry', 'Song entry'],
  room: ['방', 'km.room', 'Room'],
  songPanel: ['선곡', 'km.panelSong', 'Song selection'],
  playPanel: ['재생', 'km.panelPlay', 'Playback'],
  sync: ['싱크', 'km.panelSyncShort', 'Sync'],
  scroll: ['스크롤', 'km.panelScroll', 'Scroll'],
  lyricSync: ['가사 싱크', 'km.panelSync', 'Lyric sync'],
  syncZero: ['영점', 'km.syncZero', 'Reset to zero'],
  more: ['펼치기', 'km.more', 'More'],
  less: ['접기', 'km.less', 'Less'],
}

// word(name) answers { ko, second, label }: the two lines as lettered, and
// the one a screen reader is given (the reader's own language, not both).
export function useWords() {
  const { t, language } = useI18n()
  const korean = language === 'ko-KR'
  return (name) => {
    const [ko, key, english] = WORDS[name]
    const second = korean ? english : t(key)
    return { ko, second, label: korean ? ko : second }
  }
}

export function Words({ name, className = '' }) {
  const word = useWords()(name)
  return (
    <span className={`km-words ${className}`.trim()} aria-hidden="true">
      <span className="km-ko" lang="ko">{word.ko}</span>
      <span className="km-second">{word.second}</span>
    </span>
  )
}

// Lettering that changes while it is looked at: the old words fade out, then the
// new ones fade in where they were.
const FADE_MS = 200
export function FadingWords({ name, className = '' }) {
  const word = useWords()
  const [shown, setShown] = useState(name)
  useEffect(() => {
    if (name === shown) return undefined
    const timer = setTimeout(() => setShown(name), FADE_MS)
    return () => clearTimeout(timer)
  }, [name, shown])
  const { ko, second } = word(shown)
  return (
    <span className={`km-words km-words-fading ${className}`.trim()} aria-hidden="true" data-out={name !== shown ? '' : undefined}>
      <span className="km-ko" lang="ko">{ko}</span>
      <span className="km-second">{second}</span>
    </span>
  )
}
