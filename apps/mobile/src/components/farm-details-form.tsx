import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

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

function formatPhone(phone: string | null | undefined) {
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
}: {
  initial?: FarmerProfile | null;
  phoneNumber: string | null | undefined;
  submitLabel: string;
  /** Optional: the saved profile is already written to the shared query cache. */
  onSaved?: (profile: FarmerProfile) => void;
}) {
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: saveFarmerProfile,
    // Every screen reading the profile (and the onboarding gate in _layout) updates at once.
    onSuccess: (result) => queryClient.setQueryData(profileQuery.queryKey, result),
  });
  const saving = saveMutation.isPending;
  const theme = useTheme();
  const [aadhaarName, setAadhaarName] = useState(initial?.aadhaarName ?? "");
  const [village, setVillage] = useState(initial?.village ?? "");
  const [mandal, setMandal] = useState(initial?.mandal ?? "");
  const [farmSizeAcres, setFarmSizeAcres] = useState(trimDecimal(initial?.farmSizeAcres));
  const [cocoaTreeCount, setCocoaTreeCount] = useState(
    initial?.cocoaTreeCount ? String(initial.cocoaTreeCount) : "",
  );
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (aadhaarName.trim().length < 2) return "Enter your name as on Aadhaar.";
    if (village.trim().length < 2) return "Enter your village name.";
    if (mandal.trim().length < 2) return "Enter your mandal name.";
    if (!ACRES_PATTERN.test(farmSizeAcres) || Number(farmSizeAcres) <= 0) {
      return "Enter the cocoa farm size in acres, for example 2.5.";
    }
    if (!/^\d+$/.test(cocoaTreeCount) || Number(cocoaTreeCount) <= 0) {
      return "Enter the total number of cocoa trees.";
    }
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);

    try {
      const result = await saveMutation.mutateAsync({
        aadhaarName: aadhaarName.trim(),
        village: village.trim(),
        mandal: mandal.trim(),
        farmSizeAcres,
        cocoaTreeCount: Number(cocoaTreeCount),
      });
      if (result.profile) onSaved?.(result.profile);
    } catch (saveError) {
      setError(actionErrorMessage(saveError, "Could not save your details. Try again."));
    }
  }

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: theme.border,
    },
  ];

  const sharedProps: TextInputProps = {
    placeholderTextColor: theme.textSecondary,
    editable: !saving,
  };

  return (
    <View style={styles.form}>
      <Field label="NAME (AS ON AADHAAR CARD)">
        <TextInput
          {...sharedProps}
          style={inputStyle}
          value={aadhaarName}
          onChangeText={setAadhaarName}
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

      <Field label="VILLAGE">
        <TextInput
          {...sharedProps}
          style={inputStyle}
          value={village}
          onChangeText={setVillage}
          placeholder="Village name"
          autoCapitalize="words"
          maxLength={80}
        />
      </Field>

      <Field label="MANDAL">
        <TextInput
          {...sharedProps}
          style={inputStyle}
          value={mandal}
          onChangeText={setMandal}
          placeholder="Mandal name"
          autoCapitalize="words"
          maxLength={80}
        />
      </Field>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Field label="COCOA FARM SIZE (ACRES)">
            <TextInput
              {...sharedProps}
              style={inputStyle}
              value={farmSizeAcres}
              onChangeText={(text) => setFarmSizeAcres(text.replace(/[^\d.]/g, ""))}
              placeholder="2.5"
              keyboardType="decimal-pad"
              maxLength={9}
            />
          </Field>
        </View>
        <View style={styles.rowItem}>
          <Field label="TOTAL COCOA TREES">
            <TextInput
              {...sharedProps}
              style={inputStyle}
              value={cocoaTreeCount}
              onChangeText={(text) => setCocoaTreeCount(text.replace(/\D/g, ""))}
              placeholder="450"
              keyboardType="number-pad"
              maxLength={8}
            />
          </Field>
        </View>
      </View>

      <Button label={submitLabel} onPress={submit} loading={saving} />

      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
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
