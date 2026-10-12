import ExplorationLoadError from '@/components/exploration-load-error'
import ExplorationScreen from '@/components/exploration-screen'
import ExplorationUnavailable from '@/components/exploration-unavailable'
import { requireAuthenticatedClaims } from '@/lib/auth/session'
import { loadExploration } from '@/lib/explorations/load'

export const dynamic = 'force-dynamic'

export default async function ExplorationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requireAuthenticatedClaims()
  const { id } = await params
  const { error } = await searchParams
  const loaded = await loadExploration(id)
  if (loaded.status === 'error') return <ExplorationLoadError retryHref={`/explorations/${id}`} />
  if (loaded.status === 'not-found') return <ExplorationUnavailable />
  return <ExplorationScreen signOutError={error === 'signout'} initialExploration={loaded.exploration} />
}
