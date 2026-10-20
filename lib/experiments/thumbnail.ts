import { experimentItemKind } from '@/lib/experiments/rules'

export const THUMBNAIL_BUCKET = 'experiment-thumbnails'
export const THUMBNAIL_MAX_EDGE = 256
export const THUMBNAIL_MAX_BYTES = 150 * 1024
export const THUMBNAIL_TARGET_BYTES = 100 * 1024
export const THUMBNAIL_SOURCE_MAX_BYTES = 5 * 1024 * 1024

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ThumbnailImage = { width: number; height: number; contentType: 'image/webp' }

export type ThumbnailItem = {
  status: 'ok'
  kind: string
  imagePath: string | null
} | { status: 'not-found' } | { status: 'error' }

export type ThumbnailResult = {
  status: number
  cacheControl: 'no-store'
  body: { error: string } | { imagePath: string | null }
}

const unavailable = 'This experiment is not available.'
const unchanged = 'The image could not be saved. The current image is unchanged.'
const rejected = 'Use a thumbnail up to 256 by 256 pixels and 150 KB.'

function httpError(status: number, error: string): ThumbnailResult {
  return { status, cacheControl: 'no-store', body: { error } }
}

function chunkName(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function withinEdge(width: number, height: number) {
  return width >= 1 && height >= 1 && width <= THUMBNAIL_MAX_EDGE && height <= THUMBNAIL_MAX_EDGE
}

/** Accepts only a WebP whose contents declare both edges at or below 256. */
export function inspectThumbnail(bytes: Uint8Array): ThumbnailImage | null {
  if (bytes.byteLength < 30 || bytes.byteLength > THUMBNAIL_MAX_BYTES) return null
  if (chunkName(bytes, 0) !== 'RIFF' || chunkName(bytes, 8) !== 'WEBP') return null
  const chunk = chunkName(bytes, 12)
  let width = 0
  let height = 0
  if (chunk === 'VP8X') {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
  } else if (chunk === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    width = (bytes[26] | (bytes[27] << 8)) & 0x3fff
    height = (bytes[28] | (bytes[29] << 8)) & 0x3fff
  } else if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null
    width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21])
    height = 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6))
  } else {
    return null
  }
  if (!withinEdge(width, height)) return null
  return { width, height, contentType: 'image/webp' }
}

export function isThumbnailSource(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12 || bytes.byteLength > THUMBNAIL_SOURCE_MAX_BYTES) return false
  const png = [137, 80, 78, 71, 13, 10, 26, 10]
  if (png.every((value, index) => bytes[index] === value)) return true
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  return chunkName(bytes, 0) === 'RIFF' && chunkName(bytes, 8) === 'WEBP'
}

export function thumbnailObjectPath(userId: string, experimentId: string, itemId: string, fileId: string): string | null {
  if (!uuidPattern.test(userId) || !uuidPattern.test(experimentId) || !uuidPattern.test(itemId) || !uuidPattern.test(fileId)) return null
  return `${userId.toLowerCase()}/${experimentId.toLowerCase()}/${itemId.toLowerCase()}/${fileId.toLowerCase()}.webp`
}

export function ownedThumbnailPath(path: string, userId: string, experimentId: string, itemId: string): boolean {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/i.exec(path)
  if (!match) return false
  return match[1].toLowerCase() === userId.toLowerCase()
    && match[2].toLowerCase() === experimentId.toLowerCase()
    && match[3].toLowerCase() === itemId.toLowerCase()
}

export function thumbnailPathForItem(path: string, experimentId: string, itemId: string): boolean {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/i.exec(path)
  if (!match) return false
  return match[2].toLowerCase() === experimentId.toLowerCase() && match[3].toLowerCase() === itemId.toLowerCase()
}

export function missingImagePathColumn(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('image_path')
}

export async function applyThumbnail(input: {
  signedIn: boolean
  userId: string | null
  experimentId: string
  itemId: string
  action: 'store' | 'remove'
  bytes?: Uint8Array
  load: () => Promise<ThumbnailItem>
  createFileId: () => string
  putObject: (path: string, bytes: Uint8Array) => Promise<boolean>
  removeObject: (path: string) => Promise<boolean>
  setPath: (path: string | null) => Promise<boolean>
}): Promise<ThumbnailResult> {
  if (!input.signedIn || !input.userId) return httpError(401, 'Sign in to add an image.')
  const loaded = await input.load()
  if (loaded.status === 'error') return httpError(503, unchanged)
  if (loaded.status === 'not-found') return httpError(404, unavailable)
  if (!experimentItemKind(loaded.kind)) return httpError(422, 'This item cannot have an image.')

  if (input.action === 'remove') {
    const current = loaded.imagePath
    if (!current) return { status: 200, cacheControl: 'no-store', body: { imagePath: null } }
    if (!ownedThumbnailPath(current, input.userId, input.experimentId, input.itemId)) return httpError(404, unavailable)
    const cleared = await input.setPath(null)
    if (!cleared) return httpError(503, unchanged)
    const removed = await input.removeObject(current)
    if (!removed) {
      await input.setPath(current)
      return httpError(503, unchanged)
    }
    return { status: 200, cacheControl: 'no-store', body: { imagePath: null } }
  }

  const image = input.bytes ? inspectThumbnail(input.bytes) : null
  if (!image || !input.bytes) return httpError(422, rejected)
  const path = thumbnailObjectPath(input.userId, input.experimentId, input.itemId, input.createFileId())
  if (!path) return httpError(503, unchanged)
  const stored = await input.putObject(path, input.bytes)
  if (!stored) return httpError(503, unchanged)
  const saved = await input.setPath(path)
  if (!saved) {
    await input.removeObject(path)
    return httpError(503, unchanged)
  }
  const previous = loaded.imagePath
  if (previous && previous !== path && ownedThumbnailPath(previous, input.userId, input.experimentId, input.itemId)) {
    await input.removeObject(previous)
  }
  return { status: 200, cacheControl: 'no-store', body: { imagePath: path } }
}
