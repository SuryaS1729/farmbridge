import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AddressFields,
  emptyAddress,
  trimAddress,
  validateAddress,
} from "@/components/address-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Space } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTheme } from "@/hooks/use-theme";
import {
  actionErrorMessage,
  addressesQuery,
  loadState,
  profileQuery,
  queryKeys,
} from "@/lib/queries";
import { authClient } from "@/lib/auth-client";
import { posthog } from "@/lib/posthog";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
  type FarmerAddress,
} from "@/lib/farmbridge-api";

const MAX_ADDRESSES = 10;

/** Which address form is open: a new one, an existing one, or none. */
type Editing = { id: "new" | string; value: AddressInput } | null;

function formatPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function trimDecimal(value: string | null) {
  if (!value) return "—";
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const phoneNumber = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);

  // Shared with Quote, My Quotes and Farm details: an edit in one shows up everywhere.
  const addressResult = useQuery(addressesQuery);
  const profileResult = useQuery(profileQuery);
  useRefreshOnFocus(queryKeys.addresses, queryKeys.profile);
  const addresses = addressResult.data?.addresses ?? [];
  const profile = profileResult.data?.profile ?? null;
  const addressLoad = loadState(addressResult);
  const profileLoad = loadState(profileResult);
  const loading = addressLoad.loading || profileLoad.loading;
  const loadError = addressLoad.error ?? profileLoad.error;

  function reload() {
    void addressResult.refetch();
    void profileResult.refetch();
  }

  // One mutation for every address action (add, edit, make default, delete):
  // they all change the same list, and only one runs at a time. `id` drives
  // which row shows "Saving…".
  const addressMutation = useMutation({
    mutationFn: ({ action }: { id: string; action: () => Promise<unknown> }) => action(),
    // Returning the promise keeps the mutation pending until the list has refetched,
    // so the busy state never clears onto an out-of-date list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
  const busyId = addressMutation.isPending ? addressMutation.variables.id : null;

  async function run(id: string, action: () => Promise<unknown>) {
    setError(null);
    try {
      await addressMutation.mutateAsync({ id, action });
      return true;
    } catch (err) {
      setError(actionErrorMessage(err, "Something went wrong. Try again."));
      return false;
    }
  }

  async function saveEditing() {
    if (!editing) return;
    const problem = validateAddress(editing.value);
    if (problem) {
      setError(problem);
      return;
    }
    const input = trimAddress(editing.value);
    const ok = await run(editing.id, () =>
      editing.id === "new" ? createAddress(input) : updateAddress(editing.id, input),
    );
    if (ok) setEditing(null);
  }

  function confirmDelete(address: FarmerAddress) {
    Alert.alert(
      `Delete "${address.label}"?`,
      "Quotes and deals you already sent keep their address.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void run(address.id, () => deleteAddress(address.id)),
        },
      ],
    );
  }

  const addressForm = editing ? (
    <View style={styles.formBox}>
      <AddressFields
        value={editing.value}
        onChange={(value) => setEditing({ ...editing, value })}
        disabled={busyId !== null}
      />
      <View style={styles.formActions}>
        <Button
          label="Cancel"
          variant="outline"
          style={styles.flex}
          disabled={busyId !== null}
          onPress={() => {
            setEditing(null);
            setError(null);
          }}
        />
        <Button
          label="Save address"
          style={styles.flex}
          loading={busyId === editing.id}
          onPress={() => void saveEditing()}
        />
      </View>
    </View>
  ) : null;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Space.four,
            paddingBottom: insets.bottom + BottomTabInset + Space.four,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBar}>
          <ThemedText type="smallBold" style={styles.wordmark}>
            FARMBRIDGE
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            SETTINGS
          </ThemedText>
        </View>

        <ThemedText type="title">Settings</ThemedText>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator />
          </View>
        ) : loadError ? (
          <Card style={styles.card}>
            <ThemedText themeColor="textSecondary">{loadError}</ThemedText>
            <Button label="Try again" variant="outline" onPress={reload} />
          </Card>
        ) : (
          <>
            {/* Pickup addresses */}
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <ThemedText type="label" themeColor="textSecondary">
                  PICKUP ADDRESSES
                </ThemedText>
                <ThemedText type="label" themeColor="textSecondary">
                  {addresses.length} / {MAX_ADDRESSES}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Choose one of these when you send a quote. The driver collects from that address.
              </ThemedText>

              {addresses.length === 0 && editing?.id !== "new" ? (
                <Card style={styles.card}>
                  <ThemedText themeColor="textSecondary">
                    No saved addresses yet. Add one here, or type one on your next quote and we'll save it.
                  </ThemedText>
                </Card>
              ) : null}

              {addresses.map((address) => (
                <Card key={address.id} style={styles.card}>
                  {editing?.id === address.id ? (
                    addressForm
                  ) : (
                    <>
                      <View style={styles.sectionHeading}>
                        <ThemedText type="smallBold">{address.label}</ThemedText>
                        {address.isDefault ? (
                          <ThemedText type="label" themeColor="textSecondary">
                            DEFAULT
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText>{address.address}</ThemedText>
                      <View style={[styles.actions, { borderTopColor: theme.border }]}>
                        <TextAction
                          label="Edit"
                          disabled={busyId !== null || editing !== null}
                          onPress={() => {
                            setError(null);
                            setEditing({
                              id: address.id,
                              value: { label: address.label, address: address.address },
                            });
                          }}
                        />
                        {!address.isDefault ? (
                          <TextAction
                            label={busyId === address.id ? "Saving…" : "Make default"}
                            disabled={busyId !== null || editing !== null}
                            onPress={() => void run(address.id, () => setDefaultAddress(address.id))}
                          />
                        ) : null}
                        <TextAction
                          label="Delete"
                          disabled={busyId !== null || editing !== null}
                          onPress={() => confirmDelete(address)}
                        />
                      </View>
                    </>
                  )}
                </Card>
              ))}

              {editing?.id === "new" ? (
                <Card style={styles.card}>{addressForm}</Card>
              ) : addresses.length < MAX_ADDRESSES ? (
                <Button
                  label="+ Add address"
                  variant="outline"
                  disabled={editing !== null || busyId !== null}
                  onPress={() => {
                    setError(null);
                    setEditing({
                      id: "new",
                      value: addresses.length === 0 ? emptyAddress : { label: "", address: "" },
                    });
                  }}
                />
              ) : null}

              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
            </View>

            {/* Farm details */}
            <View style={styles.section}>
              <ThemedText type="label" themeColor="textSecondary">
                FARM DETAILS
              </ThemedText>
              <Card style={styles.card}>
                <Row label="Name (as on Aadhaar)" value={profile?.aadhaarName ?? "—"} />
                <Row label="Village" value={profile?.village ?? "—"} />
                <Row label="Mandal" value={profile?.mandal ?? "—"} />
                <Row label="Cocoa farm size" value={`${trimDecimal(profile?.farmSizeAcres ?? null)} acres`} />
                <Row
                  label="Total cocoa trees"
                  value={profile?.cocoaTreeCount ? profile.cocoaTreeCount.toLocaleString("en-IN") : "—"}
                />
                <Button
                  label="Edit farm details"
                  variant="outline"
                  onPress={() => router.push("/farm-details")}
                />
              </Card>
            </View>

            {/* Account */}
            <View style={styles.section}>
              <ThemedText type="label" themeColor="textSecondary">
                ACCOUNT
              </ThemedText>
              <Card style={styles.card}>
                <Row label="Mobile number" value={formatPhone(phoneNumber)} />
                <Button
                  label="Sign out"
                  variant="outline"
                  onPress={() =>
                    Alert.alert("Sign out?", "You'll need an SMS code to sign in again.", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Sign out", style: "destructive", onPress: () => {
                        // Forget this farmer in analytics so the next person on a shared phone isn't linked to them.
                        posthog?.reset();
                        void authClient.signOut();
                      } },
                    ])
                  }
                />
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function TextAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.textAction, disabled && styles.disabled]}
    >
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: Space.six,
    paddingHorizontal: Space.page,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: { letterSpacing: 2 },
  state: { minHeight: 160, alignItems: "center", justifyContent: "center" },
  section: { gap: Space.three },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
  },
  card: { gap: Space.three },
  actions: {
    flexDirection: "row",
    gap: Space.five,
    paddingTop: Space.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textAction: { paddingVertical: Space.one },
  disabled: { opacity: 0.4 },
  formBox: { gap: Space.four },
  formActions: { flexDirection: "row", gap: Space.three },
  flex: { flex: 1 },
  row: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowValue: { flexShrink: 1, textAlign: "right" },
  error: { color: "#9A4237" },
});
