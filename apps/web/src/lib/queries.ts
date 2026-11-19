import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin data changes when farmers act in the app; refetch on focus, but don't hammer the API.
      staleTime: 30_000,
      // API errors are usually real (404, 403); one retry covers flaky networks without long waits.
      retry: 1,
    },
  },
})

/** Shared query keys so mutations anywhere can invalidate the right data. */
export const queryKeys = {
  farmers: ['farmers'] as const,
  farmer: (farmerId: string) => ['farmers', farmerId] as const,
  todayPrice: ['price', 'today'] as const,
  /** Prefix for every offer queue; invalidate this to refresh all status/filter combinations. */
  offers: ['offers'] as const,
  offerQueue: (status: string, params: Record<string, string>) => ['offers', status, params] as const,
  deals: ['deals'] as const,
}
