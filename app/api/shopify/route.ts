import { NextRequest } from 'next/server'
import { createBlogPost } from '@/lib/shopify'

export async function POST(request: NextRequest) {
  try {
    if (
      !process.env.SHOPIFY_STORE_DOMAIN ||
      !process.env.SHOPIFY_ADMIN_API_TOKEN ||
      !process.env.SHOPIFY_BLOG_ID
    ) {
      return Response.json(
        { error: 'Shopify環境変数が設定されていません（SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_BLOG_ID）' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { title, body: articleBody, metaDescription, slug, tags } = body

    if (!title || !articleBody) {
      return Response.json({ error: 'title と body は必須です' }, { status: 400 })
    }

    const result = await createBlogPost({
      title,
      body: articleBody,
      metaDescription,
      slug,
      tags,
      blogId: process.env.SHOPIFY_BLOG_ID,
    })

    if (result.errors) {
      return Response.json({ error: JSON.stringify(result.errors) }, { status: 400 })
    }

    return Response.json({ success: true, article: result.article })
  } catch (error) {
    console.error('Shopify API error:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
