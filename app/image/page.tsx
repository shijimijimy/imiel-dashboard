'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PRESETS = [
  { label: 'Shopifyサムネイル', slug: 'shopify-thumbnail', width: 1200, height: 630 },
  { label: 'note見出し',        slug: 'note-header',       width: 1280, height: 670 },
  { label: 'SNS正方形',         slug: 'sns-square',        width: 1080, height: 1080 },
  { label: 'SNS縦長',           slug: 'sns-portrait',      width: 1080, height: 1350 },
] as const

type Preset = (typeof PRESETS)[number]
type BgType = 'blur' | 'white' | 'black' | 'transparent'
type PromptUsage = 'thumbnail' | 'eyecatch' | 'sns'

const BG_OPTIONS: { value: BgType; label: string; note?: string }[] = [
  { value: 'blur',        label: 'ぼかし背景', note: 'おすすめ' },
  { value: 'white',       label: '白背景' },
  { value: 'black',       label: '黒背景' },
  { value: 'transparent', label: '透明' },
]

const PROMPT_USAGES: { value: PromptUsage; label: string }[] = [
  { value: 'thumbnail', label: 'サムネイル' },
  { value: 'eyecatch',  label: '記事内アイキャッチ' },
  { value: 'sns',       label: 'SNS投稿用' },
]

function buildDefaultFileName(p: Preset): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `imiel-${p.slug}-${d}`
}

interface UploadResult {
  success: boolean
  message: string
  url?: string
  notConfigured?: boolean
}

export default function ImagePage() {
  const router = useRouter()
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'resize' | 'prompt'>('resize')

  // ── Tab 1 ──
  const [preset,       setPreset]       = useState<Preset>(PRESETS[0])
  const [imgEl,        setImgEl]        = useState<HTMLImageElement | null>(null)
  const [scale,        setScale]        = useState(1)
  const [offsetX,      setOffsetX]      = useState(0)
  const [offsetY,      setOffsetY]      = useState(0)
  const [bgType,       setBgType]       = useState<BgType>('blur')
  const [showGuide,    setShowGuide]    = useState(false)
  const [fileName,     setFileName]     = useState(buildDefaultFileName(PRESETS[0]))
  const [isDragOver,   setIsDragOver]   = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [urlCopied,    setUrlCopied]    = useState(false)

  // ── Tab 2 ──
  const [promptTitle,     setPromptTitle]     = useState('')
  const [promptUsage,     setPromptUsage]     = useState<PromptUsage>('thumbnail')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [promptLoading,   setPromptLoading]   = useState(false)
  const [promptCopied,    setPromptCopied]    = useState(false)
  const [promptError,     setPromptError]     = useState('')

  // keep ref to latest preset so paste handler avoids stale closure
  const presetRef = useRef(preset)
  useEffect(() => { presetRef.current = preset }, [preset])

  // ── Canvas rendering ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = preset.width
    const H = preset.height

    ctx.clearRect(0, 0, W, H)

    if (!imgEl) {
      ctx.fillStyle = '#f5f5f4'
      ctx.fillRect(0, 0, W, H)
      return
    }

    if (bgType === 'white') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
    } else if (bgType === 'black') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
    } else if (bgType === 'blur') {
      const iR = imgEl.naturalWidth / imgEl.naturalHeight
      const cR = W / H
      let bw: number, bh: number
      if (iR > cR) { bh = H; bw = H * iR }
      else          { bw = W; bh = W / iR }
      const bx = (W - bw) / 2
      const by = (H - bh) / 2
      const m  = 50
      ctx.save()
      ctx.filter = 'blur(25px)'
      ctx.drawImage(imgEl, bx - m, by - m, bw + m * 2, bh + m * 2)
      ctx.filter = 'none'
      ctx.restore()
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(0, 0, W, H)
    }
    // transparent → clearRect only

    // main image
    const imgW = imgEl.naturalWidth  * scale
    const imgH = imgEl.naturalHeight * scale
    ctx.drawImage(imgEl, (W - imgW) / 2 + offsetX, (H - imgH) / 2 + offsetY, imgW, imgH)

    // rule-of-thirds guideline
    if (showGuide) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth   = Math.max(1, W / 600)
      ctx.setLineDash([6, 6])
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(0, H * i / 3);       ctx.lineTo(W, H * i / 3);       ctx.stroke()
        ctx.beginPath(); ctx.moveTo(W * i / 3, 0);       ctx.lineTo(W * i / 3, H);       ctx.stroke()
      }
      ctx.restore()
    }
  }, [imgEl, scale, offsetX, offsetY, bgType, showGuide, preset])

  // ── Clipboard paste ──
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) loadImageFromFile(f, presetRef.current)
          break
        }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [])

  function loadImageFromFile(file: File, p: Preset = preset) {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setImgEl(img)
        const sw = p.width  / img.naturalWidth
        const sh = p.height / img.naturalHeight
        setScale(Math.min(sw, sh))
        setOffsetX(0)
        setOffsetY(0)
        setUploadResult(null)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  function fitImage() {
    if (!imgEl) return
    setScale(Math.min(preset.width / imgEl.naturalWidth, preset.height / imgEl.naturalHeight))
    setOffsetX(0)
    setOffsetY(0)
  }

  async function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('empty')), 'image/jpeg', 0.92)
    })
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `${fileName}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function uploadToShopify() {
    const canvas = canvasRef.current
    if (!canvas) return
    setUploading(true)
    setUploadResult(null)
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('empty')), 'image/jpeg', 0.92)
      })
      const file = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' })
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/shopify-image', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error === 'SHOPIFY_NOT_CONFIGURED') {
        setUploadResult({ success: false, message: data.message, notConfigured: true })
        return
      }
      if (!res.ok) throw new Error(data.error || 'アップロードエラー')
      setUploadResult({ success: true, message: 'Shopifyにアップロードしました！', url: data.url })
    } catch (e) {
      setUploadResult({ success: false, message: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function generatePrompt() {
    if (!promptTitle.trim()) return
    setPromptLoading(true)
    setPromptError('')
    setGeneratedPrompt('')
    try {
      const res  = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'chatgpt_image', title: promptTitle, usage: promptUsage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'エラーが発生しました')
      setGeneratedPrompt(data.result.trim())
    } catch (e) {
      setPromptError((e as Error).message)
    } finally {
      setPromptLoading(false)
    }
  }

  const maxOfs = Math.max(preset.width, preset.height) * 0.8

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">画像編集</h1>
        <p className="text-stone-500 text-sm mt-1">サイズ調整・ChatGPT画像プロンプト生成</p>
      </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'resize' as const, label: 'サイズ調整' },
          { id: 'prompt' as const, label: 'ChatGPT画像プロンプト' },
        ]).map(({ id, label }) => (
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

      {/* ═══════════════════════════════════════════════
          Tab 1: サイズ調整
      ═══════════════════════════════════════════════ */}
      <div className={tab === 'resize' ? '' : 'hidden'}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6">

          {/* ── 左：コントロール ── */}
          <div className="space-y-4">

            {/* プリセット選択 */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
              <p className="text-sm font-semibold text-stone-700 mb-3">出力サイズを選択</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      setPreset(p)
                      setFileName(buildDefaultFileName(p))
                      setUploadResult(null)
                      if (imgEl) {
                        setScale(Math.min(p.width / imgEl.naturalWidth, p.height / imgEl.naturalHeight))
                        setOffsetX(0)
                        setOffsetY(0)
                      }
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-left transition-colors ${
                      preset.slug === p.slug
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300'
                    }`}
                  >
                    <div className="text-xs font-medium">{p.label}</div>
                    <div className={`text-xs mt-0.5 ${preset.slug === p.slug ? 'text-rose-200' : 'text-stone-400'}`}>
                      {p.width}×{p.height}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* アップロード */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
              <p className="text-sm font-semibold text-stone-700 mb-3">画像をアップロード</p>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f?.type.startsWith('image/')) loadImageFromFile(f)
                }}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors select-none ${
                  isDragOver
                    ? 'border-rose-400 bg-rose-50'
                    : 'border-stone-300 hover:border-rose-300 hover:bg-rose-50'
                }`}
              >
                <p className="text-sm text-stone-500 mb-1">クリック・ドラッグ＆ドロップ</p>
                <p className="text-xs text-stone-400">
                  または{' '}
                  <kbd className="bg-stone-100 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+V</kbd>
                  {' '}で貼り付け
                </p>
                <p className="text-xs text-stone-400 mt-1">JPG / PNG / WEBP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImageFromFile(f) }}
              />
            </div>

            {/* 画像調整（画像読み込み後に表示） */}
            {imgEl && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-stone-700">画像調整</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={fitImage}
                      className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600 rounded-lg transition-colors"
                    >
                      フィット
                    </button>
                    <button
                      onClick={() => { setOffsetX(0); setOffsetY(0) }}
                      className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors"
                    >
                      位置リセット
                    </button>
                  </div>
                </div>

                {/* スライダー群 */}
                {[
                  {
                    label: '拡大縮小',
                    display: `${Math.round(scale * 100)}%`,
                    min: 10, max: 300, step: 5,
                    value: Math.round(scale * 100),
                    onChange: (v: number) => setScale(v / 100),
                  },
                  {
                    label: '左右位置',
                    display: `${offsetX}px`,
                    min: -maxOfs, max: maxOfs, step: 10,
                    value: offsetX,
                    onChange: (v: number) => setOffsetX(v),
                  },
                  {
                    label: '上下位置',
                    display: `${offsetY}px`,
                    min: -maxOfs, max: maxOfs, step: 10,
                    value: offsetY,
                    onChange: (v: number) => setOffsetY(v),
                  },
                ].map(({ label, display, min, max, step, value, onChange }) => (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-stone-500">{label}</label>
                      <span className="text-xs font-mono text-stone-700">{display}</span>
                    </div>
                    <input
                      type="range"
                      min={min} max={max} step={step} value={value}
                      onChange={(e) => onChange(Number(e.target.value))}
                      className="w-full accent-rose-600"
                    />
                  </div>
                ))}

                {/* 余白の背景 */}
                <div>
                  <p className="text-xs text-stone-500 mb-2">余白の背景</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BG_OPTIONS.map(({ value, label, note }) => (
                      <button
                        key={value}
                        onClick={() => setBgType(value)}
                        className={`py-2 px-3 rounded-lg border text-xs text-left transition-colors ${
                          bgType === value
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300'
                        }`}
                      >
                        {label}
                        {note && (
                          <span className={`ml-1 ${bgType === value ? 'text-rose-200' : 'text-stone-400'}`}>
                            ({note})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 出力・アップロード */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100 space-y-4">
              <p className="text-sm font-semibold text-stone-700">出力・アップロード</p>

              {/* ファイル名 */}
              <div>
                <label className="text-xs text-stone-500 mb-1 block">ファイル名</label>
                <div className="flex">
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-l-lg text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                  <span className="px-3 py-2 bg-stone-50 border border-l-0 border-stone-200 rounded-r-lg text-xs text-stone-400">
                    .jpg
                  </span>
                </div>
              </div>

              {/* ガイドライン */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGuide}
                  onChange={(e) => setShowGuide(e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-600"
                />
                <span className="text-xs text-stone-600">1/3ガイドラインを表示</span>
              </label>

              {/* ボタン */}
              <div className="flex gap-2">
                <button
                  onClick={download}
                  className="flex-1 py-2.5 bg-stone-100 text-stone-700 text-sm rounded-lg hover:bg-stone-200 font-medium transition-colors"
                >
                  ダウンロード
                </button>
                <button
                  onClick={uploadToShopify}
                  disabled={uploading}
                  className="flex-1 py-2.5 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {uploading ? 'アップロード中...' : 'Shopifyにアップロード'}
                </button>
              </div>

              {/* アップロード結果 */}
              {uploadResult && (
                <div
                  className={`rounded-lg p-4 ${
                    uploadResult.success
                      ? 'bg-emerald-50 border border-emerald-200'
                      : uploadResult.notConfigured
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {uploadResult.success ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-emerald-700">✓ {uploadResult.message}</p>
                      {uploadResult.url ? (
                        <>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-mono truncate flex-1 bg-white rounded px-2 py-1 border border-emerald-200 text-emerald-700">
                              {uploadResult.url}
                            </p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(uploadResult.url!)
                                setUrlCopied(true)
                                setTimeout(() => setUrlCopied(false), 2000)
                              }}
                              className="shrink-0 text-xs px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              {urlCopied ? '✓' : 'コピー'}
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              localStorage.setItem('imiel_eyecatch_url', uploadResult.url!)
                              router.push('/write')
                            }}
                            className="w-full py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 font-medium transition-colors"
                          >
                            記事に使う →
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-emerald-600">URLはShopify管理画面で確認できます</p>
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
            </div>
          </div>

          {/* ── 右：プレビュー ── */}
          <div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-stone-700">プレビュー</p>
                <p className="text-xs text-stone-400">{preset.width} × {preset.height}px</p>
              </div>
              <div
                className="bg-stone-200 rounded-lg overflow-hidden"
                style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
              >
                <canvas
                  ref={canvasRef}
                  width={preset.width}
                  height={preset.height}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
              </div>
              {!imgEl && (
                <p className="text-xs text-stone-400 text-center mt-2">
                  画像をアップロードするとプレビューが表示されます
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          Tab 2: ChatGPT画像プロンプト
      ═══════════════════════════════════════════════ */}
      <div className={tab === 'prompt' ? 'max-w-2xl' : 'hidden'}>
        <div className="space-y-5">

          {/* 使い方ガイド */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800 leading-relaxed">
              💡 プロンプトをコピーしてChatGPTで画像を生成 → ダウンロードして「サイズ調整」タブでサイズを整えてください。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100 space-y-5">
            {/* タイトル入力 */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                記事タイトル <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
                placeholder="例：映画館の冷えが気になるあなたへ"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            {/* 用途選択 */}
            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">画像の用途</p>
              <div className="flex gap-2 flex-wrap">
                {PROMPT_USAGES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setPromptUsage(value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      promptUsage === value
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {promptError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {promptError}
              </div>
            )}

            <button
              onClick={generatePrompt}
              disabled={!promptTitle.trim() || promptLoading}
              className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {promptLoading ? '生成中...' : 'プロンプトを生成'}
            </button>
          </div>

          {/* 生成結果 */}
          {generatedPrompt && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100 space-y-4">
              <p className="text-sm font-semibold text-stone-700">生成されたプロンプト</p>
              <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                  {generatedPrompt}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPrompt)
                    setPromptCopied(true)
                    setTimeout(() => setPromptCopied(false), 2000)
                  }}
                  className="flex-1 py-2.5 bg-stone-100 text-stone-700 text-sm rounded-lg hover:bg-stone-200 font-medium transition-colors"
                >
                  {promptCopied ? '✓ コピー済み' : 'コピー'}
                </button>
                <button
                  onClick={() => window.open('https://chat.openai.com', '_blank')}
                  className="flex-1 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium transition-colors"
                >
                  ChatGPTを開く
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
