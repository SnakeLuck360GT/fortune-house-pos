import { useState } from 'react'

const DRINKS = [
  { id: 'coke',  nameEn: 'Coca-Cola'    },
  { id: 'diet',  nameEn: 'Diet Coke'    },
  { id: 'fanta', nameEn: 'Fanta Orange' },
  { id: 'lemon', nameEn: 'Lemonade'     },
  { id: 'water', nameEn: 'Water'        },
]

// Tally of selections, allowing duplicates (e.g. 2x Coke)
export default function ShareBoxModal({ onConfirm, onCancel }) {
  const [selected, setSelected] = useState([]) // array of drink IDs, can repeat

  function toggleDrink(drinkId) {
    // Allow selecting the same drink twice (e.g. 2x Coke)
    const count = selected.filter(id => id === drinkId).length
    if (selected.length < 2) {
      setSelected([...selected, drinkId])
    } else if (count > 0) {
      // Deselect one of this drink
      const idx = selected.lastIndexOf(drinkId)
      setSelected(selected.filter((_, i) => i !== idx))
    }
  }

  function countOf(id) {
    return selected.filter(s => s === id).length
  }

  function handleConfirm() {
    const drinks = selected.map(id => {
      const d = DRINKS.find(d => d.id === id)
      return d ? d.nameEn : id
    })
    const note = drinks.join(', ')
    onConfirm(note)
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal sharebox-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>分享套餐 Share Box</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Choose 2 soft drinks ({selected.length}/2 selected)
        </p>

        <div className="sharebox-drinks">
          {DRINKS.map(drink => {
            const count = countOf(drink.id)
            const maxed = selected.length >= 2 && count === 0
            return (
              <button
                key={drink.id}
                className={`sharebox-drink${count > 0 ? ' sharebox-drink--selected' : ''}${maxed ? ' sharebox-drink--disabled' : ''}`}
                onClick={() => !maxed && toggleDrink(drink.id)}
                disabled={maxed}
              >
                <span className="sharebox-drink__en">{drink.nameEn}</span>
                {count > 0 && (
                  <span className="sharebox-drink__count">×{count}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="modal-btns" style={{ marginTop: 20 }}>
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-btn modal-btn--confirm"
            style={{ background: 'var(--accent-green)' }}
            onClick={handleConfirm}
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  )
}
