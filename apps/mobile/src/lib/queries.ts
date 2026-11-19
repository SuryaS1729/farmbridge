import { onlineManager, queryOptions, type UseQueryResult } from '@tanstack/react-query';

import {
  getAddresses,
  getFarmerProfile,
  getMyQuotes,
  getTodayPrice,
} from '@/lib/farmbridge-api';

/** One cache entry per kind of data, shared by every screen that shows it. */
export const queryKeys = {
  todayPrice: ['price', 'today'] as const,
  profile: ['profile'] as const,
  addresses: ['addresses'] as const,
  quotes: ['quotes'] as const,
};

export const todayPriceQuery = queryOptions({
  queryKey: queryKeys.todayPrice,
  queryFn: getTodayPrice,
});

export const profileQuery = queryOptions({
  queryKey: queryKeys.profile,
  queryFn: getFarmerProfile,
});

export const addressesQuery = queryOptions({
  queryKey: queryKeys.addresses,
  queryFn: getAddresses,
});

export const quotesQuery = queryOptions({
  queryKey: queryKeys.quotes,
  queryFn: getMyQuotes,
});

/** Message for a failed save: says "offline" plainly instead of a raw network error. */
export function actionErrorMessage(error: unknown, fallback: string) {
  if (!onlineManager.isOnline()) {
    return "You're offline. Nothing was saved. Connect to the internet and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

export const OFFLINE_MESSAGE = "You're offline. This will load when you're back online.";

/**
 * Turns a query into what a screen shows. A first load started offline is paused
 * (not failed) until the phone reconnects, so show an offline note instead of a
 * spinner that never ends. Pass `failMessage` to replace the API's error text.
 */
export function loadState(query: UseQueryResult<unknown>, failMessage?: string) {
  const offline = query.isPending && query.fetchStatus === 'paused';
  const error = query.isError
    ? (failMessage ?? (query.error instanceof Error ? query.error.message : 'Something went wrong.'))
    : offline
      ? OFFLINE_MESSAGE
      : null;
  return { loading: query.isPending && !offline, error };
}
