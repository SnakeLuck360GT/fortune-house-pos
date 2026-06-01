import { useState, useCallback } from 'react'

const strings = {
  en: {
    // Navigation
    appName:       'Fortune House POS',
    newOrder:      'New Order',
    settings:      'Settings',
    viewQueue:     'View Queue',
    about:         'About',
    home:          '🏠 Home',
    back:          'Back',

    // Order screen
    searchPlaceholder: 'Search menu (English or Chinese)…',
    allCategories: 'All Items',
    browseTab:     'Browse',
    orderTab:      'Order',
    tillTab:       'Till',

    // Order panel
    currentOrder:  'Current Order',
    total:         'TOTAL',
    printReceipt:  '🖨 Print Receipt',
    clearOrder:    'Clear Order',
    confirmClear:  'Clear all items from order?',
    yes:           'Yes, Clear',
    no:            'Cancel',
    addNote:       '+ note',
    notePlaceholder: 'e.g. no chilli, extra sauce…',
    discount:      'Discount (£)',
    emptyOrder:    'No items yet',
    emptyOrderSub: 'Tap a dish to add it',

    // Settings
    settingsTitle:    'Settings',
    languageSection:  'Language',
    printerSection:   'Printer',
    orderSection:     'Order',
    printerUrl:       'API Base URL',
    printerUrlHint:   'e.g. https://your-site.netlify.app',
    tableNumber:      'Table / Order Name',
    tableNumberHint:  'e.g. Table 3, Takeaway #42',
    testPrint:        'Send Test Print',
    receiptPreview:   'Receipt Preview',
    saveSettings:     'Settings saved',

    // Queue
    queueTitle:       'Print Queue',
    refresh:          'Refresh',
    clearCompleted:   'Clear Done',
    retry:            'Retry',
    emptyQueue:       'No print jobs',
    emptyQueueSub:    'Jobs appear here after printing',
    statusPending:    'Pending',
    statusPrinted:    'Printed',
    statusFailed:     'Failed',
    jobSent:          '✓ Print job sent',
    jobFailed:        '✗ Failed to send',
    testJobSent:      '✓ Test job sent',

    // About
    aboutTitle:       'About',
    aboutBody:        'Fortune House POS — v1.0\nBuilt for in-house order taking and receipt printing via a Raspberry Pi thermal printer bridge.',
  },
  zh: {
    appName:       '福运楼 收银系统',
    newOrder:      '新建订单',
    settings:      '设置',
    viewQueue:     '打印队列',
    about:         '关于',
    home:          '🏠 首页',
    back:          '返回',

    searchPlaceholder: '搜索菜品（中英文皆可）…',
    allCategories: '全部菜品',
    browseTab:     '菜单',
    orderTab:      '订单',
    tillTab:       '结账',

    currentOrder:  '当前订单',
    total:         '总计',
    printReceipt:  '🖨 打印收据',
    clearOrder:    '清空订单',
    confirmClear:  '确认清空所有菜品？',
    yes:           '确认清空',
    no:            '取消',
    addNote:       '+ 备注',
    notePlaceholder: '例如：不加辣，多加酱…',
    discount:      '折扣 (£)',
    emptyOrder:    '订单为空',
    emptyOrderSub: '点击菜品即可添加',

    settingsTitle:    '设置',
    languageSection:  '语言',
    printerSection:   '打印机',
    orderSection:     '订单',
    printerUrl:       'API 网址',
    printerUrlHint:   '例如：https://your-site.netlify.app',
    tableNumber:      '桌号 / 订单名称',
    tableNumberHint:  '例如：3号桌，外卖#42',
    testPrint:        '发送测试打印',
    receiptPreview:   '收据预览',
    saveSettings:     '设置已保存',

    queueTitle:       '打印队列',
    refresh:          '刷新',
    clearCompleted:   '清除已完成',
    retry:            '重试',
    emptyQueue:       '暂无打印任务',
    emptyQueueSub:    '打印任务将显示于此',
    statusPending:    '待打印',
    statusPrinted:    '已打印',
    statusFailed:     '失败',
    jobSent:          '✓ 打印任务已发送',
    jobFailed:        '✗ 发送失败',
    testJobSent:      '✓ 测试任务已发送',

    aboutTitle:       '关于',
    aboutBody:        '福运楼收银系统 — v1.0\n专为堂食点单及热敏打印机收据打印而设计。',
  },
}

export function useLanguage() {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('pos_lang') || 'en'
  )

  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem('pos_lang', l)
  }, [])

  const t = strings[lang]

  return { lang, setLang, t }
}
