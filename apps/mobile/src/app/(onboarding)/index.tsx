import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AddressFields,
  emptyAddress,
  trimAddress,
  validateAddress,
} from "@/components/address-fields";
import {
  formatPhone,
  onlyAcres,
  onlyDigits,
  useSaveFarmDetails,
  validateFarmDetails,
  type FarmDetailsValues,
  type FarmField,
} from "@/components/farm-details-form";
import { FormError, hasErrors, useScrollToField, type FieldErrors } from "@/components/form-errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { StepProgress } from "@/components/ui/step-progress";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { createAddress, type AddressInput } from "@/lib/farmbridge-api";
import { posthog } from "@/lib/posthog";
import { actionErrorMessage, addressesQuery, loadState, queryKeys } from "@/lib/queries";

type OnboardingField = FarmField | "addressLabel" | "addressText";
type Step = 0 | 1 | 2;

const STEP_TITLES = ["What's your name?", "Where is your farm?", "Your cocoa farm."] as const;
/** Which fields each step asks for, so Next checks only those. */
const STEP_FIELDS: readonly (readonly OnboardingField[])[] = [
  ["aadhaarName"],
  ["village", "mandal", "addressLabel", "addressText"],
  ["farmSizeAcres", "cocoaTreeCount"],
];

function errorsForStep(errors: FieldErrors<OnboardingField>, step: number) {
  const picked: FieldErrors<OnboardingField> = {};
  for (const key of STEP_FIELDS[step] ?? []) {
    if (errors[key]) picked[key] = errors[key];
  }
  return picked;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const { fieldRef, scrollToFirst } = useScrollToField(scrollRef);
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)?.phoneNumber;

  const [step, setStep] = useState<Step>(0);
  const [values, setValues] = useState<FarmDetailsValues>({
    aadhaarName: "",
    village: "",
    mandal: "",
    farmSizeAcres: "",
    cocoaTreeCount: "",
  });
  const [address, setAddress] = useState<AddressInput>(emptyAddress);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<OnboardingField>>({});
  // A failed save; field problems are shown under each field instead.
  const [error, setError] = useState<string | null>(null);

  // A farmer who left onboarding after saving an address already has one; don't ask again.
  const addressResult = useQuery(addressesQuery);
  const savedAddresses = addressResult.data?.addresses ?? [];
  const savedAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;
  const { loading: addressesLoading } = loadState(addressResult);
  const needsAddress = !savedAddress;

  const addressMutation = useMutation({
    mutationFn: createAddress,
    // Saved before the profile, so the farmer's first quote already has its pickup address.
    onSuccess: ({ address: created }) => {
      queryClient.setQueryData(addressesQuery.queryKey, (current) => ({
        addresses: [...(current?.addresses ?? []), created],
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
  const profileMutation = useSaveFarmDetails();
  const saving = addressMutation.isPending || profileMutation.isPending;

  /** Moves to a step, starting at its top rather than where the last one was scrolled. */
  function showStep(target: Step) {
    setError(null);
    setStep(target);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // Android's back button steps back instead of closing the app mid-way through.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 0) return false;
      if (!saving) {
        setError(null);
        setStep((step - 1) as Step);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
      return true;
    });
    return () => subscription.remove();
  }, [step, saving]);

  function setValue(field: FarmField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): FieldErrors<OnboardingField> {
    const errors: FieldErrors<OnboardingField> = validateFarmDetails(values);
    if (needsAddress) {
      const addressErrors = validateAddress(address);
      errors.addressLabel = addressErrors.label;
      errors.addressText = addressErrors.address;
    }
    return errors;
  }

  async function finish() {
    const problems = validate();
    // Earlier steps were checked on Next, but check everything once more before saving.
    const badStep = STEP_FIELDS.findIndex((_, index) => hasErrors(errorsForStep(problems, index)));
    if (badStep !== -1) {
      const stepProblems = errorsForStep(problems, badStep);
      setFieldErrors(stepProblems);
      setStep(badStep as Step);
      scrollToFirst(stepProblems);
      return;
    }

    try {
      if (needsAddress) await addressMutation.mutateAsync(trimAddress(address));
      // Saving the profile marks onboarding done, and the app opens on Home.
      await profileMutation.mutateAsync(values);
      posthog?.capture("onboarding_completed", { farm_size_acres: Number(values.farmSizeAcres) });
    } catch (saveError) {
      setError(actionErrorMessage(saveError, "Could not save your details. Try again."));
    }
  }

  function next() {
    setError(null);
    const problems = errorsForStep(validate(), step);
    setFieldErrors(problems);
    if (hasErrors(problems)) {
      scrollToFirst(problems);
      return;
    }
    if (step === 2) {
      void finish();
      return;
    }
    showStep((step + 1) as Step);
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Space.four,
              paddingBottom: insets.bottom + Space.six,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.brandBar}>
              {step > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => showStep((step - 1) as Step)}
                  disabled={saving}
                  hitSlop={8}
                >
                  <ThemedText type="smallBold">← Back</ThemedText>
                </Pressable>
              ) : (
                <ThemedText type="smallBold" style={styles.wordmark}>
                  FARMBRIDGE
                </ThemedText>
              )}
              <ThemedText type="label" themeColor="textSecondary">
                ANDHRA PRADESH
              </ThemedText>
            </View>

            <View style={styles.intro}>
              <StepProgress step={step} total={3} />
              <ThemedText type="title">{STEP_TITLES[step]}</ThemedText>
              {step === 0 ? (
                <ThemedText themeColor="textSecondary">
                  Welcome to FarmBridge. Three quick questions and you can start selling your cocoa.
                </ThemedText>
              ) : null}
            </View>

            {/* Keyed by step so each step fades in instead of swapping abruptly. */}
            <Animated.View key={step} entering={FadeIn.duration(180)}>
              <Card style={styles.card}>
                {step === 0 ? (
                  <>
                    <InputField
                      label="NAME (AS ON AADHAAR CARD)"
                      value={values.aadhaarName}
                      onChangeText={(text) => setValue("aadhaarName", text)}
                      placeholder="e.g. Kollu Venkata Rao"
                      hint="Write it exactly as it appears on your Aadhaar card."
                      error={fieldErrors.aadhaarName}
                      fieldRef={fieldRef("aadhaarName")}
                      inputProps={{
                        autoCapitalize: "words",
                        autoComplete: "name",
                        textContentType: "name",
                        maxLength: 100,
                      }}
                    />
                    <View style={[styles.phoneRow, { borderColor: theme.border }]}>
                      <View style={styles.phoneText}>
                        <ThemedText type="label" themeColor="textSecondary">
                          YOUR PHONE
                        </ThemedText>
                        <ThemedText type="smallBold">{formatPhone(phoneNumber)}</ThemedText>
                      </View>
                      <ThemedText type="label" style={{ color: theme.accent }}>
                        ✓ VERIFIED
                      </ThemedText>
                    </View>
                  </>
                ) : step === 1 ? (
                  <>
                    <InputField
                      label="VILLAGE"
                      value={values.village}
                      onChangeText={(text) => setValue("village", text)}
                      placeholder="Village name"
                      error={fieldErrors.village}
                      fieldRef={fieldRef("village")}
                      inputProps={{ autoCapitalize: "words", maxLength: 80 }}
                    />
                    <InputField
                      label="MANDAL"
                      value={values.mandal}
                      onChangeText={(text) => setValue("mandal", text)}
                      placeholder="Mandal name"
                      error={fieldErrors.mandal}
                      fieldRef={fieldRef("mandal")}
                      inputProps={{ autoCapitalize: "words", maxLength: 80 }}
                    />
                    <View style={[styles.addressSection, { borderTopColor: theme.border }]}>
                      <ThemedText type="smallBold">Pickup address</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Where our driver collects your cocoa. You can change it or add more addresses later in Profile.
                      </ThemedText>
                      {addressesLoading ? (
                        <ActivityIndicator />
                      ) : savedAddress ? (
                        <View style={[styles.savedAddress, { borderColor: theme.border }]}>
                          <ThemedText type="smallBold">{savedAddress.label}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {savedAddress.address}
                          </ThemedText>
                        </View>
                      ) : (
                        <View
                          // The scroll target for a problem in the address's name or text.
                          ref={(node) => {
                            fieldRef("addressLabel")(node);
                            fieldRef("addressText")(node);
                          }}
                        >
                          <AddressFields
                            value={address}
                            onChange={(value, changed) => {
                              setAddress(value);
                              const key = changed === "label" ? "addressLabel" : "addressText";
                              setFieldErrors((current) => ({ ...current, [key]: undefined }));
                            }}
                            errors={{ label: fieldErrors.addressLabel, address: fieldErrors.addressText }}
                          />
                        </View>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <InputField
                      label="COCOA FARM SIZE (ACRES)"
                      value={values.farmSizeAcres}
                      onChangeText={(text) => setValue("farmSizeAcres", onlyAcres(text))}
                      placeholder="e.g. 2.5"
                      hint="Only the land with cocoa trees."
                      keyboardType="decimal-pad"
                      error={fieldErrors.farmSizeAcres}
                      fieldRef={fieldRef("farmSizeAcres")}
                      inputProps={{ maxLength: 9 }}
                    />
                    <InputField
                      label="NUMBER OF COCOA TREES"
                      value={values.cocoaTreeCount}
                      onChangeText={(text) => setValue("cocoaTreeCount", onlyDigits(text))}
                      placeholder="e.g. 450"
                      hint="A rough count is fine."
                      keyboardType="number-pad"
                      error={fieldErrors.cocoaTreeCount}
                      fieldRef={fieldRef("cocoaTreeCount")}
                      inputProps={{ maxLength: 8 }}
                    />
                  </>
                )}
              </Card>
            </Animated.View>

            <View style={styles.actions}>
              <FormError message={error} />
              <View style={styles.actionRow}>
                {step > 0 ? (
                  <Button
                    label="←  Back"
                    variant="outline"
                    style={styles.backAction}
                    disabled={saving}
                    onPress={() => showStep((step - 1) as Step)}
                  />
                ) : null}
                <Button
                  label={step === 2 ? "Start selling  →" : "Next  →"}
                  style={styles.nextAction}
                  onPress={next}
                  loading={saving}
                  disabled={step === 1 && addressesLoading}
                />
              </View>
              {step === 0 ? (
                <Pressable onPress={() => authClient.signOut()} style={styles.signOut}>
                  <ThemedText type="label" themeColor="textSecondary">
                    WRONG NUMBER? SIGN OUT
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Space.page,
  },
  content: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    gap: Space.five,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 24,
  },
  wordmark: { letterSpacing: 2 },
  intro: { gap: Space.two },
  card: { gap: Space.four, padding: Space.four },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.three,
    paddingTop: Space.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  phoneText: { gap: Space.half },
  addressSection: {
    gap: Space.two,
    paddingTop: Space.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedAddress: { gap: Space.half, padding: Space.three, borderWidth: 1, borderRadius: 8 },
  actions: { gap: Space.three },
  actionRow: { flexDirection: "row", gap: Space.three },
  backAction: { flex: 1 },
  nextAction: { flex: 2 },
  signOut: { alignSelf: "center", paddingVertical: Space.two },
});
