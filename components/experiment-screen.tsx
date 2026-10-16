'use client'

import { FormEvent, useState } from 'react'
import { colourFromQuestionId } from '@/lib/explorations/colour'
import { deleteExperimentItem, saveExperimentItem } from '@/lib/experiments/actions'
import type { ExperimentItem, LoadedExperiment } from '@/lib/experiments/load'
import { EXPERIMENT_ITEM_CHARACTER_LIMIT, experimentItemBody, experimentItemKind, experimentItemKinds, type ExperimentItemKind } from '@/lib/experiments/rules'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function itemProblem(value: string) {
  if (value.trim().length < 1) return 'Write something first.'
  if (experimentItemBody(value) === null) return 'An item can be at most 2,000 characters.'
  return null
}

function kindLabel(kind: ExperimentItemKind) {
  return experimentItemKinds.find(item => item.kind === kind)?.label ?? 'Item'
}

export default function ExperimentScreen({ experiment }: { experiment: LoadedExperiment }) {
  const [items, setItems] = useState<ExperimentItem[]>(() => [...experiment.items].sort((a, b) => a.position - b.position))
  const [kind, setKind] = useState<ExperimentItemKind>('concept')
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKind, setEditKind] = useState<ExperimentItemKind>('concept')
  const [editBody, setEditBody] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const busy = saveState === 'saving'

  function remember(item: ExperimentItem) {
    setItems(current => {
      const next = current.some(entry => entry.id === item.id)
        ? current.map(entry => entry.id === item.id ? item : entry)
        : [...current, item]
      return next.sort((a, b) => a.position - b.position)
    })
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = itemProblem(draft)
    if (problem) {
      setSaveState('error')
      setMessage(problem)
      return
    }
    const chosen = experimentItemKind(kind)
    if (!chosen || busy) return
    setSaveState('saving')
    setMessage(null)
    const result = await saveExperimentItem({
      explorationId: experiment.explorationId,
      experimentId: experiment.id,
      itemId: crypto.randomUUID(),
      kind: chosen,
      body: draft,
    })
    if (!result.ok) {
      setSaveState('error')
      setMessage('Could not save this item.')
      return
    }
    remember(result.item)
    setDraft('')
    setSaveState('saved')
    setMessage('Saved')
  }

  function beginEdit(item: ExperimentItem) {
    if (busy) return
    setEditingId(item.id)
    setEditKind(item.kind)
    setEditBody(item.body)
    setMessage(null)
    setSaveState('idle')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
    setMessage(null)
    setSaveState('idle')
  }

  async function commitEdit(itemId: string) {
    const problem = itemProblem(editBody)
    if (problem) {
      setSaveState('error')
      setMessage(problem)
      return
    }
    const chosen = experimentItemKind(editKind)
    if (!chosen || busy) return
    setSaveState('saving')
    setMessage(null)
    const result = await saveExperimentItem({
      explorationId: experiment.explorationId,
      experimentId: experiment.id,
      itemId,
      kind: chosen,
      body: editBody,
    })
    if (!result.ok) {
      setSaveState('error')
      setMessage('Could not save this item.')
      return
    }
    remember(result.item)
    setEditingId(null)
    setSaveState('saved')
    setMessage('Saved')
  }

  async function removeItem(item: ExperimentItem) {
    if (busy) return
    if (!window.confirm('Delete this item? The experiment and the original question stay.')) return
    setSaveState('saving')
    setMessage(null)
    const result = await deleteExperimentItem({
      explorationId: experiment.explorationId,
      experimentId: experiment.id,
      itemId: item.id,
    })
    if (!result.ok) {
      setSaveState('error')
      setMessage('Could not delete this item.')
      return
    }
    setItems(current => current.filter(entry => entry.id !== item.id))
    if (editingId === item.id) setEditingId(null)
    setSaveState('saved')
    setMessage('Deleted')
  }

  return (
    <main className="experiment-shell">
      <a className="library-link" href={`/explorations/${experiment.explorationId}`}>Back to exploration</a>
      <section className="experiment-centre" aria-labelledby="experiment-question">
        <p>This question is the centre of the experiment.</p>
        <h1 id="experiment-question">{experiment.questionText}</h1>
      </section>
      <section className="experiment-work" aria-labelledby="experiment-thinking">
        <h2 id="experiment-thinking">Your thinking</h2>
        <p className="experiment-note">Add a concept, note, hypothesis, test, observation, or discovery whenever you want. None is required, and they do not have to follow a sequence.</p>
        <p className="experiment-note">A test can be reading, looking, or trying an idea in a low-risk way. If it would change a live system, follow the approval, safety, and access rules that apply where you work.</p>
        {items.length === 0 ? <p className="experiment-note">Nothing here yet. Add a thought when you are ready.</p> : (
          <ul className="experiment-list">
            {items.map(item => {
              const editing = editingId === item.id
              return (
                <li key={item.id} className="experiment-item">
                  <div className="experiment-item-kind"><span className="experiment-swatch" style={{ background: colourFromQuestionId(item.id) }} aria-hidden="true" />{kindLabel(item.kind)}</div>
                  {editing ? (
                    <div className="experiment-editor">
                      <label className="experiment-field">
                        <span>Type</span>
                        <select className="experiment-kind" value={editKind} disabled={busy} onChange={event => { const next = experimentItemKind(event.target.value); if (next) setEditKind(next) }}>
                          {experimentItemKinds.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="experiment-field">
                        <span>Text</span>
                        <textarea value={editBody} disabled={busy} aria-invalid={message === 'Write something first.' || message === 'An item can be at most 2,000 characters.' ? true : undefined} onChange={event => setEditBody(event.target.value)} />
                      </label>
                      <p className="experiment-count">{editBody.trim().length} / {EXPERIMENT_ITEM_CHARACTER_LIMIT}</p>
                      {message ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
                      {saveState === 'saving' ? <p className="experiment-status" role="status">Saving</p> : null}
                      <div className="experiment-item-actions">
                        <button type="button" className="add-button experiment-save" disabled={busy} onClick={() => void commitEdit(item.id)}>Save</button>
                        <button type="button" className="investigate-further" disabled={busy} onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{item.body}</p>
                      <div className="experiment-item-actions">
                        <button type="button" className="investigate-further" disabled={busy} onClick={() => beginEdit(item)}>Edit <span className="sr-only">{kindLabel(item.kind)}</span></button>
                        <button type="button" className="investigate-further" disabled={busy} onClick={() => void removeItem(item)}>Delete <span className="sr-only">{kindLabel(item.kind)}</span></button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <form className="experiment-form" onSubmit={event => void addItem(event)}>
          <label className="experiment-field">
            <span>Add</span>
            <select className="experiment-kind" aria-label="Item type" value={kind} disabled={busy || editingId !== null} onChange={event => { const next = experimentItemKind(event.target.value); if (next) setKind(next) }}>
              {experimentItemKinds.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
            </select>
          </label>
          <label className="experiment-field">
            <span className="sr-only">Item text</span>
            <textarea value={draft} disabled={busy || editingId !== null} aria-label="Item text" placeholder="Write a concept, note, hypothesis, test, observation, or discovery" onChange={event => { setDraft(event.target.value); if (saveState === 'error') setMessage(null) }} />
          </label>
          <p className="experiment-count">{draft.trim().length} / {EXPERIMENT_ITEM_CHARACTER_LIMIT}</p>
          {!editingId && message ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
          {!editingId && saveState === 'saving' ? <p className="experiment-status" role="status">Saving</p> : null}
          <button className="add-button" type="submit" disabled={busy || editingId !== null}>Add</button>
        </form>
      </section>
    </main>
  )
}
