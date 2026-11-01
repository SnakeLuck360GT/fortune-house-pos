import { useEffect, useState } from 'react'
import { NTFY_URL, NTFY_TOPIC } from '../utils/wakePrinter.js'

// Shows a banner while the Pi reports the printer out of paper. The Pi pushes
// "out"/"ok" to the `<topic>-status` ntfy topic (never Netlify); we listen with
// one EventSource, which reconnects by itself.
export default function PaperBanner() {
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const es = new EventSource(`${NTFY_URL}/${NTFY_TOPIC}-status/sse`)
    es.onmessage = e => {
      try {
        const { paper, message } = JSON.parse(JSON.parse(e.data).message)
        setMessage(paper === 'out' ? message || 'Printer out of paper' : null)
      } catch { /* keepalive or unrelated */ }
    }
    return () => es.close()
  }, [])

  if (!message) return null
  return (
    <div className="paper-banner" role="alert">
      <span className="paper-banner__icon">🧻</span>
      <span>{message}</span>
      <button className="paper-banner__close" onClick={() => setMessage(null)} aria-label="Dismiss">×</button>
    </div>
  )
}
