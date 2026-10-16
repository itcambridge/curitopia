import { experimentItemKind, type ExperimentItemKind } from '@/lib/experiments/rules'
import { createClient } from '@/lib/supabase/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ExperimentItem = {
  id: string
  kind: ExperimentItemKind
  body: string
  position: number
}

export type LoadedExperiment = {
  id: string
  explorationId: string
  questionId: string
  questionText: string
  items: ExperimentItem[]
}

export type ExperimentLink = { id: string; questionId: string }

function isUuid(value: string) {
  return uuidPattern.test(value)
}

export function missingExperimentsTable(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('public.experiments')
}

function missingExperimentItemsTable(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return (error.code === '42P01' || error.code === 'PGRST205') && message.includes('experiment_items')
}

export async function loadExperimentLinks(explorationId: string): Promise<{ ok: true; links: ExperimentLink[] } | { ok: false; missing: boolean }> {
  if (!isUuid(explorationId)) return { ok: false, missing: false }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('experiments')
    .select('id, question_id')
    .eq('exploration_id', explorationId)
  if (error) return { ok: false, missing: missingExperimentsTable(error) }
  const links: ExperimentLink[] = []
  for (const row of data ?? []) {
    if (typeof row.id !== 'string' || typeof row.question_id !== 'string' || !isUuid(row.id) || !isUuid(row.question_id)) {
      return { ok: false, missing: false }
    }
    links.push({ id: row.id, questionId: row.question_id })
  }
  return { ok: true, links }
}

export async function loadExperiment(explorationId: string, experimentId: string): Promise<{ status: 'ok'; experiment: LoadedExperiment } | { status: 'not-found' } | { status: 'error' }> {
  if (!isUuid(explorationId) || !isUuid(experimentId)) return { status: 'not-found' }
  const supabase = await createClient()
  const loaded = await supabase
    .from('experiments')
    .select('id, exploration_id, question_id')
    .eq('id', experimentId)
    .eq('exploration_id', explorationId)
    .maybeSingle()
  if (loaded.error) return { status: 'error' }
  if (!loaded.data) return { status: 'not-found' }

  const question = await supabase
    .from('questions')
    .select('id, question_text, exploration_id')
    .eq('id', loaded.data.question_id)
    .eq('exploration_id', explorationId)
    .maybeSingle()
  if (question.error) return { status: 'error' }
  if (!question.data || typeof question.data.question_text !== 'string') return { status: 'not-found' }

  const items = await supabase
    .from('experiment_items')
    .select('id, position, kind, body')
    .eq('experiment_id', experimentId)
    .order('position', { ascending: true })
  if (items.error && !missingExperimentItemsTable(items.error)) return { status: 'error' }
  const parsed: ExperimentItem[] = []
  if (!items.error) {
    for (const row of items.data ?? []) {
      const kind = typeof row.kind === 'string' ? experimentItemKind(row.kind) : null
      if (!kind || typeof row.id !== 'string' || !isUuid(row.id) || typeof row.body !== 'string' || typeof row.position !== 'number') {
        return { status: 'error' }
      }
      parsed.push({ id: row.id, kind, body: row.body, position: row.position })
    }
  }

  return {
    status: 'ok',
    experiment: {
      id: loaded.data.id,
      explorationId,
      questionId: question.data.id,
      questionText: question.data.question_text,
      items: parsed,
    },
  }
}
