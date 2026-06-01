import { useState } from 'react'
import { RESTAURANT_NAME, RESTAURANT_NAME_ZH } from '../data/menu.js'

function AboutModal({ onClose, t }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal about-content" onClick={e => e.stopPropagation()}>
        <h2>{t.aboutTitle}</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{t.aboutBody}</p>
        <br />
        <p>
          <strong>Restaurant:</strong> {RESTAURANT_NAME} — {RESTAURANT_NAME_ZH}
          <br />
          <strong>Phone:</strong> 0161 969 3838
        </p>
        <div className="modal-btns" style={{ marginTop: 24 }}>
          <button className="modal-btn modal-btn--cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function MainMenu({ onNavigate, t }) {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="main-menu">
      {/* Header */}
      <div className="main-menu__header">
        <div className="main-menu__logo">
          {RESTAURANT_NAME}
          <span className="main-menu__logo-zh">{RESTAURANT_NAME_ZH}</span>
        </div>
      </div>

      {/* Primary CTAs */}
      <div className="main-menu__primary">
        <button
          className="main-menu__cta main-menu__cta--takeaway"
          onClick={() => onNavigate('order', 'takeaway')}
        >
          <span className="main-menu__cta-icon">🛍</span>
          <span className="main-menu__cta-en">Takeaway</span>
          <span className="main-menu__cta-zh">外带</span>
        </button>

        <button
          className="main-menu__cta main-menu__cta--delivery"
          onClick={() => onNavigate('delivery')}
        >
          <span className="main-menu__cta-icon">🛵</span>
          <span className="main-menu__cta-en">Delivery</span>
          <span className="main-menu__cta-zh">外送</span>
        </button>
      </div>

      {/* Secondary buttons — small, bottom */}
      <div className="main-menu__secondary">
        <button className="main-menu__sec-btn" onClick={() => onNavigate('queue')}>
          🖨 {t.viewQueue}
        </button>
        <button className="main-menu__sec-btn" onClick={() => onNavigate('settings')}>
          ⚙️ {t.settings}
        </button>
        <button className="main-menu__sec-btn" onClick={() => setShowAbout(true)}>
          ℹ️ {t.about}
        </button>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} t={t} />}
    </div>
  )
}
