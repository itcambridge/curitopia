import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { inspectImage } from '@/lib/focus-image/bytes'
import { prepareFocusImage, type FocusImageAction, type FocusImageLoad } from '@/lib/focus-image/decide'
import { requestFocusImage, DEFAULT_OPENAI_IMAGE_MODEL } from '@/lib/focus-image/openai'
import { ownedFocusImagePath } from '@/lib/focus-image/paths'
import { maySubmitFocusPrompt, suggestedFocusPrompt } from '@/lib/focus-image/prompt'

const userId = '11111111-1111-4111-8111-111111111111'
const explorationId = '22222222-2222-4222-8222-222222222222'
const otherUserId = '99999999-9999-4999-8999-999999999999'
const fileId = '33333333-3333-4333-8333-333333333333'

function webp(width = 32, height = 16): Uint8Array {
  const bytes = new Uint8Array(30)
  bytes.set([0x52, 0x49, 0x46, 0x46, 22, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0], 0)
  const w = width - 1
  const h = height - 1
  bytes[24] = w & 255
  bytes[25] = (w >> 8) & 255
  bytes[26] = (w >> 16) & 255
  bytes[27] = h & 255
  bytes[28] = (h >> 8) & 255
  bytes[29] = (h >> 16) & 255
  return bytes
}

function jpeg(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9])
}

function harness(action: FocusImageAction, options: {
  signedIn?: boolean
  userId?: string | null
  currentPath?: string | null
  loadStatus?: FocusImageLoad['status']
  generate?: (prompt: string) => Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: 'upstream' }>
  putObject?: (path: string) => Promise<boolean>
  removeObject?: (path: string) => Promise<boolean>
  objectExists?: (path: string) => Promise<boolean>
  setPath?: (path: string | null) => Promise<boolean>
} = {}) {
  const calls = { load: 0, generate: [] as string[], put: [] as string[], removed: [] as string[], set: [] as Array<string | null> }
  const stored = new Set<string>()
  const result = prepareFocusImage({
    signedIn: options.signedIn ?? true,
    userId: options.userId === undefined ? userId : options.userId,
    explorationId,
    action,
    load: async (): Promise<FocusImageLoad> => {
      calls.load += 1
      if (options.loadStatus === 'not-found') return { status: 'not-found' }
      if (options.loadStatus === 'error') return { status: 'error' }
      return { status: 'ok', focusImagePath: options.currentPath ?? null }
    },
    generate: async (prompt) => {
      calls.generate.push(prompt)
      return options.generate ? options.generate(prompt) : { ok: true, bytes: webp() }
    },
    createFileId: () => fileId,
    putObject: async (path) => {
      calls.put.push(path)
      const saved = options.putObject ? await options.putObject(path) : true
      if (saved) stored.add(path)
      return saved
    },
    removeObject: async (path) => {
      calls.removed.push(path)
      const removed = options.removeObject ? await options.removeObject(path) : true
      if (removed) stored.delete(path)
      return removed
    },
    objectExists: async (path) => options.objectExists ? options.objectExists(path) : stored.has(path) || path.endsWith(`${fileId}.webp`),
    setPath: async (path) => {
      calls.set.push(path)
      return options.setPath ? options.setPath(path) : true
    },
  })
  return { calls, result }
}

test('a suggested prompt uses the anchor question and not the rest of the exploration', () => {
  const prompt = suggestedFocusPrompt('How might these systems connect?')
  assert.match(prompt, /How might these systems connect\?/)
  assert.match(prompt, /visual metaphor/)
  assert.equal(prompt.includes('Hidden question text'), false)
  assert.equal(suggestedFocusPrompt('   '), '')
})

test('editing a prompt or opening the panel does not allow a request', () => {
  assert.equal(maySubmitFocusPrompt({ confirmed: false, inFlight: false, prompt: 'A quiet harbour' }), false)
  assert.equal(maySubmitFocusPrompt({ confirmed: true, inFlight: true, prompt: 'A quiet harbour' }), false)
  assert.equal(maySubmitFocusPrompt({ confirmed: true, inFlight: false, prompt: '   ' }), false)
  assert.equal(maySubmitFocusPrompt({ confirmed: true, inFlight: false, prompt: 'A quiet harbour' }), true)
})

test('an unsigned focus-image request does not load the exploration or call the model', async () => {
  const { calls, result } = harness({ kind: 'generate', prompt: 'A quiet harbour' }, { signedIn: false, userId: null })
  assert.equal((await result).status, 401)
  assert.equal(calls.load, 0)
  assert.deepEqual(calls.generate, [])
})

test('generation sends only the confirmed prompt', async () => {
  const prompt = 'A quiet network of pathways in deep navy light'
  const { calls, result } = harness({ kind: 'generate', prompt: `  ${prompt}  ` })
  const response = await result
  assert.equal(response.status, 200)
  assert.deepEqual(calls.generate, [prompt])
  assert.equal(calls.set.length, 0)
  assert.equal(calls.put.length, 1)
  if ('preview' in response.body) assert.equal(typeof response.body.preview, 'string')
})

test('an empty prompt and a failed generation do not store an image', async () => {
  const empty = await harness({ kind: 'generate', prompt: '   ' }).result
  assert.equal(empty.status, 422)
  const failed = harness({ kind: 'generate', prompt: 'A quiet harbour' }, { generate: async () => ({ ok: false, reason: 'upstream' }) })
  assert.equal((await failed.result).status, 502)
  assert.deepEqual(failed.calls.put, [])
  assert.deepEqual(failed.calls.set, [])
})

test('upload checks the file contents and does not call image generation', async () => {
  const accepted = harness({ kind: 'upload', bytes: jpeg() })
  assert.equal((await accepted.result).status, 200)
  assert.deepEqual(accepted.calls.generate, [])

  const text = harness({ kind: 'upload', bytes: Uint8Array.from([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 33, 33, 33, 33, 33]) })
  assert.equal((await text.result).status, 422)
  assert.deepEqual(text.calls.put, [])

  const oversized = new Uint8Array(5 * 1024 * 1024 + 1)
  oversized.set(webp())
  assert.equal(inspectImage(oversized), null)
  assert.equal(inspectImage(webp(5000, 16)), null)
})

test('another user cannot commit or discard an image path', async () => {
  const foreign = `${otherUserId}/${explorationId}/${fileId}.webp`
  const commit = harness({ kind: 'commit', pendingPath: foreign })
  assert.equal((await commit.result).status, 404)
  assert.deepEqual(commit.calls.set, [])
  const discard = harness({ kind: 'discard', pendingPath: foreign })
  assert.equal((await discard.result).status, 404)
  assert.deepEqual(discard.calls.removed, [])
  assert.equal(ownedFocusImagePath(foreign, userId, explorationId), false)
})

test('a missing exploration is not a place to store an image', async () => {
  const { calls, result } = harness({ kind: 'upload', bytes: webp() }, { loadStatus: 'not-found' })
  assert.equal((await result).status, 404)
  assert.deepEqual(calls.put, [])
})

test('replacement keeps the current image when the new path cannot be saved', async () => {
  const current = `${userId}/${explorationId}/44444444-4444-4444-8444-444444444444.png`
  const pending = `${userId}/${explorationId}/${fileId}.webp`
  const { calls, result } = harness({ kind: 'commit', pendingPath: pending }, { currentPath: current, setPath: async () => false })
  assert.equal((await result).status, 503)
  assert.deepEqual(calls.removed, [])
  assert.deepEqual(calls.set, [pending])
})

test('a successful replacement removes the previous file only after the new path is stored', async () => {
  const current = `${userId}/${explorationId}/44444444-4444-4444-8444-444444444444.png`
  const pending = `${userId}/${explorationId}/${fileId}.webp`
  const order: string[] = []
  const { result } = harness({ kind: 'commit', pendingPath: pending }, {
    currentPath: current,
    setPath: async () => { order.push('set'); return true },
    removeObject: async () => { order.push('remove'); return true },
  })
  assert.equal((await result).status, 200)
  assert.deepEqual(order, ['set', 'remove'])
})

test('removing an image clears the exploration before deleting the file', async () => {
  const current = `${userId}/${explorationId}/${fileId}.webp`
  const order: string[] = []
  const removed = harness({ kind: 'remove' }, {
    currentPath: current,
    setPath: async () => { order.push('clear'); return true },
    removeObject: async () => { order.push('remove'); return true },
  })
  assert.deepEqual((await removed.result).body, { focusImagePath: null })
  assert.deepEqual(order, ['clear', 'remove'])

  const failed = harness({ kind: 'remove' }, { currentPath: current, setPath: async () => false })
  assert.equal((await failed.result).status, 503)
  assert.deepEqual(failed.calls.removed, [])

  const deleteFailed = harness({ kind: 'remove' }, { currentPath: current, removeObject: async () => false })
  assert.equal((await deleteFailed.result).status, 503)
  assert.deepEqual(deleteFailed.calls.set, [null, current])
})

test('a mocked image request uses the image model and the submitted prompt only', async () => {
  const previous = process.env.OPENAI_IMAGE_MODEL
  delete process.env.OPENAI_IMAGE_MODEL
  const seen: { body: Record<string, unknown> | null } = { body: null }
  try {
    const result = await requestFocusImage('A calm field of layered light', {
      images: {
        generate: async (body) => {
          seen.body = body
          return { data: [{ b64_json: Buffer.from(webp()).toString('base64') }] }
        },
      },
    })
    assert.equal(result.ok, true)
    assert.equal(seen.body?.model, DEFAULT_OPENAI_IMAGE_MODEL)
    assert.equal(seen.body?.prompt, 'A calm field of layered light')
    assert.equal(seen.body?.size, '1536x1024')
    assert.equal(seen.body?.n, 1)
    assert.equal(String(seen.body?.prompt).includes('Hidden question text'), false)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_IMAGE_MODEL
    else process.env.OPENAI_IMAGE_MODEL = previous
  }
})

test('the workspace keeps the map usable and does not generate an image by itself', () => {
  const screen = readFileSync(new URL('../components/exploration-screen.tsx', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../components/focus-image-control.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../app/api/explorations/[id]/focus-image/route.ts', import.meta.url), 'utf8')
  assert.match(screen, /QuestionMap/)
  assert.match(screen, /className="focus-image"/)
  assert.match(screen, /FocusImageControl/)
  const sidebar = screen.slice(screen.indexOf('className="sidebar"'), screen.indexOf('className="map-area"'))
  const footer = screen.slice(screen.indexOf('className="map-footer"'), screen.indexOf('review-backdrop'))
  assert.match(sidebar, /sidebar-image-tools/)
  assert.match(sidebar, /FocusImageControl/)
  assert.equal(footer.includes('FocusImageControl'), false)
  assert.match(panel, /aria-label="Focus image"/)
  assert.match(panel, /aria-label=\{hidden \? 'Show image' : 'Hide image'\}/)
  assert.match(panel, /aria-pressed=\{hidden\}/)
  assert.match(panel, /aria-pressed=\{dimmed\}/)
  assert.match(panel, /aria-label=\{dimmed \? 'Less dim' : 'Dim image'\}/)
  assert.equal(screen.includes('>Hide review<'), false)
  assert.match(screen, /aria-label="Hide review"/)
  assert.match(screen, /aria-label="Show review"/)
  assert.equal(panel.includes('useEffect'), false)
  assert.match(panel, /Generate sends this prompt to OpenAI/)
  assert.match(panel, /Use image/)
  assert.match(panel, /Remove image/)
  assert.match(panel, /Hide image/)
  assert.match(css, /\.focus-image \{[^}]*pointer-events:none/)
  assert.equal(route.includes('SUPABASE_SERVICE_ROLE_KEY'), false)
  assert.match(route, /getAuthenticatedClaims/)
  assert.equal(route.includes('OPENAI_MODEL'), false)
  assert.match(route, /new Blob\(\[bytes\], \{ type: contentType \}\)/)
})
