import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddressPicker } from "@/components/address-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radius, Space } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateForIndia,
  savePickupLocation as saveDealPickupLocation,
  type FarmerOffer,
} from "@/lib/farmbridge-api";
import { posthog, posthogLogger } from "@/lib/posthog";
import {
  actionErrorMessage,
  addressesQuery,
  loadState,
  queryKeys,
  quotesQuery,
} from "@/lib/queries";

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
  const queryClient = useQueryClient();
  // Only for a refresh the farmer asked for (pull or button), not background refetches.
  const [refreshing, setRefreshing] = useState(false);
  // The deal whose pickup address is being changed, and the address picked.
  const [changingDealId, setChangingDealId] = useState<string | null>(null);
  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const [pickupLocationError, setPickupLocationError] = useState<string | null>(null);
  const [pickupLocationNotice, setPickupLocationNotice] = useState<string | null>(null);

  // Opening the screen shows cached quotes instantly and refreshes them in the background.
  const quotesResult = useQuery(quotesQuery);
  const addressResult = useQuery(addressesQuery);
  useRefreshOnFocus(queryKeys.quotes, queryKeys.addresses);
  const quotes = quotesResult.data?.offers ?? [];
  const addresses = addressResult.data?.addresses ?? [];
  // Addresses only matter for changing a pickup location, so only quotes gate the screen.
  const { loading, error } = loadState(quotesResult);

  const pickupMutation = useMutation({
    mutationFn: ({ dealId, pickupLocation }: { dealId: string; pickupLocation: string }) =>
      saveDealPickupLocation(dealId, pickupLocation),
    // The API returns the saved location, so update the cached quote directly; no refetch needed.
    onSuccess: (result, { dealId }) => {
      // quotesQuery.queryKey carries the data type, so `current` is typed.
      queryClient.setQueryData(quotesQuery.queryKey, (current) =>
        current && {
          ...current,
          offers: current.offers.map((quote) =>
            quote.dealId === dealId ? { ...quote, pickupLocation: result.pickupLocation } : quote,
          ),
        },
      );
    },
  });
  const savingPickupDealId = pickupMutation.isPending ? pickupMutation.variables.dealId : null;

  async function refresh() {
    setRefreshing(true);
    await Promise.all([quotesResult.refetch(), addressResult.refetch()]);
    setRefreshing(false);
  }

  function startChangingAddress(dealId: string, currentLocation: string | null) {
    setPickupLocationError(null);
    setPickupLocationNotice(null);
    setChangingDealId(dealId);
    const current = addresses.find((a) => a.address === currentLocation)
      ?? addresses.find((a) => a.isDefault)
      ?? addresses[0];
    setChosenAddressId(current?.id ?? null);
  }

  async function submitPickupLocation(dealId: string) {
    const chosen = addresses.find((a) => a.id === chosenAddressId);
    setPickupLocationError(null);
    setPickupLocationNotice(null);
    if (!chosen) {
      setPickupLocationError("Choose one of your saved addresses.");
      return;
    }
    const pickupLocation = chosen.address;

    try {
      await pickupMutation.mutateAsync({ dealId, pickupLocation });
      setChangingDealId(null);
      const isUpdate = Boolean(quotes.find((quote) => quote.dealId === dealId)?.pickupLocation);
      posthog?.capture("pickup_location_saved", {
        is_update: isUpdate,
      });
      posthogLogger.info("pickup location saved", {
        operation: "pickup_location_save",
        is_update: isUpdate,
      });
      setPickupLocationNotice(dealId);
    } catch (saveError) {
      setPickupLocationError(actionErrorMessage(saveError, "Could not save your pickup location."));
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />
        }
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
            <Button label="Try again" onPress={() => void refresh()} loading={refreshing} />
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
                ? theme.accentText
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
                    {quote.offerPickupLocation && !accepted ? (
                      <Detail label="Pickup address" value={quote.offerPickupLocation} />
                    ) : null}
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
                        <Detail
                          label="Collected"
                          value={quote.collectedOn && quote.collectedWeightQuintals
                            ? `${quote.collectedWeightQuintals} quintals on ${formatDateForIndia(quote.collectedOn)}`
                            : "Not collected yet"}
                        />
                      </View>
                      {quote.collectedOn ? (
                        <View style={[styles.pickupLocationBox, { borderTopColor: theme.border }]}>
                          <ThemedText type="label" themeColor="textSecondary">COCOA COLLECTED</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            The driver collected your cocoa. The weight above is from the scale and may differ from the quantity in your quote.
                          </ThemedText>
                          {quote.pickupLocation ? (
                            <View style={styles.collectedLocation}>
                              <ThemedText type="label" themeColor="textSecondary">PICKUP LOCATION</ThemedText>
                              <ThemedText type="small">{quote.pickupLocation}</ThemedText>
                            </View>
                          ) : null}
                        </View>
                      ) : quote.dealId ? (
                        <View style={[styles.pickupLocationBox, { borderTopColor: theme.border }]}>
                          <ThemedText type="label" themeColor="textSecondary">PICKUP ADDRESS FOR THE DRIVER</ThemedText>
                          {quote.pickupLocation ? (
                            <ThemedText type="small">{quote.pickupLocation}</ThemedText>
                          ) : (
                            <ThemedText type="small" themeColor="textSecondary">
                              No pickup address yet. Choose one so the admin team can arrange a driver.
                            </ThemedText>
                          )}

                          {changingDealId === quote.dealId ? (
                            addresses.length > 0 ? (
                              <>
                                <AddressPicker
                                  addresses={addresses}
                                  selectedId={chosenAddressId}
                                  onSelect={setChosenAddressId}
                                  disabled={savingPickupDealId === quote.dealId}
                                />
                                <View style={styles.pickupActions}>
                                  <Button
                                    label="Cancel"
                                    variant="outline"
                                    style={styles.flex}
                                    disabled={savingPickupDealId === quote.dealId}
                                    onPress={() => setChangingDealId(null)}
                                  />
                                  <Button
                                    label="Use this address"
                                    style={styles.flex}
                                    loading={savingPickupDealId === quote.dealId}
                                    onPress={() => void submitPickupLocation(quote.dealId!)}
                                  />
                                </View>
                              </>
                            ) : (
                              <>
                                <ThemedText type="small" themeColor="textSecondary">
                                  You have no saved addresses. Add one in Addresses, then come back here.
                                </ThemedText>
                                <Button
                                  label="Open addresses"
                                  variant="outline"
                                  onPress={() => router.push("/addresses")}
                                />
                              </>
                            )
                          ) : (
                            <Button
                              label={quote.pickupLocation ? "Change pickup address" : "Choose pickup address"}
                              variant="outline"
                              disabled={changingDealId !== null}
                              onPress={() => startChangingAddress(quote.dealId!, quote.pickupLocation)}
                            />
                          )}

                          {pickupLocationError && changingDealId === quote.dealId ? (
                            <ThemedText type="small" style={styles.pickupError}>{pickupLocationError}</ThemedText>
                          ) : pickupLocationNotice === quote.dealId ? (
                            <ThemedText type="small" themeColor="textSecondary">
                              Pickup address updated. The admin team will send the driver there.
                            </ThemedText>
                          ) : null}
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
  pickupActions: { flexDirection: "row", gap: Space.three },
  flex: { flex: 1 },
  pickupError: { color: "#9A4237" },
  collectedLocation: { gap: Space.one },
  state: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: Space.three },
  stateCard: { gap: Space.three },
});
