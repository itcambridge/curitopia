'use server'

import { getAuthenticatedClaims } from '@/lib/auth/session'
import { experimentItemBody, experimentItemKind, mayOpenExperiment, type ExperimentItemKind } from '@/lib/experiments/rules'
import { missingImagePathColumn, THUMBNAIL_BUCKET, thumbnailPathForItem } from '@/lib/experiments/thumbnail'
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
  relatedItemId: string | null
  imagePath?: string | null
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

function savedItem(row: unknown, experimentId: string): SavedExperimentItem | null {
  if (!row || typeof row !== 'object') return null
  const record = row as { id?: unknown; kind?: unknown; body?: unknown; position?: unknown; related_item_id?: unknown; image_path?: unknown }
  if (typeof record.id !== 'string' || typeof record.kind !== 'string' || typeof record.body !== 'string' || typeof record.position !== 'number') return null
  const kind = experimentItemKind(record.kind)
  if (!kind || !isUuid(record.id)) return null
  if (record.related_item_id != null && (typeof record.related_item_id !== 'string' || !isUuid(record.related_item_id) || record.related_item_id === record.id)) return null
  const imagePath = typeof record.image_path === 'string' && thumbnailPathForItem(record.image_path, experimentId, record.id) ? record.image_path : record.image_path === undefined ? undefined : null
  return { id: record.id, kind, body: record.body, position: record.position, relatedItemId: record.related_item_id ?? null, imagePath }
}

async function acceptedRelation(supabase: Awaited<ReturnType<typeof createClient>>, experimentId: string, itemId: string, relatedItemId: string | null) {
  if (relatedItemId === null) return null
  if (!isUuid(relatedItemId) || relatedItemId === itemId) return undefined
  const target = await supabase
    .from('experiment_items')
    .select('id')
    .eq('id', relatedItemId)
    .eq('experiment_id', experimentId)
    .maybeSingle()
  if (target.error || !target.data) return undefined
  return relatedItemId
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
  relatedItemId: string | null
}): Promise<SaveExperimentItemResult> {
  const kind = experimentItemKind(input.kind)
  const body = experimentItemBody(input.body)
  if (!kind || !body || !isUuid(input.itemId)) return { ok: false }
  const supabase = await experimentForOwner(input.explorationId, input.experimentId)
  if (!supabase) return { ok: false }
  const relatedItemId = await acceptedRelation(supabase, input.experimentId, input.itemId, input.relatedItemId)
  if (relatedItemId === undefined) return { ok: false }

  const probed = await supabase
    .from('experiment_items')
    .select('id, image_path')
    .eq('id', input.itemId)
    .eq('experiment_id', input.experimentId)
    .maybeSingle()
  let rowExists = false
  if (probed.error && missingImagePathColumn(probed.error)) {
    const idOnly = await supabase
      .from('experiment_items')
      .select('id')
      .eq('id', input.itemId)
      .eq('experiment_id', input.experimentId)
      .maybeSingle()
    if (idOnly.error) return { ok: false }
    rowExists = Boolean(idOnly.data)
  } else if (probed.error) {
    return { ok: false }
  } else {
    rowExists = Boolean(probed.data)
  }

  const values = { kind, body, related_item_id: relatedItemId, updated_at: new Date().toISOString() }
  const withImage = 'id, kind, body, position, related_item_id, image_path'
  const withoutImage = 'id, kind, body, position, related_item_id'
  const write = (columns: string) => rowExists
    ? supabase.from('experiment_items').update(values).eq('id', input.itemId).eq('experiment_id', input.experimentId).select(columns).maybeSingle()
    : supabase.from('experiment_items').insert({ id: input.itemId, experiment_id: input.experimentId, kind, body, related_item_id: relatedItemId }).select(columns).maybeSingle()
  let written = await write(withImage)
  if (written.error && missingImagePathColumn(written.error)) written = await write(withoutImage)
  if (written.error) return { ok: false }
  const item = savedItem(written.data, input.experimentId)
  if (!item) return { ok: false }
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
  const current = await supabase
    .from('experiment_items')
    .select('image_path')
    .eq('id', input.itemId)
    .eq('experiment_id', input.experimentId)
    .maybeSingle()
  const imagePath = !current.error && typeof current.data?.image_path === 'string' ? current.data.image_path : null
  const removed = await supabase
    .from('experiment_items')
    .delete()
    .eq('id', input.itemId)
    .eq('experiment_id', input.experimentId)
    .select('id')
  if (removed.error || !removed.data?.length) return { ok: false }
  if (imagePath && thumbnailPathForItem(imagePath, input.experimentId, input.itemId)) {
    await supabase.storage.from(THUMBNAIL_BUCKET).remove([imagePath])
  }
  await touchExperiment(supabase, input.explorationId, input.experimentId)
  return { ok: true }
}
