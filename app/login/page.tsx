import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const linkError = error === 'link'
    ? 'This confirmation link is invalid or has expired. Request a new one, or create an account.'
    : undefined

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          <Link href="/forgot-password">Forgot password</Link>
          <Link href="/signup">Create an account</Link>
        </>
      }
    >
      <LoginForm linkError={linkError} />
    </AuthCard>
  )
}
