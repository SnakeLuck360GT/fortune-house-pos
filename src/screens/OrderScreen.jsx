import { useState, useCallback, useEffect } from 'react'
import HomeButton   from '../components/HomeButton.jsx'
import SearchBar    from '../components/SearchBar.jsx'
import MenuItemCard from '../components/MenuItemCard.jsx'
import OrderPanel   from '../components/OrderPanel.jsx'
import ShareBoxModal from '../components/ShareBoxModal.jsx'
import DrinkPickerModal from '../components/DrinkPickerModal.jsx'
import SpecialOfferModal from '../components/SpecialOfferModal.jsx'
import BanquetModal from '../components/BanquetModal.jsx'
import HouseDishModal from '../components/HouseDishModal.jsx'
import PlatterModal from '../components/PlatterModal.jsx'
import DuckPortionModal from '../components/DuckPortionModal.jsx'
import { useMenu }  from '../hooks/useMenu.js'
import { useOrder } from '../hooks/useOrder.js'

function Toast({ message, type }) {
  return <div className={`toast toast--${type}`}>{message}</div>
}

export default function OrderScreen({ onNavigate, onGoMenu, t, lang, settings, orderMode, deliveryInfo, takeawayInfo }) {
  const menu  = useMenu()
  const order = useOrder()

  const [activeTab,    setActiveTab]    = useState('browse')
  const [printing,     setPrinting]     = useState(false)
  const [toast,        setToast]        = useState(null)
  const [shareBoxItem, setShareBoxItem] = useState(null)
  const [drinkItem,    setDrinkItem]    = useState(null)
  const [platterItem, setPlatterItem]   = useState(null)
  const [duckItem,    setDuckItem]      = useState(null)
  const [offerOpen,    setOfferOpen]    = useState(false)
  const [banquetItem,  setBanquetItem]  = useState(null)
  const [houseDish,    setHouseDish]    = useState(null)
  // Saved selections for the editable set-menu triggers (so re-pressing edits)
  const [offerState,    setOfferState]    = useState(null)
  const [banquetStates, setBanquetStates] = useState({})
  const [platterStates, setPlatterStates] = useState({})

  const displayLang = settings?.displayLang || 'both'
  const tableNumber = settings?.tableNumber || ''

  // Pre-fill delivery fee from deliveryInfo when delivery mode
  useEffect(() => {
    if (orderMode === 'delivery' && deliveryInfo?.deliveryFee) {
      order.setDeliveryFee(deliveryInfo.deliveryFee)
    }
  }, [])   // run once on mount

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAddItem = useCallback((item) => {
    if (item.isOffer)     { setOfferOpen(true);    return }
    if (item.isBanquet)   { setBanquetItem(item);  return }
    if (item.isHouseDish) { setHouseDish(item);    return }
    if (item.isPlatter)   { setPlatterItem(item);  return }
    if (item.isDuck)      { setDuckItem(item);     return }
    if (item.isShareBox)  { setShareBoxItem(item); return }
    if (item.isDrink)     { setDrinkItem(item);    return }
    order.addItem(item)
  }, [order])

  const handleSearchSelect = useCallback((item) => {
    if (item.isOffer)     { setOfferOpen(true);    menu.clearSearch(); return }
    if (item.isBanquet)   { setBanquetItem(item);  menu.clearSearch(); return }
    if (item.isHouseDish) { setHouseDish(item);    menu.clearSearch(); return }
    if (item.isPlatter)   { setPlatterItem(item);  menu.clearSearch(); return }
    if (item.isDuck)      { setDuckItem(item);     menu.clearSearch(); return }
    if (item.isShareBox)  { setShareBoxItem(item); return }
    if (item.isDrink)     { setDrinkItem(item);    return }
    order.addItem(item)
    menu.clearSearch()
  }, [order, menu])

  // People shown as the red badge for an editable set-menu trigger
  const groupPeople = (g) => order.items.find(i => i.group === g)?.people || 0
  const badgeFor = (item) =>
    item.isOffer   ? groupPeople('so01')   :
    item.isBanquet ? groupPeople(item.id)  :
    item.isPlatter ? groupPeople(item.id)  :
    order.getQuantityInOrder(item.id)

  function resetInstances() {
    setOfferState(null)
    setBanquetStates({})
    setPlatterStates({})
  }

  function handleClearOrder() {
    order.clearOrder()
    resetInstances()
  }

  function handlePlatterConfirm(line, meta) {
    const g = platterItem.id
    order.removeGroup(g)
    order.addItem({ ...line, group: g, people: meta.people })
    setPlatterStates(s => ({ ...s, [g]: meta }))
    setPlatterItem(null)
    setActiveTab('order')
    showToast('Platter saved', 'success')
  }

  function handleDuckConfirm(line) {
    order.addItem(line)
    setDuckItem(null)
    setActiveTab('order')
    showToast('Crispy duck added', 'success')
  }

  function handleOfferConfirm(offerItems, meta) {
    order.removeGroup('so01')
    offerItems.forEach(it => order.addItem({ ...it, group: 'so01', people: meta.people }))
    setOfferState(meta)
    setOfferOpen(false)
    setActiveTab('order')
    showToast('Special offer saved', 'success')
  }

  function handleBanquetConfirm(line, meta) {
    const g = banquetItem.id
    order.removeGroup(g)
    order.addItem({ ...line, group: g, people: meta.people })
    setBanquetStates(s => ({ ...s, [g]: meta }))
    setBanquetItem(null)
    setActiveTab('order')
    showToast('Banquet saved', 'success')
  }

  function handleHouseDishConfirm(dishItem) {
    if (dishItem) order.addItem(dishItem)
    setHouseDish(null)
    showToast('Dish added', 'success')
  }

  function handleShareBoxConfirm(drinkNote) {
    order.addItem({ ...shareBoxItem, note: drinkNote })
    setShareBoxItem(null)
  }

  function handleDrinkConfirm(drinkName) {
    order.addItem({ ...drinkItem, note: drinkName })
    setDrinkItem(null)
  }

  const customer       = orderMode === 'delivery' ? deliveryInfo : takeawayInfo
  const effectivePhone = customer?.phone || ''
  const customerName   = customer?.customerName || ''

  async function handlePrint() {
    if (order.items.length === 0) return
    const apiBase = settings?.printerUrl?.trim() || ''
    const job = {
      orderId:     `ORD-${Date.now()}`,
      orderMode:   orderMode || 'takeaway',
      deliveryInfo: orderMode === 'delivery' ? deliveryInfo : null,
      customerName: customerName.trim(),
      phone:       effectivePhone.trim(),
      items:       order.items,
      total:       order.total,
      discount:    order.discount,
      deliveryFee: order.deliveryFee,
      tableNumber,
      timestamp:   Date.now(),
    }
    setPrinting(true)
    try {
      const res = await fetch(`${apiBase}/api/print`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast(t.jobSent, 'success')
      order.clearOrder()
      resetInstances()
    } catch (err) {
      console.error('Print failed:', err)
      showToast(t.jobFailed, 'error')
    } finally {
      setPrinting(false)
    }
  }

  // Category label respects app language
  const catLabel = (cat) => lang === 'en' ? cat.category : cat.categoryZh
  const allLabel = lang === 'en' ? 'All Items' : '全部菜品'

  const activeCatTitle = menu.activeCategoryTitle
  const centreTitle = menu.searchQuery.trim()
    ? `"${menu.searchQuery}"`
    : activeCatTitle
      ? (lang === 'en' ? activeCatTitle.en : activeCatTitle.zh)
      : allLabel

  const isBrowse = activeTab === 'browse'
  const isOrder  = activeTab === 'order'

  // Order type banner colour
  const orderBannerStyle = orderMode === 'delivery'
    ? { background: 'rgba(245,158,11,0.15)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }
    : { background: 'rgba(22,163,74,0.1)',   borderColor: 'var(--accent-green)', color: '#4ade80' }

  return (
    <div className="screen order-screen">
      <HomeButton onClick={onGoMenu} label={t.home} />

      {/* Mobile tabs */}
      <div className="mobile-tabs">
        <button className={`mobile-tab${isBrowse ? ' mobile-tab--active' : ''}`} onClick={() => setActiveTab('browse')}>
          {t.browseTab}
        </button>
        <button className={`mobile-tab${isOrder ? ' mobile-tab--active' : ''}`} onClick={() => setActiveTab('order')}>
          {t.orderTab}
          {order.itemCount > 0 && (
            <span style={{ marginLeft:6, background:'var(--accent-red)', color:'white', borderRadius:'50%', width:20, height:20, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
              {order.itemCount}
            </span>
          )}
        </button>
      </div>

      {/* LEFT PANEL — categories (language-aware) */}
      <div className="panel left-panel">
        <div className="left-panel__search">
          <SearchBar
            query={menu.searchQuery}
            onChange={menu.setSearchQuery}
            onSelect={handleSearchSelect}
            suggestions={menu.suggestions}
            placeholder={t.searchPlaceholder}
          />
        </div>
        <div className="left-panel__categories">
          <button
            className={`category-btn${!menu.selectedCategory && !menu.searchQuery ? ' category-btn--active' : ''}`}
            onClick={() => menu.selectCategory(null)}
          >
            {allLabel}
          </button>
          {menu.categories.map(cat => (
            <button
              key={cat.category}
              className={`category-btn${menu.selectedCategory === cat.category && !menu.searchQuery ? ' category-btn--active' : ''}`}
              onClick={() => menu.selectCategory(cat.category)}
            >
              {catLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* CENTRE PANEL */}
      <div className={`panel center-panel${isBrowse ? ' center-panel--active' : ''}`}>
        {/* Mobile controls */}
        <div className="center-panel__mobile-controls">
          <SearchBar
            query={menu.searchQuery}
            onChange={menu.setSearchQuery}
            onSelect={handleSearchSelect}
            suggestions={menu.suggestions}
            placeholder={t.searchPlaceholder}
          />
          <div className="mobile-cat-chips">
            <button
              className={`mobile-cat-chip${!menu.selectedCategory && !menu.searchQuery ? ' mobile-cat-chip--active' : ''}`}
              onClick={() => menu.selectCategory(null)}
            >
              {allLabel}
            </button>
            {menu.categories.map(cat => (
              <button
                key={cat.category}
                className={`mobile-cat-chip${menu.selectedCategory === cat.category && !menu.searchQuery ? ' mobile-cat-chip--active' : ''}`}
                onClick={() => menu.selectCategory(cat.category)}
              >
                {catLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="center-panel__header">
          <span className="center-panel__title">{centreTitle}</span>
          <span className="center-panel__count">{menu.displayedItems.length} items</span>
        </div>
        <div className="menu-grid">
          {menu.displayedItems.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              qtyInOrder={badgeFor(item)}
              onAdd={handleAddItem}
              displayLang={displayLang}
            />
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <OrderPanel
        orderMode={orderMode}
        deliveryInfo={deliveryInfo}
        items={order.items}
        subtotal={order.subtotal}
        total={order.total}
        discount={order.discount}
        deliveryFee={order.deliveryFee}
        onIncrement={order.increment}
        onDecrement={order.decrement}
        onRemove={order.removeItem}
        onSetNote={order.setNote}
        onSplit={order.splitItem}
        onSetDiscount={order.setDiscount}
        onSetDeliveryFee={order.setDeliveryFee}
        onClear={handleClearOrder}
        onPrint={handlePrint}
        printing={printing}
        t={t}
        mobileActive={isOrder}
        tableNumber={tableNumber}
        phone={effectivePhone}
        customerName={customerName}
      />

      {shareBoxItem && (
        <ShareBoxModal
          onConfirm={handleShareBoxConfirm}
          onCancel={() => setShareBoxItem(null)}
        />
      )}

      {drinkItem && (
        <DrinkPickerModal
          item={drinkItem}
          onConfirm={handleDrinkConfirm}
          onCancel={() => setDrinkItem(null)}
        />
      )}

      {offerOpen && (
        <SpecialOfferModal
          initial={groupPeople('so01') > 0 ? offerState : null}
          onConfirm={handleOfferConfirm}
          onCancel={() => setOfferOpen(false)}
        />
      )}

      {banquetItem && (
        <BanquetModal
          fixedBanquetId={banquetItem.banquetId}
          initial={groupPeople(banquetItem.id) > 0 ? banquetStates[banquetItem.id] : null}
          onConfirm={handleBanquetConfirm}
          onCancel={() => setBanquetItem(null)}
        />
      )}

      {houseDish && (
        <HouseDishModal
          dish={houseDish}
          onConfirm={handleHouseDishConfirm}
          onCancel={() => setHouseDish(null)}
        />
      )}

      {platterItem && (
        <PlatterModal
          item={platterItem}
          initial={groupPeople(platterItem.id) > 0 ? platterStates[platterItem.id] : null}
          onConfirm={handlePlatterConfirm}
          onCancel={() => setPlatterItem(null)}
        />
      )}

      {duckItem && (
        <DuckPortionModal
          item={duckItem}
          onConfirm={handleDuckConfirm}
          onCancel={() => setDuckItem(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
