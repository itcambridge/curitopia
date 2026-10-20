export type StoryPrepareStage = 'decode' | 'mark' | 'paint' | 'context'

export class StoryVideoError extends Error {
  readonly code: 'cancelled' | 'unsupported' | 'encoder' | 'render' | 'load'
  readonly index: number | null
  readonly stage: StoryPrepareStage | null

  constructor(code: StoryVideoError['code'], details?: { index?: number; stage?: StoryPrepareStage }) {
    super(code)
    this.name = 'StoryVideoError'
    this.code = code
    this.index = details?.index ?? null
    this.stage = details?.stage ?? null
  }
}

/** A message safe to show. It names the slide and the stage, not the picture or the words. */
export function storyVideoFailureMessage(error: StoryVideoError) {
  const slide = error.index === null ? 'A slide' : `Slide ${error.index + 1}`
  if (error.stage === 'decode') return `${slide} could not be prepared because its artwork could not be decoded. The story and its artwork are unchanged.`
  if (error.stage === 'mark') return `${slide} could not be prepared because the Curitopia mark could not be loaded. The story and its artwork are unchanged.`
  if (error.stage === 'context') return 'The video frame could not be prepared. The story and its artwork are unchanged.'
  return `${slide} could not be prepared. The story and its artwork are unchanged.`
}

export const STORY_VIDEO_NAME = 'curitopia-story.mp4'
export const STORY_VIDEO_FPS = 30
export const STORY_SLIDE_HOLD_SECONDS = 4
export const STORY_FADE_SECONDS = 0.5
export const STORY_VIDEO_BITRATE = 8_000_000

export function storyVideoTiming(slideCount: number, holdSeconds = STORY_SLIDE_HOLD_SECONDS, fadeSeconds = STORY_FADE_SECONDS) {
  const holdFrames = Math.round(holdSeconds * STORY_VIDEO_FPS)
  const fadeFrames = slideCount > 1 ? Math.round(fadeSeconds * STORY_VIDEO_FPS) : 0
  const frames = slideCount > 0 ? slideCount * holdFrames + Math.max(0, slideCount - 1) * fadeFrames : 0
  return {
    fps: STORY_VIDEO_FPS,
    width: 1080,
    height: 1920,
    holdFrames,
    fadeFrames,
    frames,
    seconds: frames / STORY_VIDEO_FPS,
  }
}

/** Which painted slide is visible at this frame. `alpha` is the incoming slide, from just above 0 to 1. */
export function storyFrameBlend(frameIndex: number, slideCount: number, holdFrames: number, fadeFrames: number) {
  const last = Math.max(0, slideCount - 1)
  if (slideCount < 1 || holdFrames < 1) return { base: 0, over: 0, alpha: 0 }
  const frame = Math.max(0, frameIndex)
  let cursor = 0
  for (let index = 0; index < last; index += 1) {
    if (frame < cursor + holdFrames) return { base: index, over: index, alpha: 0 }
    cursor += holdFrames
    if (fadeFrames > 0 && frame < cursor + fadeFrames) {
      return { base: index, over: index + 1, alpha: (frame - cursor + 1) / fadeFrames }
    }
    cursor += fadeFrames
  }
  return { base: last, over: last, alpha: 0 }
}

export function formatStoryDuration(seconds: number) {
  const rounded = Math.round(seconds * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return text === '1' ? '1 second' : `${text} seconds`
}

export type Mp4Facts = {
  ftyp: boolean
  webm: boolean
  brands: string
  avc: boolean
  audio: boolean
  width: number | null
  height: number | null
  timescale: number | null
  duration: number | null
  sampleDelta: number | null
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts'])

function u32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) * 16777216) + ((bytes[offset + 1] ?? 0) * 65536) + ((bytes[offset + 2] ?? 0) * 256) + (bytes[offset + 3] ?? 0)
}

function fourcc(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0)
}

function fixed16(bytes: Uint8Array, offset: number) {
  return u32(bytes, offset) / 65536
}

/** Reads the container, codec, size, and timing boxes. It does not decode pictures. */
export function readMp4Facts(bytes: Uint8Array): Mp4Facts {
  const facts: Mp4Facts = {
    ftyp: false,
    webm: bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
    brands: '',
    avc: false,
    audio: false,
    width: null,
    height: null,
    timescale: null,
    duration: null,
    sampleDelta: null,
  }
  const visit = (type: string, content: number, end: number) => {
    if (type === 'ftyp') {
      facts.ftyp = true
      const brands: string[] = []
      for (let offset = content; offset + 4 <= Math.min(end, content + 64); offset += 4) {
        if (offset === content + 4) continue
        brands.push(fourcc(bytes, offset))
      }
      facts.brands = brands.join(' ')
    }
    if (type === 'avc1' || type === 'avc3' || type === 'avcC') facts.avc = true
    if (type === 'hdlr' && fourcc(bytes, content + 8) === 'soun') facts.audio = true
    if (type === 'tkhd' && facts.width === null) {
      const version = bytes[content] ?? 0
      const widthAt = content + (version === 1 ? 88 : 76)
      if (widthAt + 8 <= end) {
        facts.width = fixed16(bytes, widthAt)
        facts.height = fixed16(bytes, widthAt + 4)
      }
    }
    if (type === 'mdhd' && facts.timescale === null) {
      const version = bytes[content] ?? 0
      const scaleAt = content + (version === 1 ? 20 : 12)
      facts.timescale = u32(bytes, scaleAt)
      facts.duration = version === 1 ? u32(bytes, scaleAt + 8) : u32(bytes, scaleAt + 4)
    }
    if (type === 'stts' && facts.sampleDelta === null && content + 16 <= end) {
      facts.sampleDelta = u32(bytes, content + 12)
    }
  }
  const walk = (start: number, end: number) => {
    let cursor = start
    while (cursor + 8 <= end) {
      let size = u32(bytes, cursor)
      const type = fourcc(bytes, cursor + 4)
      let header = 8
      if (size === 1 && cursor + 16 <= end) {
        size = u32(bytes, cursor + 8) * 4294967296 + u32(bytes, cursor + 12)
        header = 16
      }
      if (size < header) return
      const boxEnd = cursor + size
      if (boxEnd > end) return
      visit(type, cursor + header, boxEnd)
      if (CONTAINERS.has(type)) walk(cursor + header, boxEnd)
      cursor = boxEnd
    }
  }
  walk(0, bytes.length)
  if (!facts.avc) facts.avc = includesFourcc(bytes, 'avc1') || includesFourcc(bytes, 'avc3') || includesFourcc(bytes, 'avcC')
  return facts
}

function includesFourcc(bytes: Uint8Array, text: string) {
  const needle = [text.charCodeAt(0), text.charCodeAt(1), text.charCodeAt(2), text.charCodeAt(3)]
  for (let index = 0; index + 4 <= bytes.length; index += 1) {
    if (bytes[index] === needle[0] && bytes[index + 1] === needle[1] && bytes[index + 2] === needle[2] && bytes[index + 3] === needle[3]) return true
  }
  return false
}
