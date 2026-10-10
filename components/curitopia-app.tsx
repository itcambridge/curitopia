'use client'

import { FormEvent, useMemo, useState } from 'react'
import { ArrowRight, BarChart3, ChevronDown, CircleHelp, Compass, GitBranch, List, MoreHorizontal, Network, Sparkles, Timer, Waves } from 'lucide-react'

type Question = { id: number; text: string; color: string; angle: number; radius: number }

const starterQuestions: Question[] = [
  { id: 1, text: 'Why do we dream?', color: '#ffb347', angle: 0, radius: 0 },
  { id: 2, text: 'What happens in the brain when we dream?', color: '#56b9ff', angle: 205, radius: 29 },
  { id: 3, text: 'Could dreams help us solve problems?', color: '#ef8fc3', angle: 325, radius: 30 },
  { id: 4, text: 'Do blind people dream?', color: '#78edc5', angle: 255, radius: 45 },
  { id: 5, text: 'Why do some dreams feel meaningful?', color: '#ed7fbd', angle: 185, radius: 48 },
  { id: 6, text: 'Are dreams a way of processing emotions?', color: '#ffac61', angle: 25, radius: 48 },
  { id: 7, text: 'What is the purpose of REM sleep?', color: '#7de8c4', angle: 65, radius: 50 },
  { id: 8, text: 'Can dreams influence our decisions when we\'re awake?', color: '#b36cff', angle: 120, radius: 66 },
  { id: 9, text: 'What if dreams are a different state of consciousness?', color: '#4d9dff', angle: 145, radius: 68 },
  { id: 10, text: 'Are dreams just random neural activity?', color: '#df83d1', angle: 350, radius: 68 },
  { id: 11, text: 'What if dreams are a form of time travel?', color: '#7eeac8', angle: 315, radius: 69 },
  { id: 12, text: 'Could dreams show us possible futures?', color: '#499aff', angle: 40, radius: 73 },
  { id: 13, text: 'Could we control our dreams fully?', color: '#a86aff', angle: 78, radius: 79 },
  { id: 14, text: 'What is the relationship between memory and dreams?', color: '#5eb8ff', angle: 100, radius: 75 },
]

const palette = ['#56b9ff', '#b36cff', '#78edc5', '#ed7fbd', '#ffb347']

function Logo() {
  return <div className="brand"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><div><strong>curitopia</strong><small>Keep asking. Go further.</small></div></div>
}

function QuestionMap({ questions, selected, onSelect }: { questions: Question[]; selected: number; onSelect: (id: number) => void }) {
  const nodes = useMemo(() => questions.map((q, index) => ({ ...q, angle: index === 0 ? 0 : q.angle, radius: index === 0 ? 0 : q.radius })), [questions])
  return <div className="map-wrap">
    <div className="map-toolbar" role="toolbar" aria-label="Visualization controls"><button className="active"><Network size={16} /> Map</button><button><List size={16} /> List</button><button><GitBranch size={16} /> Timeline</button><button aria-label="More options"><MoreHorizontal size={18} /></button></div>
    <svg className="question-map" viewBox="0 0 900 900" role="img" aria-label="Orbital map of curiosity questions">
      <defs><radialGradient id="core"><stop stopColor="#ffbd65" stopOpacity=".34" /><stop offset="1" stopColor="#ffbd65" stopOpacity="0" /></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <circle cx="450" cy="450" r="210" fill="url(#core)" />
      {[185, 278, 365, 430].map(r => <circle key={r} cx="450" cy="450" r={r} fill="none" stroke="#5d9ad0" strokeOpacity=".23" strokeDasharray="2 5" />)}
      {nodes.slice(1).map(q => { const x = 450 + Math.cos((q.angle - 90) * Math.PI / 180) * q.radius * 5.1; const y = 450 + Math.sin((q.angle - 90) * Math.PI / 180) * q.radius * 5.1; return <line key={`line-${q.id}`} x1="450" y1="450" x2={x} y2={y} stroke={q.color} strokeOpacity=".16" /> })}
      {nodes.map((q, index) => { const x = index === 0 ? 450 : 450 + Math.cos((q.angle - 90) * Math.PI / 180) * q.radius * 5.1; const y = index === 0 ? 450 : 450 + Math.sin((q.angle - 90) * Math.PI / 180) * q.radius * 5.1; const size = index === 0 ? 108 : Math.max(57, 72 - q.radius * .1); const words = q.text.split(' '); const lines: string[] = []; let line = ''; words.forEach(word => { if ((line + ' ' + word).trim().length > 18) { lines.push(line); line = word } else line = (line + ' ' + word).trim() }); if (line) lines.push(line); return <g key={q.id} className={`node ${selected === q.id ? 'selected' : ''}`} onClick={() => onSelect(q.id)} tabIndex={0} role="button" aria-label={q.text} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(q.id) }}><circle cx={x} cy={y} r={size} fill="#061a32" fillOpacity=".8" stroke={q.color} strokeWidth={selected === q.id ? 3 : 1.8} filter={index === 0 || selected === q.id ? 'url(#glow)' : undefined} /><text x={x} y={y - (lines.length - 1) * 9} textAnchor="middle" fill="#f6f8ff" fontSize={index === 0 ? 16 : 11.5} fontWeight={index === 0 ? 600 : 400}>{lines.map((line, lineIndex) => <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? 0 : 17}>{line}</tspan>)}</text></g> })}
    </svg>
  </div>
}

export default function CuritopiaApp() {
  const [mode, setMode] = useState<'focus' | 'quickfire'>('focus')
  const [input, setInput] = useState('')
  const [questions, setQuestions] = useState(starterQuestions)
  const [selected, setSelected] = useState(1)
  const [ended, setEnded] = useState(false)
  const addQuestion = (event: FormEvent) => { event.preventDefault(); const text = input.trim(); if (!text) return; const id = Date.now(); setQuestions(prev => [...prev, { id, text, color: palette[prev.length % palette.length], angle: (prev.length * 137.5) % 360, radius: 72 }]); setInput('') }
  const visibleQuestions = mode === 'quickfire' && !ended ? questions.slice(-5) : questions
  return <main className="curitopia-shell">
    <aside className="sidebar"><Logo /><section className="panel question-entry"><div className="panel-label"><span>Your next question</span><CircleHelp size={15} /></div><form onSubmit={addQuestion}><textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type your next question..." aria-label="Your next question" /><button className="add-button" type="submit">Add Question <ArrowRight size={18} /></button></form></section>
      <section className="panel stats"><div className="panel-label"><span>Today's exploration</span><ChevronDown size={17} /></div><div className="stat-grid"><div><strong>{questions.length}</strong><span>questions</span></div><div><strong>{Math.max(1, Math.ceil(questions.length / 5))}</strong><span>orbits</span></div><div><strong>{mode === 'focus' ? 17 : 9}</strong><span>new directions</span></div></div></section>
      <section className="panel journey"><div className="panel-label"><span><Compass size={18} /> Your journey</span></div><p><Timer size={18} /> Longest chain <b>8</b></p><p><GitBranch size={18} /> Furthest from start <b>4.2×</b></p><p><Waves size={18} /> Time exploring <b>18 mins</b></p></section>
      <div className="connection-card"><Sparkles size={26} /><div><strong>You're making<br />connections.</strong><span>Your thinking is expanding<br />in new directions.</span></div></div>
      <button className="end-button" onClick={() => setEnded(v => !v)}><BarChart3 size={19} /> {ended ? 'Continue exploring' : 'End session & explore'}</button>
    </aside>
    <section className="workspace"><header className="workspace-header"><div className="mode-toggle" role="tablist" aria-label="Question mode"><button className={mode === 'focus' ? 'selected' : ''} onClick={() => setMode('focus')}><Compass size={17} /> Focus</button><button className={mode === 'quickfire' ? 'selected' : ''} onClick={() => setMode('quickfire')}><Timer size={17} /> Quickfire</button></div><div className="session-badge">{ended ? 'Session map' : mode === 'focus' ? 'Focus mode' : 'Quickfire mode'} <span /></div></header><div className="map-stage"><QuestionMap questions={visibleQuestions} selected={selected} onSelect={setSelected} /></div><div className="mobile-prompt">{selected > 1 ? <span>Exploring: <b>{questions.find(q => q.id === selected)?.text}</b></span> : <span>Keep asking. Go further.</span>}</div></section>
  </main>
}

export { CuritopiaApp }
