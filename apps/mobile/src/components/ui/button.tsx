import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type ButtonVariant = "accent" | "ink" | "outline";

type ButtonProps = {
  label: string;
  onPress: PressableProps["onPress"];
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = "accent",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const backgroundColor =
    variant === "accent"
      ? theme.accent
      : variant === "ink"
        ? theme.ink
        : theme.backgroundElement;
  const textColor = variant === "outline" ? theme.text : theme.paper;
  const borderColor = variant === "outline" ? theme.border : backgroundColor;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor },
        (pressed || isDisabled) && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "accent" ? theme.accentText : textColor}
        />
      ) : (
        <ThemedText
          type="smallBold"
          style={{ color: variant === "accent" ? theme.accentText : textColor }}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
  },
  pressed: {
    opacity: 0.65,
  },
});
