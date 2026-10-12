import { signOut } from '@/lib/auth/actions'

export default function ExplorationLoadError({ retryHref }: { retryHref: string }) {
  return (
    <main className="app-shell">
      <section className="load-panel">
        <p role="alert">Could not load this exploration.</p>
        <a className="retry-save" href={retryHref}>Retry</a>
        <a className="retry-save" href="/">Previous explorations</a>
        <form action={signOut}>
          <button className="sign-out" type="submit">Sign out</button>
        </form>
      </section>
    </main>
  )
}
