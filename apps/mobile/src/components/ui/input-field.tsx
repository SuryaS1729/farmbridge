import type { ReactNode } from "react";
import { StyleSheet, TextInput, View, type HostInstance, type TextInputProps } from "react-native";

import { FieldError } from "@/components/form-errors";
import { ThemedText } from "@/components/themed-text";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** A labelled text input with an optional one-line hint and an inline error in red. */
export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  hint,
  error,
  fieldRef,
  accessory,
  unit,
  inputProps,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: TextInputProps["keyboardType"];
  /** One short line under the input. */
  hint?: string;
  error?: string;
  /** Scroll target for the first error, from useScrollToField. */
  fieldRef?: (node: HostInstance | null) => void;
  /** Shown at the right of the label, e.g. a unit switch. */
  accessory?: ReactNode;
  /** Shown in a segment at the right of the input, e.g. "kg" or "quintal". */
  unit?: string;
  /** Extra TextInput props, e.g. autoCapitalize or maxLength. */
  inputProps?: TextInputProps;
}) {
  const theme = useTheme();

  return (
    <View ref={fieldRef} style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="label" themeColor="textSecondary">
          {label}
        </ThemedText>
        {accessory}
      </View>
      <View
        style={[
          styles.box,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
      >
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={keyboardType}
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel={unit ? `${label}, in ${unit}` : label}
          accessibilityHint={hint}
        />
        {unit ? (
          <View
            style={[styles.unit, { backgroundColor: theme.backgroundSubtle, borderLeftColor: theme.border }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ThemedText type="smallBold">{unit}</ThemedText>
          </View>
        ) : null}
      </View>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Space.two },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
  },
  box: {
    flexDirection: "row",
    minHeight: 54,
    borderWidth: 1,
    borderRadius: Radius.control,
    overflow: "hidden",
  },
  unit: {
    minWidth: 76,
    paddingHorizontal: Space.three,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: Space.three,
    fontFamily: Fonts.sans,
    fontSize: 17,
  },
});
