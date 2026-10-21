/**
 * Prepares a new question for saving.
 * It trims the ends and leaves one question mark there.
 * Punctuation inside the question stays as written.
 * Empty input, and input that is only terminal punctuation, stays empty.
 */
export function questionWithMark(value: string) {
  const text = value.trim()
  if (!text) return ''
  if (text.endsWith('?')) return text
  const stripped = text.replace(/[.!]+$/, '')
  if (!stripped || stripped.endsWith('?')) return stripped
  return `${stripped}?`
}
