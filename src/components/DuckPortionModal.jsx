import { useState } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'

const stripParen = s => (s || '').replace(/\s*\(.*\)\s*/, '').trim()

// Quarter is the base price (item.price); half = 2×, whole = 4×.
const PORTIONS = [
  { id: 'quarter', en: 'Quarter ¼', zh: '四分一只', mult: 1 },
  { id: 'half',    en: 'Half ½',    zh: '半只',     mult: 2 },
  { id: 'whole',   en: 'Whole',     zh: '一只',     mult: 4 },
]

export default function DuckPortionModal({ item, onConfirm, onCancel }) {
  const [portionId, setPortionId] = useState('quarter')
  const portion = PORTIONS.find(p => p.id === portionId)
  const total   = item.price * portion.mult
  const baseEn  = stripParen(item.nameEn)
  const baseZh  = stripParen(item.nameZh)

  function handleConfirm() {
    onConfirm({
      id:       `${item.id}-${portion.id}-${Date.now()}`,
      nameEn:   `${baseEn} (${portion.en})`,
      nameZh:   `${baseZh} (${portion.zh})`,
      price:    total,
      category: 'A La Carte',
      details:  [
        { text: '配薄饼、葱、青瓜及海鲜酱', big: true },
        { text: 'Served with pancakes, leeks, cucumber & hoi sin', big: false },
      ],
    })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal special-offer-modal" onClick={e => e.stopPropagation()}>
        <div className="so-header">
          <div>
            <h2 style={{ margin: 0 }}>{baseZh} <span className="so-header__en">{baseEn}</span></h2>
            <p className="so-header__step">Choose a portion 选择份量</p>
          </div>
          <div className="so-header__total">
            <span className="so-header__total-label">Total</span>
            <span className="so-header__total-amount">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="so-body">
          <div className="so-grid so-grid--duck">
            {PORTIONS.map(p => (
              <button
                key={p.id}
                type="button"
                className={`so-opt${portionId === p.id ? ' so-opt--selected' : ''}`}
                onClick={() => setPortionId(p.id)}
              >
                <span className="so-opt__zh">{p.zh}</span>
                <span className="so-opt__en">{p.en}</span>
                <span className="so-opt__badge">{formatPrice(item.price * p.mult)}</span>
              </button>
            ))}
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
