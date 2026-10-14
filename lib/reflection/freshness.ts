export type ReflectionQuestionSnapshot = {
  id: string
  text: string
  isPrioritised: boolean
  isHidden: boolean
  perspectiveOrigin?: string | null
}

export function reflectionQuestionSignature(questions: readonly ReflectionQuestionSnapshot[]): string {
  return questions
    .filter(question => !question.isHidden)
    .map(question => [question.id, question.isPrioritised ? '1' : '0', question.perspectiveOrigin ?? '', question.text].join('\u001f'))
    .sort()
    .join('\u001e')
}

export function reflectionMatchesQuestions(basis: string, questions: readonly ReflectionQuestionSnapshot[]): boolean {
  return basis === reflectionQuestionSignature(questions)
}

export function reflectionViewState<T>(input: {
  reflection: T | null
  basis: string | null
  questions: readonly ReflectionQuestionSnapshot[]
}): { reflection: T | null; stale: boolean } {
  if (input.reflection === null || input.basis === null) return { reflection: input.reflection, stale: false }
  return {
    reflection: input.reflection,
    stale: !reflectionMatchesQuestions(input.basis, input.questions),
  }
}
