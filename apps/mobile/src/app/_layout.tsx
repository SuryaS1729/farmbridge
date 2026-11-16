import { authClient } from '@/lib/auth-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';
import { getFarmerProfile } from '@/lib/farmbridge-api';
import { OnboardingContext } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Space } from '@/constants/theme';
SplashScreen.preventAutoHideAsync();

type OnboardingStatus = 'loading' | 'needed' | 'done' | 'error';

function ScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    posthog?.screen(pathname);
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  // Keyed by user so a sign-out/sign-in as someone else re-checks.
  const [onboarding, setOnboarding] = useState<{
    userId: string;
    status: OnboardingStatus;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }

    posthog?.identify(session.user.id);
  }, [session?.user.id]);

  useEffect(() => {
    if (!userId || isAdmin) {
      return;
    }

    let cancelled = false;
    setOnboarding({ userId, status: 'loading' });

    getFarmerProfile()
      .then(({ onboarded }) => {
        if (!cancelled) {
          setOnboarding({ userId, status: onboarded ? 'done' : 'needed' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnboarding({ userId, status: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin, retryCount]);

  const markOnboarded = useCallback(() => {
    if (userId) {
      setOnboarding({ userId, status: 'done' });
    }
  }, [userId]);

  const onboardingContext = useMemo(() => ({ markOnboarded }), [markOnboarded]);

  const onboardingStatus: OnboardingStatus = !session
    ? 'done'
    : isAdmin
      ? 'done'
      : onboarding?.userId === userId
        ? onboarding.status
        : 'loading';

  if (isPending || onboardingStatus === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator/>
      </View>
    )
  }

  if (onboardingStatus === 'error') {
    return (
      <ThemedView style={styles.loading}>
        <View style={styles.errorBox}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Could not reach Farmbridge. Check your connection and try again.
          </ThemedText>
          <Button label="Try again" onPress={() => setRetryCount((n) => n + 1)} />
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
    <OnboardingContext.Provider value={onboardingContext}>
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
      <AnimatedSplashOverlay />
    </OnboardingContext.Provider>
  )

  return posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content
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
