import assert from 'node:assert/strict'
import test from 'node:test'
import { validateReflection } from '@/lib/reflection/validate'

const questions = [
  { id: 'q-visible', text: 'What is consciousness?', isPrioritised: true },
  { id: 'q-other', text: 'How do dreams relate to memory?', isPrioritised: false },
]

function payload(overrides: Record<string, unknown> = {}) {
  return {
    overview: 'These questions explore experience and memory.',
    themes: [{ title: 'Experience', explanation: 'Both questions ask how experience is known.', questionIds: ['q-visible', 'q-other'] }],
    connections: [{ connection: 'Memory may shape experience.', explanation: 'The questions can be read together.', support: 'speculative', questionIds: ['q-visible', 'q-other'] }],
    prioritised: { summary: 'You marked one question.', observations: [{ questionId: 'q-visible', note: 'You chose to mark this.' }] },
    furtherQuestions: [{ text: 'What would count as evidence here?' }],
    ...overrides,
  }
}

test('accepts a reflection that cites only the supplied questions', () => {
  const reflection = validateReflection(payload(), questions)
  assert.ok(reflection)
  assert.equal(reflection?.themes[0]?.questionIds.length, 2)
  assert.equal(reflection?.prioritised.observations[0]?.questionId, 'q-visible')
})

test('rejects a reference to a question that was not supplied', () => {
  const reflection = validateReflection(payload({
    themes: [{ title: 'Hidden', explanation: 'This cites a question that was not sent.', questionIds: ['q-visible', 'q-hidden'] }],
  }), questions)
  assert.equal(reflection, null)
})

test('drops a theme that cites only one question', () => {
  const reflection = validateReflection(payload({
    themes: [{ title: 'Thin', explanation: 'Only one question supports this.', questionIds: ['q-visible'] }],
  }), questions)
  assert.ok(reflection)
  assert.deepEqual(reflection?.themes, [])
})

test('drops an observation for a question the user did not prioritise', () => {
  const reflection = validateReflection(payload({
    prioritised: { summary: 'One mark was a preference.', observations: [{ questionId: 'q-other', note: 'This was not marked.' }] },
  }), questions)
  assert.ok(reflection)
  assert.deepEqual(reflection?.prioritised.observations, [])
})

test('drops a further question that copies the user', () => {
  const reflection = validateReflection(payload({
    furtherQuestions: [{ text: 'What is consciousness?' }, { text: 'What would count as evidence here?' }],
  }), questions)
  assert.deepEqual(reflection?.furtherQuestions, [{ text: 'What would count as evidence here?' }])
})

test('rejects malformed reflection objects', () => {
  assert.equal(validateReflection(null, questions), null)
  assert.equal(validateReflection({ overview: 'Too incomplete.' }, questions), null)
})
