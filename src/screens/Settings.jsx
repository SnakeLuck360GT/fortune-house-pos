import { useState } from 'react'
import HomeButton from '../components/HomeButton.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'

const SAMPLE_ITEMS = [
  { id: 'rc05', nameEn: 'Chicken Fried Rice',          nameZh: '鸡肉炒饭', price: 9.00,  quantity: 2, category: 'Rice',      note: '' },
  { id: 'ap15', nameEn: 'Salt & Pepper Chicken Wings', nameZh: '椒盐鸡翅', price: 7.70,  quantity: 1, category: 'Appetisers', note: 'extra crispy' },
  { id: 'nd03', nameEn: 'Chicken Chow Mein',           nameZh: '鸡肉炒面', price: 10.70, quantity: 1, category: 'Noodles',    note: '' },
]
const SAMPLE_TOTAL = SAMPLE_ITEMS.reduce((s, i) => s + i.price * i.quantity, 0)

export default function Settings({ onNavigate, settings, onSaveSettings, lang, setLang, t }) {
  const [printerUrl,  setPrinterUrl]  = useState(settings.printerUrl  || '')
  const [tableNumber, setTableNumber] = useState(settings.tableNumber || '')
  // displayLang controls menu item cards only (en | zh | both)
  const [displayLang, setDisplayLang] = useState(settings.displayLang || 'both')
  const [status,      setStatus]      = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [sending,     setSending]     = useState(false)

  function save() {
    onSaveSettings({ printerUrl, tableNumber, displayLang })
    setStatus({ msg: t.saveSettings, type: 'success' })
    setTimeout(() => setStatus(null), 2500)
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
      setStatus({ msg: t.testJobSent, type: 'success' })
    } catch (err) {
      setStatus({ msg: `Error: ${err.message}`, type: 'error' })
    } finally {
      setSending(false)
      setTimeout(() => setStatus(null), 4000)
    }
  }

  return (
    <div className="screen">
      <HomeButton onClick={() => onNavigate('menu')} label={t.home} />

      <div className="settings-screen">
        <h1>{t.settingsTitle}</h1>

        {/* App UI language */}
        <div className="settings-section">
          <h2>App Language / 界面语言</h2>
          <div className="settings-row">
            <div className="lang-toggle">
              <button
                className={`lang-btn ${lang === 'en' ? 'lang-btn--active' : 'lang-btn--inactive'}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
              <button
                className={`lang-btn ${lang === 'zh' ? 'lang-btn--active' : 'lang-btn--inactive'}`}
                onClick={() => setLang('zh')}
              >
                中文
              </button>
            </div>
          </div>
        </div>

        {/* Menu card display language — auto-saves on tap */}
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
                  onClick={() => {
                    setDisplayLang(o.val)
                    onSaveSettings({ printerUrl, tableNumber, displayLang: o.val })
                  }}
                  style={{ flex: '1 1 0' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              ✓ Saves instantly
            </div>
          </div>
        </div>

        {/* Receipt — always bilingual, just show a preview */}
        <div className="settings-section">
          <h2>Receipt</h2>
          <div className="settings-row" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Receipts always print in both Chinese and English.
          </div>
          <button
            className="settings-btn settings-btn--outline"
            onClick={() => setShowPreview(v => !v)}
            style={{ marginTop: 8 }}
          >
            {showPreview ? '▲ Hide Preview' : '👁 Preview receipt format'}
          </button>
          {showPreview && (
            <div style={{ marginTop: 12 }}>
              <ReceiptPreview
                items={SAMPLE_ITEMS}
                total={SAMPLE_TOTAL}
                tableNumber={tableNumber || 'Table 3'}
                discount={0}
                orderId="PREVIEW"
              />
            </div>
          )}
        </div>

        {/* Printer */}
        <div className="settings-section">
          <h2>{t.printerSection}</h2>
          <div className="settings-row">
            <label>{t.printerUrl}</label>
            <input
              type="url"
              value={printerUrl}
              onChange={e => setPrinterUrl(e.target.value)}
              placeholder={t.printerUrlHint}
            />
          </div>
          <button
            className="settings-btn settings-btn--gold"
            onClick={testPrint}
            disabled={sending}
            style={{ marginTop: 8 }}
          >
            {sending ? '⏳ Sending…' : t.testPrint}
          </button>
        </div>

        {/* Order */}
        <div className="settings-section">
          <h2>{t.orderSection}</h2>
          <div className="settings-row">
            <label>{t.tableNumber}</label>
            <input
              type="text"
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              placeholder={t.tableNumberHint}
            />
          </div>
        </div>

        <button className="settings-btn settings-btn--gold" onClick={save}>
          Save Settings
        </button>

        {status && (
          <div className={`settings-status settings-status--${status.type}`} style={{ marginTop: 12 }}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  )
}
