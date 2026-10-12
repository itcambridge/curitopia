import ExplorationScreen from '@/components/exploration-screen'
import { requireAuthenticatedClaims } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function NewExplorationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireAuthenticatedClaims()
  const { error } = await searchParams
  return <ExplorationScreen signOutError={error === 'signout'} />
}
