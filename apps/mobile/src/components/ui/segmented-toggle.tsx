import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutRectangle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Fonts, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

// Reanimated follows the phone's "reduce motion" setting by default, so this jumps instead.
const TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

type Option<T extends string> = { value: T; label: string; accessibilityLabel?: string };

/** A compact two-or-more option switch whose highlight slides to the selected option. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  // Options can differ in width ("kg" vs "quintal"), so measure each one.
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>({});
  const selectedIndex = options.findIndex((option) => option.value === value);

  const thumbX = useSharedValue(0);
  const thumbWidth = useSharedValue(0);
  const position = useSharedValue(selectedIndex);

  useEffect(() => {
    const layout = layouts[value];
    if (!layout) return;
    // The first placement snaps into position; later changes slide.
    if (thumbWidth.value === 0) {
      thumbX.value = layout.x;
      thumbWidth.value = layout.width;
      position.value = selectedIndex;
      return;
    }
    thumbX.value = withTiming(layout.x, TIMING);
    thumbWidth.value = withTiming(layout.width, TIMING);
    position.value = withTiming(selectedIndex, TIMING);
  }, [layouts, value, selectedIndex, thumbX, thumbWidth, position]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: thumbWidth.value,
    opacity: thumbWidth.value === 0 ? 0 : 1,
    transform: [{ translateX: thumbX.value }],
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: theme.accent }, thumbStyle]} />
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected }}
            onLayout={({ nativeEvent }) => {
              const { layout } = nativeEvent;
              setLayouts((current) => {
                const previous = current[option.value];
                if (previous && previous.x === layout.x && previous.width === layout.width) return current;
                return { ...current, [option.value]: layout };
              });
            }}
            onPress={() => onChange(option.value)}
            style={styles.segment}
          >
            <SegmentLabel
              label={option.label}
              index={index}
              position={position}
              selectedColor={theme.accentText}
              idleColor={theme.textSecondary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fades from the idle color to the selected color as the highlight arrives. */
function SegmentLabel({
  label,
  index,
  position,
  selectedColor,
  idleColor,
}: {
  label: string;
  index: number;
  position: SharedValue<number>;
  selectedColor: string;
  idleColor: string;
}) {
  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(Math.abs(position.value - index), 1),
      [0, 1],
      [selectedColor, idleColor],
    ),
  }));

  return <Animated.Text style={[styles.label, colorStyle]}>{label}</Animated.Text>;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 2,
    borderWidth: 1,
    borderRadius: 8,
  },
  thumb: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: 6,
  },
  segment: {
    minWidth: 38,
    minHeight: 30,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Space.two,
  },
  label: {
    fontFamily: Fonts?.sans,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
});
