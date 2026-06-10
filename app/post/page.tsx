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

function markdownToHtml(md: string): string {
  return md
    .split(/\n\n+/)
    .map((para) => {
      const t = para.trim()
      if (!t) return ''
      if (t.startsWith('## ')) return `<h2>${t.slice(3)}</h2>`
      if (t.startsWith('# '))  return `<h1>${t.slice(2)}</h1>`
      return `<p>${t.replace(/\n/g, '<br>')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

function IconEdit() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

export default function PostPage() {
  const [article,     setArticle]     = useState<ArticleData | null>(null)
  const [posting,     setPosting]     = useState<string | null>(null)
  const [result,      setResult]      = useState<{ type: string; message: string; success: boolean } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied,      setCopied]      = useState<string | null>(null)

  // ── 編集モーダル ──
  const [showModal,   setShowModal]   = useState(false)
  const [editTitle,   setEditTitle]   = useState('')
  const [editBody,    setEditBody]    = useState('')
  const [editMeta,    setEditMeta]    = useState('')
  const [editSlug,    setEditSlug]    = useState('')
  const [editKeyword, setEditKeyword] = useState('')
  const [modalSaved,  setModalSaved]  = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('imiel_current_article')
    if (saved) setArticle(JSON.parse(saved))
  }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function openEditModal() {
    if (!article) return
    setEditTitle(article.title)
    setEditBody(article.body)
    setEditMeta(article.seo?.metaDescription || '')
    setEditSlug(article.slug || article.seo?.slug || '')
    setEditKeyword(article.keyword || '')
    setModalSaved(false)
    setShowModal(true)
  }

  function saveEdit() {
    if (!article) return
    const updated: ArticleData = {
      ...article,
      title:   editTitle,
      body:    editBody,
      keyword: editKeyword,
      slug:    editSlug,
      seo:     article.seo
        ? { ...article.seo, metaDescription: editMeta, slug: editSlug }
        : { metaDescription: editMeta, slug: editSlug, threadsText: '', xText: '' },
    }
    setArticle(updated)
    localStorage.setItem('imiel_current_article', JSON.stringify(updated))
    setModalSaved(true)
    setTimeout(() => setModalSaved(false), 2500)
  }

  function deleteArticle() {
    if (!window.confirm('本当に削除しますか？')) return
    localStorage.removeItem('imiel_current_article')
    setArticle(null)
    setResult(null)
    setShowPreview(false)
  }

  async function postToShopify() {
    if (!article) return
    if (!showPreview) { setShowPreview(true); return }
    setPosting('shopify')
    setResult(null)
    try {
      const res = await fetch('/api/shopify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:           article.title,
          body:            markdownToHtml(article.body),
          metaDescription: article.seo?.metaDescription,
          slug:            article.slug || article.seo?.slug,
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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: article.seo.threadsText }),
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

  // ── 空状態 ──
  if (!article) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-stone-800 mb-6">投稿・通知</h1>
        <div className="bg-white rounded-xl p-12 shadow-sm border border-stone-100 text-center">
          <p className="text-stone-400 text-sm mb-5">まだ記事がありません</p>
          <a
            href="/write"
            className="inline-block px-5 py-2.5 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 transition-colors font-medium"
          >
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

      {/* ── 記事カード ── */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100 mb-6">
        <div className="flex items-start justify-between mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            article.platform === 'shopify'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {article.platform === 'shopify' ? 'Shopify' : 'note'}
          </span>
          <span className="text-xs text-stone-400">{article.body.length}文字</span>
        </div>
        <h2 className="text-sm font-semibold text-stone-800 mt-2 mb-1 leading-snug">{article.title}</h2>
        <p className="text-xs text-stone-500 line-clamp-2">
          {article.body.substring(0, 150)}…
        </p>
        {/* フッター行 */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
          <div className="flex gap-3">
            <a href="/articles" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              記事一覧を見る
            </a>
            <span className="text-xs text-stone-300">|</span>
            <a href="/write" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              別の記事を生成
            </a>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors font-medium"
            >
              <IconEdit />
              編集
            </button>
            <button
              onClick={deleteArticle}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white text-stone-400 border border-stone-200 rounded-lg hover:border-red-300 hover:text-red-500 transition-colors"
            >
              <IconTrash />
              削除
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium ${
          result.success
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {result.message}
        </div>
      )}

      <div className="space-y-4">
        {/* ── Shopify ── */}
        {article.platform === 'shopify' && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-stone-800 text-sm">Shopifyに投稿</p>
                {article.seo?.metaDescription && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    メタ: {article.seo.metaDescription.substring(0, 60)}…
                  </p>
                )}
              </div>
              <button
                onClick={postToShopify}
                disabled={!!posting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {posting === 'shopify' ? '投稿中...' : showPreview ? '確認して投稿' : 'プレビュー確認'}
              </button>
            </div>
            {showPreview && (
              <div className="mt-2 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                <p className="text-xs font-medium text-stone-500">投稿プレビュー</p>
                <p className="text-sm font-bold text-stone-800">{article.title}</p>
                {(article.slug || article.seo?.slug) && (
                  <p className="text-xs font-mono text-stone-400">/{article.slug || article.seo?.slug}</p>
                )}
                <p className="text-xs text-stone-600 whitespace-pre-wrap">
                  {article.body.substring(0, 400)}…
                </p>
                {article.seo?.metaDescription && (
                  <div className="pt-2 border-t border-stone-200">
                    <p className="text-xs text-stone-400">メタ: {article.seo.metaDescription}</p>
                  </div>
                )}
                <button onClick={() => setShowPreview(false)} className="text-xs text-stone-400 hover:text-stone-600">
                  キャンセル
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Threads ── */}
        {article.seo?.threadsText && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 text-sm mb-2">Threadsに投稿</p>
                <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3 whitespace-pre-wrap">
                  {article.seo.threadsText.substring(0, 200)}
                  {article.seo.threadsText.length > 200 ? '…' : ''}
                </p>
                <p className="text-xs text-stone-400 mt-1">{article.seo.threadsText.length}文字</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={postToThreads}
                  disabled={!!posting}
                  className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-900 disabled:opacity-50 transition-colors font-medium"
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

        {/* ── X ── */}
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
                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.seo!.xText)}`, '_blank')}
                  className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-black transition-colors font-medium"
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

        {/* ── note ── */}
        {article.platform === 'note' && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-stone-800 text-sm">noteに投稿</p>
                <p className="text-xs text-stone-500 mt-0.5">本文をコピーしてnoteの投稿画面に貼り付けます</p>
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
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                  noteを開く
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          編集モーダル
      ════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-stone-800">記事を編集</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  article.platform === 'shopify' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {article.platform === 'shopify' ? 'Shopify' : 'note'}
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* フォーム */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">タイトル</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">キーワード</label>
                <input
                  type="text"
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-500">メタディスクリプション</label>
                  <span className="text-xs text-stone-400">{editMeta.length}文字</span>
                </div>
                <input
                  type="text"
                  value={editMeta}
                  onChange={(e) => setEditMeta(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">URLスラッグ</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 font-mono focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-500">本文</label>
                  <span className="text-xs text-stone-400">{editBody.length}文字</span>
                </div>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={18}
                  className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 font-mono focus:outline-none focus:ring-2 focus:ring-rose-200 resize-y"
                />
              </div>

              {modalSaved && (
                <p className="text-xs text-emerald-600 font-medium">✓ 保存しました</p>
              )}
            </div>

            {/* フッター */}
            <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 font-medium transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200 font-medium transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
