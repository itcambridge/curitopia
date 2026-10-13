'use server'

import type { DatabaseMode, PerspectiveOrigin, QuestionRole, SaveResult } from '@/lib/explorations/types'
import { createClient } from '@/lib/supabase/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const origins: readonly PerspectiveOrigin[] = ['investigate', 'reframe', 'connect', 'challenge']

type PostgrestFailure = { code?: string } | null

function isUuid(value: string) {
  return uuidPattern.test(value)
}

function questionText(value: string) {
  const text = value.trim()
  if (text.length < 1 || text.length > 2000) return null
  return text
}

function originOrNull(value: PerspectiveOrigin | null, mode: DatabaseMode) {
  if (value === null) return null
  if (mode === 'quickfire' || !origins.includes(value)) return undefined
  return value
}

function duplicateKey(error: PostgrestFailure) {
  return error?.code === '23505'
}

async function confirmStored(table: 'explorations' | 'questions', id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from(table).select('id').eq('id', id).maybeSingle()
  return !error && !!data
}

export async function createExplorationWithFirstQuestion(input: {
  explorationId: string
  questionId: string
  mode: DatabaseMode
  questionText: string
  role: QuestionRole
  perspectiveOrigin: PerspectiveOrigin | null
}): Promise<SaveResult> {
  const text = questionText(input.questionText)
  const origin = originOrNull(input.perspectiveOrigin, input.mode)
  const roleMatches = input.mode === 'focus' ? input.role === 'central' : input.role === 'satellite'
  if (!text || origin === undefined || !roleMatches || !isUuid(input.explorationId) || !isUuid(input.questionId)) {
    return { ok: false }
  }
  if (input.mode !== 'focus' && input.mode !== 'quickfire') return { ok: false }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_exploration_with_first_question', {
    p_exploration_id: input.explorationId,
    p_question_id: input.questionId,
    p_mode: input.mode,
    p_question_text: text,
    p_role: input.role,
    p_title: null,
    p_perspective_origin: origin,
  })

  if (!error) return { ok: true }
  if (duplicateKey(error) && await confirmStored('explorations', input.explorationId) && await confirmStored('questions', input.questionId)) {
    return { ok: true }
  }
  return { ok: false }
}

export async function saveQuestion(input: {
  explorationId: string
  questionId: string
  questionText: string
  role: QuestionRole
  perspectiveOrigin: PerspectiveOrigin | null
}): Promise<SaveResult> {
  const text = questionText(input.questionText)
  if (!text || !isUuid(input.explorationId) || !isUuid(input.questionId)) return { ok: false }
  if (input.role !== 'central' && input.role !== 'satellite') return { ok: false }
  if (input.perspectiveOrigin !== null && !origins.includes(input.perspectiveOrigin)) return { ok: false }

  const supabase = await createClient()
  const { error } = await supabase.from('questions').insert({
    id: input.questionId,
    exploration_id: input.explorationId,
    question_text: text,
    role: input.role,
    perspective_origin: input.perspectiveOrigin,
    is_prioritised: false,
    is_hidden: false,
  })

  if (!error) return { ok: true }
  if (duplicateKey(error) && await confirmStored('questions', input.questionId)) return { ok: true }
  return { ok: false }
}

export async function saveExplorationMode(input: { explorationId: string; mode: DatabaseMode }): Promise<SaveResult> {
  if (!isUuid(input.explorationId) || (input.mode !== 'focus' && input.mode !== 'quickfire')) return { ok: false }
  const supabase = await createClient()
  const { data, error } = await supabase.from('explorations').update({ mode: input.mode }).eq('id', input.explorationId).select('id')
  if (error || !data?.length) return { ok: false }
  return { ok: true }
}

export async function saveExplorationStatus(input: { explorationId: string }): Promise<SaveResult> {
  if (!isUuid(input.explorationId)) return { ok: false }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('explorations')
    .update({ status: 'completed' })
    .eq('id', input.explorationId)
    .select('id')
  if (error || !data?.length) return { ok: false }
  return { ok: true }
}

export async function saveQuestionPriority(input: { questionId: string; isPrioritised: boolean }): Promise<SaveResult> {
  if (!isUuid(input.questionId) || typeof input.isPrioritised !== 'boolean') return { ok: false }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .update({ is_prioritised: input.isPrioritised })
    .eq('id', input.questionId)
    .select('id')
  if (error || !data?.length) return { ok: false }
  return { ok: true }
}

function hideReason(error: { code?: string; message?: string; details?: string }): 'central' | 'last-visible' | undefined {
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (text.includes('last visible question')) return 'last-visible'
  if (error.code === '23514' || text.includes('questions_central_stays_visible')) return 'central'
  return undefined
}

async function storedHidden(questionId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('questions').select('is_hidden').eq('id', questionId).maybeSingle()
  if (error || !data || typeof data.is_hidden !== 'boolean') return undefined
  return data.is_hidden
}

export async function saveQuestionHidden(input: { questionId: string; isHidden: boolean }): Promise<SaveResult> {
  if (!isUuid(input.questionId) || typeof input.isHidden !== 'boolean') return { ok: false }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .update({ is_hidden: input.isHidden })
    .eq('id', input.questionId)
    .select('id, is_hidden')
  if (!error && data?.length && data[0]?.is_hidden === input.isHidden) return { ok: true }

  const stored = await storedHidden(input.questionId)
  if (stored === input.isHidden) return { ok: true }
  return { ok: false, reason: error ? hideReason(error) : undefined, ...(typeof stored === 'boolean' ? { storedHidden: stored } : {}) }
}
