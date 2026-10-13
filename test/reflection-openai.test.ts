import assert from 'node:assert/strict'
import test from 'node:test'
import OpenAI from 'openai'
import { requestReflection } from '@/lib/reflection/openai'

const questions = [
  { id: 'q-visible', text: 'What is consciousness?', role: 'central' as const, isPrioritised: true, perspectiveOrigin: 'investigate' as const },
  { id: 'q-other', text: 'How do dreams relate to memory?', role: 'satellite' as const, isPrioritised: false, perspectiveOrigin: null },
]

function client(create: (body: Record<string, unknown>) => Promise<{ error: unknown; incomplete_details: unknown; output_text: string }>) {
  return { responses: { create } }
}

test('a missing API key does not create a model request', async () => {
  const previous = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const result = await requestReflection({ mode: 'Focus', questions })
    assert.deepEqual(result, { ok: false, reason: 'configuration' })
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test('malformed model output is rejected', async () => {
  const malformed = await requestReflection({ mode: 'Focus', questions }, client(async () => ({
    error: null,
    incomplete_details: null,
    output_text: 'not json',
  })))
  assert.deepEqual(malformed, { ok: false, reason: 'invalid' })

  const unknownId = await requestReflection({ mode: 'Focus', questions }, client(async () => ({
    error: null,
    incomplete_details: null,
    output_text: JSON.stringify({
      overview: 'These questions explore experience.',
      themes: [{ title: 'Experience', explanation: 'Cited a missing question.', questionIds: ['q-visible', 'missing'] }],
      connections: [],
      prioritised: { summary: 'You marked one question.', observations: [] },
      furtherQuestions: [],
    }),
  })))
  assert.deepEqual(unknownId, { ok: false, reason: 'invalid' })
})

test('upstream and rate-limit errors stay on the failure reason', async () => {
  const upstream = await requestReflection({ mode: 'Focus', questions }, client(async () => {
    throw new Error('provider blew up with Private question text')
  }))
  assert.deepEqual(upstream, { ok: false, reason: 'upstream' })

  const limited = await requestReflection({ mode: 'Focus', questions }, client(async () => {
    throw new OpenAI.APIError(429, undefined, 'slow down', undefined)
  }))
  assert.deepEqual(limited, { ok: false, reason: 'rate-limit' })

  const timedOut = await requestReflection({ mode: 'Focus', questions }, client(async () => {
    throw new OpenAI.APIConnectionTimeoutError({ message: 'timed out' })
  }))
  assert.deepEqual(timedOut, { ok: false, reason: 'timeout' })
})

test('a mocked model call stores nothing and receives only the given questions', async () => {
  const seen: { body: Record<string, unknown> | null } = { body: null }
  const result = await requestReflection({ mode: 'Quickfire', questions }, client(async (request) => {
    seen.body = request
    return {
      error: null,
      incomplete_details: null,
      output_text: JSON.stringify({
        overview: 'These questions explore experience and memory.',
        themes: [],
        connections: [],
        prioritised: { summary: 'You marked one question.', observations: [{ questionId: 'q-visible', note: 'A preference, not a score.' }] },
        furtherQuestions: [],
      }),
    }
  }))
  assert.equal(result.ok, true)
  assert.equal(seen.body?.store, false)
  assert.equal(typeof seen.body?.input, 'string')
  assert.match(String(seen.body?.input), /What is consciousness\?/)
  assert.doesNotMatch(String(seen.body?.input), /Hidden question text/)
})
