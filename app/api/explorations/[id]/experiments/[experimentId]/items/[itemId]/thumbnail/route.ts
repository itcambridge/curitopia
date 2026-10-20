import { NextResponse } from 'next/server'
import { getAuthenticatedClaims } from '@/lib/auth/session'
import { requestConceptImage, type ConceptImageFailure } from '@/lib/experiments/thumbnail-openai'
import { maySubmitConceptPrompt } from '@/lib/experiments/thumbnail-prompt'
import { applyThumbnail, ownedThumbnailPath, THUMBNAIL_BUCKET, THUMBNAIL_MAX_BYTES, type ThumbnailItem } from '@/lib/experiments/thumbnail'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unavailable = 'This experiment is not available.'
const unchanged = 'The image could not be saved. The current image is unchanged.'
const rejected = 'Use a thumbnail up to 256 by 256 pixels and 150 KB.'

function safeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value)) return undefined
  if (value.toLowerCase().includes('sk-')) return undefined
  return value
}

function failureStage(error: { message?: string; error?: string; status?: number }): string {
  const message = `${error.message ?? ''} ${error.error ?? ''}`.toLowerCase()
  if (message.includes('mime')) return 'mime'
  if (message.includes('row-level security') || message.includes('policy')) return 'rls'
  if (message.includes('bucket')) return 'bucket'
  if (message.includes('jwt') || message.includes('unauthorized') || error.status === 401) return 'auth'
  if (message.includes('check') || message.includes('constraint')) return 'constraint'
  return 'storage'
}

function logThumbnailFailure(operation: string, error: { message?: string; error?: string; status?: number; statusCode?: string; code?: string }) {
  console.error('concept thumbnail failed', {
    operation,
    stage: failureStage(error),
    status: typeof error.status === 'number' ? error.status : undefined,
    code: safeToken(error.statusCode) ?? safeToken(error.code),
  })
}

function generationError(reason: ConceptImageFailure) {
  if (reason === 'configuration') return { status: 503, error: 'Image generation is not configured on the server.' }
  if (reason === 'rate-limit') return { status: 429, error: 'Image generation is busy right now. Wait a moment and try again.' }
  if (reason === 'timeout') return { status: 504, error: 'Image generation took too long. Try again.' }
  if (reason === 'invalid') return { status: 502, error: 'The generated image could not be used. Try again.' }
  return { status: 502, error: 'The image could not be created. Try again.' }
}

async function loadItem(explorationId: string, experimentId: string, itemId: string, userId: string): Promise<ThumbnailItem | { status: 'missing-item' }> {
  const supabase = await createClient()
  const owned = await supabase
    .from('experiments')
    .select('id')
    .eq('id', experimentId)
    .eq('exploration_id', explorationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (owned.error) return { status: 'error' }
  if (!owned.data) return { status: 'not-found' }
  const item = await supabase
    .from('experiment_items')
    .select('id, kind, image_path')
    .eq('id', itemId)
    .eq('experiment_id', experimentId)
    .maybeSingle()
  if (item.error) return { status: 'error' }
  if (!item.data || typeof item.data.kind !== 'string') return { status: 'missing-item' }
  const imagePath = item.data.image_path == null ? null : item.data.image_path
  if (imagePath !== null && typeof imagePath !== 'string') return { status: 'error' }
  return { status: 'ok', kind: item.data.kind, imagePath }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; experimentId: string; itemId: string }> }) {
  const claims = await getAuthenticatedClaims()
  const { id, experimentId, itemId } = await context.params
  const userId = typeof claims?.sub === 'string' ? claims.sub : ''
  if (!claims?.sub || !uuidPattern.test(id) || !uuidPattern.test(experimentId) || !uuidPattern.test(itemId)) {
    return NextResponse.json({ error: unavailable }, { status: claims?.sub ? 404 : 401, headers: { 'cache-control': 'no-store' } })
  }
  const loaded = await loadItem(id, experimentId, itemId, userId)
  if (loaded.status !== 'ok' || !loaded.imagePath || !ownedThumbnailPath(loaded.imagePath, userId, experimentId, itemId)) {
    const status = loaded.status === 'error' ? 503 : 404
    return NextResponse.json({ error: loaded.status === 'error' ? unchanged : unavailable }, { status, headers: { 'cache-control': 'no-store' } })
  }
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(THUMBNAIL_BUCKET).download(loaded.imagePath)
  if (error || !data) {
    if (error) logThumbnailFailure('download', error)
    return NextResponse.json({ error: unchanged }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  return new NextResponse(await data.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'private, max-age=60',
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ id: string; experimentId: string; itemId: string }> }) {
  const claims = await getAuthenticatedClaims()
  const { id, experimentId, itemId } = await context.params
  const userId = typeof claims?.sub === 'string' ? claims.sub : null
  if (!uuidPattern.test(id) || !uuidPattern.test(experimentId) || !uuidPattern.test(itemId)) {
    return NextResponse.json({ error: unavailable }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  const contentType = request.headers.get('content-type') ?? ''
  const supabase = await createClient()

  if (!contentType.includes('multipart/form-data')) {
    const body: unknown = await request.json().catch(() => null)
    const record = body && typeof body === 'object' ? body as { action?: unknown; prompt?: unknown } : {}
    if (record.action === 'generate' && typeof record.prompt === 'string') {
      if (!userId) return NextResponse.json({ error: 'Sign in to add an image.' }, { status: 401, headers: { 'cache-control': 'no-store' } })
      const loaded = await loadItem(id, experimentId, itemId, userId)
      if (loaded.status === 'not-found') return NextResponse.json({ error: unavailable }, { status: 404, headers: { 'cache-control': 'no-store' } })
      const kind = loaded.status === 'missing-item' ? 'concept' : loaded.status === 'ok' ? loaded.kind : ''
      if (loaded.status === 'error' || !maySubmitConceptPrompt({ confirmed: true, inFlight: false, prompt: record.prompt, kind })) {
        return NextResponse.json({ error: loaded.status === 'ok' ? 'Choose a prompt before generating an image.' : unchanged }, { status: loaded.status === 'ok' ? 422 : 503, headers: { 'cache-control': 'no-store' } })
      }
      const generated = await requestConceptImage(record.prompt.trim())
      if (!generated.ok) {
        const failure = generationError(generated.reason)
        return NextResponse.json({ error: failure.error }, { status: failure.status, headers: { 'cache-control': 'no-store' } })
      }
      return NextResponse.json({ preview: Buffer.from(generated.bytes).toString('base64'), contentType: 'image/webp' }, { status: 200, headers: { 'cache-control': 'no-store' } })
    }
    if (record.action !== 'remove') {
      return NextResponse.json({ error: unchanged }, { status: 422, headers: { 'cache-control': 'no-store' } })
    }
  }

  let bytes: Uint8Array | undefined
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('image')
    if (!(file instanceof File) || file.size < 1 || file.size > THUMBNAIL_MAX_BYTES) {
      return NextResponse.json({ error: rejected }, { status: 422, headers: { 'cache-control': 'no-store' } })
    }
    bytes = new Uint8Array(await file.arrayBuffer())
  }

  const result = await applyThumbnail({
    signedIn: Boolean(userId),
    userId,
    experimentId,
    itemId,
    action: bytes ? 'store' : 'remove',
    bytes,
    load: async () => {
      const loaded = await loadItem(id, experimentId, itemId, userId ?? '')
      return loaded.status === 'missing-item' ? { status: 'not-found' as const } : loaded
    },
    createFileId: () => crypto.randomUUID(),
    putObject: async (path, file) => {
      const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, new Blob([file], { type: 'image/webp' }), { contentType: 'image/webp', upsert: false })
      if (error) logThumbnailFailure('upload', error)
      return !error
    },
    removeObject: async (path) => {
      const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).remove([path])
      if (error) logThumbnailFailure('remove', error)
      return !error
    },
    setPath: async (path) => {
      const { data, error } = await supabase
        .from('experiment_items')
        .update({ image_path: path, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('experiment_id', experimentId)
        .select('id')
      if (error) logThumbnailFailure('update-path', error)
      return !error && Boolean(data?.length)
    },
  })
  return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': result.cacheControl } })
}
