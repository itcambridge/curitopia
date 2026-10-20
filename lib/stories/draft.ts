import { experimentItemKind, experimentItemKinds, type ExperimentItemKind } from '@/lib/experiments/rules'

export const STORY_SUBTITLE_LIMIT = 80
export const STORY_CLOSING_LIMIT = 2000

export type StoryQuestion = {
  id: string
  text: string
  role: 'central' | 'satellite'
  isPrioritised: boolean
}

export type StoryItem = {
  id: string
  experimentId: string
  questionId: string
  kind: ExperimentItemKind
  body: string
  position: number
}

export type StorySource = {
  explorationId: string
  title: string
  questions: StoryQuestion[]
  items: StoryItem[]
}

export type StorySlide =
  | { id: string; kind: 'question'; questionId: string; opening: boolean; subtitle: string }
  | { id: string; kind: 'item'; itemId: string; subtitle: string }
  | { id: string; kind: 'closing'; text: string }

export type StoryDraft = {
  explorationId: string
  slides: StorySlide[]
}

type SourceQuestion = StoryQuestion & { isHidden?: boolean }

/** Visible questions only. Hidden question text is not copied into the story source. */
export function storySource(
  explorationId: string,
  title: string,
  questions: readonly SourceQuestion[],
  items: readonly StoryItem[],
): StorySource {
  return {
    explorationId,
    title,
    questions: questions.filter(question => question.isHidden !== true).map(question => ({
      id: question.id,
      text: question.text,
      role: question.role,
      isPrioritised: question.isPrioritised,
    })),
    items: items.map(item => ({ ...item })),
  }
}

export function storyKindLabel(kind: ExperimentItemKind) {
  return experimentItemKinds.find(item => item.kind === kind)?.label ?? 'Item'
}

/** Creating, editing, or discarding a story does not write the exploration. */
export function storyLeaveEffect(): { writes: readonly []; changesQuestions: false; changesItems: false; changesImages: false } {
  return { writes: [], changesQuestions: false, changesItems: false, changesImages: false }
}

function questionSlideId(id: string) {
  return `q:${id}`
}

function itemSlideId(id: string) {
  return `i:${id}`
}

function cleanSubtitle(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.slice(0, STORY_SUBTITLE_LIMIT)
}

function selectedQuestions(source: StorySource, questionIds: readonly string[]) {
  const wanted = new Set(questionIds)
  return source.questions.filter(question => wanted.has(question.id))
}

function selectedItems(source: StorySource, itemIds: readonly string[]) {
  const wanted = new Set(itemIds)
  return source.items.filter(item => wanted.has(item.id))
}

function openingId(questions: readonly StoryQuestion[], requested: string | null) {
  if (requested && questions.some(question => question.id === requested)) return requested
  return questions.find(question => question.role === 'central')?.id ?? questions[0]?.id ?? null
}

export function createStory(
  source: StorySource,
  questionIds: readonly string[],
  itemIds: readonly string[],
  requestedOpeningId: string | null = null,
): { ok: true; draft: StoryDraft } | { ok: false; reason: 'unknown' | 'no-question' } {
  if (questionIds.some(id => !source.questions.some(question => question.id === id))) return { ok: false, reason: 'unknown' }
  if (itemIds.some(id => !source.items.some(item => item.id === id))) return { ok: false, reason: 'unknown' }
  const questions = selectedQuestions(source, questionIds)
  if (questions.length === 0) return { ok: false, reason: 'no-question' }
  const opening = openingId(questions, requestedOpeningId)
  const questionSlides: StorySlide[] = questions.map(question => ({
    id: questionSlideId(question.id),
    kind: 'question' as const,
    questionId: question.id,
    opening: question.id === opening,
    subtitle: '',
  }))
  const slides: StorySlide[] = [
    ...questionSlides.filter(slide => slide.kind === 'question' && slide.opening),
    ...questionSlides.filter(slide => slide.kind === 'question' && !slide.opening),
    ...selectedItems(source, itemIds).map(item => ({
      id: itemSlideId(item.id),
      kind: 'item' as const,
      itemId: item.id,
      subtitle: '',
    })),
  ]
  return { ok: true, draft: { explorationId: source.explorationId, slides } }
}

function ensureOpening(slides: StorySlide[]): StorySlide[] {
  const questions = slides.filter(slide => slide.kind === 'question')
  if (questions.length === 0) return slides
  if (questions.some(slide => slide.opening)) return slides
  const first = questions[0]
  return slides.map(slide => slide.kind === 'question' && slide.id === first.id ? { ...slide, opening: true } : slide)
}

/** Keep the current order and subtitles. Newly selected slides are appended before the closing question. */
export function syncStory(
  current: StoryDraft,
  source: StorySource,
  questionIds: readonly string[],
  itemIds: readonly string[],
): { ok: true; draft: StoryDraft } | { ok: false; reason: 'unknown' | 'no-question' | 'other-exploration' } {
  if (current.explorationId !== source.explorationId) return { ok: false, reason: 'other-exploration' }
  if (questionIds.some(id => !source.questions.some(question => question.id === id))) return { ok: false, reason: 'unknown' }
  if (itemIds.some(id => !source.items.some(item => item.id === id))) return { ok: false, reason: 'unknown' }
  const questions = new Set(questionIds)
  const items = new Set(itemIds)
  if (questions.size === 0) return { ok: false, reason: 'no-question' }
  const kept = current.slides.filter(slide => {
    if (slide.kind === 'closing') return true
    if (slide.kind === 'question') return questions.has(slide.questionId)
    return items.has(slide.itemId)
  })
  const knownQuestions = new Set(kept.flatMap(slide => slide.kind === 'question' ? [slide.questionId] : []))
  const knownItems = new Set(kept.flatMap(slide => slide.kind === 'item' ? [slide.itemId] : []))
  const added: StorySlide[] = [
    ...selectedQuestions(source, questionIds).filter(question => !knownQuestions.has(question.id)).map(question => ({
      id: questionSlideId(question.id),
      kind: 'question' as const,
      questionId: question.id,
      opening: false,
      subtitle: '',
    })),
    ...selectedItems(source, itemIds).filter(item => !knownItems.has(item.id)).map(item => ({
      id: itemSlideId(item.id),
      kind: 'item' as const,
      itemId: item.id,
      subtitle: '',
    })),
  ]
  const closingIndex = kept.findIndex(slide => slide.kind === 'closing')
  const slides = closingIndex === -1 ? [...kept, ...added] : [...kept.slice(0, closingIndex), ...added, ...kept.slice(closingIndex)]
  return { ok: true, draft: { explorationId: source.explorationId, slides: ensureOpening(slides) } }
}

export function moveSlide(draft: StoryDraft, slideId: string, direction: -1 | 1): StoryDraft {
  const index = draft.slides.findIndex(slide => slide.id === slideId)
  const next = index + direction
  if (index < 0 || next < 0 || next >= draft.slides.length) return draft
  const slides = [...draft.slides]
  const [moved] = slides.splice(index, 1)
  slides.splice(next, 0, moved)
  return { ...draft, slides }
}

export function removeSlide(draft: StoryDraft, slideId: string): StoryDraft {
  const target = draft.slides.find(slide => slide.id === slideId)
  const questionCount = draft.slides.filter(slide => slide.kind === 'question').length
  if (target?.kind === 'question' && questionCount <= 1) return draft
  return { ...draft, slides: ensureOpening(draft.slides.filter(slide => slide.id !== slideId)) }
}

export function setSlideSubtitle(draft: StoryDraft, slideId: string, subtitle: string): StoryDraft {
  const next = cleanSubtitle(subtitle)
  return {
    ...draft,
    slides: draft.slides.map(slide => {
      if (slide.id !== slideId || slide.kind === 'closing') return slide
      return { ...slide, subtitle: next }
    }),
  }
}

export function setOpening(draft: StoryDraft, questionId: string): StoryDraft {
  if (!draft.slides.some(slide => slide.kind === 'question' && slide.questionId === questionId)) return draft
  return {
    ...draft,
    slides: draft.slides.map(slide => slide.kind === 'question' ? { ...slide, opening: slide.questionId === questionId } : slide),
  }
}

export function setClosingQuestion(draft: StoryDraft, text: string): StoryDraft {
  const closing = text.trim().slice(0, STORY_CLOSING_LIMIT)
  const without = draft.slides.filter(slide => slide.kind !== 'closing')
  if (!closing) return { ...draft, slides: without }
  const existing = draft.slides.find(slide => slide.kind === 'closing')
  if (existing && existing.kind === 'closing') {
    return { ...draft, slides: draft.slides.map(slide => slide.kind === 'closing' ? { ...slide, text: closing } : slide) }
  }
  return { ...draft, slides: [...without, { id: 'closing', kind: 'closing', text: closing }] }
}

export function questionText(source: StorySource, questionId: string) {
  return source.questions.find(question => question.id === questionId)?.text ?? null
}

export function itemRecord(source: StorySource, itemId: string) {
  return source.items.find(item => item.id === itemId) ?? null
}

export function isStoryItemKind(value: string) {
  return experimentItemKind(value) !== null
}
