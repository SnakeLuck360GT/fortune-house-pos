import { useState } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'

// "Pick one" dishes (item.choices), e.g. Fish Fillet in Black Bean OR Szechuan.
// The chosen option's full names replace the menu name, and each option gets its
// own line id (`${item.id}_${option}`) so the same choice merges and the menu
// card badge still counts it.
export default function ChoiceModal({ item, onConfirm, onCancel }) {
  const [choiceId, setChoiceId] = useState(null)
  const choice = item.choices.find(c => c.id === choiceId)

  function handleConfirm() {
    if (!choice) return
    const { choices, ...rest } = item
    onConfirm({ ...rest, id: `${item.id}_${choice.id}`, nameEn: choice.nameEn, nameZh: choice.nameZh })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal special-offer-modal" onClick={e => e.stopPropagation()}>
        <div className="so-header">
          <div>
            <h2 style={{ margin: 0 }}>{item.nameZh} <span className="so-header__en">{item.nameEn}</span></h2>
            <p className="so-header__step">Choose one 选择一种</p>
          </div>
          <div className="so-header__total">
            <span className="so-header__total-label">Price</span>
            <span className="so-header__total-amount">{formatPrice(item.price)}</span>
          </div>
        </div>

        <div className="so-body">
          <div className="so-grid so-grid--duck">
            {item.choices.map(c => (
              <button
                key={c.id}
                type="button"
                className={`so-opt${choiceId === c.id ? ' so-opt--selected' : ''}`}
                onClick={() => setChoiceId(c.id)}
              >
                <span className="so-opt__zh">{c.zh}</span>
                <span className="so-opt__en">{c.en}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="so-footer">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-btn modal-btn--confirm"
            style={{ background: 'var(--accent-green)', ...(choice ? {} : { opacity: 0.4, cursor: 'not-allowed' }) }}
            onClick={handleConfirm}
            disabled={!choice}
          >
            {choice ? 'Add to Order' : 'Pick one'}
          </button>
        </div>
      </div>
    </div>
  )
}
