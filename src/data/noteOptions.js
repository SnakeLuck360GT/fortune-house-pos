export const NOTE_OPTIONS = [
  { id: 'no-chilli',       zh: '不加辣',   en: 'No Chilli' },
  { id: 'no-garlic',       zh: '不加蒜',   en: 'No Garlic' },
  { id: 'no-onion',        zh: '不加洋葱', en: 'No Onions' },
  { id: 'no-spring-onion', zh: '不加葱',   en: 'No Spring Onion' },
  { id: 'no-vegetables',   zh: '不加蔬菜', en: 'No Vegetables' },
  { id: 'no-mushrooms',    zh: '不加蘑菇', en: 'No Mushrooms' },
  { id: 'no-sugar',        zh: '不加糖',   en: 'No Sugar' },
  { id: 'no-msg',          zh: '不加味精', en: 'No MSG' },
  { id: 'no-salt',         zh: '不加盐',   en: 'No Salt' },
  { id: 'no-egg',          zh: '免蛋',     en: 'No Egg' },
  { id: 'no-pork',         zh: '不加猪肉', en: 'No Pork' },
  { id: 'no-beansprout',   zh: '免芽菜',   en: 'No Beansprout' },
  { id: 'extra-cashew',    zh: '加腰果',   en: 'Extra Cashew Nut' },
  { id: 'less-salt',       zh: '少盐',     en: 'Less Salt' },
  { id: 'extra-sauce',     zh: '多加酱',   en: 'Extra Sauce' },
  { id: 'extra-spicy',     zh: '加辣',     en: 'Extra Spicy' },
  { id: 'extra-chilli',    zh: '多加辣椒', en: 'Extra Chilli' },
  { id: 'extra-mushrooms', zh: '多加蘑菇', en: 'Extra Mushrooms' },
  { id: 'extra-vegetables',zh: '多加蔬菜', en: 'Extra Vegetables' },
  { id: 'extra-rice',      zh: '多加饭',   en: 'Extra Rice' },
  { id: 'extra-noodles',   zh: '多加面',   en: 'Extra Noodles' },
  { id: 'extra-crispy',    zh: '加脆',     en: 'Extra Crispy' },
  { id: 'well-done',       zh: '全熟',     en: 'Well Done' },
]

const BY_ID = Object.fromEntries(NOTE_OPTIONS.map(o => [o.id, o]))
const ZH_EN = Object.fromEntries(NOTE_OPTIONS.map(o => [o.zh, o.en]))

// Convert a comma-joined Chinese note (as stored by NoteModal) to English,
// keeping any custom free-text parts unchanged.
export function translateNoteToEn(note) {
  if (!note) return ''
  return note.split(/[,，]\s*/).map(s => s.trim()).filter(Boolean)
    .map(s => ZH_EN[s] || s).join(', ')
}

// Notes that are always shown regardless of dish
const UNIVERSAL_IDS = [
  'no-msg', 'no-salt', 'less-salt',
  'no-vegetables', 'no-onion', 'no-mushrooms', 'no-garlic', 'no-sugar', 'no-chilli',
  'no-beansprout', 'no-egg',
  'extra-spicy', 'extra-chilli', 'extra-mushrooms', 'extra-vegetables', 'extra-sauce', 'extra-cashew',
  'well-done',
]

// Returns { specific: NoteOption[], universal: NoteOption[] } for a given menu item.
// specific = notes relevant to this dish's ingredients
// universal = always-applicable modifiers
export function getItemNotes(item) {
  const name = ((item?.nameEn ?? '') + ' ' + (item?.nameZh ?? '')).toLowerCase()

  const specificIds = []

  if (/chilli|spicy|\bhot &|szechuan|sichuan|thai|singapore|freaking|salt.{0,3}pepper|椒盐/.test(name))
    specificIds.push('no-chilli')
  if (/garlic/.test(name))
    specificIds.push('no-garlic')
  if (/spring onion/.test(name))
    specificIds.push('no-spring-onion')
  if (/\bonion\b/.test(name) && !/spring onion/.test(name))
    specificIds.push('no-onion')
  if (/\begg\b|foo yung|young chow|fried rice/.test(name))
    specificIds.push('no-egg')
  if (/\bpork\b|char sui|wonton|sui mai|spare rib/.test(name))
    specificIds.push('no-pork')
  if (/fried rice|boiled rice|\brice\b/.test(name))
    specificIds.push('extra-rice')
  if (/noodle|chow mein|vermicelli|udon/.test(name))
    specificIds.push('extra-noodles')
  if (/crispy|deep.fried|salt.{0,3}pepper/.test(name))
    specificIds.push('extra-crispy')

  const specific = specificIds.map(id => BY_ID[id]).filter(Boolean)
  const universal = UNIVERSAL_IDS
    .filter(id => !specificIds.includes(id))
    .map(id => BY_ID[id])

  return { specific, universal }
}
