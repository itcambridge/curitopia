'use client'

import { useRef, useState } from 'react'
import { Eye, EyeOff, Image as ImageIcon, RotateCcw, Sun, SunDim } from 'lucide-react'
import { maySubmitFocusPrompt, suggestedFocusPrompt } from '@/lib/focus-image/prompt'

type Phase = 'closed' | 'edit' | 'working' | 'preview' | 'error'

type Preview = { pendingPath: string; contentType: string; preview: string }

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  return fallback
}

export default function FocusImageControl({
  explorationId,
  saved,
  anchorQuestion,
  hasImage,
  hidden,
  dimmed,
  broken,
  onUse,
  onRemove,
  onToggleHidden,
  onToggleDimmed,
  onRetryImage,
}: {
  explorationId: string | null
  saved: boolean
  anchorQuestion: string
  hasImage: boolean
  hidden: boolean
  dimmed: boolean
  broken: boolean
  onUse: () => void
  onRemove: () => void
  onToggleHidden: () => void
  onToggleDimmed: () => void
  onRetryImage: () => void
}) {
  const [phase, setPhase] = useState<Phase>('closed')
  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workingLabel, setWorkingLabel] = useState('Working…')
  const inFlight = useRef(false)
  const ready = Boolean(explorationId) && saved

  async function discard(pendingPath: string | undefined) {
    if (!explorationId || !pendingPath) return
    await fetch(`/api/explorations/${explorationId}/focus-image`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'discard', pendingPath }),
    }).catch(() => null)
  }

  function closePanel() {
    const pending = preview?.pendingPath
    setPhase('closed')
    setPreview(null)
    setError(null)
    if (pending) void discard(pending)
  }

  function openPanel() {
    if (!ready || inFlight.current) return
    setPrompt(current => current.trim() ? current : suggestedFocusPrompt(anchorQuestion))
    setPreview(null)
    setError(null)
    setPhase('edit')
  }

  async function generate() {
    if (!explorationId || !maySubmitFocusPrompt({ confirmed: true, inFlight: inFlight.current, prompt })) return
    inFlight.current = true
    setPhase('working')
    setWorkingLabel('Creating an image…')
    setError(null)
    try {
      const response = await fetch(`/api/explorations/${explorationId}/focus-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: prompt.trim() }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok || !body || typeof body !== 'object' || !('preview' in body) || !('pendingPath' in body) || !('contentType' in body)) {
        setError(errorMessage(body, 'The focus image is unavailable right now. Try again.'))
        setPhase('error')
        return
      }
      const next = body as Preview
      if (typeof next.preview !== 'string' || typeof next.pendingPath !== 'string' || typeof next.contentType !== 'string') {
        setError('The focus image is unavailable right now. Try again.')
        setPhase('error')
        return
      }
      setPreview(next)
      setPhase('preview')
    } catch {
      setError('The focus image is unavailable right now. Try again.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  async function upload(file: File | undefined) {
    if (!explorationId || !file || inFlight.current) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Use a JPEG, PNG, or WebP image up to 5 MB.')
      setPhase('error')
      return
    }
    inFlight.current = true
    setPhase('working')
    setWorkingLabel('Uploading…')
    setError(null)
    try {
      const form = new FormData()
      form.set('image', file)
      const response = await fetch(`/api/explorations/${explorationId}/focus-image`, { method: 'POST', body: form })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok || !body || typeof body !== 'object' || !('preview' in body)) {
        setError(errorMessage(body, 'The focus image is unavailable right now. Try again.'))
        setPhase('error')
        return
      }
      const next = body as Preview
      if (typeof next.preview !== 'string' || typeof next.pendingPath !== 'string' || typeof next.contentType !== 'string') {
        setError('The focus image is unavailable right now. Try again.')
        setPhase('error')
        return
      }
      setPreview(next)
      setPhase('preview')
    } catch {
      setError('The focus image is unavailable right now. Try again.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  async function useImage() {
    if (!explorationId || !preview || inFlight.current) return
    inFlight.current = true
    setPhase('working')
    setWorkingLabel('Saving the image…')
    setError(null)
    try {
      const response = await fetch(`/api/explorations/${explorationId}/focus-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'commit', pendingPath: preview.pendingPath }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setError(errorMessage(body, 'The image could not be saved. The current image is unchanged.'))
        setPhase('preview')
        return
      }
      setPreview(null)
      setPhase('closed')
      onUse()
    } catch {
      setError('The image could not be saved. The current image is unchanged.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  async function removeImage() {
    if (!explorationId || inFlight.current) return
    inFlight.current = true
    setPhase('working')
    setWorkingLabel('Removing the image…')
    setError(null)
    try {
      const response = await fetch(`/api/explorations/${explorationId}/focus-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setError(errorMessage(body, 'The focus image is unavailable right now. Try again.'))
        setPhase('error')
        return
      }
      setPreview(null)
      setPhase('closed')
      onRemove()
    } catch {
      setError('The focus image is unavailable right now. Try again.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="focus-image-control">
      {phase !== 'closed' ? (
        <div className="focus-image-panel" role="dialog" aria-labelledby="focus-image-title">
          <h2 id="focus-image-title">Focus image</h2>
          <p>A personal background for this exploration. The question map stays in front.</p>
          {phase === 'working' ? <p className="angle-hint">{workingLabel}</p> : null}
          {error ? <p className="composer-error" role="alert">{error}</p> : null}
          {phase === 'preview' && preview ? (
            <>
              <img className="focus-image-preview" alt="Proposed focus image" src={`data:${preview.contentType};base64,${preview.preview}`} />
              <div className="reflection-actions">
                <button type="button" className="reflect-button" onClick={() => void useImage()}>Use image</button>
                <button type="button" className="reflect-secondary" onClick={() => { void discard(preview.pendingPath); setPreview(null); setPhase('edit') }}>Choose another</button>
              </div>
            </>
          ) : phase !== 'working' ? (
            <>
              <label className="focus-image-label" htmlFor="focus-image-prompt">Image prompt</label>
              <textarea id="focus-image-prompt" value={prompt} maxLength={1000} onChange={event => setPrompt(event.target.value)} />
              <p className="angle-hint">Generate sends this prompt to OpenAI. It does not send your other questions. API usage may incur a cost.</p>
              <div className="reflection-actions">
                <button type="button" className="reflect-button" disabled={!maySubmitFocusPrompt({ confirmed: true, inFlight: false, prompt })} onClick={() => void generate()}>Generate</button>
                <label className="reflect-secondary focus-image-upload">Upload an image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file) }} /></label>
              </div>
              {hasImage ? <button type="button" className="reflect-secondary" onClick={() => void removeImage()}>Remove image</button> : null}
              <button type="button" className="reflect-secondary" onClick={closePanel}>Cancel</button>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="focus-image-actions" role="group" aria-label="Focus image">
        <button type="button" className="focus-image-button" disabled={!ready || phase === 'working'} aria-expanded={phase !== 'closed'} aria-label="Focus image" title="Focus image" onClick={() => phase === 'closed' ? openPanel() : closePanel()}><ImageIcon size={18} aria-hidden="true" /></button>
        {hasImage ? <button type="button" className="focus-image-button" aria-pressed={hidden} aria-label={hidden ? 'Show image' : 'Hide image'} title={hidden ? 'Show image' : 'Hide image'} onClick={onToggleHidden}>{hidden ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}</button> : null}
        {hasImage && !hidden ? <button type="button" className="focus-image-button" aria-pressed={dimmed} aria-label={dimmed ? 'Less dim' : 'Dim image'} title={dimmed ? 'Less dim' : 'Dim image'} onClick={onToggleDimmed}>{dimmed ? <Sun size={18} aria-hidden="true" /> : <SunDim size={18} aria-hidden="true" />}</button> : null}
        {broken && hasImage ? <button type="button" className="focus-image-button" aria-label="Try loading the image again" title="Try loading the image again" onClick={onRetryImage}><RotateCcw size={18} aria-hidden="true" /></button> : null}
      </div>
    </div>
  )
}
