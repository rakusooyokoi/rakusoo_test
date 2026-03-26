'use client'

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

// ============================================================
// Font loader (NotoSansJP) — cached globally
// ============================================================
let fontBase64Cache: string | null = null

async function loadFont(doc: jsPDF) {
  if (!fontBase64Cache) {
    const res = await fetch('/NotoSansJP-Regular.ttf')
    if (!res.ok) throw new Error('フォント読み込み失敗')
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    fontBase64Cache = btoa(bin)
  }
  doc.addFileToVFS('NotoSansJP.ttf', fontBase64Cache)
  doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal')
  doc.setFont('NotoSansJP')
}

// ============================================================
// PDF generators (inline — same logic as Vue version)
// ============================================================
function fmt(n: number | string | undefined | null) {
  return Number(n || 0).toLocaleString()
}

interface Company {
  name: string; address: string; tel: string; fax: string; bank: string; registration_no: string
}

async function generateInvoicePdf(data: {
  shipper: any; items: any[]; summary: any; year: number; month: number; company: Company
}) {
  const { shipper, items, summary, year, month, company } = data
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await loadFont(doc)
  const W = 210

  if (company.registration_no) {
    doc.setFontSize(7); doc.setTextColor(150, 150, 150)
    doc.text(`登録番号: ${company.registration_no}`, W - 15, 8, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  doc.setFontSize(20)
  doc.text('請 求 書', W / 2, 14, { align: 'center' })

  doc.setFontSize(9)
  const now = new Date()
  const issueDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  doc.text(`発行日: ${issueDate}`, W - 15, 20, { align: 'right' })
  const closingLabel = shipper.closing_day === 99 ? '末日' : shipper.closing_day + '日'
  doc.text(`${year}年${month}月${closingLabel}締分`, W - 15, 26, { align: 'right' })

  let y = 23
  doc.setFontSize(14)
  doc.text(`${shipper.name} 様`, 23, y); y += 6
  if (shipper.name2) { doc.setFontSize(11); doc.text(shipper.name2, 23, y); y += 5 }
  doc.setFontSize(9)
  if (shipper.postal_code) { doc.text(`〒${shipper.postal_code}`, 23, y); y += 5 }
  const addr = [shipper.prefecture, shipper.city, shipper.address1].filter(Boolean).join('')
  if (addr) { doc.text(addr, 23, y); y += 5 }
  if (shipper.address2) { doc.text(shipper.address2, 23, y); y += 5 }
  if (shipper.phone || shipper.fax) {
    doc.setFontSize(8)
    let tf = ''
    if (shipper.phone) tf += `TEL: ${shipper.phone}`
    if (shipper.fax) tf += `  FAX: ${shipper.fax}`
    doc.text(tf, 23, y); y += 5
  }
  doc.setFontSize(8); doc.setTextColor(150, 150, 150)
  doc.text(`お客様コード: ${shipper.code || ''}`, 23, y)
  doc.setTextColor(0, 0, 0)

  const ir = W - 15
  let iy = 34
  doc.setFontSize(11); doc.text(company.name, ir, iy, { align: 'right' }); iy += 6
  doc.setFontSize(9)
  if (company.address) { doc.text(company.address, ir, iy, { align: 'right' }); iy += 5 }
  if (company.tel) { doc.text(`TEL: ${company.tel}`, ir, iy, { align: 'right' }); iy += 5 }
  if (company.fax) { doc.text(`FAX: ${company.fax}`, ir, iy, { align: 'right' }); iy += 5 }
  if (company.bank) {
    doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text(`振込先: ${company.bank}`, ir, iy, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  const boxY = 64
  doc.setFillColor(242, 242, 242)
  doc.roundedRect(20, boxY, 90, 14, 2, 2, 'F')
  doc.setFontSize(9); doc.text('今回御請求額', 25, boxY + 9)
  doc.setFontSize(16); doc.text(`¥${fmt(summary.total)}-`, 105, boxY + 9.5, { align: 'right' })

  const sy = 86
  doc.setFontSize(8); doc.setTextColor(150, 150, 150)
  doc.text('【税区分内訳】', 20, sy)
  doc.setTextColor(0, 0, 0); doc.setFontSize(9)

  const hwExTax = Math.floor(summary.highway / 1.1)
  const hwTaxAmount = summary.highway - hwExTax

  let ry = sy + 6
  doc.text('売上高(税抜10%)', 20, ry); doc.text(`¥${fmt(summary.subtotal)}`, 72, ry, { align: 'right' })
  doc.text('高速代等(税抜)', 110, ry); doc.text(`¥${fmt(hwExTax)}`, 172, ry, { align: 'right' })
  ry += 5
  doc.text('消費税(10%)', 20, ry); doc.text(`¥${fmt(summary.tax)}`, 72, ry, { align: 'right' })
  doc.text('高速代等(税)', 110, ry); doc.text(`¥${fmt(hwTaxAmount)}`, 172, ry, { align: 'right' })
  ry += 5
  doc.text('売上高(税抜8%)', 20, ry); doc.text('¥0', 72, ry, { align: 'right' })
  doc.text('非課税・不課税', 110, ry); doc.text('¥0', 172, ry, { align: 'right' })
  ry += 5
  doc.text('消費税(8%)', 20, ry); doc.text('¥0', 72, ry, { align: 'right' })

  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
  doc.line(20, ry + 3, 190, ry + 3)

  const tableY = ry + 9
  const rowH = 7
  const col = { nameL: 20, priceR: 113, countR: 133, amountR: 163, hwR: 190 }
  doc.setFillColor(240, 240, 240); doc.rect(20, tableY, 172, rowH, 'F')
  doc.setFontSize(8)
  doc.text('品名', 22, tableY + 5)
  doc.text('単価', col.priceR, tableY + 5, { align: 'right' })
  doc.text('数量', col.countR, tableY + 5, { align: 'right' })
  doc.text('金額', col.amountR, tableY + 5, { align: 'right' })
  doc.text('高速代等', col.hwR, tableY + 5, { align: 'right' })

  let ty = tableY + rowH
  doc.setFontSize(9)
  for (const item of items) {
    if (ty > 260) break
    doc.text(item.caseName, 22, ty + 5)
    doc.text(fmt(item.unitPrice), col.priceR, ty + 5, { align: 'right' })
    doc.text(String(item.count), col.countR, ty + 5, { align: 'right' })
    doc.text(fmt(item.amount), col.amountR, ty + 5, { align: 'right' })
    doc.text(fmt(item.highway), col.hwR, ty + 5, { align: 'right' })
    doc.setDrawColor(230, 230, 230); doc.line(20, ty + rowH, 192, ty + rowH)
    ty += rowH
  }

  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text('お支払いは締め日翌月末日までにお願いいたします。', W / 2, 285, { align: 'center' })

  const fileName = `${year}年${month}月_${shipper.code || ''}_${shipper.name}_請求書.pdf`
  doc.save(fileName)
}

async function generateAccidentInvoicePdf(data: {
  shipper: any; items: any[]; summary: any; invoiceDate: string; company: Company
}) {
  const { shipper, items, summary, invoiceDate, company } = data
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await loadFont(doc)
  const W = 210

  if (company.registration_no) {
    doc.setFontSize(7); doc.setTextColor(150, 150, 150)
    doc.text(`登録番号: ${company.registration_no}`, W - 15, 8, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  doc.setFontSize(18); doc.text('事故費請求書', W / 2, 14, { align: 'center' })
  doc.setFontSize(9); doc.text(`請求日: ${invoiceDate}`, W - 15, 22, { align: 'right' })

  let y = 25
  doc.setFontSize(14); doc.text(`${shipper.name} 様`, 23, y); y += 6
  if (shipper.name2) { doc.setFontSize(11); doc.text(shipper.name2, 23, y); y += 5 }
  doc.setFontSize(9)
  if (shipper.postal_code) { doc.text(`〒${shipper.postal_code}`, 23, y); y += 5 }
  const addr = [shipper.prefecture, shipper.city, shipper.address1].filter(Boolean).join('')
  if (addr) { doc.text(addr, 23, y); y += 5 }
  if (shipper.address2) { doc.text(shipper.address2, 23, y); y += 5 }

  const ir2 = W - 15
  let iy2 = 32
  doc.setFontSize(11); doc.text(company.name, ir2, iy2, { align: 'right' }); iy2 += 6
  doc.setFontSize(9)
  if (company.address) { doc.text(company.address, ir2, iy2, { align: 'right' }); iy2 += 5 }
  if (company.tel) { doc.text(`TEL: ${company.tel}`, ir2, iy2, { align: 'right' }); iy2 += 5 }
  if (company.bank) {
    doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text(`振込先: ${company.bank}`, ir2, iy2, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  const boxY = 62
  doc.setFillColor(242, 242, 242); doc.roundedRect(20, boxY, 90, 14, 2, 2, 'F')
  doc.setFontSize(9); doc.text('今回御請求額', 25, boxY + 9)
  doc.setFontSize(16); doc.text(`¥${fmt(summary.total)}-`, 105, boxY + 9.5, { align: 'right' })

  const sy = 84
  doc.setFontSize(8); doc.setTextColor(150, 150, 150)
  doc.text('【税区分内訳】', 20, sy)
  doc.setTextColor(0, 0, 0); doc.setFontSize(9)

  const hwExTax = Math.floor(summary.highway / 1.1)
  const hwTaxAmount = summary.highway - hwExTax

  let ry = sy + 6
  doc.text('10%対象(税抜)', 20, ry); doc.text(`¥${fmt(summary.base10)}`, 72, ry, { align: 'right' })
  doc.text('高速代等(税抜)', 110, ry); doc.text(`¥${fmt(hwExTax)}`, 172, ry, { align: 'right' })
  ry += 5
  doc.text('消費税(10%)', 20, ry); doc.text(`¥${fmt(summary.tax10)}`, 72, ry, { align: 'right' })
  doc.text('高速代等(税)', 110, ry); doc.text(`¥${fmt(hwTaxAmount)}`, 172, ry, { align: 'right' })
  ry += 5
  doc.text('8%対象(税抜)', 20, ry); doc.text(`¥${fmt(summary.base8)}`, 72, ry, { align: 'right' })
  doc.text('非課税・不課税', 110, ry); doc.text(`¥${fmt(summary.exempt)}`, 172, ry, { align: 'right' })
  ry += 5
  doc.text('消費税(8%)', 20, ry); doc.text(`¥${fmt(summary.tax8)}`, 72, ry, { align: 'right' })

  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
  doc.line(20, ry + 3, 190, ry + 3)

  const tableY = ry + 9
  const rowH = 7
  const col = { nameL: 20, priceR: 100, countR: 118, amountR: 148, hwR: 172, taxR: 190 }
  doc.setFillColor(240, 240, 240); doc.rect(20, tableY, 172, rowH, 'F')
  doc.setFontSize(8)
  doc.text('名称', 22, tableY + 5)
  doc.text('単価', col.priceR, tableY + 5, { align: 'right' })
  doc.text('数量', col.countR, tableY + 5, { align: 'right' })
  doc.text('金額', col.amountR, tableY + 5, { align: 'right' })
  doc.text('高速代', col.hwR, tableY + 5, { align: 'right' })
  doc.text('税率', col.taxR, tableY + 5, { align: 'right' })

  let ty = tableY + rowH
  doc.setFontSize(9)
  for (const item of items) {
    if (ty > 270) break
    doc.text(item.name || '', 22, ty + 5)
    doc.text(fmt(item.unit_price), col.priceR, ty + 5, { align: 'right' })
    doc.text(String(item.quantity || 0), col.countR, ty + 5, { align: 'right' })
    doc.text(fmt(item.amount), col.amountR, ty + 5, { align: 'right' })
    doc.text(fmt(item.highway_toll), col.hwR, ty + 5, { align: 'right' })
    const taxLabel = item.tax_rate === '10' ? '10%' : item.tax_rate === '8' ? '8%' : '非課税'
    doc.text(taxLabel, col.taxR, ty + 5, { align: 'right' })
    doc.setDrawColor(230, 230, 230); doc.line(20, ty + rowH, 192, ty + rowH)
    ty += rowH
  }

  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text('お支払いは請求日より30日以内にお願いいたします。', W / 2, 285, { align: 'center' })

  const fileName = `事故費請求書_${invoiceDate}_${shipper.name}.pdf`
  doc.save(fileName)
}

// ============================================================
// Types
// ============================================================
interface ShipperItem {
  caseName: string; count: number; unitPrice: number; amount: number; highway: number
}
interface ShipperRow {
  shipperId: string
  shipperName: string; shipperShortName: string; shipperCode: string
  closingDay: number; shipperData: any
  items: ShipperItem[]; subtotal: number; highwayTotal: number
}
interface AccItem {
  name: string; unit_price: string; quantity: number; amount: string; highway_toll: string; tax_rate: string
}

// ============================================================
// Component
// ============================================================
export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<'normal' | 'accident'>('normal')

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [shipperList, setShipperList] = useState<ShipperRow[]>([])
  const [invoices, setInvoices] = useState<Record<string, any>>({})
  const [expandedShippers, setExpandedShippers] = useState<Set<string>>(new Set())
  const [tenantInfo, setTenantInfo] = useState<any>({})

  // 事故費請求
  const [accShippers, setAccShippers] = useState<any[]>([])
  const [accShipperSearch, setAccShipperSearch] = useState('')
  const [accShipperListOpen, setAccShipperListOpen] = useState(false)
  const [accForm, setAccForm] = useState({ shipper_id: '', invoice_date: new Date().toISOString().split('T')[0] })
  const [accItems, setAccItems] = useState<AccItem[]>([])
  const [accHistory, setAccHistory] = useState<any[]>([])
  const [accShowHistory, setAccShowHistory] = useState(true)
  const [accEditId, setAccEditId] = useState<string | null>(null)
  const [accSelectedShipper, setAccSelectedShipper] = useState<any>(null)

  // ---- helpers ----
  const formatNum = (n: number | string | undefined | null) => n ? Number(n).toLocaleString() : '0'
  const formatClosing = (day: number) => day === 99 ? '末日' : day + '日'
  const calcTax = (v: number) => Math.floor(v * 0.1)
  const calcTotal = (s: ShipperRow) => s.subtotal + calcTax(s.subtotal) + s.highwayTotal

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const daysInMonth = new Date(year, month, 0).getDate()

  // ---- computed (useMemo) ----
  const grandSubtotal = useMemo(() => shipperList.reduce((s, r) => s + r.subtotal, 0), [shipperList])
  const grandHighway = useMemo(() => shipperList.reduce((s, r) => s + r.highwayTotal, 0), [shipperList])
  const grandTotal = useMemo(() => shipperList.reduce((s, r) => s + calcTotal(r), 0), [shipperList])

  const accSummary = useMemo(() => {
    let base10 = 0, base8 = 0, exempt = 0, highway = 0
    for (const item of accItems) {
      const amt = Number(item.amount) || 0
      const hw = Number(item.highway_toll) || 0
      highway += hw
      if (item.tax_rate === '10') base10 += amt
      else if (item.tax_rate === '8') base8 += amt
      else exempt += amt
    }
    const tax10 = Math.floor(base10 * 0.1)
    const tax8 = Math.floor(base8 * 0.08)
    const total = base10 + tax10 + base8 + tax8 + exempt + highway
    return { base10, tax10, base8, tax8, exempt, highway, total }
  }, [accItems])

  const accFilteredShippers = useMemo(() => {
    const q = accShipperSearch.toLowerCase()
    return accShippers.filter(s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
  }, [accShippers, accShipperSearch])

  // ---- data loading ----
  const loadTenant = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single()
    if (profile?.tenant_id) {
      const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single()
      setTenantInfo(tenant || {})
    }
  }, [])

  const loadAll = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const dim = new Date(y, m, 0).getDate()
    const startDate = `${ym}-01`
    const endDate = `${ym}-${dim}`

    const [casesRes, salesRes, invRes] = await Promise.all([
      supabase.from('cases').select('id, case_name, shipper_id, unit_price, default_highway_price, shippers(id, code, name, name2, short_name, closing_day, postal_code, prefecture, city, address1, address2, phone, fax)').eq('is_active', true),
      supabase.from('sales').select('*').is('case_vendor_id', null).gte('sale_date', startDate).lte('sale_date', endDate),
      supabase.from('invoices').select('*').eq('year', y).eq('month', m)
    ])

    const invMap: Record<string, any> = {}
    for (const inv of (invRes.data || [])) invMap[inv.shipper_id] = inv
    setInvoices(invMap)

    const casesData = casesRes.data || []
    const salesByCaseId: Record<string, any[]> = {}
    for (const s of (salesRes.data || [])) {
      if (!salesByCaseId[s.case_id]) salesByCaseId[s.case_id] = []
      salesByCaseId[s.case_id].push(s)
    }

    const shipperMap: Record<string, ShipperRow> = {}
    for (const c of casesData) {
      const sid = c.shipper_id || 'none'
      const shipper = (c as any).shippers
      if (!shipperMap[sid]) {
        shipperMap[sid] = {
          shipperId: sid,
          shipperName: shipper?.name || '荷主未設定',
          shipperShortName: shipper?.short_name || '',
          shipperCode: shipper?.code || '',
          closingDay: shipper?.closing_day || 99,
          shipperData: shipper || {},
          items: [], subtotal: 0, highwayTotal: 0
        }
      }
      const row = shipperMap[sid]
      const parentSales = salesByCaseId[c.id] || []
      const count = parentSales.reduce((s, p) => s + (Number(p.quantity) || 0), 0)
      const amount = count * (c.unit_price || 0)
      const highway = parentSales.reduce((s, p) => s + (Number(p.highway_price) || 0), 0)
      if (count > 0) {
        row.items.push({ caseName: c.case_name, count, unitPrice: c.unit_price || 0, amount, highway })
        row.subtotal += amount
        row.highwayTotal += highway
      }
    }

    const list = Object.values(shipperMap)
      .filter(s => s.items.length > 0)
      .sort((a, b) => a.shipperCode.localeCompare(b.shipperCode))
    setShipperList(list)
    setLoading(false)
  }, [])

  const accLoadShippers = useCallback(async () => {
    const { data } = await supabase.from('shippers').select('id, code, name, short_name, name2, postal_code, prefecture, city, address1, address2, phone, fax').eq('is_active', true).order('code')
    setAccShippers(data || [])
  }, [])

  const accLoadHistory = useCallback(async () => {
    const { data } = await supabase.from('accident_invoices').select('*, shippers(code, name, short_name)').order('created_at', { ascending: false }).limit(50)
    setAccHistory(data || [])
  }, [])

  useEffect(() => {
    loadAll(year, month)
    accLoadShippers()
    accLoadHistory()
    loadTenant()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- normal invoice actions ----
  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
    loadAll(y, m)
  }

  function toggleExpand(id: string) {
    setExpandedShippers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getInvoice(shipperId: string) { return invoices[shipperId] || null }

  async function saveInvoiceRecord(shipper: ShipperRow) {
    const tax = calcTax(shipper.subtotal)
    const total = shipper.subtotal + tax + shipper.highwayTotal
    const payload = {
      shipper_id: shipper.shipperId === 'none' ? null : shipper.shipperId,
      year, month,
      closing_day: shipper.closingDay,
      subtotal: shipper.subtotal,
      highway_total: shipper.highwayTotal,
      tax_amount: tax, highway_tax: 0,
      total_amount: total, grand_total: total,
      status: 'issued',
      issued_date: new Date().toISOString().split('T')[0],
      items: shipper.items,
      year_month: yearMonth
    }
    const existing = invoices[shipper.shipperId]
    if (existing) {
      await supabase.from('invoices').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('invoices').insert(payload)
    }
  }

  async function downloadPdf(shipper: ShipperRow) {
    const s = shipper.shipperData
    const tax = calcTax(shipper.subtotal)
    await generateInvoicePdf({
      shipper: {
        name: s.name || shipper.shipperName, name2: s.name2 || '', code: s.code || shipper.shipperCode,
        closing_day: s.closing_day || 99, postal_code: s.postal_code || '',
        prefecture: s.prefecture || '', city: s.city || '',
        address1: s.address1 || '', address2: s.address2 || '',
        phone: s.phone || '', fax: s.fax || ''
      },
      items: shipper.items,
      summary: { subtotal: shipper.subtotal, tax, highway: shipper.highwayTotal, hwTax: 0, total: shipper.subtotal + tax + shipper.highwayTotal },
      year, month,
      company: {
        name: tenantInfo.company_name || '', address: tenantInfo.address || '',
        tel: tenantInfo.phone || '', fax: tenantInfo.fax || '',
        bank: tenantInfo.bank_info || '', registration_no: tenantInfo.registration_no || ''
      }
    })
    await saveInvoiceRecord(shipper)
    await loadAll(year, month)
  }

  // ---- 事故費請求 actions ----
  function accAddItem() {
    setAccItems(prev => [...prev, { name: '', unit_price: '', quantity: 1, amount: '', highway_toll: '', tax_rate: '10' }])
  }

  function accCalcItem(idx: number) {
    setAccItems(prev => {
      const next = [...prev]
      const item = { ...next[idx] }
      const p = Number(item.unit_price) || 0
      const q = Number(item.quantity) || 0
      item.amount = String(p * q)
      next[idx] = item
      return next
    })
  }

  function accUpdateItem(idx: number, field: keyof AccItem, value: string | number) {
    setAccItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function accRemoveItem(idx: number) {
    setAccItems(prev => prev.filter((_, i) => i !== idx))
  }

  function accSelectShipper(s: any) {
    setAccForm(prev => ({ ...prev, shipper_id: s.id }))
    setAccSelectedShipper(s)
    setAccShipperSearch(`${s.code} ${s.short_name || s.name}`)
    setAccShipperListOpen(false)
  }

  function accLoadFromHistory(h: any) {
    setAccEditId(h.id)
    setAccForm({ shipper_id: h.shipper_id, invoice_date: h.invoice_date })
    setAccItems(JSON.parse(JSON.stringify(h.items || [])))
    const s = accShippers.find(s => s.id === h.shipper_id)
    if (s) {
      setAccSelectedShipper(s)
      setAccShipperSearch(`${s.code} ${s.short_name || s.name}`)
    }
    setAccShowHistory(false)
  }

  function accResetForm() {
    setAccEditId(null)
    setAccForm({ shipper_id: '', invoice_date: new Date().toISOString().split('T')[0] })
    setAccItems([])
    setAccSelectedShipper(null)
    setAccShipperSearch('')
  }

  async function accSaveAndPdf() {
    if (!accSelectedShipper || accItems.length === 0) return
    const s = accSummary
    const payload = {
      shipper_id: accForm.shipper_id || null,
      invoice_date: accForm.invoice_date,
      items: accItems,
      tax_10: s.tax10, tax_8: s.tax8, tax_exempt: s.exempt,
      highway_total: s.highway, total_amount: s.total
    }
    if (accEditId) {
      await supabase.from('accident_invoices').update(payload).eq('id', accEditId)
    } else {
      const { data } = await supabase.from('accident_invoices').insert(payload).select('id').single()
      if (data) setAccEditId(data.id)
    }
    await accLoadHistory()

    const sh = accSelectedShipper
    await generateAccidentInvoicePdf({
      shipper: {
        name: sh.name, name2: sh.name2 || '', postal_code: sh.postal_code || '',
        prefecture: sh.prefecture || '', city: sh.city || '',
        address1: sh.address1 || '', address2: sh.address2 || ''
      },
      items: accItems,
      summary: s,
      invoiceDate: accForm.invoice_date,
      company: {
        name: tenantInfo.company_name || '', address: tenantInfo.address || '',
        tel: tenantInfo.phone || '', fax: tenantInfo.fax || '',
        bank: tenantInfo.bank_info || '', registration_no: tenantInfo.registration_no || ''
      }
    })
  }

  async function accDelete(h: any) {
    if (!confirm('削除しますか？')) return
    await supabase.from('accident_invoices').delete().eq('id', h.id)
    await accLoadHistory()
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div>
      {/* タブ切替 */}
      <div className="flex gap-1 mb-4 border-b">
        <button onClick={() => setActiveTab('normal')}
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'normal' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-400'}`}>
          通常請求
        </button>
        <button onClick={() => setActiveTab('accident')}
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'accident' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-400'}`}>
          事故費請求
        </button>
      </div>

      {/* ===== 通常請求 ===== */}
      {activeTab === 'normal' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">◀</button>
              <span className="text-lg font-bold text-gray-800">{year}年{month}月 請求書発行</span>
              <button onClick={() => changeMonth(1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">▶</button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg border p-3">
              <div className="text-xs text-gray-500">売上(税抜)</div>
              <div className="text-lg font-bold text-blue-700">{formatNum(grandSubtotal)}</div>
            </div>
            <div className="bg-white rounded-lg border p-3">
              <div className="text-xs text-gray-500">高速代</div>
              <div className="text-lg font-bold text-gray-700">{formatNum(grandHighway)}</div>
            </div>
            <div className="bg-white rounded-lg border p-3">
              <div className="text-xs text-gray-500">請求総額(税込)</div>
              <div className="text-lg font-bold text-green-700">{formatNum(grandTotal)}</div>
            </div>
            <div className="bg-white rounded-lg border p-3">
              <div className="text-xs text-gray-500">荷主数</div>
              <div className="text-lg font-bold text-gray-800">{shipperList.length}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600">荷主</th>
                  <th className="px-4 py-3 text-left text-gray-600">締め日</th>
                  <th className="px-4 py-3 text-right text-gray-600">売上(税抜)</th>
                  <th className="px-4 py-3 text-right text-gray-600">消費税</th>
                  <th className="px-4 py-3 text-right text-gray-600">高速代(税込)</th>
                  <th className="px-4 py-3 text-right text-green-700 bg-green-50">請求額</th>
                  <th className="px-4 py-3 text-center text-gray-600">発行日</th>
                  <th className="px-4 py-3 text-center text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {shipperList.map(s => (
                  <Fragment key={s.shipperId}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium cursor-pointer" onClick={() => toggleExpand(s.shipperId)}>
                        <span className="text-gray-400 text-xs mr-1">{expandedShippers.has(s.shipperId) ? '▼' : '▶'}</span>
                        {s.shipperCode && <span className="text-gray-400 text-xs mr-1">{s.shipperCode}</span>}
                        {s.shipperShortName || s.shipperName}
                        <span className="text-xs text-gray-400 ml-1">({s.items.length}件)</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{formatClosing(s.closingDay)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{formatNum(s.subtotal)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{formatNum(calcTax(s.subtotal))}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatNum(s.highwayTotal)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-700 bg-green-50">{formatNum(calcTotal(s))}</td>
                      <td className="px-4 py-2.5 text-center text-xs">
                        {getInvoice(s.shipperId)?.issued_date
                          ? <span className="text-green-700">{getInvoice(s.shipperId).issued_date}</span>
                          : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => downloadPdf(s)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                          PDF発行
                        </button>
                      </td>
                    </tr>
                    {expandedShippers.has(s.shipperId) && s.items.map((item, idx) => (
                      <tr key={idx} className="border-b bg-gray-50">
                        <td className="px-4 py-1.5 pl-10 text-xs text-gray-500" colSpan={2}>{item.caseName}</td>
                        <td className="px-4 py-1.5 text-right text-xs">
                          {item.count}回 × {formatNum(item.unitPrice)} = {formatNum(item.amount)}
                        </td>
                        <td className="px-4 py-1.5"></td>
                        <td className="px-4 py-1.5 text-right text-xs text-gray-500">{formatNum(item.highway)}</td>
                        <td className="px-4 py-1.5" colSpan={3}></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {shipperList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">売上データがありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 事故費請求 ===== */}
      {activeTab === 'accident' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800">事故費請求書</h2>
              {!accShowHistory && (
                <span className={`text-xs px-2 py-0.5 rounded ${accEditId ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {accEditId ? '編集中' : '新規作成'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!accShowHistory && (
                <button onClick={() => { setAccShowHistory(true); accResetForm() }} className="text-xs px-3 py-1 border rounded hover:bg-gray-50">一覧に戻る</button>
              )}
              {accShowHistory && (
                <button onClick={() => { accResetForm(); setAccShowHistory(false) }} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">新規作成</button>
              )}
            </div>
          </div>

          {/* 発行履歴 */}
          {accShowHistory && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600">請求日</th>
                    <th className="px-4 py-3 text-left text-gray-600">荷主</th>
                    <th className="px-4 py-3 text-right text-gray-600">請求合計</th>
                    <th className="px-4 py-3 text-center text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accHistory.map(h => (
                    <tr key={h.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => accLoadFromHistory(h)}>
                      <td className="px-4 py-2">{h.invoice_date}</td>
                      <td className="px-4 py-2">{h.shippers?.short_name || h.shippers?.name || '-'}</td>
                      <td className="px-4 py-2 text-right font-bold text-orange-600">{formatNum(h.total_amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={(e) => { e.stopPropagation(); accDelete(h) }} className="text-red-500 hover:underline text-xs">削除</button>
                      </td>
                    </tr>
                  ))}
                  {accHistory.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">履歴なし</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 入力フォーム */}
          {!accShowHistory && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-4">
                {/* 請求先 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">請求先</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="block text-xs text-gray-500 mb-1">荷主</label>
                      <input
                        value={accShipperSearch}
                        onChange={e => { setAccShipperSearch(e.target.value); setAccShipperListOpen(true) }}
                        onFocus={() => setAccShipperListOpen(true)}
                        placeholder="CD or 荷主名で検索"
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                      {accShipperListOpen && accFilteredShippers.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                          {accFilteredShippers.map(s => (
                            <div key={s.id} onMouseDown={(e) => { e.preventDefault(); accSelectShipper(s) }}
                              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                              {s.code} {s.short_name || s.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">請求日</label>
                      <input
                        value={accForm.invoice_date}
                        onChange={e => setAccForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                        type="date"
                        className="w-full border rounded px-2 py-1.5 text-sm cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 明細 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-700">明細</h3>
                    <button onClick={accAddItem} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">行追加</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b text-xs">
                        <th className="text-left py-2 px-1">名称</th>
                        <th className="text-right py-2 px-1 w-24">単価</th>
                        <th className="text-right py-2 px-1 w-16">数量</th>
                        <th className="text-right py-2 px-1 w-24">金額</th>
                        <th className="text-right py-2 px-1 w-24">高速代</th>
                        <th className="text-center py-2 px-1 w-20">税率</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {accItems.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-1 px-1">
                            <input value={item.name} onChange={e => accUpdateItem(i, 'name', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                          </td>
                          <td className="py-1 px-1">
                            <input value={item.unit_price} onChange={e => accUpdateItem(i, 'unit_price', e.target.value)} onBlur={() => accCalcItem(i)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1 text-sm text-right" />
                          </td>
                          <td className="py-1 px-1">
                            <input value={item.quantity} onChange={e => accUpdateItem(i, 'quantity', e.target.value)} onBlur={() => accCalcItem(i)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1 text-sm text-right" />
                          </td>
                          <td className="py-1 px-1">
                            <input value={item.amount} onChange={e => accUpdateItem(i, 'amount', e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1 text-sm text-right" />
                          </td>
                          <td className="py-1 px-1">
                            <input value={item.highway_toll} onChange={e => accUpdateItem(i, 'highway_toll', e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1 text-sm text-right" />
                          </td>
                          <td className="py-1 px-1">
                            <select value={item.tax_rate} onChange={e => accUpdateItem(i, 'tax_rate', e.target.value)} className="w-full border rounded px-1 py-1 text-xs">
                              <option value="10">10%</option>
                              <option value="8">8%</option>
                              <option value="0">非課税</option>
                            </select>
                          </td>
                          <td className="py-1 px-1 text-center">
                            <button onClick={() => accRemoveItem(i)} className="text-red-500 text-xs">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {accItems.length === 0 && (
                    <div className="text-gray-400 text-sm py-4 text-center">「行追加」で明細を追加してください</div>
                  )}
                </div>
              </div>

              {/* 集計パネル */}
              <div>
                <div className="bg-white rounded-lg shadow p-4 sticky top-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">集計</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">10%対象(税抜)</span><span>{formatNum(accSummary.base10)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">消費税(10%)</span><span>{formatNum(accSummary.tax10)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">8%対象(税抜)</span><span>{formatNum(accSummary.base8)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">消費税(8%)</span><span>{formatNum(accSummary.tax8)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">非課税・不課税</span><span>{formatNum(accSummary.exempt)}</span></div>
                    {accSummary.highway > 0 && (
                      <div className="flex justify-between"><span className="text-gray-500">高速代等</span><span>{formatNum(accSummary.highway)}</span></div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span className="text-gray-700">請求合計</span>
                      <span className="text-orange-600 text-lg">{formatNum(accSummary.total)}</span>
                    </div>
                  </div>
                  <button
                    onClick={accSaveAndPdf}
                    disabled={!accSelectedShipper || accItems.length === 0}
                    className="w-full mt-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500">
                    PDF発行
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
