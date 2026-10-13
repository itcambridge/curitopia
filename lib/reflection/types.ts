export const DEFAULT_OPENAI_MODEL = 'gpt-6-astra'
export const REFLECTION_QUESTION_LIMIT = 80
export const REFLECTION_REQUEST_TIMEOUT_MS = 50_000

export type ReflectionSupport = 'speculative' | 'supported'

export type ReflectionTheme = {
  title: string
  explanation: string
  questionIds: string[]
}

export type ReflectionConnection = {
  connection: string
  explanation: string
  support: ReflectionSupport
  questionIds: string[]
}

export type ReflectionObservation = {
  questionId: string
  note: string
}

export type ExplorationReflection = {
  overview: string
  themes: ReflectionTheme[]
  connections: ReflectionConnection[]
  prioritised: {
    summary: string
    observations: ReflectionObservation[]
  }
  furtherQuestions: { text: string }[]
}

export type ReflectionQuestionInput = {
  id: string
  text: string
  role: 'central' | 'satellite'
  isPrioritised: boolean
  perspectiveOrigin: 'investigate' | 'reframe' | 'connect' | 'challenge' | null
}

export type ReflectionFailureReason = 'configuration' | 'rate-limit' | 'timeout' | 'upstream' | 'invalid'
