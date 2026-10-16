'use server'

import { getAuthenticatedClaims } from '@/lib/auth/session'
import { experimentItemBody, experimentItemKind, mayOpenExperiment, type ExperimentItemKind } from '@/lib/experiments/rules'
import { createClient } from '@/lib/supabase/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type OpenExperimentResult = { ok: true; experimentId: string } | { ok: false }

function isUuid(value: string) {
  return uuidPattern.test(value)
}

function missingExperimentsTable(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('experiments')
}

export async function openExperiment(input: {
  explorationId: string
  questionId: string
  experimentId: string
}): Promise<OpenExperimentResult> {
  if (!isUuid(input.explorationId) || !isUuid(input.questionId) || !isUuid(input.experimentId)) return { ok: false }
  const claims = await getAuthenticatedClaims()
  const userId = typeof claims?.sub === 'string' ? claims.sub : null
  if (!userId || !isUuid(userId)) return { ok: false }

  const supabase = await createClient()
  const existing = await supabase
    .from('experiments')
    .select('id')
    .eq('exploration_id', input.explorationId)
    .eq('question_id', input.questionId)
    .maybeSingle()
  if (existing.error) return { ok: false }
  if (existing.data?.id && isUuid(existing.data.id)) return { ok: true, experimentId: existing.data.id }

  const question = await supabase
    .from('questions')
    .select('id, is_prioritised, exploration_id')
    .eq('id', input.questionId)
    .eq('exploration_id', input.explorationId)
    .maybeSingle()
  if (question.error || !question.data || !mayOpenExperiment({ prioritised: question.data.is_prioritised === true, existingExperimentId: null })) {
    return { ok: false }
  }

  const inserted = await supabase.from('experiments').insert({
    id: input.experimentId,
    user_id: userId,
    exploration_id: input.explorationId,
    question_id: input.questionId,
  }).select('id')
  if (!inserted.error && inserted.data?.[0]?.id === input.experimentId) return { ok: true, experimentId: input.experimentId }

  if (inserted.error && missingExperimentsTable(inserted.error)) return { ok: false }
  const again = await supabase
    .from('experiments')
    .select('id')
    .eq('exploration_id', input.explorationId)
    .eq('question_id', input.questionId)
    .maybeSingle()
  if (again.data?.id && isUuid(again.data.id)) return { ok: true, experimentId: again.data.id }
  return { ok: false }
}

export type SavedExperimentItem = {
  id: string
  kind: ExperimentItemKind
  body: string
  position: number
}

export type SaveExperimentItemResult = { ok: true; item: SavedExperimentItem } | { ok: false }

async function experimentForOwner(explorationId: string, experimentId: string) {
  if (!isUuid(explorationId) || !isUuid(experimentId)) return null
  const claims = await getAuthenticatedClaims()
  const userId = typeof claims?.sub === 'string' ? claims.sub : null
  if (!userId || !isUuid(userId)) return null
  const supabase = await createClient()
  const owned = await supabase
    .from('experiments')
    .select('id')
    .eq('id', experimentId)
    .eq('exploration_id', explorationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (owned.error || !owned.data) return null
  return supabase
}

function savedItem(row: { id?: string; kind?: string; body?: string; position?: number } | null): SavedExperimentItem | null {
  if (!row || typeof row.id !== 'string' || typeof row.kind !== 'string' || typeof row.body !== 'string' || typeof row.position !== 'number') return null
  const kind = experimentItemKind(row.kind)
  if (!kind || !isUuid(row.id)) return null
  return { id: row.id, kind, body: row.body, position: row.position }
}

async function touchExperiment(supabase: Awaited<ReturnType<typeof createClient>>, explorationId: string, experimentId: string) {
  await supabase
    .from('experiments')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', experimentId)
    .eq('exploration_id', explorationId)
}

export async function saveExperimentItem(input: {
  explorationId: string
  experimentId: string
  itemId: string
  kind: string
  body: string
}): Promise<SaveExperimentItemResult> {
  const kind = experimentItemKind(input.kind)
  const body = experimentItemBody(input.body)
  if (!kind || !body || !isUuid(input.itemId)) return { ok: false }
  const supabase = await experimentForOwner(input.explorationId, input.experimentId)
  if (!supabase) return { ok: false }

  const existing = await supabase
    .from('experiment_items')
    .select('id')
    .eq('id', input.itemId)
    .eq('experiment_id', input.experimentId)
    .maybeSingle()
  if (existing.error) return { ok: false }

  const written = existing.data
    ? await supabase
      .from('experiment_items')
      .update({ kind, body, updated_at: new Date().toISOString() })
      .eq('id', input.itemId)
      .eq('experiment_id', input.experimentId)
      .select('id, kind, body, position')
      .maybeSingle()
    : await supabase
      .from('experiment_items')
      .insert({ id: input.itemId, experiment_id: input.experimentId, kind, body })
      .select('id, kind, body, position')
      .maybeSingle()
  const item = savedItem(written.data)
  if (written.error || !item) return { ok: false }
  await touchExperiment(supabase, input.explorationId, input.experimentId)
  return { ok: true, item }
}

export async function deleteExperimentItem(input: {
  explorationId: string
  experimentId: string
  itemId: string
}): Promise<{ ok: true } | { ok: false }> {
  if (!isUuid(input.itemId)) return { ok: false }
  const supabase = await experimentForOwner(input.explorationId, input.experimentId)
  if (!supabase) return { ok: false }
  const removed = await supabase
    .from('experiment_items')
    .delete()
    .eq('id', input.itemId)
    .eq('experiment_id', input.experimentId)
    .select('id')
  if (removed.error || !removed.data?.length) return { ok: false }
  await touchExperiment(supabase, input.explorationId, input.experimentId)
  return { ok: true }
}
