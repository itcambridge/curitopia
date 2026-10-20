import { NextResponse } from 'next/server'
import { getAuthenticatedClaims } from '@/lib/auth/session'
import { readStoryImageBody, resolveStoryImage, storyImageFit } from '@/lib/stories/image'
import { requestStoryImage, type StoryImageFailure } from '@/lib/stories/image-openai'
import { loadStorySource } from '@/lib/stories/load'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const explorationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function failure(reason: StoryImageFailure) {
  if (reason === 'configuration') return { status: 503, error: 'Image generation is not configured on the server.' }
  if (reason === 'rate-limit') return { status: 429, error: 'Image generation is busy right now. Wait a moment and try again.' }
  if (reason === 'timeout') return { status: 504, error: 'Image generation took too long. Try again.' }
  if (reason === 'invalid') return { status: 502, error: 'The generated image could not be used. Try again.' }
  return { status: 502, error: 'The image could not be created. Try again.' }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const claims = await getAuthenticatedClaims()
  const { id } = await context.params
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Sign in to create artwork.' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }
  if (!explorationIdPattern.test(id)) {
    return NextResponse.json({ error: 'This exploration is not available.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  const body = readStoryImageBody(await request.json().catch(() => null))
  if ('error' in body) {
    const error = body.error === 'confirm' ? 'Confirm before creating artwork.' : 'This slide cannot be illustrated.'
    return NextResponse.json({ error }, { status: 422, headers: { 'cache-control': 'no-store' } })
  }
  const loaded = await loadStorySource(id)
  if (loaded.status === 'error') {
    return NextResponse.json({ error: 'This exploration is unavailable right now. Try again.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  if (loaded.status !== 'ok') {
    return NextResponse.json({ error: 'This exploration is not available.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  const resolved = resolveStoryImage(loaded.source, body.request)
  if (!resolved.ok) {
    return NextResponse.json({ error: 'This slide cannot be illustrated.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  const generated = await requestStoryImage(resolved.prompt)
  if (!generated.ok) {
    const reason = failure(generated.reason)
    return NextResponse.json({ error: reason.error }, { status: reason.status, headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.json({
    image: Buffer.from(generated.bytes).toString('base64'),
    contentType: 'image/webp',
    width: generated.width,
    height: generated.height,
    fit: storyImageFit(generated.width, generated.height),
  }, { status: 200, headers: { 'cache-control': 'no-store' } })
}
