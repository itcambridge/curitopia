import type { ExplorationReflection, ReflectionConnection, ReflectionObservation, ReflectionSupport, ReflectionTheme } from '@/lib/reflection/types'

const limits = {
  overview: 700,
  title: 120,
  explanation: 500,
  connection: 400,
  note: 400,
  summary: 500,
  further: 300,
  themes: 5,
  connections: 5,
  observations: 8,
  furtherQuestions: 4,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function citedIds(value: unknown, allowed: ReadonlySet<string>, minimum: number): string[] | 'invalid' | 'weak' {
  if (!Array.isArray(value)) return 'invalid'
  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item)) return 'invalid'
    if (!ids.includes(item)) ids.push(item)
  }
  if (ids.length < minimum) return 'weak'
  return ids
}

function themesFrom(value: unknown, allowed: ReadonlySet<string>): ReflectionTheme[] | null {
  if (!Array.isArray(value)) return null
  const themes: ReflectionTheme[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    const title = boundedText(item.title, limits.title)
    const explanation = boundedText(item.explanation, limits.explanation)
    const questionIds = citedIds(item.questionIds, allowed, 2)
    if (!title || !explanation || questionIds === 'invalid') return null
    if (questionIds === 'weak') continue
    themes.push({ title, explanation, questionIds })
    if (themes.length === limits.themes) break
  }
  return themes
}

function connectionsFrom(value: unknown, allowed: ReadonlySet<string>): ReflectionConnection[] | null {
  if (!Array.isArray(value)) return null
  const connections: ReflectionConnection[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    const connection = boundedText(item.connection, limits.connection)
    const explanation = boundedText(item.explanation, limits.explanation)
    const support = item.support
    const questionIds = citedIds(item.questionIds, allowed, 2)
    if (!connection || !explanation || (support !== 'speculative' && support !== 'supported') || questionIds === 'invalid') return null
    if (questionIds === 'weak') continue
    connections.push({ connection, explanation, support: support as ReflectionSupport, questionIds })
    if (connections.length === limits.connections) break
  }
  return connections
}

function observationsFrom(value: unknown, allowed: ReadonlySet<string>, prioritised: ReadonlySet<string>): ReflectionObservation[] | null {
  if (!Array.isArray(value)) return null
  const observations: ReflectionObservation[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    if (typeof item.questionId !== 'string' || !allowed.has(item.questionId)) return null
    const note = boundedText(item.note, limits.note)
    if (!note) return null
    if (!prioritised.has(item.questionId)) continue
    if (observations.some(existing => existing.questionId === item.questionId)) continue
    observations.push({ questionId: item.questionId, note })
    if (observations.length === limits.observations) break
  }
  return observations
}

function furtherFrom(value: unknown, userQuestions: ReadonlySet<string>): { text: string }[] | null {
  if (!Array.isArray(value)) return null
  const further: { text: string }[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    if (typeof item.text !== 'string') return null
    const text = item.text.trim()
    if (!text) continue
    if (text.length > limits.further) return null
    const normalised = text.toLocaleLowerCase()
    if (userQuestions.has(normalised) || further.some(existing => existing.text.toLocaleLowerCase() === normalised)) continue
    further.push({ text })
    if (further.length === limits.furtherQuestions) break
  }
  return further
}

export function validateReflection(value: unknown, questions: readonly { id: string; text: string; isPrioritised: boolean }[]): ExplorationReflection | null {
  if (!isRecord(value) || !isRecord(value.prioritised)) return null
  const allowed = new Set(questions.map(question => question.id))
  const prioritised = new Set(questions.filter(question => question.isPrioritised).map(question => question.id))
  const userQuestions = new Set(questions.map(question => question.text.trim().toLocaleLowerCase()))
  const overview = boundedText(value.overview, limits.overview)
  const themes = themesFrom(value.themes, allowed)
  const connections = connectionsFrom(value.connections, allowed)
  const observations = observationsFrom(value.prioritised.observations, allowed, prioritised)
  const furtherQuestions = furtherFrom(value.furtherQuestions, userQuestions)
  if (typeof value.prioritised.summary !== 'string' || !overview || !themes || !connections || !observations || !furtherQuestions) return null
  const summaryText = value.prioritised.summary.trim()
  if (summaryText.length > limits.summary) return null
  const summary = summaryText || (observations.length === 0 ? 'You did not mark any questions as prioritised.' : '')
  if (!summary) return null
  return {
    overview,
    themes,
    connections,
    prioritised: {
      summary,
      observations,
    },
    furtherQuestions,
  }
}
