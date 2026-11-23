import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** A row of bars plus "STEP 2 OF 3", for forms split into short steps. `step` counts from 0. */
export function StepProgress({ step, total }: { step: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${total}`}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.bar, { backgroundColor: index <= step ? theme.accent : theme.border }]}
          />
        ))}
      </View>
      <ThemedText type="label" themeColor="textSecondary">
        STEP {step + 1} OF {total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { gap: Space.two },
  bars: { flexDirection: "row", gap: Space.one },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
