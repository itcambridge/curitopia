import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { Question } from '@/lib/explorations/types'
import { reflectForExploration } from '@/lib/reflection/decide'
import { REFLECTION_QUESTION_LIMIT } from '@/lib/reflection/types'

const reflection = {
  suggestions: [{ text: 'Which of these questions would be easiest to investigate first?' }],
}

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    text: `Question ${id}`,
    color: '#55baff',
    role: 'satellite',
    isPrioritised: false,
    isHidden: false,
    ...overrides,
  }
}

function exploration(questions: Question[], ended = true) {
  return { id: 'exploration-1', mode: 'Focus' as const, ended, questions }
}

test('an unsigned request does not load or send an exploration', async () => {
  const result = await reflectForExploration({
    signedIn: false,
    load: async () => { throw new Error('load should not run') },
    reflect: async () => { throw new Error('reflect should not run') },
  })
  assert.equal(result.status, 401)
  assert.deepEqual(result.body, { error: 'Sign in to reflect on an exploration.' })
})

test('a missing exploration and a not-found result use the same response', async () => {
  let reflected = false
  const result = await reflectForExploration({
    signedIn: true,
    load: async () => ({ status: 'not-found' }),
    reflect: async () => { reflected = true; return { ok: true, reflection } },
  })
  assert.equal(result.status, 404)
  assert.deepEqual(result.body, { error: 'This exploration is not available.' })
  assert.equal(reflected, false)
})

test('a saved exploration can be reflected whether or not it was completed', async () => {
  for (const ended of [false, true]) {
    let reflected = false
    const result = await reflectForExploration({
      signedIn: true,
      load: async () => ({ status: 'ok', exploration: exploration([question('a'), question('b')], ended) }),
      reflect: async () => { reflected = true; return { ok: true, reflection } },
    })
    assert.equal(result.status, 200)
    assert.equal(reflected, true)
  }
})

test('hidden questions are excluded and priority metadata is kept', async () => {
  let sent: unknown = null
  const result = await reflectForExploration({
    signedIn: true,
    load: async () => ({
      status: 'ok',
      exploration: exploration([
        question('visible', { text: 'What is consciousness?', role: 'central', isPrioritised: true, perspectiveOrigin: 'investigate' }),
        question('plain', { text: 'How do dreams relate to memory?' }),
        question('secret', { text: 'Hidden question text', isHidden: true, isPrioritised: true, perspectiveOrigin: 'challenge' }),
      ]),
    }),
    reflect: async (request) => { sent = request; return { ok: true, reflection } },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(sent, {
    mode: 'Focus',
    questions: [
      { id: 'visible', text: 'What is consciousness?', role: 'central', isPrioritised: true, perspectiveOrigin: 'investigate' },
      { id: 'plain', text: 'How do dreams relate to memory?', role: 'satellite', isPrioritised: false, perspectiveOrigin: null },
    ],
  })
  assert.equal(JSON.stringify(sent).includes('Hidden question text'), false)
})

test('too many visible questions are refused without sending them', async () => {
  let reflected = false
  const questions = Array.from({ length: REFLECTION_QUESTION_LIMIT + 1 }, (_, index) => question(`q-${index}`))
  const result = await reflectForExploration({
    signedIn: true,
    load: async () => ({ status: 'ok', exploration: exploration(questions) }),
    reflect: async () => { reflected = true; return { ok: true, reflection } },
  })
  assert.equal(result.status, 422)
  assert.equal(reflected, false)
  assert.equal('error' in result.body && result.body.error.includes(String(REFLECTION_QUESTION_LIMIT + 1)), true)
})

test('provider failures use fixed messages and do not echo question text', async () => {
  const cases = [
    ['configuration', 503, 'Reflection is not configured on the server.'],
    ['rate-limit', 429, 'Reflection is busy right now. Wait a moment and try again.'],
    ['timeout', 504, 'Reflection took too long. Try again.'],
    ['invalid', 502, 'Reflection is unavailable right now. Try again.'],
    ['upstream', 502, 'Reflection is unavailable right now. Try again.'],
  ] as const
  for (const [reason, status, error] of cases) {
    const result = await reflectForExploration({
      signedIn: true,
      load: async () => ({ status: 'ok', exploration: exploration([question('a', { text: 'Private question text' }), question('b')]) }),
      reflect: async () => ({ ok: false, reason }),
    })
    assert.equal(result.status, status)
    assert.deepEqual(result.body, { error })
    assert.equal(JSON.stringify(result.body).includes('Private question text'), false)
  }
})

test('the workspace offers reflection while editing and does not complete an exploration on leave', () => {
  const source = readFileSync(new URL('../components/exploration-screen.tsx', import.meta.url), 'utf8')
  const mount = source.indexOf('<ExplorationReflection')
  assert.ok(mount > 0)
  assert.equal(source.split('<ExplorationReflection').length, 2)
  assert.equal(source.includes('saveExplorationStatus'), false)
  assert.equal(source.includes('End session'), false)
  assert.equal(source.includes('disabled={ended}'), false)
  assert.match(source, /All explorations/)
  assert.match(source, /href="\/"/)
  assert.match(source, /acceptsFurtherQuestions\(storedStatus\)/)
  assert.match(source, /workspaceLeaveEffect/)
  assert.match(source, /function hideQuestion/)
  assert.match(source, /function togglePriority/)
  assert.match(source, /changeMode\('Quickfire'\)/)
  assert.match(source, /changeMode\('Focus'\)/)
  assert.match(source, /workspace-summary/)
  assert.equal(source.includes("You're making"), false)
  assert.equal(source.includes('stats-panel'), false)
  assert.equal(source.includes('Timeline'), false)
  assert.equal(source.includes('More options'), false)
})

test('the reflection panel shows only suggested questions, with copy and add', () => {
  const source = readFileSync(new URL('../components/exploration-reflection.tsx', import.meta.url), 'utf8')
  assert.match(source, /Questions to explore next/)
  assert.match(source, /'Copy'/)
  assert.match(source, /Add to this exploration/)
  assert.match(source, /Send visible questions/)
  assert.match(source, /Retry/)
  assert.match(source, /These suggestions were made for an earlier set of questions/)
  assert.equal(source.includes('Themes'), false)
  assert.equal(source.includes('Connections'), false)
  assert.equal(source.includes('overview'), false)
})
