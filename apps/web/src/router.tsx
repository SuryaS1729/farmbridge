import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, Link } from '@tanstack/react-router'

import { AdminLayout } from '@/admin-layout'
import { queryClient } from '@/lib/queries'
import {
  DashboardPage,
  dealsQueryOptions,
  defaultOfferQueueQueryOptions,
  todayPriceQueryOptions,
} from '@/pages/dashboard'
import { FarmerDetailPage, farmerDetailQueryOptions } from '@/pages/farmer-detail'
import { FarmersPage, farmersQueryOptions } from '@/pages/farmers'

/**
 * Waits for a loader's data but swallows failures: each page already shows its own
 * error message with "Try again", which is better than the router's generic error screen.
 */
function prime(promise: Promise<unknown>) {
  return promise.then(
    () => undefined,
    () => undefined,
  )
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AdminLayout,
  notFoundComponent: () => (
    <section className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-2 px-4 py-8 sm:px-8">
      <h1 className="font-heading text-2xl">Page not found.</h1>
      <Link to="/" className="text-xs underline">Back to the dashboard</Link>
    </section>
  ),
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
  loader: ({ context }) =>
    prime(
      Promise.all([
        context.queryClient.ensureQueryData(todayPriceQueryOptions),
        context.queryClient.ensureQueryData(defaultOfferQueueQueryOptions),
        context.queryClient.ensureQueryData(dealsQueryOptions),
      ]),
    ),
})

const farmersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/farmers',
  component: FarmersPage,
  loader: ({ context }) => prime(context.queryClient.ensureQueryData(farmersQueryOptions)),
})

const farmerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/farmers/$farmerId',
  component: FarmerDetailPage,
  loader: ({ context, params }) =>
    prime(context.queryClient.ensureQueryData(farmerDetailQueryOptions(params.farmerId))),
})

const routeTree = rootRoute.addChildren([dashboardRoute, farmersRoute, farmerDetailRoute])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Start a page's loader when a link is hovered or touched, before the click lands.
  defaultPreload: 'intent',
  // TanStack Query owns caching and freshness; the router shouldn't keep its own copy.
  defaultPreloadStaleTime: 0,
  // Shown only if a page's data takes over a second; fast loads just swap pages.
  defaultPendingComponent: () => (
    <div className="flex min-h-40 flex-1 items-center justify-center text-xs text-muted-foreground" aria-live="polite">
      Loading…
    </div>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
