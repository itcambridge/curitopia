'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createStory, moveSlide, removeSlide, setClosingQuestion, setOpening, setSlideSubtitle, storyKindLabel, syncStory, type StoryDraft, type StoryItem, type StorySlide, type StorySource } from '@/lib/stories/draft'
import { exportBlockers, slideFace, STORY_ITEM_SLIDE_LIMIT } from '@/lib/stories/export'
import { formatStoryDuration, STORY_VIDEO_NAME, storyVideoFailureMessage, storyVideoTiming } from '@/lib/stories/video-plan'
import { StoryVideoError, type StoryVideoProgress } from '@/lib/stories/video'
import { storyImageRequest, type StoryImageRequest } from '@/lib/stories/image'

type Step = 'select' | 'arrange' | 'review'
type ArtPhase = 'idle' | 'confirm' | 'working' | 'preview' | 'error'
type HeldImage = { url: string; blob: Blob; fit: 'cover' | 'contain' }
type SlideArt = { phase: ArtPhase; accepted: HeldImage | null; pending: HeldImage | null; error: string | null }

export default function StoryScreen({ source }: { source: StorySource }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('select')
  const [questionIds, setQuestionIds] = useState<string[]>([])
  const [itemIds, setItemIds] = useState<string[]>([])
  const [draft, setDraft] = useState<StoryDraft | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [art, setArt] = useState<Record<string, SlideArt>>({})
  const [showMark, setShowMark] = useState(false)
  const busy = useRef(false)

  const questionsById = useMemo(() => new Map(source.questions.map(question => [question.id, question])), [source.questions])
  const itemsById = useMemo(() => new Map(source.items.map(item => [item.id, item])), [source.items])
  const groups = useMemo(() => groupItems(source), [source])

  function toggle(list: string[], id: string, setList: (ids: string[]) => void) {
    setNotice(null)
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id])
  }

  function release(image: HeldImage | null) {
    if (image) URL.revokeObjectURL(image.url)
  }

  function releaseSlide(slideId: string) {
    setArt(current => {
      const slide = current[slideId]
      if (!slide) return current
      release(slide.accepted)
      release(slide.pending)
      const next = { ...current }
      delete next[slideId]
      return next
    })
  }

  function releaseAll() {
    setArt(current => {
      for (const slide of Object.values(current)) {
        release(slide.accepted)
        release(slide.pending)
      }
      return {}
    })
  }

  function continueToArrange() {
    const next = draft
      ? syncStory(draft, source, questionIds, itemIds)
      : createStory(source, questionIds, itemIds, null)
    if (!next.ok) {
      setNotice(next.reason === 'no-question' ? 'Choose at least one visible question. A story opens with a question from this exploration.' : 'That selection is not part of this exploration.')
      return
    }
    if (draft) {
      for (const slide of draft.slides) {
        if (!next.draft.slides.some(item => item.id === slide.id)) releaseSlide(slide.id)
      }
    }
    setDraft(next.draft)
    setStep('arrange')
  }

  function changeDraft(next: StoryDraft) {
    if (draft) {
      for (const slide of draft.slides) {
        if (!next.slides.some(item => item.id === slide.id)) releaseSlide(slide.id)
      }
    }
    setDraft(next)
  }

  function discard() {
    if (!window.confirm('Discard this story? The draft, including any artwork, will be lost. Your exploration, questions, and experiment items stay as they are.')) return
    releaseAll()
    router.push(`/explorations/${source.explorationId}`)
  }

  async function generateArtwork(slideId: string, request: StoryImageRequest) {
    if (busy.current) return
    busy.current = true
    setArt(current => ({ ...current, [slideId]: { phase: 'working', accepted: current[slideId]?.accepted ?? null, pending: current[slideId]?.pending ?? null, error: null } }))
    try {
      const response = await fetch(`/api/explorations/${source.explorationId}/story-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmed: true, ...request }),
      })
      const body: unknown = await response.json().catch(() => null)
      const record = body && typeof body === 'object' ? body as { image?: unknown; contentType?: unknown; fit?: unknown; error?: unknown } : {}
      if (!response.ok || typeof record.image !== 'string' || typeof record.contentType !== 'string') {
        const message = typeof record.error === 'string' ? record.error : 'The image could not be created. Try again.'
        setArt(current => ({ ...current, [slideId]: { phase: 'error', accepted: current[slideId]?.accepted ?? null, pending: current[slideId]?.pending ?? null, error: message } }))
        return
      }
      const binary = Uint8Array.from(atob(record.image), char => char.charCodeAt(0))
      const blob = new Blob([binary], { type: record.contentType })
      const url = URL.createObjectURL(blob)
      const fit = record.fit === 'contain' ? 'contain' : 'cover'
      let replaced: string | null = null
      setArt(current => {
        const previous = current[slideId]
        replaced = previous?.pending && previous.pending.url !== url ? previous.pending.url : null
        return { ...current, [slideId]: { phase: 'preview', accepted: previous?.accepted ?? null, pending: { url, blob, fit }, error: null } }
      })
      if (replaced) URL.revokeObjectURL(replaced)
    } catch {
      setArt(current => ({ ...current, [slideId]: { phase: 'error', accepted: current[slideId]?.accepted ?? null, pending: current[slideId]?.pending ?? null, error: 'The image could not be created. Try again.' } }))
    } finally {
      busy.current = false
    }
  }

  return (
    <main className="story-shell">
      <header className="story-bar">
        <a className="library-link" href={`/explorations/${source.explorationId}`}>Back to exploration</a>
        <p className="story-kicker">{source.title}</p>
        <button type="button" className="investigate-further" onClick={discard}>Discard story</button>
      </header>
      <p className="story-temporary" role="note">This story stays in this tab. Refreshing or closing the tab discards the draft. Nothing is saved, and the exploration is not changed.</p>
      <nav className="story-steps" aria-label="Story steps">
        <button type="button" aria-current={step === 'select' ? 'step' : undefined} onClick={() => setStep('select')}>Select</button>
        <button type="button" aria-current={step === 'arrange' ? 'step' : undefined} disabled={!draft} onClick={() => draft && setStep('arrange')}>Arrange</button>
        <button type="button" aria-current={step === 'review' ? 'step' : undefined} disabled={!draft} onClick={() => draft && setStep('review')}>Review</button>
      </nav>
      {notice ? <p className="composer-error" role="alert">{notice}</p> : null}

      {step === 'select' ? (
        <section className="story-panel" aria-labelledby="story-select-heading">
          <h1 id="story-select-heading">Select content</h1>
          <p className="story-lead">Choose questions and, if you want, experiment items from this exploration. Hidden questions are not listed. Nothing is included until you select it.</p>
          {source.questions.length === 0 ? <p>No visible questions in this exploration.</p> : (
            <ul className="story-choices">
              {source.questions.map(question => (
                <li key={question.id}>
                  <label>
                    <input type="checkbox" checked={questionIds.includes(question.id)} onChange={() => toggle(questionIds, question.id, setQuestionIds)} />
                    <span>
                      <span className="story-choice-meta">{question.role === 'central' ? 'Central question' : 'Question'}{question.isPrioritised ? ' · Starred' : ''}</span>
                      <span className="story-choice-text">{question.text}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <h2>Experiment items</h2>
          {source.items.length === 0 ? <p className="story-lead">This exploration has no experiment items to include.</p> : groups.map(group => (
            <section key={group.key}>
              <h3 className="story-group">{group.label}</h3>
              <ul className="story-choices">
                {group.items.map(item => (
                  <li key={item.id}>
                    <label>
                      <input type="checkbox" checked={itemIds.includes(item.id)} onChange={() => toggle(itemIds, item.id, setItemIds)} />
                      <span>
                        <span className="story-choice-meta">{storyKindLabel(item.kind)}</span>
                        <span className="story-choice-text">{item.body}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" className="add-button story-continue" disabled={questionIds.length === 0} onClick={continueToArrange}>Arrange slides</button>
        </section>
      ) : null}

      {step === 'arrange' && draft ? (
        <ArrangeStep draft={draft} questionsById={questionsById} itemsById={itemsById} onChange={changeDraft} onReview={() => setStep('review')} />
      ) : null}

      {step === 'review' && draft ? (
        <ReviewStep
          source={source}
          draft={draft}
          art={art}
          showMark={showMark}
          questionsById={questionsById}
          itemsById={itemsById}
          onEdit={() => setStep('arrange')}
          onShowMark={setShowMark}
          onArt={(slideId, next) => setArt(current => ({ ...current, [slideId]: next }))}
          onGenerate={generateArtwork}
        />
      ) : null}
    </main>
  )
}

function ArrangeStep({
  draft,
  questionsById,
  itemsById,
  onChange,
  onReview,
}: {
  draft: StoryDraft
  questionsById: Map<string, StorySource['questions'][number]>
  itemsById: Map<string, StoryItem>
  onChange: (draft: StoryDraft) => void
  onReview: () => void
}) {
  const closing = draft.slides.find(slide => slide.kind === 'closing')
  const questionCount = draft.slides.filter(slide => slide.kind === 'question').length
  return (
    <section className="story-panel" aria-labelledby="story-arrange-heading">
      <h1 id="story-arrange-heading">Arrange slides</h1>
      <p className="story-lead">Reorder the slides and add a short subtitle. The full question stays on the slide. Removing a slide removes it from this draft only.</p>
      <ol className="story-arrange">
        {draft.slides.map((slide, index) => {
          const question = slide.kind === 'question' ? questionsById.get(slide.questionId) : null
          const item = slide.kind === 'item' ? itemsById.get(slide.itemId) : null
          const title = slide.kind === 'closing' ? 'Closing question' : slide.kind === 'item' ? storyKindLabel(item?.kind ?? 'note') : slide.opening ? 'Opening question' : 'Question'
          const body = slide.kind === 'closing' ? slide.text : slide.kind === 'item' ? item?.body ?? '' : question?.text ?? ''
          return (
            <li key={slide.id}>
              <div className="story-arrange-heading">
                <span>{title}{question?.isPrioritised ? ' · Starred' : ''}</span>
                <span className="story-arrange-actions">
                  {slide.kind === 'question' && !slide.opening ? <button type="button" onClick={() => onChange(setOpening(draft, slide.questionId))}>Use as opening</button> : null}
                  <button type="button" onClick={() => onChange(moveSlide(draft, slide.id, -1))} disabled={index === 0}>Move up</button>
                  <button type="button" onClick={() => onChange(moveSlide(draft, slide.id, 1))} disabled={index === draft.slides.length - 1}>Move down</button>
                  <button type="button" onClick={() => onChange(removeSlide(draft, slide.id))} disabled={slide.kind === 'question' && questionCount <= 1}>Remove from story</button>
                </span>
              </div>
              <p className="story-source">{body}</p>
              {slide.kind === 'item' && body.length > STORY_ITEM_SLIDE_LIMIT ? <p className="angle-hint">This item is long, so the slide shows your subtitle or the artwork. The full text stays in this list.</p> : null}
              {slide.kind === 'closing' ? null : (
                <label className="story-subtitle">
                  Subtitle
                  <input value={slide.subtitle} maxLength={80} onChange={event => onChange(setSlideSubtitle(draft, slide.id, event.target.value))} placeholder="Optional short hook" />
                </label>
              )}
            </li>
          )
        })}
      </ol>
      <label className="story-subtitle">
        Closing question, optional
        <textarea value={closing && closing.kind === 'closing' ? closing.text : ''} onChange={event => onChange(setClosingQuestion(draft, event.target.value))} placeholder="Write a question for the viewer, or leave this empty" />
      </label>
      <button type="button" className="add-button story-continue" onClick={onReview}>Review story</button>
    </section>
  )
}

function ReviewStep({
  source,
  draft,
  art,
  showMark,
  questionsById,
  itemsById,
  onEdit,
  onShowMark,
  onArt,
  onGenerate,
}: {
  source: StorySource
  draft: StoryDraft
  art: Record<string, SlideArt>
  showMark: boolean
  questionsById: Map<string, StorySource['questions'][number]>
  itemsById: Map<string, StoryItem>
  onEdit: () => void
  onShowMark: (value: boolean) => void
  onArt: (slideId: string, next: SlideArt) => void
  onGenerate: (slideId: string, request: StoryImageRequest) => void
}) {
  const [index, setIndex] = useState(0)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [retryVideo, setRetryVideo] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const exportingRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])
  const slideIndex = Math.min(index, Math.max(draft.slides.length - 1, 0))
  const slide = draft.slides[slideIndex]
  if (!slide) return null
  const question = slide.kind === 'question' ? questionsById.get(slide.questionId) : null
  const item = slide.kind === 'item' ? itemsById.get(slide.itemId) : null
  const label = slide.kind === 'closing'
    ? 'Closing question'
    : slide.kind === 'item'
      ? itemHonesty(item?.kind ?? 'note')
      : slide.opening ? 'Opening question' : 'Question'
  const body = slide.kind === 'closing' ? slide.text : slide.kind === 'item' ? item?.body ?? '' : question?.text ?? ''
  const subtitle = slide.kind === 'closing' ? '' : slide.subtitle
  const current = art[slide.id] ?? { phase: 'idle' as const, accepted: null, pending: null, error: null }
  const shown = current.pending ?? current.accepted
  const request = storyImageRequest(source, slide)
  const face = slideFace(slide.kind, body, subtitle)
  const blockers = exportBlockers(draft.slides.map(entry => entry.id), id => art[id]?.phase)
  const videoTiming = storyVideoTiming(draft.slides.length)
  async function downloadVideo() {
    if (exportingRef.current) return
    exportingRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setExporting(true)
    setRetryVideo(false)
    setExportMessage('Checking the video encoder…')
    try {
      const { createStoryVideo } = await import('@/lib/stories/video')
      const file = await createStoryVideo(draft.slides.map(entry => {
        const entryBody = entry.kind === 'closing' ? entry.text : entry.kind === 'item' ? itemsById.get(entry.itemId)?.body ?? '' : questionsById.get(entry.questionId)?.text ?? ''
        const entrySubtitle = entry.kind === 'closing' ? '' : entry.subtitle
        const accepted = art[entry.id]?.accepted ?? null
        return {
          face: slideFace(entry.kind, entryBody, entrySubtitle),
          image: accepted?.blob ?? null,
          imageUrl: accepted?.url ?? null,
          fit: accepted?.fit ?? 'cover',
          showMark,
        }
      }), {
        signal: controller.signal,
        onProgress: (progress: StoryVideoProgress) => {
          if (mountedRef.current) setExportMessage(videoProgress(progress))
        },
      })
      if (!mountedRef.current || controller.signal.aborted) return
      triggerDownload(file, STORY_VIDEO_NAME)
      setExportMessage(`Download started. The file is ${STORY_VIDEO_NAME}.`)
    } catch (error) {
      if (!mountedRef.current) return
      if (controller.signal.aborted || (error instanceof StoryVideoError && error.code === 'cancelled')) {
        setExportMessage('Video creation was cancelled. The story is unchanged.')
        return
      }
      setRetryVideo(true)
      if (error instanceof StoryVideoError && error.code === 'unsupported') {
        setExportMessage('This browser cannot create an H.264 MP4 video. The story is unchanged.')
        return
      }
      if (error instanceof StoryVideoError && error.code === 'load') {
        setExportMessage('The video encoder could not be loaded. The story is unchanged.')
        return
      }
      if (error instanceof StoryVideoError && error.code === 'render') {
        setExportMessage(storyVideoFailureMessage(error))
        return
      }
      setExportMessage('The video could not be created. The story and its artwork are unchanged.')
    } finally {
      exportingRef.current = false
      if (abortRef.current === controller) abortRef.current = null
      if (mountedRef.current) setExporting(false)
    }
  }
  function startVideo() {
    if (blockers.length > 0) {
      const first = blockers[0]
      if (!first) return
      setExportMessage(`Slide ${first.index + 1} still has artwork to accept or reject.`)
      setIndex(first.index)
      return
    }
    void downloadVideo()
  }
  return (
    <section className="story-panel story-review-layout" aria-labelledby="story-review-heading">
      <h1 id="story-review-heading">Review</h1>
      <p className="story-lead">The portrait frame is the slide. Artwork is created one slide at a time, only after you confirm. Nothing is published, and the image stays in this tab.</p>
      <div className="story-review-nav">
        <button type="button" onClick={() => setIndex(slideIndex - 1)} disabled={slideIndex === 0}>Previous slide</button>
        <span>Slide {slideIndex + 1} of {draft.slides.length}</span>
        <button type="button" onClick={() => setIndex(slideIndex + 1)} disabled={slideIndex === draft.slides.length - 1}>Next slide</button>
      </div>
      <article className={`story-slide${shown?.fit === 'contain' ? ' is-contain' : ''}`} aria-label={`Slide ${slideIndex + 1}: ${label}`}>
        {shown ? <img className="story-artwork" src={shown.url} alt="" /> : null}
        {showMark ? <img className="story-mark" src="/logo-removebg-preview.png" alt="" /> : null}
        {face.hook || face.body ? <div className="story-slide-copy">{face.hook ? <p className="story-slide-hook">{face.hook}</p> : null}{face.body ? <p className="story-slide-body">{face.body}</p> : null}</div> : null}
      </article>
      {item ? <p className="story-kind-note">{itemHonesty(item.kind)}</p> : null}
      <div className="story-filmstrip" aria-label="Story slides">
        {draft.slides.map((entry, entryIndex) => (
          <button type="button" key={entry.id} aria-current={entryIndex === slideIndex ? 'true' : undefined} onClick={() => setIndex(entryIndex)}>
            {entryIndex + 1}. {slideLabel(entry, questionsById, itemsById)}
          </button>
        ))}
      </div>
      <div className="story-art-controls">
        {current.phase === 'confirm' && request ? (
          <div className="story-confirm" role="group" aria-label="Confirm artwork">
            <p>Create artwork for this slide? Curitopia sends only the words below to the OpenAI Image API. The call can use API credit. The image stays in this tab until you discard the story. Curitopia does not save it. The provider processes the request under its own terms.</p>
            <blockquote>{body}</blockquote>
            <button type="button" onClick={() => onGenerate(slide.id, request)}>Create artwork</button>
            <button type="button" onClick={() => onArt(slide.id, { ...current, phase: current.pending ? 'preview' : 'idle', error: null })}>Cancel</button>
          </div>
        ) : null}
        {current.phase === 'working' ? <p role="status">Creating artwork…</p> : null}
        {current.phase === 'error' && current.error ? <p className="composer-error" role="alert">{current.error}</p> : null}
        {current.phase === 'preview' ? (
          <div className="story-confirm">
            <p>This preview is not on the slide until you use it. Rejecting it leaves the words unchanged.</p>
            <button type="button" onClick={() => {
              if (current.accepted) URL.revokeObjectURL(current.accepted.url)
              onArt(slide.id, { phase: 'idle', accepted: current.pending, pending: null, error: null })
            }}>Use this artwork</button>
            <button type="button" onClick={() => {
              if (current.pending) URL.revokeObjectURL(current.pending.url)
              onArt(slide.id, { phase: current.accepted ? 'idle' : 'idle', accepted: current.accepted, pending: null, error: null })
            }}>Reject artwork</button>
          </div>
        ) : null}
        {!request && slide.kind === 'closing' ? <p>Write a closing question before creating artwork for it.</p> : null}
        {current.phase !== 'confirm' && current.phase !== 'working' && current.phase !== 'preview' && request ? (
          <button type="button" onClick={() => onArt(slide.id, { ...current, phase: 'confirm', error: null })}>{current.accepted ? 'Replace artwork' : 'Create artwork'}</button>
        ) : null}
        {current.accepted && current.phase !== 'working' ? (
          <button type="button" onClick={() => {
            URL.revokeObjectURL(current.accepted!.url)
            if (current.pending) URL.revokeObjectURL(current.pending.url)
            onArt(slide.id, { phase: 'idle', accepted: null, pending: null, error: null })
          }}>Remove artwork</button>
        ) : null}
        <label className="story-mark-toggle"><input type="checkbox" checked={showMark} onChange={event => onShowMark(event.target.checked)} /> Show the Curitopia mark</label>
        <p>One silent video, about {formatStoryDuration(videoTiming.seconds)}.</p>
        <button type="button" onClick={startVideo} disabled={exporting}>Download video (MP4)</button>
        {exporting ? <button type="button" onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
        {retryVideo ? <button type="button" onClick={startVideo} disabled={exporting}>Try the video again</button> : null}
      </div>
      {exportMessage ? <p className="story-export-status" role="status">{exportMessage}</p> : null}
      {blockers.length > 0 ? <p className="composer-error">Accept or reject the artwork on {blockers.map(item => `slide ${item.index + 1}`).join(', ')} before downloading.</p> : null}
      <button type="button" className="add-button story-continue" onClick={onEdit}>Back to arrange</button>
    </section>
  )
}

function videoProgress(progress: StoryVideoProgress) {
  if (progress.stage === 'encoder') return 'Checking the video encoder…'
  if (progress.stage === 'preparing') return `Preparing slide ${progress.index} of ${progress.count}…`
  if (progress.stage === 'encoding') return `Encoding video… ${progress.frame} of ${progress.frames}`
  return 'Preparing the download…'
}

function triggerDownload(file: Blob, name: string) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function slideLabel(slide: StorySlide, questionsById: Map<string, StorySource['questions'][number]>, itemsById: Map<string, StoryItem>) {
  if (slide.kind === 'closing') return 'Closing'
  if (slide.kind === 'item') return storyKindLabel(itemsById.get(slide.itemId)?.kind ?? 'note')
  return slide.opening ? 'Opening' : 'Question'
}

function itemHonesty(kind: StoryItem['kind']) {
  if (kind === 'hypothesis') return 'Hypothesis · tentative explanation'
  if (kind === 'test') return 'Test · an investigation, not a result'
  if (kind === 'observation') return 'Observation · what was recorded'
  if (kind === 'discovery') return 'Discovery · what was concluded'
  if (kind === 'concept') return 'Concept'
  return 'Note'
}

function groupItems(source: StorySource) {
  const groups = new Map<string, { key: string; label: string; items: StoryItem[] }>()
  for (const item of source.items) {
    const question = source.questions.find(entry => entry.id === item.questionId)
    const key = question?.id ?? `hidden:${item.questionId}`
    const label = question ? `From: ${question.text}` : 'From a hidden question'
    const group = groups.get(key) ?? { key, label, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}
