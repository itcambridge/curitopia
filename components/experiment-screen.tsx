'use client'

import { Eye, FlaskConical, Gem, Lightbulb, List, Map, Sparkles, StickyNote, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ConceptThumbnail, { storeConceptThumbnail } from '@/components/concept-thumbnail'
import { deleteExperimentItem, saveExperimentItem } from '@/lib/experiments/actions'
import { layoutConstellation, sphereLines, spherePreview } from '@/lib/experiments/constellation'
import type { ExperimentItem, LoadedExperiment } from '@/lib/experiments/load'
import { EXPERIMENT_ITEM_CHARACTER_LIMIT, experimentItemBody, experimentItemKind, experimentItemKinds, type ExperimentItemKind } from '@/lib/experiments/rules'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type View = 'map' | 'list'
type Draft = { kind: ExperimentItemKind; body: string; relatedItemId: string | null }
type Panel =
  | null
  | { mode: 'add'; draft: Draft; itemId: string }
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
  const [thumbVersions, setThumbVersions] = useState<Record<string, number>>({})
  const [pendingThumbnail, setPendingThumbnail] = useState<Blob | null>(null)
  const [focusHidden, setFocusHidden] = useState(false)
  const [focusDimmed, setFocusDimmed] = useState(false)
  const [focusBroken, setFocusBroken] = useState(false)
  const [focusVersion, setFocusVersion] = useState(0)
  const showFocusImage = experiment.hasFocusImage && !focusHidden && !focusBroken
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

  function remember(item: Omit<ExperimentItem, 'imagePath'> & { imagePath?: string | null }) {
    setItems(current => {
      const previous = current.find(entry => entry.id === item.id)
      const nextItem = { ...item, imagePath: item.imagePath === undefined ? (previous?.imagePath ?? null) : item.imagePath }
      const next = previous
        ? current.map(entry => entry.id === item.id ? nextItem : entry)
        : [...current, nextItem]
      return next.sort((a, b) => a.position - b.position)
    })
  }

  function setThumbnail(itemId: string, imagePath: string | null) {
    setItems(current => current.map(entry => entry.id === itemId ? { ...entry, imagePath } : entry))
    setThumbVersions(current => ({ ...current, [itemId]: (current[itemId] ?? 0) + 1 }))
  }

  function openAdd() {
    if (busy) return
    setPendingThumbnail(null)
    setPanel({ mode: 'add', draft: blankDraft(), itemId: crypto.randomUUID() })
    setMessage(null)
    setSaveState('idle')
  }

  function openItem(id: string) {
    if (busy) return
    setPendingThumbnail(null)
    setPanel({ mode: 'view', id })
    setMessage(null)
    setSaveState('idle')
  }

  function closePanel() {
    if (busy) return
    setPendingThumbnail(null)
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
    const prepared = pendingThumbnail
    setPendingThumbnail(null)
    let notice = 'Saved'
    if (creating && prepared) {
      const imagePath = await storeConceptThumbnail(experiment.explorationId, experiment.id, result.item.id, prepared)
      if (imagePath) setThumbnail(result.item.id, imagePath)
      else notice = 'The item was saved, but the image could not be saved.'
    }
    setSaveState(notice === 'Saved' ? 'saved' : 'error')
    setMessage(notice)
    setPanel({ mode: 'view', id: result.item.id })
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
      {showFocusImage ? <img className="focus-image" alt="" src={`/api/explorations/${experiment.explorationId}/focus-image?v=${focusVersion}`} onError={() => setFocusBroken(true)} /> : null}
      {showFocusImage ? <div className={`focus-image-veil${focusDimmed ? ' dimmed' : ''}`} /> : null}
      <header className="experiment-toolbar">
        <a className="library-link" href={`/explorations/${experiment.explorationId}`}>Back to exploration</a>
        <div className="map-tabs" role="tablist" aria-label="Experiment views">
          <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}><Map size={17} aria-hidden="true" /> Map</button>
          <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><List size={17} aria-hidden="true" /> List</button>
        </div>
        {experiment.hasFocusImage ? (
          <div className="experiment-focus-tools">
            <button type="button" className="focus-image-button" onClick={() => { if (focusBroken) { setFocusBroken(false); setFocusHidden(false); setFocusVersion(version => version + 1); return } setFocusHidden(current => !current) }}>{focusHidden || focusBroken ? 'Show image' : 'Hide image'}</button>
            {showFocusImage ? <button type="button" className="focus-image-button" aria-pressed={focusDimmed} onClick={() => setFocusDimmed(current => !current)}>{focusDimmed ? 'Less dim' : 'Dim image'}</button> : null}
          </div>
        ) : null}
        <a className="library-link story-entry" href={`/explorations/${experiment.explorationId}/story`}>Create a Story</a>
        <button type="button" className="add-button experiment-add" disabled={busy} onClick={openAdd}>+ Add thought</button>
        {message && panel === null ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
        {saveState === 'saving' && panel === null ? <p className="experiment-status" role="status">Saving</p> : null}
      </header>
      <div className="experiment-question-bar">
        <h1 id="experiment-question">{experiment.questionText}</h1>
        <p className="experiment-note">Explore the ideas behind your question. Develop concepts, test assumptions and record discoveries in any order.</p>
        <details className="experiment-safety">
          <summary>About tests</summary>
          <p>If a test would change a live system, follow the approval, safety, and access rules that apply where you work.</p>
        </details>
      </div>
      <div className={`constellation-canvas${view === 'list' ? ' is-list' : ''}${panel ? ' has-detail' : ''}`}>
        {view === 'map' ? (
          <div className="constellation-stage">
            <div className="constellation-fit">
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
                  <SphereMark key={`${item.imagePath ?? 'none'}-${thumbVersions[item.id] ?? 0}`} item={item} icon={Icon} explorationId={experiment.explorationId} experimentId={experiment.id} version={thumbVersions[item.id] ?? 0} />
                  <span className="constellation-preview">{sphereLines(item.body).map((line, index) => <span className="constellation-line" key={`${index}-${line}`}>{line}</span>)}</span>
                </button>
              )
            })}
            {items.length === 0 ? <p className="constellation-empty">Nothing here yet. Add a thought when you are ready.</p> : null}
            </div>
          </div>
        ) : (
          <ul className="experiment-list-view">
            {items.length === 0 ? <li className="experiment-note">Nothing here yet. Add a thought when you are ready.</li> : items.map(item => {
              const Icon = kindIcons[item.kind]
              return (
                <li key={item.id}>
                  <button type="button" className={`experiment-list-row${selectedId === item.id ? ' is-selected' : ''}`} aria-pressed={selectedId === item.id} onClick={() => openItem(item.id)}>
                    <SphereMark key={`${item.imagePath ?? 'none'}-${thumbVersions[item.id] ?? 0}`} item={item} icon={Icon} explorationId={experiment.explorationId} experimentId={experiment.id} version={thumbVersions[item.id] ?? 0} compact />
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
            {panel.mode === 'view' ? <ItemView item={items.find(entry => entry.id === panel.id) ?? null} items={items} explorationId={experiment.explorationId} experimentId={experiment.id} thumbVersion={panel.id ? (thumbVersions[panel.id] ?? 0) : 0} busy={busy} message={message} saveState={saveState} onEdit={item => setPanel({ mode: 'edit', id: item.id, draft: { kind: item.kind, body: item.body, relatedItemId: item.relatedItemId } })} onDelete={item => void removeItem(item)} onThumbnail={setThumbnail} /> : null}
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
                  if (panel.mode === 'add') void commitDraft(panel.itemId, draft, true)
                  if (panel.mode === 'edit') void commitDraft(panel.id, draft, false)
                }}
                onCancel={closePanel}
                explorationId={experiment.explorationId}
                experimentId={experiment.id}
                itemId={panel.mode === 'add' ? panel.itemId : panel.id}
                imagePath={panel.mode === 'edit' ? (items.find(entry => entry.id === panel.id)?.imagePath ?? null) : null}
                thumbVersion={panel.mode === 'edit' ? (thumbVersions[panel.id] ?? 0) : 0}
                onThumbnail={setThumbnail}
                onPrepared={setPendingThumbnail}
              />
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  )
}

function SphereMark({ item, icon: Icon, explorationId, experimentId, version, compact = false }: {
  item: ExperimentItem
  icon: LucideIcon
  explorationId: string
  experimentId: string
  version: number
  compact?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (!item.imagePath || failed) {
    return <span className="constellation-mark"><Icon size={compact ? 16 : 14} aria-hidden="true" /></span>
  }
  const image = (
    <img
      className={compact ? undefined : 'constellation-sphere-image'}
      alt=""
      width={compact ? 28 : 256}
      height={compact ? 28 : 256}
      loading="lazy"
      decoding="async"
      src={`/api/explorations/${explorationId}/experiments/${experimentId}/items/${item.id}/thumbnail?v=${version}`}
      onError={() => setFailed(true)}
    />
  )
  if (compact) return <span className="experiment-list-thumb">{image}</span>
  return (
    <>
      {image}
      <span className="constellation-sphere-wash" aria-hidden="true" />
      <span className="constellation-sphere-highlight" aria-hidden="true" />
      <span className="constellation-mark"><Icon size={14} aria-hidden="true" /></span>
    </>
  )
}

function ItemView({ item, items, explorationId, experimentId, thumbVersion, busy, message, saveState, onEdit, onDelete, onThumbnail }: {
  item: ExperimentItem | null
  items: ExperimentItem[]
  explorationId: string
  experimentId: string
  thumbVersion: number
  busy: boolean
  message: string | null
  saveState: SaveState
  onEdit: (item: ExperimentItem) => void
  onDelete: (item: ExperimentItem) => void
  onThumbnail: (itemId: string, imagePath: string | null) => void
}) {
  if (!item) return <p className="experiment-note">This thought is no longer in the experiment.</p>
  const related = item.relatedItemId ? items.find(entry => entry.id === item.relatedItemId) : null
  return (
    <>
      <p className="experiment-detail-body">{item.body}</p>
      <ConceptThumbnail key={item.id} explorationId={explorationId} experimentId={experimentId} itemId={item.id} kind={item.kind} body={item.body} imagePath={item.imagePath} version={thumbVersion} onChange={imagePath => onThumbnail(item.id, imagePath)} />
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

function ThoughtEditor({ draft, items, selfId, busy, message, saveState, onChange, onSave, onCancel, explorationId, experimentId, itemId, imagePath, thumbVersion, onThumbnail, onPrepared }: {
  draft: Draft
  items: ExperimentItem[]
  selfId: string | null
  busy: boolean
  message: string | null
  saveState: SaveState
  onChange: (draft: Draft) => void
  onSave: () => void
  onCancel: () => void
  explorationId: string
  experimentId: string
  itemId: string
  imagePath: string | null
  thumbVersion: number
  onThumbnail: (itemId: string, imagePath: string | null) => void
  onPrepared: (file: Blob | null) => void
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
      <ConceptThumbnail key={itemId} explorationId={explorationId} experimentId={experimentId} itemId={itemId} kind={draft.kind} body={draft.body} imagePath={imagePath} version={thumbVersion} onChange={next => onThumbnail(itemId, next)} startOpen={!selfId && !imagePath} deferSave={!selfId} onPrepared={onPrepared} />
      {message ? <p className={saveState === 'error' ? 'composer-error' : 'experiment-status'} role={saveState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
      {saveState === 'saving' ? <p className="experiment-status" role="status">Saving</p> : null}
      <div className="experiment-item-actions">
        <button type="button" className="add-button experiment-save" disabled={busy} onClick={onSave}>Save</button>
        <button type="button" className="investigate-further" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
