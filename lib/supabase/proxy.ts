import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasSupabaseEnv, supabaseEnv } from '@/lib/supabase/env'

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`)) || pathname === '/auth' || pathname.startsWith('/auth/')
}

function redirectWithSession(request: NextRequest, sessionResponse: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirectResponse = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach(({ name, value }) => {
    redirectResponse.cookies.set(name, value)
  })
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = sessionResponse.headers.get(header)
    if (value) redirectResponse.headers.set(header, value)
  }
  return redirectResponse
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    if (!isPublicPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  const { url, key } = supabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([keyName, value]) => {
          supabaseResponse.headers.set(keyName, value)
        })
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const signedIn = Boolean(claims && claims.role === 'authenticated' && claims.is_anonymous !== true)
  const { pathname } = request.nextUrl

  if (!signedIn && !isPublicPath(pathname)) {
    if (pathname.startsWith('/api/')) return supabaseResponse
    return redirectWithSession(request, supabaseResponse, '/login')
  }

  if (signedIn && (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password')) {
    return redirectWithSession(request, supabaseResponse, '/')
  }

  return supabaseResponse
}
