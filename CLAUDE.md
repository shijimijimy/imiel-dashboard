# IMIEL コンテンツ管理ダッシュボード

## プロジェクト概要
IMIELブランド（40代女性向け温活・シルク混レッグウォーマー）のコンテンツ制作・投稿を一元管理するWebアプリ。
3人のチームがVercelにデプロイされたURLにアクセスして使う。

## 技術スタック
- フレームワーク: Next.js 14（App Router）
- スタイル: Tailwind CSS
- デプロイ: Vercel（無料プラン）
- 画像編集: react-image-crop（ブラウザ完結）
- 状態管理: React useState / useContext

---

## 環境変数（.env.local / Vercel環境変数）

```
ANTHROPIC_API_KEY=sk-ant-...
SHOPIFY_STORE_DOMAIN=imiel.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_...
SHOPIFY_BLOG_ID=...
THREADS_ACCESS_TOKEN=...
THREADS_USER_ID=...
```

---

## ディレクトリ構成

```
/app
  /layout.tsx
  /page.tsx               # ダッシュボード
  /keywords/page.tsx      # キーワード収集
  /write/page.tsx         # 記事生成（Shopify / note）
  /image/page.tsx         # 画像トリミング・プロンプト生成
  /post/page.tsx          # 投稿・通知
  /articles/page.tsx      # 記事一覧
  /settings/page.tsx      # 設定
/app/api
  /generate/route.ts      # Claude API（記事・キーワード・SEO）
  /shopify/route.ts       # Shopify Admin API
  /threads/route.ts       # Threads API
/lib
  /prompts.ts             # 全プロンプト定義
  /shopify.ts             # Shopify APIクライアント
  /threads.ts             # Threads APIクライアント
```

---

## ブランド文体（学習済み・プロンプトに必ず使用）

実際のIMIELブログ記事を分析した文体ルール。全プロンプトに組み込むこと。

### 文体の特徴

**口調・人称**
- 一人称は「私」
- 執筆者名は「ゆみ」（記事冒頭に「こんにちは。IMIELのゆみです。」と入れる場合もある）
- 読者への語りかけは「〜ですよね」「〜ありませんか？」「〜でして」
- 丁寧語だが堅くない。友人に話しかけるような温度感

**文章の構造**
- 短文を多用。1文が長くなりすぎない
- 改行を頻繁に使い、縦に読みやすくする
- 「。」で終わった後、1行あけることが多い
- カッコ書きで本音・補足を入れる：「（まぁ、実際たいしたこともしてなかったのですが…）」「（笑）」
- 「…」「——」を使った余韻の表現

**感情表現**
- 「なんか」「けっこう」「じわじわ」「ちょっと」などの口語的副詞を自然に使う
- 失敗談・不完全な自分をさらけ出す：「1mmも迷わずその場で契約」「ほぼ変化なし🤩」
- 驚きの表現：「え！？増えてるーー！！」「なんと！」「まさかの〜」
- 自己ツッコミ：「笑」「…でして」「なおさらでした」

**タイトルの型**
- 数字を使ったインパクト：「10万円かけて、マイナス0.1 kg。」「2軒目のパーソナルジムも1年通って±0kg。」
- 体験談の予告：「私の「失敗」パーソナル体験記。」
- 共感を誘う日常描写：「梅雨のプチストレスと、ちょっと助かっていること」
- 疑問形＋回答予告：「ママの自分時間は贅沢？〜することにした話」
- 読点で間を作る：「今年もやっぱり気になる、二の腕の話」
- 25文字以内

**商品の紹介スタイル**
- 記事の後半〜末尾に自然な流れで登場させる
- 押し付けがましくなく、「そういえば」「だからこそ」のような接続で繋ぐ
- 機能より「使ってよかった体験」を語る
- 「薄手なので持ち歩きやすく」「乾きが早め」など具体的なメリットを日常の言葉で

**メタディスクリプションの型**
- 記事の悩み共感 → 解決の予告 → IMIELへの自然な言及
- 例：「梅雨になると気分が上がらない、洗濯物が乾かない…そんなプチストレスありませんか？じめじめした季節でも足元の冷えをケアしながらおしゃれも楽しめる、IMIELのレッグウォーマーが梅雨時期に助かっている理由をご紹介します。」
- 120文字以内

**URLスラッグ（SEO用）**
- 英語のキーワードをハイフン繋ぎ
- 例：tsuyu-season-stress / 40s-personal-training-experience / hitori-eiga-eigakan-samui-leg-warmer

---

## 各ページの仕様

### 1. キーワードページ（/keywords）

**機能**
- テーマワードを入力 → Claude APIがIMIEL向けSEOキーワードを10個提案
- 各キーワードに「競合：低/中/高」「検索需要：低/中/高」を表示
- クリック選択 → 「記事を書く」ページに送る

**プロンプト（/lib/prompts.ts）**
```
IMIELブログ（40代女性向け温活・セルフケア・シルクレッグウォーマー）のSEOキーワードを探しています。
「{seed}」に関連する、検索されやすく競合が少ない具体的なキーワードを10個提案してください。
各キーワードに「競合：低/中/高」「検索需要：低/中/高」を付け、以下のJSON形式で返してください：
[{"keyword": "...", "competition": "低", "demand": "中"}, ...]
```

---

### 2. 記事生成ページ（/write）

**媒体切り替えタブ**：「Shopify」「note」

**3ステップフロー**
1. キーワード・スタイル入力 → タイトル案5つ＋構成を生成
2. 構成確認 → 本文を生成（1200〜1500文字）
3. SEO一括生成（メタディスクリプション・スラッグ・SNS投稿文）

**ステップ1プロンプト（Shopify用）**
```
あなたはIMIELブランドのブログライター「ゆみ」です。
以下の文体ルールに従って出力してください。

【IMIELの文体ルール】
- 一人称は「私」。読者への語りかけは「〜ですよね」「〜ありませんか？」
- 短文多用。改行を頻繁に使う。カッコ書きで本音を補足する
- 「なんか」「けっこう」「じわじわ」などの口語的副詞を自然に使う
- 失敗談・不完全な自分をさらけ出す等身大の語り口
- 商品は記事後半に「そういえば」「だからこそ」で自然につなぐ

必須キーワード：{mustKeywords}
媒体：Shopifyブログ（体験談・等身大スタイル）
メインキーワード：{keyword}
ターゲット：{target}

以下をJSON形式で出力してください：
{
  "titles": [
    "タイトル案1（25文字以内、数字やインパクトある表現）",
    "タイトル案2（共感を誘う日常描写）",
    "タイトル案3（疑問形＋回答予告）",
    "タイトル案4（読点で間を作る）",
    "タイトル案5（体験談の予告）"
  ],
  "outline": [
    {"h2": "見出し1", "summary": "概要100文字"},
    {"h2": "見出し2", "summary": "概要100文字"},
    {"h2": "見出し3", "summary": "概要100文字"},
    {"h2": "見出し4", "summary": "概要100文字（商品の自然な紹介）"}
  ],
  "intro": "導入文150文字（「〜ですよね」など共感から始まる）"
}
```

**ステップ1プロンプト（note用）**
```
（上記と同じ文体ルールを前置き）

媒体：note（Shopifyより深掘り・読み物寄り。背景知識も含める）
メインキーワード：{keyword}
※Shopifyの記事とは内容・切り口を変えること

（同じJSON形式で出力）
```

**ステップ2プロンプト（本文生成）**
```
あなたはIMIELブランドのブログライター「ゆみ」です。

【文体ルール（厳守）】
- 短文・頻繁な改行・カッコ書きの本音補足
- 「なんか」「けっこう」「じわじわ」「ちょっと」などの口語的副詞
- 驚き表現：「え！？〜！！」「まさかの〜」「なんと！」
- 自己ツッコミ：「（笑）」「…でして」
- 商品紹介は後半に「そういえば」「だからこそ」で自然につなぐ
- 具体的な数字・エピソードを入れる

媒体：{platform}
キーワード：{keyword}
構成：{outline}

条件：
- 1200〜1500文字
- H2見出しを使う
- IMIELのシルク混レッグウォーマーを中盤〜後半に自然に紹介
- 最後は「そんな小さなセルフケアを大切にしたいなと思っています。」のようなやわらかい締め
```

**ステップ3：SEO一括生成プロンプト**
```
以下のブログ記事のSEO関連コンテンツを一括で生成してください。

タイトル：{title}
キーワード：{keyword}
本文（冒頭300文字）：{bodyPreview}

以下をJSON形式で出力してください：
{
  "metaDescription": "120文字以内。悩み共感→解決予告→IMIEL自然言及の型で",
  "slug": "英語ハイフン繋ぎのURLスラッグ（例：office-cold-feet-warmth）",
  "seoScore": {
    "titleScore": 0〜100,
    "keywordScore": 0〜100,
    "readabilityScore": 0〜100,
    "advice": ["改善ポイント1", "改善ポイント2"]
  },
  "threadsText": "Threadsへの更新通知文（150文字以内、絵文字1〜2個、記事URLを末尾に）",
  "xText": "X投稿文（100文字以内、URLを末尾に）",
  "noteText": "noteを開いたときにすぐ貼れる形式の本文（note用に調整済み）"
}
```

---

### 3. 画像ページ（/image）

**機能A：トリミング**
- 画像アップロード（JPG/PNG/WEBP対応）
- ライブラリ：react-image-crop
- プリセットボタン：
  - Shopifyサムネイル：1200×630（OGP推奨）
  - note見出し：1280×670
  - SNS正方形：1080×1080
  - SNS縦長：1080×1350
- 自由トリミングも可
- JPEG 85%品質でダウンロード

**実装**
```tsx
import ReactCrop, { type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

const PRESETS = [
  { label: 'Shopifyサムネイル', aspect: 1200/630 },
  { label: 'note見出し',       aspect: 1280/670 },
  { label: 'SNS正方形',        aspect: 1 },
  { label: 'SNS縦長',          aspect: 1080/1350 },
]

// canvas.toBlob でJPEG 85%出力 → URL.createObjectURL → <a download>
```

**機能B：画像プロンプト生成**
- 記事タイトル・キーワードを入力
- サムネイル用・アイキャッチ用の2種類を生成
- Midjourney用・ChatGPT(DALL-E)用それぞれコピーボタン付き

**プロンプト**
```
記事「{title}」（キーワード：{keyword}）のサムネイル画像プロンプトを英語で生成してください。

被写体：30〜40代の日本人女性。自然体でリラックスした表情。モデルっぽくなく等身大の雰囲気。
ブランドトーン：温かみのある和モダン。シルク・温活・セルフケアを感じさせる。上品で落ち着いたトーン。
スタイル：ライフスタイル写真風。柔らかい自然光。背景はシンプルな室内や窓際。

以下のJSON形式で出力してください：
{
  "midjourney_thumbnail": "英語プロンプト, 30s-40s Japanese woman, relaxed lifestyle, warm lighting, soft tones, silk texture, minimal interior, 16:9 --v 6",
  "midjourney_eyecatch": "英語プロンプト, cozy atmosphere, 4:3 --v 6",
  "dalle_thumbnail": "DALL-E向けの英語プロンプト（サムネイル用）",
  "dalle_eyecatch": "DALL-E向けの英語プロンプト（アイキャッチ用）"
}
```

---

### 4. 投稿・通知ページ（/post）

**投稿前確認UI**（必須）
- タイトル・本文・メタディスクリプション・スラッグのプレビューを表示
- 「この内容で投稿する」ボタンを押して初めてAPI送信

**Shopify投稿**
```typescript
// /lib/shopify.ts
export async function createBlogPost({ title, bodyHtml, metaDescription, slug, tags }) {
  return fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/articles.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        article: {
          title,
          body_html: bodyHtml,
          blog_id: process.env.SHOPIFY_BLOG_ID,
          handle: slug,  // URLスラッグ
          metafields: [{
            namespace: 'seo',
            key: 'description',
            value: metaDescription,
            type: 'single_line_text_field',
          }],
          tags,
        }
      })
    }
  ).then(r => r.json())
}
```

**Threads投稿**
```typescript
// /lib/threads.ts
export async function postToThreads(text: string) {
  // Step1: コンテナ作成
  const { id } = await fetch(
    `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text,
        access_token: process.env.THREADS_ACCESS_TOKEN,
      })
    }
  ).then(r => r.json())

  // Step2: 公開
  await fetch(
    `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: id,
        access_token: process.env.THREADS_ACCESS_TOKEN,
      })
    }
  )
}
```

**X投稿（intent URL方式・無料）**
```typescript
// 投稿ページの「Xに投稿」ボタン
const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}`
window.open(xUrl, '_blank')
// → Xの投稿画面が開き、文章がセットされた状態になる。送信は自分で押す。
```

**noteコピー**
```typescript
// ワンクリックでクリップボードにコピー
navigator.clipboard.writeText(noteText)
// 「noteを開く」ボタンで window.open('https://note.com/notes/new', '_blank')
```

---

### 5. 設定ページ（/settings）

**保存する設定項目**（localStorageに保存、Vercelの全員で共有しない個人設定）
```
ブランドトーン（Shopify用）：テキストエリアで編集可
ブランドトーン（note用）：テキストエリアで編集可
必須キーワード：カンマ区切り
```

**デフォルト値**
```
ブランドトーン（Shopify用）：
「40代女性向け。等身大の「ゆみ」として語る。体験談ベースで難しい言葉は使わない。
失敗談や本音をカッコ書きで補足する。「なんか」「けっこう」などの口語を自然に使う。
IMIELのシルク混レッグウォーマーを記事後半に自然な流れで紹介する。」

ブランドトーン（note用）：
「Shopifyブログより深掘り・読み物スタイル。テーマの背景知識も含め、
読後に「なるほど」と感じてもらえる内容。体験談ベースは同じだが情報量を増やす。」

必須キーワード：温活, レッグウォーマー, セルフケア, 冷え対策
```

**Threads APIトークン期限切れ対応**
- 設定ページに「トークンの有効期限：{date}」を表示
- 期限30日前になったらオレンジ色の警告バッジを表示
- 「トークンを更新する」ボタン → Meta開発者ページへのリンク

---

## 注意事項

### セキュリティ
- APIキーは必ず環境変数。NEXT_PUBLIC_ プレフィックス禁止
- Claude/Shopify/Threads APIの呼び出しはすべて /app/api/ 経由（サーバーサイド）

### Shopify
- 投稿前に必ずプレビュー確認UIを挟む（誤投稿防止）
- 画像アップロードは /admin/api/2024-01/files.json を使用
- スラッグは英語ハイフン繋ぎ（Claude APIが自動生成）

### Threads API
- アクセストークンは60日で期限切れ
- 投稿文は500文字以内

### 画像トリミング
- react-image-crop はクライアントサイドのみ（サーバー不要）
- canvas.toBlob → URL.createObjectURL → <a download>
- Shopify画像アップロード時はFormDataでサーバーサイドAPI経由

### note
- 公式APIなし → コピペ運用（本文コピー→ note.com/notes/new を開く）

---

## 実装の順番

1. サイドバー・レイアウト（完了）
2. 記事生成ページ + Claude APIルート（完了）
3. 画像トリミングページ（react-image-crop）
4. SEO一括生成（ステップ3にメタ・スラッグ・SNS文を追加）
5. Shopify投稿APIルート
6. Threads投稿APIルート
7. 投稿・通知ページ（X intent URL含む）
8. キーワード収集ページ
9. 記事一覧ページ
10. 設定ページ
11. Vercelにデプロイ

---

## デプロイ手順

```bash
git add .
git commit -m "initial commit"
gh repo create imiel-dashboard --public --push
# vercel.com でGitHubリポジトリを選択してデプロイ
# Vercelの環境変数に設定：
# ANTHROPIC_API_KEY / SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN
# SHOPIFY_BLOG_ID / THREADS_ACCESS_TOKEN / THREADS_USER_ID
```
