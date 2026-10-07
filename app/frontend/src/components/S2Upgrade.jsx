import React, { useEffect, useState } from 'react'
import { useSystem } from '../lib/store.jsx'
import { useI18n } from '../i18n/index.jsx'
import { orderedHouseholds } from '../lib/format.js'
import { upgradePlan, formatUsd, s2Status, s21Status, S1_UPDATE_URL, S2_REPLACEMENTS, PRICES_CHECKED, PRODUCT_ERAS, ERA_MARKS, S2_LAUNCH_URL, S21_LAUNCH_URL } from '../lib/s2upgrade.js'
import { amazonLink } from '../lib/sonosProducts.js'
import './s2upgrade.css'

// The Sonos Upgrade Advisor, one page shared by every theme's Settings.
//
// It answers a question this controller is in an unusual position to answer,
// since it is the thing still driving the S1 half of the house: what would it
// take to leave S1 behind. The timeline shows how the three generations were
// sold, and then the reader picks a course of action. Only the chosen one's
// figures are drawn -- the two upgrade totals overlap, and reading them side
// by side invited adding them together.
//
// What the courses are depends on what is in the house. A house on both
// systems can keep them apart, which costs nothing and so says so in a line
// rather than in a table; a house wholly on S2 has no S1 half to move and is
// asked only how far past S2.0 it wants to go. The paying answers lead with
// the bill (what it costs, with a link to buy each thing) and then the
// inventory the bill was built from.
//
// A house already wholly on S2.1 is asked nothing: there is no course of
// action to pick, so the choice and the bills give way to a line saying so.
//
// Why the two platforms exist at all is in docs/DEVELOPING.md, not here.
//
// Given `onClose` it draws itself as a dialog, which is how the desktop shells
// and the web theme open it. Without it, it is page content inside whatever
// settings frame the theme already has.

// The three generations as bars on one axis of years, from the ZonePlayer 100
// to now. The bars overlap on purpose: Sonos sold each generation alongside
// the last for years, which is why one home ends up straddling two of them,
// and why this page exists.
function EraTimeline({ t }) {
  const first = Math.min(...PRODUCT_ERAS.map((era) => era.from))
  // The axis runs to the end of the current year so an open era reaches the
  // right edge and a mark placed this year still lands inside it.
  const last = new Date().getFullYear() + 1
  const at = (year) => `${((year - first) / (last - first)) * 100}%`
  const ticks = []
  for (let year = first; year < last; year += 5) ticks.push(year)
  return (
    <section className="s2-section s2-timeline" aria-labelledby="s2-timeline-title">
      <h3 id="s2-timeline-title">{t('s2.timelineTitle')}</h3>
      <div className="s2-tl" role="img" aria-label={PRODUCT_ERAS.map((era) => `${t(`s2.era.${era.key}`)}: ${
        era.to ? t('s2.eraSpan', { from: era.from, to: era.to }) : t('s2.eraOpen', { from: era.from })}`).join('; ')}>
        <div className="s2-tl-marks" aria-hidden="true">
          {ERA_MARKS.map((mark) => (
            <div key={mark.key} className="s2-tl-mark" style={{ left: at(mark.year) }}>
              <span>{t(`s2.mark.${mark.key}`)}</span>
            </div>
          ))}
        </div>
        {PRODUCT_ERAS.map((era) => (
          <div key={era.key} className="s2-tl-row">
            <span className="s2-tl-label"><span className="s2-tier" data-tier={era.tier}>{t(`s2.era.${era.key}`)}</span></span>
            <div className="s2-tl-track">
              <div className="s2-tl-bar" data-tier={era.tier}
                   style={{ left: at(era.from), width: `calc(${at((era.to ?? last - 1) + 1)} - ${at(era.from)})` }}>
                <span>{era.to ? t('s2.eraSpan', { from: era.from, to: era.to }) : t('s2.eraOpen', { from: era.from })}</span>
              </div>
            </div>
            <small className="s2-tl-bounds">{t(`s2.eraBounds.${era.key}`)}</small>
          </div>
        ))}
        <div className="s2-tl-axis" aria-hidden="true">
          {ticks.map((year) => <span key={year} style={{ left: at(year) }}>{year}</span>)}
        </div>
      </div>
      {/* Sonos' own words on the two moments the marks stand for. */}
      <p className="s2-fine s2-links">
        {t('s2.linksIntro')}{' '}
        <a href={S2_LAUNCH_URL} target="_blank" rel="noopener noreferrer">{t('s2.linkS2Launch')}</a>
        {' · '}
        <a href={S21_LAUNCH_URL} target="_blank" rel="noopener noreferrer">{t('s2.linkS21Launch')}</a>
      </p>
    </section>
  )
}

export default function S2Upgrade({ onClose = null }) {
  const { households } = useSystem()
  const { t } = useI18n()
  const plan = upgradePlan(orderedHouseholds(households))
  // Whether the table needs a column naming which system each room is on.
  // This is the plan's own list of households, not the question of whether a
  // system picker is worth drawing, and a bulk edit once confused
  // the two by replacing the substring inside `plan.households.length > 1` --
  // which made this `plan.systemChoiceMatters(...)`, and the page blank.
  // What the house is on decides what it can be asked. Both systems: keep
  // them apart, or move. S1 alone: stay, or move. S2 alone: there is no S1
  // half to move, so S2 is where it already is and S2.1 is the only spend.
  const options = [
    ...(plan.hasS1 ? [{
      value: 'stay',
      label: plan.hasS2 ? t('s2.choiceKeepBoth') : t('s2.choiceStayS1'),
      note: plan.hasS2 ? t('s2.choiceKeepBothNote') : t('s2.choiceStayS1Note'),
      cost: 0,
    }] : []),
    // A house with no S1 half is already where this choice goes, so it reads
    // as staying put (the user's ruling).
    {
      value: 's2',
      label: plan.hasS1 ? t('s2.choiceS2') : t('s2.choiceStayS2'),
      note: plan.hasS1 ? t('s2.choiceS2Note') : t('s2.choiceStayS2Note'),
      cost: plan.total,
    },
    { value: 's21', label: t('s2.choiceS21'), note: t('s2.choiceS21Note'), cost: plan.totalS21 },
  ]
  // The households arrive after the first paint, so the default follows the
  // list rather than being fixed at 'stay' -- which an S2-only house is never
  // offered.
  const [choice, setChoice] = useState(null)
  const chosen = options.find((option) => option.value === choice) || options[0]
  const current = chosen.value

  useEffect(() => {
    if (!onClose) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // A cell that buys the thing on the row, in Amazon's own gold.
  const buyCell = (key) => {
    const link = key ? amazonLink(key) : ''
    return (
      <td className="s2-center">
        {link
          ? <a className="s2-buy" href={link} target="_blank" rel="noopener noreferrer nofollow sponsored">{t('s2.buyNow')}</a>
          : <span className="s2-dash">-</span>}
      </td>
    )
  }

  // The "Why" cell, and the three after it, for a row the software alone
  // takes where it is going (or that is there already): a dash for the
  // equivalent and its price, and the way to update where there is one.
  const WHY = {
    legacy: ['legacy', 's2.why.legacy'],
    lower: ['s2.0', 's2.why.lower'],
    upgradable: ['ready', 's2.why.upgradable'],
    unknown: ['unknown', 's2.unknown'],
  }
  const whyCell = (status, running) => {
    const [tier, label] = status === 'running' ? ['ready', running] : WHY[status]
    return (
      <td className="s2-center">
        <span className="s2-tier" data-tier={tier}>{t(label)}</span>
      </td>
    )
  }
  const softwareCells = (status) => (
    <>
      <td><span className="s2-dash">-</span></td>
      <td className="s2-num"><span className="s2-dash">-</span></td>
      <td className="s2-center">
        {status === 'upgradable' && (
          <a className="s2-buy s2-update" href={S1_UPDATE_URL} target="_blank" rel="noopener noreferrer">{t('s2.updateNow')}</a>
        )}
      </td>
    </>
  )
  const replacementCells = (key) => {
    const buy = key ? S2_REPLACEMENTS[key] : null
    return (
      <>
        <td>
          {buy ? buy.name : (
            <>
              {t('s2.noReplacement')}
              <small className="s2-note-inline">{t('s2.noReplacementWhy')}</small>
            </>
          )}
        </td>
        <td className="s2-num">{formatUsd(buy ? buy.usd : 0)}</td>
        {buyCell(buy ? key : '')}
      </>
    )
  }

  // Both bills list every device the household has, and say for each what it
  // takes: a replacement bought, the software updated, or nothing at all.
  // The quarter the prices were checked in, worked out from the date so the
  // note follows the next check without anyone rewriting it.
  const [checkedYear, checkedMonth] = PRICES_CHECKED.split('-').map(Number)
  const checkedQuarter = { quarter: Math.ceil(checkedMonth / 3), year: checkedYear }

  // The Buy links carry Sonora's Amazon Associates tag, so a bill that has one
  // says so before the table: the Associates policy requires its statement,
  // and the FTC wants it near the links and ahead of them.
  const hasBuyLink = (key, status) => plan.rows.some((row) => {
    const state = status(row)
    const replacement = key === 's2' ? row.replacement : row.upgrade
    return (state === 'legacy' || state === 'lower') && Boolean(replacement && S2_REPLACEMENTS[replacement])
  })
  const bill = ({ title, blurb, done, total, totalLabel, replaceHeading, status, running, key, fine }) => (
    <section className="s2-section">
      <h3>{title}</h3>
      <p className={done ? 's2-allready' : 's2-blurb'}>{done || blurb}</p>
      {hasBuyLink(key, status) && <p className="s2-disclosure">{t('s2.amazonDisclosure')}</p>}
      <div className="s2-tablewrap">
        <table className="s2-table s2-table-bill">
          <thead>
            <tr>
              <th>{t('s2.colRoom')}</th>
              <th>{t('s2.colProduct')}</th>
              <th className="s2-center">{t('s2.colWhy')}</th>
              <th>{replaceHeading}</th>
              <th className="s2-num">{t('s2.colPrice')}</th>
              <th className="s2-center">{t('s2.colBuy')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row) => {
              const state = status(row)
              return (
                <tr key={`${key}-${row.key}`}>
                  <th scope="row">{row.room}{row.role && <small> {row.role}</small>}</th>
                  <td>{row.product || row.model || '-'}</td>
                  {whyCell(state, running)}
                  {state === 'legacy' || state === 'lower'
                    ? replacementCells(key === 's2' ? row.replacement : row.upgrade)
                    : softwareCells(state)}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>{totalLabel}</th>
              <td className="s2-num s2-total">{formatUsd(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {fine}
      <p className="s2-fine">{t('s2.pricesNote', checkedQuarter)}</p>
    </section>
  )

  const s2Bill = bill({
    key: 's2',
    title: t('s2.replaceTitle'),
    blurb: t('s2.replaceBlurb'),
    done: plan.legacy.length === 0 ? t('s2.allReady', { count: plan.ready }) : '',
    total: plan.total,
    totalLabel: t('s2.total'),
    replaceHeading: t('s2.colReplacement'),
    status: s2Status,
    running: 's2.why.runningS2',
  })

  const s21Bill = bill({
    key: 's21',
    title: t('s2.s21Title'),
    blurb: t('s2.s21Blurb'),
    done: plan.forS21.length === 0 ? t('s2.s21AllReady') : '',
    total: plan.totalS21,
    totalLabel: t('s2.totalS21'),
    replaceHeading: t('s2.colReplacementS21'),
    status: s21Status,
    running: 's2.why.runningS21',
    fine: plan.tierUnknown > 0 && <p className="s2-fine">{t.plural('s2.tierUnknownNote', plan.tierUnknown)}</p>,
  })

  // The question and its answer. A house already wholly on S2.1 is asked
  // nothing and sees the line below instead.
  const chooser = (
    <>
      <fieldset className="s2-choice">
        <legend>{t('s2.choiceTitle')}</legend>
        {options.map(({ value, label, note, cost }) => (
          <label key={value} className="s2-opt" data-on={current === value || undefined}>
            <input type="radio" name="s2-plan" value={value} checked={current === value}
                   onChange={() => setChoice(value)} />
            <span className="s2-opt-text">
              <strong>{label}</strong>
              <small>{note}</small>
            </span>
            <span className="s2-opt-cost">
              {cost ? formatUsd(cost) : t('s2.choiceFree')}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Keyed on the choice so switching remounts this and the slide runs. */}
      <div className="s2-switch" key={current}>
        {current === 'stay' || (current === 's2' && !plan.hasS1) ? (
          // Nothing to buy, so the answer is the option's own words rather
          // than an empty bill.
          <section className="s2-section">
            <h3>{chosen.label}</h3>
            <p className="s2-blurb">{chosen.note}</p>
          </section>
        ) : (
          <>
            {current === 's2' ? s2Bill : s21Bill}
          </>
        )}
      </div>
    </>
  )

  const body = (
    <div className="s2-body">
      <p className="s2-lede">{t('s2.lede')}</p>

      {plan.allS21 ? <p className="s2-allready">{t('s2.allS21')}</p> : chooser}

      {/* The three generations as sold, under everything the reader came for
          rather than above it: it is background to the question, not part of
          answering it. */}
      <EraTimeline t={t} />
    </div>
  )

  if (!onClose) return body
  return (
    <div className="s2-backdrop" role="presentation"
         onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="s2-dialog" role="dialog" aria-modal="true" aria-label={t('s2.title')}>
        <header className="s2-dialog-head">
          <h2>{t('s2.title')}</h2>
          <button type="button" className="s2-dialog-close" title={t('common.close')} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="s2-dialog-body">{body}</div>
      </div>
    </div>
  )
}
