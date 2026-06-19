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

  const {
    orderId, items, total, discount, deliveryFee, tableNumber, timestamp,
    type, floatSummary, orderMode, deliveryInfo, lang, customerName, phone,
  } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No items provided' }) }
  }

  const jobId = orderId || `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const job = {
    jobId,
    orderId: orderId || jobId,
    type: type || 'order',
    items,
    total: Number(total) || 0,
    discount: Number(discount) || 0,
    deliveryFee: Number(deliveryFee) || 0,
    tableNumber: tableNumber || '',
    timestamp: timestamp || Date.now(),
    orderMode: orderMode || 'takeaway',
    deliveryInfo: deliveryInfo || null,
    customerName: customerName || '',
    phone: phone || '',
    floatSummary: floatSummary || null,
    lang: lang || 'en',
    status: 'pending',
    createdAt: Date.now(),
    error: null,
  }

  try {
    const store = blobStore()

    // Save the job itself
    await store.set(`job:${jobId}`, JSON.stringify(job))

    // Update the index (append jobId)
    let index = []
    try {
      const raw = await store.get('index')
      if (raw) index = JSON.parse(raw)
    } catch { /* first job */ }

    index.push(jobId)
    // Keep index bounded to last 200 jobs
    if (index.length > 200) index = index.slice(-200)
    await store.set('index', JSON.stringify(index))

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, jobId }),
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
