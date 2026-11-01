// Delivery customers remembered on this device, so a returning customer's
// address can be suggested from their name + phone. Saved after each delivery
// order is sent to the printer; included in the Menu Config export.
import { normalizePhone } from './phone.js'

const KEY = 'pos_customers'
const MAX = 2000   // oldest are dropped beyond this

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] }
  catch { return [] }
}

export const getCustomers = load

export function setCustomers(list) {
  try { localStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : [])) }
  catch (err) { console.error('Customer save failed:', err) }
}

const firstName = s => String(s || '').trim().toLowerCase().split(/\s+/)[0] || ''

// Remember (or refresh) one customer + address. Same phone, name and address
// updates the existing entry instead of adding a duplicate.
export function rememberCustomer({ customerName, phone, postcode, houseNumber, address }) {
  const tel = normalizePhone(phone)
  if (!tel || !customerName?.trim() || !postcode) return
  const list = load()
  const same = c => c.phone === tel && firstName(c.name) === firstName(customerName)
    && c.postcode === postcode && (c.houseNumber || '') === (houseNumber || '')
  const prev = list.find(same)
  const entry = {
    name:        customerName.trim(),
    phone:       tel,
    postcode,
    houseNumber: houseNumber || '',
    address,
    orders:      (prev?.orders || 0) + 1,
    lastOrder:   Date.now(),
  }
  setCustomers([entry, ...list.filter(c => !same(c))].slice(0, MAX))
}

// Past addresses for this phone number where the first name matches too
// ("John" matches "John Smith"), most recent first.
export function findAddresses(name, phone) {
  const tel = normalizePhone(phone)
  const first = firstName(name)
  if (tel.length < 10 || !first) return []
  return load()
    .filter(c => c.phone === tel && firstName(c.name) === first)
    .sort((a, b) => b.lastOrder - a.lastOrder)
    .slice(0, 3)
}
