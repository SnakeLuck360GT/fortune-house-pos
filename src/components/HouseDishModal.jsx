import { useState } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'
import { HOUSE_DISH_SAUCES, sauceById, buildHouseDishItem } from '../data/houseDishes.js'

export default function HouseDishModal({ dish, onConfirm, onCancel }) {
  const [sauceId, setSauceId] = useState(null)
  const sauce = sauceById(sauceId)
  const total = dish.price + (sauce?.extra || 0)

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal special-offer-modal" onClick={e => e.stopPropagation()}>
        <div className="so-header">
          <div>
            <h2 style={{ margin: 0 }}>{dish.nameZh} <span className="so-header__en">{dish.nameEn}</span></h2>
            <p className="so-header__step">Choose one sauce / style 选择一款</p>
          </div>
          <div className="so-header__total">
            <span className="so-header__total-label">Total</span>
            <span className="so-header__total-amount">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="so-body">
          <div className="so-grid so-grid--sauces">
            {HOUSE_DISH_SAUCES.map(s => (
              <button
                key={s.id}
                type="button"
                className={`so-opt${sauceId === s.id ? ' so-opt--selected' : ''}`}
                onClick={() => setSauceId(s.id)}
              >
                <span className="so-opt__zh">{s.zh}</span>
                <span className="so-opt__en">
                  {s.en}
                  {s.spicy && <span className="so-opt__tag"> 🌶</span>}
                  {s.nut && <span className="so-opt__tag"> 🥜</span>}
                </span>
                {s.extra ? <span className="so-opt__badge">+{formatPrice(s.extra)}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="so-footer">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-btn modal-btn--confirm"
            style={{ background: sauce ? 'var(--accent-green)' : undefined, opacity: sauce ? 1 : 0.4 }}
            onClick={() => sauce && onConfirm(buildHouseDishItem(dish, sauceId))}
            disabled={!sauce}
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  )
}
