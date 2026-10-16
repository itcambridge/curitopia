'use client'

import { Eye, FlaskConical, Gem, Lightbulb, List, Map, Sparkles, StickyNote, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { deleteExperimentItem, saveExperimentItem } from '@/lib/experiments/actions'
import { layoutConstellation, sphereLines, spherePreview } from '@/lib/experiments/constellation'
import type { ExperimentItem, LoadedExperiment } from '@/lib/experiments/load'
import { EXPERIMENT_ITEM_CHARACTER_LIMIT, experimentItemBody, experimentItemKind, experimentItemKinds, type ExperimentItemKind } from '@/lib/experiments/rules'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type View = 'map' | 'list'
type Draft = { kind: ExperimentItemKind; body: string; relatedItemId: string | null }
type Panel =
  | null
  | { mode: 'add'; draft: Draft }
  | { mode: 'view'; id: string }
  | { mode: 'edit'; id: string; draft: Draft }

const kindIcons: Record<ExperimentItemKind, LucideIcon> = {
  concept: Sparkles,
  note: StickyNote,
  hypothesis: Lightbulb,
  test: FlaskConical,
  observation: Eye,
  discovery: Gem,
}

function itemProblem(value: string) {
  if (value.trim().length < 1) return 'Write something first.'
  if (experimentItemBody(value) === null) return 'An item can be at most 2,000 characters.'
  return null
}

function kindLabel(kind: ExperimentItemKind) {
  return experimentItemKinds.find(item => item.kind === kind)?.label ?? 'Item'
}

function blankDraft(): Draft {
  return { kind: 'concept', body: '', relatedItemId: null }
}

export default function ExperimentScreen({ experiment }: { experiment: LoadedExperiment }) {
  const [items, setItems] = useState<ExperimentItem[]>(() => [...experiment.items].sort((a, b) => a.position - b.position))
  const [view, setView] = useState<View>('map')
  const [panel, setPanel] = useState<Panel>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const busyRef = useRef(false)
  const busy = saveState === 'saving'
  busyRef.current = busy
  const layout = layoutConstellation(items.map(item => ({ id: item.id, position: item.position, relatedItemId: item.relatedItemId })))
  const panelKey = panel === null ? '' : panel.mode === 'add' ? 'add' : `${panel.mode}:${panel.id}`

  useEffect(() => {
    if (!panelKey) return
    const previous = document.activeElement
    const root = panelRef.current
    const field = root?.querySelector<HTMLElement>('textarea, select, button')
    field?.focus()
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || busyRef.current) return
      event.preventDefault()
      setPanel(current => current?.mode === 'edit' ? { mode: 'view', id: current.id } : null)
      setMessage(null)
      setSaveState('idle')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [panelKey])

  function remember(item: ExperimentItem) {
    setItems(current => {
      const next = current.some(entry => entry.id === item.id)
        ? current.map(entry => entry.id === item.id ? item : entry)
        : [...current, item]
      return next.sort((a, b) => a.position - b.position)
    })
  }

  function openAdd() {
    if (busy) return
    setPanel({ mode: 'add', draft: blankDraft() })
    setMessage(null)
    setSaveState('idle')
  }

  function openItem(id: string) {
    if (busy) return
    setPanel({ mode: 'view', id })
    setMessage(null)
    setSaveState('idle')
  }

  function closePanel() {
    if (busy) return
    setPanel(current => current?.mode === 'edit' ? { mode: 'view', id: current.id } : null)
    setMessage(null)
    setSaveState('idle')
  }

  async function commitDraft(itemId: string, draft: Draft, creating: boolean) {
    const problem = itemProblem(draft.body)
    if (problem) {
      setSaveState('error')
      setMessage(problem)
      return
    }
    const chosen = experimentItemKind(draft.kind)
    if (!chosen || busy) return
    setSaveState('saving')
    setMessage(null)
    const result = await saveExperimentItem({
      explorationId: experiment.explorationId,
      experimentId: experiment.id,
      itemId,
      kind: chosen,
      body: draft.body,
      relatedItemId: draft.relatedItemId,
    })
    if (!result.ok) {
      setSaveState('error')
      setMessage('Could not save this item.')
      return
    }
    remember(result.item)
    setSaveState('saved')
    setMessage('Saved')
    setPanel(creating ? null : { mode: 'view', id: result.item.id })
  }

  async function removeItem(item: ExperimentItem) {
    if (busy) return
    if (items.some(entry => entry.relatedItemId === item.id)) {
      setSaveState('error')
      setMessage('Another thought is linked to this one. Change that link before deleting it.')
      return
    }
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
    setPanel(null)
    setSaveState('saved')
    setMessage('Deleted')
  }

  const selectedId = panel && panel.mode !== 'add' ? panel.id : null
  const draft = panel && (panel.mode === 'add' || panel.mode === 'edit') ? panel.draft : null

  function updateDraft(next: Draft) {
    setPanel(current => {
      if (!current || (current.mode !== 'add' && current.mode !== 'edit')) return current
      return { ...current, draft: next }
    })
  }

  return (
    <main className="experiment-constellation">
      <header className="experiment-toolbar">
        <a className="library-link" href={`/explorations/${experiment.explorationId}`}>Back to exploration</a>
        <div className="map-tabs" role="tablist" aria-label="Experiment views">
          <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}><Map size={17} aria-hidden="true" /> Map</button>
          <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><List size={17} aria-hidden="true" /> List</button>
        </div>
        <button type="button" className="add-button experiment-add" disabled={busy} onClick={openAdd}>+ Add thought</button>
        {message && panel === null ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
        {saveState === 'saving' && panel === null ? <p className="experiment-status" role="status">Saving</p> : null}
      </header>
      <div className="experiment-question-bar">
        <h1 id="experiment-question">{experiment.questionText}</h1>
        <p className="experiment-note">Add a concept, note, hypothesis, test, observation, or discovery whenever you want. None is required, and they do not have to follow a sequence. If a test would change a live system, follow the approval, safety, and access rules that apply where you work.</p>
      </div>
      <div className={`constellation-canvas${view === 'list' ? ' is-list' : ''}${panel ? ' has-detail' : ''}`}>
        {view === 'map' ? (
          <div className="constellation-stage">
            <svg className="constellation-lines" viewBox={`0 0 ${layout.size} ${layout.size}`} aria-hidden="true">
              {layout.rings.map(ring => <circle key={ring} cx={layout.centre.x} cy={layout.centre.y} r={ring} />)}
              {layout.links.map(link => <line key={`${link.fromId}-${link.toId}`} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} />)}
            </svg>
            <div
              className="constellation-centre"
              style={{ left: `${(layout.centre.x / layout.size) * 100}%`, top: `${(layout.centre.y / layout.size) * 100}%`, width: `${(layout.centre.radius * 2 / layout.size) * 100}%` }}
              aria-hidden="true"
            >
              <p className="constellation-preview constellation-question-excerpt">{sphereLines(experiment.questionText, 4, 18).map((line, index) => <span className="constellation-line" key={`${index}-${line}`}>{line}</span>)}</p>
            </div>
            {layout.nodes.map(node => {
              const item = items.find(entry => entry.id === node.id)
              if (!item) return null
              const Icon = kindIcons[item.kind]
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`constellation-sphere${selectedId === item.id ? ' is-selected' : ''}`}
                  data-kind={item.kind}
                  style={{ left: `${(node.x / layout.size) * 100}%`, top: `${(node.y / layout.size) * 100}%`, width: `${(node.radius * 2 / layout.size) * 100}%` }}
                  aria-label={`${kindLabel(item.kind)}: ${item.body}`}
                  aria-pressed={selectedId === item.id}
                  onClick={() => openItem(item.id)}
                >
                  <span className="constellation-mark"><Icon size={14} aria-hidden="true" /></span>
                  <span className="constellation-preview">{sphereLines(item.body).map((line, index) => <span className="constellation-line" key={`${index}-${line}`}>{line}</span>)}</span>
                </button>
              )
            })}
            {items.length === 0 ? <p className="constellation-empty">Nothing here yet. Add a thought when you are ready.</p> : null}
          </div>
        ) : (
          <ul className="experiment-list-view">
            {items.length === 0 ? <li className="experiment-note">Nothing here yet. Add a thought when you are ready.</li> : items.map(item => {
              const Icon = kindIcons[item.kind]
              return (
                <li key={item.id}>
                  <button type="button" className={`experiment-list-row${selectedId === item.id ? ' is-selected' : ''}`} aria-pressed={selectedId === item.id} onClick={() => openItem(item.id)}>
                    <Icon size={16} aria-hidden="true" />
                    <span className="constellation-kind">{kindLabel(item.kind)}</span>
                    <span>{item.body}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {panel ? (
          <aside ref={panelRef} className="experiment-detail" role="dialog" aria-modal="true" aria-labelledby="experiment-detail-title">
            <div className="experiment-detail-heading">
              <h2 id="experiment-detail-title">{panel.mode === 'add' ? 'Add thought' : panel.mode === 'edit' ? 'Edit thought' : kindLabel(items.find(item => item.id === panel.id)?.kind ?? 'concept')}</h2>
              <button type="button" className="investigate-further" onClick={closePanel} disabled={busy}>Close</button>
            </div>
            {panel.mode === 'view' ? <ItemView item={items.find(entry => entry.id === panel.id) ?? null} items={items} busy={busy} message={message} saveState={saveState} onEdit={item => setPanel({ mode: 'edit', id: item.id, draft: { kind: item.kind, body: item.body, relatedItemId: item.relatedItemId } })} onDelete={item => void removeItem(item)} /> : null}
            {draft ? (
              <ThoughtEditor
                draft={draft}
                items={items}
                selfId={panel.mode === 'edit' ? panel.id : null}
                busy={busy}
                message={message}
                saveState={saveState}
                onChange={updateDraft}
                onSave={() => {
                  if (panel.mode === 'add') void commitDraft(crypto.randomUUID(), draft, true)
                  if (panel.mode === 'edit') void commitDraft(panel.id, draft, false)
                }}
                onCancel={closePanel}
              />
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  )
}

function ItemView({ item, items, busy, message, saveState, onEdit, onDelete }: {
  item: ExperimentItem | null
  items: ExperimentItem[]
  busy: boolean
  message: string | null
  saveState: SaveState
  onEdit: (item: ExperimentItem) => void
  onDelete: (item: ExperimentItem) => void
}) {
  if (!item) return <p className="experiment-note">This thought is no longer in the experiment.</p>
  const related = item.relatedItemId ? items.find(entry => entry.id === item.relatedItemId) : null
  return (
    <>
      <p className="experiment-detail-body">{item.body}</p>
      {related ? <p className="experiment-note">Linked to {kindLabel(related.kind)}: {spherePreview(related.body, 80)}</p> : null}
      {message ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
      {saveState === 'saving' ? <p className="experiment-status" role="status">Saving</p> : null}
      <div className="experiment-item-actions">
        <button type="button" className="investigate-further" disabled={busy} onClick={() => onEdit(item)}>Edit <span className="sr-only">{kindLabel(item.kind)}</span></button>
        <button type="button" className="investigate-further" disabled={busy} onClick={() => onDelete(item)}>Delete <span className="sr-only">{kindLabel(item.kind)}</span></button>
      </div>
    </>
  )
}

function ThoughtEditor({ draft, items, selfId, busy, message, saveState, onChange, onSave, onCancel }: {
  draft: Draft
  items: ExperimentItem[]
  selfId: string | null
  busy: boolean
  message: string | null
  saveState: SaveState
  onChange: (draft: Draft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const choices = items.filter(item => item.id !== selfId)
  return (
    <div className="experiment-editor">
      <label className="experiment-field">
        <span>Type</span>
        <select className="experiment-kind" value={draft.kind} disabled={busy} onChange={event => { const next = experimentItemKind(event.target.value); if (next) onChange({ ...draft, kind: next }) }}>
          {experimentItemKinds.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
        </select>
      </label>
      <label className="experiment-field">
        <span>Text</span>
        <textarea value={draft.body} disabled={busy} aria-label="Item text" aria-invalid={message === 'Write something first.' || message === 'An item can be at most 2,000 characters.' ? true : undefined} placeholder="Write a concept, note, hypothesis, test, observation, or discovery" onChange={event => onChange({ ...draft, body: event.target.value })} />
      </label>
      <label className="experiment-field">
        <span>Related to</span>
        <select className="experiment-kind" aria-label="Related to" value={draft.relatedItemId ?? ''} disabled={busy} onChange={event => onChange({ ...draft, relatedItemId: event.target.value || null })}>
          <option value="">The question</option>
          {choices.map(item => <option key={item.id} value={item.id}>{kindLabel(item.kind)}: {spherePreview(item.body, 48)}</option>)}
        </select>
      </label>
      <p className="experiment-count">{draft.body.trim().length} / {EXPERIMENT_ITEM_CHARACTER_LIMIT}</p>
      {message ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
      {saveState === 'saving' ? <p className="experiment-status" role="status">Saving</p> : null}
      <div className="experiment-item-actions">
        <button type="button" className="add-button experiment-save" disabled={busy} onClick={onSave}>Save</button>
        <button type="button" className="investigate-further" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
