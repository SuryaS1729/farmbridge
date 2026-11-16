import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { saveFarmerProfile } from "@/lib/farmbridge-api";
import { useOnboarding } from "@/lib/onboarding";

const ACRES_PATTERN = /^\d{1,6}(?:\.\d{1,2})?$/;

function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export default function FarmDetailsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { markOnboarded } = useOnboarding();
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;

  const [aadhaarName, setAadhaarName] = useState("");
  const [village, setVillage] = useState("");
  const [mandal, setMandal] = useState("");
  const [farmSizeAcres, setFarmSizeAcres] = useState("");
  const [cocoaTreeCount, setCocoaTreeCount] = useState("");
  const [saving, setSaving] = useState(false);
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
    setSaving(true);

    try {
      await saveFarmerProfile({
        aadhaarName: aadhaarName.trim(),
        village: village.trim(),
        mandal: mandal.trim(),
        farmSizeAcres,
        cocoaTreeCount: Number(cocoaTreeCount),
      });
      markOnboarded();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your details. Try again.",
      );
    } finally {
      setSaving(false);
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
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Space.four,
              paddingBottom: insets.bottom + Space.four,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.brandBar}>
              <ThemedText type="smallBold" style={styles.wordmark}>
                FARMBRIDGE
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                ANDHRA PRADESH
              </ThemedText>
            </View>

            <View style={styles.intro}>
              <ThemedText type="label" themeColor="textSecondary">
                NEW FARMER · FARM DETAILS
              </ThemedText>
              <ThemedText type="title">Tell us about your cocoa farm.</ThemedText>
              <ThemedText themeColor="textSecondary">
                We need these once before you can sell. Write your name exactly
                as it appears on your Aadhaar card.
              </ThemedText>
            </View>

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
                <View
                  style={[
                    styles.input,
                    styles.readOnly,
                    { borderColor: theme.border },
                  ]}
                >
                  <ThemedText style={styles.readOnlyText}>
                    {formatPhone(phoneNumber)}
                  </ThemedText>
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
                      onChangeText={(text) =>
                        setFarmSizeAcres(text.replace(/[^\d.]/g, ""))
                      }
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
                      onChangeText={(text) =>
                        setCocoaTreeCount(text.replace(/\D/g, ""))
                      }
                      placeholder="450"
                      keyboardType="number-pad"
                      maxLength={8}
                    />
                  </Field>
                </View>
              </View>

              <Button
                label="Save and continue  →"
                onPress={submit}
                loading={saving}
              />

              {error ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={() => authClient.signOut()}
                disabled={saving}
                style={styles.signOut}
              >
                <ThemedText type="label" themeColor="textSecondary">
                  WRONG NUMBER? SIGN OUT
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
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
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Space.page,
  },
  content: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    gap: Space.six,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    letterSpacing: 2,
  },
  intro: {
    gap: Space.two,
  },
  form: {
    gap: Space.four,
  },
  field: {
    gap: Space.two,
  },
  row: {
    flexDirection: "row",
    gap: Space.three,
  },
  rowItem: {
    flex: 1,
  },
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
  readOnlyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  signOut: {
    alignSelf: "center",
    paddingVertical: Space.two,
  },
});
