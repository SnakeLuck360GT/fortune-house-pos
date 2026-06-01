import { useRef, useState, useEffect } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchBar({ query, onChange, onSelect, suggestions, placeholder }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    setOpen(suggestions.length > 0 && query.trim().length > 0)
  }, [suggestions, query])

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [])

  function handleSelect(item) {
    onSelect(item)
    onChange('')
    setOpen(false)
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-input-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={e => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={e => e.key === 'Escape' && (onChange(''), setOpen(false))}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => { onChange(''); setOpen(false) }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="search-dropdown" role="listbox">
          {suggestions.map(item => (
            <div
              key={item.id}
              className="search-result"
              role="option"
              onMouseDown={() => handleSelect(item)}
              onTouchEnd={() => handleSelect(item)}
            >
              <div className="search-result__names">
                <div className="search-result__zh">
                  {item.nameZh ? highlight(item.nameZh, query) : ''}
                </div>
                <div className="search-result__en">
                  {highlight(item.nameEn, query)}
                </div>
              </div>
              <div className="search-result__cat">{item.category}</div>
              <div className="search-result__price">{formatPrice(item.price)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
