import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ADMIN_API_TOKEN) {
      return Response.json(
        { error: 'Shopify環境変数が設定されていません' },
        { status: 500 }
      )
    }

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
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/files.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN!,
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
      return Response.json({ error: JSON.stringify(data.errors || data) }, { status: res.status })
    }

    return Response.json({ success: true, file: data.file })
  } catch (error) {
    console.error('Shopify image upload error:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
