import { useState, useCallback } from 'react'
import { useLanguage } from './hooks/useLanguage.js'
import MainMenu       from './screens/MainMenu.jsx'
import OrderScreen    from './screens/OrderScreen.jsx'
import DeliveryDetails from './screens/DeliveryDetails.jsx'
import TakeawayDetails from './screens/TakeawayDetails.jsx'
import Settings       from './screens/Settings.jsx'
import Queue          from './screens/Queue.jsx'
import MenuConfig     from './screens/MenuConfig.jsx'
import PaperBanner    from './components/PaperBanner.jsx'

const SETTINGS_KEY = 'pos_settings'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} }
  catch { return {} }
}

export default function App() {
  const [screen,       setScreen]       = useState('menu')
  const [orderMode,    setOrderMode]    = useState(null)     // 'takeaway' | 'delivery'
  const [deliveryInfo, setDeliveryInfo] = useState(null)     // from DeliveryDetails
  const [takeawayInfo, setTakeawayInfo] = useState(null)     // from TakeawayDetails
  const { lang, setLang, t } = useLanguage()
  const [settings, setSettings] = useState(loadSettings)
  const [flash,    setFlash]    = useState(null)   // toast carried to the home screen

  function saveSettings(updated) {
    const merged = { ...settings, ...updated }
    setSettings(merged)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged))
  }

  const displayLang = settings.displayLang || 'both'
  const enBig = displayLang === 'en' || (displayLang === 'both' && settings.bigLang === 'en')

  // navigate(screen, mode?) — mode is 'takeaway'|'delivery'
  const navigate = useCallback((to, mode) => {
    if (mode) setOrderMode(mode)
    setScreen(to)
  }, [])

  function handleDeliveryConfirm(info) {
    setOrderMode('delivery')
    setDeliveryInfo(info)
    setScreen('order')
  }

  function handleTakeawayConfirm(info) {
    setOrderMode('takeaway')
    setTakeawayInfo(info)
    setScreen('order')
  }

  // goMenu('✓ Print job sent') also shows that message on the home screen
  function goMenu(message) {
    if (typeof message === 'string') {
      setFlash(message)
      setTimeout(() => setFlash(null), 3000)
    }
    setScreen('menu')
    setOrderMode(null)
    setDeliveryInfo(null)
    setTakeawayInfo(null)
  }

  return (
    // "English bigger" (Settings → Menu Item Display) also flips the dish/sauce
    // option buttons in the pop-ups, via CSS on this class
    <div className={`app${enBig ? ' app--en-big' : ''}`}>
      <PaperBanner />
      {flash && <div className="toast toast--success">{flash}</div>}
      {screen === 'menu' && (
        <MainMenu onNavigate={navigate} t={t} settings={settings} />
      )}
      {screen === 'delivery' && (
        <DeliveryDetails
          onNavigate={navigate}
          onConfirm={handleDeliveryConfirm}
          t={t}
        />
      )}
      {screen === 'takeaway' && (
        <TakeawayDetails
          onNavigate={navigate}
          onConfirm={handleTakeawayConfirm}
          t={t}
        />
      )}
      {screen === 'order' && (
        <OrderScreen
          onNavigate={navigate}
          onGoMenu={goMenu}
          t={t}
          lang={lang}
          settings={settings}
          orderMode={orderMode}
          deliveryInfo={deliveryInfo}
          takeawayInfo={takeawayInfo}
        />
      )}
      {screen === 'settings' && (
        <Settings
          onNavigate={navigate}
          settings={settings}
          onSaveSettings={saveSettings}
          lang={lang}
          setLang={setLang}
          t={t}
        />
      )}
      {screen === 'config' && (
        <MenuConfig onNavigate={navigate} />
      )}
      {screen === 'queue' && (
        <Queue onNavigate={navigate} settings={settings} t={t} />
      )}
    </div>
  )
}
