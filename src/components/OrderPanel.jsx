import { useState } from 'react'
import { formatPrice } from '../utils/receiptFormatter.js'
import ReceiptPreview from './ReceiptPreview.jsx'
import NoteModal from './NoteModal.jsx'

// ─── Confirm + Preview modals ─────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, yesLabel, noLabel }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Confirm</h2><p>{message}</p>
        <div className="modal-btns">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>{noLabel}</button>
          <button className="modal-btn modal-btn--confirm" onClick={onConfirm}>{yesLabel}</button>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ items, total, tableNumber, discount, deliveryFee, orderMode, deliveryInfo, phone, customerName, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:420, width:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h2 style={{ margin:0 }}>Receipt Preview</h2>
          <button onClick={onClose} style={{ fontSize:22, color:'var(--text-muted)', padding:'2px 8px' }}>×</button>
        </div>
        <div style={{ overflow:'auto', flex:1 }}>
          <ReceiptPreview items={items} total={total} tableNumber={tableNumber} discount={discount} deliveryFee={deliveryFee} orderMode={orderMode} deliveryInfo={deliveryInfo} phone={phone} customerName={customerName} />
        </div>
        <button className="modal-btn modal-btn--cancel" style={{ marginTop:16 }} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

// ─── Single order item row ────────────────────────────────────────────────────
function OrderItem({ item, onIncrement, onDecrement, onRemove, onSetNote, onSplit, t }) {
  const [showNoteModal, setShowNoteModal] = useState(false)

  return (
    <div className="order-item">
      <div className="order-item__top">
        <div className="order-item__names">
          <div className="order-item__zh">{item.nameZh || item.nameEn}</div>
          <div className="order-item__en">{item.nameEn}</div>
        </div>
        <button className="order-item__remove" onClick={() => onRemove(item.id)}>×</button>
      </div>

      <div className="order-item__bottom">
        <div className="qty-controls">
          <button className="qty-btn" onClick={() => onDecrement(item.id)}>−</button>
          <span className="qty-display">{item.quantity}</span>
          <button className="qty-btn" onClick={() => onIncrement(item.id)}>+</button>
        </div>
        {item.quantity > 1 && (
          <button className="order-item__split-btn" onClick={() => onSplit(item.id)}>
            split
          </button>
        )}
        <span className="order-item__line-total">{formatPrice((item.price + (item.notePrice || 0)) * item.quantity)}</span>
      </div>

      {Array.isArray(item.details) && item.details.length > 0 && (
        <div className="order-item__details">
          {item.details.map((d, i) => (
            <div key={i} className={d.big ? 'order-item__detail--zh' : `order-item__detail--en${item.details.length > 2 ? ' order-item__detail--block' : ''}`}>{d.text}</div>
          ))}
        </div>
      )}

      <div className="order-item__note-row">
        {item.note ? (
          <div className="order-item__note-display" onClick={() => setShowNoteModal(true)}>
            {item.note}{item.notePrice > 0 ? ` · +${formatPrice(item.notePrice)}` : ''}
          </div>
        ) : (
          <button className="order-item__note-btn" onClick={() => setShowNoteModal(true)}>
            {t.addNote}
          </button>
        )}
      </div>

      {showNoteModal && (
        <NoteModal
          item={item}
          currentNote={item.note}
          currentNotePrice={item.notePrice}
          onConfirm={(note, notePrice) => { onSetNote(item.id, note, notePrice); setShowNoteModal(false) }}
          onCancel={() => setShowNoteModal(false)}
        />
      )}
    </div>
  )
}

// ─── Main OrderPanel ──────────────────────────────────────────────────────────
export default function OrderPanel({
  orderMode, deliveryInfo,
  items, subtotal, total, discount, deliveryFee,
  onIncrement, onDecrement, onRemove, onSetNote, onSplit, onSetDiscount, onSetDeliveryFee, onClear, onPrint,
  printing, t, mobileActive, tableNumber,
  phone = '', customerName = '',
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isDelivery = orderMode === 'delivery'

  return (
    <div className={`right-panel${mobileActive ? ' right-panel--active' : ''}`}>
      {/* Order type banner */}
      <div className={`order-type-banner order-type-banner--${orderMode || 'takeaway'}`}>
        {isDelivery ? (
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>🛵 Delivery / 外送</div>
            {deliveryInfo?.customerName && (
              <div style={{ fontSize:13, opacity:0.85 }}>{deliveryInfo.customerName}</div>
            )}
            {deliveryInfo?.address && (
              <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>{deliveryInfo.address}</div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>🛍 Takeaway / 外带</div>
            {customerName && <div style={{ fontSize:13, opacity:0.85 }}>{customerName}</div>}
            {phone && <div style={{ fontSize:12, opacity:0.7, marginTop:2 }}>📞 {phone}</div>}
          </div>
        )}
        {isDelivery && deliveryInfo?.driveMinutes && (
          <div style={{ fontSize:13, fontWeight:700, opacity:0.9 }}>~{deliveryInfo.driveMinutes} min</div>
        )}
      </div>

      <div className="right-panel__header">
        <span className="right-panel__title">{t.currentOrder}</span>
        {items.length > 0 && (
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>
            {items.reduce((s,i) => s+i.quantity, 0)} items
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="order-empty">
          <span className="order-empty__icon">🍽</span>
          <span className="order-empty__text">{t.emptyOrder}</span>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>{t.emptyOrderSub}</span>
        </div>
      ) : (
        <div className="order-list">
          {items.map(item => (
            <OrderItem
              key={item.id}
              item={item}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
              onSetNote={onSetNote}
              onSplit={onSplit}
              t={t}
            />
          ))}
        </div>
      )}

      <div className="till-footer">
        {items.length > 0 && (
          <div className="till-extras">
            {orderMode === 'delivery' && (
              <div className="till-extra-row">
                <label htmlFor="delivery-input">🛵 Delivery fee</label>
                <input
                  id="delivery-input"
                  type="number"
                  min="0"
                  step="0.50"
                  value={deliveryFee || ''}
                  onChange={e => onSetDeliveryFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="till-extra-row">
              <label htmlFor="discount-input">{t.discount}</label>
              <input
                id="discount-input"
                type="number"
                min="0"
                step="0.50"
                value={discount || ''}
                onChange={e => onSetDiscount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        )}

        <div className="till-total-row">
          <span className="till-total-label">{t.total}</span>
          <span className="till-total-amount">{formatPrice(total)}</span>
        </div>

        <div className="till-btns">
          <button
            className="till-btn till-btn--print"
            onClick={onPrint}
            disabled={items.length === 0 || printing}
          >
            {printing ? <span className="spinner" /> : t.printReceipt}
          </button>
          <button
            className="till-btn"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border-visible)', color: items.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}
            onClick={() => items.length > 0 && setShowPreview(true)}
            disabled={items.length === 0}
          >
            👁 Preview Receipt
          </button>
          <button
            className="till-btn till-btn--clear"
            onClick={() => items.length > 0 && setShowConfirm(true)}
            disabled={items.length === 0}
          >
            {t.clearOrder}
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          message={t.confirmClear}
          yesLabel={t.yes}
          noLabel={t.no}
          onConfirm={() => { onClear(); setShowConfirm(false) }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showPreview && (
        <PreviewModal
          items={items} total={total} tableNumber={tableNumber}
          discount={discount} deliveryFee={deliveryFee}
          orderMode={orderMode} deliveryInfo={deliveryInfo} phone={phone} customerName={customerName}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
