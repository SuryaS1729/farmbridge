import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type CardProps = PropsWithChildren<
  ViewProps & {
    tone?: "paper" | "dark";
  }
>;

export function Card({ children, style, tone = "paper", ...props }: CardProps) {
  const theme = useTheme();
  const isDark = tone === "dark";

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? theme.darkSurface : theme.backgroundElement,
          borderColor: isDark ? theme.darkSurface : theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Space.four,
  },
});
