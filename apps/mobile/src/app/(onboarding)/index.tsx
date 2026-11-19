import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FarmDetailsForm } from "@/components/farm-details-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { authClient } from "@/lib/auth-client";

export default function FarmDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Space.four,
              paddingBottom: insets.bottom + Space.four,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.brandBar}>
              <ThemedText type="smallBold" style={styles.wordmark}>
                FARMBRIDGE
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                ANDHRA PRADESH
              </ThemedText>
            </View>

            <View style={styles.intro}>
              <ThemedText type="label" themeColor="textSecondary">
                NEW FARMER · FARM DETAILS
              </ThemedText>
              <ThemedText type="title">Tell us about your cocoa farm.</ThemedText>
              <ThemedText themeColor="textSecondary">
                We need these once before you can sell. Write your name exactly
                as it appears on your Aadhaar card.
              </ThemedText>
            </View>

            <FarmDetailsForm
              phoneNumber={phoneNumber}
              submitLabel="Save and continue  →"
            />

            <Pressable onPress={() => authClient.signOut()} style={styles.signOut}>
              <ThemedText type="label" themeColor="textSecondary">
                WRONG NUMBER? SIGN OUT
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Space.page,
  },
  content: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    gap: Space.six,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: { letterSpacing: 2 },
  intro: { gap: Space.two },
  signOut: { alignSelf: "center", paddingVertical: Space.two },
});
