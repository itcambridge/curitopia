const questionLimit = 280

/** A starting prompt the user can edit. It is not sent until they choose Generate. */
export function suggestedFocusPrompt(anchorQuestion: string): string {
  const question = anchorQuestion.trim().replace(/\s+/g, ' ').slice(0, questionLimit)
  if (!question) return ''
  return `A wide, calm image that suggests a visual metaphor for this question, rather than a literal picture of its wording: "${question}". Use coherent imagery such as pathways, layers, light, or a quiet network of forms when that fits. Thoughtful and uncluttered, with no text, letters, or labels. Colours and lighting that belong with a dark navy workspace.`
}

export function maySubmitFocusPrompt(input: { confirmed: boolean; inFlight: boolean; prompt: string }): boolean {
  const prompt = input.prompt.trim()
  return input.confirmed && !input.inFlight && prompt.length > 0 && prompt.length <= 1000
}
