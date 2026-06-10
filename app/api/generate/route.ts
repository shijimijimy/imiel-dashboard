import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildKeywordsPrompt,
  buildTitlesPrompt,
  buildBodyPrompt,
  buildSeoPrompt,
  buildImagePrompt,
  buildThumbnailImagePrompt,
  buildSectionImagePrompt,
  buildChatGPTImageRequest,
} from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...params } = body

    let prompt: string
    let maxTokens = 2048

    switch (type) {
      case 'keywords':
        prompt = buildKeywordsPrompt(params.seed)
        break
      case 'titles':
        prompt = buildTitlesPrompt(params)
        break
      case 'body':
        prompt = buildBodyPrompt(params)
        maxTokens = 4096
        break
      case 'seo':
        prompt = buildSeoPrompt(params)
        break
      case 'image':
        prompt = buildImagePrompt(params.title, params.keyword)
        break
      case 'thumbnail_prompt':
        prompt = buildThumbnailImagePrompt(params as { title: string; keyword: string; body: string })
        break
      case 'section_prompt':
        prompt = buildSectionImagePrompt(params as { h2: string; sectionSummary: string; brandTone: string })
        break
      case 'chatgpt_image':
        prompt = buildChatGPTImageRequest(params as { title: string; usage: 'thumbnail' | 'eyecatch' | 'sns' })
        break
      default:
        return Response.json({ error: 'Invalid type' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const content =
      message.content[0].type === 'text' ? message.content[0].text : ''
    return Response.json({ result: content })
  } catch (error) {
    console.error('Generate API error:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
