import { buildReceiptLines } from '../utils/receiptFormatter.js'

export default function ReceiptPreview({ items, total, tableNumber, discount, deliveryFee, orderMode, deliveryInfo, phone, customerName, orderId }) {
  const lines = buildReceiptLines({ items, total, tableNumber, discount, deliveryFee, orderMode, deliveryInfo, phone, customerName, timestamp: Date.now() })

  return (
    <div className="receipt-preview">
      {lines.map((line, i) => {
        switch (line.type) {
          case 'sep-heavy':
            return <div key={i} className="rp-sep rp-sep--heavy" />
          case 'sep-light':
            return <div key={i} className="rp-sep rp-sep--light" />
          case 'blank':
            return <div key={i} className="rp-blank" />
          case 'center':
            return <div key={i} className="rp-center">{line.text}</div>
          case 'eta':
            return <div key={i} className="rp-eta">{line.text}</div>
          case 'order-type':
            return (
              <div key={i} className={`rp-order-type rp-order-type--${line.isDelivery ? 'delivery' : 'takeaway'}`}>
                {line.text}
              </div>
            )
          case 'zh':
            return (
              <div key={i} className="rp-zh">
                <span className="rp-zh__name">
                  {line.text}
                  <span className="rp-zh__qty"> ×{line.quantity}</span>
                </span>
                <span className="rp-zh__price">{line.price}</span>
              </div>
            )
          case 'en':
            return <div key={i} className="rp-en">{line.text}</div>
          case 'detail': {
            const cls = [
              line.big ? 'rp-detail-zh' : 'rp-detail-en',
              !line.big && line.block ? 'rp-detail-block' : '',
              line.header ? 'rp-detail-header' : '',
            ].filter(Boolean).join(' ')
            return <div key={i} className={cls}>{line.text}</div>
          }
          case 'note-zh':
            return <div key={i} className="rp-note-zh">{line.text}</div>
          case 'note-en':
            return <div key={i} className="rp-note-en">{line.text}</div>
          case 'subtotal':
            return (
              <div key={i} className="rp-subtotal">
                <span>{line.label}:</span><span>{line.price}</span>
              </div>
            )
          case 'total':
            return (
              <div key={i} className="rp-total">
                <span>TOTAL:</span>
                <span className="rp-total__amount">{line.price}</span>
              </div>
            )
          case 'footer':
            return <div key={i} className="rp-footer">{line.text}</div>
          default:
            return null
        }
      })}
    </div>
  )
}
