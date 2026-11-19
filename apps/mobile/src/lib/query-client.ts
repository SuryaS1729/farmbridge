import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Screens show cached data instantly and refresh in the background after this.
      staleTime: 30_000,
      // Rural networks drop requests often; a couple of retries hides most blips.
      retry: 2,
    },
    mutations: {
      // Saves never wait in a hidden offline queue: they try now and, if offline,
      // fail with a clear message (see actionErrorMessage). A queued save could be
      // lost if the app is closed, and a queued quote could land at a stale price.
      networkMode: 'always',
    },
  },
});

// On the web build, TanStack Query already listens to the browser's focus and online events.
if (Platform.OS !== 'web') {
  // Pause requests while offline and resume them when the phone reconnects,
  // instead of failing with "Could not load…" on every signal drop.
  onlineManager.setEventListener((setOnline) => {
    let initialized = false;

    const subscription = Network.addNetworkStateListener((state) => {
      initialized = true;
      setOnline(!!state.isConnected);
    });

    Network.getNetworkStateAsync()
      .then((state) => {
        if (!initialized) setOnline(!!state.isConnected);
      })
      .catch(() => {
        // getNetworkStateAsync can reject on some platforms; the listener still covers changes.
      });

    return subscription.remove;
  });

  // Refetch stale data when the farmer switches back to the app.
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });
}
