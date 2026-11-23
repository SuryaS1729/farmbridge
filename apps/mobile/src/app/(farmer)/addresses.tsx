import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  type AddressFieldErrors,
} from "@/components/address-fields";
import { FormError, hasErrors } from "@/components/form-errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTheme } from "@/hooks/use-theme";
import { actionErrorMessage, addressesQuery, loadState, queryKeys } from "@/lib/queries";
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

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  // A failed save, default or delete; field problems are shown under each field instead.
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({});

  // Shared with Profile, Quote and My Quotes: an edit here shows up everywhere.
  const addressResult = useQuery(addressesQuery);
  useRefreshOnFocus(queryKeys.addresses);
  const addresses = addressResult.data?.addresses ?? [];
  const { loading, error: loadError } = loadState(addressResult);

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
  const locked = busyId !== null || editing !== null;

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
    const problems = validateAddress(editing.value);
    setFieldErrors(problems);
    if (hasErrors(problems)) return;
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
        onChange={(value, changed) => {
          setEditing({ ...editing, value });
          setFieldErrors((current) => ({ ...current, [changed]: undefined }));
        }}
        disabled={busyId !== null}
        errors={fieldErrors}
      />
      <FormError message={error} />
      <View style={styles.formActions}>
        <Button
          label="Cancel"
          variant="outline"
          style={styles.flex}
          disabled={busyId !== null}
          onPress={() => {
            setEditing(null);
            setError(null);
            setFieldErrors({});
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
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Space.four,
              paddingBottom: insets.bottom + Space.seven,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topline}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ThemedText type="smallBold">← Profile</ThemedText>
            </Pressable>
            <ThemedText type="label" themeColor="textSecondary">
              {addresses.length} / {MAX_ADDRESSES}
            </ThemedText>
          </View>

          <View style={styles.intro}>
            <ThemedText type="title">Addresses</ThemedText>
            <ThemedText themeColor="textSecondary">
              Choose one of these when you send a quote. The driver collects from that address.
            </ThemedText>
          </View>

          {loading ? (
            <ActivityIndicator />
          ) : loadError ? (
            <Card style={styles.formBox}>
              <ThemedText themeColor="textSecondary">{loadError}</ThemedText>
              <Button
                label="Try again"
                variant="outline"
                onPress={() => void addressResult.refetch()}
              />
            </Card>
          ) : (
            <View style={styles.section}>
              <ThemedText type="label" themeColor="textSecondary">
                SAVED ADDRESSES
              </ThemedText>

              {addresses.length === 0 && editing?.id !== "new" ? (
                <Card>
                  <ThemedText themeColor="textSecondary">
                    No saved addresses yet. Add one here, or type one on your next quote and we'll
                    save it.
                  </ThemedText>
                </Card>
              ) : null}

              {addresses.length > 0 ? (
                <Card style={styles.list}>
                  {addresses.map((address, index) => (
                    <Fragment key={address.id}>
                      {index > 0 ? (
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      ) : null}
                      {editing?.id === address.id ? (
                        <View style={styles.rowPadding}>{addressForm}</View>
                      ) : (
                        <View style={[styles.addressRow, styles.rowPadding]}>
                          <View style={styles.rowIcon}>
                            <Icon name="home" size={22} color={theme.text} />
                          </View>
                          <View style={styles.rowBody}>
                            <View style={styles.rowTitle}>
                              <ThemedText type="smallBold">{address.label}</ThemedText>
                              {address.isDefault ? (
                                <View
                                  style={[styles.badge, { backgroundColor: theme.accentSoft }]}
                                >
                                  <ThemedText type="label" themeColor="text">
                                    DEFAULT
                                  </ThemedText>
                                </View>
                              ) : null}
                            </View>
                            <ThemedText type="small" themeColor="textSecondary">
                              {address.address}
                            </ThemedText>
                            <View style={styles.actions}>
                              <TextAction
                                label="EDIT"
                                disabled={locked}
                                onPress={() => {
                                  setError(null);
                                  setFieldErrors({});
                                  setEditing({
                                    id: address.id,
                                    value: { label: address.label, address: address.address },
                                  });
                                }}
                              />
                              {!address.isDefault ? (
                                <TextAction
                                  label={busyId === address.id ? "SAVING…" : "MAKE DEFAULT"}
                                  disabled={locked}
                                  onPress={() =>
                                    void run(address.id, () => setDefaultAddress(address.id))
                                  }
                                />
                              ) : null}
                              <TextAction
                                label="DELETE"
                                disabled={locked}
                                onPress={() => confirmDelete(address)}
                              />
                            </View>
                          </View>
                        </View>
                      )}
                    </Fragment>
                  ))}
                </Card>
              ) : null}

              {editing?.id === "new" ? (
                <Card>{addressForm}</Card>
              ) : addresses.length < MAX_ADDRESSES ? (
                <Button
                  label="+ Add new address"
                  variant="outline"
                  disabled={locked}
                  onPress={() => {
                    setError(null);
                    setFieldErrors({});
                    setEditing({
                      id: "new",
                      value: addresses.length === 0 ? emptyAddress : { label: "", address: "" },
                    });
                  }}
                />
              ) : null}

              {/* While a form is open its own errors show above its buttons. */}
              {editing ? null : <FormError message={error} />}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
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
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.textAction, disabled && styles.disabled]}
    >
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {label}
      </ThemedText>
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
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { paddingVertical: Space.two, paddingRight: Space.four },
  intro: { gap: Space.two },
  section: { gap: Space.three },
  list: { padding: 0 },
  rowPadding: { padding: Space.four },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Space.four + 22 + Space.three },
  addressRow: { flexDirection: "row", gap: Space.three },
  rowIcon: { paddingTop: 1 },
  rowBody: { flex: 1, gap: Space.one },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: Space.two },
  badge: { paddingHorizontal: Space.two, paddingVertical: 2, borderRadius: 3 },
  actions: { flexDirection: "row", gap: Space.five, paddingTop: Space.two },
  textAction: { paddingVertical: Space.one },
  disabled: { opacity: 0.4 },
  formBox: { gap: Space.four },
  formActions: { flexDirection: "row", gap: Space.three },
  flex: { flex: 1 },
});
