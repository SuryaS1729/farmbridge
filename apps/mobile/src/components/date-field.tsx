import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View, type HostInstance } from "react-native";

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
  fieldRef?: (node: HostInstance | null) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  function choose(iso: string) {
    setOpen(false);
    onChange(iso);
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

      <DatePicker
        open={open}
        value={value}
        minimumDate={minimumDate}
        onChoose={choose}
        onClose={() => setOpen(false)}
      />

      <FieldError message={error} />
    </View>
  );
}

/**
 * The phone's own date picker, shown while `open`: Android's Material dialog, or on iOS a
 * calendar where this is placed. Picking a day calls onChoose (ISO `YYYY-MM-DD`); the parent
 * closes it. Android's Cancel calls onClose.
 */
export function DatePicker({
  open,
  value,
  minimumDate,
  onChoose,
  onClose,
}: {
  open: boolean;
  /** ISO `YYYY-MM-DD`, or "" for none yet. */
  value: string;
  /** ISO `YYYY-MM-DD`; earlier days can't be picked. */
  minimumDate?: string;
  onChoose: (iso: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  if (!open) return null;

  const minimum = minimumDate ? isoToLocalDate(minimumDate) : undefined;
  // The picker needs a date to start from: the chosen one, else the earliest allowed, else today.
  const pickerValue = value ? isoToLocalDate(value) : minimum ?? new Date();

  if (Platform.OS === "android") {
    // Opens as a dialog when mounted; unmounting on choose or cancel closes it.
    return (
      <DateTimePicker
        value={pickerValue}
        mode="date"
        presentation="dialog"
        minimumDate={minimum}
        accentColor={theme.accent}
        positiveButton={{ label: "Choose" }}
        negativeButton={{ label: "Cancel" }}
        onValueChange={(_event, date) => onChoose(localDateToIso(date))}
        onDismiss={onClose}
      />
    );
  }

  // An inline calendar; tapping a day picks it and the parent closes the calendar.
  return (
    <View style={[styles.calendar, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <DateTimePicker
        value={pickerValue}
        mode="date"
        display="inline"
        minimumDate={minimum}
        accentColor={theme.accent}
        themeVariant={scheme === "dark" ? "dark" : "light"}
        onValueChange={(_event, date) => onChoose(localDateToIso(date))}
      />
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
