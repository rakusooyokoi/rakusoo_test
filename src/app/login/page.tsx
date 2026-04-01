'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [regMsg, setRegMsg] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setRegMsg(''); setError('')
    const { error: err } = await supabase.auth.signUp({ email: `${loginId}@rakusoo.app`, password })
    if (err) setError(err.message)
    else setRegMsg('登録完了。ログインしてください。')
    setLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: `${loginId}@rakusoo.app`,
      password,
    })
    if (err) setError('ログインIDまたはパスワードが正しくありません')
    else router.push('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-96">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">rakusoo</h1>
        <p className="text-center text-gray-500 text-sm mb-6">運送業務管理システム</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
            <input
              value={loginId} onChange={e => setLoginId(e.target.value)}
              type="text" required placeholder="例: admin"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              value={password} onChange={e => setPassword(e.target.value)}
              type="password" required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        {regMsg && <div className="text-green-600 text-sm mt-3 text-center">{regMsg}</div>}
        <div className="mt-4 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-blue-600 text-sm hover:underline">
            {isRegister ? 'ログインに戻る' : '新規登録はこちら'}
          </button>
          {isRegister && (
            <button onClick={handleRegister} disabled={loading || !loginId || !password}
              className="w-full mt-3 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
              新規登録
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
