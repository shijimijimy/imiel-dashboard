import Link from "next/link";

const quickActions = [
  {
    href: "/write",
    icon: "✍️",
    label: "記事を書く",
    desc: "AIで記事を生成する",
    color: "bg-rose-50 hover:bg-rose-100",
  },
  {
    href: "/keywords",
    icon: "🔍",
    label: "キーワードを探す",
    desc: "SEOキーワードを収集する",
    color: "bg-amber-50 hover:bg-amber-100",
  },
  {
    href: "/image",
    icon: "🖼️",
    label: "画像を編集する",
    desc: "トリミング・プロンプト生成",
    color: "bg-sky-50 hover:bg-sky-100",
  },
  {
    href: "/post",
    icon: "📤",
    label: "投稿する",
    desc: "Shopify・Threads・Xに投稿",
    color: "bg-emerald-50 hover:bg-emerald-100",
  },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">ダッシュボード</h1>
        <p className="text-stone-500 text-sm mt-1">
          IMIELコンテンツ管理 — 温活・シルク混レッグウォーマー
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "今月の記事", value: "—", sub: "Shopify + note" },
          { label: "下書き中", value: "—", sub: "未投稿" },
          { label: "SNS投稿", value: "—", sub: "Threads + X" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-5 border border-stone-100 shadow-sm"
          >
            <p className="text-sm text-stone-500">{stat.label}</p>
            <p className="text-3xl font-bold text-stone-300 mt-1">{stat.value}</p>
            <p className="text-xs text-stone-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 border border-stone-100 shadow-sm">
        <h2 className="text-base font-semibold text-stone-700 mb-4">
          クイックアクション
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`flex items-center gap-3 p-4 rounded-lg transition-colors ${a.color}`}
            >
              <span className="text-2xl">{a.icon}</span>
              <div>
                <p className="font-medium text-stone-800 text-sm">{a.label}</p>
                <p className="text-xs text-stone-500">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
