import { getStore } from '@netlify/blobs'

const blobStore = () => getStore({
  name: 'print-jobs',
  siteID: process.env.NETLIFY_SITE_ID,
  token:  process.env.NETLIFY_TOKEN,
})

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const statusFilter = event.queryStringParameters?.status || 'all'

  try {
    const store = blobStore()

    // Load index
    let index = []
    try {
      const raw = await store.get('index')
      if (raw) index = JSON.parse(raw)
    } catch { /* empty */ }

    // Load all jobs in parallel
    const jobs = await Promise.all(
      index.map(async (jobId) => {
        try {
          const raw = await store.get(`job:${jobId}`)
          return raw ? JSON.parse(raw) : null
        } catch {
          return null
        }
      })
    )

    let filtered = jobs
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (statusFilter !== 'all') {
      filtered = filtered.filter(j => j.status === statusFilter)
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ jobs: filtered }),
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
