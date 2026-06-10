import {
  DEFAULT_BRAND_TONE_SHOPIFY,
  DEFAULT_BRAND_TONE_NOTE,
  DEFAULT_MUST_KEYWORDS,
} from './prompts'

export interface AppSettings {
  shopifyTone: string
  noteTone: string
  mustKeywords: string
  threadsTokenRefreshedAt?: string
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return {
      shopifyTone: DEFAULT_BRAND_TONE_SHOPIFY,
      noteTone: DEFAULT_BRAND_TONE_NOTE,
      mustKeywords: DEFAULT_MUST_KEYWORDS,
    }
  }
  try {
    const saved = localStorage.getItem('imiel_settings')
    if (!saved) throw new Error('no settings')
    const parsed = JSON.parse(saved)
    return {
      shopifyTone: parsed.shopifyTone || DEFAULT_BRAND_TONE_SHOPIFY,
      noteTone: parsed.noteTone || DEFAULT_BRAND_TONE_NOTE,
      mustKeywords: parsed.mustKeywords || DEFAULT_MUST_KEYWORDS,
      threadsTokenRefreshedAt: parsed.threadsTokenRefreshedAt,
    }
  } catch {
    return {
      shopifyTone: DEFAULT_BRAND_TONE_SHOPIFY,
      noteTone: DEFAULT_BRAND_TONE_NOTE,
      mustKeywords: DEFAULT_MUST_KEYWORDS,
    }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem('imiel_settings', JSON.stringify(settings))
}
