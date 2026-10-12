'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Focus, Layers3, List, Map, MoreHorizontal, RotateCcw, Sparkles, Star, Timer, Waypoints } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'

type QuestionRole = 'central' | 'satellite'

const palette = ['#55baff', '#a969f4', '#71e7bf', '#ef8bc2', '#ffb84d'] as const

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
type Question = { id: number; text: string; color: string; role: QuestionRole; isPrioritised: boolean; perspectiveOrigin?: PerspectiveId }
type LaidOut = Question & { x: number; y: number; radius: number; orbit: number; delay: string }

const starterQuestions: Question[] = [
  { id: 1, text: 'Why do we dream?', color: '#ffb84d', role: 'central', isPrioritised: false },
  { id: 2, text: 'What happens in the brain when we dream?', color: '#53baff', role: 'satellite', isPrioritised: false },
  { id: 3, text: 'Could dreams help us solve problems?', color: '#ed8dc1', role: 'satellite', isPrioritised: false },
  { id: 4, text: 'Are dreams a way of processing emotions?', color: '#f5a653', role: 'satellite', isPrioritised: false },
  { id: 5, text: 'Why do some dreams feel meaningful?', color: '#ef8bc2', role: 'satellite', isPrioritised: false },
  { id: 6, text: 'What is the purpose of REM sleep?', color: '#7ee4be', role: 'satellite', isPrioritised: false },
  { id: 7, text: 'Could dreams show us possible futures?', color: '#559aff', role: 'satellite', isPrioritised: false },
  { id: 8, text: 'Do we all dream in the same way?', color: '#71e8c0', role: 'satellite', isPrioritised: false },
  { id: 9, text: 'Can dreams influence our decisions?', color: '#a866f5', role: 'satellite', isPrioritised: false },
  { id: 10, text: 'Do other animals dream?', color: '#a36cff', role: 'satellite', isPrioritised: false },
  { id: 11, text: 'Can AI dream?', color: '#a55af1', role: 'satellite', isPrioritised: false },
  { id: 12, text: 'What if dreams are a form of time travel?', color: '#70e4b9', role: 'satellite', isPrioritised: false },
]

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

function layoutNodes(questions: Question[], centralQuestionId: number | null): LaidOut[] {
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

function QuestionMap({ questions, selected, onSelect, centralQuestionId, showPriority }: { questions: Question[]; selected: number; onSelect: (id: number) => void; centralQuestionId: number | null; showPriority: boolean }) {
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

export default function ExplorationScreen({ signOutError = false }: { signOutError?: boolean }) {
  const [mode, setMode] = useState<'Focus' | 'Quickfire'>('Focus')
  const [questions, setQuestions] = useState(starterQuestions)
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(1)
  const [ended, setEnded] = useState(false)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [perspective, setPerspective] = useState<PerspectiveId | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activePerspective = perspectives.find(item => item.id === perspective)
  const addingRef = useRef(false)
  const pendingOriginRef = useRef<PerspectiveId | null>(null)
  const centralQuestionId = questions.find(question => question.role === 'central')?.id ?? null
  const nodes = useMemo(() => layoutNodes(questions, centralQuestionId), [questions, centralQuestionId])
  const orbitCount = new Set(nodes.map(node => node.orbit)).size
  const prioritisedCount = questions.filter(question => question.isPrioritised).length
  const selectedQuestion = questions.find(question => question.id === selected) ?? questions[0]

  useEffect(() => {
    if (!input) addingRef.current = false
    if (!input.trim()) pendingOriginRef.current = null
  }, [input])

  function addQuestion(event?: FormEvent) {
    event?.preventDefault()
    if (ended || addingRef.current) return
    const text = input.trim()
    if (!text) return
    addingRef.current = true
    const nextId = Date.now()
    const perspectiveOrigin = mode === 'Focus' ? pendingOriginRef.current ?? undefined : undefined
    pendingOriginRef.current = null
    setQuestions(prev => {
      const role: QuestionRole = mode === 'Focus' && !prev.some(question => question.role === 'central') ? 'central' : 'satellite'
      return [...prev, { id: nextId, text, color: palette[prev.length % palette.length], role, isPrioritised: false, ...(perspectiveOrigin ? { perspectiveOrigin } : {}) }]
    })
    setSelected(nextId)
    setInput('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (event.repeat || event.nativeEvent.isComposing) return
    event.currentTarget.form?.requestSubmit()
  }

  function handleSessionButton() {
    if (ended) {
      setQuestions([])
      setSelected(0)
      setEnded(false)
      setInput('')
      setView('map')
      setPerspective(null)
      pendingOriginRef.current = null
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    setEnded(true)
    setPerspective(null)
    pendingOriginRef.current = null
  }

  function applyStarter(text: string, origin: PerspectiveId) {
    if (ended || mode !== 'Focus') return
    pendingOriginRef.current = origin
    setInput(text)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function togglePriority(id: number) {
    if (!ended) return
    setQuestions(prev => prev.map(question => question.id === id ? { ...question, isPrioritised: !question.isPrioritised } : question))
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <header className="brand"><div className="brand-mark" aria-hidden="true"><img src="/logo-removebg-preview.png" alt="" /></div><div><div className="brand-name">curitopia</div><div className="tagline">Keep asking. Go further.</div></div></header>
      <p className="session-note">This exploration stays in this tab. It is not saved to your account yet.</p>
      <section className="mode-switch" aria-label="Choose exploration mode"><button className={mode === 'Focus' ? 'active' : ''} onClick={() => setMode('Focus')}><Focus size={15}/> Focus</button><button className={mode === 'Quickfire' ? 'active' : ''} onClick={() => { pendingOriginRef.current = null; setMode('Quickfire') }}><Timer size={15}/> Quickfire</button></section>
      <section className="panel prompt-panel"><div className="panel-label">{ended ? 'Session complete' : mode === 'Focus' ? 'Explore your question' : 'Keep the questions coming'}</div><form onSubmit={addQuestion}><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onComposerKeyDown} placeholder={ended ? 'Start a new exploration to add questions' : 'Type your next question...'} aria-label="Next question" disabled={ended} /><button className="add-button" type="submit" disabled={ended}>Add Question <ArrowRight size={17}/></button></form></section>
      {mode === 'Focus' && !ended ? <section className="panel angle-panel"><div className="panel-label">Explore from another angle</div><div className="angle-grid" role="group" aria-label="Question perspectives">{perspectives.map(item => <button type="button" key={item.id} className={perspective === item.id ? 'active' : ''} aria-pressed={perspective === item.id} onClick={() => { setPerspective(item.id); if (pendingOriginRef.current) pendingOriginRef.current = item.id }}>{item.label}</button>)}</div>{activePerspective ? <ul className="starter-list">{activePerspective.starters.map(starter => <li key={starter}><button type="button" onClick={() => applyStarter(starter, activePerspective.id)}>{starter}</button></li>)}</ul> : <p className="angle-hint">Choose a perspective for optional question starters.</p>}</section> : null}
      <section className="panel stats-panel"><div className="panel-heading"><span>Today&apos;s exploration</span><ChevronDown size={17}/></div><div className="stats"><div><strong>{questions.length}</strong><span>questions</span></div><div><strong>{orbitCount}</strong><span>orbits</span></div></div></section>
      <section className="panel selected-detail" aria-live="polite">
        <div className="panel-heading"><span>Selected question</span></div>
        <p>{selectedQuestion ? selectedQuestion.text : 'Add a question to see it here in full.'}</p>
      </section>
      {ended ? <section className="panel review-panel" aria-label="Session review"><div className="panel-heading"><span>Session review</span></div><p className="review-count">{questions.length} question{questions.length === 1 ? '' : 's'} collected</p><p className="review-count">{prioritisedCount} prioritised</p>{questions.length === 0 ? <p>No questions were collected in this session.</p> : <ol className="review-list">{questions.map(question => <li key={question.id}><button type="button" className="priority-toggle" aria-pressed={question.isPrioritised} aria-label={question.isPrioritised ? `Remove priority from: ${question.text}` : `Mark as important: ${question.text}`} onClick={() => togglePriority(question.id)}><Star size={16} fill={question.isPrioritised ? 'currentColor' : 'none'} /></button><span>{question.text}</span></li>)}</ol>}</section> : null}
      <div className="connections"><Sparkles size={29}/><div><strong>You&apos;re making<br/>connections.</strong><p>Your thinking is expanding<br/>in new directions.</p></div></div>
      <button className="end-button" onClick={handleSessionButton}>{ended ? <RotateCcw size={17}/> : <Layers3 size={17}/>} {ended ? 'Start new exploration' : 'End session & explore'}</button>
    </aside>
    <section className="map-area"><div className="star-field"/><div className="topbar"><form action={signOut}><button className="sign-out" type="submit">Sign out</button></form><div className="map-tabs" role="tablist" aria-label="Question views"><button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}><Map size={17}/> Map</button><button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><List size={17}/> List</button><button type="button" disabled aria-disabled="true" title="Timeline is not available in this prototype"><Waypoints size={17}/> Timeline</button></div><button className="more" aria-label="More options"><MoreHorizontal size={20}/></button></div><div className="map-heading"><p>{ended ? 'Your collected questions' : 'A universe of curiosity'}</p><h1>{questions.length === 0 ? 'No questions yet' : `${questions.length} questions orbiting one idea`}</h1></div>
      {view === 'list' ? <ul className="question-list">{questions.length === 0 ? <li className="empty-list">No questions yet. Add one to start exploring.</li> : questions.map(question => <li key={question.id}><button type="button" className={`${question.id === selectedQuestion?.id ? 'selected' : ''} ${ended && question.isPrioritised ? 'prioritised' : ''}`} onClick={() => setSelected(question.id)}>{question.text}</button></li>)}</ul> : <QuestionMap questions={questions} selected={selectedQuestion?.id ?? 0} onSelect={setSelected} centralQuestionId={centralQuestionId} showPriority={ended}/>}
      <div className="map-footer"><span><span className="status-dot"/> {ended ? 'Session paused' : 'Live exploration'}</span><span>Select any question to read it in full</span></div>{signOutError ? <p className="sign-out-error" role="alert">Sign-out did not complete. Try again.</p> : null}</section>
  </main>
}
