import { useState } from 'react'
import HomeButton from '../components/HomeButton.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'
import PinModal from '../components/PinModal.jsx'

const SAMPLE_ITEMS = [
  { id: 'rc05', nameEn: 'Chicken Fried Rice',          nameZh: '鸡肉炒饭', price: 9.00,  quantity: 2, category: 'Rice',      note: '' },
  { id: 'ap15', nameEn: 'Salt & Pepper Chicken Wings', nameZh: '椒盐鸡翅', price: 7.70,  quantity: 1, category: 'Appetisers', note: '' },
  { id: 'nd03', nameEn: 'Chicken Chow Mein',           nameZh: '鸡肉炒面', price: 10.70, quantity: 1, category: 'Noodles',    note: '' },
]
const SAMPLE_TOTAL = SAMPLE_ITEMS.reduce((s, i) => s + i.price * i.quantity, 0)

export default function Settings({ onNavigate, settings, onSaveSettings, lang, setLang, t }) {
  const [printerUrl,  setPrinterUrl]  = useState(settings.printerUrl  || '')
  const [tableNumber, setTableNumber] = useState(settings.tableNumber || '')
  const [displayLang, setDisplayLang] = useState(settings.displayLang || 'both')
  const [showPreview, setShowPreview] = useState(false)
  const [sending,     setSending]     = useState(false)
  const [unlocked,    setUnlocked]    = useState(false)
  const [showPin,     setShowPin]     = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const [newPin,      setNewPin]      = useState('')
  const [pinMsg,      setPinMsg]      = useState(null)

  const pin = settings?.pin || '1234'

  function updatePrinterUrl(val) {
    setPrinterUrl(val)
    onSaveSettings({ printerUrl: val, tableNumber, displayLang })
  }

  function updateTableNumber(val) {
    setTableNumber(val)
    onSaveSettings({ printerUrl, tableNumber: val, displayLang })
  }

  async function testPrint() {
    const base = printerUrl.trim() || window.location.origin
    setSending(true)
    try {
      const res = await fetch(`${base}/api/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId:     `TEST-${Date.now()}`,
          items:       SAMPLE_ITEMS,
          total:       SAMPLE_TOTAL,
          discount:    0,
          tableNumber: tableNumber || 'Test',
          timestamp:   Date.now(),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('Test print failed:', err)
    } finally {
      setSending(false)
    }
  }

  function saveNewPin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMsg({ type: 'error', text: 'PIN must be 4 digits' })
      return
    }
    onSaveSettings({ pin: newPin })
    setChangingPin(false)
    setNewPin('')
    setPinMsg({ type: 'success', text: 'PIN updated' })
    setTimeout(() => setPinMsg(null), 2500)
  }

  return (
    <div className="screen">
      <HomeButton onClick={() => onNavigate('menu')} label={t.home} />

      <div className="settings-screen">
        <h1>{t.settingsTitle}</h1>

        {/* App UI language — always accessible */}
        <div className="settings-section">
          <h2>App Language / 界面语言</h2>
          <div className="settings-row">
            <div className="lang-toggle">
              <button className={`lang-btn ${lang === 'en' ? 'lang-btn--active' : 'lang-btn--inactive'}`} onClick={() => setLang('en')}>English</button>
              <button className={`lang-btn ${lang === 'zh' ? 'lang-btn--active' : 'lang-btn--inactive'}`} onClick={() => setLang('zh')}>中文</button>
            </div>
          </div>
        </div>

        {/* Menu item display — always accessible */}
        <div className="settings-section">
          <h2>Menu Item Display</h2>
          <div className="settings-row">
            <label style={{ marginBottom: 10, display: 'block', color: 'var(--text-muted)', fontSize: 13 }}>
              Show item names on menu cards as:
            </label>
            <div className="lang-toggle" style={{ gap: 6 }}>
              {[
                { val: 'en',   label: 'English' },
                { val: 'zh',   label: '中文' },
                { val: 'both', label: 'Both / 双语' },
              ].map(o => (
                <button
                  key={o.val}
                  className={`lang-btn ${displayLang === o.val ? 'lang-btn--active' : 'lang-btn--inactive'}`}
                  onClick={() => { setDisplayLang(o.val); onSaveSettings({ printerUrl, tableNumber, displayLang: o.val }) }}
                  style={{ flex: '1 1 0' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Locked sections */}
        <div className={`settings-locked-group ${unlocked ? '' : 'settings-locked-group--locked'}`}>

          {/* Lock overlay — sits on top of greyed content when locked */}
          {!unlocked && (
            <div className="settings-lock-overlay" onClick={() => setShowPin(true)}>
              <span className="settings-lock-gate__icon">🔒</span>
              <span className="settings-lock-gate__text">Tap to unlock settings</span>
            </div>
          )}

          {/* Unlock bar — shown inline when unlocked */}
          {unlocked && (
            <div className="settings-lock-bar">
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🔓 Settings unlocked</span>
              <button className="settings-lock-bar__btn" onClick={() => setUnlocked(false)}>Lock</button>
            </div>
          )}

          {/* Receipt preview */}
          <div className="settings-section">
            <h2>Receipt</h2>
            <div className="settings-row" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Receipts always print in both Chinese and English.
            </div>
            <button
              className="settings-btn settings-btn--outline"
              onClick={() => unlocked && setShowPreview(v => !v)}
              style={{ marginTop: 8 }}
              tabIndex={unlocked ? 0 : -1}
            >
              {showPreview ? '▲ Hide Preview' : '👁 Preview receipt format'}
            </button>
            {showPreview && unlocked && (
              <div style={{ marginTop: 12 }}>
                <ReceiptPreview items={SAMPLE_ITEMS} total={SAMPLE_TOTAL} tableNumber={tableNumber || 'Table 3'} discount={0} orderId="PREVIEW" />
              </div>
            )}
          </div>

          {/* Printer */}
          <div className="settings-section">
            <h2>{t.printerSection}</h2>
            <div className="settings-row">
              <label>{t.printerUrl}</label>
              {unlocked
                ? <input type="url" value={printerUrl} onChange={e => updatePrinterUrl(e.target.value)} placeholder={t.printerUrlHint} />
                : <input type="text" value={printerUrl ? '••••••••••••••••' : ''} readOnly placeholder={t.printerUrlHint} />
              }
            </div>
            <button className="settings-btn settings-btn--gold" onClick={() => unlocked && testPrint()} disabled={sending || !unlocked} style={{ marginTop: 8 }}>
              {sending ? '⏳ Sending…' : t.testPrint}
            </button>
          </div>

          {/* Order */}
          <div className="settings-section">
            <h2>{t.orderSection}</h2>
            <div className="settings-row">
              <label>{t.tableNumber}</label>
              <input type="text" value={tableNumber} onChange={e => unlocked && updateTableNumber(e.target.value)} placeholder={t.tableNumberHint} readOnly={!unlocked} />
            </div>
          </div>

          {/* PIN */}
          <div className="settings-section">
            <h2>Security PIN</h2>
            {!changingPin ? (
              <button className="settings-btn settings-btn--outline" onClick={() => unlocked && setChangingPin(true)} tabIndex={unlocked ? 0 : -1}>
                🔑 Change PIN
              </button>
            ) : (
              <div className="settings-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="New 4-digit PIN" style={{ flex: 1 }} />
                <button className="settings-btn settings-btn--gold" onClick={saveNewPin} style={{ whiteSpace: 'nowrap' }}>Save</button>
                <button className="settings-btn settings-btn--outline" onClick={() => { setChangingPin(false); setNewPin('') }}>Cancel</button>
              </div>
            )}
            {pinMsg && (
              <div className={`settings-status settings-status--${pinMsg.type}`} style={{ marginTop: 8 }}>{pinMsg.text}</div>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
            All settings save automatically
          </div>
        </div>
      </div>

      {showPin && (
        <PinModal
          prompt="Enter PIN to unlock settings"
          correctPin={pin}
          onSuccess={() => { setShowPin(false); setUnlocked(true) }}
          onCancel={() => setShowPin(false)}
        />
      )}
    </div>
  )
}
