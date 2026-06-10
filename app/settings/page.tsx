'use client'

import { useState, useEffect } from 'react'
import { DEFAULT_BRAND_TONE_SHOPIFY, DEFAULT_BRAND_TONE_NOTE, DEFAULT_MUST_KEYWORDS } from '@/lib/prompts'
import { loadSettings, saveSettings } from '@/lib/settings'

function getTokenStatus(refreshedAt?: string): {
  expiryDate: Date | null
  daysLeft: number | null
  isExpired: boolean
  isWarning: boolean
} {
  if (!refreshedAt) return { expiryDate: null, daysLeft: null, isExpired: false, isWarning: false }
  const expiry = new Date(refreshedAt)
  expiry.setDate(expiry.getDate() + 60)
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return {
    expiryDate: expiry,
    daysLeft,
    isExpired: daysLeft <= 0,
    isWarning: daysLeft > 0 && daysLeft <= 30,
  }
}

export default function SettingsPage() {
  const [shopifyTone, setShopifyTone] = useState(DEFAULT_BRAND_TONE_SHOPIFY)
  const [noteTone, setNoteTone] = useState(DEFAULT_BRAND_TONE_NOTE)
  const [mustKeywords, setMustKeywords] = useState(DEFAULT_MUST_KEYWORDS)
  const [threadsTokenRefreshedAt, setThreadsTokenRefreshedAt] = useState<string | undefined>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const s = loadSettings()
    setShopifyTone(s.shopifyTone)
    setNoteTone(s.noteTone)
    setMustKeywords(s.mustKeywords)
    setThreadsTokenRefreshedAt(s.threadsTokenRefreshedAt)
  }, [])

  function save() {
    saveSettings({ shopifyTone, noteTone, mustKeywords, threadsTokenRefreshedAt })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function markTokenRefreshed() {
    const now = new Date().toISOString()
    setThreadsTokenRefreshedAt(now)
    saveSettings({ shopifyTone, noteTone, mustKeywords, threadsTokenRefreshedAt: now })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function resetDefaults() {
    setShopifyTone(DEFAULT_BRAND_TONE_SHOPIFY)
    setNoteTone(DEFAULT_BRAND_TONE_NOTE)
    setMustKeywords(DEFAULT_MUST_KEYWORDS)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">設定</h1>
        <p className="text-stone-500 text-sm mt-1">ブランドトーン・キーワードの設定</p>
      </div>

      <div className="space-y-6">
        {/* ブランドトーン */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-stone-700">ブランドトーン</h2>
            <button
              onClick={resetDefaults}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              デフォルトに戻す
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Shopify用
              </label>
              <textarea
                value={shopifyTone}
                onChange={(e) => setShopifyTone(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                note用
              </label>
              <textarea
                value={noteTone}
                onChange={(e) => setNoteTone(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-y"
              />
            </div>
          </div>
        </div>

        {/* 必須キーワード */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-3">必須キーワード</h2>
          <input
            type="text"
            value={mustKeywords}
            onChange={(e) => setMustKeywords(e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <p className="text-xs text-stone-400 mt-2">
            カンマ区切りで入力。記事生成プロンプトに自動挿入されます。
          </p>
        </div>

        {/* 環境変数 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-3">環境変数の設定</h2>
          <div className="bg-stone-50 rounded-lg p-4 text-xs text-stone-600 font-mono space-y-1">
            {[
              'ANTHROPIC_API_KEY=sk-ant-...',
              'SHOPIFY_STORE_DOMAIN=imiel.myshopify.com',
              'SHOPIFY_ADMIN_API_TOKEN=shpat_...',
              'SHOPIFY_BLOG_ID=...',
              'THREADS_ACCESS_TOKEN=...',
              'THREADS_USER_ID=...',
            ].map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-3">
            開発時は <code className="bg-stone-100 px-1 rounded">.env.local</code>、本番は Vercel の環境変数に設定してください。
          </p>
        </div>

        {/* Threads トークン */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-700">Threads APIトークン</h2>
            {(() => {
              const { isExpired, isWarning, daysLeft } = getTokenStatus(threadsTokenRefreshedAt)
              if (isExpired) {
                return (
                  <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                    期限切れ
                  </span>
                )
              }
              if (isWarning) {
                return (
                  <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                    残り{daysLeft}日
                  </span>
                )
              }
              if (daysLeft !== null) {
                return (
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                    残り{daysLeft}日
                  </span>
                )
              }
              return null
            })()}
          </div>
          {threadsTokenRefreshedAt ? (
            <div className="mb-4 text-sm text-stone-600 space-y-1">
              <p>
                最終更新：{new Date(threadsTokenRefreshedAt).toLocaleDateString('ja-JP')}
              </p>
              <p>
                有効期限：{getTokenStatus(threadsTokenRefreshedAt).expiryDate?.toLocaleDateString('ja-JP')}
              </p>
              {getTokenStatus(threadsTokenRefreshedAt).isWarning && (
                <p className="text-orange-600 font-medium text-xs mt-1">
                  ⚠ 期限まで30日以内です。更新をお勧めします。
                </p>
              )}
              {getTokenStatus(threadsTokenRefreshedAt).isExpired && (
                <p className="text-red-600 font-medium text-xs mt-1">
                  トークンが期限切れです。すぐに更新してください。
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-500 mb-4">
              トークンを更新したら「更新しました」ボタンを押して期限を記録してください。（トークンは60日で期限切れ）
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
            >
              Meta Developer Console →
            </a>
            <button
              onClick={markTokenRefreshed}
              className="text-sm px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
            >
              トークンを更新しました
            </button>
          </div>
        </div>

        {/* X 投稿設定 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-3">X（Twitter）投稿</h2>
          <p className="text-sm text-stone-600 mb-1">
            APIキー不要。「投稿・通知」ページの「Xで投稿」ボタンを押すと、投稿文がセットされた状態でXの投稿画面が新タブで開きます。
          </p>
          <p className="text-xs text-stone-400">
            twitter.com/intent/tweet を使用しています。
          </p>
        </div>

        <button
          onClick={save}
          className="w-full py-3 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 transition-colors"
        >
          {saved ? '✓ 保存しました' : '設定を保存'}
        </button>
      </div>
    </div>
  )
}
