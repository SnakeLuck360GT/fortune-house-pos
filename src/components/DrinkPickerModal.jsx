import { useState } from 'react'

const DRINKS = [
  { id: 'coke',  nameEn: 'Coca-Cola'    },
  { id: 'diet',  nameEn: 'Diet Coke'    },
  { id: 'fanta', nameEn: 'Fanta Orange' },
]

export default function DrinkPickerModal({ item, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null)

  function handleConfirm() {
    const drink = DRINKS.find(d => d.id === selected)
    onConfirm(drink ? drink.nameEn : '')
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal sharebox-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>
          {item.nameZh} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>{item.nameEn}</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Choose a drink
        </p>

        <div className="sharebox-drinks">
          {DRINKS.map(drink => (
            <button
              key={drink.id}
              className={`sharebox-drink${selected === drink.id ? ' sharebox-drink--selected' : ''}`}
              onClick={() => setSelected(drink.id)}
            >
              <span className="sharebox-drink__en">{drink.nameEn}</span>
              {selected === drink.id && <span className="sharebox-drink__count">✓</span>}
            </button>
          ))}
        </div>

        <div className="modal-btns" style={{ marginTop: 20 }}>
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-btn modal-btn--confirm"
            style={{ background: selected ? 'var(--accent-green)' : undefined, opacity: selected ? 1 : 0.4 }}
            onClick={handleConfirm}
            disabled={!selected}
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  )
}
