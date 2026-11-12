import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { OtpInput } from "react-native-otp-entry";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";

const OTP_LENGTH = 6;
const PHONE_LENGTH = 10;

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullPhoneNumber = `+91${phoneDigits}`;

  async function sendCode() {
    if (phoneDigits.length !== PHONE_LENGTH) {
      setError(`Enter your ${PHONE_LENGTH}-digit mobile number.`);
      return;
    }

    setError(null);
    setSending(true);

    try {
      const { error: sendError } = await authClient.phoneNumber.sendOtp({
        phoneNumber: fullPhoneNumber,
      });

      if (sendError) {
        setError(sendError.message ?? "Could not send the code.");
        return;
      }

      setCode("");
      setOtpSent(true);
    } catch {
      setError(
        "Could not reach Farmbridge. Check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    setError(null);
    setVerifying(true);

    try {
      const { error: verifyError } = await authClient.phoneNumber.verify({
        phoneNumber: fullPhoneNumber,
        code,
      });

      if (verifyError) {
        setError(verifyError.message ?? "Could not verify the code.");
        return;
      }

      setCode("");
      setOtpSent(false);
    } catch {
      setError(
        "Could not reach Farmbridge. Check your connection and try again.",
      );
    } finally {
      setVerifying(false);
    }
  }

  function changeNumber() {
    setOtpSent(false);
    setCode("");
    setError(null);
  }

  return (
    <ThemedView style={styles.screen}>
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
              {otpSent
                ? "PHONE SIGN-IN · STEP 2 OF 2"
                : "PHONE SIGN-IN · COCOA"}
            </ThemedText>
            <ThemedText type="title">
              {otpSent
                ? "Enter the code we just texted."
                : "Sign in to sell your cocoa."}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {otpSent
                ? `Sent to +91 ${phoneDigits}. Six digits, valid for five minutes.`
                : "No password. We text a six-digit code. Farmers and the buying team use the same sign-in."}
            </ThemedText>
          </View>

          {otpSent ? (
            <View style={styles.form}>
              <View style={styles.labelRow}>
                <ThemedText type="label" themeColor="textSecondary">
                  SIX-DIGIT CODE
                </ThemedText>
                <ThemedText type="label" themeColor="textSecondary">
                  SMS · 5 MIN
                </ThemedText>
              </View>

              <OtpInput
                numberOfDigits={OTP_LENGTH}
                type="numeric"
                autoFocus
                disabled={verifying}
                onTextChange={setCode}
                focusColor={theme.text}
                theme={{
                  containerStyle: styles.otpContainer,
                  pinCodeContainerStyle: {
                    ...styles.otpCell,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundElement,
                  },
                  focusedPinCodeContainerStyle: { borderColor: theme.text },
                  filledPinCodeContainerStyle: { borderColor: theme.text },
                  pinCodeTextStyle: {
                    color: theme.text,
                    fontFamily: Fonts?.mono,
                    fontSize: 20,
                  },
                  focusStickStyle: { backgroundColor: theme.text },
                }}
              />

              <Button
                label="Verify and continue  →"
                onPress={verifyCode}
                loading={verifying}
                disabled={code.length !== OTP_LENGTH}
              />

              <View style={styles.inlineActions}>
                <Pressable onPress={sendCode} disabled={sending}>
                  <ThemedText type="label" themeColor="textSecondary">
                    {sending ? "SENDING CODE…" : "RESEND CODE"}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={changeNumber} disabled={verifying}>
                  <ThemedText type="label">CHANGE NUMBER</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <ThemedText type="label" themeColor="textSecondary">
                MOBILE NUMBER
              </ThemedText>
              <View
                style={[
                  styles.phoneRow,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText style={styles.phonePrefix}>+91</ThemedText>
                <View
                  style={[
                    styles.phoneDivider,
                    { backgroundColor: theme.border },
                  ]}
                />
                <TextInput
                  style={[styles.phoneInput, { color: theme.text }]}
                  value={phoneDigits}
                  onChangeText={(text) =>
                    setPhoneDigits(
                      text.replace(/\D/g, "").slice(0, PHONE_LENGTH),
                    )
                  }
                  placeholder="98765 43210"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                />
              </View>

              <Button
                label="Send code  →"
                onPress={sendCode}
                loading={sending}
                disabled={phoneDigits.length !== PHONE_LENGTH}
              />
              <ThemedText
                type="label"
                themeColor="textSecondary"
                style={styles.centerText}
              >
                STANDARD SMS RATES APPLY · CODE VALID 5 MIN
              </ThemedText>
            </View>
          )}

          {error ? (
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
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
    gap: Space.three,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  phoneRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  phonePrefix: {
    paddingVertical: Space.three,
    fontSize: 16,
    fontWeight: "600",
  },
  phoneDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: Space.three,
    marginVertical: Space.two,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: Space.three,
    fontFamily: Fonts?.sans,
    fontSize: 18,
    fontWeight: "500",
  },
  otpContainer: {
    gap: Space.two,
  },
  otpCell: {
    width: 44,
    height: 56,
    borderRadius: Radius.control,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  centerText: {
    textAlign: "center",
  },
});
