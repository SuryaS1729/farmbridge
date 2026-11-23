import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AddressFields,
  emptyAddress,
  trimAddress,
  validateAddress,
} from "@/components/address-fields";
import { AddressPicker, NEW_ADDRESS } from "@/components/address-picker";
import { DateField } from "@/components/date-field";
import {
  FieldError,
  FormError,
  hasErrors,
  useScrollToField,
  type FieldErrors,
} from "@/components/form-errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  findOpenQuote,
  formatDateForIndia,
  formatPricePerKg,
  formatRupees,
  isOpenQuote,
  offerPriceFromBase,
  reviseQuote,
  submitQuote,
  todayInIndia,
  type AddressInput,
  type FarmerOffer,
  type QuoteInput,
} from "@/lib/farmbridge-api";
import { posthog, posthogLogger } from "@/lib/posthog";
import {
  actionErrorMessage,
  addressesQuery,
  loadState,
  queryKeys,
  quotesQuery,
  todayPriceQuery,
} from "@/lib/queries";

type QuoteFields = {
  offeredPricePerKg: string;
  quantity: string;
  moisturePercent: string;
  beanCountPer100g: string;
  /** ISO `YYYY-MM-DD` from the date picker, "" until chosen. */
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

/** The form's fields in on-screen order, plus the pickup address parts. */
type QuoteErrorKey = keyof QuoteFields | "pickupAddress" | "addressLabel" | "addressText";

/**
 * The saved quote as form values. Quantity is stored in kg, so it is shown in quintals
 * when that is exact to two decimals (as the form accepts), and in kg otherwise.
 */
function fieldsFromQuote(quote: FarmerOffer): { fields: QuoteFields; unit: QuantityUnit } {
  const inQuintals = /^\d{1,7}(?:\.\d{1,2})?$/.test(quote.quantityQuintals);
  return {
    unit: inQuintals ? "quintal" : "kg",
    fields: {
      offeredPricePerKg: formatPricePerKg(quote.offeredPricePerKg),
      quantity: inQuintals ? quote.quantityQuintals : formatPricePerKg(quote.quantityKg),
      moisturePercent: formatPricePerKg(quote.moisturePercent),
      beanCountPer100g: formatPricePerKg(quote.beanCountPer100g),
      readyOn: quote.readyOn,
    },
  };
}

/**
 * Moves the decimal point without floating-point rounding: +2 turns quintals into kg,
 * -2 turns kg into quintals. Returns "" for anything that isn't a plain number.
 */
function shiftDecimal(value: string, places: number) {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!match || value.trim() === "") return "";
  const integer = match[1] ?? "";
  let digits = integer + (match[2] ?? "");
  let point = integer.length + places;
  if (point < 0) {
    digits = "0".repeat(-point) + digits;
    point = 0;
  }
  digits = digits.padEnd(point, "0");
  const whole = digits.slice(0, point).replace(/^0+(?=\d)/, "") || "0";
  const fraction = digits.slice(point).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
  fieldRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "decimal-pad" | "number-pad" | "default";
  error?: string;
  fieldRef?: (node: View | null) => void;
}) {
  const theme = useTheme();

  return (
    <View ref={fieldRef} style={styles.field}>
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
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
        accessibilityLabel={label}
      />
      <FieldError message={error} />
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
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<QuoteFields>(emptyFields);
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("quintal");
  const [reviewing, setReviewing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // True once the farmer changes anything, so leaving asks before throwing it away.
  const [dirty, setDirty] = useState(false);
  // A refused submit or lost connection; field problems are shown under each field instead.
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<QuoteErrorKey>>({});
  const scrollRef = useRef<ScrollView>(null);
  const { fieldRef, scrollToFirst } = useScrollToField(scrollRef);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState<AddressInput>(emptyAddress);

  // With ?offerId= this screen revises that open quote instead of making a new one.
  const { offerId } = useLocalSearchParams<{ offerId?: string }>();
  const revisingId = typeof offerId === "string" && offerId ? offerId : null;
  const quotesResult = useQuery(quotesQuery);
  const revisingQuote = revisingId
    ? quotesResult.data?.offers.find((quote) => quote.id === revisingId) ?? null
    : null;
  // Only one open quote is allowed at a time, so a new offer is blocked while one exists.
  const openQuote = revisingId ? null : findOpenQuote(quotesResult.data?.offers);
  // The quote being revised was decided or expired since the farmer opened it.
  const revisingClosed =
    Boolean(revisingId) && quotesResult.data !== undefined && !(revisingQuote && isOpenQuote(revisingQuote));
  const waitingForQuote = Boolean(revisingId) && quotesResult.isPending;

  // Fill the form from the saved quote once, the first time it arrives.
  const [prefilled, setPrefilled] = useState(false);
  if (revisingQuote && !prefilled) {
    setPrefilled(true);
    const initial = fieldsFromQuote(revisingQuote);
    setFields(initial.fields);
    setQuantityUnit(initial.unit);
  }

  const submitMutation = useMutation({
    mutationFn: (input: QuoteInput) => (revisingId ? reviseQuote(revisingId, input) : submitQuote(input)),
    // Explicit even though it's the app default: a quote must never be queued offline
    // and sent later, when the farmer has moved on or the day's price has changed.
    networkMode: "always",
    onSuccess: (_result, input) => {
      // My Quotes and Home must show the new or changed quote; a typed-in address is saved to the farmer's list too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes });
      if (input.newPickupAddress) void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
    },
    onError: () => {
      // The usual server rejections are "price not published yet" and "offer below today's
      // price", and both mean the price on screen may be out of date. Refetch it so the
      // farmer sees the current price next to the error. A revise can also fail because the
      // quote was just decided or expired, so refresh the quotes too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.todayPrice });
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes });
    },
  });
  const submitting = submitMutation.isPending;

  // Opening this screen refetches anything older than 30s, so the price shown is current.
  const priceQuery = useQuery(todayPriceQuery);
  const price = priceQuery.data?.price ?? null;

  // A new offer starts at today's base price: the lowest price that will be accepted,
  // and a safe starting point the farmer can raise. Done once, so it never overwrites typing.
  const [pricePrefilled, setPricePrefilled] = useState(false);
  if (!revisingId && price && !pricePrefilled) {
    setPricePrefilled(true);
    if (fields.offeredPricePerKg === "") {
      setFields((current) => ({ ...current, offeredPricePerKg: offerPriceFromBase(price.basePricePerKg) }));
    }
  }

  // Price × quantity in kg, as a rough guide. The real amount depends on the weight at pickup.
  const quantityKg = Number(fields.quantity) * (quantityUnit === "quintal" ? 100 : 1);
  const estimatedTotal = Number(fields.offeredPricePerKg) * quantityKg;
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

  // Pre-select an address once, the first time addresses arrive (and, when revising, the
  // quote too); later refetches must not undo the farmer's own choice. A revised quote keeps
  // its current address when it is still saved, otherwise the default is used.
  if (selectedAddressId === null && addressQuery.data && (!revisingId || revisingQuote)) {
    const saved = addressQuery.data.addresses;
    const preferred =
      saved.find((a) => revisingQuote !== null && a.address === revisingQuote.offerPickupLocation) ??
      saved.find((a) => a.isDefault) ??
      saved[0];
    setSelectedAddressId(preferred ? preferred.id : NEW_ADDRESS);
  }

  const usingNewAddress = selectedAddressId === NEW_ADDRESS;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const pickupSummary = usingNewAddress
    ? `${newAddress.label.trim()} — ${newAddress.address.trim()}`
    : selectedAddress
      ? `${selectedAddress.label} — ${selectedAddress.address}`
      : "";

  /** Updates a field and clears its error, since the farmer is fixing it. */
  function setField<K extends keyof QuoteFields>(key: K, value: QuoteFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setDirty(true);
  }

  /** Switches units and converts the amount already typed, instead of clearing it. */
  function changeUnit(unit: QuantityUnit) {
    if (unit === quantityUnit) return;
    const converted = shiftDecimal(fields.quantity, unit === "kg" ? 2 : -2);
    setQuantityUnit(unit);
    setField("quantity", converted);
    // e.g. 250.5 kg is 2.505 quintals, more decimals than quintals allow: say so now, not at Review.
    if (unit === "quintal" && /\.\d{3,}$/.test(converted)) {
      setFieldErrors((current) => ({
        ...current,
        quantity: `That is ${converted} quintals. Quintals take up to two decimals, so round it or switch back to kg.`,
      }));
    }
  }

  // Back button, Android back gesture, Cancel and the top back link all land here.
  // Ask before discarding typed details; a submitted quote leaves freely.
  const navigation = useNavigation();
  usePreventRemove(dirty && !submitted, ({ data }) => {
    Alert.alert(
      revisingId ? "Discard your changes?" : "Discard this offer?",
      revisingId
        ? "Your quote stays as it was before you started editing."
        : "The details you entered will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  /** Every problem at once, in on-screen order, so the farmer can fix them in one pass. */
  function validate(): FieldErrors<QuoteErrorKey> {
    const errors: FieldErrors<QuoteErrorKey> = {};

    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(fields.offeredPricePerKg)) {
      errors.offeredPricePerKg = "Enter your offer price in rupees, for example 250 or 250.50.";
    } else if (price && Number(fields.offeredPricePerKg) < Number(price.basePricePerKg)) {
      // The server checks this too; catching it here saves a round trip and a confusing late error.
      errors.offeredPricePerKg = `Your offer must be at least today's base price of ₹${formatPricePerKg(price.basePricePerKg)} per kg.`;
    }
    const quantityPattern =
      quantityUnit === "quintal"
        ? /^\d{1,7}(?:\.\d{1,2})?$/
        : /^\d{1,9}(?:\.\d{1,3})?$/;
    if (!quantityPattern.test(fields.quantity) || Number(fields.quantity) <= 0) {
      errors.quantity =
        quantityUnit === "quintal"
          ? "Enter how many quintals, for example 2.5."
          : "Enter how many kg, for example 250.";
    }
    const moisture = Number(fields.moisturePercent);
    if (fields.moisturePercent.trim() === "" || !Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
      errors.moisturePercent = "Enter moisture as a percentage from 0 to 100, for example 7.5.";
    }
    const beanCount = Number(fields.beanCountPer100g);
    if (fields.beanCountPer100g.trim() === "" || !Number.isFinite(beanCount) || beanCount <= 0) {
      errors.beanCountPer100g = "Enter how many beans are in 100 g, for example 110.";
    }
    if (!fields.readyOn) {
      errors.readyOn = "Choose the date your cocoa will be ready for pickup.";
    } else if (fields.readyOn < todayInIndia()) {
      // ISO dates compare correctly as strings. Matters for a revised quote whose date has passed.
      errors.readyOn = "The ready date can't be before today. Choose today or a later date.";
    }
    if (usingNewAddress) {
      const addressErrors = validateAddress(newAddress);
      errors.addressLabel = addressErrors.label;
      errors.addressText = addressErrors.address;
    } else if (!selectedAddress) {
      errors.pickupAddress = "Choose where the driver should collect your cocoa.";
    }
    return errors;
  }

  function reviewQuote() {
    setError(null);
    const problems = validate();
    setFieldErrors(problems);
    if (hasErrors(problems)) {
      scrollToFirst(problems);
      return;
    }
    const moisture = Number(fields.moisturePercent);
    const beanCount = Number(fields.beanCountPer100g);

    posthog?.capture(revisingId ? "quote_revision_review_started" : "quote_review_started", {
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
    const input: QuoteInput = {
      offeredPricePerKg: fields.offeredPricePerKg,
      quantity: fields.quantity,
      quantityUnit,
      moisturePercent: Number(fields.moisturePercent),
      beanCountPer100g: Number(fields.beanCountPer100g),
      readyOn: fields.readyOn,
      ...(usingNewAddress
        ? { newPickupAddress: trimAddress(newAddress) }
        : { pickupAddressId: selectedAddress!.id }),
    };

    try {
      await submitMutation.mutateAsync(input);
      posthog?.capture(revisingId ? "quote_revised" : "quote_submitted", {
        offered_price_per_kg: Number(fields.offeredPricePerKg),
        quantity: Number(fields.quantity),
        quantity_unit: quantityUnit,
        moisture_percent: input.moisturePercent,
        bean_count_per_100g: input.beanCountPer100g,
        pickup_address: usingNewAddress ? "new" : "saved",
      });
      posthogLogger.info(revisingId ? "quote revision completed" : "quote submission completed", {
        operation: revisingId ? "quote_revision" : "quote_submission",
        quantity_unit: quantityUnit,
      });
      setSubmitted(true);
    } catch (submissionError) {
      posthogLogger.error(revisingId ? "quote revision failed" : "quote submission failed", {
        operation: revisingId ? "quote_revision" : "quote_submission",
        error_type: "request_failed",
      });
      setError(
        actionErrorMessage(
          submissionError,
          revisingId ? "Could not save your changes. Please try again." : "Could not submit your quote. Please try again.",
        ),
      );
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Space.four,
              paddingBottom: insets.bottom + Space.seven,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {!submitted ? (
            <View style={styles.topline}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                hitSlop={8}
                style={styles.backButton}
              >
                <ThemedText type="smallBold">← Back</ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.header}>
            <ThemedText type="label" themeColor="textSecondary">
              {revisingId ? "SELL COCOA · CHANGE QUOTE" : "SELL COCOA"}
            </ThemedText>
            <ThemedText type="title">
              {submitted
                ? revisingId ? "Quote updated." : "Quote submitted."
                : reviewing
                  ? revisingId ? "Review your changes." : "Review your quote."
                  : revisingId ? "Change your quote." : "Make an offer."}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {submitted
                ? "The buying team will review the details you submitted."
                : revisingId
                  ? "You can change any detail until the buying team decides. The quote still expires at the end of today."
                  : "Submitting this quote means you want to sell this cocoa. It stays open until the end of today."}
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
                {revisingId
                  ? "Your changes are saved. The buying team will see the new details when they review your quote."
                  : "You can return to Home. The buying team will review your price, quantity, quality details, ready date, and pickup address."}
              </ThemedText>
              {/* dismissTo goes back to a My Quotes or Home already in the stack (e.g. a revise
                  started from My Quotes) instead of stacking a second copy on top. */}
              <Button label="View my quotes" variant="outline" onPress={() => router.dismissTo("/my-quotes")} />
              <Button label="Back to Home" onPress={() => router.dismissTo("/(farmer)/(tabs)")} />
            </Card>
          ) : waitingForQuote ? (
            <Card style={styles.formCard}>
              <ActivityIndicator />
              <ThemedText themeColor="textSecondary">Loading your quote…</ThemedText>
            </Card>
          ) : revisingClosed ? (
            <Card style={styles.formCard}>
              <ThemedText type="label" themeColor="textSecondary">
                THIS QUOTE CAN NO LONGER BE CHANGED
              </ThemedText>
              <ThemedText>
                The buying team has already decided on it, or it expired at the end of the day. Check My quotes for its status.
              </ThemedText>
              <Button label="View my quotes" onPress={() => router.dismissTo("/my-quotes")} />
            </Card>
          ) : openQuote ? (
            <Card style={styles.formCard}>
              <ThemedText type="label" themeColor="textSecondary">
                YOU ALREADY HAVE AN OPEN QUOTE
              </ThemedText>
              <ThemedText>
                You can have one open quote at a time. Change that quote instead, or wait for the buying team to decide.
              </ThemedText>
              <Button
                label="Change my open quote  →"
                onPress={() => {
                  // Re-pick the address from the open quote once its details load.
                  setSelectedAddressId(null);
                  setError(null);
                  router.setParams({ offerId: openQuote.id });
                }}
              />
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
              <View style={[styles.totalBox, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="label" themeColor="textSecondary">
                  ESTIMATED VALUE
                </ThemedText>
                <ThemedText type="figure">{formatRupees(estimatedTotal)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`₹${fields.offeredPricePerKg}/kg × ${quantityKg.toLocaleString("en-IN")} kg. You are paid for the weight measured at pickup, so the final amount may differ.`}
                </ThemedText>
              </View>
              <ReviewRow label="Bean moisture" value={`${fields.moisturePercent}%`} />
              <ReviewRow label="Bean count" value={`${fields.beanCountPer100g} per 100 g`} />
              <ReviewRow label="Ready for pickup" value={formatDateForIndia(fields.readyOn)} />
              <ReviewRow label="Pickup address" value={pickupSummary} />
              {usingNewAddress ? (
                <ThemedText type="small" themeColor="textSecondary">
                  This address will be saved to your account for next time.
                </ThemedText>
              ) : null}
              <ThemedText themeColor="textSecondary">
                Moisture and bean count are self-reported. The buying team checks these details before deciding whether to accept the quote.
              </ThemedText>
              <FormError message={error} />
              <Button
                label="Edit details"
                variant="outline"
                onPress={() => {
                  setReviewing(false);
                  setError(null);
                }}
              />
              <Button
                label={revisingId ? "Save changes" : "Submit quote"}
                onPress={confirmSubmission}
                loading={submitting}
                disabled={!price}
              />
            </Card>
          ) : price ? (
            <Card style={styles.formCard}>
              {revisingQuote?.status === "invalid_needs_revision" ? (
                <View style={[styles.notice, { borderColor: theme.accent }]}>
                  <ThemedText type="smallBold">Today&apos;s price went up</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {`Your offer of ₹${formatPricePerKg(revisingQuote.offeredPricePerKg)}/kg is now below today's base price of ₹${formatPricePerKg(price.basePricePerKg)}/kg. Raise your offer to at least ₹${formatPricePerKg(price.basePricePerKg)} to keep this quote open.`}
                  </ThemedText>
                </View>
              ) : null}
              <InputField
                label="OFFER PRICE PER KG (₹)"
                error={fieldErrors.offeredPricePerKg}
                fieldRef={fieldRef("offeredPricePerKg")}
                value={fields.offeredPricePerKg}
                onChangeText={(value) => setField("offeredPricePerKg", value)}
                placeholder={price ? offerPriceFromBase(price.basePricePerKg) : "e.g. 250"}
                keyboardType="decimal-pad"
              />
              <ThemedText type="small" themeColor="textSecondary">
                {revisingId
                  ? `Today's base price is ₹${formatPricePerKg(price.basePricePerKg)}/kg. Your offer must be at least this.`
                  : "Filled in with today's base price, the lowest price you can offer. You can offer more."}
              </ThemedText>
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
                        onPress={() => changeUnit(unit)}
                        style={[
                          styles.unitOption,
                          selected
                            ? { borderColor: theme.accent, backgroundColor: theme.accentSoft }
                            : { borderColor: theme.border },
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          themeColor={selected ? "text" : "textSecondary"}
                        >
                          {unit === "quintal" ? "Quintals" : "Kilograms (kg)"}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <InputField
                  label={quantityUnit === "quintal" ? "QUANTITY (QUINTALS)" : "QUANTITY (KG)"}
                  error={fieldErrors.quantity}
                  fieldRef={fieldRef("quantity")}
                  value={fields.quantity}
                  onChangeText={(value) => setField("quantity", value)}
                  placeholder={quantityUnit === "quintal" ? "e.g. 2.50" : "e.g. 250"}
                  keyboardType="decimal-pad"
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {quantityUnit === "quintal"
                  ? "1 quintal = 100 kg. Enter up to two decimal places."
                  : "Enter up to three decimal places. Switching units converts the amount."}
              </ThemedText>
              <InputField
                label="BEAN MOISTURE (%)"
                error={fieldErrors.moisturePercent}
                fieldRef={fieldRef("moisturePercent")}
                value={fields.moisturePercent}
                onChangeText={(value) => setField("moisturePercent", value)}
                placeholder="e.g. 7.5"
                keyboardType="decimal-pad"
              />
              <InputField
                label="BEAN COUNT PER 100 G"
                error={fieldErrors.beanCountPer100g}
                fieldRef={fieldRef("beanCountPer100g")}
                value={fields.beanCountPer100g}
                onChangeText={(value) => setField("beanCountPer100g", value)}
                placeholder="e.g. 110"
                keyboardType="decimal-pad"
              />
              <DateField
                label="READY FOR PICKUP ON"
                error={fieldErrors.readyOn}
                fieldRef={fieldRef("readyOn")}
                value={fields.readyOn}
                onChange={(value) => setField("readyOn", value)}
                minimumDate={todayInIndia()}
                placeholder="Choose the date"
              />
              <View ref={fieldRef("pickupAddress")} style={styles.field}>
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
                          setDirty(true);
                          setFieldErrors((current) => ({
                            ...current,
                            pickupAddress: undefined,
                            addressLabel: undefined,
                            addressText: undefined,
                          }));
                        }}
                        allowNew
                      />
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        Where should the driver collect your cocoa? We'll save this address for your next quote.
                      </ThemedText>
                    )}
                    <FieldError message={fieldErrors.pickupAddress} />
                    {usingNewAddress ? (
                      // The scroll target for a problem in the new address's name or text.
                      <View
                        ref={(node) => {
                          fieldRef("addressLabel")(node);
                          fieldRef("addressText")(node);
                        }}
                      >
                        <AddressFields
                          value={newAddress}
                          onChange={(value, changed) => {
                            setNewAddress(value);
                            setDirty(true);
                            const key = changed === "label" ? "addressLabel" : "addressText";
                            setFieldErrors((current) => ({ ...current, [key]: undefined }));
                          }}
                          errors={{ label: fieldErrors.addressLabel, address: fieldErrors.addressText }}
                        />
                      </View>
                    ) : null}
                  </>
                )}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                These quality details are self-reported. The buying team will check them when they review your quote.
              </ThemedText>
              <FormError
                message={
                  hasErrors(fieldErrors)
                    ? "Some details need fixing. Check the fields marked in red above."
                    : error
                }
              />
              <Button
                label="Review quote  →"
                onPress={reviewQuote}
                disabled={addressesLoading || Boolean(addressesError)}
              />
            </Card>
          ) : null}

          {!submitted ? (
            <Button label="Cancel" variant="outline" onPress={() => router.back()} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  topline: { flexDirection: "row", alignItems: "center" },
  backButton: { paddingVertical: Space.two, paddingRight: Space.four },
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
    borderRadius: Radius.control,
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
  totalBox: { gap: Space.one, borderRadius: Radius.control, padding: Space.three },
  notice: { gap: Space.one, borderLeftWidth: 3, paddingLeft: Space.three },
});
