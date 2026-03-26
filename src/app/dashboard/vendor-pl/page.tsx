'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface CaseDetail {
  caseName: string
  shipperName: string
  count: number
  vendorPrice: number
  payment: number
  paymentHw: number
}

interface VendorRow {
  vendorId: string
  vendorName: string
  vendorCode: string
  closingDay: number | null
  cases: CaseDetail[]
  payment: number
  paymentHw: number
}

function formatNum(n: number) {
  return n ? Number(n).toLocaleString() : '0'
}

function formatClosing(day: number | null | undefined) {
  return day === 99 ? '末日' : day ? day + '日' : '-'
}

export default function VendorPLPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([])
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set())

  const yearMonth = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month])

  const loadAll = useCallback(async (ym: string, dim: number) => {
    setLoading(true)
    const startDate = `${ym}-01`
    const endDate = `${ym}-${dim}`

    const [casesRes, cvRes, salesRes] = await Promise.all([
      supabase.from('cases').select('id, case_name, shipper_id, shippers(name, short_name)').eq('is_active', true),
      supabase.from('case_vendors').select('id, case_id, carrier_type, vendor_id, vendor_price, default_highway_price, vendors(id, code, name, short_name, closing_day)'),
      supabase.from('sales').select('*').gte('sale_date', startDate).lte('sale_date', endDate)
    ])

    const casesData = casesRes.data || []
    const caseMap: Record<string, any> = {}
    for (const c of casesData) caseMap[c.id] = c

    // 協力会社のcase_vendorsのみ
    const partnerCvs = (cvRes.data || []).filter((cv: any) => cv.carrier_type === 'partner' && cv.vendor_id)

    // 売上データをcase_vendor_idでグループ化
    const salesByCvId: Record<string, any[]> = {}
    for (const s of (salesRes.data || [])) {
      if (!s.case_vendor_id) continue
      if (!salesByCvId[s.case_vendor_id]) salesByCvId[s.case_vendor_id] = []
      salesByCvId[s.case_vendor_id].push(s)
    }

    // 協力会社ごとに集計
    const vMap: Record<string, VendorRow> = {}
    for (const cv of partnerCvs) {
      const vendorId = cv.vendor_id
      const vendor = cv.vendors as any
      const vendorName = vendor?.short_name || vendor?.name || '不明'
      const vendorCode = vendor?.code || ''
      const closingDay = vendor?.closing_day

      if (!vMap[vendorId]) {
        vMap[vendorId] = {
          vendorId, vendorName, vendorCode, closingDay,
          cases: [], payment: 0, paymentHw: 0
        }
      }
      const row = vMap[vendorId]

      const vSales = salesByCvId[cv.id] || []
      const count = vSales.reduce((s: number, v: any) => s + (Number(v.quantity) || 0), 0)
      const payment = count * (cv.vendor_price || 0)
      const paymentHw = vSales.reduce((s: number, v: any) => s + (Number(v.highway_price) || 0), 0)

      const caseInfo = caseMap[cv.case_id]
      const shipper = caseInfo?.shippers as any
      row.payment += payment
      row.paymentHw += paymentHw
      row.cases.push({
        caseName: caseInfo?.case_name || '-',
        shipperName: shipper?.short_name || shipper?.name || '-',
        count,
        vendorPrice: cv.vendor_price || 0,
        payment,
        paymentHw
      })
    }

    const rows = Object.values(vMap).sort((a, b) => {
      if (a.vendorCode && b.vendorCode) return a.vendorCode.localeCompare(b.vendorCode)
      return a.vendorName.localeCompare(b.vendorName)
    })
    setVendorRows(rows)
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
    setExpandedVendors(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const totals = useMemo(() => {
    const t = { payment: 0, paymentHw: 0 }
    for (const r of vendorRows) {
      t.payment += r.payment
      t.paymentHw += r.paymentHw
    }
    return t
  }, [vendorRows])

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">◀</button>
          <span className="text-lg font-bold text-gray-800">{year}年{month}月 協力会社別支払管理</span>
          <button onClick={() => changeMonth(1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">▶</button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">支払合計</div>
          <div className="text-lg font-bold text-red-600">{formatNum(totals.payment)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">高速代(支)合計</div>
          <div className="text-lg font-bold text-red-400">{formatNum(totals.paymentHw)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">支払総合計</div>
          <div className="text-lg font-bold text-red-700">{formatNum(totals.payment + totals.paymentHw)}</div>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600">協力会社</th>
              <th className="px-4 py-3 text-left text-gray-600">締め日</th>
              <th className="px-4 py-3 text-right text-gray-600">支払</th>
              <th className="px-4 py-3 text-right text-gray-600">高速代(支)</th>
              <th className="px-4 py-3 text-right text-red-700 bg-red-50">支払合計</th>
            </tr>
          </thead>
          <tbody>
            {vendorRows.map(row => (
              <React.Fragment key={row.vendorId}>
                <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(row.vendorId)}>
                  <td className="px-4 py-2.5 font-medium">
                    <span className="text-gray-400 text-xs mr-1">{expandedVendors.has(row.vendorId) ? '▼' : '▶'}</span>
                    {row.vendorCode && <span className="text-gray-400 text-xs mr-1">{row.vendorCode}</span>}
                    {row.vendorName}
                    <span className="text-xs text-gray-400 ml-1">({row.cases.length}件)</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{formatClosing(row.closingDay)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-red-600">{formatNum(row.payment)}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{formatNum(row.paymentHw)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-red-700 bg-red-50">{formatNum(row.payment + row.paymentHw)}</td>
                </tr>
                {/* 案件内訳 */}
                {expandedVendors.has(row.vendorId) && row.cases.map((c, idx) => (
                  <tr key={idx} className="border-b bg-gray-50">
                    <td className="px-4 py-1.5 pl-10 text-xs text-gray-500">
                      {c.caseName}
                      <span className="text-gray-300 ml-1">/ {c.shipperName}</span>
                    </td>
                    <td className="px-4 py-1.5 text-xs text-gray-400">
                      {c.count}回 × {formatNum(c.vendorPrice)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs text-red-500">{formatNum(c.payment)}</td>
                    <td className="px-4 py-1.5 text-right text-xs text-red-300">{formatNum(c.paymentHw)}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-medium text-red-600 bg-red-50">{formatNum(c.payment + c.paymentHw)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {vendorRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">データがありません</td>
              </tr>
            )}
          </tbody>
          {/* 合計行 */}
          {vendorRows.length > 0 && (
            <tfoot className="border-t-2 border-gray-300 bg-gray-100">
              <tr className="font-bold">
                <td className="px-4 py-3 text-gray-700">合計</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-red-600">{formatNum(totals.payment)}</td>
                <td className="px-4 py-3 text-right text-red-400">{formatNum(totals.paymentHw)}</td>
                <td className="px-4 py-3 text-right text-red-700 bg-red-100">{formatNum(totals.payment + totals.paymentHw)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
