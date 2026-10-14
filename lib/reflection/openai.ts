import OpenAI from 'openai'
import { reflectionResponseSchema } from '@/lib/reflection/schema'
import { DEFAULT_OPENAI_MODEL, REFLECTION_REQUEST_TIMEOUT_MS, type ExplorationReflection, type ReflectionFailureReason, type ReflectionQuestionInput } from '@/lib/reflection/types'
import { validateReflection } from '@/lib/reflection/validate'

const instructions = `You help someone reflect on questions they wrote in one Curitopia exploration.
The result is a suggestion, not a fact about the person.
Do not diagnose, infer trauma, or state beliefs, identity, or motivations as facts.
Do not explain why they think something. Describe what the questions explore.
Use only the supplied question ids. Never invent a question id.
A theme needs at least two of their questions. If the evidence is weak, return an empty themes array.
A connection needs at least two questions. Mark support as "supported" only when the questions themselves state the link. Otherwise use "speculative".
Prioritisation is the person's preference, not proof that a question is objectively important. If none are prioritised, say so and return no observations.
furtherQuestions are optional new questions you are suggesting. They must not copy the person's questions, and they are not questions the person wrote.
Leave an array empty rather than filling it with a generic observation.
Write in a curious, tentative tone.`

type ReflectionClient = {
  responses: {
    create: (body: Record<string, unknown>) => Promise<{
      error: unknown
      incomplete_details: unknown
      output_text: string
    }>
  }
}

export type OpenAiConfiguration =
  | { ok: true; apiKey: string; model: string; modelSource: 'environment' | 'default' }
  | { ok: false }

function safeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value)) return undefined
  if (value.toLowerCase().includes('sk-')) return undefined
  return value
}

function safeModel(value: string | undefined): string | undefined {
  if (!value || value.length > 80) return undefined
  if (value.toLowerCase().includes('sk-')) return undefined
  if (!/^[\w .:_-]+$/.test(value)) return undefined
  return value
}

function logReflectionFailure(details: {
  category: ReflectionFailureReason
  stage?: string
  status?: number
  code?: string
  type?: string
  param?: string
  modelSource?: 'environment' | 'default'
  model?: string
}) {
  console.error('reflection failed', {
    category: details.category,
    stage: safeToken(details.stage),
    status: typeof details.status === 'number' ? details.status : undefined,
    code: safeToken(details.code),
    type: safeToken(details.type),
    param: safeToken(details.param),
    modelSource: details.modelSource,
    model: safeModel(details.model),
  })
}

export function openAiConfiguration(): OpenAiConfiguration {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return { ok: false }
  const configuredModel = process.env.OPENAI_MODEL?.trim() ?? ''
  if (!configuredModel) return { ok: true, apiKey, model: DEFAULT_OPENAI_MODEL, modelSource: 'default' }
  return { ok: true, apiKey, model: configuredModel, modelSource: 'environment' }
}

export async function requestReflection(
  input: { mode: 'Focus' | 'Quickfire'; questions: ReflectionQuestionInput[] },
  client?: ReflectionClient,
): Promise<{ ok: true; reflection: ExplorationReflection } | { ok: false; reason: ReflectionFailureReason }> {
  const configuration = openAiConfiguration()
  let activeClient = client
  if (!activeClient) {
    if (!configuration.ok) {
      logReflectionFailure({ category: 'configuration', stage: 'missing-key' })
      return { ok: false, reason: 'configuration' }
    }
    activeClient = new OpenAI({
      apiKey: configuration.apiKey,
      timeout: REFLECTION_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    })
  }

  const model = configuration.ok ? configuration.model : DEFAULT_OPENAI_MODEL
  const modelSource = configuration.ok ? configuration.modelSource : 'default'

  try {
    const response = await activeClient.responses.create({
      model,
      store: false,
      max_output_tokens: 4000,
      reasoning: { effort: 'low' },
      instructions,
      input: JSON.stringify({ mode: input.mode, questions: input.questions }),
      text: {
        format: {
          type: 'json_schema',
          name: 'exploration_reflection',
          strict: true,
          schema: reflectionResponseSchema,
        },
      },
    })

    if (response.error || response.incomplete_details) {
      const errorRecord = response.error && typeof response.error === 'object' ? response.error as { code?: unknown; type?: unknown } : undefined
      const incomplete = response.incomplete_details && typeof response.incomplete_details === 'object'
        ? response.incomplete_details as { reason?: unknown }
        : undefined
      logReflectionFailure({
        category: 'invalid',
        stage: 'provider-output',
        code: safeToken(errorRecord?.code),
        type: safeToken(errorRecord?.type),
        param: safeToken(incomplete?.reason),
        modelSource,
        model,
      })
      return { ok: false, reason: 'invalid' }
    }
    const parsed: unknown = JSON.parse(response.output_text)
    const reflection = validateReflection(parsed, input.questions.map(question => ({
      id: question.id,
      text: question.text,
      isPrioritised: question.isPrioritised,
    })))
    if (!reflection) {
      logReflectionFailure({ category: 'invalid', stage: 'validation', modelSource, model })
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, reflection }
  } catch (error) {
    if (error instanceof SyntaxError) {
      logReflectionFailure({ category: 'invalid', stage: 'parse', modelSource, model })
      return { ok: false, reason: 'invalid' }
    }
    if (error instanceof OpenAI.APIError && error.status === 429) {
      logReflectionFailure({ category: 'rate-limit', status: error.status, code: error.code ?? undefined, type: error.type, modelSource, model })
      return { ok: false, reason: 'rate-limit' }
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof Error && error.name === 'AbortError')) {
      logReflectionFailure({
        category: 'timeout',
        stage: error instanceof OpenAI.APIConnectionTimeoutError ? 'timeout' : 'abort',
        modelSource,
        model,
      })
      return { ok: false, reason: 'timeout' }
    }
    if (error instanceof OpenAI.APIError) {
      logReflectionFailure({
        category: 'upstream',
        status: error.status,
        code: error.code ?? undefined,
        type: error.type,
        param: error.param ?? undefined,
        modelSource,
        model,
      })
      return { ok: false, reason: 'upstream' }
    }
    logReflectionFailure({ category: 'upstream', stage: 'unclassified', modelSource, model })
    return { ok: false, reason: 'upstream' }
  }
}
