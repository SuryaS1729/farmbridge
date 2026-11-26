import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';
import { profileQuery } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Space } from '@/constants/theme';
// Keep the native splash (app background colour) up until the first real screen is known.
SplashScreen.preventAutoHideAsync();

type OnboardingStatus = 'loading' | 'needed' | 'done' | 'error';

function ScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    posthog?.screen(pathname);
  }, [pathname]);

  return null;
}

// The provider sits above everything (including the loading and error screens)
// so the root layout itself can use queries, e.g. for the onboarding check.
export default function RootLayout() {
  return (
    // KeyboardProvider tracks the keyboard for react-native-keyboard-controller's components.
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <AppRoot />
      </QueryClientProvider>
    </KeyboardProvider>
  );
}

function AppRoot() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  // Same cache entry as Settings and Farm details. Saving the farm details form
  // writes the new profile into it, which flips this to 'done' and opens the app.
  // The cache is cleared on sign-out, so the next farmer is always re-checked.
  const profile = useQuery({ ...profileQuery, enabled: Boolean(userId) && !isAdmin });

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }

    posthog?.identify(session.user.id);
  }, [session?.user.id]);

  // Phones are often shared in a family: once signed out, drop every cached
  // quote, address and profile so the next person can never see them.
  // Runs after the farmer screens have unmounted, so no query is mid-use.
  useEffect(() => {
    if (!isPending && !userId) {
      queryClient.clear();
    }
  }, [isPending, userId]);

  // Cached data wins over a failed background refetch, so a signal drop later
  // never kicks an onboarded farmer back to the error screen.
  const onboardingStatus: OnboardingStatus = !session || isAdmin
    ? 'done'
    : profile.data
      ? profile.data.onboarded ? 'done' : 'needed'
      : profile.isError || profile.fetchStatus === 'paused'
        ? 'error' // failed, or offline: shows "Check your connection"; resumes by itself on reconnect
        : 'loading';

  // Hide the splash only once we know which screen to show (sign-in, onboarding,
  // Home or the connection error), so the farmer never sees a spinner or a wrong
  // screen flash past on launch.
  const ready = !isPending && onboardingStatus !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (isPending || onboardingStatus === 'loading') {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator/>
      </ThemedView>
    )
  }

  if (onboardingStatus === 'error') {
    return (
      <ThemedView style={styles.loading}>
        <View style={styles.errorBox}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Could not reach Farmbridge. Check your connection and try again.
          </ThemedText>
          <Button label="Try again" onPress={() => void profile.refetch()} />
          <Button
            label="Sign out"
            variant="outline"
            onPress={() => authClient.signOut()}
          />
        </View>
      </ThemedView>
    )
  }

  const content = (
    <>
      <ScreenTracker />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session) && onboardingStatus === 'needed'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session) && onboardingStatus === 'done'}>
          <Stack.Screen name="(farmer)" />
        </Stack.Protected>
      </Stack>
    </>
  )

  // Screens are tracked by ScreenTracker via Expo Router's usePathname.
  // PostHog's own screen capture expects plain React Navigation and runs
  // before Expo Router's navigator mounts, so keep it off.
  return posthog ? (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false }}>
      {content}
    </PostHogProvider>
  ) : content
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    width: '100%',
    maxWidth: 430,
    paddingHorizontal: Space.page,
    gap: Space.three,
  },
  centerText: {
    textAlign: 'center',
  },
});
