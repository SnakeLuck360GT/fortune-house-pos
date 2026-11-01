import { formatPrice } from '../utils/receiptFormatter.js'
import { useFitText } from '../hooks/useFitText.js'

// displayLang: 'en' | 'zh' | 'both'
// bigLang: with 'both', which name is large and on top — 'zh' | 'en'
export default function MenuItemCard({ item, qtyInOrder, onAdd, displayLang = 'both', bigLang = 'zh' }) {
  const showZh = (displayLang === 'zh' || displayLang === 'both') && item.nameZh
  const showEn = displayLang === 'en' || displayLang === 'both'
  const enBig  = showZh && showEn && bigLang === 'en'
  const nameRef = useFitText([item.nameZh, item.nameEn, displayLang, bigLang])

  return (
    <div
      className={`menu-card${qtyInOrder > 0 ? ' menu-card--in-order' : ''}`}
      onClick={() => onAdd(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onAdd(item)}
      aria-label={`Add ${item.nameEn} to order`}
    >
      <div className="menu-card__names" ref={nameRef}>
        {enBig ? (
          <>
            <div className="menu-card__en menu-card__en--big">{item.nameEn}</div>
            <div className="menu-card__zh menu-card__zh--small">{item.nameZh}</div>
          </>
        ) : (
          <>
            {showZh && <div className="menu-card__zh">{item.nameZh}</div>}
            {showEn && (
              <div className={showZh ? 'menu-card__en' : 'menu-card__en menu-card__en--solo'}>
                {item.nameEn}
              </div>
            )}
          </>
        )}
      </div>
      <div className="menu-card__footer">
        <span className="menu-card__price">{formatPrice(item.price)}</span>
        {qtyInOrder > 0 && (
          <span className="menu-card__qty-badge">{qtyInOrder}</span>
        )}
      </div>
    </div>
  )
}
