import { useState, useEffect, useRef } from 'react'
import HomeButton from '../components/HomeButton.jsx'
import { fetchPostcodeInfo, fetchDriveMinutes, looksLikePostcode, formatPostcode } from '../utils/geocoder.js'
import { getDeliveryZone } from '../utils/deliveryZones.js'
import { isValidUkPhone } from '../utils/phone.js'

export default function DeliveryDetails({ onNavigate, onConfirm, t }) {
  const [name,         setName]         = useState('')
  const [phone,        setPhone]        = useState('')
  const [postcode,     setPostcode]     = useState('')
  const [postcodeInfo, setPostcodeInfo] = useState(null)
  const [houseNumber,  setHouseNumber]  = useState('')
  const [zone,         setZone]         = useState(null)
  const [driveMin,     setDriveMin]     = useState(null)
  const [loadingDrive, setLoadingDrive] = useState(false)
  const [pcError,      setPcError]      = useState('')
  const [confirmText,  setConfirmText]  = useState('')

  const debounce  = useRef(null)
  const currentPc = useRef('')

  useEffect(() => {
    clearTimeout(debounce.current)
    setPcError('')
    if (!looksLikePostcode(postcode)) { setPostcodeInfo(null); return }
    debounce.current = setTimeout(() => doLookup(postcode), 400)
    return () => clearTimeout(debounce.current)
  }, [postcode])

  async function doLookup(raw) {
    const pc = formatPostcode(raw)
    currentPc.current = pc
    setPostcodeInfo(null)
    setHouseNumber('')
    setZone(null)
    setDriveMin(null)
    setConfirmText('')

    try {
      const info = await fetchPostcodeInfo(pc)
      if (currentPc.current !== pc) return
      setPostcodeInfo(info)
      setZone(getDeliveryZone(pc))
      fetchDriveMinutes(info.lat, info.lon).then(m => {
        if (currentPc.current === pc) setDriveMin(m)
      })
    } catch (e) {
      setPcError(e.message || 'Invalid postcode')
    }
  }

  // Refine drive time when house number is typed
  useEffect(() => {
    if (!houseNumber.trim() || !postcodeInfo) return
    setLoadingDrive(true)
    fetchDriveMinutes(postcodeInfo.lat, postcodeInfo.lon)
      .then(m => setDriveMin(m))
      .finally(() => setLoadingDrive(false))
  }, [houseNumber])

  const road = postcodeInfo?.road || ''
  const pc   = postcodeInfo?.postcode || formatPostcode(postcode)
  const fullAddress = houseNumber.trim()
    ? `${houseNumber.trim()}${road ? ' ' + road : ''}, ${pc}`
    : road ? `${road}, ${pc}` : pc

  const needsConfirm = !!zone?.outOfArea
  const outAreaConfirmed = !needsConfirm || confirmText.trim().toLowerCase() === 'confirm'
  const phoneOk = !phone.trim() || isValidUkPhone(phone)   // optional, but valid if entered
  const canStart = !!postcode.trim() && outAreaConfirmed && phoneOk   // name is optional

  function handleConfirm() {
    if (!canStart) return
    onConfirm({
      customerName: name.trim(),
      phone:        phone.trim(),
      address:      fullAddress,
      postcode:     pc,
      deliveryFee:  zone?.fee ?? 4.00,
      driveMinutes: driveMin,
    })
  }

  return (
    <div className="screen">
      <HomeButton onClick={() => onNavigate('menu')} label={t.home} />

      <div className="delivery-screen">
        <div className="delivery-header">
          <span className="delivery-header__icon">🛵</span>
          <div>
            <h1>Delivery / 外送</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enter customer details</div>
          </div>
        </div>

        <div className="delivery-field">
          <label>Customer Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. John Smith"
            autoFocus
          />
        </div>

        <div className="delivery-field">
          <label>Phone <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 07700 900123"
          />
          {phone.trim() && (
            phoneOk
              ? <div style={{ fontSize: 13, color: '#4ade80', marginTop: 4 }}>✓ Looks valid</div>
              : <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>✗ Check the number — doesn't look like a UK phone</div>
          )}
        </div>

        <div className="delivery-field">
          <label>Postcode</label>
          <input
            type="text"
            value={postcode}
            onChange={e => { setPostcode(e.target.value.toUpperCase()); setPostcodeInfo(null) }}
            placeholder="e.g. M33 4AB"
            style={{ textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, fontSize: 18 }}
            maxLength={8}
          />
          {pcError && <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>{pcError}</div>}
        </div>

        {postcodeInfo && (
          <>
            <div className="delivery-road-badge">
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Street</span>
              <span className="delivery-road-name">{road || '—'}</span>
            </div>

            <div className="delivery-field">
              <label>House Number / Name</label>
              <input
                type="text"
                value={houseNumber}
                onChange={e => setHouseNumber(e.target.value)}
                placeholder="e.g.  42  ·  Flat 3  ·  Rose Cottage"
              />
            </div>

            <div className="delivery-addr-preview">
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Full address</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{fullAddress}</span>
            </div>

            {zone && (
              <div className="delivery-info-card">
                <div className="delivery-info-row">
                  <span>📍 {zone.label}</span>
                  <span className="delivery-info-fee">£{zone.fee.toFixed(2)} delivery</span>
                </div>
                {zone.outOfArea && (
                  <div className="delivery-info-row" style={{ color: 'var(--accent-gold)', fontSize: 13, fontWeight: 600 }}>
                    <span>⚠ Outside usual delivery area — please confirm</span>
                  </div>
                )}
                <div className="delivery-info-row">
                  <span>🚗 Drive from Sale</span>
                  <span style={{ fontWeight: 700 }}>
                    {loadingDrive ? '…' : driveMin ? `~${driveMin} min` : '—'}
                  </span>
                </div>
              </div>
            )}

            {needsConfirm && (
              <div className="delivery-field">
                <label style={{ color: 'var(--accent-gold)' }}>
                  ⚠ Outside usual area — type <strong>confirm</strong> to allow this delivery
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="confirm"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  style={outAreaConfirmed
                    ? { borderColor: 'var(--accent-green)' }
                    : { borderColor: 'var(--accent-gold)' }}
                />
              </div>
            )}
          </>
        )}

        <button
          className="delivery-confirm-btn"
          onClick={handleConfirm}
          disabled={!canStart}
        >
          Start Order →
        </button>
      </div>
    </div>
  )
}
