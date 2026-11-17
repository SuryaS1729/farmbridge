import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { FarmerAddress } from "@/lib/farmbridge-api";

export const NEW_ADDRESS = "new";

/**
 * A radio-style list of saved addresses. Pass `allowNew` to add a
 * "Use a new address" row whose id is NEW_ADDRESS.
 */
export function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  allowNew = false,
  disabled = false,
}: {
  addresses: FarmerAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  allowNew?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();

  const rows = [
    ...addresses.map((address) => ({
      id: address.id,
      title: address.label,
      detail: address.address,
      isDefault: address.isDefault,
    })),
    ...(allowNew
      ? [{ id: NEW_ADDRESS, title: "Use a new address", detail: "We'll save it for your next quote.", isDefault: false }]
      : []),
  ];

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <Pressable
            key={row.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(row.id)}
            style={[
              styles.row,
              {
                borderColor: selected ? theme.text : theme.border,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                { borderColor: selected ? theme.text : theme.border },
              ]}
            >
              {selected ? <View style={[styles.radioDot, { backgroundColor: theme.text }]} /> : null}
            </View>
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <ThemedText type="smallBold">{row.title}</ThemedText>
                {row.isDefault ? (
                  <ThemedText type="label" themeColor="textSecondary">
                    DEFAULT
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {row.detail}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.two },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.three,
    padding: Space.three,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  radio: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderWidth: 1.5,
    borderRadius: Radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: Radius.round },
  text: { flex: 1, gap: Space.half },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.two,
  },
});
