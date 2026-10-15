import assert from 'node:assert/strict'
import test from 'node:test'
import OpenAI from 'openai'
import { requestReflection, openAiConfiguration } from '@/lib/reflection/openai'

const questions = [
  { id: 'q-visible', text: 'What is consciousness?', role: 'central' as const, isPrioritised: true, perspectiveOrigin: 'investigate' as const },
  { id: 'q-other', text: 'How do dreams relate to memory?', role: 'satellite' as const, isPrioritised: false, perspectiveOrigin: null },
]

function client(create: (body: Record<string, unknown>) => Promise<{ error: unknown; incomplete_details: unknown; output_text: string }>) {
  return { responses: { create } }
}

test('a missing model variable is distinct from an explicit model', () => {
  const previousKey = process.env.OPENAI_API_KEY
  const previousModel = process.env.OPENAI_MODEL
  process.env.OPENAI_API_KEY = 'test-key'
  try {
    delete process.env.OPENAI_MODEL
    const missing = openAiConfiguration()
    assert.equal(missing.ok, true)
    if (missing.ok) {
      assert.equal(missing.modelSource, 'default')
      assert.equal(missing.model, 'gpt-6-astra')
    }
    process.env.OPENAI_MODEL = 'gpt-6-astra'
    const explicit = openAiConfiguration()
    assert.equal(explicit.ok, true)
    if (explicit.ok) {
      assert.equal(explicit.modelSource, 'environment')
      assert.equal(explicit.model, 'gpt-6-astra')
    }
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
    if (previousModel === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = previousModel
  }
})

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

  const malformedSuggestions = await requestReflection({ mode: 'Focus', questions }, client(async () => ({
    error: null,
    incomplete_details: null,
    output_text: JSON.stringify({
      suggestions: 'not a list',
    }),
  })))
  assert.deepEqual(malformedSuggestions, { ok: false, reason: 'invalid' })
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
        suggestions: [{ text: 'Which assumption, if clarified first, would make the other questions easier?' }],
      }),
    }
  }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.reflection.suggestions, [
      { text: 'Which assumption, if clarified first, would make the other questions easier?' },
    ])
  }
  assert.equal(seen.body?.store, false)
  assert.equal(seen.body?.max_output_tokens, 4000)
  assert.deepEqual(seen.body?.reasoning, { effort: 'low' })
  assert.equal(typeof seen.body?.input, 'string')
  assert.match(String(seen.body?.input), /What is consciousness\?/)
  assert.doesNotMatch(String(seen.body?.input), /Hidden question text/)
})
