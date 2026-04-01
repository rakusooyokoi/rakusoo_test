'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const days = ['mon','tue','wed','thu','fri','sat','sun'] as const
const dayLabels: Record<string,string> = { mon:'月', tue:'火', wed:'水', thu:'木', fri:'金', sat:'土', sun:'日' }
const dayIndex: Record<string,number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }

function genMgmtNo() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let r = ''; for (let i=0;i<12;i++) r+=c.charAt(Math.floor(Math.random()*c.length)); return r
}
function parseLocalDate(s:string) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d) }
function fmtDate(d:Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function fmtNum(n:any) { return n ? Number(n).toLocaleString() : '-' }

const emptyForm = () => ({
  case_name:'', shipper_id:'', employee_id:'', case_type:'regular', unit_price:'', default_quantity:1, default_highway_price:'',
  vehicle_type:'', memo:'', is_active:true, start_date:'', end_date:'', operation_date:'', management_number:''
})

const emptyCv = () => ({
  id:null as string|null, carrier_type:'self', vendor_id:'', vendor_price:'', default_highway_price:'', memo:'',
  mon:false, tue:false, wed:false, thu:false, fri:false, sat:false, sun:false
})

export default function CasesPage() {
  const [items, setItems] = useState<any[]>([])
  const [shippers, setShippers] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<string|null>(null)
  const [form, setForm] = useState(emptyForm())
  const [caseVendors, setCaseVendors] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [shipperSearch, setShipperSearch] = useState('')
  const [showShipperList, setShowShipperList] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedVendors, setExpandedVendors] = useState<Record<string,any[]>>({})

  useEffect(() => { Promise.all([load(), loadShippers(), loadVendors(), loadEmployees()]) }, [])

  async function load() {
    const { data } = await supabase.from('cases').select('*, shippers(name, code), employees(name)').order('created_at', { ascending: false })
    setItems(data || [])
  }
  async function loadShippers() {
    const { data } = await supabase.from('shippers').select('id, code, name').eq('is_active', true).order('code')
    setShippers(data || [])
  }
  async function loadVendors() {
    const { data } = await supabase.from('vendors').select('id, code, name').eq('is_active', true).order('code')
    setVendors(data || [])
  }
  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('id, code, name').eq('is_active', true).order('code')
    setEmployees(data || [])
  }

  const filteredShippers = shippers.filter(s => {
    const q = shipperSearch.toLowerCase()
    return !q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  })

  function selectShipper(s: any) {
    setForm(p => ({ ...p, shipper_id: s.id }))
    setShipperSearch(`${s.code} ${s.name}`)
    setShowShipperList(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm(), management_number: genMgmtNo() })
    setShipperSearch('')
    setCaseVendors([])
    setShowModal(true)
  }

  async function openEdit(item: any) {
    setEditing(item.id)
    setForm({ ...item })
    if (item.shippers) setShipperSearch(`${item.shippers.code} ${item.shippers.name}`)
    const { data } = await supabase.from('case_vendors').select('*, vendors(code, name)').eq('case_id', item.id).order('created_at')
    setCaseVendors((data || []).map((v: any) => ({ ...v })))
    setShowModal(true)
  }

  function addVendorRow() { setCaseVendors(p => [...p, emptyCv()]) }
  function removeVendorRow(idx: number) { setCaseVendors(p => p.filter((_,i) => i !== idx)) }
  function updateCv(idx: number, key: string, val: any) {
    setCaseVendors(p => p.map((cv, i) => i === idx ? { ...cv, [key]: val } : cv))
  }

  async function generateSalesBase(caseId: string, caseData: any) {
    if (caseData.case_type === 'spot') {
      if (!caseData.operation_date) return
      await supabase.from('sales').insert([{
        case_id: caseId, sale_date: caseData.operation_date,
        quantity: caseData.default_quantity || 1, unit_price: caseData.unit_price || 0,
        amount: (caseData.default_quantity || 1) * (caseData.unit_price || 0),
        highway_price: caseData.default_highway_price || 0, memo: ''
      }])
      return
    }
    const start = caseData.start_date ? parseLocalDate(caseData.start_date) : new Date()
    const end = caseData.end_date ? parseLocalDate(caseData.end_date) : null
    const activeDays = new Set<number>()
    for (const cv of caseVendors) { for (const d of days) { if (cv[d]) activeDays.add(dayIndex[d]) } }
    if (activeDays.size === 0) return
    const finalDate = end || new Date(start.getFullYear(), start.getMonth() + 1, 0)
    const rows: any[] = []
    const cur = new Date(start)
    while (cur <= finalDate) {
      if (activeDays.has(cur.getDay())) {
        rows.push({ case_id: caseId, sale_date: fmtDate(cur), quantity: caseData.default_quantity || 1,
          unit_price: caseData.unit_price || 0, amount: (caseData.default_quantity||1)*(caseData.unit_price||0),
          highway_price: caseData.default_highway_price || 0, memo: '' })
      }
      cur.setDate(cur.getDate() + 1)
    }
    for (let i = 0; i < rows.length; i += 500) await supabase.from('sales').insert(rows.slice(i, i + 500))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let caseId = editing
    const isNew = !editing
    const payload: any = { ...form }
    delete payload.shippers; delete payload.employees; delete payload.id; delete payload.tenant_id; delete payload.created_at
    if (!payload.shipper_id) delete payload.shipper_id
    if (!payload.employee_id) payload.employee_id = null
    if (!payload.start_date) payload.start_date = null
    if (!payload.end_date) payload.end_date = null
    if (!payload.operation_date) payload.operation_date = null

    if (editing) {
      await supabase.from('cases').update(payload).eq('id', editing)
    } else {
      const { data } = await supabase.from('cases').insert(payload).select('id').single()
      caseId = data?.id
    }
    if (caseId) {
      // 既存のcase_vendor IDを保持（CASCADE削除で売上子行が消えるのを防ぐ）
      const existingIds = caseVendors.filter(v => v.id).map(v => v.id)
      const currentIds: string[] = []

      for (const v of caseVendors.filter(v => v.carrier_type === 'self' || v.vendor_id)) {
        const row = {
          case_id: caseId, carrier_type: v.carrier_type || 'self',
          vendor_id: v.carrier_type === 'self' ? null : v.vendor_id || null,
          vendor_price: v.vendor_price || 0, default_highway_price: v.default_highway_price || 0,
          memo: v.memo || '', mon: v.mon, tue: v.tue, wed: v.wed, thu: v.thu, fri: v.fri, sat: v.sat, sun: v.sun
        }
        if (v.id) {
          // 既存 → UPDATE
          await supabase.from('case_vendors').update(row).eq('id', v.id)
          currentIds.push(v.id)
        } else {
          // 新規 → INSERT
          const { data: ins } = await supabase.from('case_vendors').insert(row).select('id').single()
          if (ins) currentIds.push(ins.id)
        }
      }

      // 削除された行のみ削除（この行に紐づく売上子行もCASCADEで消える）
      for (const eid of existingIds) {
        if (!currentIds.includes(eid)) {
          await supabase.from('case_vendors').delete().eq('id', eid)
        }
      }

      if (isNew) await generateSalesBase(caseId, form)
    }
    setShowModal(false); await load(); setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('case_vendors').delete().eq('case_id', id)
    await supabase.from('sales').delete().eq('case_id', id)
    await supabase.from('cases').delete().eq('id', id)
    await load()
  }

  async function toggleExpand(item: any) {
    const next = new Set(expandedIds)
    if (next.has(item.id)) { next.delete(item.id) } else {
      if (!expandedVendors[item.id]) {
        const { data } = await supabase.from('case_vendors').select('*, vendors(code, name)').eq('case_id', item.id).order('created_at')
        setExpandedVendors(p => ({ ...p, [item.id]: data || [] }))
      }
      next.add(item.id)
    }
    setExpandedIds(next)
  }

  function getDaysText(cv: any) { return days.filter(d => cv[d]).map(d => dayLabels[d]).join(' ') }
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">案件一覧</h2>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">新規登録</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm" style={{tableLayout:'fixed'}}>
          <colgroup>
            <col style={{width:'120px'}} />
            <col style={{width:'160px'}} />
            <col style={{width:'60px'}} />
            <col style={{width:'140px'}} />
            <col style={{width:'90px'}} />
            <col style={{width:'90px'}} />
            <col style={{width:'90px'}} />
            <col style={{width:'90px'}} />
            <col style={{width:'60px'}} />
            <col style={{width:'100px'}} />
          </colgroup>
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600">管理番号</th>
              <th className="px-4 py-3 text-left text-gray-600">案件名</th>
              <th className="px-4 py-3 text-left text-gray-600">便種</th>
              <th className="px-4 py-3 text-left text-gray-600">荷主</th>
              <th className="px-4 py-3 text-left text-gray-600">担当者</th>
              <th className="px-4 py-3 text-right text-gray-600">請求単価</th>
              <th className="px-4 py-3 text-left text-gray-600">開始日</th>
              <th className="px-4 py-3 text-left text-gray-600">終了日</th>
              <th className="px-4 py-3 text-left text-gray-600">状態</th>
              <th className="px-4 py-3 text-center text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <React.Fragment key={item.id}>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs font-mono text-gray-500 truncate">{item.management_number}</td>
                  <td className="px-4 py-2 truncate">
                    <button onClick={() => toggleExpand(item)} className="text-gray-400 hover:text-gray-700 mr-1 text-xs w-4 inline-block">
                      {expandedIds.has(item.id) ? '▼' : '▶'}
                    </button>
                    {item.case_name}
                  </td>
                  <td className="px-4 py-2">
                    <span className={item.case_type==='spot'?'text-orange-600':'text-blue-600'} style={{fontSize:'0.75rem'}}>
                      {item.case_type==='spot'?'スポット':'定期'}
                    </span>
                  </td>
                  <td className="px-4 py-2 truncate">{item.shippers?.name||'-'}</td>
                  <td className="px-4 py-2 truncate">{item.employees?.name||'-'}</td>
                  <td className="px-4 py-2 text-right">{fmtNum(item.unit_price)}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{item.case_type==='spot' ? (item.operation_date||'-') : (item.start_date||'-')}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{item.case_type==='spot' ? '-' : (item.end_date||'-')}</td>
                  <td className="px-4 py-2">
                    <span className={item.is_active?'text-green-600':'text-red-500'}>{item.is_active?'稼働中':'終了'}</span>
                  </td>
                  <td className="px-4 py-2 text-center space-x-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">編集</button>
                    <button onClick={() => remove(item.id)} className="text-red-500 hover:underline">削除</button>
                  </td>
                </tr>
                {expandedIds.has(item.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={10} className="px-8 py-3">
                      {(!expandedVendors[item.id] || expandedVendors[item.id].length === 0) ?
                        <div className="text-xs text-gray-400">実運送事業者なし</div> :
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-500">
                            <th className="text-left py-1 pr-4">区分</th>
                            <th className="text-left py-1 pr-4">事業者名</th>
                            <th className="text-right py-1 pr-4">支払単価</th>
                            <th className="text-left py-1">曜日</th>
                          </tr></thead>
                          <tbody>
                            {expandedVendors[item.id].map((cv: any) => (
                              <tr key={cv.id} className="border-t border-gray-200">
                                <td className="py-1 pr-4">
                                  <span className={cv.carrier_type==='self'?'text-blue-600':'text-orange-600'}>
                                    {cv.carrier_type==='self'?'自社':'協力会社'}
                                  </span>
                                </td>
                                <td className="py-1 pr-4">{cv.carrier_type==='self'?'自社':`${cv.vendors?.code} ${cv.vendors?.name}`}</td>
                                <td className="py-1 pr-4 text-right">{cv.carrier_type==='partner'?fmtNum(cv.vendor_price):'-'}</td>
                                <td className="py-1">{getDaysText(cv)||'-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      }
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {items.length===0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? '案件編集' : '案件登録'}</h3>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">管理番号</label>
                <input value={form.management_number} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">案件名</label>
                  <input value={form.case_name} onChange={e=>upd('case_name',e.target.value)} required className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">便種</label>
                  <select value={form.case_type} onChange={e=>upd('case_type',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                    <option value="regular">定期</option>
                    <option value="spot">スポット</option>
                  </select>
                </div>
              </div>
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">荷主</label>
                <input value={shipperSearch} onChange={e=>{setShipperSearch(e.target.value);setShowShipperList(true)}}
                  onFocus={()=>setShowShipperList(true)} placeholder="CD or 荷主名で検索"
                  className="w-full border rounded px-2 py-1.5 text-sm" />
                {showShipperList && filteredShippers.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                    {filteredShippers.map(s => (
                      <div key={s.id} onClick={()=>selectShipper(s)} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">{s.code} {s.name}</div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">担当者</label>
                <select value={form.employee_id} onChange={e=>upd('employee_id',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">選択してください</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.code} {emp.name}</option>)}
                </select>
              </div>
              {form.case_type==='regular' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">業務開始日</label>
                    <input value={form.start_date} onChange={e=>upd('start_date',e.target.value)} type="date" onKeyDown={e=>e.preventDefault()} className="w-full border rounded px-2 py-1.5 text-sm cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">業務終了日</label>
                    <input value={form.end_date} onChange={e=>upd('end_date',e.target.value)} type="date" onKeyDown={e=>e.preventDefault()} className="w-full border rounded px-2 py-1.5 text-sm cursor-pointer" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">運行日</label>
                  <input value={form.operation_date} onChange={e=>upd('operation_date',e.target.value)} type="date" onKeyDown={e=>e.preventDefault()} className="w-full border rounded px-2 py-1.5 text-sm cursor-pointer" />
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">請求単価</label>
                  <input value={form.unit_price} onChange={e=>upd('unit_price',e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">デフォルト数量</label>
                  <input value={form.default_quantity} onChange={e=>upd('default_quantity',e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">高速等(税込)</label>
                  <input value={form.default_highway_price} onChange={e=>upd('default_highway_price',e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">車格</label>
                  <input value={form.vehicle_type} onChange={e=>upd('vehicle_type',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">備考</label>
                <textarea value={form.memo} onChange={e=>upd('memo',e.target.value)} rows={2} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input checked={form.is_active} onChange={e=>upd('is_active',e.target.checked)} type="checkbox" id="active" />
                <label htmlFor="active" className="text-sm">稼働中</label>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700">実運送事業者</label>
                  <button type="button" onClick={addVendorRow} className="bg-green-600 text-white w-8 h-8 rounded-full text-lg hover:bg-green-700 flex items-center justify-center">+</button>
                </div>
                {caseVendors.length===0 && <div className="text-sm text-gray-400 py-2">実運送事業者なし</div>}
                {caseVendors.map((cv,idx) => (
                  <div key={idx} className="border rounded p-3 mb-2 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className={`flex-1 grid gap-2 ${cv.carrier_type==='partner'?'grid-cols-4':'grid-cols-2'}`}>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">区分</label>
                          <select value={cv.carrier_type} onChange={e=>updateCv(idx,'carrier_type',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                            <option value="self">自社</option>
                            <option value="partner">協力会社</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">実運送事業者</label>
                          <select value={cv.vendor_id} onChange={e=>updateCv(idx,'vendor_id',e.target.value)}
                            disabled={cv.carrier_type==='self'} className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100">
                            <option value="">{cv.carrier_type==='self'?'自社':'選択してください'}</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.code} {v.name}</option>)}
                          </select>
                        </div>
                        {cv.carrier_type==='partner' && <>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">支払単価</label>
                            <input value={cv.vendor_price} onChange={e=>updateCv(idx,'vendor_price',e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">支払高速単価</label>
                            <input value={cv.default_highway_price} onChange={e=>updateCv(idx,'default_highway_price',e.target.value)} type="text" inputMode="numeric" className="w-full border rounded px-2 py-1.5 text-sm" />
                          </div>
                        </>}
                      </div>
                      <button type="button" onClick={()=>removeVendorRow(idx)} className="ml-2 text-red-500 hover:text-red-700 text-lg mt-5">✕</button>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">曜日</label>
                      <div className="flex gap-1">
                        {days.map(d => (
                          <label key={d} className={`flex items-center justify-center w-8 h-8 rounded cursor-pointer text-xs border transition-colors ${
                            cv[d]?'bg-green-600 text-white border-green-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={cv[d]} onChange={()=>updateCv(idx,d,!cv[d])} className="hidden" />
                            {dayLabels[d]}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 border rounded text-sm">キャンセル</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
