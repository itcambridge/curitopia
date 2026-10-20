import OpenAI from 'openai'
import { inspectImage } from '@/lib/focus-image/bytes'
import { openAiImageModel } from '@/lib/focus-image/openai'

const imageTimeoutMs = 55_000

type ImageClient = {
  images: {
    generate: (body: Record<string, unknown>) => Promise<{ data?: Array<{ b64_json?: string }> }>
  }
}

export type ConceptImageFailure = 'configuration' | 'rate-limit' | 'timeout' | 'upstream' | 'invalid'

function safeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value)) return undefined
  if (value.toLowerCase().includes('sk-')) return undefined
  return value
}

function logFailure(details: { category: string; status?: number; code?: string; type?: string }) {
  console.error('concept thumbnail failed', {
    category: details.category,
    status: details.status,
    code: safeToken(details.code),
    type: safeToken(details.type),
  })
}

/** Sends only the prompt the user submitted. The returned file is not stored. */
export async function requestConceptImage(prompt: string, injected?: ImageClient): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: ConceptImageFailure }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!injected && !apiKey) {
    logFailure({ category: 'configuration' })
    return { ok: false, reason: 'configuration' }
  }
  const client = injected ?? new OpenAI({ apiKey, timeout: imageTimeoutMs, maxRetries: 0 })
  try {
    const response = await client.images.generate({
      model: openAiImageModel(),
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'webp',
      output_compression: 80,
    })
    const encoded = response.data?.[0]?.b64_json
    if (!encoded) {
      logFailure({ category: 'invalid' })
      return { ok: false, reason: 'invalid' }
    }
    const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'))
    if (!inspectImage(bytes)) {
      logFailure({ category: 'invalid' })
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, bytes }
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
