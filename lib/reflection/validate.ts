import { REFLECTION_SUGGESTION_LIMIT, type ExplorationReflection } from '@/lib/reflection/types'

const suggestionCharacterLimit = 300

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Compare question text without treating capitalisation, extra spaces, or a trailing question mark as a different question. */
export function normaliseQuestionText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[?.!]+$/u, '').toLocaleLowerCase()
}

export function validateReflection(value: unknown, questions: readonly { id: string; text: string; isPrioritised: boolean }[]): ExplorationReflection | null {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) return null
  const existing = new Set(questions.map(question => normaliseQuestionText(question.text)).filter(Boolean))
  const suggestions: { text: string }[] = []
  const seen = new Set<string>()
  for (const item of value.suggestions) {
    if (!isRecord(item) || typeof item.text !== 'string') return null
    const text = item.text.trim().replace(/\s+/g, ' ')
    if (!text) continue
    if (text.length > suggestionCharacterLimit) return null
    const normalised = normaliseQuestionText(text)
    if (!normalised || existing.has(normalised) || seen.has(normalised)) continue
    seen.add(normalised)
    suggestions.push({ text })
    if (suggestions.length === REFLECTION_SUGGESTION_LIMIT) break
  }
  return { suggestions }
}
