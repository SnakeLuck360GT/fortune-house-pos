const FORTUNE_HOUSE = { lat: 53.4250, lon: -2.3200 }

export function looksLikePostcode(text) {
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i.test(text.trim())
}

export function formatPostcode(raw) {
  const clean = raw.toUpperCase().replace(/\s+/g, '')
  return clean.length >= 5 ? `${clean.slice(0, -3)} ${clean.slice(-3)}` : clean
}

/**
 * FAST (~300ms): validates postcode via postcodes.io and reverse-geocodes
 * to get the road name. Returns { postcode, road, lat, lon }.
 */
export async function fetchPostcodeInfo(rawPostcode) {
  const postcode = formatPostcode(rawPostcode)

  const pcRes = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s/g, ''))}`,
    { signal: AbortSignal.timeout(4000) }
  )
  const pcData = await pcRes.json()
  if (pcData.status !== 200 || !pcData.result) throw new Error('Invalid postcode')

  const { latitude: lat, longitude: lon } = pcData.result
  let road = ''

  try {
    const revRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`,
      { headers: { 'User-Agent': 'FortuneHousePOS/1.0', 'Accept-Language': 'en-GB' }, signal: AbortSignal.timeout(4000) }
    )
    if (revRes.ok) {
      const rev = await revRes.json()
      road = rev.address?.road || rev.address?.pedestrian || rev.address?.footway || ''
    }
  } catch { /* road stays empty */ }

  return { postcode, road, lat, lon }
}

/**
 * SLOWER (~1-3s): queries Overpass API for all house numbers tagged
 * with this postcode in OSM. Called non-blocking after the fast step.
 * Returns sorted array of { number, lat, lon }.
 */
export async function fetchHouseNumbers(rawPostcode) {
  const postcode = formatPostcode(rawPostcode)
  const query =
    `[out:json][timeout:5];` +
    `(node["addr:postcode"="${postcode}"]["addr:housenumber"];` +
    `way["addr:postcode"="${postcode}"]["addr:housenumber"];` +
    `relation["addr:postcode"="${postcode}"]["addr:housenumber"];);` +
    `out center;`

  // Use AbortController so we can cancel reliably
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    )
    clearTimeout(timer)
    if (!res.ok) return []

    const data = await res.json()
    const seen = new Set()
    return (data.elements || [])
      .map(el => ({
        number: el.tags?.['addr:housenumber'] || '',
        lat:    el.lat ?? el.center?.lat,
        lon:    el.lon ?? el.center?.lon,
      }))
      .filter(h => h.number && !seen.has(h.number) && seen.add(h.number))
      .sort((a, b) => {
        const nA = parseInt(a.number) || 99999
        const nB = parseInt(b.number) || 99999
        return nA !== nB ? nA - nB : a.number.localeCompare(b.number)
      })
  } catch {
    clearTimeout(timer)
    return []
  }
}

/**
 * Drive time in minutes from Fortune House to a coordinate.
 */
export async function fetchDriveMinutes(destLat, destLon) {
  if (!destLat || !destLon) return null
  try {
    const { lat, lon } = FORTUNE_HOUSE
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${destLon},${destLat}?overview=false`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const secs = (await res.json())?.routes?.[0]?.duration
    return secs ? Math.ceil(secs / 60) : null
  } catch { return null }
}
