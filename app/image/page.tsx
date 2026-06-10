'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

const PRESETS = [
  { label: 'Shopifyサムネイル', slug: 'shopify-thumbnail', width: 1200, height: 630 },
  { label: 'note見出し',        slug: 'note-header',       width: 1280, height: 670 },
  { label: 'SNS正方形',         slug: 'sns-square',        width: 1080, height: 1080 },
  { label: 'SNS縦長',           slug: 'sns-portrait',      width: 1080, height: 1350 },
]

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  )
}

async function cropToBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  canvas.width = Math.floor(crop.width * scaleX)
  canvas.height = Math.floor(crop.height * scaleY)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas is empty'))),
      'image/jpeg',
      0.85
    )
  })
}

function buildFileName(presetSlug: string | null): string {
  const slug = presetSlug ?? 'custom'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `imiel-${slug}-${date}.jpg`
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

interface TrimUploadResult {
  success: boolean
  message: string
  url?: string
  previewObjectUrl?: string
  notConfigured?: boolean
}

export default function ImagePage() {
  const router = useRouter()
  const [tab, setTab] = useState<'trim' | 'prompt' | 'upload'>('trim')

  // トリミング
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)
  const [fileName, setFileName] = useState('image')
  const [selectedPreset, setSelectedPreset] = useState<typeof PRESETS[number] | null>(null)
  const [trimUploading, setTrimUploading] = useState(false)
  const [trimUploadResult, setTrimUploadResult] = useState<TrimUploadResult | null>(null)
  const [trimCopied, setTrimCopied] = useState(false)

  // プロンプト生成
  const [title, setTitle] = useState('')
  const [keyword, setKeyword] = useState('')
  const [promptResult, setPromptResult] = useState<{
    midjourney_thumbnail: string
    midjourney_eyecatch: string
    dalle_thumbnail: string
    dalle_eyecatch: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 別タブ用アップロード（ファイル選択式）
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<TrimUploadResult | null>(null)
  const [uploadCopied, setUploadCopied] = useState(false)

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name.replace(/\.[^.]+$/, ''))
    setSelectedPreset(null)
    setTrimUploadResult(null)
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 16 / 9))
  }

  function applyPreset(preset: typeof PRESETS[number]) {
    if (!imgRef.current) return
    const { width, height } = imgRef.current
    setCrop(centerAspectCrop(width, height, preset.width / preset.height))
    setSelectedPreset(preset)
    setTrimUploadResult(null)
  }

  async function downloadCrop() {
    if (!completedCrop || !imgRef.current) return
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildFileName(selectedPreset?.slug ?? null)
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    }
  }

  async function uploadTrimToShopify() {
    if (!completedCrop || !imgRef.current) return
    setTrimUploading(true)
    setTrimUploadResult(null)
    let previewObjectUrl: string | undefined
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop)
      previewObjectUrl = URL.createObjectURL(blob)
      const generatedName = buildFileName(selectedPreset?.slug ?? null)
      const file = new File([blob], generatedName, { type: 'image/jpeg' })
      const form = new FormData()
      form.append('file', file)
      form.append('altText', 'IMIELブログ画像')
      const res = await fetch('/api/shopify-image', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error === 'SHOPIFY_NOT_CONFIGURED') {
        setTrimUploadResult({
          success: false,
          message: data.message,
          notConfigured: true,
        })
        URL.revokeObjectURL(previewObjectUrl)
        return
      }
      if (!res.ok) throw new Error(data.error || 'アップロードエラー')
      setTrimUploadResult({
        success: true,
        message: 'Shopifyにアップロードしました！',
        url: data.url,
        previewObjectUrl,
      })
    } catch (e) {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
      setTrimUploadResult({ success: false, message: (e as Error).message })
    } finally {
      setTrimUploading(false)
    }
  }

  function copyTrimUrl() {
    if (!trimUploadResult?.url) return
    navigator.clipboard.writeText(trimUploadResult.url)
    setTrimCopied(true)
    setTimeout(() => setTrimCopied(false), 2000)
  }

  function useInArticle(url: string) {
    localStorage.setItem('imiel_eyecatch_url', url)
    router.push('/write')
  }

  async function generatePrompt() {
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image', title, keyword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const parsed = parseJSON<{
        midjourney_thumbnail: string
        midjourney_eyecatch: string
        dalle_thumbnail: string
        dalle_eyecatch: string
      }>(data.result)
      if (!parsed) throw new Error('レスポンスの解析に失敗しました')
      setPromptResult(parsed)
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

  async function uploadFileToShopify() {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('altText', uploadAlt)
      const res = await fetch('/api/shopify-image', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error === 'SHOPIFY_NOT_CONFIGURED') {
        setUploadResult({ success: false, message: data.message, notConfigured: true })
        return
      }
      if (!res.ok) throw new Error(data.error || 'アップロードエラー')
      setUploadResult({
        success: true,
        message: 'Shopifyにアップロードしました！',
        url: data.url,
      })
    } catch (e) {
      setUploadResult({ success: false, message: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">画像編集</h1>
        <p className="text-stone-500 text-sm mt-1">トリミング・プロンプト生成・Shopifyアップロード</p>
      </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: 'trim', label: '画像トリミング' },
          { id: 'prompt', label: 'プロンプト生成' },
          { id: 'upload', label: 'Shopifyアップロード' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-rose-600 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-rose-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── トリミングタブ ── */}
      {tab === 'trim' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
            <label className="block">
              <span className="text-sm font-medium text-stone-600 mb-2 block">
                画像をアップロード（JPG / PNG / WEBP）
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onSelectFile}
                className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
              />
            </label>
          </div>

          {imgSrc && (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                <p className="text-sm font-medium text-stone-600 mb-3">プリセットサイズ</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        selectedPreset?.slug === p.slug
                          ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-400'
                          : 'bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600'
                      }`}
                    >
                      {p.label}
                      <span className="text-stone-400 ml-1">{p.width}×{p.height}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => { setCrop(undefined); setSelectedPreset(null) }}
                    className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors"
                  >
                    自由選択
                  </button>
                </div>
                <div className="flex justify-center bg-stone-100 rounded-lg p-4">
                  <ReactCrop
                    crop={crop}
                    onChange={setCrop}
                    onComplete={setCompletedCrop}
                    minWidth={10}
                    minHeight={10}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imgRef}
                      src={imgSrc}
                      alt="トリミング対象"
                      onLoad={onImageLoad}
                      style={{ maxWidth: '100%', maxHeight: '480px' }}
                    />
                  </ReactCrop>
                </div>
                {completedCrop && (
                  <p className="text-xs text-stone-400 mt-2 text-center">
                    選択範囲: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px（表示上）
                    {selectedPreset && (
                      <span className="ml-2 text-stone-400">
                        · ファイル名: {buildFileName(selectedPreset.slug)}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3">
                <button
                  onClick={downloadCrop}
                  disabled={!completedCrop}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 rounded-lg font-medium text-sm hover:bg-stone-200 disabled:opacity-50 transition-colors"
                >
                  ダウンロード
                </button>
                <button
                  onClick={uploadTrimToShopify}
                  disabled={!completedCrop || trimUploading}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  {trimUploading ? 'アップロード中...' : 'Shopifyにアップロード'}
                </button>
              </div>

              {/* アップロード結果 */}
              {trimUploadResult && (
                <div
                  className={`rounded-xl p-5 border ${
                    trimUploadResult.success
                      ? 'bg-emerald-50 border-emerald-200'
                      : trimUploadResult.notConfigured
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  {trimUploadResult.success ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-emerald-700">
                        ✓ {trimUploadResult.message}
                      </p>
                      {trimUploadResult.previewObjectUrl && (
                        <div className="flex items-start gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={trimUploadResult.previewObjectUrl}
                            alt="アップロードした画像"
                            className="w-24 h-16 object-cover rounded-lg border border-emerald-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            {trimUploadResult.url ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-emerald-700 font-mono truncate flex-1 bg-white rounded px-2 py-1 border border-emerald-200">
                                    {trimUploadResult.url}
                                  </p>
                                  <button
                                    onClick={copyTrimUrl}
                                    className="shrink-0 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                  >
                                    {trimCopied ? '✓ コピー' : 'コピー'}
                                  </button>
                                </div>
                                <button
                                  onClick={() => useInArticle(trimUploadResult.url!)}
                                  className="w-full py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 transition-colors font-medium"
                                >
                                  ブログ記事で使う →
                                </button>
                              </>
                            ) : (
                              <p className="text-xs text-emerald-600">
                                URLはShopify管理画面で確認できます（処理中の可能性があります）
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className={`text-sm font-medium ${trimUploadResult.notConfigured ? 'text-amber-700' : 'text-red-700'}`}>
                        {trimUploadResult.notConfigured ? '⚠ ' : '✕ '}
                        {trimUploadResult.message}
                      </p>
                      {trimUploadResult.notConfigured && (
                        <a
                          href="/settings"
                          className="text-xs text-amber-600 underline mt-1 inline-block"
                        >
                          設定ページへ →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── プロンプト生成タブ ── */}
      {tab === 'prompt' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
            <h2 className="text-base font-semibold text-stone-700 mb-4">
              Midjourney / DALL-E 用プロンプト生成
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  記事タイトル <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：冷え性に悩む40代が実感したシルクレッグウォーマーの効果"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  キーワード（任意）
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例：温活 シルク レッグウォーマー"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                onClick={generatePrompt}
                disabled={!title.trim() || loading}
                className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '生成中...' : 'プロンプトを生成'}
              </button>
            </div>
          </div>

          {promptResult && (
            <div className="space-y-4">
              {[
                {
                  badge: 'Midjourney',
                  badgeClass: 'bg-violet-100 text-violet-700',
                  items: [
                    { label: 'サムネイル（16:9）', text: promptResult.midjourney_thumbnail, key: 'mj_thumb' },
                    { label: 'アイキャッチ（4:3）', text: promptResult.midjourney_eyecatch, key: 'mj_eye' },
                  ],
                },
                {
                  badge: 'DALL-E / ChatGPT',
                  badgeClass: 'bg-emerald-100 text-emerald-700',
                  items: [
                    { label: 'サムネイル（16:9）', text: promptResult.dalle_thumbnail, key: 'de_thumb' },
                    { label: 'アイキャッチ（4:3）', text: promptResult.dalle_eyecatch, key: 'de_eye' },
                  ],
                },
              ].map(({ badge, badgeClass, items }) => (
                <div key={badge} className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                  <div className="mb-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                      {badge}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {items.map(({ label, text, key }) => (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-medium text-stone-500">{label}</p>
                          <button
                            onClick={() => copy(text, key)}
                            className="text-xs text-stone-400 hover:text-stone-600"
                          >
                            {copied === key ? '✓ コピー済み' : 'コピー'}
                          </button>
                        </div>
                        <p className="text-xs text-stone-700 bg-stone-50 rounded-lg p-3 font-mono leading-relaxed break-all">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shopifyアップロードタブ（ファイル選択式） ── */}
      {tab === 'upload' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
            <h2 className="text-base font-semibold text-stone-700 mb-4">
              Shopify ファイルライブラリにアップロード
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  画像ファイル <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null)
                    setUploadResult(null)
                    setUploadCopied(false)
                  }}
                  className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  alt テキスト（任意）
                </label>
                <input
                  type="text"
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  placeholder="例：シルクレッグウォーマーを着用した女性"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              {uploadResult && (
                <div
                  className={`rounded-xl p-4 border ${
                    uploadResult.success
                      ? 'bg-emerald-50 border-emerald-200'
                      : uploadResult.notConfigured
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  {uploadResult.success ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-emerald-700">✓ {uploadResult.message}</p>
                      {uploadResult.url && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-emerald-700 font-mono truncate flex-1 bg-white rounded px-2 py-1 border border-emerald-200">
                              {uploadResult.url}
                            </p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(uploadResult.url!)
                                setUploadCopied(true)
                                setTimeout(() => setUploadCopied(false), 2000)
                              }}
                              className="shrink-0 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              {uploadCopied ? '✓' : 'コピー'}
                            </button>
                          </div>
                          <button
                            onClick={() => useInArticle(uploadResult.url!)}
                            className="w-full py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 transition-colors font-medium"
                          >
                            ブログ記事で使う →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className={`text-sm font-medium ${uploadResult.notConfigured ? 'text-amber-700' : 'text-red-700'}`}>
                        {uploadResult.notConfigured ? '⚠ ' : '✕ '}{uploadResult.message}
                      </p>
                      {uploadResult.notConfigured && (
                        <a href="/settings" className="text-xs text-amber-600 underline mt-1 inline-block">
                          設定ページへ →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={uploadFileToShopify}
                disabled={!uploadFile || uploading}
                className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'アップロード中...' : 'Shopifyにアップロード'}
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-400 px-1">
            Shopify管理画面の「コンテンツ → ファイル」に保存されます。
          </p>
        </div>
      )}
    </div>
  )
}
