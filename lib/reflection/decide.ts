import type { OpenExploration } from '@/lib/explorations/types'
import { REFLECTION_QUESTION_LIMIT, type ExplorationReflection, type ReflectionFailureReason, type ReflectionQuestionInput } from '@/lib/reflection/types'

export type ReflectionLoad =
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ok'; exploration: OpenExploration }

export type ReflectionCallResult =
  | { ok: true; reflection: ExplorationReflection }
  | { ok: false; reason: ReflectionFailureReason }

export type ReflectionHttpResult = {
  status: number
  body: { error: string } | { reflection: ExplorationReflection }
  cacheControl: 'no-store'
}

const unavailable = 'This exploration is not available.'

function httpError(status: number, error: string): ReflectionHttpResult {
  return { status, body: { error }, cacheControl: 'no-store' }
}

export async function reflectForExploration(input: {
  signedIn: boolean
  load: () => Promise<ReflectionLoad>
  reflect: (request: { mode: OpenExploration['mode']; questions: ReflectionQuestionInput[] }) => Promise<ReflectionCallResult>
}): Promise<ReflectionHttpResult> {
  if (!input.signedIn) return httpError(401, 'Sign in to reflect on an exploration.')

  const loaded = await input.load()
  if (loaded.status === 'error') return httpError(503, 'Reflection is unavailable right now. Try again.')
  if (loaded.status === 'not-found') return httpError(404, unavailable)

  const visible = loaded.exploration.questions.filter(question => !question.isHidden)
  if (visible.length === 0) return httpError(422, 'There are no visible questions to reflect on.')
  if (visible.length > REFLECTION_QUESTION_LIMIT) {
    return httpError(422, `This exploration has ${visible.length} visible questions. Reflection can read up to ${REFLECTION_QUESTION_LIMIT} at once, so nothing was sent.`)
  }

  const questions: ReflectionQuestionInput[] = visible.map(question => ({
    id: question.id,
    text: question.text,
    role: question.role,
    isPrioritised: question.isPrioritised,
    perspectiveOrigin: question.perspectiveOrigin ?? null,
  }))

  const result = await input.reflect({ mode: loaded.exploration.mode, questions })
  if (!result.ok) {
    if (result.reason === 'configuration') return httpError(503, 'Reflection is not configured on the server.')
    if (result.reason === 'rate-limit') return httpError(429, 'Reflection is busy right now. Wait a moment and try again.')
    if (result.reason === 'timeout') return httpError(504, 'Reflection took too long. Try again.')
    return httpError(502, 'Reflection is unavailable right now. Try again.')
  }

  return { status: 200, body: { reflection: result.reflection }, cacheControl: 'no-store' }
}
