'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const emptyForm = { login_id: '', password: '', display_name: '', role: 'user' }
const emptyEditForm = { display_name: '', role: 'user' }

export default function UsersPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState({ ...emptyEditForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session?.user?.id) init()
  }, [session])

  async function init() {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session!.user.id)
      .single()
    if (profile?.tenant_id) {
      setTenantId(profile.tenant_id)
      loadUsers(profile.tenant_id)
    }
  }

  async function loadUsers(tid?: string) {
    const id = tid || tenantId
    if (!id) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('tenant_id', id)
      .order('created_at')
    setItems(data || [])
  }

  function openNew() {
    setForm({ ...emptyForm })
    setError('')
    setShowModal(true)
  }

  function openEdit(item: any) {
    setEditingId(item.id)
    setEditForm({ display_name: item.display_name || '', role: item.role || 'user' })
    setError('')
    setShowEditModal(true)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const email = form.login_id + '@rakusoo.app'
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
    })
    if (signUpError) {
      setError(signUpError.message)
      setSaving(false)
      return
    }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        display_name: form.display_name,
        role: form.role,
        tenant_id: tenantId,
      })
    }
    setShowModal(false)
    await loadUsers()
    setSaving(false)
  }

  async function updateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    setError('')
    const { error: updError } = await supabase
      .from('profiles')
      .update({ display_name: editForm.display_name, role: editForm.role })
      .eq('id', editingId)
    if (updError) {
      setError(updError.message)
      setSaving(false)
      return
    }
    setShowEditModal(false)
    await loadUsers()
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('profiles').delete().eq('id', id)
    await loadUsers()
  }

  function getLoginId(email: string) {
    return email ? email.split('@')[0] : ''
  }

  const roleLabel = (r: string) => r === 'admin' ? '管理者' : '一般'

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">ユーザー一覧</h2>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">新規登録</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600">ログインID</th>
              <th className="px-4 py-3 text-left text-gray-600">表示名</th>
              <th className="px-4 py-3 text-left text-gray-600">権限</th>
              <th className="px-4 py-3 text-center text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{getLoginId(item.email)}</td>
                <td className="px-4 py-2">{item.display_name}</td>
                <td className="px-4 py-2">{roleLabel(item.role)}</td>
                <td className="px-4 py-2 text-center space-x-2">
                  <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">編集</button>
                  <button onClick={() => remove(item.id)} className="text-red-500 hover:underline">削除</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <h3 className="text-lg font-semibold mb-4">ユーザー登録</h3>
            <form onSubmit={createUser} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">ログインID</label>
                <div className="flex items-center gap-1">
                  <input value={form.login_id} onChange={e => setForm(p => ({ ...p, login_id: e.target.value }))} required className="flex-1 border rounded px-2 py-1.5 text-sm" />
                  <span className="text-sm text-gray-500">@rakusoo.app</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">パスワード</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">表示名</label>
                <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} required className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">権限</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="admin">管理者</option>
                  <option value="user">一般</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-sm">キャンセル</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">登録</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <h3 className="text-lg font-semibold mb-4">ユーザー編集</h3>
            <form onSubmit={updateUser} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">表示名</label>
                <input value={editForm.display_name} onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))} required className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">権限</label>
                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="admin">管理者</option>
                  <option value="user">一般</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded text-sm">キャンセル</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
