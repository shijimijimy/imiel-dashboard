'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Keyword {
  keyword: string
  competition: '低' | '中' | '高'
  demand: '低' | '中' | '高'
}

function parseJSON<T>(text: string): T | null {
  try {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return JSON.parse(text)
  } catch {
    return null
  }
}

const levelColor: Record<'低' | '中' | '高', string> = {
  低: 'bg-emerald-100 text-emerald-700',
  中: 'bg-amber-100 text-amber-700',
  高: 'bg-red-100 text-red-700',
}

export default function KeywordsPage() {
  const router = useRouter()
  const [seed, setSeed] = useState('')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (!seed.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'keywords', seed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const parsed = parseJSON<Keyword[]>(data.result)
      if (!parsed) throw new Error('レスポンスの解析に失敗しました')
      setKeywords(parsed)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">キーワード収集</h1>
        <p className="text-stone-500 text-sm mt-1">
          テーマワードを入力してIMIEL向けSEOキーワードを提案します
        </p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="例：冷え性、温活、秋冬の足元ケア"
            className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            onClick={generate}
            disabled={!seed.trim() || loading}
            className="px-6 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '生成中...' : '提案する'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {keywords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
            <p className="text-sm font-medium text-stone-600">
              「{seed}」の提案キーワード — {keywords.length}件
            </p>
          </div>
          <ul className="divide-y divide-stone-50">
            {keywords.map((kw, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 w-5 shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-stone-800">{kw.keyword}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor[kw.competition]}`}>
                    競合：{kw.competition}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor[kw.demand]}`}>
                    需要：{kw.demand}
                  </span>
                  <button
                    onClick={() =>
                      router.push(`/write?keyword=${encodeURIComponent(kw.keyword)}`)
                    }
                    className="ml-1 text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                  >
                    記事を書く →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
