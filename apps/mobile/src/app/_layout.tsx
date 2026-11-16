import { authClient } from '@/lib/auth-client';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';
SplashScreen.preventAutoHideAsync();

function ScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    posthog?.screen(pathname);
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }

    posthog?.identify(session.user.id);
  }, [session?.user.id]);

  if (isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator/>
      </View>
    )
  }


  const content = (
    <>
      <ScreenTracker />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="(farmer)" />
        </Stack.Protected>
      </Stack>
      <AnimatedSplashOverlay />
    </>
  )

  return posthog ? <PostHogProvider client={posthog}>{content}</PostHogProvider> : content
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
