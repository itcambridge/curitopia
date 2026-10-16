import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { experimentItemBody, experimentLeaveEffect, mayOpenExperiment } from '@/lib/experiments/rules'

test('a new experiment opens from a prioritised question, and an existing one can be reopened', () => {
  assert.equal(mayOpenExperiment({ prioritised: true, existingExperimentId: null }), true)
  assert.equal(mayOpenExperiment({ prioritised: false, existingExperimentId: null }), false)
  assert.equal(mayOpenExperiment({ prioritised: false, existingExperimentId: '10000000-0000-4000-8000-000000000009' }), true)
})

test('the item limit applies to each item and not to the experiment as a whole', () => {
  assert.equal(experimentItemBody(`  ${'a'.repeat(2000)}  `), 'a'.repeat(2000))
  assert.equal(experimentItemBody('a'.repeat(2001)), null)
  assert.equal(experimentItemBody('   '), null)
  assert.equal(experimentItemBody('a'.repeat(2000)) !== null && experimentItemBody('b'.repeat(2000)) !== null, true)
})

test('opening or leaving an experiment does not change the exploration', () => {
  const effect = experimentLeaveEffect()
  assert.deepEqual(effect.writes, [])
  assert.equal(effect.changesStatus, false)
  assert.equal(effect.changesQuestions, false)
  const action = readFileSync(new URL('../lib/experiments/actions.ts', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../components/exploration-screen.tsx', import.meta.url), 'utf8')
  assert.equal(action.includes("from('explorations')"), false)
  assert.equal(action.includes('openai'), false)
  assert.equal(action.includes('saveQuestion'), false)
  assert.match(screen, /Investigate further/)
  assert.match(screen, /mayOpenExperiment/)
})
