// House Banquets — set menus (min 2 persons). Soups + appetisers + aromatic
// crispy duck are included for the table; each person chooses one soup and one
// main course. Everything is served with Young Chow Fried Rice.

export const MIN_PEOPLE = 2

// Soup choice offered with every banquet
const BANQUET_SOUPS = [
  { id: 'hotsour',   en: 'Peking Hot & Sour Soup',  zh: '京式酸辣汤', spicy: true },
  { id: 'sweetcorn', en: 'Chicken Sweetcorn Soup',  zh: '鸡粟汤' },
]

export const BANQUETS = [
  {
    id: 'imperial',
    en: 'Imperial Banquet',
    zh: '帝王宴',
    pricePerPerson: 25.50,
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
      { id: 'im1', en: 'Fried Chicken with XO Spicy Sauce',      zh: 'XO酱炒鸡',   spicy: true },
      { id: 'im2', en: 'Fillet Steak with Cantonese Sauce',      zh: '广式牛柳' },
      { id: 'im3', en: 'Crispy Shredded Beef in Chilli Sauce',   zh: '辣汁脆牛丝', spicy: true },
      { id: 'im4', en: 'Duck with Lemon Sauce',                  zh: '柠檬鸭' },
      { id: 'im5', en: 'King Prawn with Ginger & Spring Onion',  zh: '姜葱大虾' },
    ],
  },
  {
    id: 'peking',
    en: 'Peking Banquet',
    zh: '北京宴',
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
      { id: 'pk1', en: 'Sweet & Sour Chicken',                          zh: '甜酸鸡' },
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

// A person's banquet selection is complete when soup + main are chosen
export function isBanquetPersonComplete(person) {
  return Boolean(person?.soupId && person?.mainId)
}

// Build the single order line-item for a banquet selection.
export function buildBanquetItem({ banquet, people, persons }) {
  const ts = Date.now()

  // Chinese block (large) then English block (small) — same shape the receipt
  // renderers expect: { text, big }.
  const zh = [`${banquet.zh} · ${people}人 · 每位 £${banquet.pricePerPerson.toFixed(2)}`]
  const en = [`${banquet.en} · ${people} people · £${banquet.pricePerPerson.toFixed(2)} pp`]

  zh.push(`包含: ${banquet.included.map(i => i.zh).join('、')}`)
  en.push(`Included: ${banquet.included.map(i => i.en).join(', ')}`)

  persons.forEach((p, i) => {
    const soup = byId(banquet.soups, p.soupId)
    const main = byId(banquet.mains, p.mainId)
    zh.push(`第${i + 1}位: 汤=${soup?.zh ?? '?'} · ${main?.zh ?? '?'}`)
    en.push(`P${i + 1}: Soup=${soup?.en ?? '?'} · ${main?.en ?? '?'}`)
  })

  zh.push(`配${RICE_INCLUDED.zh}`)
  en.push(`Served with ${RICE_INCLUDED.en}`)

  const details = [
    ...zh.map(text => ({ text, big: true })),
    ...en.map(text => ({ text, big: false })),
  ]

  return {
    id:        `banquet-${banquet.id}-${ts}`,
    nameEn:    `${banquet.en} (${people} ${people === 1 ? 'person' : 'people'})`,
    nameZh:    banquet.zh,
    price:     people * banquet.pricePerPerson,
    category:  'House Banquet',
    isOfferItem: true,
    details,
  }
}
