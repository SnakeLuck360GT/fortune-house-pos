import { getStore } from '@netlify/blobs'

const blobStore = () => getStore({
  name: 'print-jobs',
  siteID: process.env.NETLIFY_SITE_ID,
  token:  process.env.NETLIFY_TOKEN,
})

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

// Handles: mark as printed, reset to pending (retry), or delete (clear completed)
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { jobId, resetToPending, delete: shouldDelete } = body

  if (!jobId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'jobId required' }) }
  }

  try {
    const store = blobStore()

    if (shouldDelete) {
      // Remove from index and delete the blob
      await store.delete(`job:${jobId}`)
      let index = []
      try {
        const raw = await store.get('index')
        if (raw) index = JSON.parse(raw)
      } catch { /* ok */ }
      const newIndex = index.filter(id => id !== jobId)
      await store.set('index', JSON.stringify(newIndex))
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
    }

    const raw = await store.get(`job:${jobId}`)
    if (!raw) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Job not found' }) }
    }

    const job = JSON.parse(raw)
    job.status = resetToPending ? 'pending' : 'printed'
    job.error  = null
    job.printedAt = resetToPending ? null : Date.now()

    await store.set(`job:${jobId}`, JSON.stringify(job))

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('Blob error:', err)
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Storage error', detail: err.message }),
    }
  }
}
