import React from 'react'
import { useSystem } from '../lib/store.jsx'
import { useI18n } from '../i18n/index.jsx'
import ThemePicker from './ThemePicker.jsx'
import LanguagePicker from './LanguagePicker.jsx'
import logo from '../assets/sonora.png'
import wordmark from '../assets/wordmark-readme.png'

// The start-up and failure screens. While speakers are still being looked
// for there is nothing to act on, so that screen is the logo, a title and a
// line of explanation and no controls at all; the
// empty and error screens keep "Search again" and the pickers. The crash
// screen, shown when a theme throws, offers a reload and the pickers, so a
// broken theme can be left without clearing the browser's storage.
// It is drawn in the theme's background and text colors; a theme whose text
// is meant for its windows rather than its background restyles .splash-card.
export default function Splash({ kind, detail }) {
  const { actions, connected } = useSystem()
  const { t } = useI18n()
  const which = ['loading', 'empty', 'error', 'crash'].includes(kind) ? kind : 'error'
  const quiet = which === 'loading'
  const crashed = which === 'crash'

  return (
    <div className="splash" style={styles.wrap}>
      <div className="splash-card" style={styles.card}>
        <img src={logo} alt="" width={96} height={96} style={styles.logo} draggable="false" />
        <img src={wordmark} alt="Sonora" width={230} height={77} style={styles.wordmark} draggable="false" />
        <h1 style={styles.title}>
          {t(`splash.${which}.title`)}
          {quiet && (
            // Three dots that light up in turn while the search goes on.
            <span className="splash-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
          )}
        </h1>
        <p style={styles.detail}>{detail || t(`splash.${which}.detail`)}</p>
        {!quiet && (
          <button type="button" style={styles.button}
            onClick={crashed ? () => window.location.reload() : actions.refresh}>
            {t(crashed ? 'splash.reload' : 'splash.searchAgain')}
          </button>
        )}
        {!quiet && !crashed && (
          <p style={styles.status}>
            {connected ? t('splash.connected') : t('splash.notConnected')}
          </p>
        )}
        {!quiet && (
          <div style={styles.pickers}>
            <ThemePicker />
            <LanguagePicker />
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'grid',
    placeItems: 'center',
    // The viewport's height, so the card sits centered rather than at the top.
    minHeight: '100vh',
    padding: 24,
    background: 'var(--t-bg, #f6f6f7)',
  },
  card: { maxWidth: 460, textAlign: 'center' },
  logo: { display: 'block', margin: '0 auto 10px', borderRadius: '50%' },
  wordmark: { display: 'block', margin: '0 auto 26px', width: 230, height: 'auto' },
  title: { margin: '0 0 12px', fontSize: 22, fontWeight: 600 },
  detail: {
    margin: '0 0 20px',
    lineHeight: 1.5,
    color: 'var(--t-fg-muted, #666)',
  },
  button: {
    padding: '9px 18px',
    borderRadius: 8,
    background: 'var(--t-accent, #111)',
    color: 'var(--t-accent-fg, #fff)',
    fontWeight: 500,
  },
  status: { marginTop: 20, fontSize: 12, color: 'var(--t-fg-muted, #888)' },
  pickers: {
    display: 'flex', gap: 14, justifyContent: 'center', marginTop: 22,
    flexWrap: 'wrap',
  },
}
