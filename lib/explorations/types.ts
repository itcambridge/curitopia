export type QuestionRole = 'central' | 'satellite'
export type PerspectiveOrigin = 'investigate' | 'reframe' | 'connect' | 'challenge'
export type ExplorationMode = 'Focus' | 'Quickfire'
export type DatabaseMode = 'focus' | 'quickfire'

export type Question = {
  id: string
  text: string
  color: string
  role: QuestionRole
  isPrioritised: boolean
  perspectiveOrigin?: PerspectiveOrigin
}

export type OpenExploration = {
  id: string
  mode: ExplorationMode
  ended: boolean
  questions: Question[]
}

export type LibraryExploration = {
  id: string
  title: string
  mode: ExplorationMode
  status: 'active' | 'completed'
  updatedAt: string
  questionCount: number
  prioritisedCount: number
}

export type SaveResult = { ok: true } | { ok: false }
