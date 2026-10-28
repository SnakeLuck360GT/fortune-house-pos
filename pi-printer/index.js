/**
 * Fortune House — Raspberry Pi Printer Bridge
 *
 * Waits for push notifications (ntfy.sh) that a job was queued, then fetches
 * pending jobs from Netlify and prints them to a USB thermal printer using
 * ESC/POS commands. No constant polling, so Netlify only gets hit per order.
 *
 * Setup: see README.md
 */

const ThermalPrinter = require('node-thermal-printer').printer
const PrinterTypes   = require('node-thermal-printer').types
const iconv          = require('iconv-lite')
const fetch          = require('node-fetch')

// ─── Configuration ──────────────────────────────────────────────────────────
const API_BASE      = process.env.API_BASE || 'https://your-site.netlify.app'
const NTFY_URL      = (process.env.NTFY_URL || 'https://ntfy.sh').replace(/\/$/, '')
const NTFY_TOPIC    = process.env.NTFY_TOPIC || 'fortunehouse-print-VuobJYS9XKBh'  // must match VITE_NTFY_TOPIC in the web app
const FALLBACK_POLL_MS = parseInt(process.env.FALLBACK_POLL_MS || String(15 * 60 * 1000), 10)  // safety-net poll; 0 disables
const PRINTER_IFACE = process.env.PRINTER_INTERFACE || '/dev/usb/lp0'
const USE_GB2312    = process.env.USE_GB2312 === 'true'  // set true for GB2312 printers
const TAKEAWAY_COPIES = Math.max(1, parseInt(process.env.TAKEAWAY_COPIES || '3', 10))  // copies per takeaway order
const DELIVERY_COPIES = Math.max(1, parseInt(process.env.DELIVERY_COPIES || '4', 10))  // copies per delivery order
const LINE_WIDTH    = 32
// Chinese item/detail/note size as "<width>x<height>" (1-8 each). 2x1 = wide but
// single height, which roughly halves the paper each Chinese line uses vs 2x2.
const [ZH_W, ZH_H]  = (process.env.ZH_SIZE || '2x2').split('x').map(n => Math.min(8, Math.max(1, parseInt(n, 10) || 1)))
// Dots fed per normal-height line (printer default is ~30-34). 24 = the font's
// own height, i.e. no gap between lines. 0 = leave the printer's default spacing.
const LINE_SPACING  = parseInt(process.env.LINE_SPACING || '24', 10)
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
// ESC ! cap of 2×, so Chinese can be printed genuinely large. Also sets the line
// spacing (ESC 3) to match the height, so tall lines never overlap the next one.
const szCmd = (w, h) => Buffer.concat([
  Buffer.from([0x1d, 0x21, (((w - 1) & 7) << 4) | ((h - 1) & 7)]),
  LINE_SPACING > 0 ? Buffer.from([0x1b, 0x33, Math.min(255, LINE_SPACING * h)]) : Buffer.from([0x1b, 0x32]),
])
const CMD_NORMAL_SIZE   = szCmd(1, 1)
const CMD_DOUBLE_SIZE   = szCmd(2, 2)  // banner + total
const CMD_ZH_SIZE       = szCmd(ZH_W, ZH_H)  // Chinese item names, set-meal lines and notes
const CMD_WIDE_SIZE     = szCmd(2, 1)  // total — wide but single height
const CMD_BOLD_ON       = Buffer.from([0x1b, 0x45, 0x01])
const CMD_BOLD_OFF      = Buffer.from([0x1b, 0x45, 0x00])
const CMD_INVERT_ON     = Buffer.from([0x1d, 0x42, 0x01])  // white on black
const CMD_INVERT_OFF    = Buffer.from([0x1d, 0x42, 0x00])
const CMD_UNDERLINE_ON  = Buffer.from([0x1b, 0x2d, 0x01])
const CMD_UNDERLINE_OFF = Buffer.from([0x1b, 0x2d, 0x00])
const CMD_CUT           = Buffer.from([0x1d, 0x56, 0x42, 0x00])  // feed just far enough to reach the cutter, then partial cut
const CMD_LF            = Buffer.from([0x0a])
const CMD_CHINESE_ON    = Buffer.from([0x1c, 0x26])  // FS & — enter Chinese (GB2312) mode
const CMD_CHINESE_OFF   = Buffer.from([0x1c, 0x2e])  // FS . — exit Chinese mode

// Divider printed as a tiny raster image (GS v 0): a solid line a few dots tall
// instead of a full 24-dot text line of dashes, so it uses ~1/3 of the paper.
const RULE_BYTES = LINE_WIDTH * 12 / 8   // 32 chars × 12 dots = 384 dots wide
function ruleCmd(thick, pad = 3) {
  const rows = pad + thick + pad
  const data = Buffer.alloc(RULE_BYTES * rows, 0)
  data.fill(0xff, RULE_BYTES * pad, RULE_BYTES * (pad + thick))
  return Buffer.concat([Buffer.from([0x1d, 0x76, 0x30, 0x00, RULE_BYTES & 0xff, RULE_BYTES >> 8, rows & 0xff, rows >> 8]), data])
}
const CMD_RULE          = ruleCmd(2)  // thin divider (was a line of ----)
const CMD_RULE_HEAVY    = ruleCmd(4)  // thick divider (was a line of ====)

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
function etaTime(ts, isDelivery) {
  const fmt = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const at  = mins => fmt(new Date(ts.getTime() + mins * 60000))
  return isDelivery ? `${at(40)}-${at(60)}` : at(20)
}

// ─── Note helpers ────────────────────────────────────────────────────────────
const ZH_TO_EN = {
  '不加辣': 'No Chilli',    '不加蒜': 'No Garlic',      '不加洋葱': 'No Onions',
  '不加葱': 'No Spring Onion', '不加蔬菜': 'No Vegetables', '不加蘑菇': 'No Mushrooms',
  '不加糖': 'No Sugar',     '不加味精': 'No MSG',       '不加盐': 'No Salt',
  '不加蛋': 'No Egg',       '不加猪肉': 'No Pork',      '多加酱': 'Extra Sauce',
  '不加酱': 'No Sauce',     '加酱':   'Add Sauce',     '多加酱': 'Extra Sauce',
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
// Banquet/offer breakdowns on paper: drop the English lines, and pull each
// section header onto the same line as its first dish ("主菜:" + "  咕噜鸡" ->
// "主菜: 咕噜鸡"). Divider rules are kept.
function compactDetails(details) {
  const out = []
  details.forEach(d => {
    if (!d.rule && !d.big) return
    const prev = out[out.length - 1]
    if (prev?.header && !prev.rest && !d.header && !d.rule) prev.rest = ` ${d.text.trim()}`
    else out.push({ ...d })
  })
  return out
}

function buildReceiptBuffers(job) {
  const { items, total, tableNumber, discount, deliveryFee, orderId, timestamp,
          orderMode, deliveryInfo, phone, customerName, lang = 'en' } = job
  const ts = timestamp ? new Date(timestamp) : new Date()
  const dateStr = ts.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const isDelivery = orderMode === 'delivery'

  const chunks = []

  // Init + center
  chunks.push(CMD_INIT, CMD_NORMAL_SIZE)
  if (USE_GB2312) chunks.push(CMD_CHINESE_ON)   // enable Chinese font mode on GB2312 printers
  chunks.push(CMD_ALIGN_CENTER)

  // Banner — at the very top, bold + double size: 自取/外送 + ready/delivery time.
  // Drop the space if needed so the delivery window never wraps (16 cols at 2× width).
  const banner = `${isDelivery ? '外送' : '自取'} ${etaTime(ts, isDelivery)}`
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  chunks.push(encodeText((colWidth(banner) * 2 < LINE_WIDTH ? banner : banner.replace(' ', '')) + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

  // Date + order time
  chunks.push(encodeText(`${dateStr} ${timeStr}\n`))
  if (tableNumber) chunks.push(encodeText(`Table: ${tableNumber}\n`))

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

  chunks.push(CMD_ALIGN_LEFT, CMD_RULE_HEAVY)

  // Items — flat bilingual list, exactly mirroring the on-screen preview:
  // Chinese name (double height) + "×qty", price right-aligned; English name
  // beneath in normal size with "×qty"; then any set-meal breakdown.
  ;(items || []).forEach(item => {
    const price  = formatPrice((item.price + (item.notePrice || 0)) * item.quantity)
    const zhName = item.nameZh || item.nameEn
    const qty    = item.peopleQty ?? item.quantity   // set-menus show "×people"
    // Banquets + special offer print Chinese only, compacted (see compactDetails).
    // To bring the English back, comment out the line below and uncomment the one after it.
    const zhOnly = item.isOfferItem
    // const zhOnly = false

    // Item title — a PURE Chinese-size line, so it prints at exactly the same
    // size as the 汤:/主菜: lines and notes. (Putting the normal-size price on
    // the same line made the printer condense/"squish" the title.)
    chunks.push(CMD_ZH_SIZE, encodeText(`${qty}× ${zhName}\n`), CMD_NORMAL_SIZE)

    // English name + price on a normal-size line; price always right-aligned on
    // the SAME line as the English text, however long the name is (min 1 space).
    const en = zhOnly ? '' : `  ${qty}× ${item.nameEn}`
    const gap = Math.max(1, LINE_WIDTH - colWidth(en) - colWidth(price))
    chunks.push(encodeText(en + ' '.repeat(gap) + price + '\n'))

    // Set-meal breakdown: big Chinese block, compact English block, with
    // horizontal rules and underlined headers (no blank lines, to save paper).
    if (Array.isArray(item.details)) {
      ;(zhOnly ? compactDetails(item.details) : item.details).forEach(d => {
        if (d.rule) { chunks.push(CMD_RULE); return }
        const u = d.header
        if (d.big) chunks.push(CMD_ZH_SIZE, ...(u ? [CMD_UNDERLINE_ON] : []), encodeText(d.text), ...(u ? [CMD_UNDERLINE_OFF] : []), encodeText(`${d.rest || ''}\n`), CMD_NORMAL_SIZE)
        else       chunks.push(...(u ? [CMD_UNDERLINE_ON] : []), encodeText(`  ${d.text}\n`), ...(u ? [CMD_UNDERLINE_OFF] : []))
      })
    }

    if (item.note) {
      parseNoteLines(item.note).forEach(({ prefix, zh, en }) => {
        // Share Box drinks are English-only — print them small, like the other English lines
        if (item.isShareBox) { chunks.push(encodeText(`  ${prefix} ${en}\n`)); return }
        chunks.push(CMD_ZH_SIZE, encodeText(`${prefix} ${zh}\n`), CMD_NORMAL_SIZE)
        if (en !== zh && !zhOnly) chunks.push(encodeText(`  ${prefix} ${en}\n`))
      })
    }
  })

  chunks.push(CMD_RULE)

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

  // Total — bold, double width only (half the paper of full double size)
  chunks.push(CMD_BOLD_ON, CMD_WIDE_SIZE)
  const totalStr = formatPrice(total)
  chunks.push(encodeText(pad('TOTAL:', LINE_WIDTH / 2 - totalStr.length) + totalStr + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

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
  chunks.push(CMD_INIT, CMD_NORMAL_SIZE, CMD_ALIGN_CENTER)
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

  chunks.push(CMD_CUT)

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

// ─── Job processing ───────────────────────────────────────────────────────────
let processing = false
let pollAgain  = false

async function poll() {
  // A wake-up that arrives mid-print triggers another pass once we're done
  if (processing) { pollAgain = true; return }
  processing = true

  try {
    do {
      pollAgain = false
      const jobs = await fetchPendingJobs()
      if (jobs.length === 0) continue

      console.log(`[POLL] ${jobs.length} pending job(s) found`)

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
    } while (pollAgain)
  } catch (err) {
    if (!err.message.includes('ECONNREFUSED')) {
      console.error('[POLL ERROR]', err.message)
    }
  } finally {
    processing = false
  }
}

// ─── Push listener (ntfy.sh) ──────────────────────────────────────────────────
// Holds one long-lived streaming connection to ntfy. The web app publishes to
// the topic after queueing a job, and we only call Netlify when that happens.
const STALL_MS = 2 * 60 * 1000  // ntfy sends keepalives every ~45s; reconnect if silent this long

async function listen() {
  let retryMs = 1000

  while (true) {
    const controller = new AbortController()
    let stallTimer
    const resetStall = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => controller.abort(), STALL_MS)
    }

    try {
      resetStall()
      const res = await fetch(`${NTFY_URL}/${NTFY_TOPIC}/json`, { signal: controller.signal })
      if (!res.ok) throw new Error(`ntfy returned ${res.status}`)

      let buf = ''
      for await (const chunk of res.body) {
        resetStall()
        buf += chunk.toString()
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue

          let msg
          try { msg = JSON.parse(line) } catch { continue }

          if (msg.event === 'open') {
            console.log('[PUSH] Connected — waiting for jobs')
            retryMs = 1000
            poll()  // catch anything queued while we were disconnected
          } else if (msg.event === 'message') {
            console.log(`[PUSH] Wake-up received (${msg.message})`)
            poll()
          }
        }
      }
      throw new Error('stream closed')
    } catch (err) {
      console.error('[PUSH] Disconnected:', controller.signal.aborted ? 'no keepalive' : err.message)
    } finally {
      clearTimeout(stallTimer)
    }

    await new Promise(r => setTimeout(r, retryMs))
    retryMs = Math.min(retryMs * 2, 60000)
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log('===========================================')
console.log('  Fortune House Printer Bridge — Starting')
console.log(`  API:      ${API_BASE}`)
console.log(`  Printer:  ${PRINTER_IFACE}`)
console.log(`  Encoding: ${USE_GB2312 ? 'GB2312' : 'UTF-8'}`)
console.log(`  Copies:   takeaway ${TAKEAWAY_COPIES}, delivery ${DELIVERY_COPIES}`)
console.log(`  Chinese:  ${ZH_W}x${ZH_H}, line spacing ${LINE_SPACING || 'printer default'}`)
console.log(`  Push:     ${NTFY_URL}/${NTFY_TOPIC}`)
console.log(`  Fallback: ${FALLBACK_POLL_MS ? `poll every ${Math.round(FALLBACK_POLL_MS / 60000)} min` : 'off'}`)
console.log('===========================================')

// Listener polls once on connect, then only on wake-ups (plus the rare safety net)
listen()
if (FALLBACK_POLL_MS > 0) setInterval(poll, FALLBACK_POLL_MS)
