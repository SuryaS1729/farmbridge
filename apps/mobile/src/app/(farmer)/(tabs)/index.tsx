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
import { Icon } from "@/components/ui/icon";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTheme } from "@/hooks/use-theme";
import {
  dealStage,
  findActiveDeals,
  findOpenQuote,
  formatDateForIndia,
  type DealStage,
  type FarmerOffer,
  formatPricePerKg,
  formatQuantity,
} from "@/lib/farmbridge-api";
import { loadState, profileQuery, queryKeys, quotesQuery, todayPriceQuery } from "@/lib/queries";

const PRICE_UNIT_OPTIONS = [
  { value: "kg", label: "kg", accessibilityLabel: "Show price per kilogram" },
  { value: "quintal", label: "quintal", accessibilityLabel: "Show price per quintal" },
] as const;

export default function FarmerHomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [priceUnit, setPriceUnit] = useState<"kg" | "quintal">("kg");

  // Returning to the app refetches via the global focusManager; returning to this
  // tab from another screen refetches here. Both only fire once the price is 30s old.
  const priceQuery = useQuery(todayPriceQuery);
  // Quotes too: an open quote replaces "Make a cocoa offer", since only one is allowed at a time.
  const quotesResult = useQuery(quotesQuery);
  useRefreshOnFocus(queryKeys.todayPrice, queryKeys.quotes);
  const price = priceQuery.data?.price ?? null;
  const openQuote = findOpenQuote(quotesResult.data?.offers);
  const needsRevision = openQuote?.status === "invalid_needs_revision";
  const activeDeals = findActiveDeals(quotesResult.data?.offers);

  // Already cached by the onboarding check in _layout, so this costs no extra request.
  const profile = useQuery(profileQuery);
  const firstName = profile.data?.profile?.aadhaarName?.trim().split(/\s+/)[0];
  const { loading: loadingPrice, error: priceError } = loadState(
    priceQuery,
    "Could not load today's cocoa price.",
  );

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={8}
            onPress={() => router.push("../profile")}
            style={({ pressed }) => [
              styles.profileButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="person" size={22} color={theme.accentText} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <ThemedText type="title">
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </ThemedText>
        </View>

        <Card style={styles.priceCard}>
          <View style={styles.priceHeading}>
            <ThemedText type="label" themeColor="textSecondary">
              TODAY'S COCOA BASE PRICE
            </ThemedText>
            <SegmentedToggle
              accessibilityLabel="Daily price unit"
              options={PRICE_UNIT_OPTIONS}
              value={priceUnit}
              onChange={setPriceUnit}
            />
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
                <ThemedText type="figure" themeColor="textSecondary">
                  /{priceUnit === "kg" ? "kg" : "quintal"}
                </ThemedText>
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {formatDateForIndia(price.businessDate)}
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
          {openQuote ? null : (
            <Button
              label="Make a cocoa offer  →"
              onPress={() => router.push("../quote")}
              disabled={!price || loadingPrice}
            />
          )}
          <Button
            label="View my quotes"
            variant="outline"
            onPress={() => router.push("../my-quotes")}
          />
        </Card>

        {activeDeals.map((deal) => (
          <DealCard key={deal.dealId} deal={deal} />
        ))}

        {openQuote ? (
          <Card style={styles.priceCard}>
            <View style={styles.priceHeading}>
              <ThemedText type="label" themeColor="textSecondary">
                YOUR OPEN QUOTE
              </ThemedText>
              <ThemedText type="label" themeColor={needsRevision ? "text" : "textSecondary"}>
                {needsRevision ? "NEEDS A NEW PRICE" : "WITH THE BUYING TEAM"}
              </ThemedText>
            </View>
            <ThemedText type="figure">
              ₹{formatPricePerKg(openQuote.offeredPricePerKg)}/kg ·{" "}
              {formatQuantity(openQuote.quantityQuintals, openQuote.quantityKg)}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {needsRevision
                ? "Today's price went up above your offer. Raise your offer price so the buying team can accept it."
                : "The buying team is reviewing it. You can change any detail until they decide."}{" "}
              It expires at the end of today.
            </ThemedText>
            <Button
              label={needsRevision ? "Revise my price  →" : "Change my quote"}
              variant={needsRevision ? undefined : "outline"}
              onPress={() => router.push(`../quote?offerId=${openQuote.id}`)}
              disabled={!price || loadingPrice}
            />
          </Card>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  needs_address: "ADDRESS NEEDED",
  awaiting_schedule: "ACCEPTED",
  pickup_scheduled: "PICKUP SCHEDULED",
  collected: "COLLECTED",
};

/** One accepted quote, showing where its pickup stands so the farmer knows what happens next. */
function DealCard({ deal }: { deal: FarmerOffer }) {
  const theme = useTheme();
  const stage = dealStage(deal);
  // Highlight the stages where the buying team has just done something the farmer must know about.
  const highlighted = stage === "pickup_scheduled" || stage === "collected" || stage === "needs_address";

  let message: string;
  switch (stage) {
    case "needs_address":
      message = "The buying team accepted your quote. Choose a pickup address so they can arrange a driver.";
      break;
    case "awaiting_schedule":
      message = "The buying team accepted your quote. They will schedule a pickup date soon.";
      break;
    case "pickup_scheduled":
      message = `A driver will collect your cocoa on ${formatDateForIndia(deal.pickupScheduledOn!)}. Keep it ready at your pickup address.`;
      break;
    case "collected":
      message =
        deal.collectedWeightQuintals && deal.collectedWeightKg
          ? `The driver collected ${formatQuantity(deal.collectedWeightQuintals, deal.collectedWeightKg)} on ${formatDateForIndia(deal.collectedOn!)}.`
          : `The driver collected your cocoa on ${formatDateForIndia(deal.collectedOn!)}.`;
      break;
  }

  return (
    <Card style={styles.priceCard}>
      <View style={styles.priceHeading}>
        <ThemedText type="label" themeColor="textSecondary">
          YOUR DEAL
        </ThemedText>
        <View
          style={[
            styles.stagePill,
            { backgroundColor: highlighted ? theme.accent : theme.accentSoft },
          ]}
        >
          <ThemedText
            type="label"
            themeColor={highlighted ? "accentText" : "text"}
          >
            {DEAL_STAGE_LABEL[stage]}
          </ThemedText>
        </View>
      </View>
      {deal.dealOfferedPricePerKg && deal.dealQuantityQuintals && deal.dealQuantityKg ? (
        <ThemedText type="figure">
          ₹{formatPricePerKg(deal.dealOfferedPricePerKg)}/kg ·{" "}
          {formatQuantity(deal.dealQuantityQuintals, deal.dealQuantityKg)}
        </ThemedText>
      ) : null}
      {deal.pickupScheduledOn && stage !== "collected" ? (
        <ThemedText type="subtitle">
          Pickup on {formatDateForIndia(deal.pickupScheduledOn)}
        </ThemedText>
      ) : null}
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
      <Button
        label={stage === "needs_address" ? "Choose pickup address  →" : "View deal details"}
        variant={stage === "needs_address" ? undefined : "outline"}
        onPress={() => router.push("../my-quotes")}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  wordmark: {
    letterSpacing: 2,
  },
  intro: {
    gap: Space.two,
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
  stagePill: {
    paddingHorizontal: Space.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
