import OpenAI from 'openai'
import { reflectionResponseSchema } from '@/lib/reflection/schema'
import { DEFAULT_OPENAI_MODEL, REFLECTION_REQUEST_TIMEOUT_MS, type ExplorationReflection, type ReflectionFailureReason, type ReflectionQuestionInput } from '@/lib/reflection/types'
import { validateReflection } from '@/lib/reflection/validate'

const instructions = `You help someone discover what to ask next in one Curitopia exploration.
Return at most five new questions in suggestions. Return fewer, or an empty array, when the exploration does not offer that many distinct and useful directions. Never add a filler question to reach five.
Each suggestion should help the person move forward. Prefer a question that identifies a foundational topic whose clarification would unlock several of their questions, reveals a missing perspective or assumption, opens a genuinely new line of enquiry, identifies a practical low-risk next step, or helps them decide which of their questions to investigate first.
Use the central question and the other visible questions as the context. Use priority, Quickfire or Focus mode, and a Focus perspective origin only when that signal helps you write a better question. Priority is the person's preference, not proof that a question is objectively important.
Do not summarise the exploration, group their questions into themes, restate connections they have already made, or analyse which questions they prioritised.
Do not paraphrase a question they already asked, and do not ask a generic question that would fit almost any exploration.
Do not explain why you asked. The text of each suggestion is the question itself.
Do not diagnose, infer trauma, or state beliefs, identity, motivations, or intentions as facts.
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
