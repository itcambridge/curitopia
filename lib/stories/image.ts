import type { ExperimentItemKind } from '@/lib/experiments/rules'
import { STORY_CLOSING_LIMIT, type StorySlide, type StorySource } from '@/lib/stories/draft'

/** Exact 9:16. Both edges are divisible by 16, which the current image model requires. */
export const STORY_PORTRAIT_SIZE = '1152x2048'
/** Portrait size for older image models that only accept the standard sizes. It is 2:3, not 9:16. */
export const STORY_FALLBACK_SIZE = '1024x1536'
export const STORY_IMAGE_MAX_BYTES = 8 * 1024 * 1024

const nativePortraitModels = [
  'gpt-image-2',
  'gpt-image-2-2026-04-21',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-sunburst-2026-09-08',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-flare-2026-09-08',
]

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type StoryImageRequest =
  | { kind: 'question'; questionId: string; opening: boolean }
  | { kind: 'item'; itemId: string }
  | { kind: 'closing'; text: string }

export type StoryImageRole = 'opening' | 'question' | 'closing' | ExperimentItemKind

const style = [
  'Create original vision-board artwork for one vertical slide.',
  'Make one specific, sensory scene or a clear visual metaphor. It should feel curious, concrete, and memorable.',
  'Use light, scale, a place, an object, or a contrast to suggest a possibility. Do not make a stock photo, a corporate icon, a diagram, or a person pointing at a screen.',
  'Do not draw letters, words, numbers, captions, logos, or watermarks. The words will be added later by the application.',
  'Compose for a tall 9:16 frame. Keep the main subject inside the central two-thirds, and leave the lower area quieter so type can sit there.',
  'The craft should feel consistent with other slides in the same story: one strong subject and rich light. The subject itself must belong to this idea alone.',
].join(' ')

function roleLine(role: StoryImageRole) {
  if (role === 'opening' || role === 'question') return 'This is an open question, not an answer. Suggest wonder or tension. Do not show the question as solved.'
  if (role === 'closing') return 'This is a question written for the viewer. It is not a moral, a verdict, or an answer.'
  if (role === 'hypothesis') return 'This is a tentative idea. Do not show it as proven, and do not invent a result.'
  if (role === 'test') return 'This is an investigation someone chose to try. Do not show success or failure unless these words say so.'
  if (role === 'observation') return 'Show only what was recorded. Do not add a conclusion that was not written.'
  if (role === 'discovery') return 'Show the conclusion that was written. Do not invent extra proof or a result beyond these words.'
  if (role === 'concept') return 'Show this idea as a concrete image, not as a label or a title card.'
  return 'Show this note as a concrete image. Do not turn it into a page of writing.'
}

/** The prompt contains one slide. It does not include any other question or item. */
export function storyImagePrompt(role: StoryImageRole, text: string) {
  const idea = text.trim().replace(/\s+/g, ' ').slice(0, STORY_CLOSING_LIMIT)
  return `${style} ${roleLine(role)} Idea: ${idea}`
}

export function storyImageSize(model: string): { size: typeof STORY_PORTRAIT_SIZE | typeof STORY_FALLBACK_SIZE; nativePortrait: boolean } {
  const native = nativePortraitModels.includes(model)
  return native
    ? { size: STORY_PORTRAIT_SIZE, nativePortrait: true }
    : { size: STORY_FALLBACK_SIZE, nativePortrait: false }
}

/** Cover only when the file is already the 9:16 slide. Otherwise the preview must not crop or stretch it. */
export function storyImageFit(width: number, height: number): 'cover' | 'contain' {
  if (width < 1 || height < 1) return 'contain'
  return Math.abs(width / height - 9 / 16) <= 0.02 ? 'cover' : 'contain'
}

export function readStoryImageBody(value: unknown): { confirmed: true; request: StoryImageRequest } | { error: 'confirm' | 'invalid' } {
  if (!value || typeof value !== 'object') return { error: 'invalid' }
  const record = value as { confirmed?: unknown; kind?: unknown; questionId?: unknown; itemId?: unknown; opening?: unknown; text?: unknown }
  if (record.confirmed !== true) return { error: 'confirm' }
  if (record.kind === 'question' && typeof record.questionId === 'string' && uuidPattern.test(record.questionId)) {
    return { confirmed: true, request: { kind: 'question', questionId: record.questionId, opening: record.opening === true } }
  }
  if (record.kind === 'item' && typeof record.itemId === 'string' && uuidPattern.test(record.itemId)) {
    return { confirmed: true, request: { kind: 'item', itemId: record.itemId } }
  }
  if (record.kind === 'closing' && typeof record.text === 'string') {
    const text = record.text.trim()
    if (text.length < 1 || text.length > STORY_CLOSING_LIMIT) return { error: 'invalid' }
    return { confirmed: true, request: { kind: 'closing', text } }
  }
  return { error: 'invalid' }
}

/** Resolves one slide from the loaded exploration. Hidden questions are already absent from the source. */
export function resolveStoryImage(source: StorySource, request: StoryImageRequest): { ok: true; role: StoryImageRole; text: string; prompt: string } | { ok: false; reason: 'missing' } {
  if (request.kind === 'question') {
    const question = source.questions.find(item => item.id === request.questionId)
    if (!question) return { ok: false, reason: 'missing' }
    const role = request.opening ? 'opening' : 'question'
    return { ok: true, role, text: question.text, prompt: storyImagePrompt(role, question.text) }
  }
  if (request.kind === 'item') {
    const item = source.items.find(entry => entry.id === request.itemId)
    if (!item) return { ok: false, reason: 'missing' }
    return { ok: true, role: item.kind, text: item.body, prompt: storyImagePrompt(item.kind, item.body) }
  }
  return { ok: true, role: 'closing', text: request.text, prompt: storyImagePrompt('closing', request.text) }
}

export function storyImageRequest(source: StorySource, slide: StorySlide): StoryImageRequest | null {
  if (slide.kind === 'question') {
    const question = source.questions.find(item => item.id === slide.questionId)
    return question ? { kind: 'question', questionId: question.id, opening: slide.opening } : null
  }
  if (slide.kind === 'item') {
    const item = source.items.find(entry => entry.id === slide.itemId)
    return item ? { kind: 'item', itemId: item.id } : null
  }
  const text = slide.text.trim()
  return text ? { kind: 'closing', text } : null
}
