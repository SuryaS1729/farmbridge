import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FarmDetailsForm } from "@/components/farm-details-form";
import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { authClient } from "@/lib/auth-client";
import { getFarmerProfile, type FarmerProfile } from "@/lib/farmbridge-api";

export default function EditFarmDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;

  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFarmerProfile()
      .then((result) => {
        if (!cancelled) setProfile(result.profile);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your farm details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Space.four,
              paddingBottom: insets.bottom + Space.seven,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topline}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ThemedText type="smallBold">← Settings</ThemedText>
            </Pressable>
            <ThemedText type="label" themeColor="textSecondary">
              FARM DETAILS
            </ThemedText>
          </View>

          <View style={styles.intro}>
            <ThemedText type="title">Edit farm details</ThemedText>
            <ThemedText themeColor="textSecondary">
              Keep your name exactly as it appears on your Aadhaar card.
            </ThemedText>
          </View>

          {loading ? (
            <ActivityIndicator />
          ) : error ? (
            <View style={styles.intro}>
              <ThemedText themeColor="textSecondary">{error}</ThemedText>
              <Button label="Try again" variant="outline" onPress={() => setAttempt((n) => n + 1)} />
            </View>
          ) : (
            <FarmDetailsForm
              initial={profile}
              phoneNumber={phoneNumber}
              submitLabel="Save changes"
              onSaved={() => router.back()}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: Space.six,
    paddingHorizontal: Space.page,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { paddingVertical: Space.two, paddingRight: Space.four },
  intro: { gap: Space.two },
});
