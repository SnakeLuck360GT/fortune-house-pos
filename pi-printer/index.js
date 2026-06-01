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
const LINE_WIDTH    = 32

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
const CMD_DOUBLE_SIZE   = Buffer.from([0x1b, 0x21, 0x30])  // double width + height
const CMD_NORMAL_SIZE   = Buffer.from([0x1b, 0x21, 0x00])
const CMD_BOLD_ON       = Buffer.from([0x1b, 0x45, 0x01])
const CMD_BOLD_OFF      = Buffer.from([0x1b, 0x45, 0x00])
const CMD_CUT           = Buffer.from([0x1d, 0x56, 0x41, 0x00])  // partial cut
const CMD_LF            = Buffer.from([0x0a])

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
  return `\xa3${Number(p).toFixed(2)}`  // £ sign
}

function getItemName(item, lang) {
  if (lang === 'zh') return item.nameZh || item.nameEn
  return item.nameEn
}

// ─── Receipt builder ─────────────────────────────────────────────────────────
function buildReceiptBuffers(job) {
  const { items, total, tableNumber, discount, orderId, timestamp, lang = 'en' } = job
  const ts = timestamp ? new Date(timestamp) : new Date()
  const dateStr = ts.toLocaleDateString('en-GB')
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const chunks = []

  // Init + center
  chunks.push(CMD_INIT)
  chunks.push(CMD_ALIGN_CENTER)

  // Restaurant name — double size
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  chunks.push(encodeText('Fortune House\n'))
  chunks.push(CMD_NORMAL_SIZE)
  chunks.push(CMD_DOUBLE_SIZE)
  chunks.push(encodeText('福运楼\n'))  // 福运楼
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

  chunks.push(encodeText(`${dateStr}  ${timeStr}\n`))
  if (tableNumber) chunks.push(encodeText(`Table: ${tableNumber}\n`))
  if (orderId)     chunks.push(encodeText(`Order: ${orderId}\n`))

  chunks.push(encodeText('================================\n\n'))
  chunks.push(CMD_ALIGN_LEFT)

  // Group items by category
  const groups = {}
  ;(items || []).forEach(item => {
    const key = item.category || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })

  for (const [category, catItems] of Object.entries(groups)) {
    chunks.push(CMD_BOLD_ON)
    chunks.push(encodeText(category.toUpperCase() + '\n'))
    chunks.push(CMD_BOLD_OFF)
    chunks.push(encodeText('--------------------------------\n'))

    catItems.forEach(item => {
      const name     = getItemName(item, lang)
      const priceStr = formatPrice(item.price * item.quantity)

      if (lang === 'zh' && item.nameZh) {
        // Chinese name at double size
        chunks.push(CMD_DOUBLE_SIZE)
        const left = pad(name.slice(0, 10) + '  x' + item.quantity, 14)
        chunks.push(encodeText(left + '  ' + priceStr + '\n'))
        chunks.push(CMD_NORMAL_SIZE)
      } else {
        // English name at normal+bold
        chunks.push(CMD_BOLD_ON)
        const left = pad(`${name}  x${item.quantity}`, LINE_WIDTH - priceStr.length)
        chunks.push(encodeText(left + priceStr + '\n'))
        chunks.push(CMD_BOLD_OFF)
      }

      if (item.note) {
        chunks.push(CMD_DOUBLE_SIZE)
        chunks.push(encodeText(`${item.note}\n`))
        chunks.push(CMD_NORMAL_SIZE)
      }
    })

    chunks.push(lf(1))
  }

  chunks.push(encodeText('--------------------------------\n'))

  // Discount line
  if (discount && Number(discount) > 0) {
    const subtotal = (items || []).reduce((s, i) => s + i.price * i.quantity, 0)
    chunks.push(CMD_BOLD_ON)
    chunks.push(encodeText(pad('SUBTOTAL:', 20) + formatPrice(subtotal) + '\n'))
    chunks.push(encodeText(pad('DISCOUNT:', 20) + `-${formatPrice(discount)}` + '\n'))
    chunks.push(CMD_BOLD_OFF)
  }

  // Total — double size
  chunks.push(CMD_BOLD_ON, CMD_DOUBLE_SIZE)
  const totalStr = formatPrice(total)
  chunks.push(encodeText(pad('TOTAL:', 12) + totalStr + '\n'))
  chunks.push(CMD_NORMAL_SIZE, CMD_BOLD_OFF)

  chunks.push(encodeText('================================\n'))
  chunks.push(CMD_ALIGN_CENTER)
  chunks.push(encodeText('** Thank you / '))
  chunks.push(encodeText('谢谢惠顾'))  // 谢谢惠顾
  chunks.push(encodeText(' **\n'))
  chunks.push(encodeText('================================\n'))

  chunks.push(lf(4))
  chunks.push(CMD_CUT)

  return Buffer.concat(chunks)
}

// ─── Print job ───────────────────────────────────────────────────────────────
async function printJob(job) {
  console.log(`[PRINT] Printing job ${job.jobId} (lang: ${job.lang || 'en'})…`)

  const printer = createPrinter()

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) {
    throw new Error(`Printer not connected at ${PRINTER_IFACE}`)
  }

  const buffer = buildReceiptBuffers({ ...job, lang: job.lang || 'en' })

  // Use raw buffer mode — write directly to the printer interface
  const fs = require('fs')
  const fd = fs.openSync(PRINTER_IFACE, 'w')
  fs.writeSync(fd, buffer)
  fs.closeSync(fd)

  console.log(`[PRINT] Job ${job.jobId} printed successfully (${buffer.length} bytes)`)
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
console.log(`  Poll:     every ${POLL_MS}ms`)
console.log('===========================================')

// Initial poll, then interval
poll()
setInterval(poll, POLL_MS)
