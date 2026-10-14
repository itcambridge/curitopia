import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { acceptsFurtherQuestions, workspaceLeaveEffect } from '@/lib/explorations/continuation'

test('a legacy completed exploration can still be edited', () => {
  assert.equal(acceptsFurtherQuestions('completed'), true)
  assert.equal(acceptsFurtherQuestions('active'), true)
  assert.equal(acceptsFurtherQuestions(null), true)
})

test('opening the library does not change questions or status', () => {
  const effect = workspaceLeaveEffect()
  assert.deepEqual(effect.writes, [])
  assert.equal(effect.resetsQuestions, false)
  assert.equal(effect.changesStatus, false)
  const screen = readFileSync(new URL('../components/exploration-screen.tsx', import.meta.url), 'utf8')
  const library = readFileSync(new URL('../components/exploration-library.tsx', import.meta.url), 'utf8')
  assert.equal(screen.includes("kind: 'complete'"), false)
  assert.equal(screen.includes('saveExplorationStatus'), false)
  assert.equal(screen.includes('status: \'completed\''), false)
  assert.match(screen, /All explorations/)
  assert.equal(library.includes('Complete'), false)
  assert.equal(library.includes('Review'), false)
  assert.match(library, /Continue/)
})
