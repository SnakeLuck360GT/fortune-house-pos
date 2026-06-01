import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

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

  const { jobId, error } = body

  if (!jobId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'jobId required' }) }
  }

  try {
    const store = getStore('print-jobs')

    const raw = await store.get(`job:${jobId}`)
    if (!raw) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Job not found' }) }
    }

    const job = JSON.parse(raw)
    job.status   = 'failed'
    job.error    = error || 'Unknown printer error'
    job.failedAt = Date.now()

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
