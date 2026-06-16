import { RESTAURANT_NAME, RESTAURANT_NAME_ZH } from '../data/menu.js'
import { NOTE_OPTIONS } from '../data/noteOptions.js'

const LINE_WIDTH = 32

function pad(str, width) {
  const s = String(str)
  return s.length >= width ? s : s + ' '.repeat(width - s.length)
}

function center(str, width) {
  const len = str.length
  if (len >= width) return str
  const left = Math.floor((width - len) / 2)
  return ' '.repeat(left) + str
}

function separator(char = '-', width = LINE_WIDTH) {
  return char.repeat(width)
}

export function formatPrice(p) {
  return `£${p.toFixed(2)}`
}

// Split a comma-separated note into individual lines with +/- prefix and English label.
// Chinese modifiers starting with 不 are "remove" (−), everything else is "add" (+).
const ZH_TO_EN = Object.fromEntries(NOTE_OPTIONS.map(o => [o.zh, o.en]))

function parseNoteLines(note) {
  return note
    .split(/[,，]\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(zh => ({ prefix: zh.startsWith('不') ? '-' : '+', zh, en: ZH_TO_EN[zh] ?? zh }))
}

// Returns a structured array of line objects for rich rendering in ReceiptPreview.
// type: 'sep-heavy' | 'sep-light' | 'blank' | 'center' | 'zh' | 'en' | 'note' | 'subtotal' | 'total' | 'footer'
export function buildReceiptLines({ items, total, tableNumber, discount, deliveryFee, orderMode, deliveryInfo, timestamp }) {
  const ts = timestamp ? new Date(timestamp) : new Date()
  const dateStr = ts.toLocaleDateString('en-GB')
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const isDelivery = orderMode === 'delivery'

  const lines = []

  lines.push({ type: 'sep-heavy' })
  lines.push({ type: 'center', text: RESTAURANT_NAME })
  lines.push({ type: 'center', text: RESTAURANT_NAME_ZH })
  lines.push({ type: 'center', text: `${dateStr}  ${timeStr}` })
  if (tableNumber) lines.push({ type: 'center', text: `Table: ${tableNumber}` })

  // Order type
  lines.push({ type: 'order-type', text: isDelivery ? '🛵  DELIVERY  外送' : '🛍  TAKEAWAY  外带', isDelivery })
  if (isDelivery && deliveryInfo) {
    if (deliveryInfo.customerName) lines.push({ type: 'center', text: deliveryInfo.customerName })
    if (deliveryInfo.address)      lines.push({ type: 'center', text: deliveryInfo.address })
  }
  lines.push({ type: 'sep-heavy' })
  lines.push({ type: 'blank' })

  items.forEach(item => {
    const price  = formatPrice((item.price + (item.notePrice || 0)) * item.quantity)
    const zhName = item.nameZh || item.nameEn
    lines.push({ type: 'zh', text: zhName, price, quantity: item.quantity })
    lines.push({ type: 'en', text: `${item.nameEn}  ×${item.quantity}` })
    if (Array.isArray(item.details)) {
      const isBlock = item.details.length > 2   // multi-line breakdown vs single zh/en pair
      item.details.forEach(d => lines.push({ type: 'detail', text: d.text, big: d.big, block: isBlock }))
    }
    if (item.note) {
      parseNoteLines(item.note).forEach(({ prefix, zh, en }) => {
        lines.push({ type: 'note-zh', text: `${prefix} ${zh}` })
        if (en !== zh) lines.push({ type: 'note-en', text: `${prefix} ${en}` })
      })
    }
  })

  lines.push({ type: 'blank' })
  lines.push({ type: 'sep-light' })

  const hasExtras = (discount && discount > 0) || (deliveryFee && deliveryFee > 0)
  if (hasExtras) {
    const subtotal = items.reduce((s, i) => s + (i.price + (i.notePrice || 0)) * i.quantity, 0)
    lines.push({ type: 'subtotal', label: 'Subtotal', price: formatPrice(subtotal) })
    if (deliveryFee && deliveryFee > 0)
      lines.push({ type: 'subtotal', label: 'Delivery', price: formatPrice(deliveryFee) })
    if (discount && discount > 0)
      lines.push({ type: 'subtotal', label: 'Discount', price: `-${formatPrice(discount)}` })
  }

  lines.push({ type: 'total', price: formatPrice(total) })
  lines.push({ type: 'sep-heavy' })
  lines.push({ type: 'footer', text: '** Thank you / 谢谢惠顾 **' })
  lines.push({ type: 'sep-heavy' })

  return lines
}

// Plain-text fallback
export function buildReceiptText({ items, total, tableNumber, discount, deliveryFee, orderMode, deliveryInfo, timestamp }) {
  return buildReceiptLines({ items, total, tableNumber, discount, deliveryFee, orderMode, deliveryInfo, timestamp })
    .map(l => {
      switch (l.type) {
        case 'sep-heavy':   return '='.repeat(LINE_WIDTH)
        case 'sep-light':   return '-'.repeat(LINE_WIDTH)
        case 'blank':       return ''
        case 'center':      return center(l.text, LINE_WIDTH)
        case 'order-type':  return center(l.text, LINE_WIDTH)
        case 'zh':          return pad(l.text, LINE_WIDTH - l.price.length) + l.price
        case 'en':          return `  ${l.text}`
        case 'detail':      return `  ${l.text}`
        case 'note':
        case 'note-zh':     return `  ${l.text}`
        case 'note-en':     return `    ${l.text}`
        case 'subtotal':    return pad(l.label + ':', LINE_WIDTH - l.price.length) + l.price
        case 'total':       return pad('TOTAL:', LINE_WIDTH - l.price.length) + l.price
        case 'footer':      return center(l.text, LINE_WIDTH)
        default:            return ''
      }
    })
    .join('\n')
}

// ESC/POS command buffer for the Raspberry Pi — always bilingual
export function buildEscposReceipt({ items, total, tableNumber, discount, deliveryFee, orderId, timestamp }) {
  const CMD_INIT         = Buffer.from([0x1b, 0x40])
  const CMD_CENTER       = Buffer.from([0x1b, 0x61, 0x01])
  const CMD_LEFT         = Buffer.from([0x1b, 0x61, 0x00])
  const CMD_DOUBLE       = Buffer.from([0x1b, 0x21, 0x30])
  const CMD_NORMAL       = Buffer.from([0x1b, 0x21, 0x00])
  const CMD_BOLD_ON      = Buffer.from([0x1b, 0x45, 0x01])
  const CMD_BOLD_OFF     = Buffer.from([0x1b, 0x45, 0x00])
  const CMD_CUT          = Buffer.from([0x1d, 0x56, 0x41, 0x00])

  const enc = s => Buffer.from(s, 'utf8')
  const lf  = (n = 1) => Buffer.alloc(n, 0x0a)

  const ts = timestamp ? new Date(timestamp) : new Date()
  const dateStr = ts.toLocaleDateString('en-GB')
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const chunks = []

  chunks.push(CMD_INIT, CMD_CENTER)
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE, enc(RESTAURANT_NAME + '\n'), CMD_NORMAL)
  chunks.push(CMD_DOUBLE, enc(RESTAURANT_NAME_ZH + '\n'), CMD_NORMAL, CMD_BOLD_OFF)
  chunks.push(enc(`${dateStr}  ${timeStr}\n`))
  if (tableNumber) chunks.push(enc(`Table: ${tableNumber}\n`))
  chunks.push(enc('================================\n\n'))
  chunks.push(CMD_LEFT)

  items.forEach(item => {
    const price  = formatPrice((item.price + (item.notePrice || 0)) * item.quantity)
    const zhName = item.nameZh || item.nameEn
    // Chinese name — double height, price on same line
    chunks.push(CMD_DOUBLE)
    chunks.push(enc(pad(zhName.slice(0, 10), 10) + '  ' + price + '\n'))
    chunks.push(CMD_NORMAL)
    // English name + qty — normal size, indented
    chunks.push(enc(`  ${item.nameEn}  x${item.quantity}\n`))
    if (Array.isArray(item.details)) {
      const isBlock = item.details.length > 2
      let prevBig = null
      item.details.forEach(d => {
        if (prevBig === true && !d.big && isBlock) chunks.push(lf(1))   // gap between zh/en blocks
        if (d.big) chunks.push(CMD_DOUBLE, enc(`${d.text}\n`), CMD_NORMAL)
        else       chunks.push(enc(`  ${d.text}\n`))
        prevBig = !!d.big
      })
    }
    if (item.note) {
      chunks.push(CMD_DOUBLE)
      parseNoteLines(item.note).forEach(({ prefix, zh }) =>
        chunks.push(enc(`${prefix} ${zh}\n`))
      )
      chunks.push(CMD_NORMAL)
    }
    chunks.push(lf(1))
  })

  chunks.push(enc('--------------------------------\n'))

  if ((discount && Number(discount) > 0) || (deliveryFee && Number(deliveryFee) > 0)) {
    const subtotal = items.reduce((s, i) => s + (i.price + (i.notePrice || 0)) * i.quantity, 0)
    chunks.push(enc(pad('Subtotal:', LINE_WIDTH - formatPrice(subtotal).length) + formatPrice(subtotal) + '\n'))
    if (deliveryFee && Number(deliveryFee) > 0) {
      const del = formatPrice(deliveryFee)
      chunks.push(enc(pad('Delivery:', LINE_WIDTH - del.length) + del + '\n'))
    }
    if (discount && Number(discount) > 0) {
      const disc = `-${formatPrice(discount)}`
      chunks.push(enc(pad('Discount:', LINE_WIDTH - disc.length) + disc + '\n'))
    }
  }

  chunks.push(CMD_BOLD_ON, CMD_DOUBLE)
  const totalStr = formatPrice(total)
  chunks.push(enc(pad('TOTAL:', 14) + totalStr + '\n'))
  chunks.push(CMD_NORMAL, CMD_BOLD_OFF)

  chunks.push(enc('================================\n'))
  chunks.push(CMD_CENTER, enc('** Thank you / 谢谢惠顾 **\n'))
  chunks.push(enc('================================\n'))
  chunks.push(lf(4), CMD_CUT)

  return Buffer.concat(chunks)
}
