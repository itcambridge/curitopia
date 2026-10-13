'use client'

import { useRef, useState } from 'react'
import type { ExplorationReflection } from '@/lib/reflection/types'
import { REFLECTION_QUESTION_LIMIT } from '@/lib/reflection/types'
import { maySendReflection, nextReflectionPhase } from '@/lib/reflection/consent'
import { validateReflection } from '@/lib/reflection/validate'
import type { Question } from '@/lib/explorations/types'

type Phase = 'idle' | 'confirm' | 'loading' | 'ready' | 'error'

export default function ExplorationReflection({
  explorationId,
  questions,
  visibleCount,
  saved,
  onSelect,
}: {
  explorationId: string
  questions: Question[]
  visibleCount: number
  saved: boolean
  onSelect: (questionId: string) => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [reflection, setReflection] = useState<ExplorationReflection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const overLimit = visibleCount > REFLECTION_QUESTION_LIMIT
  const questionById = new Map(questions.map(question => [question.id, question]))

  async function requestReflection() {
    if (!maySendReflection(phase, { inFlight: inFlight.current, overLimit, visibleCount, saved })) return
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
        setError(message)
        setPhase(current => nextReflectionPhase(current, 'fail', reflection !== null))
        return
      }
      const candidate = body && typeof body === 'object' && 'reflection' in body ? body.reflection : null
      const validated = validateReflection(candidate, questions.filter(question => !question.isHidden))
      if (!validated) {
        setReflection(null)
        setError('Reflection is unavailable right now. Try again.')
        setPhase(current => nextReflectionPhase(current, 'fail', false))
        return
      }
      setReflection(validated)
      setPhase(current => nextReflectionPhase(current, 'succeed', true))
    } catch {
      setReflection(null)
      setError('Reflection is unavailable right now. Try again.')
      setPhase(current => nextReflectionPhase(current, 'fail', false))
    } finally {
      inFlight.current = false
    }
  }

  function questionButton(id: string) {
    const question = questionById.get(id)
    if (!question) return null
    return (
      <button type="button" className="reflection-question" onClick={() => onSelect(id)}>
        {question.text}
      </button>
    )
  }

  return (
    <div className="reflection">
      <p className="reflection-label">Suggestions, not facts. This result stays on this page and is not saved.</p>
      {overLimit ? <p className="composer-error">This exploration has {visibleCount} visible questions. Reflection can read up to {REFLECTION_QUESTION_LIMIT} at once, so nothing is sent.</p> : null}
      {visibleCount === 0 ? <p className="angle-hint">There are no visible questions to reflect on.</p> : null}
      {!saved && visibleCount > 0 && !overLimit ? <p className="angle-hint">Reflection waits until this session has saved.</p> : null}
      {phase === 'confirm' ? (
        <div className="reflection-confirm" role="dialog" aria-labelledby="reflection-confirm-title">
          <p id="reflection-confirm-title">Send this exploration to OpenAI?</p>
          <p>Curitopia will send the visible questions from this exploration, including which ones you prioritised and any Focus perspective that inspired them. Hidden questions are not included. OpenAI generates a reflection and Curitopia does not store it. Review OpenAI&apos;s API data-handling terms before a public launch.</p>
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
        {phase === 'loading' ? <p className="angle-hint">Reading the visible questions. The rest of this session stays available.</p> : null}
        {phase === 'error' && error ? (
          <div className="reflection-error" role="alert">
            <p>{error}</p>
            <button type="button" className="reflect-secondary" onClick={() => void requestReflection()}>Retry</button>
          </div>
        ) : null}
        {phase === 'ready' && reflection ? (
          <div className="reflection-result">
            <h2>Reflection</h2>
            <p>{reflection.overview}</p>
            <h3>Themes</h3>
            {reflection.themes.length === 0 ? <p className="angle-hint">No recurring theme was strong enough to suggest.</p> : (
              <ul>
                {reflection.themes.map(theme => (
                  <li key={theme.title}>
                    <strong>{theme.title}</strong>
                    <p>{theme.explanation}</p>
                    <div className="reflection-links">{theme.questionIds.map(id => <span key={id}>{questionButton(id)}</span>)}</div>
                  </li>
                ))}
              </ul>
            )}
            <h3>Connections</h3>
            {reflection.connections.length === 0 ? <p className="angle-hint">No connection was strong enough to suggest.</p> : (
              <ul>
                {reflection.connections.map(item => (
                  <li key={`${item.support}-${item.connection}`}>
                    <strong>{item.support === 'supported' ? 'Pattern in these questions' : 'Possible connection'}</strong>
                    <p>{item.connection}</p>
                    <p>{item.explanation}</p>
                    <div className="reflection-links">{item.questionIds.map(id => <span key={id}>{questionButton(id)}</span>)}</div>
                  </li>
                ))}
              </ul>
            )}
            <h3>Questions you prioritised</h3>
            <p>{reflection.prioritised.summary}</p>
            {reflection.prioritised.observations.length > 0 ? (
              <ul>
                {reflection.prioritised.observations.map(item => (
                  <li key={item.questionId}>
                    {questionButton(item.questionId)}
                    <p>{item.note}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <h3>Further questions to consider</h3>
            <p className="angle-hint">These questions were suggested for you. You did not write them.</p>
            {reflection.furtherQuestions.length === 0 ? <p className="angle-hint">No further question was suggested.</p> : (
              <ul>
                {reflection.furtherQuestions.map(item => <li key={item.text}>{item.text}</li>)}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
