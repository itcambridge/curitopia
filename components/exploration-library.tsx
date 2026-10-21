import { signOut } from '@/lib/auth/actions'
import type { LibraryExploration } from '@/lib/explorations/types'

const activityFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function activityLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Last activity unavailable'
  return `Last activity ${activityFormat.format(date)}`
}

export default function ExplorationLibrary({
  items,
  loadError = false,
  signOutError = false,
}: {
  items: LibraryExploration[]
  loadError?: boolean
  signOutError?: boolean
}) {
  return (
    <main className="library-shell">
      <header className="library-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><img src="/logo-removebg-preview.png" alt="" /></div>
          <div>
            <div className="brand-name">curitopia</div>
            <div className="tagline">Ask. Experiment. Create.</div>
          </div>
        </div>
        <form action={signOut}>
          <button className="sign-out" type="submit">Sign out</button>
        </form>
      </header>
      <div className="library-body">
        <div className="library-intro">
          <h1>Previous explorations</h1>
          <a className="add-button library-start" href="/explorations/new">Start new exploration</a>
        </div>
        {signOutError ? <p className="composer-error" role="alert">Sign-out did not complete. Try again.</p> : null}
        {loadError ? (
          <section className="panel library-empty" role="alert">
            <p>Could not load your explorations.</p>
            <a className="retry-save" href="/">Retry</a>
          </section>
        ) : items.length === 0 ? (
          <section className="panel library-empty">
            <p>Saved explorations appear here after you add the first question.</p>
          </section>
        ) : (
          <ul className="library-list">
            {items.map(item => {
              return (
                <li key={item.id}>
                  <a href={`/explorations/${item.id}`}>
                    <span className="library-title">{item.title}</span>
                    <span className="library-meta">
                      <span>{item.mode}</span>
                    </span>
                    <span className="library-counts">{item.questionCount} {item.questionCount === 1 ? 'question' : 'questions'} · {item.prioritisedCount} prioritised{item.hiddenCount > 0 ? ` · ${item.hiddenCount} hidden` : ''}</span>
                    <time dateTime={item.updatedAt}>{activityLabel(item.updatedAt)}</time>
                    <span className="library-action">Continue</span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
