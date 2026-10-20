import { experimentItemKind, experimentItemKinds } from '@/lib/experiments/rules'

const promptLimit = 1000

/** A starting prompt the user can edit. It quotes only this item, and it is not sent until they choose Generate. */
export function suggestedConceptPrompt(body: string, kind = 'concept'): string {
  const text = body.trim().replace(/\s+/g, ' ').slice(0, 280)
  if (!text) return ''
  const label = experimentItemKinds.find(item => item.kind === kind)?.label.toLowerCase() ?? 'thought'
  return `A small, clear visual symbol for this ${label}: "${text}". Simple shapes, few colours, recognisable at a small size, with no text, letters, or labels.`
}

export function maySubmitConceptPrompt(input: { confirmed: boolean; inFlight: boolean; prompt: string; kind: string }): boolean {
  const prompt = input.prompt.trim()
  return experimentItemKind(input.kind) !== null && input.confirmed && !input.inFlight && prompt.length > 0 && prompt.length <= promptLimit
}

export type ThumbnailPromptState = {
  itemId: string
  kind: string
  body: string
  prompt: string
  customized: boolean
}

/** A new item gets a new prompt. An edited prompt stays only while the same item stays selected. */
export function nextThumbnailPrompt(current: ThumbnailPromptState, next: { itemId: string; kind: string; body: string }): ThumbnailPromptState {
  if (current.itemId !== next.itemId || !current.customized) {
    return { itemId: next.itemId, kind: next.kind, body: next.body, prompt: suggestedConceptPrompt(next.body, next.kind), customized: false }
  }
  return { itemId: next.itemId, kind: next.kind, body: next.body, prompt: current.prompt, customized: true }
}

export function editThumbnailPrompt(current: ThumbnailPromptState, prompt: string): ThumbnailPromptState {
  return { ...current, prompt, customized: prompt !== suggestedConceptPrompt(current.body, current.kind) }
}
