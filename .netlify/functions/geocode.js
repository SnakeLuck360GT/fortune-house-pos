const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  const { lat, lon } = event.queryStringParameters || {}
  if (!lat || !lon) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'lat and lon required' }) }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1&accept-language=en-GB`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'FortuneHousePOS/1.0 (contact@fortunehouse.co.uk)',
        'Accept-Language': 'en-GB',
      },
    })

    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const data = await res.json()

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
