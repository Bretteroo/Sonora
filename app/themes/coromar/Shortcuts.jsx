import React from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { Window } from './Dialogs.jsx'

// The app's Keyboard Shortcuts window (captured 2026-09-05): a sentence, a
// two-column table of function and key, a Done button. The keys are the
// app's own (KeyboardShortcutManager.cs) for everything Sonora performs;
// the ones a browser keeps for itself (Ctrl+T, Ctrl+L, Ctrl+W) are left out.
export default function Shortcuts({ onClose }) {
  const { t } = useI18n()
  const rows = [
    [t('desk.shortcuts.playPause'), 'Ctrl + P'],
    [t('win.shortcuts.toggleShuffle'), 'Ctrl + E'],
    [t('win.shortcuts.toggleRepeat'), 'Ctrl + R'],
    [t('win.shortcuts.toggleCrossfade'), 'Ctrl + Shift + X'],
    [t('desk.shortcuts.mute'), 'Ctrl + M'],
    [t('win.shortcuts.muteAll'), 'Ctrl + Shift + M'],
    [t('win.shortcuts.topMenu'), 'Ctrl + U'],
    [t('win.shortcuts.favorites'), 'Ctrl + *'],
    [t('win.shortcuts.scrollCurrent'), 'Ctrl + Shift + L'],
    [t('win.shortcuts.prevTrack'), 'Ctrl + \u2190'],
    [t('win.shortcuts.nextTrack'), 'Ctrl + \u2192'],
    [t('desk.shortcuts.volDown'), 'Ctrl + -'],
    [t('desk.shortcuts.volUp'), 'Ctrl + +'],
    [t('desk.shortcuts.nextZone'), 'Ctrl + .'],
    [t('desk.shortcuts.prevZone'), 'Ctrl + ,'],
    [t('win.shortcuts.playNext'), 'Shift + Enter'],
    [t('win.shortcuts.replaceQueue'), 'Ctrl + Shift + Q'],
    [t('win.shortcuts.playLater'), 'Ctrl + Q'],
    [t('win.shortcuts.resizeQueue'), 'Ctrl + G'],
    [t('desk.menu.updateLibrary'), 'Ctrl + Shift + I'],
    [t('win.shortcuts.showShortcuts'), 'Ctrl + K'],
    [t('win.shortcuts.toggleMini'), 'Ctrl + D'],
    [t('win.shortcuts.jumpSearch'), 'Ctrl + F'],
    [t('win.shortcuts.closeWindow'), 'Esc'],
    [t('desk.menu.help'), 'F1'],
  ]
  return (
    <Window title={t('desk.shortcuts.title')} onClose={onClose} className="win-shortcuts">
      <div className="win-shortcuts-body">
        <p><strong>{t('win.shortcuts.intro')}</strong></p>
        <div className="win-shortcuts-table" tabIndex={0}>
          <table>
            <thead><tr><th>{t('win.shortcuts.function')}</th><th>{t('win.shortcuts.shortcut')}</th></tr></thead>
            <tbody>{rows.map(([label, key]) => <tr key={key}><td>{label}</td><td>{key}</td></tr>)}</tbody>
          </table>
        </div>
        {/* The app has no such line, but three of its keys cannot be taken
            in a browser, so the substitutes are explained rather than left
            to look like mistakes. */}
        <p className="win-shortcuts-note">{t('win.shortcuts.browserNote')}</p>
      </div>
      <div className="win-dialog-foot">
        <button type="button" className="dk-win-btn" data-default="true" onClick={onClose}>{t('common.done')}</button>
      </div>
    </Window>
  )
}
