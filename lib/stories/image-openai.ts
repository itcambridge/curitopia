import OpenAI from 'openai'
import { inspectImage } from '@/lib/focus-image/bytes'
import { openAiImageModel } from '@/lib/focus-image/openai'
import { STORY_IMAGE_MAX_BYTES, storyImageSize } from '@/lib/stories/image'

const imageTimeoutMs = 55_000

type ImageClient = {
  images: {
    generate: (body: Record<string, unknown>) => Promise<{ data?: Array<{ b64_json?: string }> }>
  }
}

export type StoryImageFailure = 'configuration' | 'rate-limit' | 'timeout' | 'upstream' | 'invalid'

function safeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value)) return undefined
  if (value.toLowerCase().includes('sk-')) return undefined
  return value
}

function logFailure(details: { category: string; status?: number; code?: string; type?: string }) {
  console.error('story image failed', {
    category: details.category,
    status: details.status,
    code: safeToken(details.code),
    type: safeToken(details.type),
  })
}

/** Sends one slide prompt. The bytes are returned to the caller and are not stored. */
export async function requestStoryImage(prompt: string, injected?: ImageClient): Promise<{ ok: true; bytes: Uint8Array; width: number; height: number } | { ok: false; reason: StoryImageFailure }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!injected && !apiKey) {
    logFailure({ category: 'configuration' })
    return { ok: false, reason: 'configuration' }
  }
  const size = storyImageSize(openAiImageModel())
  const client = injected ?? new OpenAI({ apiKey, timeout: imageTimeoutMs, maxRetries: 0 })
  try {
    const response = await client.images.generate({
      model: openAiImageModel(),
      prompt,
      n: 1,
      size: size.size,
      quality: 'high',
      output_format: 'webp',
      output_compression: 80,
    })
    const encoded = response.data?.[0]?.b64_json
    if (!encoded) {
      logFailure({ category: 'invalid' })
      return { ok: false, reason: 'invalid' }
    }
    const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'))
    const inspected = inspectImage(bytes, STORY_IMAGE_MAX_BYTES)
    if (!inspected) {
      logFailure({ category: 'invalid' })
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, bytes, width: inspected.width, height: inspected.height }
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 429) {
      logFailure({ category: 'rate-limit', status: error.status, code: error.code ?? undefined, type: error.type })
      return { ok: false, reason: 'rate-limit' }
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof Error && error.name === 'AbortError')) {
      logFailure({ category: 'timeout' })
      return { ok: false, reason: 'timeout' }
    }
    if (error instanceof OpenAI.APIError) {
      logFailure({ category: 'upstream', status: error.status, code: error.code ?? undefined, type: error.type })
      return { ok: false, reason: 'upstream' }
    }
    logFailure({ category: 'upstream' })
    return { ok: false, reason: 'upstream' }
  }
}
