import { createContext, useContext } from 'react'

import type { AdminSession } from '@/lib/api'

type AdminAuth = {
  session: AdminSession
  signOut: () => Promise<void>
  signingOut: boolean
  signOutError: string | null
}

export const AdminAuthContext = createContext<AdminAuth | null>(null)

export function useAdminAuth() {
  const value = useContext(AdminAuthContext)
  if (!value) {
    throw new Error('useAdminAuth must be used inside AdminAuthContext.')
  }
  return value
}
