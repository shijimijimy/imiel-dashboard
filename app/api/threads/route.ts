import { NextRequest } from 'next/server'
import { postToThreads } from '@/lib/threads'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.THREADS_ACCESS_TOKEN || !process.env.THREADS_USER_ID) {
      return Response.json(
        { error: 'Threads APIキーが設定されていません（THREADS_ACCESS_TOKEN, THREADS_USER_ID）' },
        { status: 500 }
      )
    }

    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return Response.json({ error: '投稿文が必要です' }, { status: 400 })
    }
    if (text.length > 500) {
      return Response.json({ error: '投稿文は500文字以内にしてください' }, { status: 400 })
    }

    const result = await postToThreads(text)
    return Response.json({ success: true, result })
  } catch (error) {
    console.error('Threads API error:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
