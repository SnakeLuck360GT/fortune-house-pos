import { useState, useEffect } from 'react'

const KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']

export default function PinModal({ prompt = 'Enter PIN', correctPin, onSuccess, onCancel }) {
  const [input,  setInput]  = useState('')
  const [shake,  setShake]  = useState(false)
  const [status, setStatus] = useState('idle') // idle | wrong | ok

  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      else if (e.key === 'Backspace') handleKey('⌫')
      else if (e.key === 'Enter') handleKey('✓')
      else if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [input])

  function handleKey(key) {
    if (status === 'ok') return
    if (key === '⌫') {
      setInput(v => v.slice(0, -1))
    } else if (key === '✓') {
      submit()
    } else if (input.length < 4) {
      const next = input + key
      setInput(next)
      if (next.length === 4) setTimeout(() => submit(next), 80)
    }
  }

  function submit(pin = input) {
    if (pin === String(correctPin)) {
      setStatus('ok')
      setTimeout(onSuccess, 300)
    } else {
      setStatus('wrong')
      setShake(true)
      setTimeout(() => { setInput(''); setShake(false); setStatus('idle') }, 600)
    }
  }

  const dots = Array.from({ length: 4 }, (_, i) => (
    <div
      key={i}
      className={`pin-dot ${i < input.length ? 'pin-dot--filled' : ''} ${status === 'ok' ? 'pin-dot--ok' : ''} ${status === 'wrong' ? 'pin-dot--wrong' : ''}`}
    />
  ))

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal pin-modal" onClick={e => e.stopPropagation()}>
        <div className="pin-prompt">{prompt}</div>

        <div className={`pin-dots ${shake ? 'pin-dots--shake' : ''}`}>
          {dots}
        </div>

        <div className="pin-pad">
          {KEYS.map(k => (
            <button
              key={k}
              className={`pin-key ${k === '✓' ? 'pin-key--confirm' : ''} ${k === '⌫' ? 'pin-key--back' : ''}`}
              onClick={() => handleKey(k)}
            >
              {k}
            </button>
          ))}
        </div>

        <button className="pin-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
