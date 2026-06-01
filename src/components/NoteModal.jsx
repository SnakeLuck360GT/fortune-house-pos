import { useState } from 'react'
import { useLanguage } from '../hooks/useLanguage.js'
import { NOTE_OPTIONS, getItemNotes } from '../data/noteOptions.js'

function parseSelected(note) {
  if (!note) return []
  const parts = note.split(/[,，]\s*/).map(s => s.trim()).filter(Boolean)
  return NOTE_OPTIONS.filter(opt => parts.includes(opt.zh)).map(opt => opt.id)
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

export default function NoteModal({ item, currentNote, onConfirm, onCancel }) {
  const { lang, t } = useLanguage()
  const [selected, setSelected] = useState(() => parseSelected(currentNote))
  const isZh = lang === 'zh'

  const { specific, universal } = getItemNotes(item)

  function toggle(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function handleConfirm() {
    const note = NOTE_OPTIONS
      .filter(opt => selected.includes(opt.id))
      .map(opt => opt.zh)
      .join(', ')
    onConfirm(note)
  }

  const count = selected.length

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
