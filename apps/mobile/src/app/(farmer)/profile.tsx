import { useQuery } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTheme } from "@/hooks/use-theme";
import { addressesQuery, profileQuery, queryKeys } from "@/lib/queries";
import { authClient } from "@/lib/auth-client";
import { posthog } from "@/lib/posthog";

function formatPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;

  // Both are shared with other screens, so this page usually opens already filled in.
  const profileResult = useQuery(profileQuery);
  const addressResult = useQuery(addressesQuery);
  useRefreshOnFocus(queryKeys.profile, queryKeys.addresses);
  const name = profileResult.data?.profile?.aadhaarName?.trim();
  const addressCount = addressResult.data?.addresses.length;

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll need an SMS code to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          // Forget this farmer in analytics so the next person on a shared phone isn't linked to them.
          posthog?.reset();
          void authClient.signOut();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Space.four,
            paddingBottom: insets.bottom + Space.seven,
          },
        ]}
      >
        <View style={styles.topline}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ThemedText type="smallBold">← Home</ThemedText>
          </Pressable>
          <ThemedText type="label" themeColor="textSecondary">
            PROFILE
          </ThemedText>
        </View>

        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
            <Icon name="person" size={60} color={theme.accent} />
          </View>
          <View style={styles.identityText}>
            <ThemedText type="subtitle" style={styles.center}>
              {name || "Farmer"}
            </ThemedText>
            {formatPhone(phoneNumber) ? (
              <ThemedText type="small" themeColor="textSecondary">
                {formatPhone(phoneNumber)}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            hitSlop={8}
            onPress={() => router.push("/farm-details")}
            style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}
          >
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Edit profile
            </ThemedText>
            <Icon name="chevronRight" size={18} color={theme.accent} />
          </Pressable>
        </View>

        <Card style={styles.menu}>
          <MenuRow
            icon="place"
            title="Addresses"
            subtitle={
              addressCount === undefined
                ? "Pickup locations for your cocoa"
                : addressCount === 0
                  ? "No saved addresses yet"
                  : `${addressCount} saved pickup ${addressCount === 1 ? "address" : "addresses"}`
            }
            href="/addresses"
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuRow
            icon="rupee"
            title="Payment methods"
            subtitle="UPI or bank account for your payouts"
            href="/payment-methods"
          />
        </Card>

        <Card style={styles.menu}>
          <MenuRow icon="logout" title="Sign out" onPress={confirmSignOut} />
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  href,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  href?: Href;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => href && router.push(href))}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}
    >
      <Icon name={icon} size={24} color={theme.textSecondary} />
      <View style={styles.rowBody}>
        <ThemedText>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {href ? <Icon name="chevronRight" size={22} color={theme.textSecondary} /> : null}
    </Pressable>
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
  identity: { alignItems: "center", gap: Space.three },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  identityText: { alignItems: "center", gap: Space.one },
  center: { textAlign: "center" },
  editLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  pressed: { opacity: 0.6 },
  menu: { padding: 0, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.four,
    paddingHorizontal: Space.four,
    paddingVertical: Space.four,
  },
  rowBody: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Space.four + 24 + Space.four },
});
