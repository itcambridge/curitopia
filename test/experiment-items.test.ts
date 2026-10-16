import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { experimentItemBody, experimentItemKind, experimentItemKinds } from '@/lib/experiments/rules'

test('any of the six item kinds can stand on its own', () => {
  const kinds = experimentItemKinds.map(item => item.kind)
  assert.deepEqual(kinds, ['concept', 'note', 'hypothesis', 'test', 'observation', 'discovery'])
  for (const kind of kinds) assert.equal(experimentItemKind(kind), kind)
  assert.equal(experimentItemKind('stage'), null)
  assert.equal(experimentItemBody('  A finding of my own.  '), 'A finding of my own.')
})

test('saving an item does not write questions or call a model', () => {
  const actions = readFileSync(new URL('../lib/experiments/actions.ts', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../components/experiment-screen.tsx', import.meta.url), 'utf8')
  assert.equal(actions.includes("from('questions').insert"), false)
  assert.equal(actions.includes("from('questions').update"), false)
  assert.equal(actions.includes("from('questions').delete"), false)
  assert.equal(actions.includes("from('explorations')"), false)
  assert.equal(actions.includes('openai'), false)
  assert.match(actions, /from\('experiment_items'\)/)
  assert.match(screen, /experimentItemKinds\.map/)
  assert.match(screen, /concept, note, hypothesis, test, observation, or discovery/)
  assert.match(screen, /None is required/)
  assert.match(screen, /Cancel/)
  assert.match(screen, /Delete this item\? The experiment and the original question stay\./)
  assert.equal(screen.includes('openai'), false)
})
