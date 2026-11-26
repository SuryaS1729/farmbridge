import type { ReactNode } from "react";
import { StyleSheet, TextInput, View, type HostInstance, type TextInputProps } from "react-native";

import { FieldError } from "@/components/form-errors";
import { enterKeyProps } from "@/components/ui/form-keyboard-toolbar";
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
  prefix,
  returnKeyType = "next",
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
  /** Shown in a segment at the right of the input, e.g. "kg", "quintal" or "/kg". */
  unit?: string;
  /** A symbol shown inside the input before the text, e.g. "₹". */
  prefix?: string;
  /**
   * What the keyboard's enter key does: "next" (default) moves to the next field and keeps the
   * keyboard open; "done" closes it. Use "done" on the last field of a step.
   */
  returnKeyType?: "next" | "done";
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
        {prefix ? (
          <ThemedText
            style={styles.prefix}
            themeColor="textSecondary"
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {prefix}
          </ThemedText>
        ) : null}
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={keyboardType}
          {...enterKeyProps(returnKeyType)}
          style={[styles.input, prefix ? styles.inputAfterPrefix : null, { color: theme.text }]}
          accessibilityLabel={unitAccessibilityLabel(label, unit)}
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

/** Reads "/kg" as "per kg" and "kg" as "in kg" for screen readers. */
function unitAccessibilityLabel(label: string, unit?: string) {
  if (!unit) return label;
  return unit.startsWith("/") ? `${label}, per ${unit.slice(1)}` : `${label}, in ${unit}`;
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
  prefix: {
    alignSelf: "center",
    paddingLeft: Space.three,
    fontFamily: Fonts.sans,
    fontSize: 17,
  },
  input: {
    flex: 1,
    paddingHorizontal: Space.three,
    fontFamily: Fonts.sans,
    fontSize: 17,
  },
  inputAfterPrefix: { paddingLeft: Space.one },
});
