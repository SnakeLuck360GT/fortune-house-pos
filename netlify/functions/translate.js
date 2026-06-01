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

  let text, to
  try {
    const body = JSON.parse(event.body || '{}')
    text = body.text?.trim()
    to   = body.to || 'zh-CN'
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  if (!text) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No text provided' }) }
  }

  // Google Translate — unofficial but high-quality, no API key needed
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Upstream ${res.status}` }) }
    }

    const data = await res.json()
    // Response shape: [ [ [translatedChunk, sourceChunk], ... ], null, detectedLang, ... ]
    const translated = data[0]?.map(c => c?.[0] ?? '').join('').trim()

    if (!translated) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Empty response' }) }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ translated, detected: data[2] }),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
