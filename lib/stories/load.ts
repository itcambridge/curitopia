import { experimentItemKind } from '@/lib/experiments/rules'
import { loadExploration } from '@/lib/explorations/load'
import { storySource, type StoryItem, type StorySource } from '@/lib/stories/draft'
import { createClient } from '@/lib/supabase/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function missingItemsTable(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return (error.code === '42P01' || error.code === 'PGRST205') && message.includes('experiment_items')
}

/** Visible questions and experiment items for one exploration. Hidden question text is omitted. */
export async function loadStorySource(explorationId: string): Promise<{ status: 'ok'; source: StorySource } | { status: 'not-found' } | { status: 'error' }> {
  const loaded = await loadExploration(explorationId)
  if (loaded.status !== 'ok') return loaded

  const owned = new Map((loaded.exploration.experiments ?? []).map(link => [link.id, link.questionId]))
  const items: StoryItem[] = []

  if (owned.size > 0) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('experiment_items')
      .select('id, experiment_id, position, kind, body')
      .in('experiment_id', [...owned.keys()])
      .order('position', { ascending: true })
    if (error) {
      if (!missingItemsTable(error)) return { status: 'error' }
    } else {
      for (const row of data ?? []) {
        const kind = typeof row.kind === 'string' ? experimentItemKind(row.kind) : null
        const experimentId = typeof row.experiment_id === 'string' ? row.experiment_id : ''
        const questionId = owned.get(experimentId)
        if (!kind || !questionId || typeof row.id !== 'string' || !uuidPattern.test(row.id) || typeof row.body !== 'string' || typeof row.position !== 'number') {
          return { status: 'error' }
        }
        items.push({ id: row.id, experimentId, questionId, kind, body: row.body, position: row.position })
      }
    }
  }

  items.sort((left, right) => left.experimentId.localeCompare(right.experimentId) || left.position - right.position || left.id.localeCompare(right.id))
  return {
    status: 'ok',
    source: storySource(loaded.exploration.id, loaded.exploration.title ?? 'Untitled exploration', loaded.exploration.questions, items),
  }
}
