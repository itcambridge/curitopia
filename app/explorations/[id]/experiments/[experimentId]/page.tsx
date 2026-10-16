import ExperimentScreen from '@/components/experiment-screen'
import ExplorationLoadError from '@/components/exploration-load-error'
import ExplorationUnavailable from '@/components/exploration-unavailable'
import { requireAuthenticatedClaims } from '@/lib/auth/session'
import { loadExperiment } from '@/lib/experiments/load'

export const dynamic = 'force-dynamic'

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string; experimentId: string }>
}) {
  await requireAuthenticatedClaims()
  const { id, experimentId } = await params
  const loaded = await loadExperiment(id, experimentId)
  if (loaded.status === 'error') return <ExplorationLoadError retryHref={`/explorations/${id}/experiments/${experimentId}`} />
  if (loaded.status === 'not-found') return <ExplorationUnavailable />
  return <ExperimentScreen experiment={loaded.experiment} />
}
