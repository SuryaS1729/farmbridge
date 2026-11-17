import { RiLogoutBoxRLine } from '@remixicon/react'
import { Link, Outlet } from '@tanstack/react-router'

import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAdminAuth } from '@/lib/admin-auth'

const navLinkClass =
  'px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-muted [&.active]:font-medium [&.active]:text-foreground'

export function AdminLayout() {
  const { signOut, signingOut, signOutError } = useAdminAuth()

  return (
    <main className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-heading text-sm" aria-label="Farmbridge home">
            <span className="flex size-7 items-center justify-center bg-primary text-xs text-primary-foreground" aria-hidden="true">
              F
            </span>
            <span className="hidden sm:inline">farmbridge</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Admin sections">
            <Link to="/" className={navLinkClass} activeOptions={{ exact: true }}>
              Dashboard
            </Link>
            <Link to="/farmers" className={navLinkClass}>
              Farmers
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">Administrator</Badge>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => void signOut()} disabled={signingOut}>
            <RiLogoutBoxRLine data-icon="inline-start" aria-hidden />
            Sign out
          </Button>
        </div>
      </header>

      {signOutError ? (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-8">
          <Alert variant="destructive">
            <AlertDescription>{signOutError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Outlet />

      <footer className="flex justify-between border-t bg-background px-4 py-3 text-[10px] tracking-widest text-muted-foreground sm:px-8">
        <span>FARMBRIDGE ADMIN</span>
        <span>Local development · Asia/Kolkata</span>
      </footer>
    </main>
  )
}
