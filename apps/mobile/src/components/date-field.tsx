import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { FieldError } from "@/components/form-errors";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Space } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";
import { formatDateForIndia } from "@/lib/farmbridge-api";

/** `YYYY-MM-DD` as a local Date at midnight, which is what the picker works in. */
function isoToLocalDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The picked Date's local calendar day as `YYYY-MM-DD`. */
function localDateToIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A field that opens the phone's own calendar instead of asking for typed dates.
 * Android shows the Material date dialog; iOS opens a calendar under the field.
 * Values are ISO `YYYY-MM-DD` ("" when nothing is chosen) and shown as DD-MM-YYYY.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  placeholder = "Choose a date",
  error,
  fieldRef,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  /** ISO `YYYY-MM-DD`; earlier days can't be picked. */
  minimumDate?: string;
  placeholder?: string;
  error?: string;
  fieldRef?: (node: View | null) => void;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);

  const minimum = minimumDate ? isoToLocalDate(minimumDate) : undefined;
  // The picker needs a date to start from: the chosen one, else the earliest allowed, else today.
  const pickerValue = value ? isoToLocalDate(value) : minimum ?? new Date();

  function choose(date: Date) {
    setOpen(false);
    onChange(localDateToIso(date));
  }

  return (
    <View ref={fieldRef} style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDateForIndia(value) : "not chosen"}`}
        accessibilityHint="Opens a calendar"
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : open ? theme.text : theme.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText
          style={styles.value}
          themeColor={value ? "text" : "textSecondary"}
        >
          {value ? formatDateForIndia(value) : placeholder}
        </ThemedText>
        <Icon name="calendar" size={20} color={theme.textSecondary} />
      </Pressable>

      {open && Platform.OS === "android" ? (
        // Opens as a dialog when mounted; unmounting on choose or cancel closes it.
        <DateTimePicker
          value={pickerValue}
          mode="date"
          presentation="dialog"
          minimumDate={minimum}
          accentColor={theme.accent}
          positiveButton={{ label: "Choose" }}
          negativeButton={{ label: "Cancel" }}
          onValueChange={(_event, date) => choose(date)}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {open && Platform.OS !== "android" ? (
        // An inline calendar under the field; tapping a day picks it and closes the calendar.
        <View style={[styles.calendar, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="inline"
            minimumDate={minimum}
            accentColor={theme.accent}
            themeVariant={scheme === "dark" ? "dark" : "light"}
            onValueChange={(_event, date) => choose(date)}
          />
        </View>
      ) : null}

      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Space.two },
  input: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
    paddingHorizontal: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  value: { fontSize: 17 },
  pressed: { opacity: 0.7 },
  calendar: {
    borderWidth: 1,
    borderRadius: Radius.control,
    padding: Space.two,
  },
});
