import { useState, useRef } from 'react'
import { useLanguage } from '../hooks/useLanguage.js'
import { NOTE_OPTIONS, getItemNotes } from '../data/noteOptions.js'

const PRESET_ZH = new Set(NOTE_OPTIONS.map(o => o.zh))

function noteParts(note) {
  if (!note) return []
  return note.split(/[,，]\s*/).map(s => s.trim()).filter(Boolean)
}
function parseSelected(note) {
  const parts = noteParts(note)
  return NOTE_OPTIONS.filter(opt => parts.includes(opt.zh)).map(opt => opt.id)
}
// Anything in the note that isn't a known preset is the free-text custom note.
function parseCustom(note) {
  return noteParts(note).filter(p => !PRESET_ZH.has(p)).join(', ')
}

function NoteButton({ opt, isSelected, isZh, onToggle }) {
  return (
    <button
      className={`sharebox-drink${isSelected ? ' sharebox-drink--selected' : ''}`}
      onClick={() => onToggle(opt.id)}
    >
      {isZh ? (
        <>
          <span className="sharebox-drink__zh">{opt.zh}</span>
          <span className="sharebox-drink__en">{opt.en}</span>
        </>
      ) : (
        <>
          <span className="sharebox-drink__zh" style={{ fontSize: 15 }}>{opt.en}</span>
          <span className="sharebox-drink__en">{opt.zh}</span>
        </>
      )}
    </button>
  )
}

export default function NoteModal({ item, currentNote, currentNotePrice, onConfirm, onCancel }) {
  const { lang, t } = useLanguage()
  const [selected, setSelected]     = useState(() => parseSelected(currentNote))
  const [customText, setCustomText] = useState(() => parseCustom(currentNote))
  const [customPrice, setCustomPrice] = useState(() => (currentNotePrice ? String(currentNotePrice) : ''))
  const [kbLang, setKbLang]         = useState('en')
  const inputRef = useRef(null)
  const isZh = lang === 'zh'

  const { specific, universal } = getItemNotes(item)

  function toggle(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function switchKb(l) {
    setKbLang(l)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleConfirm() {
    const presetNote = NOTE_OPTIONS
      .filter(opt => selected.includes(opt.id))
      .map(opt => opt.zh)
      .join(', ')
    const custom = customText.trim()
    const note = [presetNote, custom].filter(Boolean).join(', ')
    const notePrice = Math.max(0, parseFloat(customPrice) || 0)
    onConfirm(note, notePrice)
  }

  const count = selected.length + (customText.trim() ? 1 : 0)

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal note-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>
          {isZh ? '备注 Special Notes' : 'Special Notes 备注'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          {isZh
            ? `已选 ${count} 项`
            : `${count} modifier${count !== 1 ? 's' : ''} selected`}
        </p>

        {specific.length > 0 && (
          <>
            <div className="note-modal__section-label">
              {isZh ? '此菜品' : 'This dish'}
            </div>
            <div className="sharebox-drinks" style={{ marginBottom: 12 }}>
              {specific.map(opt => (
                <NoteButton
                  key={opt.id}
                  opt={opt}
                  isSelected={selected.includes(opt.id)}
                  isZh={isZh}
                  onToggle={toggle}
                />
              ))}
            </div>
          </>
        )}

        <div className="note-modal__section-label">
          {isZh ? '通用' : 'General'}
        </div>
        <div className="sharebox-drinks">
          {universal.map(opt => (
            <NoteButton
              key={opt.id}
              opt={opt}
              isSelected={selected.includes(opt.id)}
              isZh={isZh}
              onToggle={toggle}
            />
          ))}
        </div>

        {/* Custom free-text note with optional price */}
        <div className="note-modal__section-label" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{isZh ? '自定义备注' : 'Custom note'}</span>
          <span className="note-kb">
            <button type="button" className={`note-kb__btn${kbLang === 'en' ? ' note-kb__btn--active' : ''}`} onClick={() => switchKb('en')}>EN</button>
            <button type="button" className={`note-kb__btn${kbLang === 'zh' ? ' note-kb__btn--active' : ''}`} onClick={() => switchKb('zh')}>中文</button>
          </span>
        </div>
        <div className="note-custom">
          <input
            ref={inputRef}
            className="note-custom__text"
            type="text"
            lang={kbLang === 'zh' ? 'zh-Hans' : 'en'}
            inputMode="text"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder={kbLang === 'zh' ? '输入备注…（中文键盘）' : 'Type a note… (English)'}
          />
          <div className="note-custom__price">
            <span className="note-custom__price-sign">£</span>
            <input
              type="number"
              min="0"
              step="0.50"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              placeholder="0.00"
              aria-label="Custom note price"
            />
          </div>
        </div>

        <div className="modal-btns" style={{ marginTop: 20 }}>
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>
            {t.no}
          </button>
          <button
            className="modal-btn modal-btn--confirm"
            style={{ background: 'var(--accent-green)' }}
            onClick={handleConfirm}
          >
            {isZh ? '确认备注' : 'Confirm Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}
