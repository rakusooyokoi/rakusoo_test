'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const emptyForm = {
  company_name: '', postal_code: '', prefecture: '', city: '',
  address1: '', address2: '', phone: '', fax: '',
  representative: '', registration_no: '', bank_info: ''
}

export default function SettingsPage() {
  const { session } = useAuth()
  const [form, setForm] = useState({ ...emptyForm })
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (session?.user?.id) loadTenant()
  }, [session])

  async function loadTenant() {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session!.user.id)
      .single()
    if (!profile?.tenant_id) return
    setTenantId(profile.tenant_id)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profile.tenant_id)
      .single()
    if (tenant) {
      setForm({
        company_name: tenant.company_name || '',
        postal_code: tenant.postal_code || '',
        prefecture: tenant.prefecture || '',
        city: tenant.city || '',
        address1: tenant.address1 || '',
        address2: tenant.address2 || '',
        phone: tenant.phone || '',
        fax: tenant.fax || '',
        representative: tenant.representative || '',
        registration_no: tenant.registration_no || '',
        bank_info: tenant.bank_info || '',
      })
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('tenants').update(form).eq('id', tenantId)
    if (error) {
      setMessage('保存に失敗しました: ' + error.message)
    } else {
      setMessage('保存しました')
    }
    setSaving(false)
  }

  const upd = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">会社設定</h2>
      <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">会社名</label>
            <input value={form.company_name} onChange={e => upd('company_name', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">郵便番号</label>
              <input value={form.postal_code} onChange={e => upd('postal_code', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">都道府県</label>
              <input value={form.prefecture} onChange={e => upd('prefecture', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">市区町村</label>
              <input value={form.city} onChange={e => upd('city', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">住所1</label>
              <input value={form.address1} onChange={e => upd('address1', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">住所2</label>
              <input value={form.address2} onChange={e => upd('address2', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">TEL</label>
              <input value={form.phone} onChange={e => upd('phone', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">FAX</label>
              <input value={form.fax} onChange={e => upd('fax', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">代表者名</label>
              <input value={form.representative} onChange={e => upd('representative', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">登録番号</label>
              <input value={form.registration_no} onChange={e => upd('registration_no', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">振込先銀行</label>
            <textarea value={form.bank_info} onChange={e => upd('bank_info', e.target.value)} rows={3} className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
            {message && <span className={message.includes('失敗') ? 'text-red-500 text-sm' : 'text-green-600 text-sm'}>{message}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
