import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { getAuthenticatedClaims } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, claims] = await Promise.all([searchParams, getAuthenticatedClaims()])
  const linkError = !claims && error === 'link'

  return (
    <AuthCard title="Choose a new password" footer={<Link href="/login">Back to sign in</Link>}>
      {claims ? <ResetPasswordForm /> : (
        <p className="auth-message error" role="alert">
          {linkError
            ? 'This password reset link is invalid or has expired.'
            : 'Open the reset link from your email, then choose a new password.'}
        </p>
      )}
      {!claims ? <p className="auth-footer"><Link href="/forgot-password">Request a new link</Link></p> : null}
    </AuthCard>
  )
}
