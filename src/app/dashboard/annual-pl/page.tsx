'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type MonthData = {
  billing: number
  billingHw: number
  payment: number
  paymentHw: number
}

export default function AnnualPLPage() {
  const now = new Date()
  const [fiscalYear, setFiscalYear] = useState(now.getFullYear())
  const [startMonth, setStartMonth] = useState(4) // 4月始まり
  const [loading, setLoading] = useState(false)
  const [monthlyData, setMonthlyData] = useState<Record<string, MonthData>>({})
  const [cases, setCases] = useState<any[]>([])
  const [caseVendors, setCaseVendors] = useState<any[]>([])

  const months = useMemo(() => {
    const result = []
    for (let i = 0; i < 12; i++) {
      let m = startMonth + i
      let y = fiscalYear
      if (m > 12) { m -= 12; y++ }
      result.push({ year: y, month: m, label: `${m}月` })
    }
    return result
  }, [fiscalYear, startMonth])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const firstMonth = months[0]
    const lastMonth = months[11]
    const startDate = `${firstMonth.year}-${String(firstMonth.month).padStart(2, '0')}-01`
    const lastDim = new Date(lastMonth.year, lastMonth.month, 0).getDate()
    const endDate = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-${lastDim}`

    const [casesRes, cvRes, salesRes] = await Promise.all([
      supabase.from('cases').select('id, unit_price, shipper_id'),
      supabase.from('case_vendors').select('id, case_id, carrier_type, vendor_price'),
      supabase.from('sales').select('case_id, case_vendor_id, sale_date, quantity, highway_price')
        .gte('sale_date', startDate).lte('sale_date', endDate),
    ])

    const casesData = casesRes.data || []
    setCases(casesData)
    const caseMap: Record<string, any> = {}
    for (const c of casesData) caseMap[c.id] = c

    const cvData = cvRes.data || []
    setCaseVendors(cvData)
    const cvMap: Record<string, any> = {}
    for (const cv of cvData) cvMap[cv.id] = cv

    const data: Record<string, MonthData> = {}
    for (const mo of months) {
      data[`${mo.year}-${mo.month}`] = { billing: 0, billingHw: 0, payment: 0, paymentHw: 0 }
    }

    for (const s of (salesRes.data || [])) {
      const [sy, sm] = s.sale_date.split('-').map(Number)
      const key = `${sy}-${sm}`
      if (!data[key]) continue

      if (s.case_vendor_id) {
        const cv = cvMap[s.case_vendor_id]
        if (cv) {
          data[key].payment += (Number(s.quantity) || 0) * (cv.vendor_price || 0)
          if (cv.carrier_type === 'partner') data[key].paymentHw += Number(s.highway_price) || 0
        }
      } else {
        const c = caseMap[s.case_id]
        if (c) {
          data[key].billing += (Number(s.quantity) || 0) * (c.unit_price || 0)
          data[key].billingHw += Number(s.highway_price) || 0
        }
      }
    }

    setMonthlyData(data)
    setLoading(false)
  }, [months])

  useEffect(() => { loadAll() }, [loadAll])

  const fmt = (n: number) => n ? n.toLocaleString() : '0'

  const getMonthTotal = (mo: { year: number; month: number }) => {
    const d = monthlyData[`${mo.year}-${mo.month}`] || { billing: 0, billingHw: 0, payment: 0, paymentHw: 0 }
    const revenue = d.billing + d.billingHw
    const cost = d.payment + d.paymentHw
    const profit = revenue - cost
    const rate = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0'
    return { ...d, revenue, cost, profit, rate }
  }

  const annualTotal = useMemo(() => {
    let billing = 0, billingHw = 0, payment = 0, paymentHw = 0
    for (const mo of months) {
      const d = monthlyData[`${mo.year}-${mo.month}`] || { billing: 0, billingHw: 0, payment: 0, paymentHw: 0 }
      billing += d.billing; billingHw += d.billingHw; payment += d.payment; paymentHw += d.paymentHw
    }
    const revenue = billing + billingHw
    const cost = payment + paymentHw
    const profit = revenue - cost
    const rate = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0'
    return { billing, billingHw, payment, paymentHw, revenue, cost, profit, rate }
  }, [monthlyData, months])

  const rows = [
    { label: '売上高', key: 'billing', color: 'text-blue-700', bold: false },
    { label: '高速代(売)', key: 'billingHw', color: 'text-gray-700', bold: false },
    { label: '売上合計', key: 'revenue', color: 'text-blue-800', bold: true },
    { label: '支払', key: 'payment', color: 'text-red-600', bold: false },
    { label: '高速代(支)', key: 'paymentHw', color: 'text-red-400', bold: false },
    { label: '支払合計', key: 'cost', color: 'text-red-700', bold: true },
    { label: '粗利', key: 'profit', color: 'text-green-700', bold: true },
    { label: '粗利率', key: 'rate', color: 'text-green-600', bold: true, isRate: true },
  ]

  // グラフ用
  const maxRevenue = useMemo(() => Math.max(...months.map(mo => getMonthTotal(mo).revenue), 1), [months, monthlyData])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={() => setFiscalYear(y => y - 1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">◀</button>
        <span className="text-lg font-bold text-gray-800">{fiscalYear}年度 年間損益管理</span>
        <button onClick={() => setFiscalYear(y => y + 1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">▶</button>
        <div className="ml-4 flex items-center gap-2 text-sm text-gray-600">
          <label>期首月:</label>
          <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '年間売上', value: fmt(annualTotal.revenue), color: 'text-blue-700' },
          { label: '年間支払', value: fmt(annualTotal.cost), color: 'text-red-600' },
          { label: '年間粗利', value: fmt(annualTotal.profit), color: annualTotal.profit >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: '年間粗利率', value: `${annualTotal.rate}%`, color: Number(annualTotal.rate) >= 0 ? 'text-green-700' : 'text-red-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 月別グラフ */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4">月別推移</h3>
        <div className="flex items-end gap-2" style={{ height: 160 }}>
          {months.map((mo, i) => {
            const d = getMonthTotal(mo)
            const rH = Math.max((d.revenue / maxRevenue) * 140, 2)
            const cH = Math.max((d.cost / maxRevenue) * 140, 2)
            const pH = Math.max((Math.abs(d.profit) / maxRevenue) * 140, 2)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: 140 }}>
                  <div className="w-3 bg-blue-500 rounded-t" style={{ height: rH }} title={`売上: ${fmt(d.revenue)}`} />
                  <div className="w-3 bg-red-400 rounded-t" style={{ height: cH }} title={`支払: ${fmt(d.cost)}`} />
                  <div className={`w-3 rounded-t ${d.profit >= 0 ? 'bg-green-500' : 'bg-red-600'}`} style={{ height: pH }} title={`粗利: ${fmt(d.profit)}`} />
                </div>
                <span className="text-[10px] text-gray-500">{mo.month}月</span>
              </div>
            )
          })}
        </div>
        <div className="flex justify-center gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm" />売上</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm" />支払</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm" />粗利</span>
        </div>
      </div>

      {/* 月別テーブル */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600 sticky left-0 bg-gray-50 min-w-[120px]">項目</th>
              {months.map((mo, i) => (
                <th key={i} className="px-3 py-3 text-right text-gray-600 min-w-[100px]">{mo.year}/{mo.month}月</th>
              ))}
              <th className="px-4 py-3 text-right text-gray-800 font-bold bg-gray-100 min-w-[110px]">年間合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isProfit = row.key === 'profit'
              const isSep = row.key === 'revenue' || row.key === 'cost' || row.key === 'profit'
              return (
                <tr key={ri} className={`${isSep ? 'border-t-2 border-gray-300' : 'border-t'} ${row.bold ? 'bg-gray-50' : ''}`}>
                  <td className={`px-4 py-2 sticky left-0 ${row.bold ? 'font-bold bg-gray-50' : 'bg-white'} ${row.color}`}>{row.label}</td>
                  {months.map((mo, mi) => {
                    const d = getMonthTotal(mo)
                    const val = row.isRate ? `${d.rate}%` : fmt((d as any)[row.key])
                    const profitColor = isProfit ? ((d as any)[row.key] >= 0 ? 'text-green-700' : 'text-red-600') : row.color
                    return (
                      <td key={mi} className={`px-3 py-2 text-right ${row.bold ? 'font-bold' : ''} ${profitColor}`}>{val}</td>
                    )
                  })}
                  <td className={`px-4 py-2 text-right font-bold bg-gray-100 ${
                    isProfit ? (annualTotal.profit >= 0 ? 'text-green-700' : 'text-red-600') : row.color
                  }`}>
                    {row.isRate ? `${annualTotal.rate}%` : fmt((annualTotal as any)[row.key])}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
