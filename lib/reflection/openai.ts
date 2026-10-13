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

export function openAiConfiguration(): { ok: true; apiKey: string; model: string } | { ok: false } {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return { ok: false }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
  return { ok: true, apiKey, model }
}

export async function requestReflection(
  input: { mode: 'Focus' | 'Quickfire'; questions: ReflectionQuestionInput[] },
  client?: ReflectionClient,
): Promise<{ ok: true; reflection: ExplorationReflection } | { ok: false; reason: ReflectionFailureReason }> {
  let activeClient = client
  const configuration = openAiConfiguration()
  if (!activeClient) {
    if (!configuration.ok) return { ok: false, reason: 'configuration' }
    activeClient = new OpenAI({
      apiKey: configuration.apiKey,
      timeout: REFLECTION_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    })
  }

  try {
    const response = await activeClient.responses.create({
      model: configuration.ok ? configuration.model : DEFAULT_OPENAI_MODEL,
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

    if (response.error || response.incomplete_details) return { ok: false, reason: 'invalid' }
    const parsed: unknown = JSON.parse(response.output_text)
    const reflection = validateReflection(parsed, input.questions.map(question => ({
      id: question.id,
      text: question.text,
      isPrioritised: question.isPrioritised,
    })))
    if (!reflection) return { ok: false, reason: 'invalid' }
    return { ok: true, reflection }
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, reason: 'invalid' }
    if (error instanceof OpenAI.APIError && error.status === 429) return { ok: false, reason: 'rate-limit' }
    if (error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof Error && error.name === 'AbortError')) {
      return { ok: false, reason: 'timeout' }
    }
    return { ok: false, reason: 'upstream' }
  }
}

