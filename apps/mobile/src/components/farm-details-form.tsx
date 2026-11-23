import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode, type RefObject } from "react";
import { StyleSheet, TextInput, View, type ScrollView, type TextInputProps } from "react-native";

import {
  FieldError,
  FormError,
  hasErrors,
  useScrollToField,
  type FieldErrors,
} from "@/components/form-errors";
import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/themed-text";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { actionErrorMessage, profileQuery } from "@/lib/queries";
import {
  saveFarmerProfile,
  type FarmerProfile,
} from "@/lib/farmbridge-api";

const ACRES_PATTERN = /^\d{1,6}(?:\.\d{1,2})?$/;

export type FarmField = "aadhaarName" | "village" | "mandal" | "farmSizeAcres" | "cocoaTreeCount";

/** The farm details as typed, before trimming. Shared by onboarding and Profile. */
export type FarmDetailsValues = Record<FarmField, string>;

/** Every problem at once, in on-screen order. Mirrors the API rules. */
export function validateFarmDetails(values: FarmDetailsValues): FieldErrors<FarmField> {
  const errors: FieldErrors<FarmField> = {};
  if (values.aadhaarName.trim().length < 2) errors.aadhaarName = "Enter your name as on Aadhaar.";
  if (values.village.trim().length < 2) errors.village = "Enter your village name.";
  if (values.mandal.trim().length < 2) errors.mandal = "Enter your mandal name.";
  if (!ACRES_PATTERN.test(values.farmSizeAcres) || Number(values.farmSizeAcres) <= 0) {
    errors.farmSizeAcres = "Enter the farm size in acres, for example 2.5.";
  }
  if (!/^\d+$/.test(values.cocoaTreeCount) || Number(values.cocoaTreeCount) <= 0) {
    errors.cocoaTreeCount = "Enter the number of cocoa trees.";
  }
  return errors;
}

/** Saves the profile and writes it to the shared cache, which also opens the app after onboarding. */
export function useSaveFarmDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: FarmDetailsValues) =>
      saveFarmerProfile({
        aadhaarName: values.aadhaarName.trim(),
        village: values.village.trim(),
        mandal: values.mandal.trim(),
        farmSizeAcres: values.farmSizeAcres,
        cocoaTreeCount: Number(values.cocoaTreeCount),
      }),
    // Every screen reading the profile (and the onboarding gate in _layout) updates at once.
    onSuccess: (result) => queryClient.setQueryData(profileQuery.queryKey, result),
  });
}

/** Digits only, so a pasted "2,5" or "450 trees" can't sneak in. */
export const onlyAcres = (text: string) => text.replace(/[^\d.]/g, "");
export const onlyDigits = (text: string) => text.replace(/\D/g, "");

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** "2.50" from the API reads better as "2.5" in an input. */
function trimDecimal(value: string | null | undefined) {
  if (!value) return "";
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function FarmDetailsForm({
  initial,
  phoneNumber,
  submitLabel,
  onSaved,
  scrollRef,
}: {
  initial?: FarmerProfile | null;
  phoneNumber: string | null | undefined;
  submitLabel: string;
  /** Optional: the saved profile is already written to the shared query cache. */
  onSaved?: (profile: FarmerProfile) => void;
  /** The screen's ScrollView, so a failed submit can scroll to the first problem. */
  scrollRef: RefObject<ScrollView | null>;
}) {
  const saveMutation = useSaveFarmDetails();
  const saving = saveMutation.isPending;
  const theme = useTheme();
  const [aadhaarName, setAadhaarName] = useState(initial?.aadhaarName ?? "");
  const [village, setVillage] = useState(initial?.village ?? "");
  const [mandal, setMandal] = useState(initial?.mandal ?? "");
  const [farmSizeAcres, setFarmSizeAcres] = useState(trimDecimal(initial?.farmSizeAcres));
  const [cocoaTreeCount, setCocoaTreeCount] = useState(
    initial?.cocoaTreeCount ? String(initial.cocoaTreeCount) : "",
  );
  // A failed save; field problems are shown under each field instead.
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<FarmField>>({});
  const { fieldRef, scrollToFirst } = useScrollToField(scrollRef);

  const values: FarmDetailsValues = { aadhaarName, village, mandal, farmSizeAcres, cocoaTreeCount };

  /** Updates a field and clears its error, since the farmer is fixing it. */
  function change(field: FarmField, set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  async function submit() {
    const problems = validateFarmDetails(values);
    setFieldErrors(problems);
    setError(null);
    if (hasErrors(problems)) {
      scrollToFirst(problems);
      return;
    }

    try {
      const result = await saveMutation.mutateAsync(values);
      if (result.profile) onSaved?.(result.profile);
    } catch (saveError) {
      setError(actionErrorMessage(saveError, "Could not save your details. Try again."));
    }
  }

  const inputStyle = (field: FarmField) => [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: fieldErrors[field] ? theme.danger : theme.border,
    },
  ];

  const sharedProps: TextInputProps = {
    placeholderTextColor: theme.textSecondary,
    editable: !saving,
  };

  return (
    <View style={styles.form}>
      <Field label="NAME (AS ON AADHAAR CARD)" error={fieldErrors.aadhaarName} fieldRef={fieldRef("aadhaarName")}>
        <TextInput
          {...sharedProps}
          style={inputStyle("aadhaarName")}
          value={aadhaarName}
          onChangeText={change("aadhaarName", setAadhaarName)}
          placeholder="e.g. Kollu Venkata Rao"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={100}
        />
      </Field>

      <Field label="CONTACT NUMBER">
        <View style={[styles.input, styles.readOnly, { borderColor: theme.border }]}>
          <ThemedText style={styles.readOnlyText}>{formatPhone(phoneNumber)}</ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            VERIFIED
          </ThemedText>
        </View>
      </Field>

      <Field label="VILLAGE" error={fieldErrors.village} fieldRef={fieldRef("village")}>
        <TextInput
          {...sharedProps}
          style={inputStyle("village")}
          value={village}
          onChangeText={change("village", setVillage)}
          placeholder="Village name"
          autoCapitalize="words"
          maxLength={80}
        />
      </Field>

      <Field label="MANDAL" error={fieldErrors.mandal} fieldRef={fieldRef("mandal")}>
        <TextInput
          {...sharedProps}
          style={inputStyle("mandal")}
          value={mandal}
          onChangeText={change("mandal", setMandal)}
          placeholder="Mandal name"
          autoCapitalize="words"
          maxLength={80}
        />
      </Field>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Field label="COCOA FARM SIZE (ACRES)" error={fieldErrors.farmSizeAcres} fieldRef={fieldRef("farmSizeAcres")}>
            <TextInput
              {...sharedProps}
              style={inputStyle("farmSizeAcres")}
              value={farmSizeAcres}
              onChangeText={change("farmSizeAcres", (text) => setFarmSizeAcres(onlyAcres(text)))}
              placeholder="2.5"
              keyboardType="decimal-pad"
              maxLength={9}
            />
          </Field>
        </View>
        <View style={styles.rowItem}>
          <Field label="TOTAL COCOA TREES" error={fieldErrors.cocoaTreeCount} fieldRef={fieldRef("cocoaTreeCount")}>
            <TextInput
              {...sharedProps}
              style={inputStyle("cocoaTreeCount")}
              value={cocoaTreeCount}
              onChangeText={change("cocoaTreeCount", (text) => setCocoaTreeCount(onlyDigits(text)))}
              placeholder="450"
              keyboardType="number-pad"
              maxLength={8}
            />
          </Field>
        </View>
      </View>

      <FormError message={error} />
      <Button label={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}

function Field({
  label,
  error,
  fieldRef,
  children,
}: {
  label: string;
  error?: string;
  fieldRef?: (node: View | null) => void;
  children: ReactNode;
}) {
  return (
    <View ref={fieldRef} style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Space.four },
  field: { gap: Space.two },
  row: { flexDirection: "row", gap: Space.three },
  rowItem: { flex: 1 },
  input: {
    minHeight: 52,
    paddingHorizontal: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
    fontFamily: Fonts?.sans,
    fontSize: 16,
  },
  readOnly: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readOnlyText: { fontSize: 16, fontWeight: "500" },
});
