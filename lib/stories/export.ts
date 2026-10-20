import type { SlideFace } from '@/lib/stories/export-face'
import type { StoryPrepareStage } from '@/lib/stories/video-plan'

export const STORY_EXPORT_WIDTH = 1080
export const STORY_EXPORT_HEIGHT = 1920

export type { SlideFace } from '@/lib/stories/export-face'
export { slideFace, STORY_ITEM_SLIDE_LIMIT } from '@/lib/stories/export-face'

/** A preview that has not been accepted must not be flattened. A slide with no image can still export as text. */
export function exportBlockers(slideIds: readonly string[], phaseFor: (slideId: string) => string | undefined) {
  const blockers: { index: number; phase: 'preview' | 'working' }[] = []
  slideIds.forEach((slideId, index) => {
    const phase = phaseFor(slideId)
    if (phase === 'preview' || phase === 'working') blockers.push({ index, phase })
  })
  return blockers
}

/** Uniform scale. Cover fills a matching 9:16 frame without a second crop. Contain letterboxes any other shape. */
export function imagePlacement(frameWidth: number, frameHeight: number, imageWidth: number, imageHeight: number, fit: 'cover' | 'contain') {
  const scale = fit === 'cover'
    ? Math.max(frameWidth / imageWidth, frameHeight / imageHeight)
    : Math.min(frameWidth / imageWidth, frameHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height }
}

export type StoryDraw = {
  width: number
  height: number
  imageFit: 'cover' | 'contain' | null
  mark: boolean
  hook: string
  body: string
}

export function storyDraw(face: SlideFace, options: { hasImage: boolean; fit: 'cover' | 'contain'; showMark: boolean }): StoryDraw {
  return {
    width: STORY_EXPORT_WIDTH,
    height: STORY_EXPORT_HEIGHT,
    imageFit: options.hasImage ? options.fit : null,
    mark: options.showMark,
    hook: face.hook,
    body: face.body,
  }
}

export class StoryPaintError extends Error {
  readonly stage: StoryPrepareStage

  constructor(stage: StoryPrepareStage) {
    super(stage)
    this.name = 'StoryPaintError'
    this.stage = stage
  }
}

export function drawableSize(width: number, height: number) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void }

/** Decodes artwork the page already holds. It does not use the preview's object URL. */
async function decodeArtwork(blob: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      if (drawableSize(bitmap.width, bitmap.height)) {
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
      }
      bitmap.close()
    } catch {
      // Some files still decode through an image element.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!drawableSize(image.naturalWidth, image.naturalHeight)) throw new StoryPaintError('decode')
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    if (error instanceof StoryPaintError) throw error
    throw new StoryPaintError('decode')
  }
}

/** Decodes a preview URL when the page has not kept the blob. The URL is left in place. */
async function decodeUrl(url: string): Promise<Drawable> {
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!drawableSize(image.naturalWidth, image.naturalHeight)) throw new StoryPaintError('decode')
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release() {} }
  } catch (error) {
    if (error instanceof StoryPaintError) throw error
    throw new StoryPaintError('decode')
  }
}

async function loadMark(src: string) {
  try {
    const image = new Image()
    image.src = src
    await image.decode()
    if (!drawableSize(image.naturalWidth, image.naturalHeight)) throw new StoryPaintError('mark')
    return image
  } catch (error) {
    if (error instanceof StoryPaintError) throw error
    throw new StoryPaintError('mark')
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth) {
        line = next
        continue
      }
      if (line) lines.push(line)
      if (ctx.measureText(word).width <= maxWidth) {
        line = word
        continue
      }
      let chunk = ''
      for (const char of word) {
        if (ctx.measureText(chunk + char).width <= maxWidth) chunk += char
        else {
          if (chunk) lines.push(chunk)
          chunk = char
        }
      }
      line = chunk
    }
    if (line) lines.push(line)
  }
  return lines
}

type LaidText = { hookSize: number; bodySize: number; hookLines: string[]; bodyLines: string[]; blockHeight: number }

function layText(ctx: CanvasRenderingContext2D, hook: string, body: string, maxWidth: number, maxHeight: number): LaidText {
  const primary = body ? 42 : 48
  let bodySize = body ? primary : 0
  let hookSize = hook ? (body ? 28 : primary) : 0
  let hookLines: string[] = []
  let bodyLines: string[] = []
  let blockHeight = 0
  for (let step = 0; step < 16; step += 1) {
    ctx.font = `700 ${hookSize || 16}px Arial, Helvetica, sans-serif`
    hookLines = hook ? wrapLines(ctx, hook, maxWidth) : []
    ctx.font = `600 ${bodySize || 16}px Arial, Helvetica, sans-serif`
    bodyLines = body ? wrapLines(ctx, body, maxWidth) : []
    const hookHeight = hookLines.length * (hookSize * 1.25)
    const bodyHeight = bodyLines.length * (bodySize * 1.35)
    const gap = hookLines.length && bodyLines.length ? 18 : 0
    blockHeight = hookHeight + gap + bodyHeight
    if (blockHeight <= maxHeight || (bodySize > 0 && bodySize <= 20 && hookSize <= 18)) break
    if (bodySize > 20) bodySize -= 2
    if (hookSize > 18) hookSize -= 2
  }
  return { hookSize, bodySize, hookLines, bodyLines, blockHeight }
}

type StoryPaint = { face: SlideFace; image: Blob | null; imageUrl?: string | null; fit: 'cover' | 'contain'; showMark: boolean }

/** Paints one 1080 by 1920 slide. The caller disposes of the canvas. */
async function paintStorySlide(input: StoryPaint) {
  if (typeof document === 'undefined') throw new StoryPaintError('context')
  if (document.fonts?.ready) await document.fonts.ready
  const draw = storyDraw(input.face, { hasImage: Boolean(input.image), fit: input.fit, showMark: input.showMark })
  const artwork = input.image ? await decodeArtwork(input.image) : input.imageUrl ? await decodeUrl(input.imageUrl) : null
  try {
    const mark = draw.mark ? await loadMark('/logo-removebg-preview.png') : null
    const canvas = document.createElement('canvas')
    canvas.width = draw.width
    canvas.height = draw.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new StoryPaintError('context')
    ctx.fillStyle = '#071428'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!artwork) {
    const light = ctx.createRadialGradient(canvas.width * 0.3, canvas.height * 0.18, 0, canvas.width * 0.3, canvas.height * 0.18, canvas.width * 0.55)
    light.addColorStop(0, 'rgba(255,255,255,0.16)')
    light.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = light
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const violet = ctx.createRadialGradient(canvas.width * 0.7, canvas.height * 0.8, 0, canvas.width * 0.7, canvas.height * 0.8, canvas.width * 0.7)
    violet.addColorStop(0, 'rgba(120,90,255,0.45)')
    violet.addColorStop(1, 'rgba(120,90,255,0)')
    ctx.fillStyle = violet
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    const place = imagePlacement(canvas.width, canvas.height, artwork.width, artwork.height, input.fit)
    if (!drawableSize(place.width, place.height)) throw new StoryPaintError('paint')
    ctx.drawImage(artwork.source, place.x, place.y, place.width, place.height)
    }
    const inset = 64
  const maxWidth = canvas.width - inset * 2
  const laid = layText(ctx, draw.hook, draw.body, maxWidth, canvas.height * 0.7)
  if (laid.blockHeight > 0) {
    const top = Math.max(canvas.height * 0.28, canvas.height - laid.blockHeight - 88)
    const fade = ctx.createLinearGradient(0, top - 72, 0, canvas.height)
    fade.addColorStop(0, 'rgba(2,8,20,0)')
    fade.addColorStop(0.42, 'rgba(2,8,20,0.5)')
    fade.addColorStop(1, 'rgba(2,8,20,0.9)')
    ctx.fillStyle = fade
    ctx.fillRect(0, top - 72, canvas.width, canvas.height - (top - 72))
    ctx.fillStyle = '#f7fbff'
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 10
    ctx.textBaseline = 'top'
    let y = canvas.height - 72 - laid.blockHeight
    if (laid.hookLines.length) {
      ctx.font = `700 ${laid.hookSize}px Arial, Helvetica, sans-serif`
      for (const line of laid.hookLines) {
        ctx.fillText(line, inset, y)
        y += laid.hookSize * 1.25
      }
      if (laid.bodyLines.length) y += 18
    }
    ctx.font = `600 ${laid.bodySize}px Arial, Helvetica, sans-serif`
    for (const line of laid.bodyLines) {
      ctx.fillText(line, inset, y)
      y += laid.bodySize * 1.35
    }
    ctx.shadowBlur = 0
  }
  if (mark) {
    const markHeight = 96
    const markWidth = markHeight * ((mark.naturalWidth || 1) / (mark.naturalHeight || 1))
    ctx.drawImage(mark, 48, 48, markWidth, markHeight)
    }
    return canvas
  } finally {
    artwork?.release()
  }
}

/** The painted slide. The caller keeps the canvas until encoding finishes, then clears it. */
export async function renderStoryFrame(input: StoryPaint): Promise<HTMLCanvasElement> {
  return paintStorySlide(input)
}
