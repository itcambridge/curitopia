import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset password" footer={<Link href="/login">Back to sign in</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
