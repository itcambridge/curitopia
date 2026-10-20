import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { formatStoryDuration, readMp4Facts, STORY_FADE_SECONDS, STORY_SLIDE_HOLD_SECONDS, STORY_VIDEO_FPS, STORY_VIDEO_NAME, StoryVideoError, storyFrameBlend, storyVideoFailureMessage, storyVideoTiming } from '@/lib/stories/video-plan'
import { drawableSize } from '@/lib/stories/export'

test('a story video holds each slide, then crossfades, in story order', () => {
  assert.equal(STORY_VIDEO_NAME, 'curitopia-story.mp4')
  assert.equal(STORY_VIDEO_FPS, 30)
  assert.equal(STORY_SLIDE_HOLD_SECONDS, 4)
  assert.equal(STORY_FADE_SECONDS, 0.5)
  const one = storyVideoTiming(1)
  assert.equal(one.width, 1080)
  assert.equal(one.height, 1920)
  assert.equal(one.width * 16, one.height * 9)
  assert.equal(one.frames, 120)
  assert.equal(one.seconds, 4)
  assert.equal(one.fadeFrames, 0)
  assert.equal(formatStoryDuration(one.seconds), '4 seconds')

  const two = storyVideoTiming(2)
  assert.equal(two.holdFrames, 120)
  assert.equal(two.fadeFrames, 15)
  assert.equal(two.frames, 255)
  assert.equal(two.seconds, 8.5)
  assert.equal(formatStoryDuration(two.seconds), '8.5 seconds')
  const opening = storyFrameBlend(0, 2, two.holdFrames, two.fadeFrames)
  assert.deepEqual(opening, { base: 0, over: 0, alpha: 0 })
  assert.deepEqual(storyFrameBlend(119, 2, two.holdFrames, two.fadeFrames), { base: 0, over: 0, alpha: 0 })
  const fadeStart = storyFrameBlend(120, 2, two.holdFrames, two.fadeFrames)
  assert.equal(fadeStart.base, 0)
  assert.equal(fadeStart.over, 1)
  assert.ok(fadeStart.alpha > 0 && fadeStart.alpha < 1)
  const fadeEnd = storyFrameBlend(134, 2, two.holdFrames, two.fadeFrames)
  assert.equal(fadeEnd.alpha, 1)
  assert.deepEqual(storyFrameBlend(135, 2, two.holdFrames, two.fadeFrames), { base: 1, over: 1, alpha: 0 })
  assert.deepEqual(storyFrameBlend(254, 2, two.holdFrames, two.fadeFrames), { base: 1, over: 1, alpha: 0 })

  const three = storyVideoTiming(3)
  assert.equal(three.frames, 390)
  assert.equal(storyFrameBlend(0, 3, three.holdFrames, three.fadeFrames).base, 0)
  assert.equal(storyFrameBlend(200, 3, three.holdFrames, three.fadeFrames).base, 1)
  assert.equal(storyFrameBlend(389, 3, three.holdFrames, three.fadeFrames).base, 2)
})

test('the mp4 reader tells an H.264 file from a WebM file', () => {
  const file = readMp4Facts(sampleMp4())
  assert.equal(file.webm, false)
  assert.equal(file.ftyp, true)
  assert.equal(file.avc, true)
  assert.equal(file.audio, false)
  assert.equal(file.width, 1080)
  assert.equal(file.height, 1920)
  assert.equal(file.timescale, 30)
  assert.equal(file.sampleDelta, 1)
  assert.equal(file.timescale && file.sampleDelta ? file.timescale / file.sampleDelta : 0, 30)
  const webm = readMp4Facts(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x77, 0x65, 0x62, 0x6d]))
  assert.equal(webm.webm, true)
  assert.equal(webm.ftyp, false)
  assert.equal(webm.avc, false)
})

test('video export stays in the browser and keeps the slide painter', () => {
  const video = readFileSync(new URL('../lib/stories/video.ts', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../components/story-screen.tsx', import.meta.url), 'utf8')
  const plan = readFileSync(new URL('../lib/stories/video-plan.ts', import.meta.url), 'utf8')
  assert.match(video, /codec: 'avc'/)
  assert.match(video, /Mp4OutputFormat/)
  assert.match(video, /renderStoryFrame/)
  assert.equal(video.includes('createImageBitmap(canvas)'), false)
  assert.match(video, /frame\.width = 0/)
  assert.match(video, /output\.cancel\(\)/)
  assert.equal(video.includes('webm'), false)
  assert.equal(video.includes('vp8'), false)
  assert.equal(video.includes('vp9'), false)
  assert.equal(video.includes('fetch('), false)
  assert.equal(video.includes('story-image'), false)
  assert.equal(video.includes('localStorage'), false)
  assert.equal(video.includes('sessionStorage'), false)
  assert.equal(video.includes('indexedDB'), false)
  assert.equal(video.includes('openai'), false)
  assert.equal(plan.includes('fetch('), false)
  assert.match(screen, /Download video \(MP4\)/)
  assert.match(screen, /STORY_VIDEO_NAME/)
  assert.match(screen, /image: accepted\?\.blob/)
  assert.match(screen, /imageUrl: accepted\?\.url/)
  assert.match(screen, /art\[entry\.id\]\?\.accepted/)
  const download = screen.slice(screen.indexOf('async function downloadVideo'), screen.indexOf('function startVideo'))
  assert.equal(download.includes('revokeObjectURL'), false)
  assert.equal(download.includes('onArt('), false)
  assert.match(screen, /AbortController/)
  assert.match(screen, /The story and its artwork are unchanged/)
  assert.equal(screen.includes('onGenerate(slide.id'), true)
  assert.equal(screen.includes('createStoryVideo'), true)
})

test('a preparation failure names the slide and stage without private content', () => {
  assert.equal(drawableSize(1080, 1920), true)
  assert.equal(drawableSize(0, 1920), false)
  const decode = new StoryVideoError('render', { index: 1, stage: 'decode' })
  const message = storyVideoFailureMessage(decode)
  assert.match(message, /Slide 2/)
  assert.match(message, /artwork could not be decoded/)
  assert.equal(message.includes('what if'), false)
  const mark = storyVideoFailureMessage(new StoryVideoError('render', { index: 0, stage: 'mark' }))
  assert.match(mark, /Slide 1/)
  assert.match(mark, /Curitopia mark/)
  const cancelled = new StoryVideoError('cancelled')
  assert.equal(cancelled.code, 'cancelled')
  assert.notEqual(cancelled.code, decode.code)
  const screen = readFileSync(new URL('../components/story-screen.tsx', import.meta.url), 'utf8')
  assert.equal(screen.includes('URL.revokeObjectURL(accepted'), false)
})

function sampleMp4() {
  const ftyp = box('ftyp', bytes('isom', [0, 0, 0, 0], 'isom', 'iso2', 'mp41'))
  const tkhd = box('tkhd', fixedTrackHeader(1080, 1920))
  const mdhd = box('mdhd', fixedMediaHeader(30, 255))
  const hdlr = box('hdlr', bytes([0, 0, 0, 0], [0, 0, 0, 0], 'vide'))
  const stts = box('stts', u32s(0, 1, 8, 1))
  const avc1 = box('avc1', new Uint8Array(8))
  const stsd = box('stsd', concat([u32s(0, 1), avc1]))
  const stbl = box('stbl', concat([stts, stsd]))
  const minf = box('minf', stbl)
  const mdia = box('mdia', concat([mdhd, hdlr, minf]))
  const trak = box('trak', concat([tkhd, mdia]))
  const moov = box('moov', trak)
  return concat([ftyp, moov])
}

function fixedTrackHeader(width: number, height: number) {
  const content = new Uint8Array(84)
  const view = new DataView(content.buffer)
  view.setUint32(76, width * 65536)
  view.setUint32(80, height * 65536)
  return content
}

function fixedMediaHeader(timescale: number, duration: number) {
  const content = new Uint8Array(20)
  const view = new DataView(content.buffer)
  view.setUint32(12, timescale)
  view.setUint32(16, duration)
  return content
}

function box(type: string, content: Uint8Array) {
  const out = new Uint8Array(8 + content.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, out.length)
  out.set(bytes(type), 4)
  out.set(content, 8)
  return out
}

function bytes(...parts: Array<string | number[] | Uint8Array>) {
  const chunks = parts.map(part => typeof part === 'string' ? Uint8Array.from(part, char => char.charCodeAt(0)) : part instanceof Uint8Array ? part : Uint8Array.from(part))
  return concat(chunks)
}

function u32s(...values: number[]) {
  const out = new Uint8Array(values.length * 4)
  const view = new DataView(out.buffer)
  values.forEach((value, index) => view.setUint32(index * 4, value))
  return out
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
