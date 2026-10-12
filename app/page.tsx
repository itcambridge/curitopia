import ExplorationLibrary from '@/components/exploration-library'
import { requireAuthenticatedClaims } from '@/lib/auth/session'
import { loadExplorationLibrary } from '@/lib/explorations/load'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireAuthenticatedClaims()
  const { error } = await searchParams
  const loaded = await loadExplorationLibrary()
  if (!loaded.ok) return <ExplorationLibrary items={[]} loadError signOutError={error === 'signout'} />
  return <ExplorationLibrary items={loaded.items} signOutError={error === 'signout'} />
}
