import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { inspectImage } from '@/lib/focus-image/bytes'
import { DEFAULT_OPENAI_IMAGE_MODEL, openAiImageModel } from '@/lib/focus-image/openai'
import { createStory, moveSlide, setSlideSubtitle, storySource, type StoryItem, type StoryQuestion } from '@/lib/stories/draft'
import { requestStoryImage } from '@/lib/stories/image-openai'
import {
  readStoryImageBody,
  resolveStoryImage,
  storyImageFit,
  storyImagePrompt,
  storyImageRequest,
  storyImageSize,
  STORY_FALLBACK_SIZE,
  STORY_PORTRAIT_SIZE,
} from '@/lib/stories/image'

const questionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherQuestionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const hiddenQuestionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const itemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const otherItemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function question(id: string, text: string, isHidden = false): StoryQuestion & { isHidden: boolean } {
  return { id, text, role: 'satellite', isPrioritised: false, isHidden }
}

function item(id: string, kind: StoryItem['kind'], body: string): StoryItem {
  return { id, experimentId: 'exp-1', questionId, kind, body, position: 0 }
}

const source = storySource('exploration-1', 'Dreams', [
  question(questionId, 'What happens to consciousness when you dream?'),
  question(otherQuestionId, 'Is memory a prediction?'),
  question(hiddenQuestionId, 'This hidden question must stay out', true),
], [
  item(itemId, 'hypothesis', 'Dreams rehearse memories'),
  item(otherItemId, 'test', 'Revisit a familiar place'),
])

function webp(width: number, height: number) {
  const bytes = new Uint8Array(30)
  bytes.set([0x52, 0x49, 0x46, 0x46, 22, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 0)
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

test('the default image model can be asked for a native 9:16 slide', () => {
  assert.equal(DEFAULT_OPENAI_IMAGE_MODEL, 'gpt-image-2.5-flare')
  assert.deepEqual(storyImageSize('gpt-image-2.5-flare'), { size: STORY_PORTRAIT_SIZE, nativePortrait: true })
  assert.equal(STORY_PORTRAIT_SIZE, '1152x2048')
  assert.equal(storyImageFit(1152, 2048), 'cover')
  assert.deepEqual(storyImageSize('gpt-image-1'), { size: STORY_FALLBACK_SIZE, nativePortrait: false })
  assert.equal(storyImageFit(1024, 1536), 'contain')
  assert.equal(storyImageFit(1024, 1024), 'contain')
})

test('a story image prompt contains one slide and does not invent an outcome', () => {
  const hidden = resolveStoryImage(source, { kind: 'question', questionId: hiddenQuestionId, opening: false })
  assert.equal(hidden.ok, false)
  const selected = resolveStoryImage(source, { kind: 'question', questionId, opening: true })
  assert.equal(selected.ok, true)
  if (!selected.ok) return
  assert.match(selected.prompt, /What happens to consciousness when you dream\?/)
  assert.equal(selected.prompt.includes('Is memory a prediction?'), false)
  assert.equal(selected.prompt.includes('This hidden question must stay out'), false)
  assert.equal(selected.prompt.includes('Dreams rehearse memories'), false)
  assert.match(selected.prompt, /Do not draw letters/)
  const hypothesis = resolveStoryImage(source, { kind: 'item', itemId })
  assert.equal(hypothesis.ok, true)
  if (!hypothesis.ok) return
  assert.match(hypothesis.prompt, /tentative idea/)
  assert.match(hypothesis.prompt, /Do not show it as proven/)
  assert.equal(hypothesis.prompt.includes('Revisit a familiar place'), false)
  assert.equal(storyImagePrompt('test', 'Revisit a familiar place').includes('Dreams rehearse memories'), false)
  const closing = storyImagePrompt('closing', 'What would you ask next?')
  assert.match(closing, /What would you ask next\?/)
  assert.equal(closing.includes('What happens to consciousness when you dream?'), false)
})

test('image generation is confirmed, and the request is not a stored file', () => {
  assert.deepEqual(readStoryImageBody({ kind: 'question', questionId, opening: true }), { error: 'confirm' })
  const parsed = readStoryImageBody({ confirmed: true, kind: 'question', questionId, opening: false, prompt: 'Is memory a prediction?' })
  assert.deepEqual(parsed, { confirmed: true, request: { kind: 'question', questionId, opening: false } })
  const made = createStory(source, [questionId], [itemId], questionId)
  assert.equal(made.ok, true)
  if (!made.ok) return
  const request = storyImageRequest(source, made.draft.slides[0])
  assert.deepEqual(request, { kind: 'question', questionId, opening: true })
  const moved = moveSlide(setSlideSubtitle(made.draft, `q:${questionId}`, 'Beyond the senses'), `i:${itemId}`, -1)
  const questionSlide = moved.slides.find(slide => slide.id === `q:${questionId}`)
  assert.equal(questionSlide && questionSlide.kind !== 'closing' ? questionSlide.subtitle : '', 'Beyond the senses')
  assert.equal(moved.slides.some(slide => slide.id === `i:${itemId}`), true)
  const route = readFileSync(new URL('../app/api/explorations/[id]/story-image/route.ts', import.meta.url), 'utf8')
  const client = readFileSync(new URL('../lib/stories/image-openai.ts', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../components/story-screen.tsx', import.meta.url), 'utf8')
  assert.equal(route.includes('.insert('), false)
  assert.equal(route.includes('.update('), false)
  assert.equal(route.includes('.delete('), false)
  assert.equal(route.includes('storage'), false)
  assert.equal(route.includes('console.'), false)
  assert.equal(client.includes('console.log'), false)
  assert.equal(client.includes('b64_json') && client.includes('console.error(\'story image failed\''), true)
  const effectAt = screen.indexOf('useEffect(() =>')
  const effect = screen.slice(effectAt, effectAt + 240)
  assert.match(effect, /abortRef/)
  assert.equal(effect.includes('fetch'), false)
  assert.equal(effect.includes('localStorage'), false)
  assert.equal(screen.includes('localStorage'), false)
  assert.equal(screen.includes('sessionStorage'), false)
  assert.equal(screen.includes('indexedDB'), false)
  assert.match(screen, /Create artwork for this slide\?/)
  assert.match(screen, /confirmed: true/)
  assert.match(screen, /object-fit:cover|story-artwork/)
  assert.match(screen, /Use this artwork/)
  assert.match(screen, /Reject artwork/)
})

test('a mocked story image uses the portrait size and does not log the prompt or the file', async () => {
  const secret = 'What happens to consciousness when you dream?'
  const calls: Record<string, unknown>[] = []
  const logged: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]) => { logged.push(args) }
  try {
    const generated = await requestStoryImage(storyImagePrompt('question', secret), {
      images: {
        generate: async body => {
          calls.push(body)
          return { data: [{ b64_json: Buffer.from(webp(1152, 2048)).toString('base64') }] }
        },
      },
    })
    assert.equal(generated.ok, true)
    if (generated.ok) {
      assert.equal(generated.width, 1152)
      assert.equal(generated.height, 2048)
      assert.equal(inspectImage(generated.bytes)?.width, 1152)
    }
    assert.equal(calls[0]?.size, storyImageSize(openAiImageModel()).size)
    assert.equal(calls[0]?.output_format, 'webp')
    assert.equal(calls[0]?.quality, 'high')
    assert.equal(String(calls[0]?.prompt).includes(secret), true)
    assert.equal(String(calls[0]?.prompt).includes('Is memory a prediction?'), false)
    const failed = await requestStoryImage(secret, {
      images: { generate: async () => { throw new Error(secret) } },
    })
    assert.deepEqual(failed, { ok: false, reason: 'upstream' })
    assert.equal(JSON.stringify(logged).includes(secret), false)
    assert.equal(JSON.stringify(logged).includes('b64_json'), false)
  } finally {
    console.error = original
  }
})
