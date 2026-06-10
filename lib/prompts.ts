export const DEFAULT_BRAND_TONE_SHOPIFY = `40代女性向け。等身大の「ゆみ」として語る。体験談ベースで難しい言葉は使わない。失敗談や本音をカッコ書きで補足する。「なんか」「けっこう」などの口語を自然に使う。IMIELのシルク混レッグウォーマーを記事後半に自然な流れで紹介する。`

export const DEFAULT_BRAND_TONE_NOTE = `Shopifyブログより深掘り・読み物スタイル。テーマの背景知識も含め、読後に「なるほど」と感じてもらえる内容。体験談ベースは同じだが情報量を増やす。`

export const DEFAULT_MUST_KEYWORDS = `温活, レッグウォーマー, セルフケア, 冷え対策`

const YUMI_STYLE_RULES = `【IMIELの文体ルール】
- 一人称は「私」。執筆者は「ゆみ」
- 読者への語りかけ：「〜ですよね」「〜ありませんか？」「〜でして」
- 短文を多用。改行を頻繁に使い、縦に読みやすくする
- カッコ書きで本音・補足を入れる：「（笑）」「（まぁ、実際〜）」「…でして」
- 「なんか」「けっこう」「じわじわ」「ちょっと」などの口語的副詞を自然に使う
- 失敗談・不完全な自分をさらけ出す等身大の語り口
- 驚きの表現：「え！？〜！！」「まさかの〜」「なんと！」
- 商品紹介は後半に「そういえば」「だからこそ」で自然につなぐ`

export function buildKeywordsPrompt(seed: string): string {
  return `IMIELブログ（40代女性向け温活・セルフケア・シルクレッグウォーマー）のSEOキーワードを探しています。
「${seed}」に関連する、検索されやすく競合が少ない具体的なキーワードを10個提案してください。
各キーワードに「競合：低/中/高」「検索需要：低/中/高」を付け、以下のJSON形式で返してください（コードブロックなしで純粋なJSONのみ）：
[{"keyword": "...", "competition": "低", "demand": "中"}, ...]`
}

export function buildTitlesPrompt({
  platform,
  keyword,
  target,
  brandTone,
  mustKeywords,
  style,
  userMemos,
}: {
  platform: 'shopify' | 'note'
  keyword: string
  target?: string
  brandTone: string
  mustKeywords: string
  style?: string
  userMemos?: string
}): string {
  const platformInstructions =
    platform === 'note'
      ? '媒体：note（Shopifyより深掘り・読み物寄り。背景知識も含める）\n※Shopifyの記事とは内容・切り口を変えること'
      : '媒体：Shopifyブログ（体験談・等身大スタイル）'

  const styleInstruction =
    style === '解説・情報系'
      ? '記事スタイル：情報・解説中心。正確な情報とわかりやすい説明を重視。体験談は補足程度に。'
      : style === '比較・まとめ系'
      ? '記事スタイル：比較・まとめ形式。見出しでポイントを明確に。箇条書きやリスト形式を活用。'
      : '記事スタイル：体験談・等身大。ゆみの実体験ベースで親しみやすく。'

  return `あなたはIMIELブランドのブログライター「ゆみ」です。
以下の文体ルールに従って出力してください。

${YUMI_STYLE_RULES}

ブランド設定：${brandTone}
${styleInstruction}
必須キーワード：${mustKeywords}
${platformInstructions}
メインキーワード：${keyword}
ターゲット：${target || '40代女性、冷えや美容に悩む方'}
${userMemos ? `\n【必ず記事に含める体験談・エピソード】\n${userMemos}\n※上記の体験談を記事の構成に自然に組み込んでください。` : ''}
以下をJSON形式で出力してください（コードブロックなしで純粋なJSONのみ）：
{
  "titles": [
    "タイトル案1（数字やインパクトある表現・25文字以内）",
    "タイトル案2（共感を誘う日常描写・25文字以内）",
    "タイトル案3（疑問形＋回答予告・25文字以内）",
    "タイトル案4（読点で間を作る・25文字以内）",
    "タイトル案5（体験談の予告・25文字以内）"
  ],
  "outline": [
    {"h2": "見出し1", "summary": "概要100文字"},
    {"h2": "見出し2", "summary": "概要100文字"},
    {"h2": "見出し3", "summary": "概要100文字"},
    {"h2": "見出し4（商品の自然な紹介）", "summary": "概要100文字"}
  ],
  "intro": "導入文150文字（「〜ですよね」など共感から始まる）"
}`
}

export function buildBodyPrompt({
  platform,
  keyword,
  outline,
  selectedTitle,
  brandTone,
  userMemos,
}: {
  platform: 'shopify' | 'note'
  keyword: string
  outline: { h2: string; summary: string }[]
  selectedTitle: string
  brandTone: string
  userMemos?: string
}): string {
  const outlineText = outline
    .map((o, i) => `${i + 1}. ${o.h2}：${o.summary}`)
    .join('\n')
  const platformStyle =
    platform === 'shopify'
      ? 'Shopifyブログ（体験談・等身大スタイル）'
      : 'note（読み物・深掘りスタイル）'

  return `あなたはIMIELブランドのブログライター「ゆみ」です。

${YUMI_STYLE_RULES}

ブランド設定：${brandTone}
媒体：${platformStyle}
キーワード：${keyword}
構成：
${outlineText}

${userMemos ? `【執筆者の実体験・伝えたいこと】\n${userMemos}\n※上記のエピソードや気持ちを記事本文に自然に織り交ぜてください。カッコ書きの本音補足として入れても良いです。\n\n` : ''}以下の条件でブログ記事の本文を書いてください：
- タイトル：${selectedTitle}
- 1200〜1500文字
- H2見出しを使う（## 記法で）
- IMIELのシルク混レッグウォーマーを中盤〜後半に「そういえば」「だからこそ」で自然に紹介
- 最後は「そんな小さなセルフケアを大切にしたいなと思っています。」のようなやわらかい締め

本文のみ出力してください。`
}

export function buildSeoPrompt({
  title,
  body,
  keyword,
  platform,
}: {
  title: string
  body: string
  keyword: string
  platform: 'shopify' | 'note'
}): string {
  return `以下のブログ記事のSEO関連コンテンツを一括で生成してください。

タイトル：${title}
キーワード：${keyword}
媒体：${platform === 'shopify' ? 'Shopifyブログ' : 'note'}
本文（冒頭300文字）：${body.substring(0, 300)}

以下をJSON形式で出力してください（コードブロックなしで純粋なJSONのみ）：
{
  "metaDescription": "120文字以内。悩み共感→解決予告→IMIEL自然言及の型で",
  "slug": "英語ハイフン繋ぎのURLスラッグ（例：office-cold-feet-warmth）",
  "seoScore": {
    "titleScore": 0から100の整数,
    "keywordScore": 0から100の整数,
    "readabilityScore": 0から100の整数,
    "advice": ["改善ポイント1（具体的に）", "改善ポイント2（具体的に）"]
  },
  "threadsText": "Threads更新通知文（150文字以内、絵文字1〜2個）",
  "xText": "X投稿文（100文字以内、ハッシュタグ含む）"
}`
}

export function buildThumbnailImagePrompt({
  title,
  keyword,
  body,
}: {
  title: string
  keyword: string
  body: string
}): string {
  return `以下の記事のサムネイル画像をDALL-Eで生成するための詳細なプロンプトを日本語で作成してください。

記事タイトル：${title}
キーワード：${keyword}
記事の内容：${body.substring(0, 200)}

条件：
- 被写体：30〜40代の自然体の日本人女性（モデルっぽくなく等身大）
- 表情：穏やかでリラックスした自然な表情
- 場所：温かみのある和モダンな室内（窓際、カフェ、自宅など）
- 光：柔らかい自然光
- 雰囲気：シルク・温活・セルフケアを感じさせる
- トーン：上品で落ち着いた、押し付けがましくない
- サイズ：横長16:9
- 文字：画像内に文字を入れない
- NGワード：派手、鮮やか、モデル体型、加工感が強い

出力はDALL-Eにそのまま貼れる日本語プロンプトのみ。余計な説明は不要。`
}

export function buildSectionImagePrompt({
  h2,
  sectionSummary,
  brandTone,
}: {
  h2: string
  sectionSummary: string
  brandTone: string
}): string {
  return `以下の見出しセクションに合う記事挿入画像をDALL-Eで生成するためのプロンプトを日本語で作成してください。

見出し：${h2}
セクションの内容：${sectionSummary}
記事全体のトーン：${brandTone}

条件：
- 被写体：30〜40代の自然体の日本人女性（モデルっぽくなく等身大）
- 表情：穏やかでリラックスした自然な表情
- 場所：温かみのある和モダンな室内
- 光：柔らかい自然光
- 雰囲気：シルク・温活・セルフケアを感じさせる。サムネイルと統一感のあるトーン
- サイズ：正方形（1:1）
- 文字：画像内に文字を入れない
- NGワード：派手、鮮やか、モデル体型、加工感が強い

出力はDALL-Eにそのまま貼れる日本語プロンプトのみ。余計な説明は不要。`
}

export function buildImagePrompt(title: string, keyword: string): string {
  return `記事「${title}」（キーワード：${keyword}）のサムネイル画像プロンプトを英語で生成してください。

被写体：30〜40代の日本人女性。自然体でリラックスした表情。モデルっぽくなく等身大の雰囲気。
ブランドトーン：温かみのある和モダン。シルク・温活・セルフケアを感じさせる。上品で落ち着いたトーン。
スタイル：ライフスタイル写真風。柔らかい自然光。背景はシンプルな室内や窓際。

以下の形式でJSONで返してください（コードブロックなしで純粋なJSONのみ）：
{
  "midjourney_thumbnail": "Midjourney用・英語プロンプト, 30s-40s Japanese woman, relaxed lifestyle, warm lighting, soft tones, silk texture, minimal interior, 16:9 --v 6",
  "midjourney_eyecatch": "Midjourney用・英語プロンプト, cozy atmosphere, warm tones, 4:3 --v 6",
  "dalle_thumbnail": "DALL-E用・英語プロンプト（サムネイル16:9。具体的な描写で）",
  "dalle_eyecatch": "DALL-E用・英語プロンプト（アイキャッチ4:3。具体的な描写で）"
}`
}
