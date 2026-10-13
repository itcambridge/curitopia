import assert from 'node:assert/strict'
import test from 'node:test'
import { maySendReflection, nextReflectionPhase } from '@/lib/reflection/consent'

const ready = { inFlight: false, overLimit: false, visibleCount: 2, saved: true }

test('opening the confirmation does not allow a request', () => {
  assert.equal(nextReflectionPhase('idle', 'open', false), 'confirm')
  assert.equal(maySendReflection('confirm', ready), true)
  assert.equal(maySendReflection('idle', ready), false)
})

test('cancelling the confirmation does not allow a request', () => {
  assert.equal(nextReflectionPhase('confirm', 'cancel', false), 'idle')
  assert.equal(nextReflectionPhase('confirm', 'cancel', true), 'ready')
  assert.equal(maySendReflection('idle', ready), false)
  assert.equal(maySendReflection('ready', ready), false)
})

test('a request is allowed only from confirmation or retry, and not while gates are closed', () => {
  assert.equal(maySendReflection('confirm', ready), true)
  assert.equal(maySendReflection('error', ready), true)
  assert.equal(maySendReflection('loading', ready), false)
  assert.equal(maySendReflection('confirm', { ...ready, inFlight: true }), false)
  assert.equal(maySendReflection('confirm', { ...ready, overLimit: true }), false)
  assert.equal(maySendReflection('confirm', { ...ready, visibleCount: 0 }), false)
  assert.equal(maySendReflection('confirm', { ...ready, saved: false }), false)
  assert.equal(nextReflectionPhase('confirm', 'send', false), 'loading')
  assert.equal(nextReflectionPhase('idle', 'send', false), 'idle')
})
