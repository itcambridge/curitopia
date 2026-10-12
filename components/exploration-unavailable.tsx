import { signOut } from '@/lib/auth/actions'

export default function ExplorationUnavailable() {
  return (
    <main className="app-shell">
      <section className="load-panel">
        <p role="status">This exploration is not available.</p>
        <a className="retry-save" href="/">Previous explorations</a>
        <form action={signOut}>
          <button className="sign-out" type="submit">Sign out</button>
        </form>
      </section>
    </main>
  )
}
