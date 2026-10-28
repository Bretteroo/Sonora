import React, { useEffect, useRef } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { Window } from './Dialogs.jsx'

// The 2018 app's wizard window (wizardwindow.xaml with the generic page
// templates of genericwizarddatatemplates.xaml): a 514x516 window whose white
// body holds one page of components, over a gray foot with Back, Next and
// Cancel. The app's core sends each page as a list of components; a page
// here is the same list:
//
//   { kind: 'alert' }                    the gray exclamation mark, centered
//   { kind: 'spinner' }                  the busy ring, centered
//   { kind: 'title', text }              14px bold, 25px under it
//   { kind: 'body', text }               13px on an 18px line, 18px under it
//   { kind: 'buttons', items: [...] }    240px buttons stacked 10px apart,
//                                        centered, pushed to the page's foot
//   { kind: 'field', label, value, onChange, secure, autoFocus }
//   { kind: 'choice', items: [{ id, label }], value, onChange }
//   { kind: 'node', node }               anything a flow draws itself
//
// `foot` says which of Back, Next and Cancel are live and what they do; a
// missing handler leaves the button there and disabled, as the app's are.
export default function Wizard91({ title, page, foot = {}, onClose }) {
  const { t } = useI18n()
  const items = page || []
  const top = items.filter((c) => c.kind !== 'buttons')
  const buttons = items.find((c) => c.kind === 'buttons')
  const firstButton = useRef(null)
  useEffect(() => { firstButton.current?.focus() }, [page])
  return (
    <Window title={title} onClose={onClose} className="win-wizard w91-wizard">
      <div className="win-wizard-body w91-wizard-body">
        <div className="w91-wizard-top">
          {top.map((c, i) => <Component key={i} c={c} />)}
        </div>
        {buttons && (
          <div className="w91-wizard-buttons">
            {buttons.items.map((b, i) => (
              <button key={b.label} type="button" className="w91-wizard-btn" ref={i === 0 ? firstButton : undefined}
                      disabled={b.disabled} onClick={b.onClick}>{b.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="win-dialog-foot win-wizard-foot">
        <button type="button" className="dk-win-btn" disabled={!foot.back} onClick={foot.back}>{t('common.back')}</button>
        <button type="button" className="dk-win-btn" data-default="true" disabled={!foot.next} onClick={foot.next}>
          {foot.nextLabel || t('common.next')}
        </button>
        <button type="button" className="dk-win-btn" disabled={!foot.cancel} onClick={foot.cancel}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}

function Component({ c }) {
  switch (c.kind) {
    case 'alert':
      return <span className="w91-wizard-alert" aria-hidden="true" />
    case 'spinner':
      return <span className="w91-wizard-spinner" role="progressbar" aria-busy="true" />
    case 'title':
      return <h3 className="w91-wizard-title">{c.text}</h3>
    case 'body':
      return <p className="w91-wizard-text">{c.text}</p>
    case 'field':
      return (
        <label className="w91-wizard-field">
          <span>{c.label}</span>
          <input type={c.secure ? 'password' : 'text'} value={c.value} autoFocus={c.autoFocus}
                 autoComplete={c.secure ? 'current-password' : 'off'} spellCheck={false}
                 onChange={(e) => c.onChange(e.target.value)} />
        </label>
      )
    case 'choice':
      return (
        <div className="w91-wizard-choice" role="radiogroup">
          {c.items.map((item) => (
            <label key={item.id} className="w91-wizard-radio">
              <input type="radio" checked={c.value === item.id} onChange={() => c.onChange(item.id)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      )
    case 'node':
      return c.node
    default:
      return null
  }
}
