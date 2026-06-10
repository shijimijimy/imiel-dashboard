import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN

  if (!domain || !token) {
    return Response.json(
      {
        error: 'SHOPIFY_NOT_CONFIGURED',
        message: 'Shopify連携が未設定です。設定ページでトークンを入力してください。',
      },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const altText = (formData.get('altText') as string) || ''

    if (!file) {
      return Response.json({ error: 'ファイルが必要です' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const res = await fetch(
      `https://${domain}/admin/api/2024-01/files.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: {
            attachment: base64,
            filename: file.name,
            content_type: mimeType,
            alt: altText,
          },
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return Response.json(
        { error: JSON.stringify(data.errors || data) },
        { status: res.status }
      )
    }

    // CDN URLはfile.url またはfile.preview.image.url にある
    const fileData = data.file
    const cdnUrl: string | undefined =
      fileData?.url ?? fileData?.preview?.image?.url ?? undefined

    return Response.json({ success: true, file: fileData, url: cdnUrl })
  } catch (error) {
    console.error('Shopify image upload error:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
