import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AddressFields,
  emptyAddress,
  trimAddress,
  validateAddress,
} from "@/components/address-fields";
import { AddressPicker, NEW_ADDRESS } from "@/components/address-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  formatPricePerKg,
  submitQuote,
  type AddressInput,
  type QuoteInput,
} from "@/lib/farmbridge-api";
import { posthog, posthogLogger } from "@/lib/posthog";
import {
  actionErrorMessage,
  addressesQuery,
  loadState,
  queryKeys,
  todayPriceQuery,
} from "@/lib/queries";

type QuoteFields = {
  offeredPricePerKg: string;
  quantity: string;
  moisturePercent: string;
  beanCountPer100g: string;
  readyOn: string;
};

const emptyFields: QuoteFields = {
  offeredPricePerKg: "",
  quantity: "",
  moisturePercent: "",
  beanCountPer100g: "",
  readyOn: "",
};

type QuantityUnit = "kg" | "quintal";

function indianDateToIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return null;

  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === isoDate
    ? isoDate
    : null;
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "decimal-pad" | "number-pad" | "default";
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={styles.reviewValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function QuoteScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<QuoteFields>(emptyFields);
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("quintal");
  const [reviewing, setReviewing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState<AddressInput>(emptyAddress);

  const submitMutation = useMutation({
    mutationFn: submitQuote,
    // Explicit even though it's the app default: a quote must never be queued offline
    // and sent later, when the farmer has moved on or the day's price has changed.
    networkMode: "always",
    onSuccess: (_result, input) => {
      // My Quotes must show the new quote; a typed-in address is saved to the farmer's list too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes });
      if (input.newPickupAddress) void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
  const submitting = submitMutation.isPending;

  // Opening this screen refetches anything older than 30s, so the price shown is current.
  const priceQuery = useQuery(todayPriceQuery);
  const price = priceQuery.data?.price ?? null;
  const { loading: loadingPrice, error: priceError } = loadState(
    priceQuery,
    "Could not load today's cocoa price.",
  );

  const addressQuery = useQuery(addressesQuery);
  const addresses = addressQuery.data?.addresses ?? [];
  const { loading: addressesLoading, error: addressesError } = loadState(
    addressQuery,
    "Could not load your saved addresses.",
  );

  // Pre-select the default address once, the first time addresses arrive;
  // later refetches must not undo the farmer's own choice.
  if (selectedAddressId === null && addressQuery.data) {
    const preferred = addressQuery.data.addresses.find((a) => a.isDefault) ?? addressQuery.data.addresses[0];
    setSelectedAddressId(preferred ? preferred.id : NEW_ADDRESS);
  }

  const usingNewAddress = selectedAddressId === NEW_ADDRESS;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const pickupSummary = usingNewAddress
    ? `${newAddress.label.trim()} — ${newAddress.address.trim()}`
    : selectedAddress
      ? `${selectedAddress.label} — ${selectedAddress.address}`
      : "";

  function setField<K extends keyof QuoteFields>(key: K, value: QuoteFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function reviewQuote() {
    setError(null);

    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(fields.offeredPricePerKg)) {
      setError("Enter your offer price with up to two decimal places.");
      return;
    }
    const quantityPattern =
      quantityUnit === "quintal"
        ? /^\d{1,7}(?:\.\d{1,2})?$/
        : /^\d{1,9}(?:\.\d{1,3})?$/;
    if (!quantityPattern.test(fields.quantity) || Number(fields.quantity) <= 0) {
      setError(
        quantityUnit === "quintal"
          ? "Enter a quantity greater than zero, to two decimal places."
          : "Enter a kg quantity greater than zero, to three decimal places.",
      );
      return;
    }
    const moisture = Number(fields.moisturePercent);
    if (fields.moisturePercent.trim() === "" || !Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
      setError("Enter moisture as a percentage from 0 to 100.");
      return;
    }
    const beanCount = Number(fields.beanCountPer100g);
    if (fields.beanCountPer100g.trim() === "" || !Number.isFinite(beanCount) || beanCount <= 0) {
      setError("Enter a bean count greater than zero per 100 g.");
      return;
    }
    if (!indianDateToIso(fields.readyOn)) {
      setError("Enter the expected pickup readiness date as DD-MM-YYYY.");
      return;
    }
    if (usingNewAddress) {
      const addressProblem = validateAddress(newAddress);
      if (addressProblem) {
        setError(addressProblem);
        return;
      }
    } else if (!selectedAddress) {
      setError("Choose where the driver should collect your cocoa.");
      return;
    }

    posthog?.capture("quote_review_started", {
      offered_price_per_kg: Number(fields.offeredPricePerKg),
      quantity: Number(fields.quantity),
      quantity_unit: quantityUnit,
      moisture_percent: moisture,
      bean_count_per_100g: beanCount,
    });
    setReviewing(true);
  }

  async function confirmSubmission() {
    setError(null);
    const readyOn = indianDateToIso(fields.readyOn);
    if (!readyOn) {
      setError("Enter the expected pickup readiness date as DD-MM-YYYY.");
      return;
    }
    const input: QuoteInput = {
      offeredPricePerKg: fields.offeredPricePerKg,
      quantity: fields.quantity,
      quantityUnit,
      moisturePercent: Number(fields.moisturePercent),
      beanCountPer100g: Number(fields.beanCountPer100g),
      readyOn,
      ...(usingNewAddress
        ? { newPickupAddress: trimAddress(newAddress) }
        : { pickupAddressId: selectedAddress!.id }),
    };

    try {
      await submitMutation.mutateAsync(input);
      posthog?.capture("quote_submitted", {
        offered_price_per_kg: Number(fields.offeredPricePerKg),
        quantity: Number(fields.quantity),
        quantity_unit: quantityUnit,
        moisture_percent: input.moisturePercent,
        bean_count_per_100g: input.beanCountPer100g,
        pickup_address: usingNewAddress ? "new" : "saved",
      });
      posthogLogger.info("quote submission completed", {
        operation: "quote_submission",
        quantity_unit: quantityUnit,
      });
      setSubmitted(true);
    } catch (submissionError) {
      posthogLogger.error("quote submission failed", {
        operation: "quote_submission",
        error_type: "request_failed",
      });
      setError(actionErrorMessage(submissionError, "Could not submit your quote. Please try again."));
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ThemedText type="label" themeColor="textSecondary">
            SELL COCOA
          </ThemedText>
          <ThemedText type="title">
            {submitted ? "Quote submitted." : reviewing ? "Review your quote." : "Make an offer."}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {submitted
              ? "The buying team will review the details you submitted."
              : "Submitting this quote means you want to sell this cocoa."}
          </ThemedText>
        </View>

        {loadingPrice ? (
          <Card style={styles.priceCard}>
            <ActivityIndicator />
            <ThemedText themeColor="textSecondary">Loading today's cocoa price…</ThemedText>
          </Card>
        ) : priceError ? (
          <Card style={styles.priceCard}>
            <ThemedText themeColor="textSecondary">{priceError}</ThemedText>
            <Button label="Retry" variant="outline" onPress={() => void priceQuery.refetch()} />
          </Card>
        ) : price ? (
          <Card style={styles.priceCard}>
            <ThemedText type="label" themeColor="textSecondary">
              TODAY'S BASE PRICE
            </ThemedText>
            <ThemedText type="figure">₹{formatPricePerKg(price.basePricePerKg)} / kg</ThemedText>
            <ThemedText themeColor="textSecondary">
              Your offer price must meet or exceed this price.
            </ThemedText>
          </Card>
        ) : (
          <Card style={styles.priceCard}>
            <ThemedText type="label" themeColor="textSecondary">
              NO PRICE PUBLISHED
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              The buying team has not published today's cocoa price yet.
            </ThemedText>
          </Card>
        )}

        {submitted ? (
          <Card style={styles.formCard}>
            <ThemedText type="label" themeColor="textSecondary">
              YOUR QUOTE IS WITH THE BUYING TEAM
            </ThemedText>
            <ThemedText>
              You can return to Home. The administrator will review the submitted price, quantity, quality details, readiness date, and pickup address.
            </ThemedText>
            <Button label="View my quotes" variant="outline" onPress={() => router.replace("./my-quotes")} />
            <Button label="Back to Home" onPress={() => router.replace("/(farmer)/(tabs)")} />
          </Card>
        ) : reviewing ? (
          <Card style={styles.formCard}>
            <ThemedText type="label" themeColor="textSecondary">
              CHECK EACH DETAIL BEFORE SUBMITTING
            </ThemedText>
            <ReviewRow label="Offer price" value={`₹${fields.offeredPricePerKg} per kg`} />
            <ReviewRow
              label="Quantity"
              value={`${fields.quantity} ${quantityUnit === "quintal" ? "quintals" : "kg"}`}
            />
            <ReviewRow label="Bean moisture" value={`${fields.moisturePercent}%`} />
            <ReviewRow label="Bean count" value={`${fields.beanCountPer100g} per 100 g`} />
            <ReviewRow label="Ready for pickup" value={fields.readyOn} />
            <ReviewRow label="Pickup address" value={pickupSummary} />
            {usingNewAddress ? (
              <ThemedText type="small" themeColor="textSecondary">
                This address will be saved to your account for next time.
              </ThemedText>
            ) : null}
            <ThemedText themeColor="textSecondary">
              Moisture and bean count are self-reported. The administrator reviews these details before deciding whether to accept the quote.
            </ThemedText>
            <Button label="Edit details" variant="outline" onPress={() => setReviewing(false)} />
            <Button
              label="Submit quote"
              onPress={confirmSubmission}
              loading={submitting}
              disabled={!price}
            />
          </Card>
        ) : price ? (
          <Card style={styles.formCard}>
            <InputField
              label="OFFER PRICE PER KG (₹)"
              value={fields.offeredPricePerKg}
              onChangeText={(value) => setField("offeredPricePerKg", value)}
              placeholder="e.g. 250.00"
              keyboardType="decimal-pad"
            />
            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                AVAILABLE QUANTITY
              </ThemedText>
              <View style={styles.unitSwitch}>
                {(["quintal", "kg"] as const).map((unit) => {
                  const selected = quantityUnit === unit;
                  return (
                    <Pressable
                      key={unit}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        if (unit !== quantityUnit) {
                          setQuantityUnit(unit);
                          setField("quantity", "");
                          setError(null);
                        }
                      }}
                      style={[
                        styles.unitOption,
                        selected && styles.unitOptionSelected,
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={selected ? styles.unitOptionTextSelected : undefined}
                      >
                        {unit === "quintal" ? "Quintals" : "Kilograms (kg)"}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <InputField
                label={quantityUnit === "quintal" ? "QUANTITY (QUINTALS)" : "QUANTITY (KG)"}
                value={fields.quantity}
                onChangeText={(value) => setField("quantity", value)}
                placeholder={quantityUnit === "quintal" ? "e.g. 2.50" : "e.g. 250"}
                keyboardType="decimal-pad"
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {quantityUnit === "quintal"
                ? "1 quintal = 100 kg. Enter up to two decimal places."
                : "Enter up to three decimal places. Changing units clears the quantity."}
            </ThemedText>
            <InputField
              label="BEAN MOISTURE (%)"
              value={fields.moisturePercent}
              onChangeText={(value) => setField("moisturePercent", value)}
              placeholder="e.g. 7.5"
              keyboardType="decimal-pad"
            />
            <InputField
              label="BEAN COUNT PER 100 G"
              value={fields.beanCountPer100g}
              onChangeText={(value) => setField("beanCountPer100g", value)}
              placeholder="e.g. 110"
              keyboardType="decimal-pad"
            />
            <InputField
              label="EXPECTED READY DATE FOR PICKUP (DD-MM-YYYY)"
              value={fields.readyOn}
              onChangeText={(value) => setField("readyOn", value)}
              placeholder="DD-MM-YYYY"
              keyboardType="default"
            />
            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                PICKUP ADDRESS
              </ThemedText>
              {addressesLoading ? (
                <ActivityIndicator />
              ) : addressesError ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">{addressesError}</ThemedText>
                  <Button label="Retry" variant="outline" onPress={() => void addressQuery.refetch()} />
                </>
              ) : (
                <>
                  {addresses.length > 0 ? (
                    <AddressPicker
                      addresses={addresses}
                      selectedId={selectedAddressId}
                      onSelect={(id) => {
                        setSelectedAddressId(id);
                        setError(null);
                      }}
                      allowNew
                    />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Where should the driver collect your cocoa? We'll save this address for your next quote.
                    </ThemedText>
                  )}
                  {usingNewAddress ? (
                    <AddressFields value={newAddress} onChange={setNewAddress} />
                  ) : null}
                </>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              These quality details are self-reported. The administrator will review your quote.
            </ThemedText>
            <Button
              label="Review quote  →"
              onPress={reviewQuote}
              disabled={addressesLoading || Boolean(addressesError)}
            />
          </Card>
        ) : null}

        {error ? (
          <ThemedText type="small" themeColor="textSecondary">
            {error}
          </ThemedText>
        ) : null}

        {!submitted ? (
          <Button label="Cancel" variant="outline" onPress={() => router.back()} />
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: Space.four,
    paddingHorizontal: Space.page,
  },
  header: { gap: Space.two },
  priceCard: { gap: Space.three, padding: Space.four },
  formCard: { gap: Space.three, padding: Space.four },
  field: { gap: Space.two },
  unitSwitch: {
    flexDirection: "row",
    gap: Space.two,
  },
  unitOption: {
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Space.two,
    borderWidth: 1,
    borderColor: "#D5DED5",
    borderRadius: Radius.control,
  },
  unitOptionSelected: {
    borderColor: "#2D6544",
    backgroundColor: "#E9F2EA",
  },
  unitOptionTextSelected: {
    color: "#245A40",
  },
  input: {
    minHeight: 54,
    paddingHorizontal: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
    fontFamily: Fonts.sans,
    fontSize: 17,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Space.three,
    paddingVertical: Space.one,
  },
  reviewValue: { flexShrink: 1, textAlign: "right" },
});
