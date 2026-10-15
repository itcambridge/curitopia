export const FOCUS_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const FOCUS_IMAGE_MAX_EDGE = 4096

export type FocusImageKind = 'png' | 'jpeg' | 'webp'

export type InspectedImage = {
  kind: FocusImageKind
  contentType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
}

function inRange(width: number, height: number): boolean {
  return width >= 1 && height >= 1 && width <= FOCUS_IMAGE_MAX_EDGE && height <= FOCUS_IMAGE_MAX_EDGE
}

function readPng(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 24) return null
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((value, index) => bytes[index] === value)) return null
  if (bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) return null
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
  if (!inRange(width >>> 0, height >>> 0)) return null
  return { kind: 'png', contentType: 'image/png', width: width >>> 0, height: height >>> 0 }
}

function readJpeg(bytes: Uint8Array): InspectedImage | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    offset += 1
    while (bytes[offset] === 0xff && offset < bytes.length) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd8 || marker === 0xd9 || marker === 0xda) return null
    if (offset + 1 >= bytes.length) return null
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) return null
    if (marker >= 0xc0 && marker <= 0xc2) {
      if (length < 7) return null
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      if (!inRange(width, height)) return null
      return { kind: 'jpeg', contentType: 'image/jpeg', width, height }
    }
    offset += length
  }
  return null
}

function chunkName(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function readWebp(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 30) return null
  if (chunkName(bytes, 0) !== 'RIFF' || chunkName(bytes, 8) !== 'WEBP') return null
  const chunk = chunkName(bytes, 12)
  if (chunk === 'VP8X') {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    if (!inRange(width, height)) return null
    return { kind: 'webp', contentType: 'image/webp', width, height }
  }
  if (chunk === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff
    if (!inRange(width, height)) return null
    return { kind: 'webp', contentType: 'image/webp', width, height }
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null
    const width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21])
    const height = 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6))
    if (!inRange(width, height)) return null
    return { kind: 'webp', contentType: 'image/webp', width, height }
  }
  return null
}

/** Accepts a JPEG, PNG, or WebP by its contents. A matching file extension is not enough. */
export function inspectImage(bytes: Uint8Array): InspectedImage | null {
  if (bytes.byteLength < 16 || bytes.byteLength > FOCUS_IMAGE_MAX_BYTES) return null
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes)
}
