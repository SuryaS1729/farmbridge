import { StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { AddressInput } from "@/lib/farmbridge-api";

export const emptyAddress: AddressInput = { label: "Home", address: "" };

/** Mirrors the API rules so farmers see problems before sending. */
export function validateAddress(input: AddressInput): string | null {
  const label = input.label.trim();
  const address = input.address.trim();
  if (label.length < 1) return "Give this address a short name, like Home.";
  if (label.length > 40) return "Keep the address name to 40 characters or fewer.";
  if (address.length < 5) return "Enter the address with a landmark, at least 5 characters.";
  if (address.length > 500) return "Keep the address to 500 characters or fewer.";
  return null;
}

export function trimAddress(input: AddressInput): AddressInput {
  return { label: input.label.trim(), address: input.address.trim() };
}

export function AddressFields({
  value,
  onChange,
  disabled = false,
}: {
  value: AddressInput;
  onChange: (value: AddressInput) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const inputColors = {
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          ADDRESS NAME
        </ThemedText>
        <TextInput
          value={value.label}
          onChangeText={(label) => onChange({ ...value, label })}
          placeholder="Home, Drying yard, Farm…"
          placeholderTextColor={theme.textSecondary}
          maxLength={40}
          editable={!disabled}
          style={[styles.input, inputColors]}
          accessibilityLabel="Address name"
        />
      </View>
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          PICKUP ADDRESS
        </ThemedText>
        <TextInput
          value={value.address}
          onChangeText={(address) => onChange({ ...value, address })}
          placeholder="Village, landmark, and directions the driver can follow"
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlignVertical="top"
          maxLength={500}
          editable={!disabled}
          style={[styles.input, styles.multiline, inputColors]}
          accessibilityLabel="Pickup address"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Space.three },
  field: { gap: Space.two },
  input: {
    minHeight: 50,
    paddingHorizontal: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
    fontFamily: Fonts?.sans,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    paddingTop: Space.three,
    paddingBottom: Space.three,
    lineHeight: 22,
  },
});
