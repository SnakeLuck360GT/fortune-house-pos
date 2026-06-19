// House Banquets — set menus (min 2 persons). Soups + appetisers + aromatic
// crispy duck are included for the table; each person chooses one soup and one
// main course. Everything is served with Young Chow Fried Rice.

import { translateNoteToEn } from './noteOptions.js'

export const MIN_PEOPLE = 2

// Soup choice offered with every banquet
const BANQUET_SOUPS = [
  { id: 'hotsour',   en: 'Peking Hot & Sour Soup',  zh: '京式酸辣汤', spicy: true },
  { id: 'sweetcorn', en: 'Chicken Sweetcorn Soup',  zh: '鸡粟汤' },
]

export const BANQUETS = [
  {
    id: 'imperial',
    en: 'Banquet B',
    zh: 'B餐',
    pricePerPerson: 25.50,
    hasDuck: true,   // Banquet B includes aromatic crispy duck (shown on the ticket)
    // Shared, included courses (display + printed on the ticket)
    included: [
      { en: 'Prawn Crackers',            zh: '虾片' },
      { en: 'Salt & Pepper Chicken Wings', zh: '椒盐鸡翅', spicy: true },
      { en: 'Mini Spring Rolls',         zh: '迷你春卷' },
      { en: 'Sesame Prawn Toast',        zh: '芝麻虾多士' },
      { en: 'BBQ Ribs',                  zh: '烧烤排骨' },
      { en: 'Crispy Seaweed',            zh: '脆海带' },
      { en: 'Aromatic Crispy Duck',      zh: '香酥鸭' },
    ],
    soups: BANQUET_SOUPS,
    mains: [
      { id: 'im1', en: 'Fried Chicken with XO Spicy Sauce',      zh: 'XO酱炒鸡',   spicy: true, chicken: true },
      { id: 'im2', en: 'Fillet Steak with Cantonese Sauce',      zh: '广式牛柳' },
      { id: 'im3', en: 'Crispy Shredded Beef in Chilli Sauce',   zh: '辣汁脆牛丝', spicy: true },
      { id: 'im4', en: 'Duck with Lemon Sauce',                  zh: '柠檬鸭' },
      { id: 'im5', en: 'King Prawn with Ginger & Spring Onion',  zh: '姜葱大虾' },
    ],
  },
  {
    id: 'peking',
    en: 'Banquet A',
    zh: 'A餐',
    pricePerPerson: 21.50,
    included: [
      { en: 'Prawn Crackers',           zh: '虾片' },
      { en: 'Prawn Toast',              zh: '虾多士' },
      { en: 'Crispy Mini Spring Rolls', zh: '迷你春卷' },
      { en: 'BBQ Ribs (1 per head)',    zh: '烧烤排骨 (每位一件)' },
      { en: 'Crispy Seaweed',           zh: '脆海带' },
      { en: 'Crispy Wonton',            zh: '炸云吞' },
      { en: 'Sweet & Sour Dipping Sauce', zh: '甜酸汁' },
    ],
    soups: BANQUET_SOUPS,
    mains: [
      { id: 'pk1', en: 'Sweet & Sour Chicken',                          zh: '甜酸鸡', chicken: true },
      { id: 'pk2', en: 'Sliced Beef with Green Pepper & Black Bean Sauce', zh: '豉椒牛肉' },
      { id: 'pk3', en: 'Duck in Plum Sauce',                            zh: '梅子鸭' },
      { id: 'pk4', en: 'Fried King Prawn in Chilli Garlic Sauce',       zh: '蒜辣大虾', spicy: true },
      { id: 'pk5', en: 'Lamb in Black Pepper Sauce',                    zh: '黑椒羊肉', spicy: true },
    ],
  },
]

export const RICE_INCLUDED = { en: 'Young Chow Fried Rice', zh: '扬州炒饭' }

export const banquetById = id => BANQUETS.find(b => b.id === id)
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

// "Choose 1 different main per person if fewer than 5 people." So under 5
// people a duplicate of someone else's main costs extra (chicken is exempt).
// At 5+ people repeats are allowed for free (1 dish per person).
export const DUPLICATE_MAIN_FEE = 5
export const FREE_DUPLICATE_PEOPLE = 5   // at this many people or more, repeats are free

// Total surcharge for duplicated (non-chicken) mains across the party.
// For a non-chicken main chosen by N people, (N - 1) duplicates × the fee.
export function banquetSurcharge(banquet, persons) {
  if (!banquet) return 0
  if (persons.length >= FREE_DUPLICATE_PEOPLE) return 0   // 5+ people: repeats free
  const counts = {}
  persons.forEach(p => { if (p.mainId) counts[p.mainId] = (counts[p.mainId] || 0) + 1 })
  let fee = 0
  for (const [mainId, count] of Object.entries(counts)) {
    const main = byId(banquet.mains, mainId)
    if (main && !main.chicken && count > 1) fee += (count - 1) * DUPLICATE_MAIN_FEE
  }
  return fee
}

// A person's banquet selection is complete when soup + main are chosen
export function isBanquetPersonComplete(person) {
  return Boolean(person?.soupId && person?.mainId)
}

// Build the single order line-item for a banquet selection.
export function buildBanquetItem({ banquet, people, persons }) {
  const ts = Date.now()

  // Chinese block (large) then English block (small) — same shape the receipt
  // renderers expect: { text, big, header }. Trimmed kitchen ticket: grouped
  // Soups then Mains, with the included rice at the bottom. Repeated choices
  // collapse into "… ×n".
  const soupZh = [], soupEn = [], mainZh = [], mainEn = []
  persons.forEach((p) => {
    const soup = byId(banquet.soups, p.soupId)
    const main = byId(banquet.mains, p.mainId)
    const note = p.note?.trim()
    soupZh.push(soup?.zh ?? '?')
    soupEn.push(soup?.en ?? '?')
    mainZh.push(`${main?.zh ?? '?'}${note ? ` · 备注: ${note}` : ''}`)
    mainEn.push(`${main?.en ?? '?'}${note ? ` · Note: ${translateNoteToEn(note)}` : ''}`)
  })

  // Shared starters listed under Soups, after the per-person soup choices:
  // a mixed appetiser platter, plus aromatic crispy duck on banquets that include it.
  const starterZh = ['拼盘', ...(banquet.hasDuck ? ['鸭'] : [])]
  const starterEn = ['Mix Platter', ...(banquet.hasDuck ? ['Duck'] : [])]

  const surcharge = banquetSurcharge(banquet, persons)
  const surZh = surcharge > 0 ? [{ text: `重复主菜加收 +£${surcharge.toFixed(2)}`, big: true }] : []
  const surEn = surcharge > 0 ? [{ text: `Duplicate main(s) +£${surcharge.toFixed(2)}`, big: false }] : []

  // Big (Chinese) block: each starter (platter, + duck on B) is fenced by a
  // horizontal rule, so the Soups section reads:  soups ─ platter ─ duck ─ mains.
  // English block stays compact — plain lines, no rules.
  const RULE = { rule: true }
  const starterZhBlock = [...starterZh.flatMap(text => [RULE, { text: `  ${text}`, big: true }]), RULE]
  const starterEnLines = starterEn.map(text => ({ text: `  ${text}`, big: false }))

  const details = [
    { text: '汤:', big: true, header: true },
    ...tally(soupZh).map(text => ({ text: `  ${text}`, big: true })),
    ...starterZhBlock,
    { text: '主菜:', big: true, header: true },
    ...tally(mainZh).map(text => ({ text: `  ${text}`, big: true })),
    { text: `${RICE_INCLUDED.zh} ×${people}`, big: true },
    ...surZh,
    { text: 'Soups:', big: false, header: true },
    ...tally(soupEn).map(text => ({ text: `  ${text}`, big: false })),
    ...starterEnLines,
    { text: 'Mains:', big: false, header: true },
    ...tally(mainEn).map(text => ({ text: `  ${text}`, big: false })),
    { text: `${RICE_INCLUDED.en} ×${people}`, big: false },
    ...surEn,
  ]

  return {
    id:        `banquet-${banquet.id}-${ts}`,
    nameEn:    banquet.en,
    nameZh:    banquet.zh,
    price:     people * banquet.pricePerPerson + surcharge,
    category:  'House Banquet',
    isOfferItem: true,
    peopleQty: people,   // show "×people" on the receipt instead of the line quantity
    details,
  }
}
