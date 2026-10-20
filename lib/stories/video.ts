import { renderStoryFrame, StoryPaintError, type SlideFace } from '@/lib/stories/export'
import { STORY_VIDEO_BITRATE, STORY_VIDEO_FPS, StoryVideoError, storyFrameBlend, storyVideoTiming } from '@/lib/stories/video-plan'

export { StoryVideoError } from '@/lib/stories/video-plan'

export type StoryVideoSlide = {
  face: SlideFace
  image: Blob | null
  imageUrl?: string | null
  fit: 'cover' | 'contain'
  showMark: boolean
}

export type StoryVideoProgress =
  | { stage: 'encoder' }
  | { stage: 'preparing'; index: number; count: number }
  | { stage: 'encoding'; frame: number; frames: number }
  | { stage: 'finishing' }

/**
 * Paints the approved slides and muxes one silent H.264 MP4 in the browser.
 * Nothing is uploaded, and the frames are released when encoding ends.
 */
export async function createStoryVideo(slides: readonly StoryVideoSlide[], options: {
  signal: AbortSignal
  onProgress: (progress: StoryVideoProgress) => void
  holdSeconds?: number
  fadeSeconds?: number
}): Promise<Blob> {
  const timing = storyVideoTiming(slides.length, options.holdSeconds, options.fadeSeconds)
  if (slides.length < 1 || timing.frames < 1) throw new StoryVideoError('render')
  let output: { state: string; cancel: () => Promise<void> } | null = null
  const frames: HTMLCanvasElement[] = []
  let canvas: HTMLCanvasElement | null = null
  try {
    if (options.signal.aborted) throw new StoryVideoError('cancelled')
    options.onProgress({ stage: 'encoder' })
    if (typeof VideoEncoder === 'undefined') throw new StoryVideoError('unsupported')
    const media = await import('mediabunny').catch(() => { throw new StoryVideoError('load') })
    const supported = await media.canEncodeVideo('avc', {
      width: timing.width,
      height: timing.height,
      bitrate: STORY_VIDEO_BITRATE,
      frameRate: timing.fps,
    })
    if (!supported) throw new StoryVideoError('unsupported')
    if (options.signal.aborted) throw new StoryVideoError('cancelled')

    for (let index = 0; index < slides.length; index += 1) {
      options.onProgress({ stage: 'preparing', index: index + 1, count: slides.length })
      const slide = slides[index]
      if (!slide) throw new StoryVideoError('render', { index, stage: 'paint' })
      try {
        frames.push(await renderStoryFrame(slide))
      } catch (error) {
        if (options.signal.aborted) throw new StoryVideoError('cancelled')
        const stage = error instanceof StoryPaintError ? error.stage : 'paint'
        try {
          if (process.env.NODE_ENV !== 'production') console.error('story video prepare failed', { index, stage, name: error instanceof Error ? error.name : 'Error' })
        } catch {
          // A missing process global must not hide the preparation error.
        }
        throw new StoryVideoError('render', { index, stage })
      }
      if (options.signal.aborted) throw new StoryVideoError('cancelled')
    }

    canvas = document.createElement('canvas')
    canvas.width = timing.width
    canvas.height = timing.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new StoryVideoError('render', { stage: 'context' })
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const target = new media.BufferTarget()
    const created = new media.Output({
      format: new media.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    })
    output = created
    const source = new media.CanvasSource(canvas, {
      codec: 'avc',
      quality: new media.Quality({ bitrate: STORY_VIDEO_BITRATE, bitrateMode: 'variable' }),
      latencyMode: 'quality',
      keyFrameInterval: 2,
      hardwareAcceleration: 'no-preference',
    })
    created.addVideoTrack(source, { frameRate: timing.fps })
    await created.start()

    for (let frame = 0; frame < timing.frames; frame += 1) {
      if (options.signal.aborted) throw new StoryVideoError('cancelled')
      const blend = storyFrameBlend(frame, slides.length, timing.holdFrames, timing.fadeFrames)
      const base = frames[blend.base]
      const over = frames[blend.over]
      if (!base || !over) throw new StoryVideoError('render', { index: blend.base, stage: 'paint' })
      ctx.globalAlpha = 1
      ctx.drawImage(base, 0, 0, timing.width, timing.height)
      if (blend.alpha > 0 && blend.over !== blend.base) {
        ctx.globalAlpha = blend.alpha
        ctx.drawImage(over, 0, 0, timing.width, timing.height)
        ctx.globalAlpha = 1
      }
      const holdStart = blend.alpha === 0 && (frame === 0 || storyFrameBlend(frame - 1, slides.length, timing.holdFrames, timing.fadeFrames).alpha > 0)
      await source.add(frame / timing.fps, 1 / timing.fps, { keyFrame: holdStart })
      if (frame % 10 === 0 || frame === timing.frames - 1) {
        options.onProgress({ stage: 'encoding', frame: frame + 1, frames: timing.frames })
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    const mime = await created.getMimeType()
    if (!mime.includes('avc1') && !mime.includes('avc3')) throw new StoryVideoError('unsupported')
    source.close()
    options.onProgress({ stage: 'finishing' })
    await created.finalize()
    const buffer = target.buffer
    if (!buffer) throw new StoryVideoError('encoder')
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    if (options.signal.aborted || (error instanceof StoryVideoError && error.code === 'cancelled')) throw new StoryVideoError('cancelled')
    if (error instanceof StoryVideoError) throw error
    throw new StoryVideoError('encoder')
  } finally {
    for (const frame of frames) {
      frame.width = 0
      frame.height = 0
    }
    frames.length = 0
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    if (output && output.state !== 'finalized' && output.state !== 'canceled' && output.state !== 'finalizing') {
      await output.cancel().catch(() => undefined)
    }
  }
}
