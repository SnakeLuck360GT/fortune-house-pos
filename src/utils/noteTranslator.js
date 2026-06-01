// Instant offline fallback — resolves before the network call even starts
const QUICK = {
  'no chilli':       '不加辣',
  'no chili':        '不加辣',
  'no garlic':       '不加蒜',
  'no onion':        '不加洋葱',
  'no spring onion': '不加葱',
  'no salt':         '不加盐',
  'no msg':          '不加味精',
  'no pork':         '不加猪肉',
  'no egg':          '不加蛋',
  'no peanuts':      '不加花生',
  'no nuts':         '不加坚果',
  'no sauce':        '不加酱',
  'extra spicy':     '特辣',
  'very spicy':      '非常辣',
  'extra sauce':     '多加酱',
  'extra rice':      '多加饭',
  'well done':       '全熟',
  'half portion':    '半份',
  'vegetarian':      '素食',
  'vegan':           '全素',
  'mild':            '微辣',
  'spicy':           '辣',
}

function quickLookup(text) {
  const lower = text.toLowerCase().trim()
  if (QUICK[lower]) return QUICK[lower]
  let result = lower
  let hit = false
  for (const [en, zh] of Object.entries(QUICK)) {
    if (result.includes(en)) { result = result.replaceAll(en, zh); hit = true }
  }
  return hit && result !== lower ? result : null
}

/**
 * Translates text to Chinese.
 * Priority:
 *   1. Instant local dictionary (zero latency)
 *   2. /api/translate Netlify Function → Google Translate  (production + `netlify dev`)
 *   3. MyMemory public API fallback                        (plain `npm run dev`)
 */
export async function translateNoteOnline(text) {
  if (!text || !text.trim() || isChinese(text)) return null

  // 1. Instant local dictionary
  const quick = quickLookup(text)
  if (quick) return quick

  // 2. Netlify Function (Google Translate quality)
  try {
    const res = await fetch('/api/translate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: text.trim(), to: 'zh-CN' }),
      signal:  AbortSignal.timeout(3000),
    })

    if (res.ok) {
      const data = await res.json()
      const t = data?.translated?.trim()
      if (t && /[一-鿿]/.test(t)) return t
    }
  } catch {
    // Function not running (plain npm run dev) — fall through to MyMemory
  }

  // 3. MyMemory fallback (works without netlify dev)
  try {
    const url =
      `https://api.mymemory.translated.net/get` +
      `?q=${encodeURIComponent(text.trim())}&langpair=en|zh-CN`

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      const t = data?.responseData?.translatedText?.trim()
      if (t && /[一-鿿]/.test(t)) return t
    }
  } catch {
    // No internet or rate-limited
  }

  return null
}

export function isChinese(text) {
  return /[一-鿿]/.test(text ?? '')
}
