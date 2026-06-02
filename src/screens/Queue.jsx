import { useState, useEffect, useCallback } from 'react'
import HomeButton from '../components/HomeButton.jsx'

function statusBadge(status) {
  return <span className={`queue-badge queue-badge--${status}`}>{status}</span>
}

function JobCard({ job, onRetry, t }) {
  const ts = new Date(job.timestamp)
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = ts.toLocaleDateString('en-GB')

  return (
    <div className={`queue-card queue-card--${job.status}`}>
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
        <button className="queue-card__retry" onClick={() => onRetry(job.jobId)}>
          🔄 {t.retry}
        </button>
      )}
    </div>
  )
}

export default function Queue({ onNavigate, settings, t }) {
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

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
    if (!window.confirm(`Delete ${pending.length} pending job${pending.length !== 1 ? 's' : ''}?`)) return
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
            <button className="queue-btn queue-btn--danger" onClick={clearPending}>
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
          <JobCard key={job.jobId} job={job} onRetry={handleRetry} t={t} />
        ))}
        {failed.map(job => (
          <JobCard key={job.jobId} job={job} onRetry={handleRetry} t={t} />
        ))}
        {printed.map(job => (
          <JobCard key={job.jobId} job={job} onRetry={handleRetry} t={t} />
        ))}
      </div>
    </div>
  )
}
