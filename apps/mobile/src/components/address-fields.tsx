import { StyleSheet, TextInput, View } from "react-native";

import { FieldError, type FieldErrors } from "@/components/form-errors";
import { enterKeyProps } from "@/components/ui/form-keyboard-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { AddressInput } from "@/lib/farmbridge-api";

export const emptyAddress: AddressInput = { label: "Home", address: "" };

export type AddressFieldErrors = FieldErrors<keyof AddressInput>;

/** Mirrors the API rules so farmers see problems before sending. One message per field. */
export function validateAddress(input: AddressInput): AddressFieldErrors {
  const label = input.label.trim();
  const address = input.address.trim();
  const errors: AddressFieldErrors = {};
  if (label.length < 1) errors.label = "Give this address a short name, like Home.";
  else if (label.length > 40) errors.label = "Keep the address name to 40 characters or fewer.";
  if (address.length < 5) errors.address = "Enter the address with a landmark, at least 5 characters.";
  else if (address.length > 500) errors.address = "Keep the address to 500 characters or fewer.";
  return errors;
}

export function trimAddress(input: AddressInput): AddressInput {
  return { label: input.label.trim(), address: input.address.trim() };
}

export function AddressFields({
  value,
  onChange,
  disabled = false,
  errors = {},
}: {
  value: AddressInput;
  /** Also receives which field changed, so the caller can clear that field's error. */
  onChange: (value: AddressInput, changed: keyof AddressInput) => void;
  disabled?: boolean;
  errors?: AddressFieldErrors;
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
          onChangeText={(label) => onChange({ ...value, label }, "label")}
          placeholder="Home, Drying yard, Farm…"
          placeholderTextColor={theme.textSecondary}
          maxLength={40}
          editable={!disabled}
          // Enter moves on to the address text, keeping the keyboard open.
          {...enterKeyProps("next")}
          style={[styles.input, inputColors, errors.label ? { borderColor: theme.danger } : null]}
          accessibilityLabel="Address name"
        />
        <FieldError message={errors.label} />
      </View>
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          PICKUP ADDRESS
        </ThemedText>
        <TextInput
          value={value.address}
          onChangeText={(address) => onChange({ ...value, address }, "address")}
          placeholder="Village, landmark, and directions the driver can follow"
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlignVertical="top"
          maxLength={500}
          editable={!disabled}
          style={[
            styles.input,
            styles.multiline,
            inputColors,
            errors.address ? { borderColor: theme.danger } : null,
          ]}
          accessibilityLabel="Pickup address"
        />
        <FieldError message={errors.address} />
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
