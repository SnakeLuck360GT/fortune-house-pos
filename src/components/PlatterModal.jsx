import { useState } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'

const MIN_PEOPLE = 2
const stripParen = s => (s || '').replace(/\s*\(.*\)\s*/, '').trim()

// Per-head platters (Imperial / Dim Sum) — pick number of people, priced × head.
export default function PlatterModal({ item, initial, onConfirm, onCancel }) {
  const [people, setPeople] = useState(initial?.people || MIN_PEOPLE)
  const total = people * item.price

  function handleConfirm() {
    onConfirm({
      id:       `${item.id}-${Date.now()}`,
      nameEn:   stripParen(item.nameEn),
      nameZh:   stripParen(item.nameZh),
      price:    total,
      category: 'A La Carte',
      peopleQty: people,   // show "×people" on the receipt instead of the line quantity
    }, { people })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal special-offer-modal" onClick={e => e.stopPropagation()}>
        <div className="so-header">
          <div>
            <h2 style={{ margin: 0 }}>{stripParen(item.nameZh)} <span className="so-header__en">{stripParen(item.nameEn)}</span></h2>
            <p className="so-header__step">{formatPrice(item.price)} per head · minimum {MIN_PEOPLE}</p>
          </div>
          <div className="so-header__total">
            <span className="so-header__total-label">Total</span>
            <span className="so-header__total-amount">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="so-body">
          <div className="so-people">
            <p className="so-hint">How many people? 几位用餐？</p>
            <div className="so-stepper">
              <button type="button" className="so-stepper__btn" onClick={() => setPeople(p => Math.max(MIN_PEOPLE, p - 1))} disabled={people <= MIN_PEOPLE}>−</button>
              <span className="so-stepper__value">{people}</span>
              <button type="button" className="so-stepper__btn" onClick={() => setPeople(p => p + 1)}>+</button>
            </div>
            {item.description && (
              <div className="so-starter">
                <div className="so-starter__label">Includes 包含</div>
                <div className="so-starter__en">{item.description}</div>
              </div>
            )}
          </div>
        </div>

        <div className="so-footer">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-btn modal-btn--confirm" style={{ background: 'var(--accent-green)' }} onClick={handleConfirm}>
            Add to Order
          </button>
        </div>
      </div>
    </div>
  )
}
