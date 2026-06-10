export interface ShopifyPost {
  title: string
  body: string
  metaDescription?: string
  slug?: string
  tags?: string
  blogId: string
}

export async function createBlogPost({
  title,
  body,
  metaDescription,
  slug,
  tags,
  blogId,
}: ShopifyPost) {
  const res = await fetch(
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
          body_html: body,
          blog_id: blogId,
          handle: slug,
          tags,
          metafields: metaDescription
            ? [
                {
                  namespace: 'seo',
                  key: 'description',
                  value: metaDescription,
                  type: 'single_line_text_field',
                },
              ]
            : undefined,
        },
      }),
    }
  )
  return res.json()
}
