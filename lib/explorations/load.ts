import { loadExperimentLinks } from '@/lib/experiments/load'
import { colourFromQuestionId } from '@/lib/explorations/colour'
import type { ExplorationMode, LibraryExploration, OpenExploration, PerspectiveOrigin, Question, QuestionRole } from '@/lib/explorations/types'
import { createClient } from '@/lib/supabase/server'

type ExplorationRow = {
  id: string
  title: string | null
  mode: string
  status: string
  focus_image_path?: string | null
}

type QuestionRow = {
  id: string
  question_text: string
  role: string
  is_prioritised: boolean
  is_hidden: boolean
  perspective_origin: string | null
  position: number
}

type LibraryQuestionRow = {
  question_text: string
  role: string
  is_prioritised: boolean
  is_hidden: boolean
  position: number
}

type LibraryRow = {
  id: string
  title: string | null
  mode: string
  status: string
  updated_at: string
  questions: LibraryQuestionRow[] | LibraryQuestionRow | null
}

const origins: readonly PerspectiveOrigin[] = ['investigate', 'reframe', 'connect', 'challenge']
const explorationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uiMode(mode: string): ExplorationMode | null {
  if (mode === 'focus') return 'Focus'
  if (mode === 'quickfire') return 'Quickfire'
  return null
}

function questionRole(role: string): QuestionRole | null {
  if (role === 'central' || role === 'satellite') return role
  return null
}

function perspectiveOrigin(value: string | null): PerspectiveOrigin | null | undefined {
  if (value === null) return null
  return origins.find(origin => origin === value)
}

function mapQuestions(rows: QuestionRow[]): Question[] | null {
  const questions: Question[] = []
  for (const item of rows) {
    const role = questionRole(item.role)
    const origin = perspectiveOrigin(item.perspective_origin)
    if (!role || origin === undefined || typeof item.question_text !== 'string' || typeof item.is_prioritised !== 'boolean' || typeof item.is_hidden !== 'boolean') return null
    questions.push({
      id: item.id,
      text: item.question_text,
      color: colourFromQuestionId(item.id),
      role,
      isPrioritised: item.is_prioritised,
      isHidden: item.is_hidden,
      ...(origin ? { perspectiveOrigin: origin } : {}),
    })
  }
  return questions
}

function missingFocusImageColumn(error: { code?: string; message?: string }) {
  return error.code === '42703' || error.code === 'PGRST204' || (error.message ?? '').includes('focus_image_path')
}

export async function loadExploration(id: string): Promise<{ status: 'ok'; exploration: OpenExploration } | { status: 'not-found' } | { status: 'error' }> {
  if (!explorationIdPattern.test(id)) return { status: 'not-found' }

  const supabase = await createClient()
  const withImage = await supabase
    .from('explorations')
    .select('id, title, mode, status, focus_image_path')
    .eq('id', id)
    .maybeSingle()
  const loaded = withImage.error && missingFocusImageColumn(withImage.error)
    ? await supabase.from('explorations').select('id, title, mode, status').eq('id', id).maybeSingle()
    : withImage

  if (loaded.error) return { status: 'error' }
  if (!loaded.data) return { status: 'not-found' }

  const row = loaded.data as ExplorationRow
  const mode = uiMode(row.mode)
  if (!mode || (row.status !== 'active' && row.status !== 'completed')) return { status: 'error' }
  const focusImagePath = typeof row.focus_image_path === 'string' ? row.focus_image_path : null

  const { data: questionRows, error: questionError } = await supabase
    .from('questions')
    .select('id, question_text, role, is_prioritised, is_hidden, perspective_origin, position')
    .eq('exploration_id', row.id)
    .order('position', { ascending: true })

  if (questionError || !questionRows) return { status: 'error' }
  const questions = mapQuestions(questionRows as QuestionRow[])
  if (!questions) return { status: 'error' }
  if (questions.length === 0) return { status: 'not-found' }

  const links = await loadExperimentLinks(row.id)
  if (!links.ok && !links.missing) return { status: 'error' }

  return {
    status: 'ok',
    exploration: {
      id: row.id,
      title: displayTitle(row.title, questions.map((question, index) => ({
        question_text: question.text,
        role: question.role,
        is_prioritised: question.isPrioritised,
        is_hidden: question.isHidden,
        position: index,
      }))),
      mode,
      ended: row.status === 'completed',
      focusImagePath,
      experiments: links.ok ? links.links : [],
      questions,
    },
  }
}

function questionList(value: LibraryRow['questions']): LibraryQuestionRow[] | null {
  if (value === null) return []
  const rows = Array.isArray(value) ? value : [value]
  for (const row of rows) {
    if (typeof row.question_text !== 'string' || typeof row.role !== 'string' || typeof row.is_prioritised !== 'boolean' || typeof row.is_hidden !== 'boolean' || typeof row.position !== 'number') {
      return null
    }
  }
  return rows
}

function displayTitle(title: string | null, questions: LibraryQuestionRow[]) {
  const custom = title?.trim()
  if (custom) return custom
  const ordered = [...questions].sort((left, right) => left.position - right.position)
  const visible = ordered.filter(question => !question.is_hidden)
  const central = visible.find(question => question.role === 'central')
  const fallback = (central ?? visible[0])?.question_text.trim()
  return fallback || 'Untitled exploration'
}

export async function loadExplorationLibrary(): Promise<{ ok: true; items: LibraryExploration[] } | { ok: false }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('explorations')
    .select('id, title, mode, status, updated_at, questions!inner(question_text, role, is_prioritised, is_hidden, position)')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })

  if (error || !data) return { ok: false }

  const items: LibraryExploration[] = []
  for (const entry of data as LibraryRow[]) {
    const mode = uiMode(entry.mode)
    const questions = questionList(entry.questions)
    if (!mode || (entry.status !== 'active' && entry.status !== 'completed') || !questions || typeof entry.updated_at !== 'string') {
      return { ok: false }
    }
    if (questions.length === 0) continue
    const visible = questions.filter(question => !question.is_hidden)
    items.push({
      id: entry.id,
      title: displayTitle(entry.title, questions),
      mode,
      status: entry.status,
      updatedAt: entry.updated_at,
      questionCount: visible.length,
      hiddenCount: questions.length - visible.length,
      prioritisedCount: visible.filter(question => question.is_prioritised).length,
    })
  }

  return { ok: true, items }
}
