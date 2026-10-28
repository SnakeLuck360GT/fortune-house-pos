// Push a wake-up to the Pi printer bridge via ntfy.sh, so the Pi only calls
// Netlify when there's actually a job instead of polling every few seconds.
// Sent from the browser (not the Netlify function) so ntfy's free per-IP
// limits apply to the restaurant's own connection, not shared Netlify IPs.
// The topic must match NTFY_TOPIC on the Pi (pi-printer/index.js).
const NTFY_URL   = import.meta.env.VITE_NTFY_URL   || 'https://ntfy.sh'
const NTFY_TOPIC = import.meta.env.VITE_NTFY_TOPIC || 'fortunehouse-print-VuobJYS9XKBh'

export function wakePrinter(jobId = '') {
  // Fire-and-forget: the job is already queued, and the Pi's fallback poll
  // will still pick it up if this notification is lost.
  fetch(`${NTFY_URL}/${NTFY_TOPIC}`, { method: 'POST', body: String(jobId) })
    .catch(err => console.warn('Printer wake-up failed:', err))
}
