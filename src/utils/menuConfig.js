// Menu config — the restaurant's own edits on top of the built-in menu:
//   names:     { [itemId]: { nameEn?, nameZh? } }   renamed dishes (choice ids are `${itemId}_${choiceId}`)
//   dishNotes: { [itemId]: [{ id, zh, en, price }] } extra notes for one dish
//   notes:     [{ id, zh, en, price }]               extra notes for every dish
// Kept in localStorage (survives closing the browser) and exportable as a file.
// It lives on this device only — export/import to copy it to another tablet.
import { useSyncExternalStore } from 'react'

const CONFIG_KEY   = 'pos_menu_config'
const SETTINGS_KEY = 'pos_settings'   // App.jsx settings, included in exports
const PASSWORD_KEY = 'pos_config_pw'  // SHA-256 of the config password

const EMPTY = { names: {}, dishNotes: {}, notes: [] }

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY))
    return raw ? { ...EMPTY, ...raw } : EMPTY
  } catch { return EMPTY }
}

let config = load()
const listeners = new Set()

export function getConfig() { return config }

export function saveConfig(next) {
  config = { ...EMPTY, ...next }
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) }
  catch (err) { console.error('Config save failed:', err) }
  listeners.forEach(fn => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useMenuConfig() {
  return useSyncExternalStore(subscribe, getConfig)
}

export const newNoteId = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Order lines keep the menu id as a prefix: "cs17_blackbean", "hd02-ok-1712…".
export const baseItemId = id => String(id ?? '').split(/[_-]/)[0]

// Apply renamed dishes (and renamed pick-one choices) to a menu item. The
// original names stay on as baseNameEn/Zh so the built-in dish-specific notes
// (matched on the name, e.g. BBQ骨 → 干身不加汁) still find the dish.
const rename = (x, o) => ({ ...x, nameEn: o.nameEn || x.nameEn, nameZh: o.nameZh || x.nameZh, baseNameEn: x.nameEn, baseNameZh: x.nameZh })

export function applyNames(item, cfg = config) {
  const own = cfg.names[item.id]
  const choices = item.choices?.map(c => {
    const o = cfg.names[`${item.id}_${c.id}`]
    return o ? rename(c, o) : c
  })
  if (!own && !choices) return item
  return { ...(own ? rename(item, own) : item), ...(choices && { choices }) }
}

// Custom notes that apply to an order line: its dish's own notes, then the global extras.
// Notes still being typed (no Chinese yet) are left out.
const ready = list => (list || []).filter(n => n.zh?.trim())

export function dishNotesFor(item, cfg = config) {
  return ready(cfg.dishNotes[item?.id] || cfg.dishNotes[baseItemId(item?.id)])
}

export const globalNotes = (cfg = config) => ready(cfg.notes)

// ─── Password ────────────────────────────────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const hasPassword = () => Boolean(localStorage.getItem(PASSWORD_KEY))

export async function setPassword(pw) {
  localStorage.setItem(PASSWORD_KEY, await sha256(pw))
}

export async function checkPassword(pw) {
  return (await sha256(pw)) === localStorage.getItem(PASSWORD_KEY)
}

// ─── Export / import ─────────────────────────────────────────────────────────
// The password is never exported; importing keeps this device's password.
export function exportAll() {
  let settings = {}
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch { /* none */ }
  return {
    app: 'fortune-house-pos',
    version: 1,
    exportedAt: new Date().toISOString(),
    menuConfig: config,
    settings,
  }
}

export function importAll(data) {
  if (data?.app !== 'fortune-house-pos' || !data.menuConfig) throw new Error('Not a Fortune House settings file')
  const { names = {}, dishNotes = {}, notes = [] } = data.menuConfig
  saveConfig({ names, dishNotes, notes })
  if (data.settings && typeof data.settings === 'object') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings))
  }
}
