import { NextResponse } from 'next/server'
import { getAuthenticatedClaims } from '@/lib/auth/session'
import { FOCUS_IMAGE_MAX_BYTES } from '@/lib/focus-image/bytes'
import { prepareFocusImage, type FocusImageAction, type FocusImageLoad } from '@/lib/focus-image/decide'
import { requestFocusImage } from '@/lib/focus-image/openai'
import { FOCUS_IMAGE_BUCKET, ownedFocusImagePath } from '@/lib/focus-image/paths'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const explorationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const rejectedFile = 'Use a JPEG, PNG, or WebP image up to 5 MB.'

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

function logFocusImageFailure(operation: string, error: { message?: string; error?: string; status?: number; statusCode?: string; code?: string }) {
  console.error('focus image failed', {
    operation,
    stage: failureStage(error),
    status: typeof error.status === 'number' ? error.status : undefined,
    code: safeToken(error.statusCode) ?? safeToken(error.code),
  })
}

function contentTypeFor(path: string): string | null {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  return null
}

async function loadFocusImage(id: string): Promise<FocusImageLoad> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('explorations').select('focus_image_path').eq('id', id).maybeSingle()
  if (error || !data) return error ? { status: 'error' } : { status: 'not-found' }
  const path = data.focus_image_path
  if (path !== null && typeof path !== 'string') return { status: 'error' }
  return { status: 'ok', focusImagePath: path }
}

async function readAction(request: Request): Promise<FocusImageAction | { error: string }> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('image')
    if (!(file instanceof File) || file.size < 1 || file.size > FOCUS_IMAGE_MAX_BYTES) return { error: rejectedFile }
    return { kind: 'upload', bytes: new Uint8Array(await file.arrayBuffer()) }
  }
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('action' in body)) return { error: 'The focus image is unavailable right now. Try again.' }
  const record = body as { action?: unknown; prompt?: unknown; pendingPath?: unknown }
  if (record.action === 'generate' && typeof record.prompt === 'string') return { kind: 'generate', prompt: record.prompt }
  if (record.action === 'commit' && typeof record.pendingPath === 'string') return { kind: 'commit', pendingPath: record.pendingPath }
  if (record.action === 'discard' && typeof record.pendingPath === 'string') return { kind: 'discard', pendingPath: record.pendingPath }
  if (record.action === 'remove') return { kind: 'remove' }
  return { error: 'The focus image is unavailable right now. Try again.' }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const claims = await getAuthenticatedClaims()
  const { id } = await context.params
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Sign in to add a focus image.' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }
  if (!explorationIdPattern.test(id)) {
    return NextResponse.json({ error: 'This exploration is not available.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  const loaded = await loadFocusImage(id)
  if (loaded.status !== 'ok' || !loaded.focusImagePath || !ownedFocusImagePath(loaded.focusImagePath, claims.sub, id)) {
    const status = loaded.status === 'error' ? 503 : 404
    const error = loaded.status === 'error' ? 'The focus image is unavailable right now. Try again.' : 'This exploration is not available.'
    return NextResponse.json({ error }, { status, headers: { 'cache-control': 'no-store' } })
  }
  const contentType = contentTypeFor(loaded.focusImagePath)
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(FOCUS_IMAGE_BUCKET).download(loaded.focusImagePath)
  if (error || !data || !contentType) {
    return NextResponse.json({ error: 'The focus image is unavailable right now. Try again.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  return new NextResponse(await data.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=60',
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const claims = await getAuthenticatedClaims()
  const { id } = await context.params
  if (!explorationIdPattern.test(id)) {
    return NextResponse.json({ error: 'This exploration is not available.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  const action = await readAction(request)
  if ('error' in action) {
    return NextResponse.json({ error: action.error }, { status: 422, headers: { 'cache-control': 'no-store' } })
  }
  const supabase = await createClient()
  const result = await prepareFocusImage({
    signedIn: Boolean(claims?.sub),
    userId: typeof claims?.sub === 'string' ? claims.sub : null,
    explorationId: id,
    action,
    load: () => loadFocusImage(id),
    generate: requestFocusImage,
    createFileId: () => crypto.randomUUID(),
    putObject: async (path, bytes, contentType) => {
      const { error } = await supabase.storage.from(FOCUS_IMAGE_BUCKET).upload(path, new Blob([bytes], { type: contentType }), { contentType, upsert: false })
      if (error) {
        logFocusImageFailure('upload', error)
        return false
      }
      return true
    },
    removeObject: async (path) => {
      const { error } = await supabase.storage.from(FOCUS_IMAGE_BUCKET).remove([path])
      if (error) logFocusImageFailure('remove', error)
      return !error
    },
    objectExists: async (path) => {
      const name = path.split('/').at(-1)
      const folder = path.split('/').slice(0, -1).join('/')
      if (!name) return false
      const { data, error } = await supabase.storage.from(FOCUS_IMAGE_BUCKET).list(folder, { search: name, limit: 20 })
      if (error) logFocusImageFailure('list', error)
      return !error && Boolean(data?.some(item => item.name === name))
    },
    setPath: async (path) => {
      const { data, error } = await supabase.from('explorations').update({ focus_image_path: path }).eq('id', id).select('id')
      if (error) logFocusImageFailure('update-path', error)
      return !error && Boolean(data?.length)
    },
  })
  return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': result.cacheControl } })
}
