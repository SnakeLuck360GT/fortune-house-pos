// House Dishes — "Choose a dish, THEN ADD (one item only)".
// The dish (Fried Sliced Beef, etc.) comes from menu.js with isHouseDish:true.
// This file holds the sauce/style list and combines them into an order item.

// `extra` = surcharge added to the dish price. `spicy`/`nut` are display flags.
export const HOUSE_DISH_SAUCES = [
  { id: 'sweetsour',  en: 'Sweet & Sour Sauce',           zh: '古老' },
  { id: 'pineapple',  en: 'Pineapple',                    zh: '菠萝' },
  { id: 'tomato',     en: 'Fresh Tomatoes',               zh: '鲜番茄' },
  { id: 'mushroom',   en: 'Fresh Mushrooms',              zh: '毛菇' },
  { id: 'cashew',     en: 'Cashew Nut',                   zh: '腰果',         extra: 2, nut: true },
  { id: 'broccoli',   en: 'Chinese Leaves & Broccoli',    zh: '唐生菜西兰花' },
  { id: 'blackbean',  en: 'Green Pepper & Blackbean Sauce', zh: '士召',    spicy: true },
  { id: 'ginger',     en: 'Fresh Ginger & Spring Onion',  zh: '姜葱' },
  { id: 'cantonese',  en: 'Cantonese Sauce',              zh: '中式' },
  { id: 'winegarlic', en: 'Wine & Garlic Sauce',          zh: '蒜蓉酒香汁',   spicy: true },
  { id: 'curry',      en: 'Curry Sauce',                  zh: '咖喱汁',       spicy: true },
  { id: 'satay',      en: 'Satay Sauce',                  zh: '沙爹汁',       spicy: true },
  { id: 'ok',         en: 'OK Sauce (in Batter)',         zh: 'OK汁(脆炸)' },
  { id: 'szechuan',   en: 'Hot & Spicy Szechuan Sauce',   zh: '四川',   spicy: true },
  { id: 'kunbo',      en: 'Kunbo Style',                  zh: '宫保',         extra: 2, spicy: true },
  { id: 'oyster',     en: 'Oyster Sauce',                 zh: '蚝油' },
  { id: 'fooyung',    en: 'Foo Yung',                     zh: '芙蓉蛋' },
  { id: 'blackpepper',en: 'Black Pepper Sauce',           zh: '黑椒汁',       spicy: true },
  { id: 'chopsuey',   en: 'Chop Suey Style',              zh: '杂水' },
  { id: 'chiligarlic',en: 'Chilli Garlic Sauce',          zh: '蒜辣',     spicy: true },
  { id: 'thaired',    en: 'Thai Red Curry Sauce',         zh: '泰式红咖喱',   spicy: true },
  { id: 'xo',         en: 'XO Spicy Sauce',               zh: 'XO香辣汁',     extra: 2, spicy: true },
  { id: 'omelette',   en: 'Omelette (chips included)',    zh: '俺力(含薯条)', extra: 2 },
]

export const sauceById = id => HOUSE_DISH_SAUCES.find(s => s.id === id)

// Combine the chosen dish + one sauce into an order line item. The dish stays
// as the item name; the sauce prints on its own line beneath (Chinese large,
// English small) via the shared details renderer.
export function buildHouseDishItem(dish, sauceId) {
  const sauce = sauceById(sauceId)
  if (!sauce) return null
  const extra = sauce.extra || 0
  return {
    id:       `${dish.id}-${sauce.id}-${Date.now()}`,
    nameEn:   dish.nameEn,
    nameZh:   dish.nameZh,
    price:    dish.price + extra,
    category: 'House Dishes',
    details: [
      { text: sauce.zh, big: true },
      { text: sauce.en, big: false },
    ],
  }
}
