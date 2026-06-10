'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DEFAULT_BRAND_TONE_SHOPIFY, DEFAULT_BRAND_TONE_NOTE } from '@/lib/prompts'
import { loadSettings } from '@/lib/settings'

type Platform = 'shopify' | 'note'
type Step = 1 | 2 | 3

interface Outline {
  h2: string
  summary: string
}

interface TitlesResult {
  titles: string[]
  outline: Outline[]
  intro: string
}

interface SeoScore {
  titleScore: number
  keywordScore: number
  readabilityScore: number
  advice: string[]
}

interface SeoResult {
  metaDescription: string
  slug: string
  seoScore: SeoScore
  threadsText: string
  xText: string
}

function formatForNote(bodyText: string): string {
  return bodyText
    .replace(/^## (.+)$/gm, '\n■ $1\n')
    .replace(/^# (.+)$/gm, '\n● $1\n')
    .trim()
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
      ? 'bg-amber-400'
      : 'bg-red-400'
  const textColor =
    score >= 80
      ? 'text-emerald-700'
      : score >= 60
      ? 'text-amber-700'
      : 'text-red-600'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-stone-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${textColor}`}>{score}</span>
    </div>
  )
}

const KEYWORD_CHIP_GROUPS = [
  {
    category: '場所×冷え',
    chips: ['映画館 冷え 対策', 'オフィス 足元 冷え', '新幹線 冷え 対策', 'カフェ 冷房 寒い', '飛行機 足元 冷え', 'スーパー 冷え 夏'],
  },
  {
    category: '年代×悩み',
    chips: ['40代 冷え ひどい', '更年期 冷え 対策', '30代 冷え性 改善', '産後 冷え むくみ', '生理痛 温活 効果'],
  },
  {
    category: '季節×温活',
    chips: ['夏 冷房 冷え 対策', '梅雨 足元 冷え', '秋 温活 始め方', '冬 足元 冷え 寝れない'],
  },
  {
    category: '商品関連',
    chips: ['シルク レッグウォーマー 効果', '温活 グッズ 持ち歩き', 'レッグウォーマー 使い方', '温活 セルフケア 簡単'],
  },
]

const NOTE_KEYWORD_EXTRA = [
  {
    category: 'note向け',
    chips: ['温活とは 効果 体験談', '冷え性 原因 改善方法', 'セルフケア 習慣 40代', 'レッグウォーマー 選び方'],
  },
]

const TARGET_CHIPS = [
  '40代 冷え性の女性',
  '更年期が気になる女性',
  'デスクワークで足元が冷える女性',
  '産後の冷えに悩むママ',
  '生理痛がつらい女性',
  '温活を始めたい30〜40代',
  '冬の冷え対策を探している女性',
  '夏の冷房対策をしたい女性',
]

const STYLES = ['体験談・等身大', '解説・情報系', '比較・まとめ系'] as const
type ArticleStyle = typeof STYLES[number]

function parseJSON<T>(text: string): T | null {
  try {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return JSON.parse(text)
  } catch {
    return null
  }
}

function WritePageContent() {
  const searchParams = useSearchParams()
  const initialKeyword = searchParams.get('keyword') || ''

  const [platform, setPlatform] = useState<Platform>('shopify')
  const [step, setStep] = useState<Step>(1)
  const [keyword, setKeyword] = useState(initialKeyword)
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [titlesResult, setTitlesResult] = useState<TitlesResult | null>(null)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [body, setBody] = useState('')
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [style, setStyle] = useState<ArticleStyle>('体験談・等身大')

  // 画像プロンプト
  const [thumbnailPrompt, setThumbnailPrompt] = useState('')
  const [thumbnailCopied, setThumbnailCopied] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [sectionChecked, setSectionChecked] = useState<boolean[]>([])
  const [sectionPrompts, setSectionPrompts] = useState<string[]>([])
  const [sectionImageUrls, setSectionImageUrls] = useState<string[]>([])
  const [sectionLoading, setSectionLoading] = useState(false)
  const [eyecatchUrl, setEyecatchUrl] = useState('')
  const [settings, setSettings] = useState({
    shopifyTone: DEFAULT_BRAND_TONE_SHOPIFY,
    noteTone: DEFAULT_BRAND_TONE_NOTE,
    mustKeywords: '温活, レッグウォーマー, セルフケア, 冷え対策',
  })

  useEffect(() => {
    const s = loadSettings()
    setSettings({ shopifyTone: s.shopifyTone, noteTone: s.noteTone, mustKeywords: s.mustKeywords })
    const savedUrl = localStorage.getItem('imiel_eyecatch_url')
    if (savedUrl) {
      setEyecatchUrl(savedUrl)
      localStorage.removeItem('imiel_eyecatch_url')
    }
  }, [])

  useEffect(() => {
    if (titlesResult) {
      const len = titlesResult.outline.length
      setSectionChecked(new Array(len).fill(false))
      setSectionPrompts(new Array(len).fill(''))
      setSectionImageUrls(new Array(len).fill(''))
    }
  }, [titlesResult])

  const brandTone = platform === 'shopify' ? settings.shopifyTone : settings.noteTone

  async function call(payload: Record<string, unknown>) {
    setError('')
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'エラーが発生しました')
    return data.result as string
  }

  async function generateTitles() {
    if (!keyword.trim()) return
    setLoading(true)
    try {
      const result = await call({
        type: 'titles',
        platform,
        keyword,
        target,
        brandTone,
        mustKeywords: settings.mustKeywords,
        style,
      })
      const parsed = parseJSON<TitlesResult>(result)
      if (!parsed) throw new Error('レスポンスの解析に失敗しました')
      setTitlesResult(parsed)
      setSelectedTitle(parsed.titles[0])
      setStep(2)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function generateBody() {
    if (!titlesResult || !selectedTitle) return
    setLoading(true)
    try {
      const result = await call({
        type: 'body',
        platform,
        keyword,
        outline: titlesResult.outline,
        selectedTitle,
        brandTone,
      })
      setBody(result)
      setStep(3)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function generateSeo() {
    if (!body) return
    setLoading(true)
    try {
      const result = await call({
        type: 'seo',
        title: selectedTitle,
        body,
        keyword,
        platform,
      })
      const parsed = parseJSON<SeoResult>(result)
      if (!parsed) throw new Error('レスポンスの解析に失敗しました')
      setSeoResult(parsed)
      // ローカルストレージに保存
      const article = {
        title: selectedTitle,
        body,
        noteBody: formatForNote(body),
        platform,
        keyword,
        slug: parsed.slug,
        eyecatchUrl: eyecatchUrl || undefined,
        seo: parsed,
        createdAt: new Date().toISOString(),
      }
      const existing = JSON.parse(localStorage.getItem('imiel_articles') || '[]')
      existing.unshift(article)
      localStorage.setItem('imiel_articles', JSON.stringify(existing.slice(0, 50)))
      localStorage.setItem('imiel_current_article', JSON.stringify(article))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function generateThumbnailPrompt() {
    if (!body || !selectedTitle) return
    setImgLoading(true)
    try {
      const result = await call({
        type: 'thumbnail_prompt',
        title: selectedTitle,
        keyword,
        body,
      })
      setThumbnailPrompt(result.trim())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setImgLoading(false)
    }
  }

  async function generateSectionPrompts() {
    if (!titlesResult) return
    setSectionLoading(true)
    try {
      const newPrompts = [...sectionPrompts]
      for (let i = 0; i < titlesResult.outline.length; i++) {
        if (sectionChecked[i] && !newPrompts[i]) {
          const result = await call({
            type: 'section_prompt',
            h2: titlesResult.outline[i].h2,
            sectionSummary: titlesResult.outline[i].summary,
            brandTone,
          })
          newPrompts[i] = result.trim()
        }
      }
      setSectionPrompts(newPrompts)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSectionLoading(false)
    }
  }

  function reset() {
    setStep(1)
    setTitlesResult(null)
    setSelectedTitle('')
    setBody('')
    setSeoResult(null)
    setError('')
    setThumbnailPrompt('')
    setThumbnailCopied(false)
    setSectionChecked([])
    setSectionPrompts([])
    setSectionImageUrls([])
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">記事生成</h1>
          <p className="text-stone-500 text-sm mt-1">AIを使ってブログ記事を生成します</p>
        </div>
        {step > 1 && (
          <button onClick={reset} className="text-sm text-stone-400 hover:text-stone-600 underline">
            最初からやり直す
          </button>
        )}
      </div>

      {/* プラットフォームタブ */}
      <div className="flex gap-2 mb-6">
        {(['shopify', 'note'] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); reset() }}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              platform === p
                ? 'bg-rose-600 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-rose-300'
            }`}
          >
            {p === 'shopify' ? 'Shopify' : 'note'}
          </button>
        ))}
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-3 mb-8">
        {(['入力・構成', '本文生成', 'SEO・SNS'] as const).map((label, i) => {
          const s = (i + 1) as Step
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= s ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-400'
                }`}
              >
                {s}
              </div>
              <span className={`text-sm ${step >= s ? 'text-stone-700' : 'text-stone-400'}`}>
                {label}
              </span>
              {s < 3 && (
                <div className={`w-8 h-0.5 ${step > s ? 'bg-rose-300' : 'bg-stone-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: 入力 */}
      {step === 1 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-5">キーワード・スタイルを入力</h2>
          <div className="space-y-5">

            {/* メインキーワード */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                メインキーワード <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateTitles()}
                placeholder="例：冷え性 レッグウォーマー 効果"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              <div className="mt-3 space-y-3">
                {[
                  ...KEYWORD_CHIP_GROUPS,
                  ...(platform === 'note' ? NOTE_KEYWORD_EXTRA : []),
                ].map(({ category, chips }) => (
                  <div key={category}>
                    <p className="text-xs text-stone-400 mb-1.5">{category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setKeyword(chip)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            keyword === chip
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-700'
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ターゲット読者 */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                ターゲット読者（任意）
              </label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="例：40代、冷え性で悩む会社員女性"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TARGET_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTarget(chip)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      target === chip
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-700'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* 記事スタイル */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">記事スタイル</label>
              <div className="flex gap-2 flex-wrap">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      style === s
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-400 mt-1.5">
                {style === '解説・情報系'
                  ? '正確な情報・わかりやすい説明を重視した構成になります'
                  : style === '比較・まとめ系'
                  ? '比較や箇条書きを活用した整理しやすい構成になります'
                  : 'ゆみの体験談ベースで等身大の語り口になります'}
              </p>
            </div>

            {/* アイキャッチ画像URL */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                アイキャッチ画像URL（任意）
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={eyecatchUrl}
                  onChange={(e) => setEyecatchUrl(e.target.value)}
                  placeholder="Shopifyアップロード後にここにセットされます"
                  className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
                {eyecatchUrl && (
                  <button
                    type="button"
                    onClick={() => setEyecatchUrl('')}
                    className="px-3 py-2.5 text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
              {eyecatchUrl && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ 画像ページからURLがセットされました
                </p>
              )}
            </div>

            {/* ブランドトーン（折りたたみ参照） */}
            <div className="bg-stone-50 rounded-lg p-3">
              <p className="text-xs font-medium text-stone-400 mb-1">
                ブランドトーン（{platform === 'shopify' ? 'Shopify' : 'note'}）
              </p>
              <p className="text-xs text-stone-500 leading-relaxed">{brandTone}</p>
            </div>

            <button
              onClick={generateTitles}
              disabled={!keyword.trim() || loading}
              className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '生成中...' : 'タイトル・構成を生成'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: タイトル選択・本文生成 */}
      {step === 2 && titlesResult && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
            <h2 className="text-base font-semibold text-stone-700 mb-4">タイトルを選択</h2>
            <div className="space-y-2">
              {titlesResult.titles.map((title, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTitle(title)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selectedTitle === title
                      ? 'border-rose-400 bg-rose-50 text-rose-800 font-medium'
                      : 'border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
            <h2 className="text-base font-semibold text-stone-700 mb-4">記事構成</h2>
            <div className="bg-stone-50 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-stone-500 mb-1">導入文</p>
              <p className="text-sm text-stone-700 leading-relaxed">{titlesResult.intro}</p>
            </div>
            <div className="space-y-3">
              {titlesResult.outline.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-700">{item.h2}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{item.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={generateBody}
            disabled={!selectedTitle || loading}
            className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '本文を生成中...' : '本文を生成'}
          </button>
        </div>
      )}

      {/* Step 3: 本文・SEO */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-stone-700">生成された本文</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-400">{body.length}文字</span>
                <button
                  onClick={() => copy(body, 'body')}
                  className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors"
                >
                  {copied === 'body' ? '✓ コピー済み' : 'コピー'}
                </button>
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-72 px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 font-mono focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          {!seoResult ? (
            <button
              onClick={generateSeo}
              disabled={loading}
              className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'SEO情報を生成中...' : 'SEO・SNS投稿文を一括生成'}
            </button>
          ) : (
            <div className="space-y-4">
              {/* SEOスコア */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                <h2 className="text-base font-semibold text-stone-700 mb-4">SEOスコア</h2>
                <div className="space-y-3 mb-4">
                  <ScoreBar label="タイトル" score={seoResult.seoScore.titleScore} />
                  <ScoreBar label="キーワード" score={seoResult.seoScore.keywordScore} />
                  <ScoreBar label="読みやすさ" score={seoResult.seoScore.readabilityScore} />
                </div>
                {seoResult.seoScore.advice.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3 space-y-1">
                    {seoResult.seoScore.advice.map((tip, i) => (
                      <p key={i} className="text-xs text-amber-800">
                        💡 {tip}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* メタ・スラッグ */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100 space-y-4">
                <h2 className="text-base font-semibold text-stone-700">SEO設定</h2>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-stone-600">
                      メタディスクリプション
                      <span className="text-xs text-stone-400 ml-2">
                        {seoResult.metaDescription.length}文字
                      </span>
                    </p>
                    <button
                      onClick={() => copy(seoResult.metaDescription, 'meta')}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      {copied === 'meta' ? '✓' : 'コピー'}
                    </button>
                  </div>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3 leading-relaxed">
                    {seoResult.metaDescription}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-stone-600">URLスラッグ</p>
                    <button
                      onClick={() => copy(seoResult.slug, 'slug')}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      {copied === 'slug' ? '✓' : 'コピー'}
                    </button>
                  </div>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3 font-mono">
                    {seoResult.slug}
                  </p>
                </div>
              </div>

              {/* SNS投稿文 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100 space-y-4">
                <h2 className="text-base font-semibold text-stone-700">SNS投稿文</h2>

                {/* Threads */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-stone-600">
                      Threads
                      <span className="text-xs text-stone-400 ml-2">
                        {seoResult.threadsText.length}文字
                      </span>
                    </p>
                    <button
                      onClick={() => copy(seoResult.threadsText, 'threads')}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      {copied === 'threads' ? '✓' : 'コピー'}
                    </button>
                  </div>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3 whitespace-pre-wrap">
                    {seoResult.threadsText}
                  </p>
                </div>

                {/* X */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-stone-600">
                      X（Twitter）
                      <span className="text-xs text-stone-400 ml-2">
                        {seoResult.xText.length}文字
                      </span>
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => copy(seoResult.xText, 'x')}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        {copied === 'x' ? '✓' : 'コピー'}
                      </button>
                      <button
                        onClick={() =>
                          window.open(
                            `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                              seoResult.xText
                            )}`,
                            '_blank'
                          )
                        }
                        className="text-xs text-blue-400 hover:text-blue-600"
                      >
                        Xで投稿
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3 whitespace-pre-wrap">
                    {seoResult.xText}
                  </p>
                </div>

                {/* note */}
                {platform === 'note' && (
                  <div className="pt-3 border-t border-stone-100">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-stone-600">note（本文・整形済み）</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => copy(formatForNote(body), 'note')}
                          className="text-xs text-stone-400 hover:text-stone-600"
                        >
                          {copied === 'note' ? '✓' : 'コピー'}
                        </button>
                        <button
                          onClick={() => window.open('https://note.com/notes/new', '_blank')}
                          className="text-xs text-emerald-500 hover:text-emerald-700"
                        >
                          noteを開く
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-stone-400">
                      ## マークダウンを ■ 形式に変換済み。noteに貼り付けてご利用ください。
                    </p>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 bg-stone-50 rounded-lg">
                <p className="text-xs text-stone-400">
                  ✓ 記事データを保存しました。「投稿・通知」ページからShopifyに投稿できます。
                </p>
              </div>

              {/* 画像プロンプト */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                <h2 className="text-base font-semibold text-stone-700 mb-4">画像プロンプト</h2>

                {/* サムネイル */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-stone-600">
                      サムネイル（16:9・DALL-E用）
                    </p>
                    {!thumbnailPrompt && (
                      <button
                        onClick={generateThumbnailPrompt}
                        disabled={imgLoading}
                        className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                      >
                        {imgLoading ? '生成中...' : 'プロンプトを生成'}
                      </button>
                    )}
                  </div>

                  {thumbnailPrompt ? (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-700 bg-stone-50 rounded-lg p-4 whitespace-pre-wrap leading-relaxed border border-stone-200">
                        {thumbnailPrompt}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(thumbnailPrompt)
                            setThumbnailCopied(true)
                            setTimeout(() => setThumbnailCopied(false), 2000)
                          }}
                          className="flex-1 py-2 bg-stone-100 text-stone-700 text-sm rounded-lg hover:bg-stone-200 transition-colors font-medium"
                        >
                          {thumbnailCopied ? '✓ コピー済み' : 'コピー'}
                        </button>
                        <button
                          onClick={() => window.open('https://chat.openai.com', '_blank')}
                          className="flex-1 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                        >
                          ChatGPTで開く
                        </button>
                      </div>
                      {thumbnailCopied && (
                        <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          💡 ChatGPTに貼り付けて「この内容で画像を生成してください」と送信してください。
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">
                      ボタンをクリックするとDALL-E向けの日本語プロンプトを生成します。
                    </p>
                  )}
                </div>

                {/* 記事挿入画像（サムネイル生成後に表示） */}
                {thumbnailPrompt && titlesResult && (
                  <div className="mt-6 pt-5 border-t border-stone-100 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-medium text-stone-600">記事挿入画像（任意）</p>
                      {sectionChecked.some(Boolean) && (
                        <button
                          onClick={generateSectionPrompts}
                          disabled={sectionLoading}
                          className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                        >
                          {sectionLoading ? '生成中...' : '選択セクションのプロンプトを生成'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-stone-400">
                      画像を挿入したいセクションにチェックを入れてください。
                    </p>

                    <div className="space-y-5">
                      {titlesResult.outline.map((item, i) => (
                        <div key={i}>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sectionChecked[i] ?? false}
                              onChange={(e) => {
                                const next = [...sectionChecked]
                                next[i] = e.target.checked
                                setSectionChecked(next)
                              }}
                              className="w-4 h-4 rounded accent-rose-600 shrink-0"
                            />
                            <span className="text-sm text-stone-700">{item.h2}</span>
                          </label>

                          {sectionChecked[i] && (
                            <div className="ml-6 mt-3 space-y-3">
                              {sectionPrompts[i] ? (
                                <>
                                  <p className="text-xs text-stone-700 bg-stone-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed border border-stone-200">
                                    {sectionPrompts[i]}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => copy(sectionPrompts[i], `sec_${i}`)}
                                      className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors"
                                    >
                                      {copied === `sec_${i}` ? '✓ コピー' : 'コピー'}
                                    </button>
                                    <button
                                      onClick={() => window.open('https://chat.openai.com', '_blank')}
                                      className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                                    >
                                      ChatGPTで開く
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <p className="text-xs text-stone-400">
                                  上の「選択セクションのプロンプトを生成」を押してください。
                                </p>
                              )}

                              <div>
                                <label className="block text-xs text-stone-500 mb-1">
                                  生成した画像のURL（Shopifyアップロード後に貼り付け）
                                </label>
                                <input
                                  type="text"
                                  value={sectionImageUrls[i] ?? ''}
                                  onChange={(e) => {
                                    const next = [...sectionImageUrls]
                                    next[i] = e.target.value
                                    setSectionImageUrls(next)
                                  }}
                                  placeholder="https://cdn.shopify.com/..."
                                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                                />
                                <p className="text-xs text-stone-400 mt-1">
                                  ChatGPTで画像を生成 → ダウンロード → 画像ページでトリミング → Shopifyにアップロード → URLをここに貼る
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-400 text-sm">読み込み中...</div>}>
      <WritePageContent />
    </Suspense>
  )
}
