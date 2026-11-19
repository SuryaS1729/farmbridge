import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { posthog } from "@/lib/posthog";
import {
  formatDateForIndia,
  formatPricePerKg,
} from "@/lib/farmbridge-api";
import { loadState, queryKeys, todayPriceQuery } from "@/lib/queries";

export default function FarmerHomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [priceUnit, setPriceUnit] = useState<"kg" | "quintal">("kg");
  const { data: session, isPending } = authClient.useSession();

  // Returning to the app refetches via the global focusManager; returning to this
  // tab from another screen refetches here. Both only fire once the price is 30s old.
  const priceQuery = useQuery(todayPriceQuery);
  useRefreshOnFocus(queryKeys.todayPrice);
  const price = priceQuery.data?.price ?? null;
  const { loading: loadingPrice, error: priceError } = loadState(
    priceQuery,
    "Could not load today's cocoa price.",
  );

  async function signOut() {
    setError(null);
    setSigningOut(true);

    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        setError(
          signOutError.message ?? "Could not sign out. Please try again.",
        );
        return;
      }

      posthog?.reset();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (isPending) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const accountLabel =
    session?.user.phoneNumber ?? session?.user.name ?? session?.user.email;

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
        <View style={styles.brandBar}>
          <ThemedText type="smallBold" style={styles.wordmark}>
            FARMBRIDGE
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            COCOA · FARMER APP
          </ThemedText>
        </View>

        <View style={styles.intro}>
          <ThemedText type="label" themeColor="textSecondary">
            YOUR FARMER ACCOUNT
          </ThemedText>
          <ThemedText type="title">Welcome to Farmbridge.</ThemedText>
          <ThemedText themeColor="textSecondary">
            Your phone number is verified. This is where your cocoa offers and
            farm updates will come together.
          </ThemedText>
        </View>

        <Card style={styles.priceCard}>
          <View style={styles.priceHeading}>
            <ThemedText type="label" themeColor="textSecondary">
              TODAY'S COCOA BASE PRICE
            </ThemedText>
            <View
              accessibilityLabel="Daily price unit"
              style={[
                styles.priceUnitToggle,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}
            >
              {(["kg", "quintal"] as const).map((unit) => {
                const selected = priceUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    accessibilityRole="button"
                    accessibilityLabel={
                      "Show price per " + (unit === "kg" ? "kilogram" : "quintal")
                    }
                    accessibilityState={{ selected }}
                    onPress={() => setPriceUnit(unit)}
                    style={[
                      styles.priceUnitButton,
                      selected && { backgroundColor: theme.accent },
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      themeColor={selected ? "ink" : "textSecondary"}
                      style={styles.priceUnitLabel}
                    >
                      {unit === "kg" ? "kg" : "quintal"}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {loadingPrice ? (
            <ActivityIndicator />
          ) : price ? (
            <>
              <ThemedText type="price">
                ₹
                {priceUnit === "kg"
                  ? formatPricePerKg(price.basePricePerKg)
                  : price.basePricePerQuintal}
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                per {priceUnit === "kg" ? "kilogram" : "quintal"} · {formatDateForIndia(price.businessDate)}
              </ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">
              {priceError ?? "The buying team has not published a price today."}
            </ThemedText>
          )}
          {priceError ? (
            <Button
              label="Retry price lookup"
              variant="outline"
              onPress={() => void priceQuery.refetch()}
              loading={priceQuery.isFetching}
            />
          ) : null}
          <Button
            label="Make a cocoa offer  →"
            onPress={() => router.push("../quote")}
            disabled={!price || loadingPrice}
          />
          <Button
            label="View my quotes"
            variant="outline"
            onPress={() => router.push("../my-quotes")}
          />
        </Card>

        <Card tone="dark" style={styles.accountCard}>
          <ThemedText type="label" themeColor="accent">
            PHONE SIGN-IN
          </ThemedText>
          <ThemedText type="figure" themeColor="paper">
            {accountLabel ?? "Farmbridge account"}
          </ThemedText>
          <ThemedText type="label" themeColor="onDark">
            VERIFIED ACCOUNT
          </ThemedText>
        </Card>

        <View style={styles.actions}>
          <Button
            label={signingOut ? "Signing out…" : "Sign out"}
            variant="outline"
            onPress={signOut}
            loading={signingOut}
          />
          {error ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.centerText}
            >
              {error}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    gap: Space.section,
    paddingHorizontal: Space.page,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    letterSpacing: 2,
  },
  intro: {
    gap: Space.two,
  },
  accountCard: {
    gap: Space.three,
    padding: Space.four,
  },
  priceCard: {
    gap: Space.three,
    padding: Space.four,
  },
  priceHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Space.two,
  },
  priceUnitToggle: {
    flexDirection: "row",
    padding: 2,
    borderWidth: 1,
    borderRadius: 8,
  },
  priceUnitButton: {
    minWidth: 38,
    minHeight: 30,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Space.two,
    borderRadius: 6,
  },
  priceUnitLabel: {
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    gap: Space.two,
  },
  centerText: {
    textAlign: "center",
  },
});
