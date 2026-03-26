'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function parseLocalDate(str: string | null): Date | null {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const dayIndexMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const dayLabels = ['日', '月', '火', '水', '木', '金', '土']

function formatNum(n: number | null | undefined): string {
  return n ? Number(n).toLocaleString() : '0'
}

export default function SalesPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [cases, setCases] = useState<any[]>([])
  const [caseVendorsMap, setCaseVendorsMap] = useState<Record<string, any[]>>({})
  const [dailyData, setDailyData] = useState<Record<string, any>>({})
  const [vendorDaily, setVendorDaily] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [showShipper, setShowShipper] = useState(false)
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set())

  // Highway panel state
  const [hwPanel, setHwPanel] = useState<{ show: boolean; caseItem: any; days: any[] }>({ show: false, caseItem: null, days: [] })
  const [hwTab, setHwTab] = useState<string>('billing')

  // Refs for mutable data during loadAll
  const dailyDataRef = useRef(dailyData)
  const vendorDailyRef = useRef(vendorDaily)
  dailyDataRef.current = dailyData
  vendorDailyRef.current = vendorDaily

  const yearMonth = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month])

  const dateColumns = useMemo(() => {
    const cols = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d)
      const dayOfWeek = date.getDay()
      cols.push({ day: d, dayOfWeek, dayLabel: dayLabels[dayOfWeek] })
    }
    return cols
  }, [year, month, daysInMonth])

  const fixedCols = showShipper ? 3 : 2
  const totalCols = fixedCols + daysInMonth + 5

  // Load all data
  const loadAll = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const dim = new Date(y, m, 0).getDate()
    const startDate = `${ym}-01`
    const endDate = `${ym}-${dim}`

    const [casesRes, vendorsRes, salesRes] = await Promise.all([
      supabase.from('cases').select('*, shippers(name, code)').eq('is_active', true).order('created_at'),
      supabase.from('case_vendors').select('*, vendors(code, name, short_name)').order('created_at'),
      supabase.from('sales').select('*').gte('sale_date', startDate).lte('sale_date', endDate)
    ])

    const casesData = casesRes.data || []
    setCases(casesData)
    const caseIds = new Set(casesData.map((c: any) => c.id))

    const cvMap: Record<string, any[]> = {}
    for (const v of (vendorsRes.data || [])) {
      if (!caseIds.has(v.case_id)) continue
      if (!cvMap[v.case_id]) cvMap[v.case_id] = []
      cvMap[v.case_id].push(v)
    }
    setCaseVendorsMap(cvMap)

    const salesData = salesRes.data || []
    const parentMap: Record<string, any> = {}
    const vdMap: Record<string, any> = {}
    for (const s of salesData) {
      const d = new Date(s.sale_date).getDate()
      if (s.case_vendor_id) {
        vdMap[`${s.case_vendor_id}-${d}`] = {
          quantity: s.quantity, vendor_price: s.vendor_price || 0,
          amount: s.amount, highway_price: s.highway_price || 0, id: s.id
        }
      } else {
        parentMap[`${s.case_id}-${d}`] = {
          quantity: s.quantity, unit_price: s.unit_price,
          amount: s.amount, highway_price: s.highway_price || 0, id: s.id
        }
      }
    }

    // Auto-generate for regular cases
    const regularCases = casesData.filter((c: any) => c.case_type === 'regular')
    const newParentRows: any[] = []
    const newVendorRows: any[] = []

    for (const c of regularCases) {
      if (c.start_date && parseLocalDate(c.start_date)! > new Date(y, m, 0)) continue
      if (c.end_date && parseLocalDate(c.end_date)! < new Date(y, m - 1, 1)) continue
      const cvs = cvMap[c.id] || []
      const allActiveDays = new Set<number>()
      const cvDayMap: Record<string, Set<number>> = {}
      for (const cv of cvs) {
        cvDayMap[cv.id] = new Set()
        for (const dk of dayKeys) {
          if (cv[dk]) { allActiveDays.add(dayIndexMap[dk]); cvDayMap[cv.id].add(dayIndexMap[dk]) }
        }
      }
      if (allActiveDays.size === 0) continue
      const caseStart = c.start_date ? parseLocalDate(c.start_date) : null
      const caseEnd = c.end_date ? parseLocalDate(c.end_date) : null

      for (let d = 1; d <= dim; d++) {
        const date = new Date(y, m - 1, d)
        if (caseStart && date < caseStart) continue
        if (caseEnd && date > caseEnd) continue
        if (!allActiveDays.has(date.getDay())) continue
        const dateStr = `${ym}-${String(d).padStart(2, '0')}`
        if (!parentMap[`${c.id}-${d}`]) {
          newParentRows.push({
            case_id: c.id, sale_date: dateStr,
            quantity: c.default_quantity || 1, unit_price: c.unit_price || 0,
            amount: (c.default_quantity || 1) * (c.unit_price || 0),
            highway_price: c.default_highway_price || 0, memo: ''
          })
        }
        for (const cv of cvs) {
          if (!cvDayMap[cv.id].has(date.getDay())) continue
          if (!vdMap[`${cv.id}-${d}`]) {
            newVendorRows.push({
              case_id: c.id, case_vendor_id: cv.id, sale_date: dateStr,
              quantity: c.default_quantity || 1, unit_price: 0,
              vendor_price: cv.vendor_price || 0,
              amount: (c.default_quantity || 1) * (cv.vendor_price || 0),
              highway_price: cv.default_highway_price || 0, memo: ''
            })
          }
        }
      }
    }

    if (newParentRows.length > 0) {
      for (let i = 0; i < newParentRows.length; i += 500) {
        const { data: ins } = await supabase.from('sales').insert(newParentRows.slice(i, i + 500))
          .select('id, case_id, sale_date, quantity, unit_price, amount, highway_price')
        for (const s of (ins || [])) {
          const d = new Date(s.sale_date).getDate()
          parentMap[`${s.case_id}-${d}`] = { quantity: s.quantity, unit_price: s.unit_price, amount: s.amount, highway_price: s.highway_price || 0, id: s.id }
        }
      }
    }
    if (newVendorRows.length > 0) {
      for (let i = 0; i < newVendorRows.length; i += 500) {
        const { data: ins } = await supabase.from('sales').insert(newVendorRows.slice(i, i + 500))
          .select('id, case_vendor_id, sale_date, quantity, vendor_price, amount, highway_price')
        for (const s of (ins || [])) {
          const d = new Date(s.sale_date).getDate()
          vdMap[`${s.case_vendor_id}-${d}`] = { quantity: s.quantity, vendor_price: s.vendor_price || 0, amount: s.amount, highway_price: s.highway_price || 0, id: s.id }
        }
      }
    }

    setDailyData({ ...parentMap })
    setVendorDaily({ ...vdMap })
    setLoading(false)
  }, [])

  useEffect(() => { loadAll(year, month) }, [year, month, loadAll])

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
    setHwPanel({ show: false, caseItem: null, days: [] })
  }

  // ---- Parent row helpers ----
  function getCell(caseId: string, day: number) { return dailyData[`${caseId}-${day}`] || null }
  function getCellValue(caseId: string, day: number) { const c = getCell(caseId, day); return c ? c.quantity : '' }

  async function updateCell(caseItem: any, day: number, event: React.ChangeEvent<HTMLInputElement>) {
    const quantity = event.target.value === '' ? 0 : Number(event.target.value)
    const key = `${caseItem.id}-${day}`
    const existing = dailyData[key]
    const saleDate = `${yearMonth}-${String(day).padStart(2, '0')}`
    if (quantity === 0 && existing) {
      await supabase.from('sales').delete().eq('id', existing.id)
      setDailyData(prev => { const n = { ...prev }; delete n[key]; return n })
    } else if (quantity > 0) {
      const amount = quantity * (caseItem.unit_price || 0)
      if (existing) {
        await supabase.from('sales').update({ quantity, amount }).eq('id', existing.id)
        setDailyData(prev => ({ ...prev, [key]: { ...existing, quantity, amount } }))
      } else {
        const { data } = await supabase.from('sales').insert({
          case_id: caseItem.id, sale_date: saleDate, quantity,
          unit_price: caseItem.unit_price || 0, amount,
          highway_price: caseItem.default_highway_price || 0
        }).select('id').single()
        if (data) setDailyData(prev => ({ ...prev, [key]: { quantity, unit_price: caseItem.unit_price, amount, highway_price: caseItem.default_highway_price || 0, id: data.id } }))
      }
    }
  }

  // ---- Vendor row helpers ----
  function getVendorCell(cvId: string, day: number) { return vendorDaily[`${cvId}-${day}`] || null }
  function getVendorCellValue(cvId: string, day: number) { const c = getVendorCell(cvId, day); return c ? c.quantity : '' }

  async function updateVendorCell(caseItem: any, cv: any, day: number, event: React.ChangeEvent<HTMLInputElement>) {
    const quantity = event.target.value === '' ? 0 : Number(event.target.value)
    const key = `${cv.id}-${day}`
    const existing = vendorDaily[key]
    const saleDate = `${yearMonth}-${String(day).padStart(2, '0')}`
    if (quantity === 0 && existing) {
      await supabase.from('sales').delete().eq('id', existing.id)
      setVendorDaily(prev => { const n = { ...prev }; delete n[key]; return n })
    } else if (quantity > 0) {
      const vp = cv.vendor_price || 0
      const amount = quantity * vp
      if (existing) {
        await supabase.from('sales').update({ quantity, amount, vendor_price: vp }).eq('id', existing.id)
        setVendorDaily(prev => ({ ...prev, [key]: { ...existing, quantity, vendor_price: vp, amount } }))
      } else {
        const { data } = await supabase.from('sales').insert({
          case_id: caseItem.id, case_vendor_id: cv.id, sale_date: saleDate,
          quantity, unit_price: 0, vendor_price: vp, amount
        }).select('id').single()
        if (data) setVendorDaily(prev => ({ ...prev, [key]: { quantity, vendor_price: vp, amount, highway_price: 0, id: data.id } }))
      }
    }
  }

  // ---- Aggregation ----
  function getRowCount(caseId: string) {
    let t = 0; for (let d = 1; d <= daysInMonth; d++) { const c = getCell(caseId, d); if (c) t += Number(c.quantity) || 0 }; return t
  }
  function getRowBilling(c: any) { return getRowCount(c.id) * (c.unit_price || 0) }
  function getRowHighway(caseId: string) {
    let t = 0; for (let d = 1; d <= daysInMonth; d++) { const c = getCell(caseId, d); if (c) t += Number(c.highway_price) || 0 }; return t
  }
  function getVendorRowCount(cvId: string) {
    let t = 0; for (let d = 1; d <= daysInMonth; d++) { const c = getVendorCell(cvId, d); if (c) t += Number(c.quantity) || 0 }; return t
  }
  function getVendorRowPayment(cv: any) { return getVendorRowCount(cv.id) * (cv.vendor_price || 0) }
  function getVendorRowHighway(cvId: string) {
    let t = 0; for (let d = 1; d <= daysInMonth; d++) { const c = getVendorCell(cvId, d); if (c) t += Number(c.highway_price) || 0 }; return t
  }
  function getCasePaymentTotal(caseId: string) {
    return (caseVendorsMap[caseId] || []).reduce((s: number, cv: any) => {
      const pay = getVendorRowPayment(cv)
      const hw = cv.carrier_type === 'partner' ? getVendorRowHighway(cv.id) : 0
      return s + pay + hw
    }, 0)
  }
  function getCaseProfit(c: any) { return getRowBilling(c) + getRowHighway(c.id) - getCasePaymentTotal(c.id) }

  function toggleExpand(caseId: string) {
    setExpandedCases(prev => {
      const next = new Set(prev)
      if (next.has(caseId)) next.delete(caseId); else next.add(caseId)
      return next
    })
  }

  // ---- Grand totals ----
  const grandBilling = cases.reduce((s, c) => s + getRowBilling(c), 0)
  const grandHighway = cases.reduce((s, c) => s + getRowHighway(c.id), 0)
  const grandPaymentBase = cases.reduce((s, c) => {
    return s + (caseVendorsMap[c.id] || []).reduce((ss: number, cv: any) => ss + getVendorRowPayment(cv), 0)
  }, 0)
  const grandPaymentHw = cases.reduce((s, c) => {
    return s + (caseVendorsMap[c.id] || []).reduce((ss: number, cv: any) => {
      return ss + (cv.carrier_type === 'partner' ? getVendorRowHighway(cv.id) : 0)
    }, 0)
  }, 0)
  const grandProfit = grandBilling + grandHighway - grandPaymentBase - grandPaymentHw

  // ---- Highway panel ----
  function buildHwDays(caseItem: any, tab: string) {
    const days: any[] = []
    if (tab === 'billing') {
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = getCell(caseItem.id, d)
        if (cell) {
          const date = new Date(year, month - 1, d)
          days.push({ day: d, dayLabel: dayLabels[date.getDay()], dayOfWeek: date.getDay(), highway: cell.highway_price || 0 })
        }
      }
    } else {
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = getVendorCell(tab, d)
        if (cell) {
          const date = new Date(year, month - 1, d)
          days.push({ day: d, dayLabel: dayLabels[date.getDay()], dayOfWeek: date.getDay(), highway: cell.highway_price || 0 })
        }
      }
    }
    setHwPanel({ show: true, caseItem, days })
  }

  function openHwPanel(caseItem: any) {
    setHwTab('billing')
    buildHwDays(caseItem, 'billing')
  }

  function switchHwTab(caseItem: any, tab: string) {
    setHwTab(tab)
    buildHwDays(caseItem, tab)
  }

  async function saveHwDay(item: any, index: number) {
    const hw = Number(item.highway) || 0
    if (hwTab === 'billing') {
      const cell = getCell(hwPanel.caseItem.id, item.day)
      if (!cell) return
      await supabase.from('sales').update({ highway_price: hw }).eq('id', cell.id)
      setDailyData(prev => ({ ...prev, [`${hwPanel.caseItem.id}-${item.day}`]: { ...cell, highway_price: hw } }))
    } else {
      const cell = getVendorCell(hwTab, item.day)
      if (!cell) return
      await supabase.from('sales').update({ highway_price: hw }).eq('id', cell.id)
      setVendorDaily(prev => ({ ...prev, [`${hwTab}-${item.day}`]: { ...cell, highway_price: hw } }))
    }
  }

  function getHwDefault() {
    if (hwTab === 'billing') return hwPanel.caseItem?.default_highway_price || 0
    const cv = (caseVendorsMap[hwPanel.caseItem?.id] || []).find((v: any) => v.id === hwTab)
    return cv?.default_highway_price || 0
  }

  async function applyAllHw() {
    const def = getHwDefault()
    const newDays = [...hwPanel.days]
    for (let i = 0; i < newDays.length; i++) {
      newDays[i] = { ...newDays[i], highway: def }
      await saveHwDay(newDays[i], i)
    }
    setHwPanel(prev => ({ ...prev, days: newDays }))
  }

  function getHwTabVendors() {
    return (caseVendorsMap[hwPanel.caseItem?.id] || []).filter((cv: any) => cv.carrier_type === 'partner')
  }

  function updateHwDayValue(index: number, value: number) {
    setHwPanel(prev => {
      const newDays = [...prev.days]
      newDays[index] = { ...newDays[index], highway: value }
      return { ...prev, days: newDays }
    })
  }

  // ---- Display helpers ----
  function getDayHeaderClass(col: any) {
    if (col.dayOfWeek === 0) return 'bg-red-100 text-red-600'
    if (col.dayOfWeek === 6) return 'bg-blue-100 text-blue-600'
    return 'bg-gray-50'
  }
  function getDayCellClass(col: any) {
    if (col.dayOfWeek === 0) return 'bg-red-50/50'
    if (col.dayOfWeek === 6) return 'bg-blue-50/50'
    return ''
  }

  // ---- Arrow key navigation ----
  function onCellKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    const dir: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const d = dir[e.key]
    if (!d) return
    e.preventDefault()
    const td = (e.target as HTMLElement).closest('td')
    const tr = td?.closest('tr')
    const table = tr?.closest('table')
    if (!td || !tr || !table) return
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const rowIdx = rows.indexOf(tr)
    const cells = Array.from(tr.querySelectorAll('td'))
    const colIdx = cells.indexOf(td)
    const targetRow = rows[rowIdx + d[0]] as HTMLElement | undefined
    if (!targetRow) return
    const targetCells = Array.from(targetRow.querySelectorAll('td'))
    const targetTd = (targetCells[colIdx + d[1]] || targetCells[colIdx]) as HTMLElement | undefined
    if (!targetTd) return
    const input = targetTd.querySelector('input') as HTMLInputElement | null
    if (input) { input.focus(); input.select() }
  }

  return (
    <>
      <style>{`
        .sales-table { width: max-content; min-width: 100%; }
        .sales-table th {
          background: #f8fafc; color: #374151; padding: 6px 4px;
          text-align: center; border: 1px solid #e5e7eb; white-space: nowrap;
          position: sticky; top: 0; z-index: 10; font-weight: 600;
        }
        .th-fixed { text-align: left; padding-left: 8px; z-index: 20 !important; background: #f1f5f9 !important; }
        .th-fixed-1 { left: 0; }
        .th-fixed-2 { left: 200px; }
        .th-fixed-3 { left: 310px; }
        .th-day { font-weight: normal; min-width: 38px; }
        .th-summary { background: #eef2ff !important; font-weight: bold; color: #1e40af; }
        .th-summary-profit { background: #f0fdf4 !important; font-weight: bold; color: #15803d; }

        .sales-table td {
          background: #fff; color: #1f2937; border: 1px solid #e5e7eb; padding: 0; height: 30px;
        }
        .td-fixed { position: sticky; z-index: 5; background: #fff !important; padding: 4px 8px; font-size: 11px; }
        .td-fixed-1 { left: 0; }
        .td-fixed-2 { left: 200px; }
        .td-fixed-3 { left: 310px; }
        .td-day { padding: 0; text-align: center; }

        .cell-input {
          width: 100%; height: 100%; background: transparent; color: #1f2937;
          text-align: center; border: none; outline: none; font-size: 12px; padding: 4px 2px;
        }
        .cell-input:focus { background: #eff6ff; outline: 2px solid #3b82f6; }
        .cell-vendor { color: #6b7280; }
        .cell-vendor:focus { background: #fefce8; outline: 2px solid #f59e0b; }

        .td-summary { background: #f8fafc !important; padding: 4px 6px; font-size: 11px; }
        .td-summary-profit { background: #f0fdf4 !important; padding: 4px 6px; font-size: 11px; }

        .parent-row:hover td { background: #f1f5f9 !important; }
        .parent-row:hover .td-fixed { background: #f1f5f9 !important; }
        .vendor-row td { background: #fafaf9 !important; height: 28px; }
        .vendor-row:hover td { background: #f5f5f4 !important; }
        .vendor-row .td-fixed { background: #fafaf9 !important; }
        .vendor-row:hover .td-fixed { background: #f5f5f4 !important; }

        .hw-panel {
          width: 260px; min-width: 260px;
          background: #fff; border-left: 1px solid #e5e7eb;
          padding: 16px; overflow-y: auto;
        }
      `}</style>

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 sticky left-0" style={{ width: 'fit-content', minWidth: '100%' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">◀</button>
            <span className="text-lg font-bold text-gray-800">{year}年{month}月 売上管理表</span>
            <button onClick={() => changeMonth(1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">▶</button>
            <label className="flex items-center gap-1 text-xs text-gray-500 ml-4 cursor-pointer select-none">
              <input type="checkbox" checked={showShipper} onChange={e => setShowShipper(e.target.checked)} className="rounded" /> 荷主表示
            </label>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <span>売上: <strong className="text-sm text-blue-700">{formatNum(grandBilling)}</strong></span>
            <span>高速代(売): <strong className="text-sm text-gray-700">{formatNum(grandHighway)}</strong></span>
            <span>支払: <strong className="text-sm text-red-600">{formatNum(grandPaymentBase)}</strong></span>
            <span>高速代(支): <strong className="text-sm text-red-400">{formatNum(grandPaymentHw)}</strong></span>
            <span>粗利: <strong className={`text-sm ${grandProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatNum(grandProfit)}</strong></span>
          </div>
        </div>

        <div className="flex-1 flex gap-0">
          {/* Main table */}
          <div className="flex-1 overflow-auto border border-gray-300 rounded-lg">
            <table className="sales-table text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 200 }} />
                <col style={{ width: 110 }} />
                {showShipper && <col style={{ width: 100 }} />}
                {dateColumns.map(col => <col key={col.day} style={{ width: 38 }} />)}
                <col style={{ width: 50 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-fixed th-fixed-1">案件名</th>
                  <th className="th-fixed th-fixed-2">区分</th>
                  {showShipper && <th className="th-fixed th-fixed-3">荷主</th>}
                  {dateColumns.map(col => (
                    <th key={col.day} className={`th-day ${getDayHeaderClass(col)}`}>
                      <div>{col.day}</div>
                      <div className="text-[10px] opacity-60">{col.dayLabel}</div>
                    </th>
                  ))}
                  <th className="th-summary">回数</th>
                  <th className="th-summary">単価</th>
                  <th className="th-summary">金額</th>
                  <th className="th-summary">高速代</th>
                  <th className="th-summary-profit">粗利</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
                  const vendors = caseVendorsMap[c.id] || []
                  const isExpanded = expandedCases.has(c.id)
                  return (
                    <React.Fragment key={c.id}>
                      {/* Parent row */}
                      <tr className="parent-row">
                        <td className="td-fixed td-fixed-1 truncate" title={c.case_name}
                          rowSpan={isExpanded ? 1 + vendors.length : 1}>
                          {vendors.length > 0 && (
                            <button onClick={() => toggleExpand(c.id)}
                              className="text-gray-400 hover:text-gray-700 mr-1 text-xs w-4 inline-block">
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          )}
                          <span>{c.case_name}</span>
                        </td>
                        <td className="td-fixed td-fixed-2 text-gray-400 text-center text-[10px]">請求</td>
                        {showShipper && (
                          <td className="td-fixed td-fixed-3 truncate text-gray-500"
                            rowSpan={isExpanded ? 1 + vendors.length : 1}>
                            {c.shippers?.name || '-'}
                          </td>
                        )}
                        {dateColumns.map(col => (
                          <td key={col.day} className={`td-day ${getDayCellClass(col)}`}>
                            <input type="text" defaultValue={getCellValue(c.id, col.day)}
                              onBlur={e => updateCell(c, col.day, e as any)}
                              onKeyDown={onCellKeydown}
                              className="cell-input" />
                          </td>
                        ))}
                        <td className="td-summary font-bold text-center">{getRowCount(c.id) || ''}</td>
                        <td className="td-summary text-right">{formatNum(c.unit_price)}</td>
                        <td className="td-summary text-right font-bold text-blue-700">{formatNum(getRowBilling(c))}</td>
                        <td className="td-summary text-right cursor-pointer hover:bg-purple-50" onClick={() => openHwPanel(c)}>
                          <span className="text-purple-700 font-bold">{formatNum(getRowHighway(c.id))}</span>
                        </td>
                        <td className={`td-summary-profit text-right font-bold ${getCaseProfit(c) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {formatNum(getCaseProfit(c))}
                        </td>
                      </tr>

                      {/* Vendor rows */}
                      {isExpanded && vendors.map((cv: any) => (
                        <tr key={cv.id} className="vendor-row">
                          <td className="td-fixed td-fixed-2 truncate text-xs">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${cv.carrier_type === 'self' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                            {cv.carrier_type === 'self' ? '自社便' : cv.vendors?.name}
                          </td>
                          {showShipper && <td className="td-fixed td-fixed-3"></td>}
                          {dateColumns.map(col => (
                            <td key={col.day} className={`td-day ${getDayCellClass(col)}`}>
                              <input type="text" defaultValue={getVendorCellValue(cv.id, col.day)}
                                onBlur={e => updateVendorCell(c, cv, col.day, e as any)}
                                onKeyDown={onCellKeydown}
                                className="cell-input cell-vendor" />
                            </td>
                          ))}
                          <td className="td-summary text-center text-gray-500">{getVendorRowCount(cv.id) || ''}</td>
                          <td className="td-summary text-right text-gray-500">{cv.carrier_type === 'partner' ? formatNum(cv.vendor_price) : '-'}</td>
                          <td className={`td-summary text-right ${cv.carrier_type === 'partner' ? 'text-red-600' : 'text-gray-400'}`}>
                            {cv.carrier_type === 'partner' ? formatNum(getVendorRowPayment(cv)) : '-'}
                          </td>
                          <td className={`td-summary text-right ${cv.carrier_type === 'partner' ? 'cursor-pointer hover:bg-purple-50' : ''}`}
                            onClick={() => cv.carrier_type === 'partner' && switchHwTab(c, cv.id)}>
                            {cv.carrier_type === 'partner'
                              ? <span className="text-purple-500">{formatNum(getVendorRowHighway(cv.id))}</span>
                              : <span className="text-gray-300">-</span>
                            }
                          </td>
                          <td className="td-summary-profit"></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="text-center text-gray-400 py-8">案件がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Highway side panel */}
          {hwPanel.show && (
            <div className="hw-panel">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-sm text-gray-800">高速代</h3>
                <button onClick={() => setHwPanel({ show: false, caseItem: null, days: [] })} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <div className="text-xs text-gray-600 mb-2 font-medium">{hwPanel.caseItem?.case_name}</div>

              {/* Tabs */}
              <div className="flex gap-1 mb-3 border-b">
                <button onClick={() => switchHwTab(hwPanel.caseItem, 'billing')}
                  className={`px-2 py-1.5 text-xs font-medium ${hwTab === 'billing' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-400'}`}>
                  請求
                </button>
                {getHwTabVendors().map((cv: any) => (
                  <button key={cv.id} onClick={() => switchHwTab(hwPanel.caseItem, cv.id)}
                    className={`px-2 py-1.5 text-xs font-medium truncate max-w-[100px] ${hwTab === cv.id ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-400'}`}>
                    {cv.vendors?.short_name || cv.vendors?.name}
                  </button>
                ))}
              </div>

              <div className="text-xs text-gray-400 mb-2">デフォルト: {formatNum(getHwDefault())}円</div>
              <button onClick={applyAllHw} className="w-full mb-3 py-1.5 text-xs border border-purple-300 text-purple-700 rounded hover:bg-purple-50">
                全日にデフォルト値を適用
              </button>

              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                {hwPanel.days.map((item, idx) => (
                  <div key={item.day}
                    className={`flex items-center gap-2 py-1 px-1 rounded ${item.dayOfWeek === 0 ? 'bg-red-50' : item.dayOfWeek === 6 ? 'bg-blue-50' : ''}`}>
                    <span className="text-xs text-gray-600 w-16">{month}/{item.day}({item.dayLabel})</span>
                    <input type="number" value={item.highway}
                      onChange={e => updateHwDayValue(idx, Number(e.target.value) || 0)}
                      onBlur={() => saveHwDay(item, idx)}
                      className="flex-1 border rounded px-2 py-1 text-xs text-right" />
                    <span className="text-[10px] text-gray-400 w-4">円</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-xs text-gray-500">合計</span>
                <strong className="text-sm text-purple-700">
                  {formatNum(hwPanel.days.reduce((s, d) => s + (Number(d.highway) || 0), 0))}円
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

