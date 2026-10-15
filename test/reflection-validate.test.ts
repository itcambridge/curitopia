import assert from 'node:assert/strict'
import test from 'node:test'
import { validateReflection } from '@/lib/reflection/validate'

const questions = [
  { id: 'q-visible', text: 'What is consciousness?', isPrioritised: true },
  { id: 'q-other', text: 'How do dreams relate to memory?', isPrioritised: false },
]

test('accepts only follow-up questions', () => {
  const reflection = validateReflection({
    suggestions: [{ text: 'Which of these questions would be easiest to investigate first?' }],
    overview: 'This summary is not part of the response.',
  }, questions)
  assert.deepEqual(reflection, {
    suggestions: [{ text: 'Which of these questions would be easiest to investigate first?' }],
  })
})

test('accepts fewer than five suggestions', () => {
  const reflection = validateReflection({ suggestions: [] }, questions)
  assert.deepEqual(reflection?.suggestions, [])
  const two = validateReflection({
    suggestions: [
      { text: 'What would a low-risk first step look like?' },
      { text: 'Which assumption, if wrong, would change the other questions?' },
    ],
  }, questions)
  assert.equal(two?.suggestions.length, 2)
})

test('keeps at most five suggestions', () => {
  const reflection = validateReflection({
    suggestions: [1, 2, 3, 4, 5, 6].map(number => ({ text: `What would change if assumption ${number} were wrong?` })),
  }, questions)
  assert.equal(reflection?.suggestions.length, 5)
  assert.equal(reflection?.suggestions[4]?.text, 'What would change if assumption 5 were wrong?')
})

test('drops a suggestion that duplicates an existing question after normalisation', () => {
  const reflection = validateReflection({
    suggestions: [
      { text: '  what   is consciousness?  ' },
      { text: 'What would a useful first step look like?' },
    ],
  }, questions)
  assert.deepEqual(reflection?.suggestions, [{ text: 'What would a useful first step look like?' }])
})

test('drops a repeated suggestion', () => {
  const reflection = validateReflection({
    suggestions: [
      { text: 'What would a useful first step look like?' },
      { text: 'What would a useful first step look like?' },
      { text: 'Which missing perspective would change this?' },
    ],
  }, questions)
  assert.deepEqual(reflection?.suggestions, [
    { text: 'What would a useful first step look like?' },
    { text: 'Which missing perspective would change this?' },
  ])
})

test('rejects malformed reflection objects', () => {
  assert.equal(validateReflection(null, questions), null)
  assert.equal(validateReflection({ overview: 'Too incomplete.' }, questions), null)
  assert.equal(validateReflection({ suggestions: [{ text: 'x'.repeat(301) }] }, questions), null)
  assert.equal(validateReflection({ suggestions: ['not an object'] }, questions), null)
})
