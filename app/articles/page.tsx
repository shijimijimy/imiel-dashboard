'use client'

import { useState, useEffect } from 'react'

interface ArticleData {
  title: string
  body: string
  platform: 'shopify' | 'note'
  keyword: string
  createdAt: string
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [filter, setFilter] = useState<'all' | 'shopify' | 'note'>('all')

  useEffect(() => {
    const saved = localStorage.getItem('imiel_articles')
    if (saved) setArticles(JSON.parse(saved))
  }, [])

  function setAsCurrent(article: ArticleData) {
    localStorage.setItem('imiel_current_article', JSON.stringify(article))
    window.location.href = '/post'
  }

  function remove(filteredIndex: number) {
    const target = filtered[filteredIndex]
    const realIndex = articles.findIndex(
      (a) => a.title === target.title && a.createdAt === target.createdAt
    )
    if (realIndex === -1) return
    const updated = articles.filter((_, i) => i !== realIndex)
    setArticles(updated)
    localStorage.setItem('imiel_articles', JSON.stringify(updated))
  }

  const filtered =
    filter === 'all'
      ? articles
      : articles.filter((a) => a.platform === filter)

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">記事一覧</h1>
        <p className="text-stone-500 text-sm mt-1">
          ブラウザに保存された記事（最大50件）
        </p>
      </div>

      {articles.length > 0 && (
        <div className="flex gap-2 mb-5">
          {(['all', 'shopify', 'note'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-stone-800 text-white'
                  : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-300'
              }`}
            >
              {f === 'all' ? `すべて (${articles.length})` : f === 'shopify' ? `Shopify (${articles.filter((a) => a.platform === 'shopify').length})` : `note (${articles.filter((a) => a.platform === 'note').length})`}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-stone-100 text-center">
          <p className="text-stone-400 text-sm mb-4">保存された記事はありません</p>
          <a href="/write" className="text-sm text-rose-600 hover:underline">
            記事を生成する →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((article, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-5 shadow-sm border border-stone-100 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      article.platform === 'shopify'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {article.platform === 'shopify' ? 'Shopify' : 'note'}
                  </span>
                  <span className="text-xs text-stone-400">
                    {new Date(article.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                  <span className="text-xs text-stone-300">·</span>
                  <span className="text-xs text-stone-400">{article.body.length}文字</span>
                </div>
                <p className="font-medium text-stone-800 text-sm truncate">
                  {article.title}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">{article.keyword}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setAsCurrent(article)}
                  className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                >
                  投稿する
                </button>
                <button
                  onClick={() => remove(i)}
                  className="text-xs px-3 py-1.5 bg-stone-100 text-stone-500 rounded-lg hover:bg-stone-200 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
