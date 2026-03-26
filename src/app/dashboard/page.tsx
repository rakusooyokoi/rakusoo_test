'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ cases: 0, shippers: 0, vendors: 0, vehicles: 0, employees: 0 })
  const [billing, setBilling] = useState(0)
  const [billingHw, setBillingHw] = useState(0)
  const [payment, setPayment] = useState(0)
  const [paymentHw, setPaymentHw] = useState(0)
  const [shipperRanking, setShipperRanking] = useState<{name:string;total:number}[]>([])
  const [vendorRanking, setVendorRanking] = useState<{name:string;total:number}[]>([])
  const [monthlyData, setMonthlyData] = useState<{label:string;billing:number;payment:number;profit:number}[]>([])

  const profit = billing + billingHw - payment - paymentHw
  const profitRate = (billing + billingHw) > 0 ? ((profit / (billing + billingHw)) * 100).toFixed(1) : '0.0'
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const dim = new Date(year, month, 0).getDate()

  function changeMonth(delta: number) {
    let m = month + delta, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  useEffect(() => { loadAll() }, [year, month])

  async function loadAll() {
    setLoading(true)
    const startDate = `${ym}-01`, endDate = `${ym}-${dim}`

    const [cC, sC, vC, veC, eC, casesRes, cvRes, salesRes] = await Promise.all([
      supabase.from('cases').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('shippers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('vehicles').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('cases').select('id, case_name, shipper_id, unit_price, shippers(name, short_name, code)').eq('is_active', true),
      supabase.from('case_vendors').select('id, case_id, carrier_type, vendor_id, vendor_price, vendors(name, short_name, code)'),
      supabase.from('sales').select('*').gte('sale_date', startDate).lte('sale_date', endDate),
    ])

    setStats({ cases: cC.count||0, shippers: sC.count||0, vendors: vC.count||0, vehicles: veC.count||0, employees: eC.count||0 })

    const casesData = casesRes.data || []
    const caseMap: Record<string, any> = {}
    for (const c of casesData) caseMap[c.id] = c
    const cvData = cvRes.data || []

    let tB = 0, tBH = 0, tP = 0, tPH = 0
    const sT: Record<string, {name:string;billing:number;hw:number}> = {}
    const vT: Record<string, {name:string;total:number}> = {}

    for (const s of (salesRes.data || [])) {
      if (s.case_vendor_id) {
        const cv = cvData.find((v: any) => v.id === s.case_vendor_id)
        if (cv) {
          const pay = (Number(s.quantity)||0) * (cv.vendor_price||0)
          const hw = cv.carrier_type === 'partner' ? (Number(s.highway_price)||0) : 0
          tP += pay; tPH += hw
          if (cv.carrier_type === 'partner' && cv.vendor_id) {
            const vn = (cv.vendors as any)?.short_name || (cv.vendors as any)?.name || '不明'
            if (!vT[cv.vendor_id]) vT[cv.vendor_id] = { name: vn, total: 0 }
            vT[cv.vendor_id].total += pay + hw
          }
        }
      } else {
        const c = caseMap[s.case_id]
        if (c) {
          const amt = (Number(s.quantity)||0) * (c.unit_price||0)
          const hw = Number(s.highway_price)||0
          tB += amt; tBH += hw
          const sid = c.shipper_id || 'none'
          const sn = (c.shippers as any)?.short_name || (c.shippers as any)?.name || '荷主未設定'
          if (!sT[sid]) sT[sid] = { name: sn, billing: 0, hw: 0 }
          sT[sid].billing += amt; sT[sid].hw += hw
        }
      }
    }

    setBilling(tB); setBillingHw(tBH); setPayment(tP); setPaymentHw(tPH)
    setShipperRanking(Object.values(sT).map(s => ({ ...s, total: s.billing + s.hw })).sort((a,b) => b.total - a.total).slice(0, 5))
    setVendorRanking(Object.values(vT).sort((a,b) => b.total - a.total).slice(0, 5))

    // 月別推移
    const months = []
    for (let i = 5; i >= 0; i--) {
      let mm = month - i, yy = year
      while (mm < 1) { mm += 12; yy-- }
      months.push({ year: yy, month: mm })
    }
    const mResults = []
    for (const mo of months) {
      const mym = `${mo.year}-${String(mo.month).padStart(2, '0')}`
      const mdim = new Date(mo.year, mo.month, 0).getDate()
      const { data } = await supabase.from('sales').select('quantity, unit_price, highway_price, case_vendor_id, vendor_price')
        .gte('sale_date', `${mym}-01`).lte('sale_date', `${mym}-${mdim}`)
      let b = 0, bh = 0, p = 0
      for (const s of (data || [])) {
        if (s.case_vendor_id) p += (Number(s.quantity)||0) * (Number(s.vendor_price)||0) + (Number(s.highway_price)||0)
        else { b += (Number(s.quantity)||0) * (Number(s.unit_price)||0); bh += Number(s.highway_price)||0 }
      }
      mResults.push({ label: `${mo.month}月`, billing: b + bh, payment: p, profit: b + bh - p })
    }
    setMonthlyData(mResults)
    setLoading(false)
  }

  const fmt = (n: number) => n ? Number(n).toLocaleString() : '0'
  const barH = (val: number, arr: any[], key: string) => {
    const max = Math.max(...arr.map(d => Math.abs(d[key] || 0)), 1)
    return Math.max((Math.abs(val) / max) * 100, 2) + '%'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">◀</button>
        <span className="text-lg font-bold text-gray-800">{year}年{month}月</span>
        <button onClick={() => changeMonth(1)} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-sm">▶</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '売上', value: fmt(billing), color: 'text-blue-700' },
          { label: '高速代(売)', value: fmt(billingHw), color: 'text-gray-700' },
          { label: '支払', value: fmt(payment + paymentHw), color: 'text-red-600' },
          { label: '粗利', value: fmt(profit), color: profit >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: '粗利率', value: `${profitRate}%`, color: profit >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: '稼働案件', value: String(stats.cases), color: 'text-gray-800' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4">月別推移（直近6ヶ月）</h3>
          <div className="flex items-end gap-2 h-40">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: 120 }}>
                  <div className="w-3 bg-blue-500 rounded-t" style={{ height: barH(d.billing, monthlyData, 'billing') }} title={`売上: ${fmt(d.billing)}`} />
                  <div className="w-3 bg-red-400 rounded-t" style={{ height: barH(d.payment, monthlyData, 'billing') }} title={`支払: ${fmt(d.payment)}`} />
                  <div className={`w-3 rounded-t ${d.profit >= 0 ? 'bg-green-500' : 'bg-red-600'}`} style={{ height: barH(d.profit, monthlyData, 'billing') }} title={`粗利: ${fmt(d.profit)}`} />
                </div>
                <span className="text-[10px] text-gray-500">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm" />売上</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm" />支払</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm" />粗利</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">マスタ情報</h3>
          <div className="space-y-3">
            {[{ l: '荷主', v: `${stats.shippers}社` }, { l: '協力会社', v: `${stats.vendors}社` }, { l: '車両', v: `${stats.vehicles}台` }, { l: '従業員', v: `${stats.employees}名` }].map((r, i) => (
              <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                <span className="text-sm text-gray-600">{r.l}</span>
                <span className="text-sm font-bold text-gray-800">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: '荷主別売上 TOP5', data: shipperRanking, color: 'bg-blue-500', textColor: 'text-blue-700' },
          { title: '協力会社別支払 TOP5', data: vendorRanking, color: 'bg-red-400', textColor: 'text-red-600' },
        ].map((section, si) => (
          <div key={si} className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">{section.title}</h3>
            <div className="space-y-2">
              {section.data.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{s.name}</span>
                      <span className={`font-bold ${section.textColor}`}>{fmt(s.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${section.color} rounded-full`} style={{ width: `${(s.total / (section.data[0]?.total || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {section.data.length === 0 && <div className="text-gray-400 text-sm text-center py-4">データなし</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
