import ExplorationLoadError from '@/components/exploration-load-error'
import ExplorationUnavailable from '@/components/exploration-unavailable'
import StoryScreen from '@/components/story-screen'
import { requireAuthenticatedClaims } from '@/lib/auth/session'
import { loadStorySource } from '@/lib/stories/load'

export const dynamic = 'force-dynamic'

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuthenticatedClaims()
  const { id } = await params
  const loaded = await loadStorySource(id)
  if (loaded.status === 'error') return <ExplorationLoadError retryHref={`/explorations/${id}/story`} />
  if (loaded.status === 'not-found') return <ExplorationUnavailable />
  return <StoryScreen source={loaded.source} />
}
