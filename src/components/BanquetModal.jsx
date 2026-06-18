import { useState, useEffect, useMemo } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'
import {
  MIN_PEOPLE, BANQUETS, RICE_INCLUDED, DUPLICATE_MAIN_FEE, FREE_DUPLICATE_PEOPLE, banquetById,
  isBanquetPersonComplete, banquetSurcharge, buildBanquetItem,
} from '../data/houseBanquets.js'

const newPerson = () => ({ soupId: null, mainId: null, note: '' })
const CONFIRM_PRESSES = 3   // deliberate taps needed to add a paid duplicate main

function OptionCard({ selected, disabled, confirming, onClick, zh, en, tag, badge, note }) {
  return (
    <button
      type="button"
      className={`so-opt${selected ? ' so-opt--selected' : ''}${disabled ? ' so-opt--disabled' : ''}${confirming ? ' so-opt--confirming' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {zh && <span className="so-opt__zh">{zh}</span>}
      <span className="so-opt__en">{en}{tag && <span className="so-opt__tag"> {tag}</span>}</span>
      {note && <span className="so-opt__note">{note}</span>}
      {badge != null && <span className="so-opt__badge so-opt__badge--fee">{badge}</span>}
    </button>
  )
}

function Stepper({ value, min, onChange }) {
  return (
    <div className="so-stepper">
      <button type="button" className="so-stepper__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <span className="so-stepper__value">{value}</span>
      <button type="button" className="so-stepper__btn" onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

// othersMainIds: mains held by any other person (drives the paid-duplicate gate)
// lowerMainIds:  mains held by a lower-indexed person (this person is the dup that pays)
function PersonCard({ index, person, banquet, othersMainIds = [], lowerMainIds = [], chargeDuplicates = true, onChange }) {
  const done = isBanquetPersonComplete(person)
  const [pending, setPending] = useState({ mainId: null, presses: 0 })

  function pickMain(m) {
    if (person.mainId === m.id) return                       // already chosen — no-op
    const paidDup = chargeDuplicates && othersMainIds.includes(m.id) && !m.chicken
    if (!paidDup) {                                          // free: another's chicken, or nobody has it
      onChange({ ...person, mainId: m.id })
      setPending({ mainId: null, presses: 0 })
      return
    }
    // paid duplicate — require several deliberate taps
    const presses = (pending.mainId === m.id ? pending.presses : 0) + 1
    if (presses >= CONFIRM_PRESSES) {
      onChange({ ...person, mainId: m.id })
      setPending({ mainId: null, presses: 0 })
    } else {
      setPending({ mainId: m.id, presses })
    }
  }

  return (
    <div className={`so-person${done ? ' so-person--done' : ''}`}>
      <div className="so-person__head">
        <span>Person {index + 1}</span>
        {done && <span className="so-person__check">✓</span>}
      </div>

      <div className="so-person__label">Soup 汤</div>
      <div className="so-grid so-grid--sauces">
        {banquet.soups.map(s => (
          <OptionCard
            key={s.id}
            selected={person.soupId === s.id}
            onClick={() => onChange({ ...person, soupId: s.id })}
            zh={s.zh}
            en={s.en}
            tag={s.spicy ? '🌶' : null}
          />
        ))}
      </div>

      <div className="so-person__label">Main 主菜</div>
      <div className="so-grid so-grid--mains">
        {banquet.mains.map(m => {
          const isSelected = person.mainId === m.id
          const isPending  = pending.mainId === m.id
          const remaining  = CONFIRM_PRESSES - pending.presses
          const paidInstance = chargeDuplicates && isSelected && lowerMainIds.includes(m.id) && !m.chicken  // this person pays
          const previewPaid  = chargeDuplicates && !isSelected && othersMainIds.includes(m.id) && !m.chicken // picking = +£5
          let badge = null
          if (paidInstance)      badge = `+${formatPrice(DUPLICATE_MAIN_FEE)}`
          else if (previewPaid)  badge = isPending ? `+${formatPrice(DUPLICATE_MAIN_FEE)} · ${remaining}×` : `+${formatPrice(DUPLICATE_MAIN_FEE)}`
          return (
            <OptionCard
              key={m.id}
              selected={isSelected}
              confirming={isPending}
              onClick={() => pickMain(m)}
              zh={m.zh}
              en={m.en}
              tag={m.spicy ? '🌶' : null}
              badge={badge}
              note={isPending ? `Tap ${remaining}× more to add (+${formatPrice(DUPLICATE_MAIN_FEE)})` : null}
            />
          )
        })}
      </div>

      <div className="so-person__label">Note 备注</div>
      <input
        className="so-note-input"
        type="text"
        value={person.note || ''}
        onChange={e => onChange({ ...person, note: e.target.value })}
        placeholder="optional · e.g. no MSG / 不加味精"
      />
    </div>
  )
}

export default function BanquetModal({ initial, onConfirm, onCancel }) {
  const [stepIdx, setStepIdx]   = useState(initial?.banquetId ? 1 : 0)   // skip banquet choice when editing
  const [banquetId, setBanquetId] = useState(initial?.banquetId || null)
  const [people,  setPeople]    = useState(initial?.people || MIN_PEOPLE)
  const [persons, setPersons]   = useState(() =>
    initial?.persons ? initial.persons.map(p => ({ ...p })) : Array.from({ length: MIN_PEOPLE }, newPerson)
  )

  const banquet = banquetById(banquetId)
  const STEPS = ['banquet', 'people', 'mains', 'review']
  const stepKey = STEPS[stepIdx]

  useEffect(() => {
    setPersons(prev => {
      const next = prev.slice(0, people)
      while (next.length < people) next.push(newPerson())
      return next
    })
  }, [people])

  const surcharge = useMemo(() => banquetSurcharge(banquet, persons), [banquet, persons])
  const total = banquet ? people * banquet.pricePerPerson + surcharge : 0
  const allDone = persons.every(isBanquetPersonComplete)

  const canAdvance =
    stepKey === 'banquet' ? !!banquet :
    stepKey === 'mains'   ? allDone   : true

  function updatePerson(i, next) {
    setPersons(prev => prev.map((p, idx) => (idx === i ? next : p)))
  }

  function next() { setStepIdx(i => Math.min(STEPS.length - 1, i + 1)) }
  function back() { if (stepIdx === 0) onCancel(); else setStepIdx(i => i - 1) }

  function handleConfirm() {
    onConfirm(buildBanquetItem({ banquet, people, persons }), { banquetId, people, persons })
  }

  const stepTitle = { banquet: 'Choose a banquet', people: 'How many people?', mains: 'Soup & main each', review: 'Review & add' }[stepKey]

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal special-offer-modal" onClick={e => e.stopPropagation()}>
        <div className="so-header">
          <div>
            <h2 style={{ margin: 0 }}>富贵宴席 <span className="so-header__en">House Banquet</span></h2>
            <p className="so-header__step">Step {stepIdx + 1} of {STEPS.length} · {stepTitle}</p>
          </div>
          <div className="so-header__total">
            <span className="so-header__total-label">Total</span>
            <span className="so-header__total-amount">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="so-progress">
          {STEPS.map((s, i) => (
            <span key={s} className={`so-progress__dot${i === stepIdx ? ' so-progress__dot--active' : ''}${i < stepIdx ? ' so-progress__dot--done' : ''}`} />
          ))}
        </div>

        <div className="so-body">
          {stepKey === 'banquet' && (
            <div className="so-grid so-grid--duck">
              {BANQUETS.map(b => (
                <button
                  key={b.id}
                  type="button"
                  className={`so-opt${banquetId === b.id ? ' so-opt--selected' : ''}`}
                  onClick={() => setBanquetId(b.id)}
                  style={{ alignItems: 'stretch' }}
                >
                  <span className="so-opt__zh">{b.zh} <span className="so-opt__en">{b.en}</span></span>
                  <span className="so-opt__badge">{formatPrice(b.pricePerPerson)}/pp</span>
                  <span className="so-banquet-incl">
                    {b.included.map(i => i.en).join(' · ')} · + a main each, with {RICE_INCLUDED.en}
                  </span>
                </button>
              ))}
            </div>
          )}

          {stepKey === 'people' && (
            <div className="so-people">
              <p className="so-hint">{banquet?.en} · {formatPrice(banquet?.pricePerPerson || 0)} per person · minimum {MIN_PEOPLE}</p>
              <Stepper value={people} min={MIN_PEOPLE} onChange={setPeople} />
              <div className="so-starter">
                <div className="so-starter__label">Included for the table 餐桌共享</div>
                <div className="so-starter__zh">{banquet?.included.map(i => i.zh).join('、')}</div>
                <div className="so-starter__en">{banquet?.included.map(i => i.en).join(' · ')}</div>
              </div>
            </div>
          )}

          {stepKey === 'mains' && (() => {
            const chargeDuplicates = people < FREE_DUPLICATE_PEOPLE
            return (
              <div className="so-persons">
                <p className="so-hint">{chargeDuplicates ? (
                  <>Duplicate of another person's main = +{formatPrice(DUPLICATE_MAIN_FEE)} (chicken free) · tap a duplicate {CONFIRM_PRESSES}× to confirm<br />
                  重复他人主菜加{formatPrice(DUPLICATE_MAIN_FEE)}（鸡肉免费），连按{CONFIRM_PRESSES}次确认</>
                ) : (
                  <>{FREE_DUPLICATE_PEOPLE}+ people — repeat any main freely, no extra charge<br />
                  {FREE_DUPLICATE_PEOPLE}位或以上，主菜可自由重复，不另收费</>
                )}</p>
                {persons.map((p, i) => {
                  const othersMainIds = persons.filter((_, idx) => idx !== i).map(pp => pp.mainId).filter(Boolean)
                  const lowerMainIds  = persons.filter((_, idx) => idx <  i).map(pp => pp.mainId).filter(Boolean)
                  return (
                    <PersonCard key={i} index={i} person={p} banquet={banquet} othersMainIds={othersMainIds} lowerMainIds={lowerMainIds} chargeDuplicates={chargeDuplicates} onChange={n => updatePerson(i, n)} />
                  )
                })}
              </div>
            )
          })()}

          {stepKey === 'review' && (
            <div className="so-review">
              <div className="so-review__row"><span>{banquet.en} · {people} ppl</span><span>{formatPrice(people * banquet.pricePerPerson)}</span></div>
              <div className="so-review__sub">Incl: {banquet.included.map(i => i.en).join(', ')}</div>
              {persons.map((p, i) => {
                const soup = banquet.soups.find(s => s.id === p.soupId)
                const main = banquet.mains.find(m => m.id === p.mainId)
                return <div key={i} className="so-review__sub">P{i + 1}: {soup?.en} · {main?.en}</div>
              })}
              <div className="so-review__sub">Served with {RICE_INCLUDED.en}</div>
              {surcharge > 0 && (
                <div className="so-review__row"><span>Duplicate main(s) +£5 each</span><span>{formatPrice(surcharge)}</span></div>
              )}
              <div className="so-review__total"><span>TOTAL</span><span>{formatPrice(total)}</span></div>
            </div>
          )}
        </div>

        <div className="so-footer">
          <button className="modal-btn modal-btn--cancel" onClick={back}>
            {stepIdx === 0 ? 'Cancel' : '← Back'}
          </button>
          {stepKey === 'review' ? (
            <button className="modal-btn modal-btn--confirm" style={{ background: 'var(--accent-green)' }} onClick={handleConfirm}>
              Add to Order
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--confirm"
              style={{ background: canAdvance ? 'var(--accent-green)' : undefined, opacity: canAdvance ? 1 : 0.4 }}
              onClick={() => canAdvance && next()}
              disabled={!canAdvance}
            >
              {stepKey === 'mains' && !allDone ? 'Choose all' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
