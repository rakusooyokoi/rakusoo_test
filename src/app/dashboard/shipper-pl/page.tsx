'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface CaseDetail {
  caseName: string
  count: number
  billing: number
  billingHw: number
  payment: number
  paymentHw: number
}

interface ShipperRow {
  shipperId: string
  shipperName: string
  shipperCode: string
  cases: CaseDetail[]
  billing: number
  billingHw: number
  payment: number
  paymentHw: number
}

function formatNum(n: number) {
  return n ? Number(n).toLocaleString() : '0'
}

function getProfit(row: { billing: number; billingHw: number; payment: number; paymentHw: number }) {
  return row.billing + row.billingHw - row.payment - row.paymentHw
}

function getProfitRate(row: { billing: number; billingHw: number; payment: number; paymentHw: number }) {
  const revenue = row.billing + row.billingHw
  if (revenue === 0) return '-'
  return ((getProfit(row) / revenue) * 100).toFixed(1) + '%'
}

function getCaseProfit(c: CaseDetail) {
  return c.billing + c.billingHw - c.payment - c.paymentHw
}

export default function ShipperPLPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [shipperRows, setShipperRows] = useState<ShipperRow[]>([])
  const [expandedShippers, setExpandedShippers] = useState<Set<string>>(new Set())

  const yearMonth = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month])

  const loadAll = useCallback(async (ym: string, dim: number) => {
    setLoading(true)
    const startDate = `${ym}-01`
    const endDate = `${ym}-${dim}`

    const [casesRes, vendorsRes, salesRes] = await Promise.all([
      supabase.from('cases').select('id, case_name, shipper_id, unit_price, default_highway_price, shippers(id, name, short_name, code)').eq('is_active', true),
      supabase.from('case_vendors').select('id, case_id, carrier_type, vendor_price, default_highway_price, vendors(name, short_name)'),
      supabase.from('sales').select('*').gte('sale_date', startDate).lte('sale_date', endDate)
    ])

    const casesData = casesRes.data || []
    const caseIds = new Set(casesData.map((c: any) => c.id))

    const cvByCaseId: Record<string, any[]> = {}
    for (const v of (vendorsRes.data || [])) {
      if (!caseIds.has(v.case_id)) continue
      if (!cvByCaseId[v.case_id]) cvByCaseId[v.case_id] = []
      cvByCaseId[v.case_id].push(v)
    }

    const salesData = salesRes.data || []

    const parentByCaseId: Record<string, any[]> = {}
    const vendorByCvId: Record<string, any[]> = {}
    for (const s of salesData) {
      if (s.case_vendor_id) {
        if (!vendorByCvId[s.case_vendor_id]) vendorByCvId[s.case_vendor_id] = []
        vendorByCvId[s.case_vendor_id].push(s)
      } else {
        if (!parentByCaseId[s.case_id]) parentByCaseId[s.case_id] = []
        parentByCaseId[s.case_id].push(s)
      }
    }

    // 荷主ごとに集計
    const shipperMap: Record<string, ShipperRow> = {}
    for (const c of casesData) {
      const shipperId = c.shipper_id || 'none'
      const shipper = c.shippers as any
      const shipperName = shipper?.short_name || shipper?.name || '荷主未設定'
      const shipperCode = shipper?.code || ''

      if (!shipperMap[shipperId]) {
        shipperMap[shipperId] = {
          shipperId, shipperName, shipperCode,
          cases: [], billing: 0, billingHw: 0, payment: 0, paymentHw: 0
        }
      }
      const row = shipperMap[shipperId]

      // 請求集計
      const parentSales = parentByCaseId[c.id] || []
      const count = parentSales.reduce((s: number, p: any) => s + (Number(p.quantity) || 0), 0)
      const billing = count * (c.unit_price || 0)
      const billingHw = parentSales.reduce((s: number, p: any) => s + (Number(p.highway_price) || 0), 0)

      // 支払集計
      let payment = 0
      let paymentHw = 0
      const cvs = cvByCaseId[c.id] || []
      for (const cv of cvs) {
        const vSales = vendorByCvId[cv.id] || []
        const vCount = vSales.reduce((s: number, v: any) => s + (Number(v.quantity) || 0), 0)
        payment += vCount * (cv.vendor_price || 0)
        if (cv.carrier_type === 'partner') {
          paymentHw += vSales.reduce((s: number, v: any) => s + (Number(v.highway_price) || 0), 0)
        }
      }

      row.billing += billing
      row.billingHw += billingHw
      row.payment += payment
      row.paymentHw += paymentHw
      row.cases.push({
        caseName: c.case_name, count, billing, billingHw, payment, paymentHw
      })
    }

    const rows = Object.values(shipperMap).sort((a, b) => {
      if (a.shipperCode && b.shipperCode) return a.shipperCode.localeCompare(b.shipperCode)
      return a.shipperName.localeCompare(b.shipperName)
    })
    setShipperRows(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll(yearMonth, daysInMonth)
  }, [yearMonth, daysInMonth, loadAll])

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
  }

  function toggleExpand(id: string) {
    setExpandedShippers(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 合計
  const totals = useMemo(() => {
    const t = { billing: 0, billingHw: 0, payment: 0, paymentHw: 0 }
    for (const r of shipperRows) {
      t.billing += r.billing
      t.billingHw += r.billingHw
      t.payment += r.payment
      t.paymentHw += r.paymentHw
    }
    return t
  }, [shipperRows])

  const totalProfit = useMemo(
    () => totals.billing + totals.billingHw - totals.payment - totals.paymentHw,
    [totals]
  )

  const totalRevenue = totals.billing + totals.billingHw

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">◀</button>
          <span className="text-lg font-bold text-gray-800">{year}年{month}月 荷主収支管理</span>
          <button onClick={() => changeMonth(1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">▶</button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">売上</div>
          <div className="text-lg font-bold text-blue-700">{formatNum(totals.billing)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">高速代(売)</div>
          <div className="text-lg font-bold text-gray-700">{formatNum(totals.billingHw)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">支払</div>
          <div className="text-lg font-bold text-red-600">{formatNum(totals.payment)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">高速代(支)</div>
          <div className="text-lg font-bold text-red-400">{formatNum(totals.paymentHw)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">粗利</div>
          <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatNum(totalProfit)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">粗利率</div>
          <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '-'}
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600">荷主</th>
              <th className="px-4 py-3 text-right text-gray-600">売上</th>
              <th className="px-4 py-3 text-right text-gray-600">高速代(売)</th>
              <th className="px-4 py-3 text-right text-gray-600">支払</th>
              <th className="px-4 py-3 text-right text-gray-600">高速代(支)</th>
              <th className="px-4 py-3 text-right text-green-700 bg-green-50">粗利</th>
              <th className="px-4 py-3 text-right text-green-700 bg-green-50">粗利率</th>
            </tr>
          </thead>
          <tbody>
            {shipperRows.map(row => (
              <React.Fragment key={row.shipperId}>
                <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(row.shipperId)}>
                  <td className="px-4 py-2.5 font-medium">
                    <span className="text-gray-400 text-xs mr-1">{expandedShippers.has(row.shipperId) ? '▼' : '▶'}</span>
                    {row.shipperCode && <span className="text-gray-400 text-xs mr-1">{row.shipperCode}</span>}
                    {row.shipperName}
                    <span className="text-xs text-gray-400 ml-1">({row.cases.length}件)</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-blue-700">{formatNum(row.billing)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{formatNum(row.billingHw)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{formatNum(row.payment)}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{formatNum(row.paymentHw)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold bg-green-50 ${getProfit(row) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatNum(getProfit(row))}
                  </td>
                  <td className={`px-4 py-2.5 text-right bg-green-50 ${getProfit(row) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {getProfitRate(row)}
                  </td>
                </tr>
                {/* 案件内訳 */}
                {expandedShippers.has(row.shipperId) && row.cases.map((c, idx) => (
                  <tr key={idx} className="border-b bg-gray-50">
                    <td className="px-4 py-1.5 pl-10 text-xs text-gray-500">{c.caseName}</td>
                    <td className="px-4 py-1.5 text-right text-xs">{formatNum(c.billing)}</td>
                    <td className="px-4 py-1.5 text-right text-xs text-gray-500">{formatNum(c.billingHw)}</td>
                    <td className="px-4 py-1.5 text-right text-xs text-red-400">{formatNum(c.payment)}</td>
                    <td className="px-4 py-1.5 text-right text-xs text-red-300">{formatNum(c.paymentHw)}</td>
                    <td className={`px-4 py-1.5 text-right text-xs bg-green-50 font-medium ${getCaseProfit(c) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatNum(getCaseProfit(c))}
                    </td>
                    <td className="px-4 py-1.5 bg-green-50"></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {shipperRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">データがありません</td>
              </tr>
            )}
          </tbody>
          {/* 合計行 */}
          {shipperRows.length > 0 && (
            <tfoot className="border-t-2 border-gray-300 bg-gray-100">
              <tr className="font-bold">
                <td className="px-4 py-3 text-gray-700">合計</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatNum(totals.billing)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatNum(totals.billingHw)}</td>
                <td className="px-4 py-3 text-right text-red-600">{formatNum(totals.payment)}</td>
                <td className="px-4 py-3 text-right text-red-400">{formatNum(totals.paymentHw)}</td>
                <td className={`px-4 py-3 text-right bg-green-100 ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatNum(totalProfit)}
                </td>
                <td className={`px-4 py-3 text-right bg-green-100 ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '-'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
