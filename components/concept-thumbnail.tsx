'use client'

import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const imageDisclosure = 'The prompt below is sent to OpenAI. Generating an image can use API credit. An upload is not sent.'
import { editThumbnailPrompt, maySubmitConceptPrompt, nextThumbnailPrompt, suggestedConceptPrompt, type ThumbnailPromptState } from '@/lib/experiments/thumbnail-prompt'
import { THUMBNAIL_MAX_BYTES, THUMBNAIL_SOURCE_MAX_BYTES, THUMBNAIL_TARGET_BYTES, isThumbnailSource } from '@/lib/experiments/thumbnail'

type Phase = 'closed' | 'edit' | 'working' | 'preview' | 'ready' | 'error'

export async function storeConceptThumbnail(explorationId: string, experimentId: string, itemId: string, file: Blob): Promise<string | null> {
  const form = new FormData()
  form.set('image', new File([file], 'thumbnail.webp', { type: 'image/webp' }))
  const response = await fetch(`/api/explorations/${explorationId}/experiments/${experimentId}/items/${itemId}/thumbnail`, { method: 'POST', body: form })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok || !body || typeof body !== 'object' || !('imagePath' in body) || typeof body.imagePath !== 'string') return null
  return body.imagePath
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  return fallback
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error('thumbnail'))
      else resolve(blob)
    }, 'image/webp', quality)
  })
}

/** Centre-crops a JPEG, PNG, or WebP into a 256 pixel WebP. The original is not kept. */
export async function makeConceptThumbnail(source: Blob): Promise<Blob> {
  if (source.size < 1 || source.size > THUMBNAIL_SOURCE_MAX_BYTES) throw new Error('size')
  const bytes = new Uint8Array(await source.arrayBuffer())
  if (!isThumbnailSource(bytes)) throw new Error('type')
  const bitmap = await createImageBitmap(new Blob([bytes]))
  try {
    const side = 256
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    const scale = Math.max(side / bitmap.width, side / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    context.drawImage(bitmap, (side - width) / 2, (side - height) / 2, width, height)
    let quality = 0.82
    let blob = await canvasBlob(canvas, quality)
    while (blob.size > THUMBNAIL_TARGET_BYTES && quality > 0.45) {
      quality = Math.round((quality - 0.08) * 100) / 100
      blob = await canvasBlob(canvas, quality)
    }
    if (blob.size > THUMBNAIL_MAX_BYTES) throw new Error('thumbnail')
    return blob
  } finally {
    bitmap.close()
  }
}

export default function ConceptThumbnail({
  explorationId,
  experimentId,
  itemId,
  kind,
  body,
  imagePath,
  version,
  onChange,
  startOpen = false,
  deferSave = false,
  onPrepared,
}: {
  explorationId: string
  experimentId: string
  itemId: string
  kind: string
  body: string
  imagePath: string | null
  version: number
  onChange: (imagePath: string | null) => void
  startOpen?: boolean
  deferSave?: boolean
  onPrepared?: (file: Blob | null) => void
}) {
  const [phase, setPhase] = useState<Phase>(startOpen ? 'edit' : 'closed')
  const [promptState, setPromptState] = useState<ThumbnailPromptState>(() => ({ itemId, kind, body, prompt: suggestedConceptPrompt(body, kind), customized: false }))
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)
  const itemSeen = useRef(itemId)
  const itemIdRef = useRef(itemId)
  itemIdRef.current = itemId
  const inFlight = useRef(false)
  const prompt = promptState.prompt

  useEffect(() => {
    const changedItem = itemSeen.current !== itemId
    itemSeen.current = itemId
    if (changedItem) {
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      setPreviewFile(null)
      setError(null)
      setBroken(false)
      setPhase(startOpen ? 'edit' : 'closed')
    }
    setPromptState(current => nextThumbnailPrompt(current, { itemId, kind, body }))
  }, [itemId, kind, body, startOpen])
  const savedUrl = `/api/explorations/${explorationId}/experiments/${experimentId}/items/${itemId}/thumbnail?v=${version}`

  function clearPreview() {
    setPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setPreviewFile(null)
  }

  function closeEditor() {
    clearPreview()
    onPrepared?.(null)
    setError(null)
    setPhase('closed')
  }

  function openEditor() {
    if (inFlight.current) return
    setPromptState(current => current.customized && current.prompt.trim() ? current : { ...current, prompt: suggestedConceptPrompt(body, kind), customized: false })
    clearPreview()
    setError(null)
    setPhase('edit')
  }

  function showPreview(blob: Blob) {
    clearPreview()
    setPreviewFile(blob)
    setPreviewUrl(URL.createObjectURL(blob))
    setPhase('preview')
  }

  async function chooseFile(file: File | undefined) {
    if (!file || inFlight.current) return
    setError(null)
    setPhase('working')
    try {
      showPreview(await makeConceptThumbnail(file))
    } catch {
      setError('Use a JPEG, PNG, or WebP image up to 5 MB.')
      setPhase('error')
    }
  }

  async function generate() {
    const submitted = prompt.trim()
    const targetId = itemIdRef.current
    if (inFlight.current || !maySubmitConceptPrompt({ confirmed: true, inFlight: false, prompt: submitted, kind })) return
    inFlight.current = true
    setPhase('working')
    setError(null)
    try {
      const response = await fetch(`/api/explorations/${explorationId}/experiments/${experimentId}/items/${targetId}/thumbnail`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: submitted }),
      })
      const bodyJson: unknown = await response.json().catch(() => null)
      if (!response.ok || !bodyJson || typeof bodyJson !== 'object' || !('preview' in bodyJson) || typeof bodyJson.preview !== 'string') {
        setError(errorMessage(bodyJson, 'The image could not be created. Try again.'))
        setPhase('error')
        return
      }
      if (itemIdRef.current !== targetId) return
      const binary = Uint8Array.from(atob(bodyJson.preview), char => char.charCodeAt(0))
      showPreview(await makeConceptThumbnail(new Blob([binary], { type: 'image/webp' })))
    } catch {
      setError('The image could not be created. Try again.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  async function useImage() {
    if (!previewFile || inFlight.current) return
    if (deferSave) {
      onPrepared?.(previewFile)
      setPhase('ready')
      setError(null)
      return
    }
    inFlight.current = true
    setPhase('working')
    setError(null)
    try {
      const imagePath = await storeConceptThumbnail(explorationId, experimentId, itemId, previewFile)
      if (!imagePath) {
        setError('The image could not be saved. The current image is unchanged.')
        setPhase('preview')
        return
      }
      clearPreview()
      setBroken(false)
      setPhase('closed')
      onChange(imagePath)
    } catch {
      setError('The image could not be saved. The current image is unchanged.')
      setPhase('preview')
    } finally {
      inFlight.current = false
    }
  }

  async function removeImage() {
    if (inFlight.current) return
    inFlight.current = true
    setPhase('working')
    setError(null)
    try {
      const response = await fetch(`/api/explorations/${explorationId}/experiments/${experimentId}/items/${itemId}/thumbnail`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      })
      const bodyJson: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setError(errorMessage(bodyJson, 'The image could not be saved. The current image is unchanged.'))
        setPhase('error')
        return
      }
      clearPreview()
      setBroken(false)
      setPhase('closed')
      onChange(null)
    } catch {
      setError('The image could not be saved. The current image is unchanged.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="concept-thumbnail">
      <p className="concept-thumbnail-label">Image</p>
      {imagePath && !broken ? <img className="concept-thumbnail-saved" alt="Concept thumbnail" width={96} height={96} src={savedUrl} onError={() => setBroken(true)} /> : null}
      {phase === 'ready' && previewUrl ? <img className="concept-thumbnail-saved" alt="Thumbnail preview" width={96} height={96} src={previewUrl} /> : null}
      {phase === 'ready' ? <p className="experiment-note">This image will be added when you save the concept.</p> : null}
      {phase === 'closed' || phase === 'ready' ? (
        <div className="experiment-item-actions">
          <button type="button" className="add-button experiment-save" onClick={openEditor}>{(imagePath && !broken) || phase === 'ready' ? 'Replace image' : 'Add image'}</button>
          {imagePath && !broken ? <button type="button" className="investigate-further" onClick={() => void removeImage()}>Remove image</button> : null}
          {phase === 'ready' ? <button type="button" className="investigate-further" onClick={closeEditor}>Remove image</button> : null}
        </div>
      ) : null}
      {phase === 'edit' || phase === 'working' || phase === 'preview' || phase === 'error' ? (
        <div className="concept-thumbnail-editor">
          {previewUrl ? <img className="concept-thumbnail-saved" alt="Thumbnail preview" width={96} height={96} src={previewUrl} /> : null}
          {phase !== 'preview' ? (
            <>
              <input className="experiment-kind" type="file" aria-label="Upload image" accept="image/jpeg,image/png,image/webp" disabled={phase === 'working'} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void chooseFile(file) }} />
              <div className="experiment-prompt-row">
                <span>Prompt</span>
                <button type="button" className="experiment-info" aria-label={imageDisclosure} data-tip={imageDisclosure}><Info size={15} aria-hidden="true" /></button>
              </div>
              <textarea aria-label="Thumbnail prompt" value={prompt} disabled={phase === 'working'} onChange={event => setPromptState(current => editThumbnailPrompt(current, event.target.value))} />
              <div className="experiment-item-actions">
                <button type="button" className="investigate-further" disabled={phase === 'working' || !maySubmitConceptPrompt({ confirmed: true, inFlight: false, prompt, kind })} onClick={() => void generate()}>Generate</button>
                <button type="button" className="investigate-further" disabled={phase === 'working'} onClick={closeEditor}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="experiment-item-actions">
              <button type="button" className="add-button experiment-save" onClick={() => void useImage()}>Use image</button>
              <button type="button" className="investigate-further" onClick={closeEditor}>Cancel</button>
            </div>
          )}
          {phase === 'working' ? <p className="experiment-status" role="status">Working</p> : null}
          {error ? <p className="composer-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
