import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

// Reanimated follows the phone's "reduce motion" setting by default, so this jumps instead.
const TIMING = { duration: 450, easing: Easing.out(Easing.cubic) };

/**
 * A row of bars plus "STEP 2 OF 3", for forms split into short steps. `step` counts from 0.
 *
 * `fraction` is how much of the current step is filled in, from 0 to 1, so the bar creeps
 * forward as each field is answered. Leave it out to show the current step as full.
 */
export function StepProgress({
  step,
  total,
  fraction = 1,
}: {
  step: number;
  total: number;
  fraction?: number;
}) {
  const theme = useTheme();
  // One value for the whole form: 1.5 means the first bar full and the second half full.
  // Animating that single number lets the fill run on smoothly from one bar into the next.
  const target = step + Math.min(1, Math.max(0, fraction));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(target, TIMING);
  }, [target, progress]);

  return (
    <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${total}`}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, index) => (
          <Bar
            key={index}
            index={index}
            progress={progress}
            fill={theme.accent}
            track={theme.border}
          />
        ))}
      </View>
      <ThemedText type="label" themeColor="textSecondary">
        STEP {step + 1} OF {total}
      </ThemedText>
    </View>
  );
}

function Bar({
  index,
  progress,
  fill,
  track,
}: {
  index: number;
  progress: SharedValue<number>;
  fill: string;
  track: string;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, progress.value - index)) * 100}%`,
  }));

  return (
    <View style={[styles.bar, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: fill }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { gap: Space.two },
  bars: { flexDirection: "row", gap: Space.one },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
