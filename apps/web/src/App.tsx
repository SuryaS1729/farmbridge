import { RouterProvider } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdminAuthContext } from '@/lib/admin-auth'
import { apiRequest, getErrorMessage, type AdminSession } from '@/lib/api'
import { LoginPage } from '@/pages/login'
import { router } from '@/router'

function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<AdminSession>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const checkAdminSession = useCallback(async () => {
    const current = await apiRequest<AdminSession>('/api/auth/get-session')
    if (!current?.user.phoneNumberVerified) {
      setSession(null)
      return
    }

    await apiRequest<{ role: 'admin' }>('/api/admin/claim', { method: 'POST' })
    setSession(current)
  }, [])

  useEffect(() => {
    let active = true
    void checkAdminSession()
      .catch((error) => {
        if (active) {
          setSession(null)
          setSessionError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [checkAdminSession])

  const signOut = useCallback(async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      const result = await apiRequest<{ success: boolean }>('/api/auth/sign-out', {
        method: 'POST',
        body: {},
      })
      if (!result.success) {
        throw new Error('The API did not confirm sign-out.')
      }

      const remainingSession = await apiRequest<AdminSession>('/api/auth/get-session')
      if (remainingSession) {
        throw new Error('Your session is still active. Please try again.')
      }

      setSession(null)
      setSessionError(null)
    } catch (error) {
      setSignOutError(getErrorMessage(error))
    } finally {
      setSigningOut(false)
    }
  }, [])

  const auth = useMemo(
    () => ({ session, signOut, signingOut, signOutError }),
    [session, signOut, signingOut, signOutError],
  )

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background" aria-live="polite">
        <span className="flex size-10 animate-pulse items-center justify-center bg-primary font-heading text-primary-foreground" aria-hidden="true">
          F
        </span>
        <p className="text-xs text-muted-foreground">Opening Farmbridge…</p>
      </main>
    )
  }

  if (!session) {
    return <LoginPage onSignedIn={checkAdminSession} initialError={sessionError} />
  }

  return (
    <AdminAuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AdminAuthContext.Provider>
  )
}

export default App
