import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { openAiImageModel } from '@/lib/focus-image/openai'
import { requestConceptImage } from '@/lib/experiments/thumbnail-openai'
import { editThumbnailPrompt, maySubmitConceptPrompt, nextThumbnailPrompt, suggestedConceptPrompt, type ThumbnailPromptState } from '@/lib/experiments/thumbnail-prompt'
import { applyThumbnail, inspectThumbnail, isThumbnailSource, missingImagePathColumn, ownedThumbnailPath, thumbnailObjectPath, thumbnailPathForItem, THUMBNAIL_MAX_BYTES, type ThumbnailItem } from '@/lib/experiments/thumbnail'

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const experimentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const itemId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const otherUser = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const fileId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function webp(width: number, height: number, extra = 0) {
  const bytes = new Uint8Array(30 + extra)
  bytes[0] = 0x52
  bytes[1] = 0x49
  bytes[2] = 0x46
  bytes[3] = 0x46
  bytes[8] = 0x57
  bytes[9] = 0x45
  bytes[10] = 0x42
  bytes[11] = 0x50
  bytes[12] = 0x56
  bytes[13] = 0x50
  bytes[14] = 0x38
  bytes[15] = 0x58
  const wide = width - 1
  const high = height - 1
  bytes[24] = wide & 255
  bytes[25] = (wide >> 8) & 255
  bytes[26] = (wide >> 16) & 255
  bytes[27] = high & 255
  bytes[28] = (high >> 8) & 255
  bytes[29] = (high >> 16) & 255
  return bytes
}

function concept(imagePath: string | null): ThumbnailItem {
  return { status: 'ok', kind: 'concept', imagePath }
}

test('a thumbnail must be a small webp of this concept', () => {
  assert.deepEqual(inspectThumbnail(webp(256, 256)), { width: 256, height: 256, contentType: 'image/webp' })
  assert.equal(inspectThumbnail(webp(257, 100)), null)
  assert.equal(inspectThumbnail(webp(10, 10, THUMBNAIL_MAX_BYTES)), null)
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
  assert.equal(inspectThumbnail(png), null)
  assert.equal(isThumbnailSource(png), true)
  assert.equal(isThumbnailSource(new Uint8Array([1, 2, 3, 4])), false)
  const path = thumbnailObjectPath(userId, experimentId, itemId, fileId)
  assert.equal(path, `${userId}/${experimentId}/${itemId}/${fileId}.webp`)
  assert.equal(ownedThumbnailPath(path ?? '', userId, experimentId, itemId), true)
  assert.equal(ownedThumbnailPath(path ?? '', otherUser, experimentId, itemId), false)
  assert.equal(ownedThumbnailPath(path ?? '', userId, itemId, itemId), false)
  assert.equal(thumbnailPathForItem(path ?? '', experimentId, itemId), true)
  assert.equal(thumbnailObjectPath('not-a-user', experimentId, itemId, fileId), null)
  assert.equal(missingImagePathColumn({ code: '42703' }), true)
  assert.equal(missingImagePathColumn({ code: '23514', message: 'body' }), false)
})

test('replacing a thumbnail keeps the previous image when a later step fails', async () => {
  const previous = thumbnailObjectPath(userId, experimentId, itemId, fileId) ?? ''
  const objects = new Map<string, Uint8Array>([[previous, webp(8, 8)]])
  let stored: string | null = previous
  const result = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'store',
    bytes: webp(32, 32),
    load: async () => concept(stored),
    createFileId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    putObject: async (path, bytes) => {
      objects.set(path, bytes)
      return true
    },
    removeObject: async (path) => {
      objects.delete(path)
      return true
    },
    setPath: async () => false,
  })
  assert.equal(result.status, 503)
  assert.equal(stored, previous)
  assert.equal(objects.has(previous), true)
  assert.equal(objects.size, 1)

  const removedOld = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'store',
    bytes: webp(32, 32),
    load: async () => concept(previous),
    createFileId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    putObject: async (path, bytes) => {
      objects.set(path, bytes)
      return true
    },
    removeObject: async (path) => path !== previous,
    setPath: async (path) => {
      stored = path
      return true
    },
  })
  assert.equal(removedOld.status, 200)
  assert.equal(stored?.endsWith('/ffffffff-ffff-4fff-8fff-ffffffffffff.webp'), true)
  assert.equal(objects.has(previous), true)

  const uploadFailed = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'store',
    bytes: webp(16, 16),
    load: async () => concept(stored),
    createFileId: () => '99999999-9999-4999-8999-999999999999',
    putObject: async () => false,
    removeObject: async () => true,
    setPath: async () => {
      throw new Error('path should stay')
    },
  })
  assert.equal(uploadFailed.status, 503)
  assert.equal(stored?.endsWith('/ffffffff-ffff-4fff-8fff-ffffffffffff.webp'), true)
})

test('removing a thumbnail restores the path when the file cannot be deleted', async () => {
  const previous = thumbnailObjectPath(userId, experimentId, itemId, fileId) ?? ''
  let stored: string | null = previous
  const failed = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'remove',
    load: async () => concept(stored),
    createFileId: () => fileId,
    putObject: async () => true,
    removeObject: async () => false,
    setPath: async (path) => {
      stored = path
      return true
    },
  })
  assert.equal(failed.status, 503)
  assert.equal(stored, previous)

  const cleared = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'remove',
    load: async () => concept(previous),
    createFileId: () => fileId,
    putObject: async () => true,
    removeObject: async () => true,
    setPath: async (path) => {
      stored = path
      return true
    },
  })
  assert.equal(cleared.status, 200)
  assert.deepEqual(cleared.body, { imagePath: null })
  assert.equal(stored, null)

  for (const kind of ['concept', 'note', 'hypothesis', 'test', 'observation', 'discovery']) {
    const storedKind = await applyThumbnail({
      signedIn: true,
      userId,
      experimentId,
      itemId,
      action: 'store',
      bytes: webp(8, 8),
      load: async () => ({ status: 'ok', kind, imagePath: null }),
      createFileId: () => fileId,
      putObject: async () => true,
      removeObject: async () => true,
      setPath: async () => true,
    })
    assert.equal(storedKind.status, 200, kind)
  }

  const unknown = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'store',
    bytes: webp(8, 8),
    load: async () => ({ status: 'ok', kind: 'question', imagePath: null }),
    createFileId: () => fileId,
    putObject: async () => true,
    removeObject: async () => true,
    setPath: async () => true,
  })
  assert.equal(unknown.status, 422)

  let touched = false
  const foreign = await applyThumbnail({
    signedIn: true,
    userId,
    experimentId,
    itemId,
    action: 'remove',
    load: async () => ({ status: 'ok', kind: 'observation', imagePath: thumbnailObjectPath(otherUser, experimentId, itemId, fileId) }),
    createFileId: () => fileId,
    putObject: async () => true,
    removeObject: async () => true,
    setPath: async () => {
      touched = true
      return true
    },
  })
  assert.equal(foreign.status, 404)
  assert.equal(touched, false)
})

test('generation sends only the confirmed item prompt and stays an explicit action', async () => {
  assert.equal(maySubmitConceptPrompt({ confirmed: false, inFlight: false, prompt: 'A symbol', kind: 'concept' }), false)
  assert.equal(maySubmitConceptPrompt({ confirmed: true, inFlight: true, prompt: 'A symbol', kind: 'concept' }), false)
  for (const kind of ['concept', 'note', 'hypothesis', 'test', 'observation', 'discovery']) {
    assert.equal(maySubmitConceptPrompt({ confirmed: true, inFlight: false, prompt: 'A symbol', kind }), true, kind)
  }
  assert.equal(maySubmitConceptPrompt({ confirmed: true, inFlight: false, prompt: 'A symbol', kind: 'question' }), false)
  assert.match(suggestedConceptPrompt('Consciousness without sensory input'), /Consciousness without sensory input/)
  assert.equal(suggestedConceptPrompt('Consciousness without sensory input').includes('experiment'), false)
  assert.equal(suggestedConceptPrompt('   ', 'note'), '')

  const observationText = 'I recognize places in my dreams that I have visited before.'
  const testText = 'Try to revisit a place that I have been to in previous dreams'
  const labels = [
    ['concept', 'concept'],
    ['note', 'note'],
    ['hypothesis', 'hypothesis'],
    ['test', 'test'],
    ['observation', 'observation'],
    ['discovery', 'discovery'],
  ] as const
  for (const [kind, label] of labels) {
    const prompt = suggestedConceptPrompt(`${kind} text`, kind)
    assert.match(prompt, new RegExp(`this ${label}:`))
    assert.match(prompt, new RegExp(`${kind} text`))
    assert.equal(prompt.includes('""'), false)
  }

  const observation: ThumbnailPromptState = {
    itemId: 'observation-id',
    kind: 'observation',
    body: observationText,
    prompt: suggestedConceptPrompt(observationText, 'observation'),
    customized: false,
  }
  const switched = nextThumbnailPrompt(observation, { itemId: 'test-id', kind: 'test', body: testText })
  assert.equal(switched.prompt, suggestedConceptPrompt(testText, 'test'))
  assert.equal(switched.prompt.includes(observationText), false)
  assert.equal(switched.prompt.includes('observation'), false)
  assert.equal(switched.customized, false)

  const custom = editThumbnailPrompt(switched, 'A lantern in a familiar street')
  assert.equal(custom.customized, true)
  const sameItem = nextThumbnailPrompt(custom, { itemId: 'test-id', kind: 'test', body: 'A revised test' })
  assert.equal(sameItem.prompt, 'A lantern in a familiar street')

  const draft = nextThumbnailPrompt(
    { itemId: 'new-id', kind: 'concept', body: '', prompt: '', customized: false },
    { itemId: 'new-id', kind: 'test', body: testText },
  )
  assert.equal(draft.prompt, suggestedConceptPrompt(testText, 'test'))
  assert.equal(draft.customized, false)

  const previous = process.env.OPENAI_IMAGE_MODEL
  delete process.env.OPENAI_IMAGE_MODEL
  const seen: { body: Record<string, unknown> | null } = { body: null }
  try {
    const generated = await requestConceptImage('A quiet blue sphere', {
      images: {
        generate: async body => {
          seen.body = body
          return { data: [{ b64_json: Buffer.from(webp(64, 64)).toString('base64') }] }
        },
      },
    })
    assert.equal(generated.ok, true)
    assert.equal(seen.body?.prompt, 'A quiet blue sphere')
    assert.equal(seen.body?.model, openAiImageModel())
    assert.equal(JSON.stringify(seen.body).includes('question'), false)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_IMAGE_MODEL
    else process.env.OPENAI_IMAGE_MODEL = previous
  }
})

test('the thumbnail screen keeps text, lazy loading, and cancel', () => {
  const screen = readFileSync(new URL('../components/experiment-screen.tsx', import.meta.url), 'utf8')
  const control = readFileSync(new URL('../components/concept-thumbnail.tsx', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../app/api/explorations/[id]/experiments/[experimentId]/items/[itemId]/thumbnail/route.ts', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(screen, /loading="lazy"/)
  assert.match(screen, /sphereLines\(item\.body\)/)
  assert.match(screen, /kind=\{item\.kind\}/)
  assert.match(screen, /kind=\{draft\.kind\}/)
  assert.match(screen, /<ConceptThumbnail key=\{item\.id\}/)
  assert.match(screen, /<ConceptThumbnail key=\{itemId\}/)
  assert.match(control, /nextThumbnailPrompt/)
  assert.match(control, /editThumbnailPrompt/)
  assert.match(control, /prompt: submitted/)
  assert.equal(screen.includes("item.kind === 'concept' ? <ConceptThumbnail"), false)
  assert.equal(screen.includes("draft.kind === 'concept' ? <ConceptThumbnail"), false)
  assert.match(screen, /width: `\$\{\(node\.radius \* 2 \/ layout\.size\) \* 100\}%`/)
  assert.match(css, /\.constellation-sphere-image \{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; border-radius:inherit;/)
  assert.match(css, /--sphere-image-ink:#071428/)
  assert.match(css, /\.constellation-sphere:has\(\.constellation-sphere-image\) \.constellation-preview \{ color:var\(--sphere-image-ink\); font-weight:700;/)
  assert.match(css, /\.constellation-sphere-wash \{ z-index:1; background:rgba\(255,255,255,\.35\);/)
  assert.match(css, /\.constellation-sphere-highlight \{ z-index:2; background:radial-gradient\(circle at 50% 58%/)
  assert.match(css, /\.constellation-sphere-wash, \.constellation-sphere-highlight \{[^}]*pointer-events:none/)
  assert.match(screen, /constellation-sphere-wash/)
  assert.match(screen, /constellation-sphere-highlight/)
  assert.match(css, /\.constellation-preview \{[^}]*color:#f7fbff/)
  assert.match(css, /\.constellation-centre, \.constellation-sphere \{[^}]*overflow:hidden/)
  assert.match(control, /Add image/)
  assert.match(control, /Replace image/)
  assert.match(control, /Remove image/)
  assert.match(route, /missing-item/)
  assert.match(control, /Cancel/)
  assert.match(control, /makeConceptThumbnail/)
  assert.match(control, /The prompt below is sent to OpenAI/)
  assert.equal(control.includes('requestConceptImage'), false)
  assert.match(route, /requestConceptImage\(record\.prompt\.trim\(\)\)/)
  assert.match(route, /action: bytes \? 'store' : 'remove'/)
  assert.equal(route.includes("from('questions')"), false)
  assert.equal(route.includes('focus_image_path'), false)
  assert.equal(screen.includes('openai'), false)
})
