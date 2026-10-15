import { inspectImage, type InspectedImage } from '@/lib/focus-image/bytes'
import { focusImageObjectPath, ownedFocusImagePath } from '@/lib/focus-image/paths'
import { maySubmitFocusPrompt } from '@/lib/focus-image/prompt'

export type FocusImageFailure = 'configuration' | 'rate-limit' | 'timeout' | 'upstream' | 'invalid' | 'unavailable'

export type FocusImageLoad =
  | { status: 'ok'; focusImagePath: string | null }
  | { status: 'not-found' }
  | { status: 'error' }

export type FocusImageAction =
  | { kind: 'generate'; prompt: string }
  | { kind: 'upload'; bytes: Uint8Array }
  | { kind: 'commit'; pendingPath: string }
  | { kind: 'discard'; pendingPath: string }
  | { kind: 'remove' }

type GeneratedImage = { ok: true; bytes: Uint8Array } | { ok: false; reason: FocusImageFailure }

export type FocusImageHttpResult = {
  status: number
  cacheControl: 'no-store'
  body: { error: string } | { pendingPath: string; contentType: InspectedImage['contentType']; preview: string } | { focusImagePath: string | null } | { discarded: true }
}

const unavailable = 'This exploration is not available.'
const imageUnavailable = 'The focus image is unavailable right now. Try again.'
const unchanged = 'The image could not be saved. The current image is unchanged.'
const rejectedFile = 'Use a JPEG, PNG, or WebP image up to 5 MB.'

function httpError(status: number, error: string): FocusImageHttpResult {
  return { status, body: { error }, cacheControl: 'no-store' }
}

function failureStatus(reason: FocusImageFailure): FocusImageHttpResult {
  if (reason === 'configuration') return httpError(503, 'Focus image is not configured on the server.')
  if (reason === 'rate-limit') return httpError(429, 'Image generation is busy right now. Wait a moment and try again.')
  if (reason === 'timeout') return httpError(504, 'Image generation took too long. Try again.')
  if (reason === 'invalid') return httpError(502, 'The generated image could not be used. Try again.')
  return httpError(502, imageUnavailable)
}

function previewBody(path: string, image: InspectedImage, bytes: Uint8Array): FocusImageHttpResult {
  return {
    status: 200,
    cacheControl: 'no-store',
    body: { pendingPath: path, contentType: image.contentType, preview: Buffer.from(bytes).toString('base64') },
  }
}

export async function prepareFocusImage(input: {
  signedIn: boolean
  userId: string | null
  explorationId: string
  action: FocusImageAction
  load: () => Promise<FocusImageLoad>
  generate: (prompt: string) => Promise<GeneratedImage>
  createFileId: () => string
  putObject: (path: string, bytes: Uint8Array, contentType: string) => Promise<boolean>
  removeObject: (path: string) => Promise<boolean>
  objectExists: (path: string) => Promise<boolean>
  setPath: (path: string | null) => Promise<boolean>
}): Promise<FocusImageHttpResult> {
  if (!input.signedIn || !input.userId) return httpError(401, 'Sign in to add a focus image.')
  const loaded = await input.load()
  if (loaded.status === 'error') return httpError(503, imageUnavailable)
  if (loaded.status === 'not-found') return httpError(404, unavailable)

  if (input.action.kind === 'generate') {
    if (!maySubmitFocusPrompt({ confirmed: true, inFlight: false, prompt: input.action.prompt })) {
      return httpError(422, 'Choose a prompt before generating an image.')
    }
    const prompt = input.action.prompt.trim()
    const generated = await input.generate(prompt)
    if (!generated.ok) return failureStatus(generated.reason)
    const image = inspectImage(generated.bytes)
    if (!image) return httpError(502, 'The generated image could not be used. Try again.')
    const path = focusImageObjectPath(input.userId, input.explorationId, input.createFileId(), image.kind)
    if (!path) return httpError(503, imageUnavailable)
    const stored = await input.putObject(path, generated.bytes, image.contentType)
    if (!stored) return httpError(503, unchanged)
    return previewBody(path, image, generated.bytes)
  }

  if (input.action.kind === 'upload') {
    const image = inspectImage(input.action.bytes)
    if (!image) return httpError(422, rejectedFile)
    const path = focusImageObjectPath(input.userId, input.explorationId, input.createFileId(), image.kind)
    if (!path) return httpError(503, imageUnavailable)
    const stored = await input.putObject(path, input.action.bytes, image.contentType)
    if (!stored) return httpError(503, unchanged)
    return previewBody(path, image, input.action.bytes)
  }

  if (input.action.kind === 'discard') {
    if (!ownedFocusImagePath(input.action.pendingPath, input.userId, input.explorationId)) return httpError(404, unavailable)
    if (input.action.pendingPath === loaded.focusImagePath) return httpError(404, unavailable)
    const removed = await input.removeObject(input.action.pendingPath)
    if (!removed) return httpError(503, imageUnavailable)
    return { status: 200, cacheControl: 'no-store', body: { discarded: true } }
  }

  if (input.action.kind === 'remove') {
    const current = loaded.focusImagePath
    if (!current) return { status: 200, cacheControl: 'no-store', body: { focusImagePath: null } }
    const cleared = await input.setPath(null)
    if (!cleared) return httpError(503, imageUnavailable)
    const removed = await input.removeObject(current)
    if (!removed) {
      await input.setPath(current)
      return httpError(503, imageUnavailable)
    }
    return { status: 200, cacheControl: 'no-store', body: { focusImagePath: null } }
  }

  if (!ownedFocusImagePath(input.action.pendingPath, input.userId, input.explorationId)) return httpError(404, unavailable)
  const exists = await input.objectExists(input.action.pendingPath)
  if (!exists) return httpError(404, unavailable)
  const previous = loaded.focusImagePath
  const saved = await input.setPath(input.action.pendingPath)
  if (!saved) return httpError(503, unchanged)
  if (previous && previous !== input.action.pendingPath) await input.removeObject(previous)
  return { status: 200, cacheControl: 'no-store', body: { focusImagePath: input.action.pendingPath } }
}
