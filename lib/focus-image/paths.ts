import type { FocusImageKind } from '@/lib/focus-image/bytes'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const FOCUS_IMAGE_BUCKET = 'exploration-images'

export function focusImageObjectPath(userId: string, explorationId: string, fileId: string, kind: FocusImageKind): string | null {
  if (!uuidPattern.test(userId) || !uuidPattern.test(explorationId) || !uuidPattern.test(fileId)) return null
  const extension = kind === 'jpeg' ? 'jpeg' : kind
  return `${userId.toLowerCase()}/${explorationId.toLowerCase()}/${fileId.toLowerCase()}.${extension}`
}

export function ownedFocusImagePath(path: string, userId: string, explorationId: string): boolean {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpeg|webp)$/i.exec(path)
  if (!match) return false
  return match[1].toLowerCase() === userId.toLowerCase() && match[2].toLowerCase() === explorationId.toLowerCase()
}
