export const DEFAULT_OPENAI_MODEL = 'gpt-6-astra'
export const REFLECTION_QUESTION_LIMIT = 80
export const REFLECTION_SUGGESTION_LIMIT = 5
export const REFLECTION_REQUEST_TIMEOUT_MS = 50_000

export type ExplorationReflection = {
  suggestions: { text: string }[]
}

export type ReflectionQuestionInput = {
  id: string
  text: string
  role: 'central' | 'satellite'
  isPrioritised: boolean
  perspectiveOrigin: 'investigate' | 'reframe' | 'connect' | 'challenge' | null
}

export type ReflectionFailureReason = 'configuration' | 'rate-limit' | 'timeout' | 'upstream' | 'invalid'
