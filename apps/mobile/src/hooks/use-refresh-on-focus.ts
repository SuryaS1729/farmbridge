import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Refetches these queries (if stale) when the screen comes back into focus, e.g.
 * returning to a tab or going back to it from a pushed screen. Mounting already
 * fetches, so the first focus is skipped.
 */
export function useRefreshOnFocus(...queryKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);
  // Callers pass inline keys; compare by value so focus effects don't re-run every render.
  const keysJson = JSON.stringify(queryKeys);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      for (const queryKey of JSON.parse(keysJson) as QueryKey[]) {
        void queryClient.refetchQueries({ queryKey, stale: true, type: 'active' });
      }
    }, [queryClient, keysJson]),
  );
}
