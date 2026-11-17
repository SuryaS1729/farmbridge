import { createRootRoute, createRoute, createRouter, Link } from '@tanstack/react-router'

import { AdminLayout } from '@/admin-layout'
import { DashboardPage } from '@/pages/dashboard'
import { FarmerDetailPage } from '@/pages/farmer-detail'
import { FarmersPage } from '@/pages/farmers'

const rootRoute = createRootRoute({
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
})

const farmersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/farmers',
  component: FarmersPage,
})

const farmerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/farmers/$farmerId',
  component: FarmerDetailPage,
})

const routeTree = rootRoute.addChildren([dashboardRoute, farmersRoute, farmerDetailRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
