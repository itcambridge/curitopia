import OpenAI from 'openai'
import { inspectImage } from '@/lib/focus-image/bytes'
import type { FocusImageFailure } from '@/lib/focus-image/decide'

export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2.5-flare'
const imageTimeoutMs = 55_000

type ImageClient = {
  images: {
    generate: (body: Record<string, unknown>) => Promise<{ data?: Array<{ b64_json?: string }> }>
  }
}

function safeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value)) return undefined
  if (value.toLowerCase().includes('sk-')) return undefined
  return value
}

function logImageFailure(details: { category: string; status?: number; code?: string; type?: string }) {
  console.error('focus image failed', {
    category: details.category,
    status: details.status,
    code: safeToken(details.code),
    type: safeToken(details.type),
  })
}

export function openAiImageModel(): string {
  const configured = process.env.OPENAI_IMAGE_MODEL?.trim()
  return configured || DEFAULT_OPENAI_IMAGE_MODEL
}

export async function requestFocusImage(prompt: string, injected?: ImageClient): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: FocusImageFailure }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!injected && !apiKey) {
    logImageFailure({ category: 'configuration' })
    return { ok: false, reason: 'configuration' }
  }
  const client = injected ?? new OpenAI({ apiKey, timeout: imageTimeoutMs, maxRetries: 0 })
  try {
    const response = await client.images.generate({
      model: openAiImageModel(),
      prompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'webp',
      output_compression: 80,
    })
    const encoded = response.data?.[0]?.b64_json
    if (!encoded) {
      logImageFailure({ category: 'invalid' })
      return { ok: false, reason: 'invalid' }
    }
    const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'))
    if (!inspectImage(bytes)) {
      logImageFailure({ category: 'invalid' })
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, bytes }
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 429) {
      logImageFailure({ category: 'rate-limit', status: error.status, code: error.code ?? undefined, type: error.type })
      return { ok: false, reason: 'rate-limit' }
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof Error && error.name === 'AbortError')) {
      logImageFailure({ category: 'timeout' })
      return { ok: false, reason: 'timeout' }
    }
    if (error instanceof OpenAI.APIError) {
      logImageFailure({ category: 'upstream', status: error.status, code: error.code ?? undefined, type: error.type })
      return { ok: false, reason: 'upstream' }
    }
    logImageFailure({ category: 'upstream' })
    return { ok: false, reason: 'upstream' }
  }
}
