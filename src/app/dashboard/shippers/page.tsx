'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const prefectures = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']
const emptyForm = { code: '', name: '', name2: '', short_name: '', postal_code: '', prefecture: '', city: '', address1: '', address2: '', phone: '', fax: '', closing_day: 20, is_active: true }

export default function ShippersPage() {
  const [items, setItems] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('shippers').select('*').order('code')
    setItems(data || [])
  }

  async function getNextCode() {
    const { data } = await supabase.from('shippers').select('code').order('code', { ascending: false }).limit(1)
    if (data && data.length > 0) {
      const num = parseInt(data[0].code, 10)
      return isNaN(num) ? '1' : String(num + 1)
    }
    return '1'
  }

  async function openNew() {
    setEditing(null)
    const nextCode = await getNextCode()
    setForm({ ...emptyForm, code: nextCode })
    setShowModal(true)
  }

  function openEdit(item: any) {
    setEditing(item.id)
    setForm({ ...item })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await supabase.from('shippers').update(form).eq('id', editing)
    } else {
      await supabase.from('shippers').insert(form)
    }
    setShowModal(false)
    await load()
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('shippers').delete().eq('id', id)
    await load()
  }

  const upd = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">荷主一覧</h2>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">新規登録</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600">CD</th>
              <th className="px-4 py-3 text-left text-gray-600">荷主名</th>
              <th className="px-4 py-3 text-left text-gray-600">略称</th>
              <th className="px-4 py-3 text-left text-gray-600">電話番号</th>
              <th className="px-4 py-3 text-left text-gray-600">締め日</th>
              <th className="px-4 py-3 text-left text-gray-600">状態</th>
              <th className="px-4 py-3 text-center text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{item.code}</td>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2">{item.short_name}</td>
                <td className="px-4 py-2">{item.phone}</td>
                <td className="px-4 py-2">{item.closing_day === 99 ? '末日' : item.closing_day + '日'}</td>
                <td className="px-4 py-2">
                  <span className={item.is_active ? 'text-green-600' : 'text-red-500'}>{item.is_active ? '取引中' : '休止'}</span>
                </td>
                <td className="px-4 py-2 text-center space-x-2">
                  <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">編集</button>
                  <button onClick={() => remove(item.id)} className="text-red-500 hover:underline">削除</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[560px] max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? '荷主編集' : '荷主登録'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">荷主CD</label>
                  <input value={form.code} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">締め日</label>
                  <select value={form.closing_day} onChange={e => upd('closing_day', Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm">
                    {[5,10,15,20,25,99].map(d => <option key={d} value={d}>{d === 99 ? '末日' : d + '日'}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">荷主名1</label>
                <input value={form.name} onChange={e => upd('name', e.target.value)} required className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">荷主名2</label>
                <input value={form.name2} onChange={e => upd('name2', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">略称</label>
                <input value={form.short_name} onChange={e => upd('short_name', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">郵便番号</label>
                  <input value={form.postal_code} onChange={e => upd('postal_code', e.target.value)} placeholder="123-4567" className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">都道府県</label>
                  <select value={form.prefecture} onChange={e => upd('prefecture', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                    <option value="">選択してください</option>
                    {prefectures.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">市区町村</label>
                <input value={form.city} onChange={e => upd('city', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">住所1</label>
                <input value={form.address1} onChange={e => upd('address1', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">住所2</label>
                <input value={form.address2} onChange={e => upd('address2', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">電話番号</label>
                  <input value={form.phone} onChange={e => upd('phone', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">FAX</label>
                  <input value={form.fax} onChange={e => upd('fax', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} type="checkbox" id="active" />
                <label htmlFor="active" className="text-sm">取引中</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-sm">キャンセル</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
