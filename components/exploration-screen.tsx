'use client'

import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Focus, List, Map, PanelRight, Star, Timer } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'
import {
  createExplorationWithFirstQuestion,
  saveExplorationMode,
  saveQuestion,
  saveQuestionHidden,
  saveQuestionPriority,
} from '@/lib/explorations/actions'
import { acceptsFurtherQuestions, workspaceLeaveEffect, type StoredExplorationStatus } from '@/lib/explorations/continuation'
import ExplorationReflection from '@/components/exploration-reflection'
import FocusImageControl from '@/components/focus-image-control'
import { colourFromQuestionId } from '@/lib/explorations/colour'
import type { DatabaseMode, ExplorationMode, OpenExploration, PerspectiveOrigin, Question, QuestionRole, SaveResult } from '@/lib/explorations/types'

const perspectives = [
  {
    id: 'investigate',
    label: 'Investigate',
    starters: ['What might explain this?', 'How does this actually work?', 'What evidence would help me understand this?'],
  },
  {
    id: 'reframe',
    label: 'Reframe',
    starters: ['What if the opposite were true?', 'How might someone with a different viewpoint see this?', 'What am I taking for granted?'],
  },
  {
    id: 'connect',
    label: 'Connect',
    starters: ['Where else does this pattern appear?', 'What does this remind me of?', 'How might this connect to something seemingly unrelated?'],
  },
  {
    id: 'challenge',
    label: 'Challenge',
    starters: ['What assumption am I making?', 'What would change my mind?', 'What is the strongest counterargument?'],
  },
] as const

type PerspectiveId = typeof perspectives[number]['id']
type LaidOut = Question & { x: number; y: number; radius: number; orbit: number; delay: string }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type SaveOp =
  | { kind: 'create'; explorationId: string; questionId: string; mode: DatabaseMode; questionText: string; role: QuestionRole; perspectiveOrigin: PerspectiveOrigin | null }
  | { kind: 'question'; explorationId: string; questionId: string; questionText: string; role: QuestionRole; perspectiveOrigin: PerspectiveOrigin | null }
  | { kind: 'mode'; explorationId: string; mode: DatabaseMode }
  | { kind: 'priority'; questionId: string; isPrioritised: boolean }
  | { kind: 'hidden'; questionId: string; isHidden: boolean }
type QueuedSave = { generation: number; op: SaveOp }

function wrapLabel(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (lines.length >= maxLines) break
    const tentative = current ? `${current} ${word}` : word
    if (tentative.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = tentative
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  const joined = lines.join(' ')
  if (joined.length < text.trim().length && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, last.length - 1))}…`
  }
  return lines
}

function layoutNodes(questions: Question[], centralQuestionId: string | null): LaidOut[] {
  if (questions.length === 0) return []
  const hub = centralQuestionId != null
    ? questions.find(question => question.id === centralQuestionId) ?? null
    : questions[0]
  const satellites = hub ? questions.filter(question => question.id !== hub.id) : questions
  const satCount = satellites.length
  const satR = satCount > 60 ? 3.6 : satCount > 25 ? 4.8 : satCount > 10 ? 6.2 : 7.5
  const centralR = 13
  const gap = 1.4
  const firstRing = centralR + satR + gap + 3.5
  const assigned: { orbit: number; ringR: number; indexInRing: number; capacity: number }[] = []
  let orbit = 1
  let ringR = firstRing
  let placedInRing = 0
  let capacity = Math.max(6, Math.floor((2 * Math.PI * ringR) / (2 * satR + gap)))

  for (let i = 0; i < satCount; i++) {
    if (placedInRing >= capacity) {
      orbit += 1
      ringR = firstRing + (orbit - 1) * (2 * satR + gap + 2.2)
      capacity = Math.max(8, Math.floor((2 * Math.PI * ringR) / (2 * satR + gap)))
      placedInRing = 0
    }
    assigned.push({ orbit, ringR, indexInRing: placedInRing, capacity })
    placedInRing += 1
  }

  const maxExtent = assigned.reduce((max, item) => Math.max(max, item.ringR + satR), centralR)
  const scale = maxExtent > 47 ? 47 / maxExtent : 1

  let satelliteIndex = 0
  return questions.map(question => {
    if (hub && question.id === hub.id) {
      return { ...question, x: 50, y: 50, radius: Math.max(centralR * scale, 9), orbit: 0, delay: '0ms' }
    }
    const item = assigned[satelliteIndex]
    satelliteIndex += 1
    const angle = (item.indexInRing / item.capacity) * 2 * Math.PI - Math.PI / 2
    const radius = item.ringR * scale
    return {
      ...question,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      radius: satR * scale,
      orbit: item.orbit,
      delay: `${satelliteIndex * 80}ms`,
    }
  })
}

function QuestionMap({ questions, selected, onSelect, centralQuestionId, showPriority }: { questions: Question[]; selected: string; onSelect: (id: string) => void; centralQuestionId: string | null; showPriority: boolean }) {
  const nodes = useMemo(() => layoutNodes(questions, centralQuestionId), [questions, centralQuestionId])
  const rings = useMemo(() => [...new Set(nodes.filter(node => node.orbit > 0).map(node => {
    const dx = node.x - 50
    const dy = node.y - 50
    return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10
  }))], [nodes])
  const central = nodes.find(node => node.orbit === 0)
  const centralLines = central ? wrapLabel(central.text, 12, 3) : []

  if (questions.length === 0) {
    return <div className="empty-map" role="status">Ask a question to begin your exploration.</div>
  }

  return <svg className="question-map" viewBox="0 0 100 100" role="img" aria-label="Orbital map of connected questions">
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="core"><stop stopColor="#ffb84d" stopOpacity=".42"/><stop offset="1" stopColor="#ff9d2f" stopOpacity="0"/></radialGradient>
    </defs>
    {rings.map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#4b8dcb" strokeOpacity=".22" strokeWidth=".12" strokeDasharray=".8 .8" />)}
    {nodes.filter(n => n.orbit > 0).map(n => <line key={`line-${n.id}`} x1="50" y1="50" x2={n.x} y2={n.y} stroke={n.color} strokeOpacity=".16" strokeWidth=".12" />)}
    <circle cx="50" cy="50" r="17" fill="url(#core)" filter="url(#glow)" />
    {nodes.map(n => {
      const lines = n.orbit === 0 ? centralLines : wrapLabel(n.text, n.radius > 5.5 ? 11 : 8, 3)
      const startY = n.y - ((lines.length - 1) * 1.7) / 2
      const prioritised = showPriority && n.isPrioritised
      return <g key={n.id} className={`map-node ${n.id === selected ? 'selected' : ''} ${prioritised ? 'prioritised' : ''}`} style={{ animationDelay: n.delay }} onClick={() => onSelect(n.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(n.id) } }} tabIndex={0} role="button" aria-label={prioritised ? `${n.text} (prioritised)` : n.text}>
        <circle cx={n.x} cy={n.y} r={n.radius} fill={n.color} fillOpacity={n.orbit === 0 ? .18 : .14} stroke={prioritised ? '#e8c36a' : n.color} strokeWidth={prioritised ? .5 : n.id === selected ? .45 : .25} filter="url(#glow)" />
        {lines.map((line, lineIndex) => <text key={lineIndex} x={n.x} y={startY + lineIndex * 1.8} textAnchor="middle" className={n.orbit === 0 ? 'central-text' : 'satellite-text'}>{line}</text>)}
      </g>
    })}
  </svg>
}

function databaseMode(mode: ExplorationMode): DatabaseMode {
  return mode === 'Focus' ? 'focus' : 'quickfire'
}

async function dispatchSave(op: SaveOp): Promise<SaveResult> {
  switch (op.kind) {
    case 'create':
      return createExplorationWithFirstQuestion(op)
    case 'question':
      return saveQuestion(op)
    case 'mode':
      return saveExplorationMode({ explorationId: op.explorationId, mode: op.mode })
    case 'priority':
      return saveQuestionPriority({ questionId: op.questionId, isPrioritised: op.isPrioritised })
    case 'hidden':
      return saveQuestionHidden({ questionId: op.questionId, isHidden: op.isHidden })
  }
}

const centralAnchorMessage = 'The central question anchors this exploration. Start a new exploration to explore a different central question.'
const lastVisibleMessage = 'At least one question stays visible.'

export default function ExplorationScreen({
  signOutError = false,
  initialExploration = null,
}: {
  signOutError?: boolean
  initialExploration?: OpenExploration | null
}) {
  const initialSelected = initialExploration?.questions.find(question => question.role === 'central')?.id ?? initialExploration?.questions[0]?.id ?? ''
  const [mode, setMode] = useState<ExplorationMode>(initialExploration?.mode ?? 'Focus')
  const [questions, setQuestions] = useState<Question[]>(initialExploration?.questions ?? [])
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(initialSelected)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [perspective, setPerspective] = useState<PerspectiveId | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [hideNotice, setHideNotice] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>(initialExploration ? 'saved' : 'idle')
  const [hasFocusImage, setHasFocusImage] = useState(Boolean(initialExploration?.focusImagePath))
  const [focusImageHidden, setFocusImageHidden] = useState(false)
  const [focusImageDimmed, setFocusImageDimmed] = useState(false)
  const [focusImageVersion, setFocusImageVersion] = useState(0)
  const [focusImageBroken, setFocusImageBroken] = useState(false)
  const [reviewShown, setReviewShown] = useState(true)
  const [narrowLayout, setNarrowLayout] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activePerspective = perspectives.find(item => item.id === perspective)
  const addingRef = useRef(false)
  const pendingOriginRef = useRef<PerspectiveId | null>(null)
  const explorationIdRef = useRef<string | null>(initialExploration?.id ?? null)
  const queueRef = useRef<QueuedSave[]>([])
  const runningRef = useRef(false)
  const generationRef = useRef(0)
  const visibleQuestions = useMemo(() => questions.filter(question => !question.isHidden), [questions])
  const hiddenQuestions = useMemo(() => questions.filter(question => question.isHidden), [questions])
  const centralQuestionId = visibleQuestions.find(question => question.role === 'central')?.id ?? null
  const nodes = useMemo(() => layoutNodes(visibleQuestions, centralQuestionId), [visibleQuestions, centralQuestionId])
  const orbitCount = new Set(nodes.map(node => node.orbit)).size
  const prioritisedCount = visibleQuestions.filter(question => question.isPrioritised).length
  const selectedQuestion = visibleQuestions.find(question => question.id === selected) ?? visibleQuestions[0]
  const explorationTitle = initialExploration?.title
    ?? visibleQuestions.find(question => question.role === 'central')?.text
    ?? visibleQuestions[0]?.text
    ?? 'New exploration'
  const anchorQuestion = visibleQuestions.find(question => question.role === 'central')?.text ?? visibleQuestions[0]?.text ?? ''
  const showFocusImage = hasFocusImage && !focusImageHidden && !focusImageBroken && Boolean(explorationIdRef.current)
  const saveLabel = saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Could not save' : 'Add a question to save this exploration.'
  const storedStatus: StoredExplorationStatus | null = initialExploration ? (initialExploration.ended ? 'completed' : 'active') : null

  useEffect(() => {
    if (!input) addingRef.current = false
    if (!input.trim()) pendingOriginRef.current = null
  }, [input])

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 1179px)')
    const apply = () => setNarrowLayout(narrow.matches)
    apply()
    if (narrow.matches) setReviewShown(false)
    const onChange = () => {
      apply()
      if (narrow.matches) setReviewShown(false)
    }
    narrow.addEventListener('change', onChange)
    return () => narrow.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!reviewShown || !narrowLayout) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setReviewShown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reviewShown, narrowLayout])

  function enqueue(op: SaveOp) {
    queueRef.current = [...queueRef.current, { generation: generationRef.current, op }]
    void flush()
  }

  async function flush() {
    if (runningRef.current) return
    runningRef.current = true
    let pauseForRetry = false
    try {
      while (queueRef.current.length > 0) {
        const queued = queueRef.current[0]
        if (queued.generation === generationRef.current) setSaveState('saving')
        const result = await dispatchSave(queued.op)
        const stillCurrent = queued.generation === generationRef.current
        if (!result.ok) {
          if (!stillCurrent) {
            queueRef.current = queueRef.current.slice(1)
            continue
          }
          if (queued.op.kind === 'hidden') {
            const hiddenOp = queued.op
            const stored = typeof result.storedHidden === 'boolean' ? result.storedHidden : !hiddenOp.isHidden
            setQuestions(prev => prev.map(question => question.id === hiddenOp.questionId ? { ...question, isHidden: stored } : question))
            if (result.reason === 'central' || result.reason === 'last-visible') {
              setHideNotice(result.reason === 'central' ? centralAnchorMessage : lastVisibleMessage)
              queueRef.current = queueRef.current.slice(1)
              continue
            }
          }
          pauseForRetry = true
          setSaveState('error')
          return
        }
        if (queued.op.kind === 'hidden' && stillCurrent) {
          const hiddenOp = queued.op
          setQuestions(prev => prev.map(question => question.id === hiddenOp.questionId ? { ...question, isHidden: hiddenOp.isHidden } : question))
        }
        if (queued.op.kind === 'create' && stillCurrent && window.location.pathname === '/explorations/new') {
          window.history.replaceState(window.history.state, '', `/explorations/${queued.op.explorationId}`)
        }
        queueRef.current = queueRef.current.slice(1)
        if (stillCurrent && queueRef.current.length === 0) setSaveState('saved')
      }
    } finally {
      runningRef.current = false
      if (!pauseForRetry && queueRef.current.length > 0) void flush()
    }
  }

  function retrySave() {
    void flush()
  }

  function commitQuestion(raw: string, source: 'composer' | 'suggestion') {
    if (!acceptsFurtherQuestions(storedStatus)) return
    if (source === 'composer' && addingRef.current) return
    const text = raw.trim()
    if (!text) return
    if (text.length > 2000) {
      setComposerError('A question can be at most 2,000 characters.')
      return
    }
    setComposerError(null)
    if (source === 'composer') addingRef.current = true
    const questionId = crypto.randomUUID()
    const perspectiveOrigin = source === 'composer' && mode === 'Focus' ? pendingOriginRef.current : null
    if (source === 'composer') pendingOriginRef.current = null
    const role: QuestionRole = mode === 'Focus' && !questions.some(question => question.role === 'central') ? 'central' : 'satellite'
    const question: Question = {
      id: questionId,
      text,
      color: colourFromQuestionId(questionId),
      role,
      isPrioritised: false,
      isHidden: false,
      ...(perspectiveOrigin ? { perspectiveOrigin } : {}),
    }
    setQuestions(prev => [...prev, question])
    setSelected(questionId)
    if (source === 'composer') setInput('')

    let explorationId = explorationIdRef.current
    if (!explorationId) {
      explorationId = crypto.randomUUID()
      explorationIdRef.current = explorationId
      enqueue({
        kind: 'create',
        explorationId,
        questionId,
        mode: databaseMode(mode),
        questionText: text,
        role,
        perspectiveOrigin,
      })
    } else {
      enqueue({
        kind: 'question',
        explorationId,
        questionId,
        questionText: text,
        role,
        perspectiveOrigin,
      })
    }
    if (source === 'composer') requestAnimationFrame(() => inputRef.current?.focus())
  }

  function addQuestion(event?: FormEvent) {
    event?.preventDefault()
    commitQuestion(input, 'composer')
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (event.repeat || event.nativeEvent.isComposing) return
    event.currentTarget.form?.requestSubmit()
  }

  function changeMode(next: ExplorationMode) {
    if (next === mode) return
    if (next === 'Quickfire') pendingOriginRef.current = null
    setMode(next)
    const explorationId = explorationIdRef.current
    if (!explorationId) return
    enqueue({ kind: 'mode', explorationId, mode: databaseMode(next) })
  }

  function applyStarter(text: string, origin: PerspectiveId) {
    if (mode !== 'Focus') return
    pendingOriginRef.current = origin
    setComposerError(null)
    setInput(text)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function hideQuestion(id: string) {
    const question = questions.find(item => item.id === id)
    if (!question || question.isHidden) return
    if (question.role === 'central') {
      setHideNotice(centralAnchorMessage)
      return
    }
    if (visibleQuestions.length <= 1) {
      setHideNotice(lastVisibleMessage)
      return
    }
    setHideNotice(null)
    setQuestions(prev => prev.map(item => item.id === id ? { ...item, isHidden: true } : item))
    if (selected === id) {
      const next = visibleQuestions.find(item => item.id !== id)
      setSelected(next?.id ?? '')
    }
    enqueue({ kind: 'hidden', questionId: id, isHidden: true })
  }

  function restoreQuestion(id: string) {
    const question = questions.find(item => item.id === id)
    if (!question?.isHidden) return
    setHideNotice(null)
    setQuestions(prev => prev.map(item => item.id === id ? { ...item, isHidden: false } : item))
    enqueue({ kind: 'hidden', questionId: id, isHidden: false })
  }

  function togglePriority(id: string) {
    if (!acceptsFurtherQuestions(storedStatus) || !explorationIdRef.current) return
    const current = questions.find(question => question.id === id)
    if (!current) return
    const isPrioritised = !current.isPrioritised
    setQuestions(prev => prev.map(question => question.id === id ? { ...question, isPrioritised } : question))
    enqueue({ kind: 'priority', questionId: id, isPrioritised })
  }

  function onSignOut(event: FormEvent<HTMLFormElement>) {
    if (saveState === 'error' && !window.confirm('A save did not finish. Sign out and discard that change?')) {
      event.preventDefault()
    }
  }

  function onLeaveLibrary(event: MouseEvent<HTMLAnchorElement>) {
    const effect = workspaceLeaveEffect()
    if (effect.writes.length > 0 || effect.resetsQuestions || effect.changesStatus) {
      event.preventDefault()
      return
    }
    if (saveState === 'error' && !window.confirm('A save did not finish. Leave and discard that change?')) {
      event.preventDefault()
    }
  }

  return <main className={`app-shell${reviewShown ? ' review-shown' : ''}`}>
    <aside className="sidebar" inert={narrowLayout && reviewShown ? true : undefined}>
      <header className="brand"><div className="brand-mark" aria-hidden="true"><img src="/logo-removebg-preview.png" alt="" /></div><div><div className="brand-name">curitopia</div><div className="tagline">Keep asking. Go further.</div></div></header>
      <div className="sidebar-nav">
        <a className="library-link" href="/" onClick={onLeaveLibrary}>All explorations</a>
        <form action={signOut} onSubmit={onSignOut}><button className="sign-out" type="submit">Sign out</button></form>
        {signOutError ? <p className="sign-out-error" role="alert">Sign-out did not complete. Try again.</p> : null}
        <div className="map-tabs" role="tablist" aria-label="Question views"><button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}><Map size={17}/> Map</button><button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><List size={17}/> List</button></div>
      </div>
      <div className="session-note" role="status"><p className={saveState === 'error' ? 'save-status error' : 'save-status'}>{saveLabel}</p>{saveState === 'error' ? <button type="button" className="retry-save" onClick={retrySave}>Retry</button> : null}</div>
      {hideNotice ? <p className="composer-error" role="alert">{hideNotice}</p> : null}
      <section className="mode-switch" aria-label="Choose exploration mode"><button type="button" className={mode === 'Focus' ? 'active' : ''} onClick={() => changeMode('Focus')}><Focus size={15}/> Focus</button><button type="button" className={mode === 'Quickfire' ? 'active' : ''} onClick={() => changeMode('Quickfire')}><Timer size={15}/> Quickfire</button></section>
      <section className="panel prompt-panel"><div className="panel-label">{mode === 'Focus' ? 'Explore your question' : 'Keep the questions coming'}</div><form onSubmit={addQuestion}><textarea ref={inputRef} value={input} onChange={event => { setComposerError(null); setInput(event.target.value) }} onKeyDown={onComposerKeyDown} placeholder="Type your next question..." aria-label="Next question" aria-invalid={composerError ? true : undefined} />{composerError ? <p className="composer-error" role="alert">{composerError}</p> : null}<button className="add-button" type="submit">Add Question <ArrowRight size={17}/></button></form></section>
      {mode === 'Focus' ? <section className="panel angle-panel"><div className="panel-label">Explore from another angle</div><div className="angle-grid" role="group" aria-label="Question perspectives">{perspectives.map(item => <button type="button" key={item.id} className={perspective === item.id ? 'active' : ''} aria-pressed={perspective === item.id} onClick={() => { setPerspective(item.id); if (pendingOriginRef.current) pendingOriginRef.current = item.id }}>{item.label}</button>)}</div>{activePerspective ? <ul className="starter-list">{activePerspective.starters.map(starter => <li key={starter}><button type="button" onClick={() => applyStarter(starter, activePerspective.id)}>{starter}</button></li>)}</ul> : <p className="angle-hint">Choose a perspective for optional question starters.</p>}</section> : null}
    </aside>
    <section className="map-area" inert={narrowLayout && reviewShown ? true : undefined}>{showFocusImage ? <img className="focus-image" alt="" src={`/api/explorations/${explorationIdRef.current}/focus-image?v=${focusImageVersion}`} onError={() => setFocusImageBroken(true)} /> : null}{showFocusImage ? <div className={`focus-image-veil${focusImageDimmed ? ' dimmed' : ''}`} /> : null}<div className="star-field"/><div className="workspace-bar"><header className="workspace-summary"><h1 title={explorationTitle}>{explorationTitle}</h1><p>This exploration · {mode} · {visibleQuestions.length} {visibleQuestions.length === 1 ? 'question' : 'questions'} · {orbitCount} {orbitCount === 1 ? 'orbit' : 'orbits'}{hiddenQuestions.length > 0 ? ` · ${hiddenQuestions.length} hidden` : ''}</p></header><div className="topbar"><button type="button" className="review-toggle" aria-expanded={reviewShown} aria-controls="review-sidebar" onClick={() => setReviewShown(current => !current)}><PanelRight size={17} aria-hidden="true"/>{reviewShown ? 'Hide review' : 'Review'}</button></div></div><div className="map-stage">
      {view === 'list' ? <ul className="question-list">{visibleQuestions.length === 0 ? <li className="empty-list">No questions yet. Add one to start exploring.</li> : visibleQuestions.map(question => {
        const hideDisabled = question.role === 'central' || visibleQuestions.length <= 1
        const hideLabel = question.role === 'central' ? centralAnchorMessage : visibleQuestions.length <= 1 ? lastVisibleMessage : `Hide question: ${question.text}`
        return <li key={question.id} className="question-row"><button type="button" className={`question-select ${question.id === selectedQuestion?.id ? 'selected' : ''} ${question.isPrioritised ? 'prioritised' : ''}`} onClick={() => setSelected(question.id)}>{question.text}</button><button type="button" className="hide-question" disabled={hideDisabled} aria-label={hideLabel} title={hideDisabled ? hideLabel : 'Hide question'} onClick={event => { event.stopPropagation(); hideQuestion(question.id) }}><EyeOff size={16} aria-hidden="true"/></button></li>
      })}</ul> : <QuestionMap questions={visibleQuestions} selected={selectedQuestion?.id ?? ''} onSelect={setSelected} centralQuestionId={centralQuestionId} showPriority/>}
      <div className="map-footer"><div className="canvas-tools"><FocusImageControl explorationId={explorationIdRef.current} saved={saveState === 'saved'} anchorQuestion={anchorQuestion} hasImage={hasFocusImage} hidden={focusImageHidden} dimmed={focusImageDimmed} broken={focusImageBroken} onUse={() => { setHasFocusImage(true); setFocusImageHidden(false); setFocusImageBroken(false); setFocusImageVersion(version => version + 1) }} onRemove={() => { setHasFocusImage(false); setFocusImageHidden(false); setFocusImageBroken(false) }} onToggleHidden={() => setFocusImageHidden(current => !current)} onToggleDimmed={() => setFocusImageDimmed(current => !current)} onRetryImage={() => { setFocusImageBroken(false); setFocusImageVersion(version => version + 1) }} /><span className="map-status"><span className="status-dot"/> Live exploration</span></div><span>Select any question to read it in full</span></div></div></section>
    <button type="button" className="review-backdrop" aria-label="Close review" onClick={() => setReviewShown(false)} />
    <aside id="review-sidebar" className="review-sidebar" aria-label="Review and reflect" inert={reviewShown ? undefined : true}>
      <div className="review-sidebar-heading"><h2>Review</h2><button type="button" className="review-close" onClick={() => setReviewShown(false)}>Close</button></div>
      <section className="selected-detail" aria-live="polite">
        <div className="panel-heading"><span>Selected question</span></div>
        <p>{selectedQuestion ? selectedQuestion.text : 'Add a question to see it here in full.'}</p>
        {selectedQuestion?.role === 'central' ? <p className="angle-hint">{centralAnchorMessage}</p> : null}
      </section>
      <section className="hidden-panel">
        <button type="button" className="show-hidden" aria-pressed={showHidden} disabled={hiddenQuestions.length === 0} onClick={() => setShowHidden(current => !current)}>{showHidden ? 'Hide the hidden list' : 'Show hidden questions'}{hiddenQuestions.length > 0 ? ` (${hiddenQuestions.length})` : ''}</button>
        {showHidden ? hiddenQuestions.length === 0 ? <p className="angle-hint">No hidden questions.</p> : <ul className="hidden-list">{hiddenQuestions.map(question => <li key={question.id}><span>{question.text}</span><button type="button" className="restore-question" onClick={event => { event.stopPropagation(); restoreQuestion(question.id) }}><Eye size={15} aria-hidden="true"/> Restore <span className="sr-only">question: {question.text}</span></button></li>)}</ul> : null}
      </section>
      <section className="review-panel" aria-label="Review">
        <div className="panel-heading"><span>Questions</span></div>
        {questions.length === 0 ? <p>Add a question to review this exploration.</p> : <><p className="review-count">{visibleQuestions.length} question{visibleQuestions.length === 1 ? '' : 's'}</p><p className="review-count">{prioritisedCount} prioritised</p>{hiddenQuestions.length > 0 ? <p className="hidden-count">{hiddenQuestions.length} hidden</p> : null}{visibleQuestions.length === 0 ? <p>No visible questions in this exploration.</p> : <ol className="review-list">{visibleQuestions.map(question => <li key={question.id}><button type="button" className="priority-toggle" aria-pressed={question.isPrioritised} aria-label={question.isPrioritised ? `Remove priority from: ${question.text}` : `Mark as important: ${question.text}`} onClick={() => togglePriority(question.id)}><Star size={16} fill={question.isPrioritised ? 'currentColor' : 'none'} /></button><span>{question.text}</span></li>)}</ol>}</>}
        {explorationIdRef.current ? <ExplorationReflection explorationId={explorationIdRef.current} questions={questions} visibleCount={visibleQuestions.length} saved={saveState === 'saved'} onAddQuestion={text => commitQuestion(text, 'suggestion')} /> : null}
      </section>
    </aside>
  </main>
}
