// Fortune House, Sale — postcode-based delivery fee lookup
// Origin: ~53.4250, -2.3200 (Sale town centre, M33)

const ZONES = [
  { prefix: 'M33', fee: 3.00, label: 'Sale' },
]

const DEFAULT_FEE = 4.00

/**
 * Extract postcode prefix (e.g. "M33 4AB" → "M33", "WA14 2JJ" → "WA14")
 */
function extractPrefix(postcode) {
  const clean = postcode.toUpperCase().replace(/\s+/g, '')
  const m = clean.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)
  return m ? m[1] : null
}

/**
 * Returns { fee, label, zone } for a given postcode string.
 * Returns null if postcode can't be parsed.
 */
export function getDeliveryZone(postcode) {
  if (!postcode) return null
  const prefix = extractPrefix(postcode)
  if (!prefix) return null
  const zone = ZONES.find(z => prefix.startsWith(z.prefix))
  return zone
    ? { fee: zone.fee, label: zone.label, zone: zone.prefix }
    : { fee: DEFAULT_FEE, label: 'Other area', zone: prefix }
}
