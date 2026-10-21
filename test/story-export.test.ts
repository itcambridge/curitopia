import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createStory, moveSlide, storySource, type StoryItem, type StoryQuestion } from '@/lib/stories/draft'
import { exportBlockers, imagePlacement, slideFace, storyDraw, STORY_EXPORT_HEIGHT, STORY_EXPORT_WIDTH } from '@/lib/stories/export'

function question(id: string, text: string): StoryQuestion & { isHidden: boolean } {
  return { id, text, role: 'satellite', isPrioritised: false, isHidden: false }
}

function item(id: string, kind: StoryItem['kind'], body: string): StoryItem {
  return { id, experimentId: 'exp', questionId: 'q', kind, body, position: 0 }
}

const source = storySource('exploration-1', 'What is the parent question?', [
  question('q', 'What happens when you dream?'),
], [
  item('note-1', 'note', 'A short note about a street'),
  item('long-1', 'note', 'A'.repeat(180)),
])

test('item slides do not repeat the parent question or the type label', () => {
  const made = createStory(source, ['q'], ['note-1', 'long-1'], 'q')
  assert.equal(made.ok, true)
  if (!made.ok) return
  const note = slideFace('item', 'A short note about a street', 'After rain')
  assert.equal(note.hook, 'After rain')
  assert.equal(note.body, 'A short note about a street')
  assert.equal(JSON.stringify(note).includes('What is the parent question?'), false)
  assert.equal(JSON.stringify(note).includes('Note'), false)
  const long = slideFace('item', 'A'.repeat(180), 'A quiet street')
  assert.equal(long.hook, 'A quiet street')
  assert.equal(long.body, '')
  const same = slideFace('item', 'A quiet street', 'A quiet street')
  assert.equal(same.hook, '')
  assert.equal(same.body, 'A quiet street')
  const screen = readFileSync(new URL('../components/story-screen.tsx', import.meta.url), 'utf8')
  const canvas = screen.slice(screen.indexOf('<article className={`story-slide'), screen.indexOf('</article>'))
  assert.equal(canvas.includes('source.title'), false)
  assert.equal(canvas.includes('itemHonesty'), false)
  assert.equal(canvas.includes('story-slide-label'), false)
})

test('a question slide keeps the full question', () => {
  const text = 'What happens when you dream, and what remains of the day inside it?'
  const face = slideFace('question', text, 'After dark')
  assert.equal(face.body, text)
  assert.equal(face.hook, 'After dark')
  const closing = slideFace('closing', 'What would you ask next?', '')
  assert.equal(closing.body, 'What would you ask next?')
})

test('export files are 9:16 and follow the current order', () => {
  assert.equal(STORY_EXPORT_WIDTH, 1080)
  assert.equal(STORY_EXPORT_HEIGHT, 1920)
  assert.equal(STORY_EXPORT_WIDTH * 16, STORY_EXPORT_HEIGHT * 9)
  const made = createStory(source, ['q'], ['note-1'], 'q')
  assert.equal(made.ok, true)
  if (!made.ok) return
  const moved = moveSlide(made.draft, 'i:note-1', -1)
  assert.equal(moved.slides[0]?.id, 'i:note-1')
  const native = imagePlacement(1080, 1920, 1152, 2048, 'cover')
  assert.ok(Math.abs(native.width - 1080) < 0.01)
  assert.ok(Math.abs(native.height - 1920) < 0.01)
  assert.equal(native.width / native.height, 1152 / 2048)
  const letterboxed = imagePlacement(1080, 1920, 1024, 1536, 'contain')
  assert.equal(letterboxed.width / letterboxed.height, 1024 / 1536)
  assert.ok(letterboxed.y > 0)
  const marked = storyDraw(slideFace('question', 'What happens when you dream?', ''), { hasImage: true, fit: 'contain', showMark: false })
  assert.equal(marked.mark, false)
  assert.equal(marked.imageFit, 'contain')
  assert.equal(marked.body, 'What happens when you dream?')
  const withMark = storyDraw(slideFace('question', 'What happens when you dream?', 'After dark'), { hasImage: true, fit: 'cover', showMark: true })
  assert.equal(withMark.mark, true)
  assert.equal(withMark.hook, 'After dark')
})

test('unconfirmed artwork blocks download, and a missing image does not', () => {
  const ids = ['q:q', 'i:note-1']
  assert.deepEqual(exportBlockers(ids, id => id === 'i:note-1' ? 'preview' : 'idle'), [{ index: 1, phase: 'preview' }])
  assert.deepEqual(exportBlockers(ids, () => 'working'), [{ index: 0, phase: 'working' }, { index: 1, phase: 'working' }])
  assert.deepEqual(exportBlockers(ids, () => undefined), [])
  const before = JSON.stringify(source)
  slideFace('question', source.questions[0]?.text ?? '', 'After dark')
  assert.equal(JSON.stringify(source), before)
  const renderer = readFileSync(new URL('../lib/stories/export.ts', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../components/story-screen.tsx', import.meta.url), 'utf8')
  assert.equal(renderer.includes('story-image'), false)
  assert.equal(renderer.includes('fetch('), false)
  assert.equal(renderer.includes('.insert('), false)
  assert.equal(renderer.includes('storage'), false)
  assert.match(screen, /Download video \(MP4\)/)
  assert.match(screen, /Try the video again/)
  assert.match(screen, /className="sidebar story-sidebar"/)
  assert.match(screen, /className="story-preview-workspace"/)
  assert.match(screen, /story-slide-list/)
  assert.match(screen, /Back to arrange/)
  const sidebar = screen.slice(screen.indexOf('className="sidebar story-sidebar"'), screen.indexOf('className="story-preview-workspace"'))
  assert.match(sidebar, /Back to arrange/)
  assert.match(sidebar, /Show the Curitopia mark/)
  assert.match(sidebar, /Create artwork/)
  assert.match(sidebar, /Use this artwork/)
  assert.match(sidebar, /Reject artwork/)
  assert.match(sidebar, /Download video \(MP4\)/)
  assert.match(sidebar, /OpenAI Image API/)
  const preview = screen.slice(screen.indexOf('className="story-preview-workspace"'), screen.indexOf('function videoProgress'))
  assert.match(preview, /story-slide/)
  assert.equal(preview.includes('Download video'), false)
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /\.story-review-shell \{[^}]*grid-template-columns:340px/)
  assert.match(css, /\.story-preview-workspace \.story-slide \{[^}]*9 \/ 16/)
  assert.equal(screen.includes('Allow multiple downloads'), false)
  assert.match(screen, /image: accepted\?\.blob/)
})
