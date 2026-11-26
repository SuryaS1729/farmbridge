import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useRef } from "react";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FarmDetailsForm } from "@/components/farm-details-form";
import { Button } from "@/components/ui/button";
import { FORM_KEYBOARD_BOTTOM_OFFSET, FormKeyboardToolbar } from "@/components/ui/form-keyboard-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { authClient } from "@/lib/auth-client";
import { loadState, profileQuery } from "@/lib/queries";

export default function EditFarmDetailsScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;

  // Usually already cached from Profile, so the form opens filled in.
  const profileResult = useQuery(profileQuery);
  const profile = profileResult.data?.profile ?? null;
  const { loading, error } = loadState(profileResult);

  return (
    <ThemedView style={styles.screen}>
      {/* Scrolls the focused field above the keyboard and the toolbar on top of it. */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.screen}
        bottomOffset={FORM_KEYBOARD_BOTTOM_OFFSET}
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
            <ThemedText type="smallBold">← Profile</ThemedText>
          </Pressable>
          <ThemedText type="label" themeColor="textSecondary">
            FARM DETAILS
          </ThemedText>
        </View>

        <View style={styles.intro}>
          <ThemedText type="title">Edit profile</ThemedText>
          <ThemedText themeColor="textSecondary">
            Keep your name exactly as it appears on your Aadhaar card.
          </ThemedText>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <View style={styles.intro}>
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
            <Button label="Try again" variant="outline" onPress={() => void profileResult.refetch()} />
          </View>
        ) : (
          <FarmDetailsForm
            initial={profile}
            phoneNumber={phoneNumber}
            scrollRef={scrollRef}
            submitLabel="Save changes"
            onSaved={() => router.back()}
          />
        )}
      </KeyboardAwareScrollView>
      <FormKeyboardToolbar />
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
