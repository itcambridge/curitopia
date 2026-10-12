import type { ReactNode } from 'react'

export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card panel">
        <header className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src="/logo-removebg-preview.png" alt="" />
          </div>
          <div>
            <div className="brand-name">curitopia</div>
            <div className="tagline">Keep asking. Go further.</div>
          </div>
        </header>
        <h1>{title}</h1>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
    </main>
  )
}
