import { useState, useEffect, useMemo } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'
import NoteModal from './NoteModal.jsx'
import {
  MIN_PEOPLE, PRICE_PER_PERSON, STARTER,
  MAINS, SAUCES, RICE_OPTIONS, DUCK_OPTIONS, SOUPS, SOUP_PRICE,
  effectiveSauceId, isPersonComplete, offerTotal, buildOfferItems,
} from '../data/specialOffer.js'

const STEPS = [
  { key: 'people', title: 'How many people?',    zh: '几位用餐？' },
  { key: 'mains',  title: 'Choose each main',    zh: '选择主菜' },
  { key: 'duck',   title: 'Add crispy duck?',    zh: '加片皮鸭？' },
  { key: 'soups',  title: 'Add soup?',           zh: '加汤？' },
  { key: 'review', title: 'Review & add',        zh: '确认订单' },
]

const newPerson = () => ({ mainId: null, sauceId: null, riceId: null, note: '' })

// ─── Small building blocks ────────────────────────────────────────────────────
function OptionCard({ selected, disabled, onClick, zh, en, tag, badge }) {
  return (
    <button
      type="button"
      className={`so-opt${selected ? ' so-opt--selected' : ''}${disabled ? ' so-opt--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {zh && <span className="so-opt__zh">{zh}</span>}
      <span className="so-opt__en">{en}{tag && <span className="so-opt__tag"> {tag}</span>}</span>
      {badge != null && <span className="so-opt__badge">{badge}</span>}
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

// ─── Per-person main / sauce / rice picker ─────────────────────────────────────
function PersonCard({ index, person, onChange }) {
  const main      = MAINS.find(m => m.id === person.mainId)
  const forced    = main?.forcedSauceId
  const sauceId   = effectiveSauceId(main, person.sauceId)
  const complete  = isPersonComplete(person)
  const [noteOpen, setNoteOpen] = useState(false)

  function pickMain(m) {
    onChange({ ...person, mainId: m.id, sauceId: m.forcedSauceId || person.sauceId })
  }

  return (
    <div className={`so-person${complete ? ' so-person--done' : ''}`}>
      <div className="so-person__head">
        <span>Person {index + 1}</span>
        {complete && <span className="so-person__check">✓</span>}
      </div>

      <div className="so-person__label">Main 主菜</div>
      <div className="so-grid so-grid--mains">
        {MAINS.map(m => (
          <OptionCard
            key={m.id}
            selected={person.mainId === m.id}
            onClick={() => pickMain(m)}
            zh={m.zh}
            en={m.en}
            tag={m.note ? `(${m.note})` : null}
          />
        ))}
      </div>

      {main && (
        <>
          <div className="so-person__label">Sauce 酱汁</div>
          {forced ? (
            <div className="so-locked">
              {SAUCES.find(s => s.id === forced)?.zh} {SAUCES.find(s => s.id === forced)?.en} — only option
            </div>
          ) : (
            <div className="so-grid so-grid--sauces">
              {SAUCES.map(s => (
                <OptionCard
                  key={s.id}
                  selected={sauceId === s.id}
                  onClick={() => onChange({ ...person, sauceId: s.id })}
                  zh={s.zh}
                  en={s.en}
                  tag={s.spicy ? '🌶' : null}
                />
              ))}
            </div>
          )}

          <div className="so-person__label">Rice / Noodle / Chips 主食</div>
          <div className="so-grid so-grid--rice">
            {RICE_OPTIONS.map(r => (
              <OptionCard
                key={r.id}
                selected={person.riceId === r.id}
                onClick={() => onChange({ ...person, riceId: r.id })}
                zh={r.zh}
                en={r.en}
                badge={r.extra ? `+${formatPrice(r.extra)}` : null}
              />
            ))}
          </div>
        </>
      )}

      <div className="so-person__label">Note 备注</div>
      <button
        type="button"
        className={`so-note-btn${person.note ? ' so-note-btn--set' : ''}`}
        onClick={() => setNoteOpen(true)}
      >
        {person.note ? person.note : '＋ Add note 添加备注'}
      </button>

      {noteOpen && (
        <NoteModal
          item={{}}
          currentNote={person.note}
          onConfirm={(note) => { onChange({ ...person, note }); setNoteOpen(false) }}
          onCancel={() => setNoteOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Main modal ────────────────────────────────────────────────────────────────
export default function SpecialOfferModal({ initial, onConfirm, onCancel }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [people,  setPeople]  = useState(initial?.people || MIN_PEOPLE)
  const [persons, setPersons] = useState(() =>
    initial?.persons ? initial.persons.map(p => ({ ...p })) : Array.from({ length: MIN_PEOPLE }, newPerson)
  )
  const [duckId,  setDuckId]  = useState(initial?.duckId || 'none')
  const [soups,   setSoups]   = useState(initial?.soups ? { ...initial.soups } : {})

  const step = STEPS[stepIdx]

  // Keep the persons array length in sync with the people count
  useEffect(() => {
    setPersons(prev => {
      const next = prev.slice(0, people)
      while (next.length < people) next.push(newPerson())
      return next
    })
  }, [people])

  const total = useMemo(() => offerTotal({ people, persons, duckId, soups }), [people, persons, duckId, soups])
  const sideExtras = useMemo(
    () => persons.reduce((s, p) => s + (RICE_OPTIONS.find(r => r.id === p.riceId)?.extra || 0), 0),
    [persons]
  )
  const allPersonsDone = persons.every(isPersonComplete)

  const canAdvance =
    step.key === 'mains' ? allPersonsDone : true

  function updatePerson(i, next) {
    setPersons(prev => prev.map((p, idx) => (idx === i ? next : p)))
  }

  function changeSoup(soupId, qty) {
    setSoups(prev => ({ ...prev, [soupId]: Math.max(0, qty) }))
  }

  function handleConfirm() {
    onConfirm(buildOfferItems({ people, persons, duckId, soups }), { people, persons, duckId, soups })
  }

  function next() { setStepIdx(i => Math.min(STEPS.length - 1, i + 1)) }
  function back() { if (stepIdx === 0) onCancel(); else setStepIdx(i => i - 1) }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal special-offer-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="so-header">
          <div>
            <h2 style={{ margin: 0 }}>特价外卖套餐 <span className="so-header__en">Special Offer</span></h2>
            <p className="so-header__step">Step {stepIdx + 1} of {STEPS.length} · {step.title}</p>
          </div>
          <div className="so-header__total">
            <span className="so-header__total-label">Total</span>
            <span className="so-header__total-amount">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="so-progress">
          {STEPS.map((s, i) => (
            <span key={s.key} className={`so-progress__dot${i === stepIdx ? ' so-progress__dot--active' : ''}${i < stepIdx ? ' so-progress__dot--done' : ''}`} />
          ))}
        </div>

        {/* Body */}
        <div className="so-body">
          {step.key === 'people' && (
            <div className="so-people">
              <p className="so-hint">2-course meal · {formatPrice(PRICE_PER_PERSON)} per person · minimum {MIN_PEOPLE}</p>
              <Stepper value={people} min={MIN_PEOPLE} onChange={setPeople} />
              <div className="so-starter">
                <div className="so-starter__label">Included starter 前菜（已含）</div>
                <div className="so-starter__zh">{STARTER.zh}</div>
                <div className="so-starter__en">{STARTER.en}</div>
              </div>
            </div>
          )}

          {step.key === 'mains' && (
            <div className="so-persons">
              {persons.map((p, i) => (
                <PersonCard key={i} index={i} person={p} onChange={n => updatePerson(i, n)} />
              ))}
            </div>
          )}

          {step.key === 'duck' && (
            <div className="so-grid so-grid--duck">
              {DUCK_OPTIONS.map(d => (
                <OptionCard
                  key={d.id}
                  selected={duckId === d.id}
                  onClick={() => setDuckId(d.id)}
                  zh={d.zh}
                  en={d.en}
                  badge={d.price > 0 ? `+${formatPrice(d.price)}` : null}
                />
              ))}
            </div>
          )}

          {step.key === 'soups' && (
            <div className="so-soups">
              <p className="so-hint">{formatPrice(SOUP_PRICE)} each · optional</p>
              {SOUPS.map(s => (
                <div key={s.id} className="so-soup-row">
                  <div>
                    <div className="so-soup-row__zh">{s.zh}</div>
                    <div className="so-soup-row__en">{s.en}</div>
                  </div>
                  <Stepper value={soups[s.id] || 0} min={0} onChange={q => changeSoup(s.id, q)} />
                </div>
              ))}
            </div>
          )}

          {step.key === 'review' && (
            <div className="so-review">
              <div className="so-review__row"><span>{people} × Set Meal (£{PRICE_PER_PERSON} pp)</span><span>{formatPrice(people * PRICE_PER_PERSON)}</span></div>
              <div className="so-review__sub">Starter: {STARTER.en}</div>
              {persons.map((p, i) => {
                const main  = MAINS.find(m => m.id === p.mainId)
                const sauce = SAUCES.find(s => s.id === effectiveSauceId(main, p.sauceId))
                const rice  = RICE_OPTIONS.find(r => r.id === p.riceId)
                return (
                  <div key={i} className="so-review__sub">
                    P{i + 1}: {main?.en} · {sauce?.en} · {rice?.en}
                  </div>
                )
              })}
              {sideExtras > 0 && (
                <div className="so-review__row"><span>Side upgrades (Soft Noodle / S&P Chips)</span><span>{formatPrice(sideExtras)}</span></div>
              )}
              {duckId !== 'none' && (() => {
                const d = DUCK_OPTIONS.find(x => x.id === duckId)
                return <div className="so-review__row"><span>{d.en}</span><span>{formatPrice(d.price)}</span></div>
              })()}
              {SOUPS.map(s => {
                const q = soups[s.id] || 0
                if (!q) return null
                return <div key={s.id} className="so-review__row"><span>{q} × {s.en}</span><span>{formatPrice(q * SOUP_PRICE)}</span></div>
              })}
              <div className="so-review__total"><span>TOTAL</span><span>{formatPrice(total)}</span></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="so-footer">
          <button className="modal-btn modal-btn--cancel" onClick={back}>
            {stepIdx === 0 ? 'Cancel' : '← Back'}
          </button>
          {step.key === 'review' ? (
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
              {step.key === 'mains' && !allPersonsDone ? 'Choose all mains' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
