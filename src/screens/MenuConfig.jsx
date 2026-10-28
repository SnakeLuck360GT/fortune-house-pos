import { useState, useMemo, useRef } from 'react'
import HomeButton from '../components/HomeButton.jsx'
import { menu } from '../data/menu.js'
import { NOTE_OPTIONS, getItemNotes } from '../data/noteOptions.js'
import { formatPrice } from '../utils/receiptFormatter.js'
import {
  useMenuConfig, saveConfig, newNoteId,
  hasPassword, setPassword, checkPassword, exportAll, importAll,
} from '../utils/menuConfig.js'

// Commas separate notes on an order line, so they can't appear inside one.
const noComma = s => s.replace(/[,，]/g, '')

// ─── Password gate ───────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const creating = !hasPassword()
  const [pw, setPw]       = useState('')
  const [pw2, setPw2]     = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (creating) {
      if (pw.length < 4) return setError('Use at least 4 characters')
      if (pw !== pw2)    return setError('Passwords don’t match')
      await setPassword(pw)
      onUnlock()
    } else if (await checkPassword(pw)) {
      onUnlock()
    } else {
      setError('Wrong password')
      setPw('')
    }
  }

  return (
    <form className="cfg-gate" onSubmit={submit}>
      <div className="cfg-gate__icon">🔒</div>
      <h2>{creating ? 'Create a config password' : 'Enter config password'}</h2>
      {creating && <p className="cfg-muted">You’ll need this every time you open Menu Config on this device.</p>}
      <input className="cfg-input" type="password" autoFocus value={pw} onChange={e => { setPw(e.target.value); setError('') }} placeholder="Password" />
      {creating && (
        <input className="cfg-input" type="password" value={pw2} onChange={e => { setPw2(e.target.value); setError('') }} placeholder="Repeat password" />
      )}
      {error && <div className="settings-status settings-status--error">{error}</div>}
      <button className="settings-btn settings-btn--gold" type="submit">{creating ? 'Save password' : 'Unlock'}</button>
    </form>
  )
}

// ─── Editable list of notes (zh / en / price) ────────────────────────────────
function NoteListEditor({ notes, onChange, addLabel }) {
  const update = (id, patch) => onChange(notes.map(n => (n.id === id ? { ...n, ...patch } : n)))
  return (
    <div className="cfg-notes">
      {notes.map(n => (
        <div key={n.id} className="cfg-note">
          <input className="cfg-input cfg-input--zh" value={n.zh} onChange={e => update(n.id, { zh: noComma(e.target.value) })} placeholder="中文" lang="zh-Hans" />
          <input className="cfg-input" value={n.en} onChange={e => update(n.id, { en: noComma(e.target.value) })} placeholder="English" />
          <div className="cfg-price">
            <span>+£</span>
            <input type="number" min="0" step="0.50" inputMode="decimal" value={n.price || ''} placeholder="0.00"
              onChange={e => update(n.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })} />
          </div>
          <button type="button" className="cfg-del" onClick={() => onChange(notes.filter(x => x.id !== n.id))} aria-label="Delete note">×</button>
        </div>
      ))}
      <button type="button" className="cfg-add" onClick={() => onChange([...notes, { id: newNoteId(), zh: '', en: '', price: 0 }])}>
        + {addLabel}
      </button>
    </div>
  )
}

// ─── One dish: names, pick-one choices, its own notes ────────────────────────
function NameFields({ id, defEn, defZh, config, setName }) {
  const own = config.names[id] || {}
  return (
    <div className="cfg-names">
      <input className="cfg-input cfg-input--zh" value={own.nameZh || ''} placeholder={defZh} lang="zh-Hans"
        onChange={e => setName(id, { nameZh: e.target.value })} />
      <input className="cfg-input" value={own.nameEn || ''} placeholder={defEn}
        onChange={e => setName(id, { nameEn: e.target.value })} />
    </div>
  )
}

function DishEditor({ item, config, setName, setDishNotes }) {
  const builtIn = getItemNotes(item).specific.filter(n => NOTE_OPTIONS.includes(n))
  return (
    <div className="cfg-dish__editor">
      <div className="cfg-label">Name on menu & receipt <span className="cfg-muted">— leave blank to keep the original</span></div>
      <NameFields id={item.id} defEn={item.nameEn} defZh={item.nameZh} config={config} setName={setName} />

      {item.choices && (
        <>
          <div className="cfg-label">Choices</div>
          {item.choices.map(c => (
            <NameFields key={c.id} id={`${item.id}_${c.id}`} defEn={c.nameEn} defZh={c.nameZh} config={config} setName={setName} />
          ))}
        </>
      )}

      <div className="cfg-label">Special notes for this dish</div>
      {builtIn.length > 0 && (
        <div className="cfg-muted cfg-builtin">Built in: {builtIn.map(n => `${n.zh} ${n.en}`).join(' · ')}</div>
      )}
      <NoteListEditor notes={config.dishNotes[item.id] || []} onChange={list => setDishNotes(item.id, list)} addLabel="Add note for this dish" />
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function MenuConfig({ onNavigate }) {
  const config = useMenuConfig()
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab]           = useState('dishes')
  const [query, setQuery]       = useState('')
  const [openId, setOpenId]     = useState(null)
  const [msg, setMsg]           = useState(null)
  const [newPw, setNewPw]       = useState('')
  const fileRef = useRef(null)

  function flash(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  function setName(id, patch) {
    const merged = { ...config.names[id], ...patch }
    Object.keys(merged).forEach(k => { if (!merged[k]?.trim()) delete merged[k] })
    const names = { ...config.names }
    if (Object.keys(merged).length) names[id] = merged
    else delete names[id]
    saveConfig({ ...config, names })
  }

  function setDishNotes(id, list) {
    const dishNotes = { ...config.dishNotes }
    if (list.length) dishNotes[id] = list
    else delete dishNotes[id]
    saveConfig({ ...config, dishNotes })
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fortune-house-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      importAll(JSON.parse(await file.text()))
      // Settings (printer URL, PIN…) are read by the app at start-up
      window.location.reload()
    } catch (err) {
      flash('error', `Import failed: ${err.message}`)
    }
  }

  async function changePassword() {
    if (newPw.length < 4) return flash('error', 'Use at least 4 characters')
    await setPassword(newPw)
    setNewPw('')
    flash('success', 'Password changed')
  }

  function clearAll() {
    if (!window.confirm('Remove ALL renamed dishes and custom notes on this device?')) return
    saveConfig({ names: {}, dishNotes: {}, notes: [] })
    flash('success', 'Config cleared')
  }

  // Dishes, filtered by search across built-in and renamed names
  const categories = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = item => {
      if (!q) return true
      const own = config.names[item.id] || {}
      return [item.nameEn, item.nameZh, own.nameEn, own.nameZh, ...(item.choices || []).flatMap(c => [c.nameEn, c.nameZh])]
        .some(s => s && s.toLowerCase().includes(q))
    }
    return menu.map(c => ({ ...c, items: c.items.filter(hit) })).filter(c => c.items.length)
  }, [query, config])

  const changedCount = id =>
    Object.keys(config.names).filter(k => k === id || k.startsWith(`${id}_`)).length + (config.dishNotes[id]?.length || 0)

  return (
    <div className="screen">
      <HomeButton onClick={() => onNavigate('settings')} label="← Settings" />

      <div className="settings-screen cfg-screen">
        <h1>Menu Config</h1>

        {!unlocked ? <PasswordGate onUnlock={() => setUnlocked(true)} /> : (
          <>
            <div className="lang-toggle cfg-tabs">
              {[['dishes', 'Dishes 菜品'], ['notes', 'Notes 备注'], ['backup', 'Backup 备份']].map(([key, label]) => (
                <button key={key} className={`lang-btn ${tab === key ? 'lang-btn--active' : 'lang-btn--inactive'}`} onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>

            {msg && <div className={`settings-status settings-status--${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

            {tab === 'dishes' && (
              <>
                <input className="cfg-input cfg-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dishes… 搜索" />
                {categories.map(cat => (
                  <div key={cat.category} className="settings-section">
                    <h2>{cat.category} {cat.categoryZh}</h2>
                    {cat.items.map(item => {
                      const own = config.names[item.id] || {}
                      const changed = changedCount(item.id)
                      const open = openId === item.id
                      return (
                        <div key={item.id} className={`cfg-dish${open ? ' cfg-dish--open' : ''}`}>
                          <button type="button" className="cfg-dish__head" onClick={() => setOpenId(open ? null : item.id)}>
                            <span className="cfg-dish__names">
                              <span className="cfg-dish__zh">{own.nameZh || item.nameZh}</span>
                              <span className="cfg-dish__en">{own.nameEn || item.nameEn}</span>
                            </span>
                            {changed > 0 && <span className="cfg-badge">{changed} edit{changed > 1 ? 's' : ''}</span>}
                            <span className="cfg-dish__price">{formatPrice(item.price)}</span>
                            <span className={`note-group__chevron${open ? ' note-group__chevron--open' : ''}`}>▸</span>
                          </button>
                          {open && <DishEditor item={item} config={config} setName={setName} setDishNotes={setDishNotes} />}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {!categories.length && <p className="cfg-muted">No dishes match “{query}”.</p>}
              </>
            )}

            {tab === 'notes' && (
              <>
                <div className="settings-section">
                  <h2>Your note options</h2>
                  <p className="cfg-muted" style={{ marginBottom: 12 }}>Shown on every dish under “Other”. The price is added to the dish when the note is picked.</p>
                  <NoteListEditor notes={config.notes} onChange={notes => saveConfig({ ...config, notes })} addLabel="Add note option" />
                </div>
                <div className="settings-section">
                  <h2>Built-in notes</h2>
                  <div className="cfg-builtin-list">
                    {NOTE_OPTIONS.map(n => (
                      <span key={n.id} className="cfg-chip">{n.zh} <span className="cfg-muted">{n.en}</span></span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'backup' && (
              <>
                <div className="settings-section">
                  <h2>Export / import</h2>
                  <p className="cfg-muted" style={{ marginBottom: 12 }}>
                    Everything here is saved on this device only. Export a file to keep a backup or copy it to another tablet.
                    The file includes renamed dishes, notes and app settings (not this password).
                  </p>
                  <div className="cfg-row-btns">
                    <button className="settings-btn settings-btn--gold" onClick={exportFile}>⬇ Export settings</button>
                    <button className="settings-btn settings-btn--outline" onClick={() => fileRef.current?.click()}>⬆ Import settings</button>
                  </div>
                  <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
                </div>

                <div className="settings-section">
                  <h2>Change password</h2>
                  <div className="cfg-row-btns">
                    <input className="cfg-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" />
                    <button className="settings-btn settings-btn--outline" onClick={changePassword} style={{ width: 'auto', padding: '10px 20px' }}>Save</button>
                  </div>
                </div>

                <div className="settings-section">
                  <h2>Reset</h2>
                  <button className="settings-btn settings-btn--outline cfg-danger" onClick={clearAll}>Clear all renamed dishes & custom notes</button>
                </div>
              </>
            )}

            <div className="cfg-muted" style={{ textAlign: 'center', padding: '8px 0' }}>Changes save automatically</div>
          </>
        )}
      </div>
    </div>
  )
}
