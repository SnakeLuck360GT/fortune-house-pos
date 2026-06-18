// UK phone number helpers.
// NOTE: this validates FORMAT only (catches typos — wrong length, stray letters,
// missing leading 0). It does NOT verify the number is a real, live line — that
// needs a paid lookup API (e.g. Twilio Lookup, Numverify).

// Strip formatting and convert +44 / 0044 to the leading 0 form.
export function normalizePhone(raw) {
  let s = String(raw || '').replace(/[^\d+]/g, '')
  if (s.startsWith('+44'))  s = '0' + s.slice(3)
  else if (s.startsWith('0044')) s = '0' + s.slice(4)
  return s
}

// A UK number is 10–11 digits starting with 0 (mobiles 07… are 11).
export function isValidUkPhone(raw) {
  return /^0\d{9,10}$/.test(normalizePhone(raw))
}

// Pretty single-space grouping for display, e.g. "07700 900123".
export function formatPhone(raw) {
  const s = normalizePhone(raw)
  if (/^07\d{9}$/.test(s)) return `${s.slice(0, 5)} ${s.slice(5)}`        // mobile
  if (/^0(20|21|23|24|28|29)\d{8}$/.test(s)) return `${s.slice(0, 3)} ${s.slice(3, 7)} ${s.slice(7)}` // 2+4+4
  if (s.length === 11) return `${s.slice(0, 5)} ${s.slice(5)}`
  return s
}
