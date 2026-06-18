import { useState } from 'react'
import { RESTAURANT_NAME, RESTAURANT_NAME_ZH } from '../data/menu.js'
import { formatPrice } from '../utils/receiptFormatter.js'
import PinModal from '../components/PinModal.jsx'

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

function FloatModal({ summary, onPrint, onClose, printing }) {
  const { date, takeaways, deliveries, takeawayTotal, deliveryTotal, grandTotal } = summary
  const allOrders = [...takeaways, ...deliveries].sort((a, b) => a.timestamp - b.timestamp)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal float-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Today's Summary</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{date}</span>
        </div>

        {/* Totals row */}
        <div className="float-totals">
          <div className="float-total-card">
            <span className="float-total-card__icon">🛍</span>
            <span className="float-total-card__count">{takeaways.length} orders</span>
            <span className="float-total-card__amount">{formatPrice(takeawayTotal)}</span>
          </div>
          <div className="float-total-card">
            <span className="float-total-card__icon">🛵</span>
            <span className="float-total-card__count">{deliveries.length} orders</span>
            <span className="float-total-card__amount">{formatPrice(deliveryTotal)}</span>
          </div>
        </div>

        {/* Order list */}
        <div className="float-order-list">
          {allOrders.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0', fontSize: 13 }}>
              No completed orders today
            </div>
          ) : allOrders.map((job, i) => {
            const time = new Date(job.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={job.jobId || i} className="float-order-row">
                <span className="float-order-row__time">{time}</span>
                <span className="float-order-row__mode">{job.orderMode === 'delivery' ? '🛵' : '🛍'}</span>
                <span className="float-order-row__items">
                  {(job.items || []).slice(0, 2).map(it => it.nameZh || it.nameEn).join(' · ')}
                  {(job.items || []).length > 2 ? ` +${job.items.length - 2}` : ''}
                </span>
                <span className="float-order-row__total">{formatPrice(Number(job.total))}</span>
              </div>
            )
          })}
        </div>

        {/* Grand total */}
        <div className="float-grand-total">
          <span>TOTAL</span>
          <span>{formatPrice(grandTotal)}</span>
        </div>

        <div className="modal-btns" style={{ marginTop: 16 }}>
          <button className="modal-btn modal-btn--cancel" onClick={onClose}>Close</button>
          <button
            className="modal-btn modal-btn--confirm"
            style={{ background: 'var(--accent-green)' }}
            onClick={onPrint}
            disabled={printing}
          >
            {printing ? <span className="spinner" /> : '🖨 Print Float'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MainMenu({ onNavigate, t, settings }) {
  const [showAbout,    setShowAbout]    = useState(false)
  const [floatData,    setFloatData]    = useState(null)
  const [loadingFloat, setLoadingFloat] = useState(false)
  const [floatError,   setFloatError]   = useState(null)
  const [printing,     setPrinting]     = useState(false)
  const [showPin,      setShowPin]      = useState(false)

  const apiBase = settings?.printerUrl?.trim() || ''
  const pin     = settings?.pin || '1234'

  async function handleFloatClick() {
    if (!apiBase) { setFloatError('Set Printer URL in Settings first.'); return }
    setLoadingFloat(true)
    setFloatError(null)
    try {
      const res  = await fetch(`${apiBase}/api/jobs`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const todayStr = new Date().toLocaleDateString('en-GB')
      const todaysJobs = (data.jobs || []).filter(j => {
        if (j.status !== 'printed') return false
        return new Date(j.timestamp).toLocaleDateString('en-GB') === todayStr
      })

      const takeaways     = todaysJobs.filter(j => j.orderMode !== 'delivery')
      const deliveries    = todaysJobs.filter(j => j.orderMode === 'delivery')
      const takeawayTotal = takeaways.reduce((s, j) => s + Number(j.total), 0)
      const deliveryTotal = deliveries.reduce((s, j) => s + Number(j.total), 0)

      setFloatData({
        date: todayStr,
        takeaways,
        deliveries,
        takeawayTotal,
        deliveryTotal,
        grandTotal: takeawayTotal + deliveryTotal,
      })
    } catch (err) {
      setFloatError(`Could not load jobs: ${err.message}`)
    } finally {
      setLoadingFloat(false)
    }
  }

  async function handlePrintFloat() {
    if (!floatData) return
    setPrinting(true)
    try {
      await fetch(`${apiBase}/api/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'float',
          orderId: `FLOAT-${Date.now()}`,
          timestamp: Date.now(),
          items: [{ id: 'float', nameEn: 'Daily Float', nameZh: '日结', price: 0, quantity: 1 }],
          total: floatData.grandTotal,
          floatSummary: floatData,
        }),
      })
      setFloatData(null)
    } catch (err) {
      console.error('Float print failed:', err)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="main-menu">
      <div className="main-menu__header">
        <div className="main-menu__logo">
          {RESTAURANT_NAME}
          <span className="main-menu__logo-zh">{RESTAURANT_NAME_ZH}</span>
        </div>
      </div>

      <div className="main-menu__primary">
        <button
          className="main-menu__cta main-menu__cta--takeaway"
          onClick={() => onNavigate('takeaway')}
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

      <div className="main-menu__secondary">
        <button
          className="main-menu__sec-btn"
          onClick={() => setShowPin(true)}
          disabled={loadingFloat}
        >
          {loadingFloat ? '⏳' : '📊'} Today's Float
        </button>
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

      {floatError && (
        <div style={{ textAlign: 'center', color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
          {floatError}
        </div>
      )}

      {floatData && (
        <FloatModal
          summary={floatData}
          onPrint={handlePrintFloat}
          onClose={() => setFloatData(null)}
          printing={printing}
        />
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} t={t} />}

      {showPin && (
        <PinModal
          prompt="Enter PIN to view float"
          correctPin={pin}
          onSuccess={() => { setShowPin(false); handleFloatClick() }}
          onCancel={() => setShowPin(false)}
        />
      )}
    </div>
  )
}
