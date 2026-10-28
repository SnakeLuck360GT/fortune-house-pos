import { getConfig, dishNotesFor, globalNotes } from '../utils/menuConfig.js'

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
  { id: 'no-sauce',        zh: '不加酱',   en: 'No Sauce' },
  { id: 'add-sauce',       zh: '加酱',     en: 'Add Sauce' },
  { id: 'extra-sauce',     zh: '多加酱',   en: 'Extra Sauce' },
  { id: 'extra-spicy',     zh: '加辣',     en: 'Extra Spicy' },
  { id: 'extra-chilli',    zh: '多加辣椒', en: 'Extra Chilli' },
  { id: 'extra-mushrooms', zh: '多加蘑菇', en: 'Extra Mushrooms' },
  { id: 'extra-vegetables',zh: '多加蔬菜', en: 'Extra Vegetables' },
  { id: 'extra-rice',      zh: '多加饭',   en: 'Extra Rice' },
  { id: 'extra-noodles',   zh: '多加面',   en: 'Extra Noodles' },
  { id: 'extra-crispy',    zh: '加脆',     en: 'Extra Crispy' },
  { id: 'no-batter',       zh: '不上粉',   en: 'No Batter' },
  { id: 'dry',             zh: '干身不加汁', en: 'Dry (No Sauce)' },
  { id: 'well-done',       zh: '全熟',     en: 'Well Done' },
]

const BY_ID = Object.fromEntries(NOTE_OPTIONS.map(o => [o.id, o]))

// Chinese → English for built-in notes plus the ones added in Menu Config.
function zhToEn() {
  const cfg = getConfig()
  const custom = [...cfg.notes, ...Object.values(cfg.dishNotes).flat()]
  return Object.fromEntries([...NOTE_OPTIONS, ...custom].map(o => [o.zh, o.en]))
}

// Convert a comma-joined Chinese note (as stored by NoteModal) to English,
// keeping any custom free-text parts unchanged.
export function translateNoteToEn(note) {
  if (!note) return ''
  const map = zhToEn()
  return note.split(/[,，]\s*/).map(s => s.trim()).filter(Boolean)
    .map(s => map[s] || s).join(', ')
}

// Notes that are always shown regardless of dish
const UNIVERSAL_IDS = [
  'no-msg', 'no-salt', 'less-salt',
  'no-vegetables', 'no-onion', 'no-mushrooms', 'no-garlic', 'no-sugar', 'no-chilli',
  'no-beansprout', 'no-egg',
  'no-sauce', 'add-sauce',
  'extra-spicy', 'extra-chilli', 'extra-mushrooms', 'extra-vegetables', 'extra-sauce', 'extra-cashew',
  'well-done',
]

// Returns { specific: NoteOption[], universal: NoteOption[] } for a given menu item.
// specific = notes relevant to this dish's ingredients
// universal = always-applicable modifiers
export function getItemNotes(item) {
  // Original names, so renaming a dish in Menu Config doesn't change its notes
  const name = ((item?.baseNameEn ?? item?.nameEn ?? '') + ' ' + (item?.baseNameZh ?? item?.nameZh ?? '')).toLowerCase()

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
  // Battered dishes: "in Batter", 脆炸, and OK sauce (always battered); `batter` flags the rest
  if (item?.batter || /batter|脆炸|\bok\b/.test(name))
    specificIds.push('no-batter')
  if (/bbq骨/.test(name))   // BBQ ribs (not Char Sui "BBQ Pork")
    specificIds.push('dry')

  // Notes added in Menu Config: this dish's own go with the dish-specific ones,
  // the all-dishes extras join the universal list (shown under "Other").
  const cfg = getConfig()
  const specific = [...specificIds.map(id => BY_ID[id]).filter(Boolean), ...dishNotesFor(item, cfg)]
  const universal = [
    ...UNIVERSAL_IDS.filter(id => !specificIds.includes(id)).map(id => BY_ID[id]),
    ...globalNotes(cfg),
  ]

  return { specific, universal }
}
