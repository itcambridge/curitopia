import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { experimentItemKinds } from '@/lib/experiments/rules'
import {
  createStory,
  moveSlide,
  questionText,
  removeSlide,
  setClosingQuestion,
  setSlideSubtitle,
  storyKindLabel,
  storyLeaveEffect,
  storySource,
  syncStory,
  type StoryItem,
  type StoryQuestion,
} from '@/lib/stories/draft'

function question(id: string, text: string, role: StoryQuestion['role'] = 'satellite', isPrioritised = false, isHidden = false): StoryQuestion & { isHidden: boolean } {
  return { id, text, role, isPrioritised, isHidden }
}

function item(id: string, kind: StoryItem['kind'], body: string, questionId = 'central'): StoryItem {
  return { id, experimentId: 'exp-1', questionId, kind, body, position: 0 }
}

const source = storySource('exploration-1', 'Dreams', [
  question('central', 'What happens to consciousness when you dream?', 'central', true),
  question('star', 'Is memory a prediction?', 'satellite', true),
  question('plain', 'What is a dream for?', 'satellite', false),
  question('hidden', 'This hidden question must stay out', 'satellite', true, true),
], [
  item('concept-1', 'concept', 'A picture of a house'),
  item('hyp-1', 'hypothesis', 'Dreams rehearse memories', 'star'),
  item('test-1', 'test', 'Revisit a familiar place'),
  item('obs-1', 'observation', 'The street looked familiar'),
  item('disc-1', 'discovery', 'The place was recognised'),
  item('note-1', 'note', 'A private note'),
])

test('a story uses one exploration and leaves hidden questions out', () => {
  assert.equal(source.explorationId, 'exploration-1')
  assert.equal(source.questions.some(entry => entry.text.includes('hidden')), false)
  assert.equal(source.questions.some(entry => entry.id === 'hidden'), false)
  const foreign = createStory(source, ['other-exploration-question'], [], null)
  assert.deepEqual(foreign, { ok: false, reason: 'unknown' })
  const made = createStory(source, ['plain'], [], null)
  assert.equal(made.ok, true)
  if (made.ok) assert.equal(made.draft.explorationId, source.explorationId)
  const other = storySource('exploration-2', 'Other', [question('q', 'Elsewhere')], [])
  if (made.ok) assert.equal(syncStory(made.draft, other, ['q'], []).ok, false)
})

test('visible questions can be selected whether or not they are starred', () => {
  assert.equal(source.questions.find(entry => entry.id === 'star')?.isPrioritised, true)
  assert.equal(source.questions.find(entry => entry.id === 'plain')?.isPrioritised, false)
  const made = createStory(source, ['plain', 'star'], [], null)
  assert.equal(made.ok, true)
  if (!made.ok) return
  const ids = made.draft.slides.flatMap(slide => slide.kind === 'question' ? [slide.questionId] : [])
  assert.deepEqual(ids, ['star', 'plain'])
})

test('experiment items are included only when selected', () => {
  const questionsOnly = createStory(source, ['central'], [], null)
  assert.equal(questionsOnly.ok, true)
  if (!questionsOnly.ok) return
  assert.equal(questionsOnly.draft.slides.some(slide => slide.kind === 'item'), false)
  const withItem = createStory(source, ['central'], ['hyp-1'], null)
  assert.equal(withItem.ok, true)
  if (!withItem.ok) return
  assert.deepEqual(withItem.draft.slides.filter(slide => slide.kind === 'item').map(slide => slide.kind === 'item' ? slide.itemId : ''), ['hyp-1'])
  assert.equal(createStory(source, ['central'], ['missing-item'], null).ok, false)
})

test('slides can be reordered, subtitled, and removed without changing the source', () => {
  const before = JSON.stringify(source)
  const made = createStory(source, ['central', 'plain'], ['note-1'], 'plain')
  assert.equal(made.ok, true)
  if (!made.ok) return
  const opening = made.draft.slides.find(slide => slide.kind === 'question' && slide.opening)
  assert.equal(opening && opening.kind === 'question' ? opening.questionId : '', 'plain')
  const moved = moveSlide(made.draft, 'i:note-1', -1)
  assert.equal(moved.slides[1]?.id, 'i:note-1')
  const subtitled = setSlideSubtitle(moved, 'q:plain', 'Beyond the senses')
  const questionSlide = subtitled.slides.find(slide => slide.id === 'q:plain')
  assert.equal(questionSlide && questionSlide.kind !== 'closing' ? questionSlide.subtitle : '', 'Beyond the senses')
  assert.equal(questionText(source, 'plain'), 'What is a dream for?')
  const onlyQuestion = createStory(source, ['plain'], [], null)
  assert.equal(onlyQuestion.ok, true)
  if (onlyQuestion.ok) {
    const keptQuestion = removeSlide(onlyQuestion.draft, 'q:plain')
    assert.equal(keptQuestion.slides.some(slide => slide.id === 'q:plain'), true)
  }
  const removed = removeSlide(subtitled, 'i:note-1')
  assert.equal(removed.slides.some(slide => slide.id === 'i:note-1'), false)
  assert.equal(source.items.some(entry => entry.id === 'note-1'), true)
  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(storyLeaveEffect(), { writes: [], changesQuestions: false, changesItems: false, changesImages: false })
})

test('a closing question is optional and user-written', () => {
  const made = createStory(source, ['central'], [], null)
  assert.equal(made.ok, true)
  if (!made.ok) return
  assert.equal(made.draft.slides.some(slide => slide.kind === 'closing'), false)
  const withClosing = setClosingQuestion(made.draft, ' What would you ask next? ')
  const closing = withClosing.slides.find(slide => slide.kind === 'closing')
  assert.equal(closing && closing.kind === 'closing' ? closing.text : '', 'What would you ask next?')
  const cleared = setClosingQuestion(withClosing, '   ')
  assert.equal(cleared.slides.some(slide => slide.kind === 'closing'), false)
})

test('item kinds keep their labels', () => {
  for (const kind of experimentItemKinds) {
    assert.equal(storyKindLabel(kind.kind), kind.label)
  }
  const made = createStory(source, ['central'], ['concept-1', 'hyp-1', 'test-1', 'obs-1', 'disc-1'], null)
  assert.equal(made.ok, true)
  if (!made.ok) return
  assert.deepEqual(
    made.draft.slides.filter(slide => slide.kind === 'item').map(slide => slide.kind === 'item' ? slide.itemId : ''),
    ['concept-1', 'hyp-1', 'test-1', 'obs-1', 'disc-1'],
  )
})

test('the story screen does not persist a draft or call a model', () => {
  const screen = readFileSync(new URL('../components/story-screen.tsx', import.meta.url), 'utf8')
  const load = readFileSync(new URL('../lib/stories/load.ts', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../app/explorations/[id]/story/page.tsx', import.meta.url), 'utf8')
  const exploration = readFileSync(new URL('../components/exploration-screen.tsx', import.meta.url), 'utf8')
  assert.match(exploration, /Create a Story/)
  assert.match(screen, /aspect-ratio:9 \/ 16|story-slide/)
  assert.match(screen, /Discard this story/)
  assert.match(screen, /Remove from story/)
  assert.match(screen, /tentative explanation/)
  assert.equal(screen.includes('localStorage'), false)
  assert.equal(screen.includes('sessionStorage'), false)
  assert.equal(screen.includes('openai'), false)
  assert.equal(load.includes('.insert('), false)
  assert.equal(load.includes('.update('), false)
  assert.equal(load.includes('.delete('), false)
  assert.equal(page.includes('openai'), false)
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /aspect-ratio:9 \/ 16/)
})
