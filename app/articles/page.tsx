'use client'

import { useState, useEffect, useMemo } from 'react'

export interface ArticleRecord {
  id: string
  title: string
  body: string
  metaDescription: string
  slug: string
  keyword: string
  platform: 'shopify' | 'note'
  seoScore: number
  status: 'draft' | 'published'
  createdAt: string
  publishedAt: string | null
  thumbnailUrl: string | null
}

// Handle both old and new localStorage formats
function normalizeArticle(raw: Record<string, unknown>): ArticleRecord {
  let seoScoreNum = 0
  if (typeof raw.seoScore === 'number') {
    seoScoreNum = raw.seoScore
  } else {
    const seoObj = (raw.seo as Record<string, unknown>) || {}
    const scoreObj = seoObj.seoScore as Record<string, number> | undefined
    if (scoreObj) {
      seoScoreNum = Math.round(
        ((scoreObj.titleScore || 0) + (scoreObj.keywordScore || 0) + (scoreObj.readabilityScore || 0)) / 3
      )
    }
  }
  const seoObj = (raw.seo as Record<string, unknown>) || {}
  return {
    id:              (raw.id as string) || `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title:           (raw.title as string) || '',
    body:            (raw.body as string) || '',
    metaDescription: (raw.metaDescription as string) || (seoObj.metaDescription as string) || '',
    slug:            (raw.slug as string) || (seoObj.slug as string) || '',
    keyword:         (raw.keyword as string) || '',
    platform:        (raw.platform === 'note' ? 'note' : 'shopify') as ArticleRecord['platform'],
    seoScore:        seoScoreNum,
    status:          (raw.status === 'published' ? 'published' : 'draft') as ArticleRecord['status'],
    createdAt:       (raw.createdAt as string) || new Date().toISOString(),
    publishedAt:     (raw.publishedAt as string) || null,
    thumbnailUrl:    (raw.thumbnailUrl as string) || (raw.eyecatchUrl as string) || null,
  }
}

function scoreBadge(score: number) {
  if (score <= 0) return null
  const cls =
    score >= 80
      ? 'bg-emerald-50 text-emerald-600'
      : score >= 60
      ? 'bg-amber-50 text-amber-600'
      : 'bg-red-50 text-red-500'
  return `${cls}`
}

function formatForNote(bodyText: string): string {
  return bodyText
    .replace(/^## (.+)$/gm, '\n■ $1\n')
    .replace(/^# (.+)$/gm, '\n● $1\n')
    .trim()
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

function persistArticles(articles: ArticleRecord[]) {
  localStorage.setItem('imiel_articles', JSON.stringify(articles))
}

export default function ArticlesPage() {
  const [articles,       setArticles]       = useState<ArticleRecord[]>([])
  const [search,         setSearch]         = useState('')
  const [platFilter,     setPlatFilter]     = useState<'all' | 'shopify' | 'note'>('all')
  const [statusFilter,   setStatusFilter]   = useState<'all' | 'draft' | 'published'>('all')

  // modal
  const [editingArticle, setEditingArticle] = useState<ArticleRecord | null>(null)
  const [posting,        setPosting]        = useState(false)
  const [postError,      setPostError]      = useState('')
  const [postSuccess,    setPostSuccess]    = useState('')
  const [noteCopied,     setNoteCopied]     = useState(false)
  const [modalSaved,     setModalSaved]     = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('imiel_articles')
    if (saved) {
      try {
        const raw = JSON.parse(saved) as Record<string, unknown>[]
        setArticles(raw.map(normalizeArticle))
      } catch {
        // ignore parse errors on corrupt data
      }
    }
  }, [])

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (search.trim() && !a.title.toLowerCase().includes(search.toLowerCase())) return false
      if (platFilter !== 'all' && a.platform !== platFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      return true
    })
  }, [articles, search, platFilter, statusFilter])

  function openModal(article: ArticleRecord) {
    setEditingArticle({ ...article })
    setPostError('')
    setPostSuccess('')
    setNoteCopied(false)
    setModalSaved(false)
  }

  function closeModal() {
    setEditingArticle(null)
  }

  function updateField(field: keyof ArticleRecord, value: string) {
    if (!editingArticle) return
    setEditingArticle({ ...editingArticle, [field]: value })
  }

  function saveModal() {
    if (!editingArticle) return
    const updated = articles.map((a) => (a.id === editingArticle.id ? editingArticle : a))
    setArticles(updated)
    persistArticles(updated)
    setModalSaved(true)
    setTimeout(() => setModalSaved(false), 2500)
  }

  async function postToShopify() {
    if (!editingArticle) return
    setPosting(true)
    setPostError('')
    setPostSuccess('')
    try {
      const res = await fetch('/api/shopify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:           editingArticle.title,
          body:            markdownToHtml(editingArticle.body),
          metaDescription: editingArticle.metaDescription,
          slug:            editingArticle.slug,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '投稿エラー')
      const now = new Date().toISOString()
      const next: ArticleRecord = { ...editingArticle, status: 'published', publishedAt: now }
      const updated = articles.map((a) => (a.id === editingArticle.id ? next : a))
      setArticles(updated)
      persistArticles(updated)
      setEditingArticle(next)
      setPostSuccess('Shopifyに投稿しました！')
    } catch (e) {
      setPostError((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  function copyToNote() {
    if (!editingArticle) return
    navigator.clipboard.writeText(formatForNote(editingArticle.body))
    setNoteCopied(true)
    setTimeout(() => {
      window.open('https://note.com/notes/new', '_blank')
      setNoteCopied(false)
    }, 800)
  }

  function deleteArticle(id: string) {
    if (!window.confirm('本当に削除しますか？')) return
    const updated = articles.filter((a) => a.id !== id)
    setArticles(updated)
    persistArticles(updated)
  }

  const counts = {
    all:       articles.length,
    shopify:   articles.filter((a) => a.platform === 'shopify').length,
    note:      articles.filter((a) => a.platform === 'note').length,
    draft:     articles.filter((a) => a.status === 'draft').length,
    published: articles.filter((a) => a.status === 'published').length,
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">記事一覧</h1>
        <p className="text-stone-500 text-sm mt-1">ブラウザに保存された記事（最大50件）</p>
      </div>

      {/* ── フィルター ── */}
      {articles.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 mb-5 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="タイトルで検索..."
            className="w-full px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            {/* 媒体 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-400 shrink-0">媒体：</span>
              {(['all', 'shopify', 'note'] as const).map((v) => (
                <button key={v} onClick={() => setPlatFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    platFilter === v ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}>
                  {v === 'all' ? `すべて (${counts.all})` : v === 'shopify' ? `Shopify (${counts.shopify})` : `note (${counts.note})`}
                </button>
              ))}
            </div>
            {/* ステータス */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-400 shrink-0">状態：</span>
              {(['all', 'draft', 'published'] as const).map((v) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === v ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}>
                  {v === 'all' ? 'すべて' : v === 'draft' ? `下書き (${counts.draft})` : `投稿済み (${counts.published})`}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-400 ml-auto">{filtered.length}件表示</p>
          </div>
        </div>
      )}

      {/* ── 一覧 ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-stone-100 text-center">
          <p className="text-stone-400 text-sm mb-4">
            {articles.length === 0 ? '保存された記事はありません' : '条件に一致する記事がありません'}
          </p>
          {articles.length === 0 && (
            <a href="/write" className="text-sm text-rose-600 hover:underline">記事を生成する →</a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => {
            const badge = scoreBadge(article.seoScore)
            return (
              <div key={article.id} className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* バッジ */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        article.platform === 'shopify' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {article.platform === 'shopify' ? 'Shopify' : 'note'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        article.status === 'published' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {article.status === 'published' ? '投稿済み' : '下書き'}
                      </span>
                      {badge && article.seoScore > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                          SEO {article.seoScore}
                        </span>
                      )}
                      <span className="text-xs text-stone-400">
                        {new Date(article.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    {/* タイトル */}
                    <p className="font-semibold text-stone-800 text-sm leading-snug">{article.title}</p>
                    {article.keyword && (
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{article.keyword}</p>
                    )}
                  </div>

                  {/* アクション */}
                  <div className="flex gap-1.5 shrink-0 items-center">
                    <button onClick={() => openModal(article)}
                      className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors font-medium whitespace-nowrap">
                      確認・編集
                    </button>
                    <button onClick={() => openModal(article)}
                      className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium">
                      投稿
                    </button>
                    <button onClick={() => deleteArticle(article.id)}
                      className="text-xs px-3 py-1.5 bg-white text-stone-400 border border-stone-200 rounded-lg hover:border-red-300 hover:text-red-500 transition-colors">
                      削除
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════════════════════════════════
          編集モーダル
      ════════════════════════════════════════ */}
      {editingArticle && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-stone-800">確認・編集</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  editingArticle.platform === 'shopify' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {editingArticle.platform === 'shopify' ? 'Shopify' : 'note'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  editingArticle.status === 'published' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'
                }`}>
                  {editingArticle.status === 'published' ? '投稿済み' : '下書き'}
                </span>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors text-sm">
                ✕
              </button>
            </div>

            {/* フォーム */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">タイトル</label>
                <input type="text" value={editingArticle.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">キーワード</label>
                <input type="text" value={editingArticle.keyword}
                  onChange={(e) => updateField('keyword', e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-500">メタディスクリプション</label>
                  <span className="text-xs text-stone-400">{editingArticle.metaDescription.length}文字</span>
                </div>
                <input type="text" value={editingArticle.metaDescription}
                  onChange={(e) => updateField('metaDescription', e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">URLスラッグ</label>
                <input type="text" value={editingArticle.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 font-mono focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-500">本文</label>
                  <span className="text-xs text-stone-400">{editingArticle.body.length}文字</span>
                </div>
                <textarea value={editingArticle.body} rows={18}
                  onChange={(e) => updateField('body', e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 font-mono focus:outline-none focus:ring-2 focus:ring-rose-200 resize-y" />
              </div>

              {/* フィードバック */}
              {modalSaved && (
                <p className="text-xs text-emerald-600 font-medium">✓ 保存しました</p>
              )}
              {postSuccess && (
                <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-medium text-emerald-700">
                  ✓ {postSuccess}
                </div>
              )}
              {postError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  ✕ {postError}
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-2 flex-wrap">
              {/* 投稿系 */}
              {editingArticle.platform === 'shopify' && (
                <button onClick={postToShopify} disabled={posting}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
                  {posting ? '投稿中...' : 'Shopifyに投稿'}
                </button>
              )}
              {editingArticle.platform === 'note' && (
                <button onClick={copyToNote}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium transition-colors">
                  {noteCopied ? '✓ コピー中...' : 'noteにコピー'}
                </button>
              )}

              {/* 保存・閉じる */}
              <div className="ml-auto flex gap-2">
                <button onClick={saveModal}
                  className="px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 font-medium transition-colors">
                  保存
                </button>
                <button onClick={closeModal}
                  className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200 font-medium transition-colors">
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
