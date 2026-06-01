import { useState, useCallback } from 'react'
import { useLanguage } from './hooks/useLanguage.js'
import MainMenu       from './screens/MainMenu.jsx'
import OrderScreen    from './screens/OrderScreen.jsx'
import DeliveryDetails from './screens/DeliveryDetails.jsx'
import Settings       from './screens/Settings.jsx'
import Queue          from './screens/Queue.jsx'

const SETTINGS_KEY = 'pos_settings'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} }
  catch { return {} }
}

export default function App() {
  const [screen,       setScreen]       = useState('menu')
  const [orderMode,    setOrderMode]    = useState(null)     // 'takeaway' | 'delivery'
  const [deliveryInfo, setDeliveryInfo] = useState(null)     // from DeliveryDetails
  const { lang, setLang, t } = useLanguage()
  const [settings, setSettings] = useState(loadSettings)

  function saveSettings(updated) {
    const merged = { ...settings, ...updated }
    setSettings(merged)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged))
  }

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

  function goMenu() {
    setScreen('menu')
    setOrderMode(null)
    setDeliveryInfo(null)
  }

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu onNavigate={navigate} t={t} />
      )}
      {screen === 'delivery' && (
        <DeliveryDetails
          onNavigate={navigate}
          onConfirm={handleDeliveryConfirm}
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
      {screen === 'queue' && (
        <Queue onNavigate={navigate} settings={settings} t={t} />
      )}
    </div>
  )
}
