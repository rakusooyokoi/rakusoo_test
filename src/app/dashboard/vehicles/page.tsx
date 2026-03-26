'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const vehicleTypes = ['大型', '中型', '小型', '軽', 'トレーラー', 'その他']
const emptyForm = { code: '', number: '', vehicle_type: '', capacity: '', memo: '' }

export default function VehiclesPage() {
  const [items, setItems] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('vehicles').select('*').order('code')
    setItems(data || [])
  }

  async function getNextCode() {
    const { data } = await supabase.from('vehicles').select('code').order('code', { ascending: false }).limit(1)
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
      await supabase.from('vehicles').update(form).eq('id', editing)
    } else {
      await supabase.from('vehicles').insert(form)
    }
    setShowModal(false)
    await load()
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('vehicles').delete().eq('id', id)
    await load()
  }

  const upd = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">車両一覧</h2>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">新規登録</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600">CD</th>
              <th className="px-4 py-3 text-left text-gray-600">車番</th>
              <th className="px-4 py-3 text-left text-gray-600">車格</th>
              <th className="px-4 py-3 text-left text-gray-600">最大積載量</th>
              <th className="px-4 py-3 text-left text-gray-600">メモ</th>
              <th className="px-4 py-3 text-center text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{item.code}</td>
                <td className="px-4 py-2">{item.number}</td>
                <td className="px-4 py-2">{item.vehicle_type}</td>
                <td className="px-4 py-2">{item.capacity}</td>
                <td className="px-4 py-2">{item.memo}</td>
                <td className="px-4 py-2 text-center space-x-2">
                  <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">編集</button>
                  <button onClick={() => remove(item.id)} className="text-red-500 hover:underline">削除</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? '車両編集' : '車両登録'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">車両CD</label>
                  <input value={form.code} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">車番</label>
                  <input value={form.number} onChange={e => upd('number', e.target.value)} required className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">車格</label>
                  <select value={form.vehicle_type} onChange={e => upd('vehicle_type', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                    <option value="">選択してください</option>
                    {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最大積載量</label>
                  <input value={form.capacity} onChange={e => upd('capacity', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">メモ</label>
                <input value={form.memo} onChange={e => upd('memo', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
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
