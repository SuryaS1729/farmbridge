import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatDateForIndia, getMyQuotes, savePickupLocation as saveDealPickupLocation, type FarmerOffer } from "@/lib/farmbridge-api";

function formatSubmittedDate(value: string) {
  const date = new Date(value);
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return `${parts.day}-${parts.month}-${parts.year}`;
}

function statusLabel(status: FarmerOffer["status"]) {
  switch (status) {
    case "pending": return "Pending review";
    case "invalid_needs_revision": return "Needs price revision";
    case "accepted": return "Accepted";
    case "rejected": return "Rejected";
    case "withdrawn": return "Withdrawn";
    case "expired": return "Expired";
  }
}

function dealStatusLabel(status: NonNullable<FarmerOffer["dealStatus"]>) {
  switch (status) {
    case "open": return "Deal in progress";
    case "completed": return "Deal completed";
    case "cancelled": return "Deal cancelled";
  }
}

export default function MyQuotesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [quotes, setQuotes] = useState<FarmerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupLocations, setPickupLocations] = useState<Record<string, string>>({});
  const [savingPickupDealId, setSavingPickupDealId] = useState<string | null>(null);
  const [pickupLocationError, setPickupLocationError] = useState<string | null>(null);
  const [pickupLocationNotice, setPickupLocationNotice] = useState<string | null>(null);

  const loadQuotes = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const result = await getMyQuotes();
      setQuotes(result.offers);
      setPickupLocations(Object.fromEntries(
        result.offers
          .filter((quote) => quote.dealId)
          .map((quote) => [quote.dealId!, quote.pickupLocation ?? ""]),
      ));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your quotes. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQuotes();
    }, [loadQuotes]),
  );

  async function refresh() {
    setRefreshing(true);
    await loadQuotes(false);
  }

  async function submitPickupLocation(dealId: string) {
    const pickupLocation = (pickupLocations[dealId] ?? "").trim();
    setPickupLocationError(null);
    setPickupLocationNotice(null);
    if (pickupLocation.length < 5 || pickupLocation.length > 500) {
      setPickupLocationError("Enter a location between 5 and 500 characters.");
      return;
    }

    setSavingPickupDealId(dealId);
    try {
      const result = await saveDealPickupLocation(dealId, pickupLocation);
      setQuotes((current) => current.map((quote) =>
        quote.dealId === dealId ? { ...quote, pickupLocation: result.pickupLocation } : quote,
      ));
      setPickupLocations((current) => ({ ...current, [dealId]: result.pickupLocation }));
      setPickupLocationNotice(dealId);
    } catch (saveError) {
      setPickupLocationError(
        saveError instanceof Error ? saveError.message : "Could not save your pickup location.",
      );
    } finally {
      setSavingPickupDealId(null);
    }
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
          <ThemedText type="label" themeColor="textSecondary">FARMER ACCOUNT</ThemedText>
        </View>

        <View style={styles.intro}>
          <ThemedText type="title">My cocoa quotes</ThemedText>
          <ThemedText themeColor="textSecondary">
            Follow each quote from review through to its decision.
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText themeColor="textSecondary">Loading your quotes…</ThemedText>
          </View>
        ) : error ? (
          <Card style={styles.stateCard}>
            <ThemedText type="subtitle">Could not load quotes</ThemedText>
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
            <Button label="Try again" onPress={() => void loadQuotes()} loading={refreshing} />
          </Card>
        ) : quotes.length === 0 ? (
          <Card style={styles.stateCard}>
            <ThemedText type="subtitle">No quotes yet</ThemedText>
            <ThemedText themeColor="textSecondary">
              When you submit a cocoa quote, you can follow its status here.
            </ThemedText>
            <Button label="Make a cocoa offer" onPress={() => router.push("./quote")} />
          </Card>
        ) : (
          <>
            <View style={styles.listHeading}>
              <ThemedText type="label" themeColor="textSecondary">LATEST QUOTES</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => void refresh()} disabled={refreshing}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {refreshing ? "Refreshing…" : "Refresh"}
                </ThemedText>
              </Pressable>
            </View>
            {quotes.map((quote) => {
              const accepted = quote.status === "accepted" && quote.dealId !== null;
              const statusColor = quote.status === "accepted"
                ? theme.ink
                : quote.status === "rejected"
                  ? "#9A4237"
                  : theme.textSecondary;
              const statusBackground = quote.status === "accepted"
                ? theme.accent
                : quote.status === "rejected"
                  ? "#FFF0ED"
                  : theme.backgroundSelected;

              return (
                <Card key={quote.id} style={styles.quoteCard}>
                  <View style={styles.cardHeading}>
                    <View style={[styles.statusPill, { backgroundColor: statusBackground }]}>
                      <ThemedText type="label" style={{ color: statusColor }}>
                        {statusLabel(quote.status)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Submitted {formatSubmittedDate(quote.submittedAt)}
                    </ThemedText>
                  </View>

                  <View style={styles.details}>
                    <Detail label="Offer price" value={`₹${quote.offeredPricePerKg} / kg`} />
                    <Detail label="Quantity" value={`${quote.quantityQuintals} quintals`} />
                    <Detail label="Moisture" value={`${quote.moisturePercent}%`} />
                    <Detail label="Bean count" value={`${quote.beanCountPer100g} per 100 g`} />
                    <Detail label="Expected ready date" value={formatDateForIndia(quote.readyOn)} />
                  </View>

                  {quote.status === "pending" ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      The admin team is reviewing your quote.
                    </ThemedText>
                  ) : null}
                  {quote.status === "invalid_needs_revision" ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      The published base price changed. This quote needs revision before it can be accepted.
                    </ThemedText>
                  ) : null}
                  {quote.status === "rejected" && quote.rejectionReason ? (
                    <View style={[styles.reason, { borderColor: theme.border }]}>
                      <ThemedText type="label" themeColor="textSecondary">ADMIN REASON</ThemedText>
                      <ThemedText>{quote.rejectionReason}</ThemedText>
                    </View>
                  ) : null}

                  {accepted ? (
                    <View style={[styles.dealPanel, { backgroundColor: theme.background }]}>
                      <View style={styles.cardHeading}>
                        <ThemedText type="smallBold">Confirmed deal</ThemedText>
                        {quote.dealStatus ? (
                          <ThemedText type="label" themeColor="textSecondary">
                            {dealStatusLabel(quote.dealStatus)}
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        Accepted {quote.acceptedAt ? formatSubmittedDate(quote.acceptedAt) : ""}. These are the terms agreed with the admin.
                      </ThemedText>
                      <View style={styles.details}>
                        <Detail label="Locked price" value={`₹${quote.dealOfferedPricePerKg} / kg`} />
                        <Detail label="Locked quantity" value={`${quote.dealQuantityQuintals} quintals`} />
                        <Detail label="Locked moisture" value={`${quote.dealMoisturePercent}%`} />
                        <Detail label="Locked bean count" value={`${quote.dealBeanCountPer100g} per 100 g`} />
                        <Detail label="Expected ready date" value={quote.dealReadyOn ? formatDateForIndia(quote.dealReadyOn) : ""} />
                        <Detail
                          label="Scheduled pickup date"
                          value={quote.pickupScheduledOn
                            ? formatDateForIndia(quote.pickupScheduledOn)
                            : "Not scheduled yet"}
                        />
                      </View>
                      {quote.dealId ? (
                        <View style={[styles.pickupLocationBox, { borderTopColor: theme.border }]}>
                          <ThemedText type="label" themeColor="textSecondary">PICKUP LOCATION FOR THE DRIVER</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            Tell us where your cocoa will be ready for collection. Include your village, a landmark, and directions the driver can follow.
                          </ThemedText>
                          <TextInput
                            multiline
                            maxLength={500}
                            placeholder="Village, landmark, farm or collection point, and directions"
                            placeholderTextColor={theme.textSecondary}
                            textAlignVertical="top"
                            value={pickupLocations[quote.dealId] ?? quote.pickupLocation ?? ""}
                            onChangeText={(value) => {
                              setPickupLocations((current) => ({ ...current, [quote.dealId!]: value }));
                              setPickupLocationError(null);
                              setPickupLocationNotice(null);
                            }}
                            style={[
                              styles.pickupLocationInput,
                              {
                                color: theme.text,
                                borderColor: theme.border,
                                backgroundColor: theme.backgroundElement,
                              },
                            ]}
                          />
                          {pickupLocationError ? (
                            <ThemedText type="small" style={styles.pickupError}>{pickupLocationError}</ThemedText>
                          ) : pickupLocationNotice === quote.dealId ? (
                            <ThemedText type="small" themeColor="textSecondary">
                              Location shared. The admin team can now arrange a driver.
                            </ThemedText>
                          ) : quote.pickupLocation ? (
                            <ThemedText type="small" themeColor="textSecondary">
                              Your location is saved. You can update it if needed.
                            </ThemedText>
                          ) : null}
                          <Button
                            label={savingPickupDealId === quote.dealId
                              ? "Saving location…"
                              : quote.pickupLocation ? "Update pickup location" : "Share pickup location"}
                            variant="outline"
                            loading={savingPickupDealId === quote.dealId}
                            onPress={() => void submitPickupLocation(quote.dealId!)}
                          />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={styles.detailValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: Space.section,
    paddingHorizontal: Space.page,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { paddingVertical: Space.two, paddingRight: Space.four },
  intro: { gap: Space.two },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quoteCard: { gap: Space.three },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: Radius.round,
    paddingHorizontal: Space.three,
    paddingVertical: Space.one,
  },
  details: { gap: Space.two },
  detailRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailValue: { textAlign: "right", flexShrink: 1 },
  reason: { gap: Space.two, borderLeftWidth: 3, paddingLeft: Space.three },
  dealPanel: { gap: Space.three, borderRadius: Radius.control, padding: Space.three },
  pickupLocationBox: {
    gap: Space.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Space.three,
  },
  pickupLocationInput: {
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    padding: Space.three,
    fontSize: 14,
    lineHeight: 21,
  },
  pickupError: { color: "#9A4237" },
  state: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: Space.three },
  stateCard: { gap: Space.three },
});
