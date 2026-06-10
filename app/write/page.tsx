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

const KEYWORD_TAG_GROUPS = [
  {
    category: '場所',
    tags: ['オフィス', '映画館', '新幹線', 'カフェ', '自宅', 'スーパー', '飛行機', '電車', '病院', '美容院'],
  },
  {
    category: '症状・悩み',
    tags: ['冷え', 'むくみ', '冷え性', '低体温', '末端冷え', '内臓冷え', '不眠', '肩こり', '疲れ', '肌荒れ', '便秘', '頭痛', '血行不良', '体重増加', '免疫低下'],
  },
  {
    category: 'ケア・グッズ',
    tags: ['温活', 'レッグウォーマー', 'シルク', '腹巻き', 'カイロ', '足湯', '冷えとり', '靴下', 'セルフケア', 'グッズ', 'お風呂', '生姜', 'ホットドリンク', 'ストレッチ', 'マッサージ'],
  },
  {
    category: '季節・状況',
    tags: ['夏', '冬', '梅雨', '秋', '冷房', '寒暖差', '夜', '朝', '寝るとき', '仕事中'],
  },
]

const TARGET_TAG_GROUPS = [
  {
    category: '年代',
    tags: ['20代', '30代', '40代', '50代', '60代', '働く世代', 'ミドル世代', 'アラフォー'],
  },
  {
    category: '職業・状況',
    tags: ['会社員', '主婦', 'パート', '在宅ワーク', 'フリーランス', '育児中', '産後', '妊活中', '共働き', '夜勤'],
  },
  {
    category: '健康状態',
    tags: ['冷え性', '更年期', '生理痛', 'PMS', '生理不順', '低体温', '疲れやすい', 'むくみ持ち', '眠れない', '肌荒れ', '体質改善', '妊活'],
  },
  {
    category: '意識・性格',
    tags: ['ズボラ', '忙しい', '初心者', 'おしゃれ好き', '健康意識高め', '自然素材好き', 'コスパ重視', 'シンプル好き', 'グッズ好き', '無理したくない'],
  },
  {
    category: 'ライフスタイル',
    tags: ['一人暮らし', '子育て', '旅行好き', 'アウトドア', 'インドア', 'デスクワーク', '立ち仕事', '外回り', '在宅', 'アクティブ'],
  },
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

  // 体験談メモ
  const [memos, setMemos] = useState<string[]>([''])

  // キーワード・ターゲットタグ選択
  const [selectedKeywordTags, setSelectedKeywordTags] = useState<Set<string>>(new Set())
  const [openKeywordCat, setOpenKeywordCat] = useState('場所')
  const [selectedTargetTags, setSelectedTargetTags] = useState<Set<string>>(new Set())
  const [openTargetCat, setOpenTargetCat] = useState('年代')

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
        userMemos: memosText || undefined,
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
        userMemos: memosText || undefined,
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

  function toggleKeywordTag(tag: string) {
    const next = new Set(selectedKeywordTags)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    setSelectedKeywordTags(next)
    setKeyword([...next].join(' '))
  }

  function toggleTargetTag(tag: string) {
    const next = new Set(selectedTargetTags)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    setSelectedTargetTags(next)
    setTarget([...next].join(' '))
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
    setSelectedKeywordTags(new Set())
    setSelectedTargetTags(new Set())
    setOpenKeywordCat('場所')
    setOpenTargetCat('年代')
    setMemos([''])
  }

  const memosText = memos.filter(m => m.trim()).join('\n')

  function addMemo() {
    if (memos.length < 5) setMemos([...memos, ''])
  }

  function removeMemo(i: number) {
    setMemos(memos.filter((_, idx) => idx !== i))
  }

  function updateMemo(i: number, value: string) {
    const next = [...memos]
    next[i] = value
    setMemos(next)
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-stone-600">
                  メインキーワード <span className="text-rose-500">*</span>
                </label>
                {selectedKeywordTags.size > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedKeywordTags(new Set()); setKeyword('') }}
                    className="text-xs text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    選択をリセット
                  </button>
                )}
              </div>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateTitles()}
                placeholder="タグを選択、または直接入力（例：冷え オフィス 温活）"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200">
                {KEYWORD_TAG_GROUPS.map(({ category, tags }) => {
                  const selectedCount = tags.filter(t => selectedKeywordTags.has(t)).length
                  const isOpen = openKeywordCat === category
                  return (
                    <div key={category}>
                      <button
                        type="button"
                        onClick={() => setOpenKeywordCat(isOpen ? '' : category)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-700">{category}</span>
                          {selectedCount > 0 && (
                            <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">
                              {selectedCount}
                            </span>
                          )}
                        </span>
                        <span className="text-stone-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 py-3 flex flex-wrap gap-1.5 bg-white">
                          {tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleKeywordTag(tag)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                selectedKeywordTags.has(tag)
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-700'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ターゲット読者 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-stone-600">
                  ターゲット読者（任意）
                </label>
                {selectedTargetTags.size > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedTargetTags(new Set()); setTarget('') }}
                    className="text-xs text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    選択をリセット
                  </button>
                )}
              </div>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="タグを選択、または直接入力（例：40代 冷え性 デスクワーク）"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200">
                {TARGET_TAG_GROUPS.map(({ category, tags }) => {
                  const selectedCount = tags.filter(t => selectedTargetTags.has(t)).length
                  const isOpen = openTargetCat === category
                  return (
                    <div key={category}>
                      <button
                        type="button"
                        onClick={() => setOpenTargetCat(isOpen ? '' : category)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-700">{category}</span>
                          {selectedCount > 0 && (
                            <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">
                              {selectedCount}
                            </span>
                          )}
                        </span>
                        <span className="text-stone-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 py-3 flex flex-wrap gap-1.5 bg-white">
                          {tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTargetTag(tag)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                selectedTargetTags.has(tag)
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-700'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 体験談・伝えたいこと */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                体験談・伝えたいこと（任意）
              </label>
              <p className="text-xs text-stone-400 mb-3 leading-relaxed">
                記事に入れたいエピソード、伝えたい気持ち、実際にあった出来事などを自由に書いてください。
                AIがこの内容を記事に自然に組み込みます。
              </p>
              <div className="space-y-2">
                {memos.map((memo, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <textarea
                      value={memo}
                      onChange={(e) => updateMemo(i, e.target.value)}
                      rows={5}
                      placeholder={
                        i === 0
                          ? `例：\n・映画館で足が冷えすぎて集中できなかった体験\n・レッグウォーマーを使ったら最後まで楽しめた\n・最初は見た目が気になったけど慣れたら手放せない\n・バッグに入れておくと安心感がある`
                          : '体験談やエピソードを入力…'
                      }
                      className="flex-1 px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-y"
                    />
                    {memos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMemo(i)}
                        className="mt-1 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {memos.length < 5 && (
                <button
                  type="button"
                  onClick={addMemo}
                  className="mt-2 flex items-center gap-1 text-xs text-stone-500 hover:text-rose-600 transition-colors"
                >
                  <span>＋ メモを追加</span>
                  <span className="text-stone-300">（最大{5 - memos.length}件追加できます）</span>
                </button>
              )}
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
