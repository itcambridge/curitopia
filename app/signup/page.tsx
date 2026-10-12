import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return (
    <AuthCard title="Create account" footer={<Link href="/login">Already have an account? Sign in</Link>}>
      <SignupForm />
    </AuthCard>
  )
}
