import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { experimentItemBody } from '@/lib/experiments/rules'
import { questionWithMark } from '@/lib/explorations/question-text'

test('a new question ends with one question mark', () => {
  assert.equal(questionWithMark('What if the door was a shoreline'), 'What if the door was a shoreline?')
  assert.equal(questionWithMark('What if the door was a shoreline?'), 'What if the door was a shoreline?')
  assert.equal(questionWithMark('  What remains after the tide?  '), 'What remains after the tide?')
  assert.equal(questionWithMark('  What remains after the tide  '), 'What remains after the tide?')
  assert.equal(questionWithMark('What remains after the tide.'), 'What remains after the tide?')
  assert.equal(questionWithMark('What remains after the tide!'), 'What remains after the tide?')
  assert.equal(questionWithMark('What remains after the tide!!!'), 'What remains after the tide?')
  assert.equal(questionWithMark('Wait... what.'), 'Wait... what?')
  assert.equal(questionWithMark('Really?!'), 'Really?')
  assert.equal(questionWithMark('Hello?.'), 'Hello?')
  assert.equal(questionWithMark('   '), '')
  assert.equal(questionWithMark('...'), '')
  assert.equal(questionWithMark('!'), '')
  assert.equal(questionWithMark('Why? Why not.'), 'Why? Why not?')
})

test('question marks are applied to new questions and not to experiment items', () => {
  assert.equal(experimentItemBody('A note.'), 'A note.')
  assert.equal(experimentItemBody('  A hypothesis!  '), 'A hypothesis!')
  const screen = readFileSync(new URL('../components/exploration-screen.tsx', import.meta.url), 'utf8')
  const actions = readFileSync(new URL('../lib/explorations/actions.ts', import.meta.url), 'utf8')
  const rules = readFileSync(new URL('../lib/experiments/rules.ts', import.meta.url), 'utf8')
  assert.match(screen, /questionWithMark\(raw\)/)
  assert.match(screen, /onAddQuestion=\{text => commitQuestion\(text, 'suggestion'\)\}/)
  assert.match(actions, /questionWithMark\(value\)/)
  assert.equal(rules.includes('questionWithMark'), false)
})
