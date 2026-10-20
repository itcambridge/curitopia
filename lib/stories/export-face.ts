/** A long item stays in the editor. The slide shows a short subtitle, or the artwork, instead of a second copy of that paragraph. */
export const STORY_ITEM_SLIDE_LIMIT = 160

export type SlideFace = { hook: string; body: string }

function sameWords(left: string, right: string) {
  return left.trim().replace(/\s+/g, ' ') === right.trim().replace(/\s+/g, ' ')
}

/** Words drawn on the vision board. Questions stay complete. Item type and the parent question are not included. */
export function slideFace(kind: 'question' | 'item' | 'closing', text: string, subtitle: string): SlideFace {
  const full = text.replace(/\s+$/g, '').replace(/^\s+/g, '')
  const hook = subtitle.trim()
  if (kind === 'question' || kind === 'closing') {
    return { hook: hook && !sameWords(hook, full) ? hook : '', body: full }
  }
  if (full.length > STORY_ITEM_SLIDE_LIMIT) return { hook, body: '' }
  if (!hook || sameWords(hook, full)) return { hook: '', body: full }
  return { hook, body: full }
}
