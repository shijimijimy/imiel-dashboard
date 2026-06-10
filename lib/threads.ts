export async function postToThreads(text: string) {
  // Step1: メディアコンテナ作成
  const containerRes = await fetch(
    `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text,
        access_token: process.env.THREADS_ACCESS_TOKEN,
      }),
    }
  )
  const container = await containerRes.json()
  if (!container.id) {
    throw new Error('コンテナ作成失敗: ' + JSON.stringify(container))
  }

  // Step2: 公開
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: process.env.THREADS_ACCESS_TOKEN,
      }),
    }
  )
  return publishRes.json()
}
