'use client'

import { useRef, useState } from 'react'
import type { ExplorationReflection } from '@/lib/reflection/types'
import { REFLECTION_QUESTION_LIMIT } from '@/lib/reflection/types'
import { maySendReflection, nextReflectionPhase } from '@/lib/reflection/consent'
import { reflectionQuestionSignature, reflectionViewState } from '@/lib/reflection/freshness'
import { validateReflection } from '@/lib/reflection/validate'
import type { Question } from '@/lib/explorations/types'

type Phase = 'idle' | 'confirm' | 'loading' | 'ready' | 'error'

export default function ExplorationReflection({
  explorationId,
  questions,
  visibleCount,
  saved,
  onAddQuestion,
}: {
  explorationId: string
  questions: Question[]
  visibleCount: number
  saved: boolean
  onAddQuestion: (text: string) => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [reflection, setReflection] = useState<ExplorationReflection | null>(null)
  const [basis, setBasis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [copyFailedText, setCopyFailedText] = useState<string | null>(null)
  const inFlight = useRef(false)
  const overLimit = visibleCount > REFLECTION_QUESTION_LIMIT
  const view = reflectionViewState({ reflection, basis, questions })

  async function requestReflection() {
    if (!maySendReflection(phase, { inFlight: inFlight.current, overLimit, visibleCount, saved })) return
    const sentSignature = reflectionQuestionSignature(questions)
    inFlight.current = true
    setPhase(current => nextReflectionPhase(current, 'send', reflection !== null))
    setError(null)
    try {
      const response = await fetch(`/api/explorations/${explorationId}/reflect`, { method: 'POST' })
      const body: unknown = await response.json().catch(() => null)
      const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Reflection is unavailable right now. Try again.'
      if (!response.ok) {
        setReflection(null)
        setBasis(null)
        setError(message)
        setPhase(current => nextReflectionPhase(current, 'fail', reflection !== null))
        return
      }
      const candidate = body && typeof body === 'object' && 'reflection' in body ? body.reflection : null
      const validated = validateReflection(candidate, questions.filter(question => !question.isHidden))
      if (!validated) {
        setReflection(null)
        setBasis(null)
        setError('Reflection is unavailable right now. Try again.')
        setPhase(current => nextReflectionPhase(current, 'fail', false))
        return
      }
      setReflection(validated)
      setBasis(sentSignature)
      setPhase(current => nextReflectionPhase(current, 'succeed', true))
    } catch {
      setReflection(null)
      setBasis(null)
      setError('Reflection is unavailable right now. Try again.')
      setPhase(current => nextReflectionPhase(current, 'fail', false))
    } finally {
      inFlight.current = false
    }
  }

  async function copySuggestion(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setCopyFailedText(null)
    } catch {
      setCopiedText(null)
      setCopyFailedText(text)
    }
  }

  return (
    <div className="reflection">
      <p className="reflection-label">Suggestions, not facts. This result stays on this page and is not saved.</p>
      {overLimit ? <p className="composer-error">This exploration has {visibleCount} visible questions. Reflection can read up to {REFLECTION_QUESTION_LIMIT} at once, so nothing is sent.</p> : null}
      {visibleCount === 0 ? <p className="angle-hint">There are no visible questions to reflect on.</p> : null}
      {!saved && visibleCount > 0 && !overLimit ? <p className="angle-hint">Reflection waits until this exploration has saved.</p> : null}
      {phase === 'confirm' ? (
        <div className="reflection-confirm" role="dialog" aria-labelledby="reflection-confirm-title">
          <p id="reflection-confirm-title">Send this exploration to OpenAI?</p>
          <p>Curitopia will send the visible questions from this exploration, including which ones you prioritised and any Focus perspective that inspired them. Hidden questions are not included. OpenAI suggests questions to explore next, and Curitopia does not store them. Review OpenAI&apos;s API data-handling terms before a public launch.</p>
          <div className="reflection-actions">
            <button type="button" className="reflect-secondary" onClick={() => setPhase(current => nextReflectionPhase(current, 'cancel', reflection !== null))}>Cancel</button>
            <button type="button" className="reflect-button" onClick={() => void requestReflection()}>Send visible questions</button>
          </div>
        </div>
      ) : (
        <button type="button" className="reflect-button" disabled={phase === 'loading' || overLimit || visibleCount === 0 || !saved} onClick={() => setPhase(current => nextReflectionPhase(current, 'open', reflection !== null))}>
          {phase === 'loading' ? 'Preparing a reflection…' : 'Reflect on this exploration'}
        </button>
      )}
      <div aria-live="polite" aria-busy={phase === 'loading'}>
        {phase === 'loading' ? <p className="angle-hint">Reading the visible questions. You can keep editing this exploration.</p> : null}
        {phase === 'error' && error ? (
          <div className="reflection-error" role="alert">
            <p>{error}</p>
            <button type="button" className="reflect-secondary" onClick={() => void requestReflection()}>Retry</button>
          </div>
        ) : null}
        {phase === 'ready' && view.reflection ? (
          <div className="reflection-result">
            <h2>Questions to explore next</h2>
            {view.stale ? <p className="reflection-stale" role="status">These suggestions were made for an earlier set of questions. They may not fit the questions in this exploration now.</p> : null}
            <p className="angle-hint">These questions were suggested for you. You did not write them.</p>
            {view.reflection.suggestions.length === 0 ? <p className="angle-hint">No further question was strong enough to suggest.</p> : (
              <ol className="next-questions">
                {view.reflection.suggestions.map(item => {
                  const alreadyAdded = questions.some(question => question.text === item.text)
                  return (
                    <li key={item.text}>
                      <p className="next-question">{item.text}</p>
                      <div className="suggestion-actions">
                        <button type="button" className="reflect-secondary" onClick={() => void copySuggestion(item.text)}>{copiedText === item.text ? 'Copied' : copyFailedText === item.text ? 'Could not copy' : 'Copy'}</button>
                        <button type="button" className="reflect-secondary" disabled={alreadyAdded} onClick={() => onAddQuestion(item.text)}>{alreadyAdded ? 'In this exploration' : 'Add to this exploration'}</button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
