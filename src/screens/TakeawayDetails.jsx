import { useState } from 'react'
import HomeButton from '../components/HomeButton.jsx'
import { isValidUkPhone } from '../utils/phone.js'

export default function TakeawayDetails({ onNavigate, onConfirm, t }) {
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState('')

  const phoneOk  = !phone.trim() || isValidUkPhone(phone)   // optional, but valid if entered
  const canStart = phoneOk                                  // name & phone both optional

  function handleConfirm() {
    if (!canStart) return
    onConfirm({ customerName: name.trim(), phone: phone.trim() })
  }

  return (
    <div className="screen">
      <HomeButton onClick={() => onNavigate('menu')} label={t.home} />

      <div className="delivery-screen">
        <div className="delivery-header">
          <span className="delivery-header__icon">🛍</span>
          <div>
            <h1>Takeaway / 外带</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enter customer details</div>
          </div>
        </div>

        <div className="delivery-field">
          <label>Customer Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. John Smith"
            autoFocus
          />
        </div>

        <div className="delivery-field">
          <label>Phone <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 07700 900123"
          />
          {phone.trim() && (
            phoneOk
              ? <div style={{ fontSize: 13, color: '#4ade80', marginTop: 4 }}>✓ Looks valid</div>
              : <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>✗ Check the number — doesn't look like a UK phone</div>
          )}
        </div>

        <button
          className="delivery-confirm-btn"
          onClick={handleConfirm}
          disabled={!canStart}
        >
          Start Order →
        </button>
      </div>
    </div>
  )
}
