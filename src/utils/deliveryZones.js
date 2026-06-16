// Fortune House, Sale — postcode-based delivery fee lookup
// Origin: ~53.4250, -2.3200 (Sale town centre, M33)
//
// Delivery area & fees:
//   M33 (all)          £3.00   Sale
//   M23 0, M23 9       £4.00   Wythenshawe (only these sectors, nearest to Sale)
//   WA15 (all)         £4.00   Hale / Altrincham
//   anything else      flagged "Outside delivery area"

const OUT_OF_AREA_FEE = 4.00

// Each zone tests a parsed postcode { outward, sectorDigit }.
const ZONES = [
  { test: p => p.outward.startsWith('M33'), fee: 3.00, label: 'Sale (M33)' },
  { test: p => p.outward === 'M23' && (p.sectorDigit === '0' || p.sectorDigit === '9'), fee: 4.00, label: 'Wythenshawe (M23)' },
  { test: p => p.outward.startsWith('WA15'), fee: 4.00, label: 'Hale / Altrincham (WA15)' },
]

/**
 * Parse a UK postcode into its outward code and the leading digit of the
 * inward code (the "sector"). e.g. "M23 9AB" → { outward:'M23', sectorDigit:'9' },
 * "M334AB" → { outward:'M33', sectorDigit:'4' }, "M23" → { outward:'M23', sectorDigit:'' }.
 */
function parsePostcode(postcode) {
  const clean = postcode.toUpperCase().replace(/\s+/g, '')
  const m = clean.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d)?[A-Z]{0,2}$/)
  if (!m) return null
  return { outward: m[1], sectorDigit: m[2] || '' }
}

/**
 * Returns { fee, label, zone, outOfArea } for a given postcode string.
 * Returns null if the postcode can't be parsed at all.
 */
export function getDeliveryZone(postcode) {
  if (!postcode) return null
  const parsed = parsePostcode(postcode)
  if (!parsed) return null
  const zone = ZONES.find(z => z.test(parsed))
  if (zone) {
    return { fee: zone.fee, label: zone.label, zone: parsed.outward, outOfArea: false }
  }
  return { fee: OUT_OF_AREA_FEE, label: 'Outside delivery area', zone: parsed.outward, outOfArea: true }
}
