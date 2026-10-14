import assert from 'node:assert/strict'
import test from 'node:test'
import { reflectionQuestionSignature, reflectionViewState, type ReflectionQuestionSnapshot } from '@/lib/reflection/freshness'

const reflection = { overview: 'A suggestion from the earlier questions.' }

function question(id: string, overrides: Partial<ReflectionQuestionSnapshot> = {}): ReflectionQuestionSnapshot {
  return {
    id,
    text: `Question ${id}`,
    isPrioritised: false,
    isHidden: false,
    perspectiveOrigin: null,
    ...overrides,
  }
}

test('adding a question marks an existing reflection stale and keeps the suggestion', () => {
  const original = [question('a'), question('b')]
  const basis = reflectionQuestionSignature(original)
  const current = reflectionViewState({
    reflection,
    basis,
    questions: original,
  })
  assert.equal(current.stale, false)
  assert.equal(current.reflection, reflection)

  const afterAdd = reflectionViewState({
    reflection,
    basis,
    questions: [...original, question('c')],
  })
  assert.equal(afterAdd.stale, true)
  assert.equal(afterAdd.reflection, reflection)
})

test('priority and hiding also make a reflection stale', () => {
  const original = [question('a'), question('b')]
  const basis = reflectionQuestionSignature(original)
  assert.equal(reflectionViewState({
    reflection,
    basis,
    questions: [question('a', { isPrioritised: true }), question('b')],
  }).stale, true)
  assert.equal(reflectionViewState({
    reflection,
    basis,
    questions: [question('a', { isHidden: true }), question('b')],
  }).stale, true)
})

test('a reflection that has not been generated is not stale', () => {
  assert.deepEqual(reflectionViewState({
    reflection: null,
    basis: null,
    questions: [question('a')],
  }), { reflection: null, stale: false })
})
