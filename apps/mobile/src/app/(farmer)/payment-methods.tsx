import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Method = "upi" | "bank";

type BankFields = {
  holderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
};

const emptyBank: BankFields = {
  holderName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifsc: "",
};

// UPI handles look like name@bank; IFSC is 4 letters, a zero, then 6 letters or digits.
const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function validateUpi(upiId: string): string | null {
  if (!UPI_PATTERN.test(upiId.trim())) return "Enter a valid UPI ID, like 9876543210@ybl.";
  return null;
}

function validateBank(bank: BankFields): string | null {
  if (bank.holderName.trim().length < 2) return "Enter the name exactly as it appears on the bank account.";
  if (!/^\d{9,18}$/.test(bank.accountNumber)) return "Account numbers have 9 to 18 digits.";
  if (bank.accountNumber !== bank.confirmAccountNumber) return "The two account numbers don't match.";
  if (!IFSC_PATTERN.test(bank.ifsc)) return "Enter a valid 11-character IFSC code, like SBIN0001234.";
  return null;
}

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [method, setMethod] = useState<Method>("upi");
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState<BankFields>(emptyBank);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const problem = method === "upi" ? validateUpi(upiId) : validateBank(bank);
    setError(problem);
    if (problem) return;
    // TODO: no payout API exists yet. Wire this to a farmer payment-method endpoint
    // (and store account numbers encrypted) before launch.
    Alert.alert(
      "Not saved yet",
      "Your details look right, but saving payment methods isn't switched on yet.",
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          <View style={styles.topline}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ThemedText type="smallBold">← Profile</ThemedText>
            </Pressable>
            <ThemedText type="label" themeColor="textSecondary">
              PAYOUTS
            </ThemedText>
          </View>

          <View style={styles.intro}>
            <ThemedText type="title">Payment methods</ThemedText>
            <ThemedText themeColor="textSecondary">
              We pay you here once your cocoa is collected and checked.
            </ThemedText>
          </View>

          <View
            accessibilityRole="tablist"
            style={[
              styles.toggle,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}
          >
            {(
              [
                ["upi", "UPI"],
                ["bank", "Bank account"],
              ] as const
            ).map(([value, label]) => {
              const selected = method === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setMethod(value);
                    setError(null);
                  }}
                  style={[styles.toggleButton, selected && { backgroundColor: theme.accent }]}
                >
                  <ThemedText
                    type="smallBold"
                    themeColor={selected ? "accentText" : "textSecondary"}
                  >
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Card style={styles.form}>
            {method === "upi" ? (
              <Field
                label="UPI ID"
                hint="Find it in PhonePe, Google Pay or Paytm under your profile."
                value={upiId}
                onChangeText={setUpiId}
                placeholder="9876543210@ybl"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            ) : (
              <>
                <Field
                  label="Account holder name"
                  value={bank.holderName}
                  onChangeText={(holderName) => setBank({ ...bank, holderName })}
                  placeholder="As printed on your passbook"
                  autoCapitalize="words"
                />
                <Field
                  label="Account number"
                  value={bank.accountNumber}
                  onChangeText={(text) =>
                    setBank({ ...bank, accountNumber: text.replace(/\D/g, "") })
                  }
                  placeholder="000123456789"
                  keyboardType="number-pad"
                  maxLength={18}
                  secureTextEntry
                />
                <Field
                  label="Confirm account number"
                  value={bank.confirmAccountNumber}
                  onChangeText={(text) =>
                    setBank({ ...bank, confirmAccountNumber: text.replace(/\D/g, "") })
                  }
                  placeholder="Type it again"
                  keyboardType="number-pad"
                  maxLength={18}
                />
                <Field
                  label="IFSC code"
                  hint="11 characters, printed on your passbook or cheque."
                  value={bank.ifsc}
                  onChangeText={(text) =>
                    setBank({ ...bank, ifsc: text.toUpperCase().replace(/[^A-Z0-9]/g, "") })
                  }
                  placeholder="SBIN0001234"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={11}
                />
              </>
            )}
          </Card>

          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <Button label="Save payment method" onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function Field({
  label,
  hint,
  ...inputProps
}: { label: string; hint?: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
      />
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
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
  intro: { gap: Space.two },
  toggle: {
    flexDirection: "row",
    padding: 3,
    borderWidth: 1,
    borderRadius: Radius.card,
  },
  toggleButton: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.control,
  },
  form: { gap: Space.four },
  field: { gap: Space.two },
  input: {
    minHeight: 50,
    paddingHorizontal: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
    fontFamily: Fonts?.sans,
    fontSize: 16,
  },
  error: { color: "#9A4237" },
});
