// Special Takeaway Offer — config + order-item builder
//
// 2-course meal: predetermined starter + one main per person.
// Each main comes with a choice of sauce and a choice of rice/chips.
// Optional add-ons: aromatic crispy duck (¼ / ½) and soups (£3 each).

import { translateNoteToEn } from './noteOptions.js'

export const OFFER_ID         = 'so01'
export const PRICE_PER_PERSON = 12
export const MIN_PEOPLE       = 2

// Predetermined first course (included in the per-person price)
export const STARTER = {
  en: 'Mini Spring Rolls, Prawn Toast & Chicken Samosas',
  zh: '迷你春卷、虾多士、鸡咖喱角',
}

// Main course — one per person. `forcedSauceId` locks the sauce choice.
export const MAINS = [
  { id: 'charsiu', en: 'Char Siu (Chinese BBQ Pork)', zh: '叉烧' },
  { id: 'beef',    en: 'Beef',                         zh: '牛肉' },
  { id: 'chicken', en: 'Chicken',                      zh: '鸡肉' },
  { id: 'pork',    en: 'Pork',                          zh: '猪肉', forcedSauceId: 'sweetsour', note: 'Sweet & Sour only' },
  { id: 'veg',     en: 'Mixed Vegetables',             zh: '杂菜' },
]

// Sauce / cooking style — one per main
export const SAUCES = [
  { id: 'cantonese',  en: 'Cantonese Sauce',              zh: '中式' },
  { id: 'sweetsour',  en: 'Sweet & Sour Sauce',           zh: '古老' },
  { id: 'szechuan',   en: 'Hot & Spicy Szechuan Sauce',   zh: '四川', spicy: true },
  { id: 'curry',      en: 'Curry Sauce',                  zh: '咖喱酱',     spicy: true },
  { id: 'satay',      en: 'Satay Sauce',                  zh: '沙爹酱',     spicy: true },
  { id: 'thaired',    en: 'Thai Red Curry Sauce',         zh: '泰式红咖喱', spicy: true },
  { id: 'blackbean',  en: 'Green Pepper & Black Bean',    zh: '士召' },
  { id: 'blackpepper',en: 'Black Pepper Sauce',           zh: '黑椒酱' },
  { id: 'mushroom',   en: 'Fresh Mushrooms',              zh: '毛菇' },
  { id: 'broccoli',   en: 'Chinese Leaves & Broccoli',    zh: '唐生菜西兰花' },
]

// Side — one per main
export const RICE_OPTIONS = [
  { id: 'boiled',     en: 'Boiled Rice',         zh: '白饭' },
  { id: 'eggfried',   en: 'Egg Fried Rice',      zh: '蛋炒饭' },
  { id: 'chips',      en: 'Chips',               zh: '薯条' },
  { id: 'softnoodle', en: 'Soft Noodle',         zh: '软面',     extra: 1.50 },
  { id: 'spchips',    en: 'Salt & Pepper Chips', zh: '椒盐薯条', extra: 1.50 },
]

// Optional aromatic crispy duck add-on
export const DUCK_OPTIONS = [
  { id: 'none',    en: 'No Duck',                    zh: '不加',         price: 0 },
  { id: 'quarter', en: '¼ Aromatic Crispy Duck',     zh: '四分一片皮鸭', price: 11 },
  { id: 'half',    en: '½ Aromatic Crispy Duck',     zh: '半只片皮鸭',   price: 22 },
]
export const DUCK_NOTE    = 'Served with pancakes, hoi sin sauce, cucumber & leek'
export const DUCK_NOTE_ZH = '配薄饼、海鲜酱、青瓜及葱'

// Optional soups (£3 each, min 2 persons applies to the offer itself)
export const SOUP_PRICE = 3
export const SOUPS = [
  { id: 'sweetcorn', en: 'Chicken & Sweetcorn Soup', zh: '鸡粟汤' },
  { id: 'hotsour',   en: 'Peking Hot & Sour Soup',    zh: '京汤' },
]

const byId = (list, id) => list.find(x => x.id === id)

// Collapse repeated identical lines into "text ×n" (original order preserved).
function tally(list) {
  const order = []
  const counts = new Map()
  for (const t of list) {
    if (!counts.has(t)) order.push(t)
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  return order.map(t => (counts.get(t) > 1 ? `${t} ×${counts.get(t)}` : t))
}

// Resolve the sauce that applies to a person's main (honours forcedSauceId).
export function effectiveSauceId(main, chosenSauceId) {
  if (!main) return chosenSauceId
  return main.forcedSauceId || chosenSauceId
}

// Is a person's selection complete? (main + sauce + rice)
export function isPersonComplete(person) {
  if (!person?.mainId || !person?.riceId) return false
  const main = byId(MAINS, person.mainId)
  return Boolean(effectiveSauceId(main, person.sauceId))
}

// Build the order line-items for a completed selection.
// Returns a flat array; soups are repeated once per unit so the order reducer
// (which forces quantity:1 on insert and merges duplicate ids) tallies them.
export function buildOfferItems({ people, persons, duckId, soups }) {
  const ts = Date.now()
  const items = []

  // Per-person breakdown for the kitchen ticket. Built as two blocks: the
  // Chinese block (rendered large — the kitchen reads Chinese) comes first,
  // then the English block (small) beneath. Each detail carries { text, big }.
  // Trimmed kitchen ticket: grouped Mains (meat · sauce per person) then the
  // Side dish for each person. Starter / price recap omitted to cut clutter;
  // repeated choices collapse into "… ×n".
  const stripParen = s => s.replace(/\s*\(.*\)\s*/, '')
  const mainZh = [], mainEn = [], sideZh = [], sideEn = []
  persons.forEach((p) => {
    const main  = byId(MAINS, p.mainId)
    const sauce = byId(SAUCES, effectiveSauceId(main, p.sauceId))
    const rice  = byId(RICE_OPTIONS, p.riceId)
    const note  = p.note?.trim()
    mainZh.push(`${main?.zh ?? '?'} · ${sauce?.zh ?? '?'}${note ? ` · 备注: ${note}` : ''}`)
    mainEn.push(`${stripParen(main?.en ?? '?')} · ${sauce?.en ?? '?'}${note ? ` · Note: ${translateNoteToEn(note)}` : ''}`)
    sideZh.push(rice?.zh ?? '?')
    sideEn.push(stripParen(rice?.en ?? '?'))
  })
  const details = [
    { text: '主菜:', big: true, header: true },
    ...tally(mainZh).map(text => ({ text: `  ${text}`, big: true })),
    { text: '配菜:', big: true, header: true },
    ...tally(sideZh).map(text => ({ text: `  ${text}`, big: true })),
    { text: 'Mains:', big: false, header: true },
    ...tally(mainEn).map(text => ({ text: `  ${text}`, big: false })),
    { text: 'Side dish:', big: false, header: true },
    ...tally(sideEn).map(text => ({ text: `  ${text}`, big: false })),
  ]

  const sideExtras = persons.reduce((s, p) => s + (byId(RICE_OPTIONS, p.riceId)?.extra || 0), 0)

  items.push({
    id:        `so-offer-${ts}`,
    nameEn:    'Special Takeaway Offer',
    nameZh:    '特价外卖套餐',
    price:     people * PRICE_PER_PERSON + sideExtras,
    category:  'Special Offer',
    isOfferItem: true,
    peopleQty: people,   // show "×people" on the receipt instead of the line quantity
    details,
  })

  // Duck add-on
  const duck = byId(DUCK_OPTIONS, duckId)
  if (duck && duck.id !== 'none') {
    items.push({
      id:       `so-duck-${duck.id}-${ts}`,
      nameEn:   duck.en,
      nameZh:   duck.zh,
      price:    duck.price,
      category: 'Special Offer',
      isOfferItem: true,
      details:  [{ text: DUCK_NOTE_ZH, big: true }, { text: DUCK_NOTE, big: false }],
    })
  }

  // Soups — emit one entry per unit (same id => reducer merges & counts)
  SOUPS.forEach(soup => {
    const qty = soups?.[soup.id] || 0
    for (let n = 0; n < qty; n++) {
      items.push({
        id:       `so-soup-${soup.id}-${ts}`,
        nameEn:   soup.en,
        nameZh:   soup.zh,
        price:    SOUP_PRICE,
        category: 'Special Offer',
        isOfferItem: true,
      })
    }
  })

  return items
}

// Running total for the live summary in the wizard
export function offerTotal({ people, persons, duckId, soups }) {
  const base = people * PRICE_PER_PERSON
  const sideExtras = (persons || []).reduce((s, p) => s + (byId(RICE_OPTIONS, p.riceId)?.extra || 0), 0)
  const duck = byId(DUCK_OPTIONS, duckId)
  const duckPrice = duck ? duck.price : 0
  const soupCount = SOUPS.reduce((s, soup) => s + (soups?.[soup.id] || 0), 0)
  return base + sideExtras + duckPrice + soupCount * SOUP_PRICE
}
