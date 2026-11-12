import { useCallback, useEffect, useState } from "react";
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

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getTodayPrice,
  formatPricePerKg,
  submitQuote,
  type DailyCocoaPrice,
  type QuoteInput,
} from "@/lib/farmbridge-api";

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
  const [price, setPrice] = useState<DailyCocoaPrice | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [fields, setFields] = useState<QuoteFields>(emptyFields);
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("quintal");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPrice = useCallback(async () => {
    setLoadingPrice(true);
    setPriceError(null);
    try {
      const result = await getTodayPrice();
      setPrice(result.price);
    } catch {
      setPriceError("Could not load today's cocoa price.");
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  useEffect(() => {
    void refreshPrice();
  }, [refreshPrice]);

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

    setReviewing(true);
  }

  async function confirmSubmission() {
    setError(null);
    const readyOn = indianDateToIso(fields.readyOn);
    if (!readyOn) {
      setError("Enter the expected pickup readiness date as DD-MM-YYYY.");
      return;
    }
    setSubmitting(true);

    const input: QuoteInput = {
      offeredPricePerKg: fields.offeredPricePerKg,
      quantity: fields.quantity,
      quantityUnit,
      moisturePercent: Number(fields.moisturePercent),
      beanCountPer100g: Number(fields.beanCountPer100g),
      readyOn,
    };

    try {
      await submitQuote(input);
      setSubmitted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not submit your quote. Please try again.",
      );
    } finally {
      setSubmitting(false);
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
            <Button label="Retry" variant="outline" onPress={refreshPrice} />
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
              You can return to Home. The administrator will review the submitted price, quantity, quality details, and readiness date.
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
            <ThemedText type="small" themeColor="textSecondary">
              These quality details are self-reported. The administrator will review your quote.
            </ThemedText>
            <Button label="Review quote  →" onPress={reviewQuote} />
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
