import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
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
import { DatePicker } from "@/components/date-field";
import {
  FieldError,
  FormError,
  hasErrors,
  useScrollToField,
  type FieldErrors,
} from "@/components/form-errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { StepProgress } from "@/components/ui/step-progress";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radius, Space } from "@/constants/theme";
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

/** The three question steps, then the review. */
type Step = 0 | 1 | 2 | 3;
const REVIEW = 3;
const STEP_TITLES = ["Your cocoa.", "Bean quality.", "Pickup."] as const;
/** Which fields each question step asks for, so Next checks only those. */
const STEP_FIELDS: readonly (readonly QuoteErrorKey[])[] = [
  ["quantity", "offeredPricePerKg"],
  ["moisturePercent", "beanCountPer100g"],
  ["readyOn", "pickupAddress", "addressLabel", "addressText"],
];

const UNIT_OPTIONS = [
  { value: "quintal", label: "Quintals" },
  { value: "kg", label: "kg", accessibilityLabel: "Kilograms" },
] as const;

/** The errors that belong to one step, in on-screen order. */
function errorsForStep(errors: FieldErrors<QuoteErrorKey>, step: number) {
  const picked: FieldErrors<QuoteErrorKey> = {};
  for (const key of STEP_FIELDS[step] ?? []) {
    if (errors[key]) picked[key] = errors[key];
  }
  return picked;
}

/** The first question step with a problem, or null when everything is fine. */
function firstStepWithErrors(errors: FieldErrors<QuoteErrorKey>): Step | null {
  const index = STEP_FIELDS.findIndex((_, step) => hasErrors(errorsForStep(errors, step)));
  return index === -1 ? null : (index as Step);
}

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

/** A row of large tappable choices, like Today / Tomorrow / Another day. */
function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.choiceRow} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.choice,
              selected
                ? { borderColor: theme.accent, backgroundColor: theme.accentSoft }
                : { borderColor: theme.border },
            ]}
          >
            <ThemedText type="smallBold" themeColor={selected ? "text" : "textSecondary"}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
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

/** One group on the review screen, with a Change link back to the step that asked for it. */
function ReviewSection({
  title,
  onChange,
  children,
}: {
  title: string;
  onChange: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.reviewSection, { borderTopColor: theme.border }]}>
      <View style={styles.labelRow}>
        <ThemedText type="label" themeColor="textSecondary">
          {title}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change ${title.toLowerCase()}`}
          hitSlop={8}
          onPress={onChange}
        >
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Change
          </ThemedText>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export default function QuoteScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<QuoteFields>(emptyFields);
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("quintal");
  const [step, setStep] = useState<Step>(0);
  // Set when the farmer taps Change on the review, so the step returns there when done.
  const [returnToReview, setReturnToReview] = useState(false);
  // A revise jumps to one step or the review instead of walking through all three, so its
  // steps go straight to the review and Back leaves.
  const [revising, setRevising] = useState(false);
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
  // "Another day" opens the phone's date picker straight away.
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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
  const needsRevision = revisingQuote?.status === "invalid_needs_revision";
  // Quotes come newest first; a new offer reuses the last one's quality and address.
  const lastQuote = revisingId ? null : quotesResult.data?.offers[0] ?? null;

  // Fill the form from the saved quote once, the first time it arrives. A quote that only
  // needs a higher price opens on the price; any other revise opens on the review.
  const [prefilled, setPrefilled] = useState(false);
  if (revisingQuote && !prefilled) {
    setPrefilled(true);
    const initial = fieldsFromQuote(revisingQuote);
    setFields(initial.fields);
    setQuantityUnit(initial.unit);
    setStep(revisingQuote.status === "invalid_needs_revision" ? 0 : REVIEW);
    setRevising(true);
  }

  // A new offer starts with the last quote's quality details, once, the first time quotes
  // arrive. The quality step says so, and the farmer can change them there.
  const [qualityChecked, setQualityChecked] = useState(false);
  const [qualityFromLastQuote, setQualityFromLastQuote] = useState(false);
  if (!revisingId && quotesResult.data && !qualityChecked) {
    setQualityChecked(true);
    if (lastQuote && fields.moisturePercent === "" && fields.beanCountPer100g === "") {
      setFields((current) => ({
        ...current,
        moisturePercent: formatPricePerKg(lastQuote.moisturePercent),
        beanCountPer100g: formatPricePerKg(lastQuote.beanCountPer100g),
      }));
      setQualityFromLastQuote(true);
    }
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
  const hasEstimate = Number.isFinite(estimatedTotal) && estimatedTotal > 0;
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

  // Pre-select an address once, the first time addresses and quotes arrive; later refetches
  // must not undo the farmer's own choice. A revise keeps its quote's address and a new offer
  // reuses the last quote's, when still saved; otherwise the default is used.
  if (
    selectedAddressId === null &&
    addressQuery.data &&
    !quotesResult.isPending &&
    (!revisingId || revisingQuote)
  ) {
    const saved = addressQuery.data.addresses;
    const previousLocation = revisingQuote?.offerPickupLocation ?? lastQuote?.offerPickupLocation ?? null;
    const preferred =
      saved.find((a) => previousLocation !== null && a.address === previousLocation) ??
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

  const today = todayInIndia();
  const tomorrow = todayInIndia(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const readyChoice: "today" | "tomorrow" | "other" | null =
    fields.readyOn === today
      ? "today"
      : fields.readyOn === tomorrow
        ? "tomorrow"
        : fields.readyOn
          ? "other"
          : null;

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

  function chooseReadyDay(choice: "today" | "tomorrow" | "other") {
    if (choice === "other") {
      // Tapping it again reopens the picker to change the day. Cancel keeps the earlier choice.
      setDatePickerOpen(true);
      return;
    }
    setDatePickerOpen(false);
    setField("readyOn", choice === "today" ? today : tomorrow);
  }

  // Where Back goes from inside the form: to the review after a Change, else the previous
  // step. Null means Back leaves the screen.
  const previousStep: Step | null = returnToReview
    ? REVIEW
    : step > 0 && !revising
      ? ((step - 1) as Step)
      : null;

  /** Moves to a step, starting at its top rather than where the last one was scrolled. */
  function showStep(target: Step, fromReview = false) {
    setError(null);
    setDatePickerOpen(false);
    setReturnToReview(fromReview);
    setStep(target);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // Back button, Android back gesture and the top back link all land here. Inside the form
  // they step back; leaving asks before discarding typed details. A submitted quote leaves freely.
  const navigation = useNavigation();
  const blocked = !submitted && !openQuote && !revisingClosed;
  usePreventRemove(blocked && (previousStep !== null || dirty), ({ data }) => {
    if (previousStep !== null) {
      showStep(previousStep);
      return;
    }
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

  /** Every problem at once, in on-screen order. Each step shows only its own. */
  function validate(): FieldErrors<QuoteErrorKey> {
    const errors: FieldErrors<QuoteErrorKey> = {};

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
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(fields.offeredPricePerKg)) {
      errors.offeredPricePerKg = "Enter your price in rupees, for example 250 or 250.50.";
    } else if (price && Number(fields.offeredPricePerKg) < Number(price.basePricePerKg)) {
      // The server checks this too; catching it here saves a round trip and a confusing late error.
      errors.offeredPricePerKg = `Your price must be at least today's base price of ₹${formatPricePerKg(price.basePricePerKg)} per kg.`;
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
      errors.readyOn = "Choose the day your cocoa will be ready.";
    } else if (fields.readyOn < todayInIndia()) {
      // ISO dates compare correctly as strings. Matters for a revised quote whose date has passed.
      errors.readyOn = "That day has passed. Choose today or a later day.";
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

  /** Sends the farmer to the first step with a problem. Returns false if there was one. */
  function checkAll() {
    const problems = validate();
    const badStep = firstStepWithErrors(problems);
    if (badStep === null) return true;
    const stepProblems = errorsForStep(problems, badStep);
    setFieldErrors(stepProblems);
    setReturnToReview(false);
    setStep(badStep);
    scrollToFirst(stepProblems);
    return false;
  }

  function openReview() {
    if (!checkAll()) return;
    setFieldErrors({});
    posthog?.capture(revisingId ? "quote_revision_review_started" : "quote_review_started", {
      offered_price_per_kg: Number(fields.offeredPricePerKg),
      quantity: Number(fields.quantity),
      quantity_unit: quantityUnit,
      moisture_percent: Number(fields.moisturePercent),
      bean_count_per_100g: Number(fields.beanCountPer100g),
      quality_from_last_quote: qualityFromLastQuote,
    });
    showStep(REVIEW);
  }

  /** Next / Review / Back to review: checks this step's fields only, then moves on. */
  function continueFromStep() {
    setError(null);
    const problems = errorsForStep(validate(), step);
    setFieldErrors(problems);
    if (hasErrors(problems)) {
      scrollToFirst(problems);
      return;
    }
    if (returnToReview || revising || step === 2) {
      openReview();
      return;
    }
    showStep((step + 1) as Step);
  }

  async function confirmSubmission() {
    setError(null);
    // A revise opens on the review, so its details (like a ready date now past) are checked here.
    if (!checkAll()) return;
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

  const inForm = !submitted && !waitingForQuote && !revisingClosed && !openQuote && Boolean(price);
  const title = submitted
    ? revisingId ? "Quote updated." : "Quote submitted."
    : !inForm
      ? revisingId ? "Change your quote." : "Make an offer."
      : step === REVIEW
        ? revisingId ? "Check your changes." : "Check your quote."
        : STEP_TITLES[step];
  const subtitle = submitted
    ? "The buying team will review it today."
    : revisingId
      ? "You can change it until the buying team decides."
      : "Your offer stays open until the end of today.";

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
            {inForm && step !== REVIEW && !revising ? (
              <StepProgress step={step} total={3} />
            ) : (
              <ThemedText type="label" themeColor="textSecondary">
                {revisingId ? "SELL COCOA · CHANGE QUOTE" : "SELL COCOA"}
              </ThemedText>
            )}
            <ThemedText type="title">{title}</ThemedText>
            {inForm && step > 0 && step < REVIEW ? null : (
              <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
            )}
          </View>

          {submitted ? (
            <Card style={styles.formCard}>
              <ThemedText>
                {revisingId
                  ? "Your changes are saved. The buying team will see the new details when they review your quote."
                  : "You can follow it on your Home screen and in My quotes."}
              </ThemedText>
              {/* dismissTo goes back to a My Quotes or Home already in the stack (e.g. a revise
                  started from My Quotes) instead of stacking a second copy on top. */}
              <Button label="View my quotes" variant="outline" onPress={() => router.dismissTo("/my-quotes")} />
              <Button label="Back to Home" onPress={() => router.dismissTo("/(farmer)/(tabs)")} />
            </Card>
          ) : waitingForQuote || loadingPrice ? (
            <Card style={styles.formCard}>
              <ActivityIndicator />
              <ThemedText themeColor="textSecondary">
                {waitingForQuote ? "Loading your quote…" : "Loading today's cocoa price…"}
              </ThemedText>
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
          ) : priceError ? (
            <Card style={styles.formCard}>
              <ThemedText themeColor="textSecondary">{priceError}</ThemedText>
              <Button label="Retry" variant="outline" onPress={() => void priceQuery.refetch()} />
            </Card>
          ) : !price ? (
            <Card style={styles.formCard}>
              <ThemedText type="label" themeColor="textSecondary">
                NO PRICE PUBLISHED
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                The buying team has not published today's cocoa price yet. Check back later today.
              </ThemedText>
            </Card>
          ) : (
            // Keyed by step so each step fades in instead of swapping abruptly.
            <Animated.View key={step} entering={FadeIn.duration(180)}>
              {step === 0 ? (
                <Card style={styles.formCard}>
                  {needsRevision && revisingQuote ? (
                    <View style={[styles.notice, { borderColor: theme.accent }]}>
                      <ThemedText type="smallBold">Today&apos;s price went up</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {`Raise your price to at least ₹${formatPricePerKg(price.basePricePerKg)}/kg to keep this quote open.`}
                      </ThemedText>
                    </View>
                  ) : null}
                  <InputField
                    label="HOW MUCH COCOA?"
                    accessory={
                      <SegmentedToggle
                        accessibilityLabel="Quantity unit"
                        options={UNIT_OPTIONS}
                        value={quantityUnit}
                        onChange={changeUnit}
                      />
                    }
                    error={fieldErrors.quantity}
                    fieldRef={fieldRef("quantity")}
                    value={fields.quantity}
                    onChangeText={(value) => setField("quantity", value)}
                    placeholder={quantityUnit === "quintal" ? "e.g. 2.5" : "e.g. 250"}
                    hint={quantityUnit === "quintal" ? "1 quintal = 100 kg" : undefined}
                    keyboardType="decimal-pad"
                  />
                  <InputField
                    label="YOUR PRICE PER KG (₹)"
                    error={fieldErrors.offeredPricePerKg}
                    fieldRef={fieldRef("offeredPricePerKg")}
                    value={fields.offeredPricePerKg}
                    onChangeText={(value) => setField("offeredPricePerKg", value)}
                    placeholder={offerPriceFromBase(price.basePricePerKg)}
                    hint={`Today's base price is ₹${formatPricePerKg(price.basePricePerKg)}. You can offer more.`}
                    keyboardType="decimal-pad"
                  />
                  {hasEstimate ? (
                    <View style={[styles.totalBox, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText type="label" themeColor="textSecondary">
                        ESTIMATED VALUE
                      </ThemedText>
                      <ThemedText type="figure">{formatRupees(estimatedTotal)}</ThemedText>
                    </View>
                  ) : null}
                </Card>
              ) : step === 1 ? (
                <Card style={styles.formCard}>
                  <ThemedText themeColor="textSecondary">
                    {qualityFromLastQuote
                      ? "Filled in from your last quote. Change them if these beans are different."
                      : "Check a sample of the beans you are selling. The buying team confirms these at pickup."}
                  </ThemedText>
                  <InputField
                    label="BEAN MOISTURE (%)"
                    error={fieldErrors.moisturePercent}
                    fieldRef={fieldRef("moisturePercent")}
                    value={fields.moisturePercent}
                    onChangeText={(value) => setField("moisturePercent", value)}
                    placeholder="e.g. 7.5"
                    hint="The reading from a moisture meter."
                    keyboardType="decimal-pad"
                  />
                  <InputField
                    label="BEAN COUNT PER 100 G"
                    error={fieldErrors.beanCountPer100g}
                    fieldRef={fieldRef("beanCountPer100g")}
                    value={fields.beanCountPer100g}
                    onChangeText={(value) => setField("beanCountPer100g", value)}
                    placeholder="e.g. 110"
                    hint="Weigh 100 g of beans and count them."
                    keyboardType="number-pad"
                  />
                </Card>
              ) : step === 2 ? (
                <Card style={styles.formCard}>
                  <View ref={fieldRef("readyOn")} style={styles.field}>
                    <ThemedText type="label" themeColor="textSecondary">
                      WHEN WILL IT BE READY?
                    </ThemedText>
                    <ChoiceRow
                      options={[
                        { value: "today", label: "Today" },
                        { value: "tomorrow", label: "Tomorrow" },
                        {
                          value: "other",
                          // Once picked, the button shows the day itself.
                          label: readyChoice === "other" ? formatDateForIndia(fields.readyOn) : "Another day",
                        },
                      ]}
                      value={readyChoice}
                      onChange={chooseReadyDay}
                    />
                    <DatePicker
                      open={datePickerOpen}
                      value={readyChoice === "other" ? fields.readyOn : ""}
                      minimumDate={today}
                      onChoose={(value) => {
                        setDatePickerOpen(false);
                        setField("readyOn", value);
                      }}
                      onClose={() => setDatePickerOpen(false)}
                    />
                    <FieldError message={fieldErrors.readyOn} />
                  </View>
                  <View ref={fieldRef("pickupAddress")} style={styles.field}>
                    <ThemedText type="label" themeColor="textSecondary">
                      WHERE SHOULD WE COLLECT IT?
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
                            Add the address the driver should come to. We&apos;ll save it for next time.
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
                </Card>
              ) : (
                <Card style={styles.formCard}>
                  <View style={[styles.totalBox, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="label" themeColor="textSecondary">
                      ESTIMATED VALUE
                    </ThemedText>
                    <ThemedText type="figure">{formatRupees(estimatedTotal)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      You are paid for the weight measured at pickup, so the final amount may differ.
                    </ThemedText>
                  </View>
                  <ReviewSection title="YOUR COCOA" onChange={() => showStep(0, true)}>
                    <ReviewRow
                      label="Quantity"
                      value={`${fields.quantity} ${quantityUnit === "quintal" ? "quintals" : "kg"}`}
                    />
                    <ReviewRow label="Your price" value={`₹${fields.offeredPricePerKg} per kg`} />
                  </ReviewSection>
                  <ReviewSection title="BEAN QUALITY" onChange={() => showStep(1, true)}>
                    <ReviewRow label="Moisture" value={`${fields.moisturePercent}%`} />
                    <ReviewRow label="Bean count" value={`${fields.beanCountPer100g} per 100 g`} />
                  </ReviewSection>
                  <ReviewSection title="PICKUP" onChange={() => showStep(2, true)}>
                    <ReviewRow label="Ready on" value={fields.readyOn ? formatDateForIndia(fields.readyOn) : ""} />
                    <ReviewRow label="Address" value={pickupSummary} />
                    {usingNewAddress ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        We&apos;ll save this address for next time.
                      </ThemedText>
                    ) : null}
                  </ReviewSection>
                  <FormError message={error} />
                  <Button
                    label={revisingId ? "Save changes" : "Submit quote"}
                    onPress={confirmSubmission}
                    loading={submitting}
                  />
                </Card>
              )}
            </Animated.View>
          )}

          {inForm && step !== REVIEW ? (
            <View style={styles.actions}>
              <FormError message={error} />
              <View style={styles.actionRow}>
                {/* Only between steps of a new offer; after a Change the main button already returns to the review. */}
                {previousStep !== null && !returnToReview ? (
                  <Button
                    label="←  Back"
                    variant="outline"
                    style={styles.backAction}
                    onPress={() => showStep(previousStep)}
                  />
                ) : null}
                <Button
                  label={returnToReview ? "Back to review" : revising || step === 2 ? "Review  →" : "Next  →"}
                  style={styles.nextAction}
                  onPress={continueFromStep}
                  disabled={step === 2 && (addressesLoading || Boolean(addressesError))}
                />
              </View>
            </View>
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
  formCard: { gap: Space.four, padding: Space.four },
  field: { gap: Space.two },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
  },
  choiceRow: { flexDirection: "row", gap: Space.two },
  choice: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Space.two,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  reviewSection: {
    gap: Space.one,
    paddingTop: Space.three,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  actions: { gap: Space.three },
  actionRow: { flexDirection: "row", gap: Space.three },
  backAction: { flex: 1 },
  nextAction: { flex: 2 },
});
