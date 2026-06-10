'use client'

import { useState, useEffect } from 'react'

interface ArticleSeo {
  metaDescription: string
  slug?: string
  threadsText: string
  xText: string
}

interface ArticleData {
  title: string
  body: string
  noteBody?: string
  platform: 'shopify' | 'note'
  keyword: string
  slug?: string
  seo?: ArticleSeo
  createdAt: string
}

export default function PostPage() {
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [posting, setPosting] = useState<string | null>(null)
  const [result, setResult] = useState<{
    type: string
    message: string
    success: boolean
  } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('imiel_current_article')
    if (saved) setArticle(JSON.parse(saved))
  }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function postToShopify() {
    if (!article) return
    if (!showPreview) {
      setShowPreview(true)
      return
    }
    setPosting('shopify')
    setResult(null)
    try {
      const res = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          body: article.body,
          metaDescription: article.seo?.metaDescription,
          slug: article.slug || article.seo?.slug,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Shopify投稿エラー')
      setResult({ type: 'shopify', message: 'Shopifyに投稿しました！', success: true })
      setShowPreview(false)
    } catch (e) {
      setResult({ type: 'shopify', message: (e as Error).message, success: false })
    } finally {
      setPosting(null)
    }
  }

  async function postToThreads() {
    if (!article?.seo?.threadsText) return
    setPosting('threads')
    setResult(null)
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: article.seo.threadsText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Threads投稿エラー')
      setResult({ type: 'threads', message: 'Threadsに投稿しました！', success: true })
    } catch (e) {
      setResult({ type: 'threads', message: (e as Error).message, success: false })
    } finally {
      setPosting(null)
    }
  }

  if (!article) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-stone-800 mb-6">投稿・通知</h1>
        <div className="bg-white rounded-xl p-10 shadow-sm border border-stone-100 text-center">
          <p className="text-stone-400 text-sm mb-4">投稿する記事がありません</p>
          <a href="/write" className="text-sm text-rose-600 hover:underline">
            記事を生成する →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">投稿・通知</h1>
        <p className="text-stone-500 text-sm mt-1">生成した記事を各媒体に投稿します</p>
      </div>

      {/* 記事プレビュー */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100 mb-6">
        <div className="flex items-start justify-between mb-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              article.platform === 'shopify'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {article.platform === 'shopify' ? 'Shopify' : 'note'}
          </span>
          <span className="text-xs text-stone-400">{article.body.length}文字</span>
        </div>
        <h2 className="text-sm font-semibold text-stone-800 mt-2 mb-1">{article.title}</h2>
        <p className="text-xs text-stone-500 line-clamp-2">
          {article.body.substring(0, 150)}...
        </p>
        <div className="flex gap-2 mt-3">
          <a
            href="/articles"
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            記事一覧を見る
          </a>
          <span className="text-xs text-stone-300">|</span>
          <a
            href="/write"
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            別の記事を生成
          </a>
        </div>
      </div>

      {result && (
        <div
          className={`mb-5 px-4 py-3 rounded-lg text-sm ${
            result.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="space-y-4">
        {/* Shopify */}
        {article.platform === 'shopify' && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-stone-800 text-sm">Shopifyに投稿</p>
                {article.seo?.metaDescription && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    メタ: {article.seo.metaDescription.substring(0, 60)}...
                  </p>
                )}
              </div>
              <button
                onClick={postToShopify}
                disabled={!!posting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {posting === 'shopify' ? '投稿中...' : showPreview ? '確認して投稿' : 'プレビュー確認'}
              </button>
            </div>
            {showPreview && (
              <div className="mt-2 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                <p className="text-xs font-medium text-stone-500">投稿プレビュー</p>
                <p className="text-sm font-bold text-stone-800">{article.title}</p>
                {(article.slug || article.seo?.slug) && (
                  <p className="text-xs font-mono text-stone-400">
                    /{article.slug || article.seo?.slug}
                  </p>
                )}
                <p className="text-xs text-stone-600 whitespace-pre-wrap">
                  {article.body.substring(0, 400)}...
                </p>
                {article.seo?.metaDescription && (
                  <div className="pt-2 border-t border-stone-200">
                    <p className="text-xs text-stone-400">
                      メタ: {article.seo.metaDescription}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        )}

        {/* Threads */}
        {article.seo?.threadsText && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 text-sm mb-2">Threadsに投稿</p>
                <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3 whitespace-pre-wrap">
                  {article.seo.threadsText.substring(0, 200)}
                  {article.seo.threadsText.length > 200 ? '...' : ''}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {article.seo.threadsText.length}文字
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={postToThreads}
                  disabled={!!posting}
                  className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-900 disabled:opacity-50 transition-colors"
                >
                  {posting === 'threads' ? '投稿中...' : '投稿する'}
                </button>
                <button
                  onClick={() => copy(article.seo!.threadsText, 'threads')}
                  className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200 transition-colors"
                >
                  {copied === 'threads' ? '✓' : 'コピー'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* X */}
        {article.seo?.xText && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 text-sm mb-2">X（Twitter）に投稿</p>
                <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3 whitespace-pre-wrap">
                  {article.seo.xText}
                </p>
                <p className="text-xs text-stone-400 mt-1">{article.seo.xText.length}文字</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() =>
                    window.open(
                      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                        article.seo!.xText
                      )}`,
                      '_blank'
                    )
                  }
                  className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-black transition-colors"
                >
                  Xで投稿
                </button>
                <button
                  onClick={() => copy(article.seo!.xText, 'x')}
                  className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200 transition-colors"
                >
                  {copied === 'x' ? '✓' : 'コピー'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* note */}
        {article.platform === 'note' && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-stone-800 text-sm">noteに投稿</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  本文をコピーしてnoteの投稿画面に貼り付けます
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => copy(article.noteBody || article.body, 'note')}
                  className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200 transition-colors"
                >
                  {copied === 'note' ? '✓ コピー済み' : '本文コピー'}
                </button>
                <button
                  onClick={() => window.open('https://note.com/notes/new', '_blank')}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  noteを開く
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
