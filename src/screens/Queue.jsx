import { useState, useEffect, useCallback } from 'react'
import HomeButton from '../components/HomeButton.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'
import { formatPrice } from '../utils/receiptFormatter.js'
import PinModal from '../components/PinModal.jsx'

function statusBadge(status) {
  return <span className={`queue-badge queue-badge--${status}`}>{status}</span>
}

function FloatPreview({ summary }) {
  const { date, takeaways, deliveries, takeawayTotal, deliveryTotal, grandTotal } = summary
  const allOrders = [...takeaways, ...deliveries].sort((a, b) => a.timestamp - b.timestamp)

  function OrderRow({ job }) {
    const time = new Date(job.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const names = (job.items || []).slice(0, 3).map(i => i.nameEn).join(', ')
    const isDelivery = job.orderMode === 'delivery'
    return (
      <div className="fp-order-row">
        <span className="fp-order-row__time">{time}</span>
        <span className={`fp-order-row__mode fp-order-row__mode--${isDelivery ? 'del' : 'ta'}`}>
          {isDelivery ? 'DEL' : 'T/A'}
        </span>
        <span className="fp-order-row__items">{names.slice(0, 30)}{names.length > 30 ? '…' : ''}</span>
        <span className="fp-order-row__total">{formatPrice(Number(job.total))}</span>
      </div>
    )
  }

  return (
    <div className="float-preview">
      <div className="fp-header">
        <div className="fp-header__name">Fortune House</div>
        <div className="fp-header__zh">福运楼</div>
        <div className="fp-header__date">{date}</div>
      </div>

      <div className="fp-title">
        <div className="fp-title__en">DAILY SUMMARY</div>
        <div className="fp-title__zh">日结报告</div>
      </div>

      <div className="fp-counts">
        <div className="fp-count-card fp-count-card--ta">
          <span className="fp-count-card__icon">🛍</span>
          <span className="fp-count-card__label">Takeaway</span>
          <span className="fp-count-card__n">{takeaways.length} orders</span>
          <span className="fp-count-card__total">{formatPrice(takeawayTotal)}</span>
        </div>
        <div className="fp-count-card fp-count-card--del">
          <span className="fp-count-card__icon">🛵</span>
          <span className="fp-count-card__label">Delivery</span>
          <span className="fp-count-card__n">{deliveries.length} orders</span>
          <span className="fp-count-card__total">{formatPrice(deliveryTotal)}</span>
        </div>
      </div>

      <div className="fp-sep" />

      <div className="fp-orders">
        {allOrders.length === 0
          ? <div className="fp-empty">No orders today</div>
          : allOrders.map((job, i) => <OrderRow key={job.jobId || i} job={job} />)
        }
      </div>

      <div className="fp-sep" />

      <div className="fp-grand-total">
        <span>TOTAL</span>
        <span className="fp-grand-total__amount">{formatPrice(grandTotal)}</span>
      </div>
    </div>
  )
}

function JobPreviewModal({ job, onClose }) {
  const isFloat = job.type === 'float'
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal queue-preview-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>#{job.jobId?.slice(-8)}</span>
            <span style={{ marginLeft: 10 }}>{statusBadge(job.status)}</span>
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: 20, color: 'var(--text-muted)', padding: '0 4px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {isFloat && job.floatSummary
          ? <FloatPreview summary={job.floatSummary} />
          : <ReceiptPreview
              items={job.items || []}
              total={job.total}
              tableNumber={job.tableNumber}
              discount={job.discount}
              deliveryFee={job.deliveryFee}
              orderMode={job.orderMode}
              deliveryInfo={job.deliveryInfo}
              orderId={job.orderId}
            />
        }
      </div>
    </div>
  )
}

function JobCard({ job, onSelect, onRetry, t }) {
  const ts = new Date(job.timestamp)
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = ts.toLocaleDateString('en-GB')

  return (
    <div className={`queue-card queue-card--${job.status}`} onClick={() => onSelect(job)} style={{ cursor: 'pointer' }}>
      <div className="queue-card__top">
        <div className="queue-card__meta">
          <div className="queue-card__id">#{job.jobId?.slice(-8) || 'unknown'}</div>
          <div className="queue-card__time">{dateStr} {timeStr}</div>
          {job.tableNumber && (
            <div className="queue-card__table">🪑 {job.tableNumber}</div>
          )}
        </div>
        {statusBadge(job.status)}
      </div>

      <div className="queue-card__items">
        {(job.items || []).slice(0, 4).map((item, i) => (
          <span key={i}>
            {item.nameZh || item.nameEn} ×{item.quantity}
            {i < Math.min(job.items.length, 4) - 1 ? '  ·  ' : ''}
          </span>
        ))}
        {(job.items || []).length > 4 && (
          <span> … +{job.items.length - 4} more</span>
        )}
      </div>

      <div className="queue-card__total">£{Number(job.total).toFixed(2)}</div>

      {job.error && (
        <div className="queue-card__error">Error: {job.error}</div>
      )}

      {job.status === 'failed' && (
        <button className="queue-card__retry" onClick={e => { e.stopPropagation(); onRetry(job.jobId) }}>
          🔄 {t.retry}
        </button>
      )}
    </div>
  )
}

export default function Queue({ onNavigate, settings, t }) {
  const [jobs, setJobs]               = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showPin,     setShowPin]     = useState(false)

  const pin = settings?.pin || '1234'

  const apiBase = settings?.printerUrl || ''

  const fetchJobs = useCallback(async () => {
    if (!apiBase) {
      setError('Printer URL not set — go to Settings to configure it.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/api/jobs`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setJobs(data.jobs || [])
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err.message.includes('<!DOCTYPE')
        ? 'Could not reach printer bridge — check the URL in Settings'
        : `Could not load jobs: ${err.message}`
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  async function handleRetry(jobId) {
    try {
      await fetch(`${apiBase}/api/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, resetToPending: true }),
      })
      fetchJobs()
    } catch (err) {
      console.error('Retry failed:', err)
    }
  }

  async function clearCompleted() {
    const completed = jobs.filter(j => j.status === 'printed')
    await Promise.all(
      completed.map(j =>
        fetch(`${apiBase}/api/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: j.jobId, delete: true }),
        }).catch(() => {})
      )
    )
    fetchJobs()
  }

  async function clearPending() {
    await Promise.all(
      pending.map(j =>
        fetch(`${apiBase}/api/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: j.jobId, delete: true }),
        }).catch(() => {})
      )
    )
    fetchJobs()
  }

  const pending   = jobs.filter(j => j.status === 'pending')
  const printed   = jobs.filter(j => j.status === 'printed')
  const failed    = jobs.filter(j => j.status === 'failed')

  return (
    <div className="screen queue-screen">
      <HomeButton onClick={() => onNavigate('menu')} label={t.home} />

      <div className="queue-header">
        <div>
          <h1>{t.queueTitle}</h1>
          {lastRefresh && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="queue-actions">
          {pending.length > 0 && (
            <button className="queue-btn queue-btn--danger" onClick={() => setShowPin(true)}>
              🗑 Delete Pending ({pending.length})
            </button>
          )}
          {printed.length > 0 && (
            <button className="queue-btn queue-btn--clear" onClick={clearCompleted}>
              {t.clearCompleted}
            </button>
          )}
          <button className="queue-btn queue-btn--refresh" onClick={fetchJobs} disabled={loading}>
            {loading ? '⏳' : '🔄'} {t.refresh}
          </button>
        </div>
      </div>

      <div className="queue-list">
        {error && (
          <div className="settings-status settings-status--error" style={{ margin: '12px 0' }}>
            {error}
          </div>
        )}

        {!loading && jobs.length === 0 && !error && (
          <div className="queue-empty">
            <div className="queue-empty__icon">🖨</div>
            <div>{t.emptyQueue}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.emptyQueueSub}</div>
          </div>
        )}

        {/* Pending first */}
        {pending.map(job => (
          <JobCard key={job.jobId} job={job} onSelect={setSelectedJob} onRetry={handleRetry} t={t} />
        ))}
        {failed.map(job => (
          <JobCard key={job.jobId} job={job} onSelect={setSelectedJob} onRetry={handleRetry} t={t} />
        ))}
        {printed.map(job => (
          <JobCard key={job.jobId} job={job} onSelect={setSelectedJob} onRetry={handleRetry} t={t} />
        ))}
      </div>

      {selectedJob && (
        <JobPreviewModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      {showPin && (
        <PinModal
          prompt="Enter PIN to delete pending jobs"
          correctPin={pin}
          onSuccess={() => { setShowPin(false); clearPending() }}
          onCancel={() => setShowPin(false)}
        />
      )}
    </div>
  )
}
