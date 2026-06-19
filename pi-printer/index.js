/**
 * Fortune House — Raspberry Pi Printer Bridge
 *
 * Polls the Netlify job queue every 2 seconds and prints pending jobs
 * to a USB thermal printer using ESC/POS commands.
 *
 * Setup: see README.md
 */

const ThermalPrinter = require('node-thermal-printer').printer
const PrinterTypes   = require('node-thermal-printer').types
const iconv          = require('iconv-lite')
const fetch          = require('node-fetch')

// ─── Configuration ──────────────────────────────────────────────────────────
const API_BASE      = process.env.API_BASE || 'https://your-site.netlify.app'
const POLL_MS       = parseInt(process.env.POLL_MS || '2000', 10)
const PRINTER_IFACE = process.env.PRINTER_INTERFACE || '/dev/usb/lp0'
const USE_GB2312    = process.env.USE_GB2312 === 'true'  // set true for GB2312 printers
const TAKEAWAY_COPIES = Math.max(1, parseInt(process.env.TAKEAWAY_COPIES || '3', 10))  // copies per takeaway order
const DELIVERY_COPIES = Math.max(1, parseInt(process.env.DELIVERY_COPIES || '4', 10))  // copies per delivery order
const LINE_WIDTH    = 32
const LOGO_BUFFER   = null   // optional ESC/POS raster logo for the daily summary (none for now)

// ─── Printer setup ──────────────────────────────────────────────────────────
function createPrinter() {
  return new ThermalPrinter({
    type:               PrinterTypes.EPSON,
    interface:          PRINTER_IFACE,
    characterSet:       'PC437_USA',
    removeSpecialCharacters: false,
    lineCharacter:      '-',
    breakLine:          'WORD',
    width:              LINE_WIDTH,
  })
}

// ─── ESC/POS raw helpers ─────────────────────────────────────────────────────
const ESC = '\x1b'
const GS  = '\x1d'

const CMD_INIT          = Buffer.from([0x1b, 0x40])
const CMD_ALIGN_CENTER  = Buffer.from([0x1b, 0x61, 0x01])
const CMD_ALIGN_LEFT    = Buffer.from([0x1b, 0x61, 0x00])
// GS ! — character size (width/height magnification 1-8). Bigger than the old
// ESC ! cap of 2×, so Chinese can be printed genuinely large.
const szCmd = (w, h) => Buffer.from([0x1d, 0x21, (((w - 1) & 7) << 4) | ((h - 1) & 7)])
const CMD_NORMAL_SIZE   = szCmd(1, 1)
const CMD_DOUBLE_SIZE   = szCmd(2, 2)  // the size the notes print at — the size we want for Chinese
const CMD_BOLD_ON       = Buffer.from([0x1b, 0x45, 0x01])
const CMD_BOLD_OFF      = Buffer.from([0x1b, 0x45, 0x00])
const CMD_INVERT_ON     = Buffer.from([0x1d, 0x42, 0x01])  // white on black
const CMD_INVERT_OFF    = Buffer.from([0x1d, 0x42, 0x00])
const CMD_UNDERLINE_ON  = Buffer.from([0x1b, 0x2d, 0x01])
const CMD_UNDERLINE_OFF = Buffer.from([0x1b, 0x2d, 0x00])
const CMD_CUT           = Buffer.from([0x1d, 0x56, 0x41, 0x00])  // partial cut
const CMD_LF            = Buffer.from([0x0a])
const CMD_CHINESE_ON    = Buffer.from([0x1c, 0x26])  // FS & — enter Chinese (GB2312) mode
const CMD_CHINESE_OFF   = Buffer.from([0x1c, 0x2e])  // FS . — exit Chinese mode

function encodeText(text) {
  if (USE_GB2312) {
    try {
      return iconv.encode(text, 'GB2312')
    } catch {
      return Buffer.from(text, 'utf8')
    }
  }
  return Buffer.from(text, 'utf8')
}

function lf(n = 1) {
  return Buffer.alloc(n, 0x0a)
}

function pad(str, width) {
  const s = String(str)
  if (s.length >= width) return s
  return s + ' '.repeat(width - s.length)
}

function center(str, width) {
  const len = str.length
  if (len >= width) return str
  const l = Math.floor((width - len) / 2)
  return ' '.repeat(l) + str
}

function formatPrice(p) {
  // GB2312 printers have no half-width £ (it maps to "?"), so use full-width ￡
  const sym = USE_GB2312 ? '￡' : '\xa3'
  return `${sym}${Number(p).toFixed(2)}`
}

// Printed column width of a string. On GB2312 printers a 2-byte glyph occupies
// 2 columns and a 1-byte glyph 1 column, so the encoded byte length is the
// column count. (English/UTF-8 path: ASCII names → 1 col each.)
function colWidth(s) {
  return encodeText(s).length
}

function getItemName(item, lang) {
  if (lang === 'zh') return item.nameZh || item.nameEn
  return item.nameEn
}

// Estimated ready (takeaway, +20 min) / delivery (+40–60 min) time.
function etaLines(ts, isDelivery) {
  const fmt = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const at  = mins => fmt(new Date(ts.getTime() + mins * 60000))
  return isDelivery
    ? [`Delivery ~${at(40)}-${at(60)}`, '约40-60分钟 / 40-60 mins']
    : [`Ready ~${at(20)}`,              '约20分钟 / 20 mins']
}

// ─── Note helpers ────────────────────────────────────────────────────────────
const ZH_TO_EN = {
  '不加辣': 'No Chilli',    '不加蒜': 'No Garlic',      '不加洋葱': 'No Onions',
  '不加葱': 'No Spring Onion', '不加蔬菜': 'No Vegetables', '不加蘑菇': 'No Mushrooms',
  '不加糖': 'No Sugar',     '不加味精': 'No MSG',       '不加盐': 'No Salt',
  '不加蛋': 'No Egg',       '不加猪肉': 'No Pork',      '多加酱': 'Extra Sauce',
  '加辣':   'Extra Spicy',  '多加辣椒': 'Extra Chilli', '多加蘑菇': 'Extra Mushrooms',
  '多加蔬菜': 'Extra Vegetables', '多加饭': 'Extra Rice', '多加面': 'Extra Noodles',
  '加脆':   'Extra Crispy', '全熟': 'Well Done',
}

function parseNoteLines(note) {
  return note.split(/[,，]\s*/).map(s => s.trim()).filter(Boolean).map(zh => ({
    prefix: zh.startsWith('不') ? '-' : '+',
    zh,
    en: ZH_TO_EN[zh] || zh,
  }))
}

// ─── Receipt builder ─────────────────────────────────────────────────────────
function buildReceiptBuffers(job) {
  const { items, total, tableNumber, discount, deliveryFee, orderId, timestamp,
          orderMode, deliveryInfo, phone, customerName, lang = 'en' } = job
  const ts = timestamp ? new Date(timestamp) : new Date()
  const dateStr = ts.toLocaleDateString('en-GB')
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const isDelivery = orderMode === 'delivery'

  const chunks = []

  // Init + center
  chunks.push(CMD_INIT)
  if (USE_GB2312) chunks.push(CMD_CHINESE_ON)   // enable Chinese font mode on GB2312 printers
  chunks.push(CMD_ALIGN_CENTER)

  // Restaurant name — bold, double size (clear without squishing)
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  chunks.push(encodeText('Fortune House\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

  chunks.push(encodeText(`${dateStr}  ${timeStr}\n`))
  if (tableNumber) chunks.push(encodeText(`Table: ${tableNumber}\n`))

  // Order type banner
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  chunks.push(encodeText(isDelivery ? 'DELIVERY 外送\n' : 'TAKEAWAY 外带\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

  // Delivery customer info
  if (isDelivery && deliveryInfo) {
    if (deliveryInfo.customerName) chunks.push(encodeText(`${deliveryInfo.customerName}\n`))
    if (deliveryInfo.address)      chunks.push(encodeText(`${deliveryInfo.address}\n`))
    if (deliveryInfo.driveMinutes) chunks.push(encodeText(`~${deliveryInfo.driveMinutes} min\n`))
  } else if (customerName) {
    chunks.push(encodeText(`${customerName}\n`))
  }

  // Customer phone (takeaway + delivery)
  const tel = phone || deliveryInfo?.phone
  if (tel) {
    chunks.push(CMD_BOLD_ON, encodeText(`Tel: ${tel}\n`), CMD_BOLD_OFF)
  }

  // Estimated ready / delivery time
  chunks.push(CMD_BOLD_ON)
  etaLines(ts, isDelivery).forEach(line => chunks.push(encodeText(line + '\n')))
  chunks.push(CMD_BOLD_OFF)

  chunks.push(encodeText('================================\n\n'))
  chunks.push(CMD_ALIGN_LEFT)

  // Items — flat bilingual list, exactly mirroring the on-screen preview:
  // Chinese name (double height) + "×qty", price right-aligned; English name
  // beneath in normal size with "×qty"; then any set-meal breakdown.
  ;(items || []).forEach(item => {
    const price  = formatPrice((item.price + (item.notePrice || 0)) * item.quantity)
    const zhName = item.nameZh || item.nameEn
    const qty    = item.peopleQty ?? item.quantity   // set-menus show "×people"

    // Item title — a PURE double-size line, so it prints at exactly the same
    // size as the 汤:/主菜: lines and notes. (Putting the normal-size price on
    // the same line made the printer condense/"squish" the title.)
    chunks.push(CMD_DOUBLE_SIZE, encodeText(`${zhName} ×${qty}\n`), CMD_NORMAL_SIZE)

    // English name + price on a normal-size line; price right-aligned, dropping
    // to its own line only if the name is too long to share.
    const en = `  ${item.nameEn} ×${qty}`
    if (colWidth(en) + colWidth(price) + 1 <= LINE_WIDTH) {
      chunks.push(encodeText(en + ' '.repeat(LINE_WIDTH - colWidth(en) - colWidth(price)) + price + '\n'))
    } else {
      chunks.push(encodeText(en + '\n'))
      chunks.push(encodeText(' '.repeat(Math.max(1, LINE_WIDTH - colWidth(price))) + price + '\n'))
    }

    // Set-meal breakdown: big Chinese block, compact English block, with
    // horizontal rules and underlined headers (identical to the preview).
    if (Array.isArray(item.details)) {
      const isBlock = item.details.length > 2
      let prevBig = null
      item.details.forEach((d, di) => {
        if (d.rule) { chunks.push(encodeText('-'.repeat(LINE_WIDTH) + '\n')); return }
        if (prevBig === true && !d.big && isBlock) chunks.push(lf(1))               // gap between zh/en blocks
        if (d.header && d.big && di > 0 && prevBig === !!d.big) chunks.push(lf(1))  // gap before a big group header (English stays compact)
        const u = d.header
        if (d.big) chunks.push(CMD_DOUBLE_SIZE, ...(u ? [CMD_UNDERLINE_ON] : []), encodeText(`${d.text}\n`), ...(u ? [CMD_UNDERLINE_OFF] : []), CMD_NORMAL_SIZE)
        else       chunks.push(...(u ? [CMD_UNDERLINE_ON] : []), encodeText(`  ${d.text}\n`), ...(u ? [CMD_UNDERLINE_OFF] : []))
        prevBig = !!d.big
      })
    }

    if (item.note) {
      parseNoteLines(item.note).forEach(({ prefix, zh, en }) => {
        chunks.push(CMD_DOUBLE_SIZE, encodeText(`${prefix} ${zh}\n`), CMD_NORMAL_SIZE)
        if (en !== zh) chunks.push(encodeText(`  ${prefix} ${en}\n`))
      })
    }

    chunks.push(lf(1))
  })

  chunks.push(encodeText('--------------------------------\n'))

  // Subtotal / delivery / discount lines
  const hasExtras = (discount && Number(discount) > 0) || (deliveryFee && Number(deliveryFee) > 0)
  if (hasExtras) {
    const subtotal = (items || []).reduce((s, i) => s + (i.price + (i.notePrice || 0)) * i.quantity, 0)
    chunks.push(CMD_BOLD_ON)
    chunks.push(encodeText(pad('SUBTOTAL:', LINE_WIDTH - formatPrice(subtotal).length) + formatPrice(subtotal) + '\n'))
    if (deliveryFee && Number(deliveryFee) > 0) {
      const d = formatPrice(Number(deliveryFee))
      chunks.push(encodeText(pad('DELIVERY:', LINE_WIDTH - d.length) + d + '\n'))
    }
    if (discount && Number(discount) > 0) {
      const disc = `-${formatPrice(Number(discount))}`
      chunks.push(encodeText(pad('DISCOUNT:', LINE_WIDTH - disc.length) + disc + '\n'))
    }
    chunks.push(CMD_BOLD_OFF)
  }

  // Total — double size
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  const totalStr = formatPrice(total)
  chunks.push(encodeText(pad('TOTAL:', 12) + totalStr + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

  chunks.push(encodeText('================================\n'))
  chunks.push(CMD_ALIGN_CENTER)
  chunks.push(encodeText('** Thank you / 谢谢惠顾 **\n'))
  chunks.push(encodeText('================================\n'))

  chunks.push(lf(4))
  chunks.push(CMD_CUT)

  return Buffer.concat(chunks)
}

// ─── Float / daily summary receipt ───────────────────────────────────────────
function buildFloatBuffers(job) {
  const { floatSummary, timestamp } = job
  const { date, takeaways, deliveries, takeawayTotal, deliveryTotal, grandTotal } = floatSummary
  const ts = timestamp ? new Date(timestamp) : new Date()
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const allOrders = [...takeaways, ...deliveries].sort((a, b) => a.timestamp - b.timestamp)

  const chunks = []
  chunks.push(CMD_INIT, CMD_ALIGN_CENTER)
  if (USE_GB2312) chunks.push(CMD_CHINESE_ON)   // enable Chinese font mode on GB2312 printers

  if (LOGO_BUFFER) chunks.push(LOGO_BUFFER)

  // ── Dark header (inverted): restaurant name + date ──
  chunks.push(CMD_INVERT_ON, CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  chunks.push(encodeText(center('Fortune House', LINE_WIDTH * 2) + '\n'))
  chunks.push(CMD_NORMAL_SIZE)
  chunks.push(CMD_DOUBLE_SIZE)
  chunks.push(encodeText(center('福运楼', LINE_WIDTH * 2) + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)
  chunks.push(encodeText(center(`${date}  ${timeStr}`, LINE_WIDTH) + '\n'))
  chunks.push(CMD_INVERT_OFF)

  // ── Title band (inverted): DAILY SUMMARY ──
  chunks.push(CMD_INVERT_ON, CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  chunks.push(encodeText(center('DAILY SUMMARY', LINE_WIDTH * 2) + '\n'))
  chunks.push(CMD_NORMAL_SIZE)
  chunks.push(CMD_DOUBLE_SIZE)
  chunks.push(encodeText(center('日结报告', LINE_WIDTH * 2) + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)
  chunks.push(CMD_INVERT_OFF)
  chunks.push(lf(1))

  // ── Count + subtotal rows ──
  chunks.push(CMD_ALIGN_LEFT, CMD_BOLD_ON)
  const taTotal  = formatPrice(takeawayTotal)
  const delTotal = formatPrice(deliveryTotal)
  chunks.push(encodeText(pad(`TAKEAWAY  ${takeaways.length} orders`, LINE_WIDTH - taTotal.length)  + taTotal  + '\n'))
  chunks.push(encodeText(pad(`DELIVERY  ${deliveries.length} orders`, LINE_WIDTH - delTotal.length) + delTotal + '\n'))
  chunks.push(CMD_BOLD_OFF)
  chunks.push(encodeText('--------------------------------\n'))

  // ── Individual orders ──
  allOrders.forEach(j => {
    const t    = new Date(j.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const mode = j.orderMode === 'delivery' ? '[DEL]' : '[T/A]'
    const tot  = formatPrice(Number(j.total))
    chunks.push(CMD_BOLD_ON)
    chunks.push(encodeText(pad(`${t}  ${mode}`, LINE_WIDTH - tot.length) + tot + '\n'))
    chunks.push(CMD_BOLD_OFF)
    const names = (j.items || []).slice(0, 3).map(i => i.nameEn).join(', ')
    if (names) chunks.push(encodeText(`  ${names.slice(0, LINE_WIDTH - 2)}\n`))
  })

  // ── Grand total (inverted) ──
  chunks.push(CMD_ALIGN_CENTER)
  chunks.push(encodeText('================================\n'))
  chunks.push(CMD_INVERT_ON, CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  const gStr = formatPrice(grandTotal)
  chunks.push(encodeText(center(`TOTAL  ${gStr}`, LINE_WIDTH * 2) + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)
  chunks.push(CMD_INVERT_OFF)

  chunks.push(lf(4), CMD_CUT)

  return Buffer.concat(chunks)
}

// ─── Print job ───────────────────────────────────────────────────────────────
async function printJob(job) {
  console.log(`[PRINT] Printing job ${job.jobId} (type: ${job.type || 'order'})…`)

  const printer = createPrinter()

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) {
    throw new Error(`Printer not connected at ${PRINTER_IFACE}`)
  }

  const buffer = job.type === 'float'
    ? buildFloatBuffers(job)
    : buildReceiptBuffers({ ...job, lang: job.lang || 'en' })

  // Daily summaries print once; order receipts print per-mode copies
  // (takeaway = 3, delivery = 4 by default).
  const copies = job.type === 'float'
    ? 1
    : (job.orderMode === 'delivery' ? DELIVERY_COPIES : TAKEAWAY_COPIES)

  // Use raw buffer mode — write directly to the printer interface
  const fs = require('fs')
  for (let i = 0; i < copies; i++) {
    const fd = fs.openSync(PRINTER_IFACE, 'w')
    fs.writeSync(fd, buffer)
    fs.closeSync(fd)
    // Let the cutter finish before sending the next copy
    if (i < copies - 1) await new Promise(r => setTimeout(r, 600))
  }

  console.log(`[PRINT] Job ${job.jobId} printed successfully (${copies}× ${buffer.length} bytes)`)
}

// ─── API helpers ─────────────────────────────────────────────────────────────
async function fetchPendingJobs() {
  const res = await fetch(`${API_BASE}/api/jobs?status=pending`, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000,
  })
  if (!res.ok) throw new Error(`API returned ${res.status}`)
  const data = await res.json()
  return data.jobs || []
}

async function markComplete(jobId) {
  await fetch(`${API_BASE}/api/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
    timeout: 8000,
  })
}

async function markFailed(jobId, error) {
  await fetch(`${API_BASE}/api/fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, error: String(error) }),
    timeout: 8000,
  })
}

// ─── Main poll loop ───────────────────────────────────────────────────────────
let processing = false

async function poll() {
  if (processing) return

  try {
    const jobs = await fetchPendingJobs()

    if (jobs.length === 0) return

    console.log(`[POLL] ${jobs.length} pending job(s) found`)
    processing = true

    for (const job of jobs) {
      try {
        await printJob(job)
        await markComplete(job.jobId)
        console.log(`[OK]   ${job.jobId} marked as printed`)
      } catch (err) {
        console.error(`[FAIL] ${job.jobId}:`, err.message)
        await markFailed(job.jobId, err.message).catch(() => {})
      }
      // Brief pause between jobs
      await new Promise(r => setTimeout(r, 500))
    }
  } catch (err) {
    if (!err.message.includes('ECONNREFUSED')) {
      console.error('[POLL ERROR]', err.message)
    }
  } finally {
    processing = false
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log('===========================================')
console.log('  Fortune House Printer Bridge — Starting')
console.log(`  API:      ${API_BASE}`)
console.log(`  Printer:  ${PRINTER_IFACE}`)
console.log(`  Encoding: ${USE_GB2312 ? 'GB2312' : 'UTF-8'}`)
console.log(`  Copies:   takeaway ${TAKEAWAY_COPIES}, delivery ${DELIVERY_COPIES}`)
console.log(`  Poll:     every ${POLL_MS}ms`)
console.log('===========================================')

// Initial poll, then interval
poll()
setInterval(poll, POLL_MS)
